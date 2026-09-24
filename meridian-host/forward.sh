#!/usr/bin/env bash
# Router 80/443 -> this laptop. Puts Caddy in front of the already-running
# shop and gets it a real certificate. Assumes two things this script cannot
# do for you: DNS for NAME already points at your public IP, and your router
# already forwards ports 80 and 443 to this machine's LAN address.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SHOP="${SHOP:-$ROOT/shop}"
. "$ROOT/_lib.sh"

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || die "usage: sudo ./multinicheai forward your-domain.com"
need_root forward
[ -f "$SHOP/container/.env" ] || die "no shop set up yet — run laptop or bootstrap first"

PORT="$(grep -oP '(?<=^PORT=).*' "$SHOP/container/.env" 2>/dev/null || true)"
PORT="${PORT:-8080}"

write_caddyfile "$DOMAIN" "$PORT"

sed -i \
  -e "s#^SITE_URL=.*#SITE_URL=https://${DOMAIN}#" \
  -e "s#^TRUST_PROXY=.*#TRUST_PROXY=true#" \
  "$SHOP/container/.env"
grep -q '^TRUST_PROXY=' "$SHOP/container/.env" || echo "TRUST_PROXY=true" >> "$SHOP/container/.env"

systemctl restart "$SERVICE_NAME" 2>/dev/null || true

log "https://${DOMAIN} should be live once DNS + port-forwarding are correct"
log "Stripe webhook: https://${DOMAIN}/api/webhook — put the signing secret in $SHOP/container/.env"
