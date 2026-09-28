# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Speech-to-text, running fully local -- no audio ever leaves the machine
for transcription, and no API key is needed for this part.

On Windows/Linux/macOS this is faster-whisper; the model loads once and is
cached for the life of the process, and the first call after startup pays
the one-time model-load cost.

On Android/Termux, faster-whisper can't run at all -- its inference engine,
ctranslate2, has no Android build, wheel or working source install -- so
this instead shells out to a real, self-built whisper.cpp binary doing the
same Whisper algorithm natively on-device (see lib/termux_audio.py's module
docstring for the full story). Same offline guarantee either way, just a
different implementation of the same model because the usual one can't run
on this platform.

Uses the multilingual model (not an English-only "*.en" variant) on both
platforms, so LANGUAGE can be set to anything Whisper supports, or to "auto"
to let it detect the spoken language per utterance.
"""
from . import termux_audio
from .config import SAMPLE_RATE, WHISPER_DEVICE, WHISPER_MODEL_SIZE

_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type="int8")
    return _model


def _transcribe(audio, language):
    if audio is None or len(audio) == 0:
        return ""

    if termux_audio.is_termux():
        # whisper.cpp's -l wants an explicit "auto" for auto-detect, unlike
        # faster-whisper's language=None convention below -- normalize here
        # so callers don't need to know the two engines differ on this.
        return termux_audio.transcribe_termux(audio, SAMPLE_RATE, language or "auto")

    import numpy as np

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
