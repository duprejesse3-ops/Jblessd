# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Pattern-based check for commands dangerous enough to need typed, not
spoken, confirmation.

Speech-to-text makes mistakes, and "confirm" said in a noisy room can get
misheard on either end. That's an acceptable risk for "list files" or
"install this package" -- it's not an acceptable risk for something that can
wipe a disk. Anything matching here always falls back to requiring the exact
word CONFIRM typed on the keyboard, no matter what was heard.
"""
from .config import DANGEROUS_PATTERNS


def is_dangerous(command: str) -> bool:
    lowered = command.lower()
    return any(pattern in lowered for pattern in DANGEROUS_PATTERNS)


def dangerous_commands(commands: list) -> list:
    return [c for c in commands if is_dangerous(c)]
