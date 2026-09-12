#!/usr/bin/env bash
# Public tunnel; shop stays here. For a CGNAT connection or an ISP that won't
# let you forward ports — no DNS, no router, no sudo, no Cloudflare account.
# `forward` (needs a domain + port forwarding) is the better option when you
# have both; this is the fallback when you don't.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SHOP="${SHOP:-$ROOT/shop}"

PORT="$(grep -oP '(?<=^PORT=).*' "$SHOP/container/.env" 2>/dev/null || true)"
PORT="${PORT:-8080}"

if ! curl -fsS -o /dev/null "http://127.0.0.1:${PORT}" 2>/dev/null; then
  echo "Nothing answering on http://127.0.0.1:${PORT}."
  echo "Start the shop first: ./multinicheai laptop   (or ./multinicheai run)"
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  cat <<'MSG'
cloudflared is not installed. On Debian/Kali/Ubuntu:

  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list
  sudo apt-get update && sudo apt-get install -y cloudflared

Then run ./multinicheai share again.
MSG
  exit 1
fi

echo "Tunneling http://127.0.0.1:${PORT} — the public URL prints below (*.trycloudflare.com)."
echo "Ctrl-C stops the tunnel; the shop keeps running locally either way."
exec cloudflared tunnel --url "http://127.0.0.1:${PORT}"
