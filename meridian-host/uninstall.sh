#!/usr/bin/env bash
# Removes the systemd service `bootstrap`/`laptop` installed. Deliberately
# does NOT touch: the shop directory, container/.env, the Postgres database,
# the Caddy site block, or the firewall — your repo and your data stay put.
# Remove those by hand if you actually want them gone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/_lib.sh"

need_root uninstall

if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
  systemctl disable --now "$SERVICE_NAME"
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  log "stopped and removed the ${SERVICE_NAME} service"
else
  log "no ${SERVICE_NAME} service was installed"
fi

log "left in place: the shop directory, container/.env, the database, Caddy, ufw"
log "to also drop the database:  sudo -u postgres dropdb multinicheai"
