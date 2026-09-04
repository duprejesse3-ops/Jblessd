#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+.
#
# Runs "vault sync" on a schedule so your context brief never goes stale.
# Works anywhere: a spare laptop left on, a $4 VPS, a Raspberry Pi.
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (runs every hour, at :22 — off the hour, since cron everywhere
#      stacks up at :00):
#
#        22 * * * * MULTIVAULT_PASSPHRASE=xxxx MULTIVAULT_DEST=/home/you/.multivault /path/to/adapters/cron.sh
#
# Environment:
#   MULTIVAULT_PASSPHRASE  required — the passphrase shown at "vault init"
#   MULTIVAULT_DEST        where the vault lives (default: ./.multivault next to this package)
#   MULTIVAULT_LOG         where run logs are appended (default: ./multivault.log)
#
# Your passphrase lives only in the crontab line above (or better: a
# separate 0600-permissioned file you source before calling this script). It
# is never written by this adapter to the log or anywhere else.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")

DEST=${MULTIVAULT_DEST:-"$PACKAGE_DIR/.multivault"}
LOG=${MULTIVAULT_LOG:-"$PACKAGE_DIR/multivault.log"}

if [ -z "${MULTIVAULT_PASSPHRASE:-}" ]; then
  echo "MULTIVAULT_PASSPHRASE is not set — see the header of this script." >&2
  exit 2
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "--- $STAMP ---"
  node "$PACKAGE_DIR/bin/vault.mjs" sync --dest "$DEST"
} >> "$LOG" 2>&1

echo "$STAMP $DEST -> see $LOG"
