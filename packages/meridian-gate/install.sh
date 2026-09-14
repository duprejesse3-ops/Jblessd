#!/usr/bin/env bash
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install it from https://nodejs.org and re-run this script." >&2
  exit 1
fi

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node $(node --version) found, but 18+ is required." >&2
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Meridian Gate installed at $DIR"
echo ""
echo "Nothing is allowed through yet — that's the default. Add your first rule:"
echo ""
echo "  node \"$DIR/bin/gate.mjs\" allow api.anthropic.com --by \"your name\" --note \"Claude API\""
echo ""
echo "Then start it:"
echo ""
echo "  node \"$DIR/bin/gate.mjs\" start"
echo ""
echo "To run it as a background service, see adapters/systemd.service."
