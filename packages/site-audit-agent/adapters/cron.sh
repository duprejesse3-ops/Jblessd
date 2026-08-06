#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+.
#
# This is the floor — the version that depends on nobody. No CI provider, no
# serverless host, no account. A $4 VPS, a Raspberry Pi on your desk, a spare
# laptop, or a shell account will all run it. If every hosted service in this
# package's adapters folder disappeared tomorrow, this one would still work.
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (07:23 daily — off the hour, since cron everywhere stacks up at :00):
#
#        23 7 * * * AUDIT_TARGET=https://yoursite.com /path/to/adapters/cron.sh
#
# A systemd timer, if you prefer one, is in the README.
#
# Environment:
#   AUDIT_TARGET   required — the site to audit
#   AUDIT_DIR      where reports are written (default: ./site-audit-reports)
#   AUDIT_WEBHOOK  optional Slack/Discord/Zapier webhook for problems
#   AUDIT_KEEP     how many reports to retain (default: 30)
#   AUDIT_PAGES    pages to crawl (default: 25)
#   AUDIT_ALLOW_PRIVATE
#                  set to 1 to permit localhost / private IPs. Only do this when
#                  the target really is an intranet or staging box you control:
#                  it disables the guard that stops the auditor being pointed at
#                  internal services or a cloud metadata endpoint.

set -eu

if [ -z "${AUDIT_TARGET:-}" ]; then
  echo "AUDIT_TARGET is not set." >&2
  exit 2
fi

# Resolve the package root from this script's own location, so the cron entry
# can use any path and the script still finds the engine.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")

AUDIT_DIR=${AUDIT_DIR:-"$PWD/site-audit-reports"}
AUDIT_KEEP=${AUDIT_KEEP:-30}
AUDIT_PAGES=${AUDIT_PAGES:-25}

mkdir -p "$AUDIT_DIR"

# Empty unless explicitly opted in, so the guard is on by default.
PRIVATE_FLAG=''
if [ "${AUDIT_ALLOW_PRIVATE:-0}" = '1' ]; then
  PRIVATE_FLAG='--allow-private'
fi

STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
JSON="$AUDIT_DIR/audit-$STAMP.json"
MARKDOWN="$AUDIT_DIR/audit-$STAMP.md"

# --fail-on never: this script decides what to do with the result, and a
# non-zero exit from the CLI under `set -e` would skip the notification below.
node "$PACKAGE_DIR/bin/audit.mjs" "$AUDIT_TARGET" \
  --format json --out "$JSON" --max-pages "$AUDIT_PAGES" --fail-on never $PRIVATE_FLAG
node "$PACKAGE_DIR/bin/audit.mjs" "$AUDIT_TARGET" \
  --format markdown --out "$MARKDOWN" --max-pages "$AUDIT_PAGES" --fail-on never $PRIVATE_FLAG

STATUS=$(node --input-type=module -e '
  import { readFileSync } from "node:fs"
  process.stdout.write(JSON.parse(readFileSync(process.argv[1], "utf8")).status)
' "$JSON")

if [ -n "${AUDIT_WEBHOOK:-}" ]; then
  AUDIT_PACKAGE_DIR="$PACKAGE_DIR" node --input-type=module -e '
    import { readFileSync } from "node:fs"
    import { pathToFileURL } from "node:url"
    const { notify } = await import(
      pathToFileURL(`${process.env.AUDIT_PACKAGE_DIR}/lib/notify.mjs`).href
    )
    const report = JSON.parse(readFileSync(process.argv[1], "utf8"))
    await notify(report, process.env.AUDIT_WEBHOOK, { when: "problems" })
  ' "$JSON"
fi

# Keep the report directory from growing without bound. Only the files this
# script creates are considered.
if [ "$AUDIT_KEEP" -gt 0 ]; then
  for EXT in json md; do
    ls -1t "$AUDIT_DIR"/audit-*."$EXT" 2>/dev/null \
      | tail -n +"$((AUDIT_KEEP + 1))" \
      | while IFS= read -r OLD; do rm -f -- "$OLD"; done
  done
fi

echo "$STAMP $AUDIT_TARGET $STATUS -> $MARKDOWN"

# Non-zero when the site is unhealthy, so cron's MAILTO (or a wrapper) surfaces it.
[ "$STATUS" != "unhealthy" ]
