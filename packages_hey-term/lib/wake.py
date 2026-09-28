# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Wake-phrase matching against a raw transcript. Kept separate from the
audio/transcribe modules (which need hardware) so this logic is directly
testable: real speech-to-text on a short noisy clip rarely comes back as the
exact string "hey term" -- it comes back as "hey, term." or "a term" or
similar. This does a fuzzy, punctuation-insensitive match rather than an
exact one so those near-misses still trigger it.
"""
import difflib
import re

from .config import WAKE_MATCH_THRESHOLD, WAKE_WORD


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def heard_wake_word(transcript: str, wake_word: str = None, threshold: float = None) -> bool:
    """True if `transcript` contains (or closely matches) the wake phrase.
    Checks every wake_word-length sliding window of words in the transcript
    against the wake phrase, so it still matches when the wake word is
    spoken in the middle of a longer utterance ("okay hey terminal what
    time is it").
    """
    wake = _normalize(wake_word or WAKE_WORD)
    thresh = threshold if threshold is not None else WAKE_MATCH_THRESHOLD
    norm = _normalize(transcript)
    if not wake or not norm:
        return False

    if wake in norm:
        return True

    words = norm.split(" ")
    wake_len = len(wake.split(" "))
    best = 0.0
    for i in range(0, max(1, len(words) - wake_len + 1)):
        window = " ".join(words[i : i + wake_len])
        ratio = difflib.SequenceMatcher(None, window, wake).ratio()
        best = max(best, ratio)
    return best >= thresh
