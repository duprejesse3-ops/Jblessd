# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Configuration loaded from environment variables (see .env.example)."""
import os
import platform

PRODUCT_NAME = "Hey Term"
VERSION = "1.3.0"
COPYRIGHT = "Copyright (c) 2026 MultiNiche AI. All rights reserved."


def _get_env_file_pairs(path: str) -> dict:
    pairs = {}
    if not os.path.isfile(path):
        return pairs
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            pairs[key.strip()] = value.strip().strip('"').strip("'")
    return pairs


# Load .env once at import time, without overriding real environment variables
# that are already set (a real env var always wins over the file).
_dotenv = _get_env_file_pairs(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
for _k, _v in _dotenv.items():
    os.environ.setdefault(_k, _v)


ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")

# The wake phrase is the product's name and, like "Hey Siri"/"Hey Google", is
# said the same way regardless of spoken language -- see lib/i18n.py's module
# docstring for why. It's still overridable (e.g. a shorter "term" for a
# noisy room), just not translated per-language by default.
WAKE_WORD = os.environ.get("WAKE_WORD", "hey term").lower().strip()
WAKE_MATCH_THRESHOLD = float(os.environ.get("WAKE_MATCH_THRESHOLD", "0.72"))

# "auto" lets Whisper detect the spoken language per command instead of
# assuming one -- more flexible for a household where different people talk
# to it, at a small accuracy cost vs. naming the language explicitly. See
# lib/i18n.py for which languages have translated prompts; any language
# Whisper/Claude understand still works for the request itself even if it
# isn't in that list, it just gets English prompts back.
LANGUAGE = os.environ.get("LANGUAGE", "en").lower().strip()

WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")

# Android/Termux only (see lib/termux_audio.py) -- faster-whisper's inference
# engine has no Android build at all, so Termux instead uses a real,
# self-built whisper.cpp binary for the identical Whisper algorithm.
# scripts/setup-termux.sh builds it at this path and downloads a
# ggml-<WHISPER_MODEL_SIZE>.bin model into this directory; both are
# overridable for a non-default install location.
WHISPER_CPP_BIN = os.environ.get("WHISPER_CPP_BIN") or os.path.expanduser(
    os.path.join("~", ".hey-term", "whisper-cpp", "build", "bin", "whisper-cli")
)
WHISPER_CPP_MODELS_DIR = os.environ.get("WHISPER_CPP_MODELS_DIR") or os.path.expanduser(
    os.path.join("~", ".hey-term", "whisper-cpp", "models")
)

SAMPLE_RATE = int(os.environ.get("SAMPLE_RATE", "16000"))
WAKE_CHUNK_SECONDS = float(os.environ.get("WAKE_CHUNK_SECONDS", "2.5"))
COMMAND_MAX_SECONDS = float(os.environ.get("COMMAND_MAX_SECONDS", "12"))
SILENCE_HOLD_SECONDS = float(os.environ.get("SILENCE_HOLD_SECONDS", "1.2"))
SILENCE_RMS_THRESHOLD = float(os.environ.get("SILENCE_RMS_THRESHOLD", "0.012"))

# Working directory the assistant is allowed to run commands in. Defaults to
# wherever the script was launched from -- set this explicitly in .env if you
# want it scoped to one project folder instead of wherever you happened to cd.
WORK_DIR = os.environ.get("WORK_DIR") or os.getcwd()

# Every wake, request, plan, confirmation outcome, and command result is
# appended here as one JSON object per line -- a plain-text audit trail of
# everything Hey Term has ever been asked to do and whether it actually did
# it. Off by default is not an option: a tool that runs shell commands on
# your say-so should always be able to answer "what did you run, and when."
AUDIT_LOG_PATH = os.environ.get("AUDIT_LOG_PATH") or os.path.join(WORK_DIR, ".hey-term-audit.jsonl")

# How long a single command is allowed to run before Hey Term kills it and
# reports a timeout, in seconds. Was a fixed 120s; now overridable per install
# (via .env/COMMAND_TIMEOUT_SECONDS) and per-request (a spoken "give it more
# time" -- see main.py's LONGER_TIMEOUT_PHRASES) for the genuinely slow stuff
# (a big install, a long build) without raising the default for everything.
COMMAND_TIMEOUT_SECONDS = float(os.environ.get("COMMAND_TIMEOUT_SECONDS", "120"))

# Session running-total cost tracking (see lib/cost.py). Off by default would
# defeat the point -- someone handing Hey Term their own API key should always
# be able to ask "what has this cost me so far" without digging through the
# Anthropic console. Persisted per work_dir so "cost" reflects this project,
# not every project Hey Term has ever touched.
COST_LOG_PATH = os.environ.get("COST_LOG_PATH") or os.path.join(WORK_DIR, ".hey-term-cost.json")

_IS_WINDOWS = platform.system() == "Windows"


def shell_display_name() -> str:
    return "PowerShell" if _IS_WINDOWS else "bash"


def is_windows() -> bool:
    return _IS_WINDOWS


# Commands matching these (case-insensitive substring) patterns are never run
# on a spoken "confirm" alone -- see lib/safety.py. Kept short and specific on
# purpose: a long blocklist gives a false sense of coverage it can't deliver,
# so this exists to catch the handful of single commands that can destroy an
# entire disk or OS install, not to be a general security boundary.
_BUILTIN_DANGEROUS_PATTERNS = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf .",
    "rm -rf *",
    ":(){ :|:& };:",  # fork bomb
    "mkfs",
    "dd if=",
    "> /dev/sd",
    "format c:",
    "diskpart",
    "shutdown",
    "reboot",
    "del /f /s /q",
    "git push --force",
    "git reset --hard",
    "drop database",
    "drop table",
    "truncate table",
]


def _load_extra_patterns() -> list:
    """User-defined additions to the built-in blocklist above.

    The built-in list only covers things that can nuke an entire disk or OS
    install -- it deliberately says nothing about a specific person's own
    "don't touch this" list (their production database's actual name, their
    release branch, a customer-data table). Those are just as dangerous *to
    that person* but can't be guessed in advance, so this loads more patterns
    from two places, both optional and additive (nothing here can remove a
    built-in pattern):

    - EXTRA_DANGEROUS_PATTERNS env var / .env entry: comma-separated.
    - A patterns file, one pattern per line ("#" comments allowed), at
      PATTERNS_FILE if set, else ~/.hey-term/dangerous_patterns.txt if it
      exists. Easier to keep a long list here than crammed into one env var.
    """
    extra = []

    env_val = os.environ.get("EXTRA_DANGEROUS_PATTERNS", "")
    if env_val:
        extra.extend(p.strip() for p in env_val.split(",") if p.strip())

    patterns_file = os.environ.get("PATTERNS_FILE") or os.path.expanduser(
        os.path.join("~", ".hey-term", "dangerous_patterns.txt")
    )
    if os.path.isfile(patterns_file):
        with open(patterns_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    extra.append(line)

    return extra


# Commands matching these (case-insensitive substring) patterns are never run
# on a spoken "confirm" alone -- see lib/safety.py. The built-in list is kept
# short and specific on purpose: a long blocklist gives a false sense of
# coverage it can't deliver, so it exists to catch the handful of single
# commands that can destroy an entire disk or OS install, not to be a general
# security boundary. Anything install-specific belongs in _load_extra_patterns
# instead of growing this list.
DANGEROUS_PATTERNS = _BUILTIN_DANGEROUS_PATTERNS + [
    p for p in _load_extra_patterns() if p.lower() not in {b.lower() for b in _BUILTIN_DANGEROUS_PATTERNS}
]
