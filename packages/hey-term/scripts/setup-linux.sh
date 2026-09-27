#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Linux (Kali, Debian/Ubuntu-based, WSL).
# Installs system audio deps + best-effort voice packs, installs Python
# deps, bootstraps .env, and pre-downloads the Whisper model.
#
# Usage:
#   ./scripts/setup-linux.sh                    # English only, asks before installing
#   ./scripts/setup-linux.sh --langs es,fr,de    # also try to install voice packs for these
#   ./scripts/setup-linux.sh --yes               # don't prompt before system package installs
#   ./scripts/setup-linux.sh --dry-run           # print what it would do, change nothing
#   sudo ./scripts/setup-linux.sh --langs es     # (needed unless already root, e.g. some containers)
set -euo pipefail

LANGS="en"
ASSUME_YES=0
DRY_RUN=0

usage() {
  echo "Usage: $0 [--langs es,fr,de,pt,it] [--yes] [--dry-run]"
  echo "  --langs   Comma-separated language codes to also install voice packs for."
  echo "            Supported by Hey Term's translated prompts: en es fr de pt it."
  echo "  --yes     Don't prompt before running apt (implied inside CI/non-interactive shells)."
  echo "  --dry-run Print what would happen; run nothing that changes the system."
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --langs) LANGS="$2"; shift 2 ;;
    --langs=*) LANGS="${1#*=}"; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

confirm_or_exit() {
  if [ "$ASSUME_YES" = "1" ] || [ "$DRY_RUN" = "1" ] || [ ! -t 0 ]; then
    return 0
  fi
  read -r -p "$1 [y/N] " reply
  case "$reply" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) echo "Skipped."; return 1 ;;
  esac
}

SUDO=""
if [ "$(id -u)" != "0" ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "Not running as root and no sudo found -- system package installs will be skipped." >&2
  fi
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script is for Debian/Ubuntu/Kali-family systems (needs apt-get)."
  echo "On another distro, install manually: portaudio (dev headers), bash, espeak-ng, then continue at 'pip install' below."
  exit 1
fi

echo "== Hey Term Linux setup =="
echo "Languages requested: $LANGS"
echo

# --- 1. Core system audio dependencies ---------------------------------
CORE_PACKAGES="portaudio19-dev bash espeak-ng"
if confirm_or_exit "Install core packages ($CORE_PACKAGES) via apt?"; then
  run ${SUDO} apt-get update -qq
  run ${SUDO} apt-get install -y $CORE_PACKAGES
fi

# --- 2. Best-effort mbrola voice packs for requested languages ---------
# mbrola voice package names aren't uniform across languages (mbrola-en1,
# mbrola-us2, mbrola-es1, mbrola-fr4, ...), so rather than hardcoding names
# that might not exist on this apt mirror or might be wrong for a given
# Debian/Ubuntu release, this searches apt-cache for whatever actually
# exists that starts with the language's mbrola prefix and installs those.
# espeak-ng (installed above) already covers every language on its own --
# this is purely a quality upgrade where it's available.
declare -A MBROLA_PREFIX=(
  [en]="mbrola-en mbrola-us mbrola-gb"
  [es]="mbrola-es"
  [fr]="mbrola-fr"
  [de]="mbrola-de"
  [pt]="mbrola-pt mbrola-br"
  [it]="mbrola-it"
)

IFS=',' read -ra LANG_ARR <<< "$LANGS"
FOUND_ANY_MBROLA=0
MBROLA_TO_INSTALL=()
for lang in "${LANG_ARR[@]}"; do
  lang="$(echo "$lang" | tr -d '[:space:]')"
  prefixes="${MBROLA_PREFIX[$lang]:-}"
  [ -z "$prefixes" ] && continue
  for prefix in $prefixes; do
    matches=$(apt-cache search --names-only "^${prefix}" 2>/dev/null | awk '{print $1}' || true)
    if [ -n "$matches" ]; then
      FOUND_ANY_MBROLA=1
      while IFS= read -r pkg; do
        MBROLA_TO_INSTALL+=("$pkg")
      done <<< "$matches"
    fi
  done
done

if [ "$FOUND_ANY_MBROLA" = "1" ]; then
  echo "Found mbrola voice packages for your requested languages:"
  printf '  %s\n' "${MBROLA_TO_INSTALL[@]}"
  if confirm_or_exit "Install these mbrola voice packages (better quality than plain espeak-ng)?"; then
    run ${SUDO} apt-get install -y "${MBROLA_TO_INSTALL[@]}"
  fi
else
  echo "No mbrola voice packages found on this apt mirror for: $LANGS"
  echo "espeak-ng (already installed above) still covers these languages -- just more robotic-sounding."
fi
echo

# --- 3. Python dependencies ---------------------------------------------
echo "Installing Python dependencies..."
PIP_ARGS=""
if python3 -c "import sys; sys.exit(0 if sys.prefix != sys.base_prefix else 1)" 2>/dev/null; then
  echo "(virtual environment detected -- installing into it)"
else
  echo "(no virtual environment detected -- installing with --break-system-packages)"
  PIP_ARGS="--break-system-packages"
fi
run python3 -m pip install -q $PIP_ARGS -r "$(dirname "$0")/../requirements.txt"

# --- 4. .env bootstrap ---------------------------------------------------
ENV_DIR="$(dirname "$0")/.."
if [ ! -f "$ENV_DIR/.env" ]; then
  run cp "$ENV_DIR/.env.example" "$ENV_DIR/.env"
  echo "Created .env -- edit it and add your ANTHROPIC_API_KEY before running Hey Term."
else
  echo ".env already exists -- leaving it alone."
fi

# --- 5. Pre-download the Whisper model -----------------------------------
if [ "$DRY_RUN" = "0" ]; then
  echo "Pre-downloading the Whisper speech-to-text model (one-time, ~150MB)..."
  python3 -c "from faster_whisper import WhisperModel; WhisperModel('base')" || \
    echo "Model pre-download failed or was skipped -- it will just download on first run instead."
else
  echo "[dry-run] would pre-download the Whisper model"
fi

echo
echo "Done. Next steps:"
echo "  1. Edit .env and set ANTHROPIC_API_KEY."
echo "  2. Run: python3 main.py --lang en   (or --lang es / fr / de / pt / it)"
