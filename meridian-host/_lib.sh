#!/usr/bin/env bash
# Shared by laptop.sh, bootstrap.sh, forward.sh, install.sh. Not run directly.
#
# Implements exactly what docs/self-hosting-checklist.md in the shop repo
# already specifies (Node 22.6+, Postgres, npm ci twice, migrate, systemd,
# Caddy) — this is that checklist automated, not a new design.

MIN_NODE_MAJOR=22
MIN_NODE_MINOR=6
SERVICE_NAME="multinicheai"

log() { echo "· $*" >&2; }
die() { echo "! $*" >&2; exit 1; }

need_root() {
  [ "$(id -u)" -eq 0 ] || die "Run as root: sudo ./multinicheai $1"
}

# --- Node --------------------------------------------------------------
ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local ver major minor
    ver="$(node -v | sed 's/^v//')"
    major="${ver%%.*}"
    minor="$(echo "$ver" | cut -d. -f2)"
    if [ "$major" -gt "$MIN_NODE_MAJOR" ] || { [ "$major" -eq "$MIN_NODE_MAJOR" ] && [ "$minor" -ge "$MIN_NODE_MINOR" ]; }; then
      log "node $ver OK"
      return
    fi
    log "node $ver is too old (need >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}) — upgrading"
  fi
  need_root "$1"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

# --- Postgres ------------------------------------------------------------
# A local cluster, not managed — this is a Pi/laptop with no cloud Postgres.
# Prints the DATABASE_URL it created on stdout; caller captures it.
ensure_postgres() {
  need_root "$1"
  if ! command -v psql >/dev/null 2>&1; then
    log "installing postgresql"
    apt-get update -y
    apt-get install -y postgresql
  fi
  systemctl enable --now postgresql

  local pass_file="/root/.multinicheai-db-password"
  local dbpass
  if [ -f "$pass_file" ]; then
    dbpass="$(cat "$pass_file")"
  else
    dbpass="$(head -c18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c24)"
    echo "$dbpass" > "$pass_file"
    chmod 600 "$pass_file"
  fi

  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='multinicheai'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE multinicheai LOGIN PASSWORD '$dbpass'"
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='multinicheai'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE DATABASE multinicheai OWNER multinicheai"

  echo "postgres://multinicheai:${dbpass}@127.0.0.1:5432/multinicheai"
}

# --- Caddy -----------------------------------------------------------------
ensure_caddy() {
  need_root "$1"
  command -v caddy >/dev/null 2>&1 && { log "caddy already installed"; return; }
  log "installing caddy"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
}

write_caddyfile() {
  local domain="$1" port="$2"
  need_root forward
  ensure_caddy forward
  local block="${domain} {
    reverse_proxy 127.0.0.1:${port}
}"
  if grep -q "^${domain} {" /etc/caddy/Caddyfile 2>/dev/null; then
    log "Caddyfile already has ${domain}, leaving it as-is"
  else
    printf '\n%s\n' "$block" >> /etc/caddy/Caddyfile
    log "added ${domain} to /etc/caddy/Caddyfile"
  fi
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
}

# --- The shop itself -------------------------------------------------------
# Clones (if needed), installs deps, writes container/.env, migrates, and
# installs+starts the systemd unit. Used by both `laptop` and `bootstrap`.
setup_shop() {
  local root="$1" shop="$2" site_url="$3" service_user="$4"
  local port="${PORT:-8080}"

  if [ ! -d "$shop/.git" ]; then
    if [ -n "${REPO:-}" ]; then
      bash "$root/from-github.sh" "$REPO" "$shop"
    else
      bash "$root/from-github.sh" "$shop"
    fi
  fi

  log "installing dependencies (first run is the slow one)"
  ( cd "$shop" && npm ci --omit=dev --no-audit --no-fund )
  ( cd "$shop" && npm --prefix container ci --no-audit --no-fund )

  if [ ! -f "$shop/container/.env" ]; then
    local admin_pass db_url
    admin_pass="$(head -c18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c20)"
    db_url="$(ensure_postgres setup)"
    cp "$shop/container/.env.example" "$shop/container/.env"
    {
      echo "DATABASE_URL=${db_url}"
      echo "SITE_URL=${site_url}"
      echo "HOST=127.0.0.1"
      echo "PORT=${port}"
      echo "TRUST_PROXY=true"
      echo "ADMIN_PASSWORD=${admin_pass}"
    } >> "$shop/container/.env"
    log "generated container/.env — admin password: ${admin_pass}"
    log "(also saved in $shop/container/.env — never committed, it's gitignored)"
  fi
  chmod 600 "$shop/container/.env"

  log "applying database migrations"
  ( cd "$shop" && set -a && . container/.env && set +a \
      && node --import ./container/hooks/register.mjs container/migrate.mjs )

  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=MultiNicheAI shop
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${shop}
EnvironmentFile=${shop}/container/.env
ExecStart=/usr/bin/node --import ${shop}/container/hooks/register.mjs ${shop}/container/server.mjs
Restart=always
RestartSec=5
User=${service_user}

[Install]
WantedBy=multi-user.target
UNIT

  if id -u "$service_user" >/dev/null 2>&1 && [ "$service_user" != "root" ]; then
    chown -R "$service_user":"$service_user" "$shop"
  fi

  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
  log "service '${SERVICE_NAME}' running — systemctl status ${SERVICE_NAME}"
}
