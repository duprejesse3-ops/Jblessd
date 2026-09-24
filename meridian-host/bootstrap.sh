#!/usr/bin/env bash
# One shot: shop, firewall, Caddy. This is the product (see OWN.txt) — the
# whole path from a bare Pi/laptop to a live, firewalled, HTTPS storefront.
# Same steps as `laptop` + `firewall` + `forward`, run in the right order.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SHOP="${SHOP:-$ROOT/shop}"
. "$ROOT/_lib.sh"

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || die "usage: sudo ./multinicheai bootstrap your-domain.com"
need_root bootstrap
ensure_node bootstrap

SERVICE_USER="${SUDO_USER:-root}"

log "1/3 — shop"
setup_shop "$ROOT" "$SHOP" "https://${DOMAIN}" "$SERVICE_USER"

log "2/3 — firewall"
bash "$ROOT/firewall.sh"

log "3/3 — Caddy"
bash "$ROOT/forward.sh" "$DOMAIN"

echo
log "Done. https://${DOMAIN} once DNS + your router's port forward are pointed here."
log "Test card first: point Stripe's webhook at https://${DOMAIN}/api/webhook, pay with 4242 4242 4242 4242."
log "Then set the real STRIPE_SECRET_KEY in $SHOP/container/.env and restart:"
log "  sudo systemctl restart ${SERVICE_NAME}"
