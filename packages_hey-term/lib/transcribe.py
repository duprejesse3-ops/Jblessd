# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Speech-to-text via faster-whisper, running fully local -- no audio ever
leaves the machine for transcription, and no API key is needed for this part.
The model loads once and is cached for the life of the process; the first
call after startup pays the one-time model-load cost.

Uses the multilingual model (not an English-only "*.en" variant) so
LANGUAGE can be set to anything Whisper supports, or to "auto" to let it
detect the spoken language per utterance.
"""
from .config import WHISPER_DEVICE, WHISPER_MODEL_SIZE

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type="int8")
    return _model


def _transcribe(audio, language):
    import numpy as np

    if audio is None or len(audio) == 0:
        return ""
    model = _get_model()
    segments, _info = model.transcribe(np.asarray(audio, dtype="float32"), language=language, vad_filter=True)
    return " ".join(seg.text.strip() for seg in segments).strip()


def transcribe(audio, language: str = "en") -> str:
    """Transcribes a command/confirmation clip. `language` is a Whisper
    language code ("en", "es", ...), or "auto" to let Whisper detect it from
    the audio itself (a little slower and occasionally wrong on a very short
    clip, but useful when more than one person/language uses the same
    installation).
    """
    return _transcribe(audio, None if language == "auto" else language)


def transcribe_wake(audio) -> str:
    """Transcribes a wake-word listening chunk. Always forced to English,
    regardless of the configured LANGUAGE -- "Hey Term" is the product's
    name, said the same way in any language (like "Hey Siri"), and Whisper
    decodes that short phrase far more reliably as English than if it's left
    to guess the audio is some other language first. See lib/i18n.py's
    module docstring for the full reasoning.
    """
    return _transcribe(audio, "en")
