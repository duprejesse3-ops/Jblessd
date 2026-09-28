#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Entry point: hands off to the real Linux setup script (system audio deps,
# best-effort voice packs, Python deps, .env, Whisper model). See
# scripts/setup-linux.sh --help for every flag; anything you pass here is
# forwarded as-is, e.g.:
#
#   ./install.sh --langs es,fr,de
#   ./install.sh --yes
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/scripts/setup-linux.sh" "$@"
