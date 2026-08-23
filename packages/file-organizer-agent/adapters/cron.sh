#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+.
#
# The floor — depends on nobody. Works on a Raspberry Pi, a spare laptop left
# on, a $4 VPS with the folder synced over, or any shell account. If every
# other adapter in this package disappeared tomorrow, this one still would.
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (run every hour, at :17 — off the hour, since cron everywhere
#      stacks up at :00):
#
#        17 * * * * ORGANIZE_FOLDER=/home/you/Downloads /path/to/adapters/cron.sh
#
# Environment:
#   ORGANIZE_FOLDER   folder to organize (default: $HOME/Downloads)
#   ORGANIZE_DEST     where sorted files go (default: <folder>/Organized)
#   ORGANIZE_LOG      where run logs are appended (default: ./organize.log)
#   ORGANIZE_AI       set to 1 to use AI for files the rules can't place
#                      (requires ANTHROPIC_API_KEY to also be set)
#   ANTHROPIC_API_KEY optional — only read if ORGANIZE_AI=1

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")

FOLDER=${ORGANIZE_FOLDER:-"$HOME/Downloads"}
LOG=${ORGANIZE_LOG:-"$PACKAGE_DIR/organize.log"}

AI_FLAG=''
if [ "${ORGANIZE_AI:-0}" = '1' ]; then
  AI_FLAG='--ai'
fi

DEST_FLAG=''
if [ -n "${ORGANIZE_DEST:-}" ]; then
  DEST_FLAG="--dest $ORGANIZE_DEST"
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "--- $STAMP ---"
  node "$PACKAGE_DIR/bin/organize.mjs" "$FOLDER" --apply $AI_FLAG $DEST_FLAG
} >> "$LOG" 2>&1

echo "$STAMP $FOLDER -> see $LOG"
