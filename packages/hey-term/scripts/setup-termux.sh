#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Android, inside Termux.
#
# This is a different script from scripts/setup-linux.sh, not just "Linux
# with different package names" -- voice I/O on Termux is a genuinely
# different pipeline, not the desktop one with different install commands:
#
#   - Capture: no PortAudio on Android, so lib/audio.py routes through
#     lib/termux_audio.py's termux-microphone-record/ffmpeg bridge (the
#     Termux:API app's CLI tools) instead of sounddevice.
#   - Transcription: faster-whisper's inference engine, ctranslate2, has NO
#     Android build at all -- no wheel, no working source install -- so
#     Termux instead runs a real, self-built whisper.cpp binary doing the
#     same Whisper algorithm natively on-device. This script clones and
#     compiles it (once) and downloads its model, which is the part that
#     takes real time on a phone: expect the build to take several minutes
#     and the model download to be ~150MB.
#   - Speech output: termux-tts-speak (Android's own system TTS), unrelated
#     to any of the above.
#
# Usage:
#   ./scripts/setup-termux.sh              # installs everything, asks before pkg/build steps
#   ./scripts/setup-termux.sh --yes        # don't prompt before pkg installs or the build
#   ./scripts/setup-termux.sh --dry-run    # print what it would do, change nothing
#   ./scripts/setup-termux.sh --skip-build # install packages/deps only, skip whisper.cpp
#                                           # build+model (e.g. to do that step separately,
#                                           # or retry just that step later)
set -euo pipefail

ASSUME_YES=0
DRY_RUN=0
SKIP_BUILD=0

usage() {
  echo "Usage: $0 [--yes] [--dry-run] [--skip-build]"
  echo "  --yes        Don't prompt before running pkg install or the whisper.cpp build."
  echo "  --dry-run    Print what would happen; run nothing that changes the system."
  echo "  --skip-build Skip cloning/building whisper.cpp and downloading its model."
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
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

WHISPER_DIR="$HOME/.hey-term/whisper-cpp"
WHISPER_MODEL_SIZE="${WHISPER_MODEL_SIZE:-base}"

echo "== Hey Term Termux setup =="
echo

# --- 1. termux-api + ffmpeg + build tools --------------------------------
echo "Note: 'termux-api' is the *CLI tools* package. You still need the"
echo "separate \"Termux:API\" app installed from the same store you got"
echo "Termux from (F-Droid or Play Store, matching publisher) -- the CLI"
echo "tools talk to that app, and can't reach the mic/speaker without it."
echo
echo "clang/cmake/make/git build the on-device whisper.cpp speech recognizer"
echo "(step 5 below) -- a real compiler toolchain, not just a package install."
echo
if confirm_or_exit "Install termux-api, ffmpeg, and build tools (clang, cmake, make, git) via pkg?"; then
  run pkg update -y
  run pkg install -y termux-api ffmpeg clang cmake make git
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

# --- 5. Build the on-device speech recognizer (whisper.cpp) --------------
if [ "$SKIP_BUILD" = "1" ]; then
  echo "Skipping the whisper.cpp build (--skip-build). Voice input won't work"
  echo "until you run this script again without that flag."
elif confirm_or_exit "Clone and build whisper.cpp for on-device speech recognition (several minutes, ~1GB temporary disk)?"; then
  if [ -d "$WHISPER_DIR/.git" ]; then
    echo "whisper.cpp already cloned at $WHISPER_DIR -- pulling latest instead of re-cloning."
    run git -C "$WHISPER_DIR" pull --ff-only
  else
    run mkdir -p "$(dirname "$WHISPER_DIR")"
    run git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WHISPER_DIR"
  fi

  echo "Building (this compiles real C++ on your phone's CPU -- expect several minutes)..."
  run cmake -B "$WHISPER_DIR/build" -S "$WHISPER_DIR" -DCMAKE_BUILD_TYPE=Release
  run cmake --build "$WHISPER_DIR/build" --config Release -j"$(nproc 2>/dev/null || echo 2)"

  if [ "$DRY_RUN" = "0" ] && [ ! -x "$WHISPER_DIR/build/bin/whisper-cli" ]; then
    echo "Build finished but whisper-cli wasn't found at the expected path -- something" >&2
    echo "went wrong. Voice input won't work until this is fixed; typing a request" >&2
    echo "still works either way (see README.md)." >&2
  fi

  echo "Downloading the ${WHISPER_MODEL_SIZE} speech model (one-time, ~150MB for 'base')..."
  if [ "$DRY_RUN" = "0" ]; then
    ( cd "$WHISPER_DIR" && bash models/download-ggml-model.sh "$WHISPER_MODEL_SIZE" ) || \
      echo "Model download failed -- check your connection and re-run this script (or just" \
           "'cd $WHISPER_DIR && bash models/download-ggml-model.sh $WHISPER_MODEL_SIZE' again)." >&2
  else
    echo "[dry-run] would download the ${WHISPER_MODEL_SIZE} model"
  fi
else
  echo "Skipped. Voice input won't work until whisper.cpp is built -- re-run this script"
  echo "(or 'bash scripts/setup-termux.sh') when you're ready; typing a request still"
  echo "works either way (see README.md)."
fi

echo
echo "Done. Next steps:"
echo "  1. Install the \"Termux:API\" app if you haven't already (same store as Termux)."
echo "  2. Edit .env and set ANTHROPIC_API_KEY."
echo "  3. Run: python main.py --lang en   (or --lang es / fr / de / pt / it)"
