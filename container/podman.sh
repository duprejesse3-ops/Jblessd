#!/bin/sh
# Run the jblessd.com storefront under Podman, without compose.
#
#   container/podman.sh up             # start Postgres, migrate, start the app
#   container/podman.sh up --build     # rebuild the image first
#   container/podman.sh logs           # follow the app's output
#   container/podman.sh status
#   container/podman.sh migrate        # re-run migrations against a live stack
#   container/podman.sh down           # stop and remove; volumes survive
#   container/podman.sh down --volumes # ...and delete the data too
#
# Why this exists alongside docker-compose.yml: that file leans on two things
# podman-compose does not reliably honour — starting a service only once another
# reports healthy, and waiting for the one-shot migration job to exit 0. Where
# those are ignored the app races Postgres and the first boot lands on an
# unmigrated database. Here the ordering is explicit shell, so it holds on any
# Podman, with or without compose installed.
#
# Everything runs in one pod, so the containers share a network namespace and
# reach Postgres on 127.0.0.1:5432. That needs no DNS plugin and no user-defined
# network, which is where rootless setups usually differ. Only the app's port is
# published; Postgres is not reachable from outside the pod.
#
# Storage is named volumes, deliberately. Podman copies the image's ownership
# onto a fresh named volume, so the unprivileged `node` user can write to
# /data/blobs. A rootless bind mount would not — see README.md.

set -eu

cd "$(dirname "$0")/.."

POD=${POD_NAME:-jblessd}
IMAGE=${APP_IMAGE:-jblessd-store:local}
PG_IMAGE=${PG_IMAGE:-docker.io/library/postgres:17-alpine}
ENV_FILE=${ENV_FILE:-container/.env}

PG_CTR="$POD-postgres"
APP_CTR="$POD-app"
PG_VOL="$POD-pgdata"
BLOB_VOL="$POD-blobs"

require_podman() {
  command -v podman >/dev/null 2>&1 || {
    echo "error: podman is not on PATH" >&2
    exit 1
  }
}

# Reads one key out of the env file rather than sourcing it. Values here contain
# spaces and angle brackets — EMAIL_FROM is `Name <addr>` — which `.` would try
# to execute and redirect. Last assignment wins, matching how the runtimes read
# these files, and surrounding quotes are stripped the way compose strips them.
envval() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^[[:space:]]*$1[[:space:]]*=//p" "$ENV_FILE" |
    tail -n 1 |
    tr -d '\r' |
    sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

require_env() {
  [ -f "$ENV_FILE" ] || {
    echo "error: $ENV_FILE not found." >&2
    echo "       cp container/.env.example container/.env  # then fill it in" >&2
    exit 1
  }

  PGPASS=$(envval POSTGRES_PASSWORD)
  [ -n "$PGPASS" ] || {
    echo "error: POSTGRES_PASSWORD is empty in $ENV_FILE" >&2
    exit 1
  }

  # The password is interpolated into a URL, so anything with reserved meaning
  # there truncates it into a connection string that fails obscurely. Compose
  # builds DATABASE_URL the same way and has the same constraint.
  case "$PGPASS" in
    *[!A-Za-z0-9._~-]*)
      echo "warning: POSTGRES_PASSWORD contains characters that are reserved in a URL;" >&2
      echo "         use only letters, digits and . _ ~ - to avoid a malformed DATABASE_URL" >&2
      ;;
  esac

  HOST_PORT=$(envval PORT)
  HOST_PORT=${HOST_PORT:-8080}
  DATABASE_URL="postgres://storefront:$PGPASS@127.0.0.1:5432/storefront"
}

build_image() {
  require_podman
  echo "==> Building $IMAGE"
  podman build --file container/Dockerfile --tag "$IMAGE" .
}

# A bare name means a local build; a registry reference means someone set
# APP_IMAGE to a published tag and wants that, not a rebuild of it.
ensure_image() {
  if [ "${1:-}" = "--build" ]; then
    build_image
    return
  fi
  podman image exists "$IMAGE" && return 0
  case "$IMAGE" in
    */*) echo "==> Pulling $IMAGE"; podman pull "$IMAGE" ;;
    *) build_image ;;
  esac
}

start_postgres() {
  if podman container exists "$PG_CTR"; then
    podman start "$PG_CTR" >/dev/null
  else
    echo "==> Starting Postgres"
    podman run -d \
      --pod "$POD" \
      --name "$PG_CTR" \
      --restart unless-stopped \
      -e POSTGRES_USER=storefront \
      -e POSTGRES_PASSWORD="$PGPASS" \
      -e POSTGRES_DB=storefront \
      -v "$PG_VOL:/var/lib/postgresql/data" \
      "$PG_IMAGE" >/dev/null
  fi

  # Polled here rather than left to the image's HEALTHCHECK. Podman runs those
  # on a systemd timer, and where there is no user systemd session — WSL without
  # it, a container-in-container CI runner — health never leaves "starting" and
  # anything gated on it waits forever. pg_isready needs none of that.
  printf 'Waiting for Postgres'
  waited=0
  until podman exec "$PG_CTR" pg_isready -U storefront -d storefront >/dev/null 2>&1; do
    waited=$((waited + 1))
    if [ "$waited" -gt 60 ]; then
      echo
      echo "error: Postgres was not ready after 60s. Check: podman logs $PG_CTR" >&2
      exit 1
    fi
    printf '.'
    sleep 1
  done
  echo ' ready'
}

run_migrations() {
  echo "==> Applying migrations"
  podman run --rm \
    --pod "$POD" \
    -e DATABASE_URL="$DATABASE_URL" \
    "$IMAGE" \
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    --import ./container/hooks/register.mjs container/migrate.mjs
}

cmd_up() {
  require_podman
  require_env
  ensure_image "${1:-}"

  if podman pod exists "$POD"; then
    # The published port is fixed when the pod is created, so an edited PORT
    # takes effect only after a `down`. Worth saying, rather than leaving the
    # setting looking ignored. Silent if the field is not there to read.
    bound=$(podman pod inspect "$POD" \
      --format '{{range $p, $b := .InfraConfig.PortBindings}}{{range $b}}{{.HostPort}}{{end}}{{end}}' \
      2>/dev/null || true)
    if [ -n "$bound" ] && [ "$bound" != "$HOST_PORT" ]; then
      echo "note: pod $POD publishes $bound, not $HOST_PORT." >&2
      echo "      Run 'container/podman.sh down' first to change it." >&2
    fi
  else
    echo "==> Creating pod $POD (publishing $HOST_PORT)"
    podman pod create --name "$POD" --publish "$HOST_PORT:8080" >/dev/null
  fi

  start_postgres
  run_migrations

  # Recreated rather than restarted, so a rebuilt image or an edited .env
  # actually takes effect instead of silently running the previous one.
  podman rm -f "$APP_CTR" >/dev/null 2>&1 || true

  echo "==> Starting app"
  podman run -d \
    --pod "$POD" \
    --name "$APP_CTR" \
    --restart unless-stopped \
    --env-file "$ENV_FILE" \
    -e DATABASE_URL="$DATABASE_URL" \
    -e BLOBS_DIR=/data/blobs \
    -e PORT=8080 \
    -v "$BLOB_VOL:/data/blobs" \
    "$IMAGE" >/dev/null

  echo
  echo "Up on http://localhost:$HOST_PORT"
  echo "Logs: container/podman.sh logs"
}

cmd_down() {
  require_podman
  if podman pod exists "$POD"; then
    echo "==> Removing pod $POD"
    podman pod rm -f "$POD" >/dev/null
  fi

  if [ "${1:-}" = "--volumes" ]; then
    echo "==> Removing volumes"
    podman volume rm "$PG_VOL" "$BLOB_VOL" >/dev/null 2>&1 || true
  else
    echo "Volumes $PG_VOL and $BLOB_VOL kept. Add --volumes to delete them."
  fi
}

cmd=${1:-up}
[ $# -gt 0 ] && shift

case "$cmd" in
  up)
    cmd_up "${1:-}"
    ;;
  down)
    cmd_down "${1:-}"
    ;;
  build)
    build_image
    ;;
  migrate)
    require_podman
    require_env
    run_migrations
    ;;
  logs)
    require_podman
    podman logs -f "$APP_CTR"
    ;;
  status)
    require_podman
    podman pod ps --filter "name=$POD"
    podman ps -a --filter "pod=$POD" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
    ;;
  *)
    echo "usage: container/podman.sh [up [--build] | down [--volumes] | build | migrate | logs | status]" >&2
    exit 2
    ;;
esac
