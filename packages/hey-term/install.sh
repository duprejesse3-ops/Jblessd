#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Entry point: detects Termux (Android) vs. a regular Linux machine and hands
# off to the matching setup script, since the two need different system
# packages -- Termux has no PortAudio/espeak-ng to install and instead needs
# the Termux:API CLI tools + ffmpeg (see scripts/setup-termux.sh's own header
# for why). See that script's or scripts/setup-linux.sh's --help for every
# flag; anything you pass here is forwarded as-is, e.g.:
#
#   ./install.sh --langs es,fr,de      # regular Linux
#   ./install.sh --yes                 # either
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "${PREFIX:-}" ] && [ "${PREFIX#*com.termux}" != "$PREFIX" ]; then
  exec "$DIR/scripts/setup-termux.sh" "$@"
fi
exec "$DIR/scripts/setup-linux.sh" "$@"
