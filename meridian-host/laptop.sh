#!/usr/bin/env bash
# This laptop is the VPS. Installs Postgres, the shop, and a systemd service
# that survives reboot — but stays on 127.0.0.1 until you also run `forward`
# or `share`. Run `laptop` first to prove it works locally before going public.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SHOP="${SHOP:-$ROOT/shop}"
. "$ROOT/_lib.sh"

need_root laptop
ensure_node laptop

SERVICE_USER="${SUDO_USER:-root}"
SITE_URL="${1:-http://localhost:8080}"

setup_shop "$ROOT" "$SHOP" "$SITE_URL" "$SERVICE_USER"

log "up on http://127.0.0.1:$(grep -oP '(?<=^PORT=).*' "$SHOP/container/.env" || echo 8080)"
log "not public yet. Next: sudo ./multinicheai forward NAME   (or ./multinicheai share)"
