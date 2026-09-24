#!/usr/bin/env bash
# Meridian only. Runs the shop in the foreground so you can watch it boot and
# Ctrl-C it — for checking container/.env and a database connection before
# committing to `laptop` or `bootstrap`, which install it as a real service.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SHOP="${SHOP:-$ROOT/shop}"

[ -d "$SHOP" ] || { echo "No shop yet. Run: ./multinicheai from-github [REPO]"; exit 1; }
[ -f "$SHOP/container/.env" ] || {
  echo "$SHOP/container/.env is missing."
  echo "Copy $SHOP/container/.env.example to $SHOP/container/.env and fill it in."
  exit 1
}

cd "$SHOP"
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run only)..."
  npm ci
  npm --prefix container ci
fi

set -a
. container/.env
set +a
: "${PORT:=8080}"
: "${HOST:=0.0.0.0}"
export PORT HOST

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying database migrations..."
  node --import ./container/hooks/register.mjs container/migrate.mjs
else
  echo "No DATABASE_URL set — the shop will run with the bundled fallback catalog only."
fi

echo "Starting on http://localhost:${PORT} — Ctrl-C to stop."
exec node --import ./container/hooks/register.mjs container/server.mjs
