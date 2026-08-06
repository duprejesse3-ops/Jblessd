#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# One-command install for the Site Audit Agent.
#
#   ./install.sh
#
# Copies the package somewhere stable and puts a `site-audit` command on your
# PATH. Nothing is downloaded, nothing is compiled, and no packages are fetched
# from a registry — the whole tool is the files sitting next to this script.
#
# Uninstall is the exact reverse and is printed at the end. There is no
# uninstaller to run and no state left anywhere else on the machine.
#
# Override either location if the defaults don't suit you:
#   PREFIX=/usr/local ./install.sh     # system-wide (needs sudo)
#   BIN_DIR=~/bin ./install.sh         # just the symlink somewhere else

set -eu

PACKAGE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)

PREFIX="${PREFIX:-$HOME/.local}"
LIB_DIR="${LIB_DIR:-$PREFIX/lib/site-audit-agent}"
BIN_DIR="${BIN_DIR:-$PREFIX/bin}"

# ---- checks --------------------------------------------------------------

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed, or not on your PATH." >&2
  echo "This tool needs Node 18 or newer: https://nodejs.org/" >&2
  exit 1
fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node $(node -v) is too old — this needs Node 18 or newer." >&2
  echo "Node 18 is where global fetch() landed, which the auditor relies on." >&2
  exit 1
fi

if [ ! -f "$PACKAGE_DIR/bin/audit.mjs" ]; then
  echo "Error: run this from inside the unpacked package — bin/audit.mjs is missing." >&2
  exit 1
fi

# ---- install -------------------------------------------------------------

echo "Installing the Site Audit Agent"
echo "  from: $PACKAGE_DIR"
echo "  to:   $LIB_DIR"

mkdir -p "$LIB_DIR" "$BIN_DIR"

# Copy the contents rather than the directory, so re-running the installer
# refreshes an existing install instead of nesting one inside it.
for entry in lib bin adapters test README.md LICENSE.md package.json install.sh; do
  if [ -e "$PACKAGE_DIR/$entry" ]; then
    rm -rf "$LIB_DIR/$entry"
    cp -R "$PACKAGE_DIR/$entry" "$LIB_DIR/$entry"
  fi
done

chmod +x "$LIB_DIR/bin/audit.mjs" "$LIB_DIR/adapters/cron.sh" "$LIB_DIR/install.sh" 2>/dev/null || true

ln -sf "$LIB_DIR/bin/audit.mjs" "$BIN_DIR/site-audit"

# ---- verify --------------------------------------------------------------

# Run the real binary once. An install that reports success without ever
# executing the thing it installed is not worth much.
if ! "$BIN_DIR/site-audit" --version >/dev/null 2>&1; then
  echo "Error: installed, but 'site-audit --version' did not run cleanly." >&2
  echo "Try running it directly to see why: $LIB_DIR/bin/audit.mjs --version" >&2
  exit 1
fi

VERSION=$("$BIN_DIR/site-audit" --version 2>/dev/null || echo '?')

echo
echo "Installed $VERSION"
echo

case ":${PATH}:" in
  *":$BIN_DIR:"*)
    echo "Try it:"
    echo "  site-audit example.com"
    ;;
  *)
    # Being honest about this rather than silently editing a shell profile.
    echo "One more step — $BIN_DIR is not on your PATH."
    echo "Add this to your ~/.profile, ~/.bashrc, or ~/.zshrc:"
    echo
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    echo
    echo "Or run it by full path right now:"
    echo "  $BIN_DIR/site-audit example.com"
    ;;
esac

echo
echo "Schedule it (pick one):"
echo "  $LIB_DIR/adapters/cron.sh                 # cron or a systemd timer"
echo "  $LIB_DIR/adapters/github-actions.yml      # GitHub Actions"
echo "  $LIB_DIR/adapters/netlify-scheduled-function.mts"
echo
echo "Uninstall:"
echo "  rm -rf \"$LIB_DIR\" \"$BIN_DIR/site-audit\""
