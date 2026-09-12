#!/usr/bin/env bash
# Rented virtual server (optional). Identical to `bootstrap` — same shop +
# firewall + Caddy steps — under a separate name because a rented box and
# your own hardware are the same setup, just a different feeling about it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${1:-multinicheai.com}"
exec bash "$ROOT/bootstrap.sh" "$DOMAIN"
