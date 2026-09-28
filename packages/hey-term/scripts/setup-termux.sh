#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Android, inside Termux.
#
# This is a different script from scripts/setup-linux.sh (not just "Linux
# with different package names") because voice I/O itself is different on
# Termux: there is no PortAudio and no espeak-ng speech engine reaching real
# hardware, so lib/audio.py and lib/speak.py both route through
# lib/termux_audio.py instead, which drives the mic and speaker through the
# separate Termux:API app's CLI tools (termux-microphone-record,
# termux-tts-speak). Those tools -- and ffmpeg, needed to decode what
# termux-microphone-record records -- are what this script installs;
# sounddevice/pyttsx3's system dependencies (portaudio, espeak-ng) are not
# needed here at all.
#
# Usage:
#   ./scripts/setup-termux.sh              # installs termux-api, ffmpeg, Python deps, .env
#   ./scripts/setup-termux.sh --yes        # don't prompt before pkg installs
#   ./scripts/setup-termux.sh --dry-run    # print what it would do, change nothing
set -euo pipefail

ASSUME_YES=0
DRY_RUN=0

usage() {
  echo "Usage: $0 [--yes] [--dry-run]"
  echo "  --yes     Don't prompt before running pkg install."
  echo "  --dry-run Print what would happen; run nothing that changes the system."
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
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

if [ -z "${PREFIX:-}" ] || [ "${PREFIX#*com.termux}" = "$PREFIX" ]; then
  echo "This doesn't look like Termux (no com.termux in \$PREFIX)." >&2
  echo "On a regular Linux machine, use ./install.sh (scripts/setup-linux.sh) instead." >&2
  exit 1
fi

echo "== Hey Term Termux setup =="
echo

# --- 1. termux-api (the CLI side of the Termux:API bridge) + ffmpeg -----
echo "Note: this installs the *CLI tools* (termux-api package). You still need"
echo "the separate \"Termux:API\" app installed from the same store you got"
echo "Termux from (F-Droid or Play Store, matching publisher) -- the CLI tools"
echo "talk to that app, and can't reach the mic/speaker without it."
echo
if confirm_or_exit "Install termux-api and ffmpeg via pkg?"; then
  run pkg update -y
  run pkg install -y termux-api ffmpeg
fi
echo

# --- 2. Mic permission reminder -----------------------------------------
echo "Android will prompt for microphone permission the first time Hey Term"
echo "listens -- grant it, or set it manually in Android's App Info screen"
echo "for Termux:API if the prompt doesn't appear."
echo

# --- 3. Python dependencies -----------------------------------------------
echo "Installing Python dependencies..."
PIP_ARGS=""
if python3 -c "import sys; sys.exit(0 if sys.prefix != sys.base_prefix else 1)" 2>/dev/null; then
  echo "(virtual environment detected -- installing into it)"
else
  PIP_ARGS="--break-system-packages"
fi
run python3 -m pip install -q $PIP_ARGS -r "$(dirname "$0")/../requirements-termux.txt"

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
echo "  1. Install the \"Termux:API\" app if you haven't already (same store as Termux)."
echo "  2. Edit .env and set ANTHROPIC_API_KEY."
echo "  3. Run: python main.py --lang en   (or --lang es / fr / de / pt / it)"
