#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+ and has already run
# "docs-bridge auth" once interactively (the refresh token it saves is what
# lets this run unattended from here on).
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (runs every hour, at :17 — off the hour, since cron everywhere
#      stacks up at :00):
#
#        17 * * * * /path/to/adapters/cron.sh
#
# Environment:
#   MULTIVAULT_DOCS_BRIDGE_CONFIG  where credentials live (default: ~/.multivault-docs-bridge/config.json)
#   MULTIVAULT_DOCS_BRIDGE_LOG     where run logs are appended (default: ./docs-bridge.log next to this script)

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")
LOG=${MULTIVAULT_DOCS_BRIDGE_LOG:-"$PACKAGE_DIR/docs-bridge.log"}

CONFIG_ARGS=""
if [ -n "${MULTIVAULT_DOCS_BRIDGE_CONFIG:-}" ]; then
  CONFIG_ARGS="--config $MULTIVAULT_DOCS_BRIDGE_CONFIG"
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "--- $STAMP ---"
  # shellcheck disable=SC2086
  node "$PACKAGE_DIR/bin/docs-bridge.mjs" sync $CONFIG_ARGS
} >> "$LOG" 2>&1

echo "$STAMP -> see $LOG"
