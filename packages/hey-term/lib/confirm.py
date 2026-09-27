# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Parses a spoken response into confirm / cancel / unclear, in whichever
language is configured (see lib/i18n.py for the word lists).

Unclear is a real, intentional third outcome -- "air on the side of caution"
means an ambiguous reply (silence, a mumble, "maybe", something the wake-word
mic caught that wasn't really an answer) must NOT be treated as a yes. Only
an unambiguous affirmative counts as confirm.
"""
import re

from .i18n import DEFAULT_LANGUAGE, get as get_strings


def _normalize(text: str) -> str:
    # Keeps letters (including accented ones for es/fr/de/pt/it), digits,
    # apostrophes, and spaces; strips punctuation. Case-folds for matching.
    return re.sub(r"[^\w' ]+", " ", text.lower().strip(), flags=re.UNICODE)


def parse_confirmation(text: str, language: str = DEFAULT_LANGUAGE) -> str:
    """Returns "confirm", "cancel", or "unclear"."""
    strings = get_strings(language)
    yes_words = strings["yes_words"]
    no_words = strings["no_words"]

    norm = _normalize(text)
    if not norm:
        return "unclear"

    words = set(norm.split(" "))
    single_yes = {w for w in yes_words if " " not in w}
    single_no = {w for w in no_words if " " not in w}
    phrase_yes = [w for w in yes_words if " " in w]
    phrase_no = [w for w in no_words if " " in w]

    has_yes = norm in yes_words or bool(words & single_yes) or any(p in norm for p in phrase_yes)
    has_no = norm in no_words or bool(words & single_no) or any(p in norm for p in phrase_no)

    if has_yes and not has_no:
        return "confirm"
    if has_no and not has_yes:
        return "cancel"
    return "unclear"
