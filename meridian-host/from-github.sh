#!/usr/bin/env bash
# Pull a shop from GitHub. Pass their repo, or leave blank for MultiNicheAI.
set -euo pipefail
DEST="./shop"
REPO="${REPO:-}"
if [ -n "${1:-}" ]; then
  case "$1" in
    http://*|https://*|git@*|*.git)
      REPO="$1"
      DEST="${2:-./shop}"
      ;;
    *)
      DEST="$1"
      ;;
  esac
fi
REPO="${REPO:-https://github.com/duprejesse3-ops/Jblessd.git}"

if ! command -v git >/dev/null 2>&1; then
  echo "Git is missing. On Kali: sudo apt install git"
  exit 1
fi

if [ -d "${DEST}/.git" ]; then
  git -C "$DEST" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DEST"
fi

echo
echo "Shop repo is at ${DEST}"
echo "Source: ${REPO}"
echo "Checkout lives in this repo (Stripe functions). Keys do not."
echo "Put STRIPE_SECRET_KEY in ${DEST}/container/.env — never commit it."
echo
echo "GitHub is the copy of the shop. Stripe is the till. Done on this computer."
