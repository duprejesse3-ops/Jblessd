# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Microphone capture. Imports sounddevice/numpy lazily inside functions so
that importing this module (e.g. from a test) doesn't require audio hardware
or system audio libraries (portaudio) to be installed.

On Android/Termux, sounddevice has nothing to talk to -- there is no
PortAudio backend there -- so both functions below check lib.termux_audio's
is_termux() first and delegate to its termux-microphone-record-based
implementation instead. Desktop (Windows/Linux/macOS) behavior is unchanged.
Transcription of whatever these functions return is a separate concern --
see lib/transcribe.py, which does its own is_termux() branch to use a
real, self-built whisper.cpp binary there instead of faster-whisper (whose
inference engine has no Android build at all).
"""
from . import termux_audio
from .config import SAMPLE_RATE, SILENCE_HOLD_SECONDS, SILENCE_RMS_THRESHOLD


def record_fixed(seconds: float, sample_rate: int = None):
    """Records a fixed-length clip and returns a 1-D float32 numpy array."""
    rate = sample_rate or SAMPLE_RATE

    if termux_audio.is_termux():
        return termux_audio.record_fixed_termux(seconds, rate)

    import sounddevice as sd

    audio = sd.rec(int(seconds * rate), samplerate=rate, channels=1, dtype="float32")
    sd.wait()
    return audio.reshape(-1)


def record_until_silence(max_seconds: float, sample_rate: int = None,
                          silence_hold: float = None, rms_threshold: float = None):
    """Records in small blocks until the person stops talking (RMS energy
    under threshold for `silence_hold` seconds in a row), or `max_seconds`
    is reached, whichever comes first. Returns a 1-D float32 numpy array.

    Recording doesn't stop the instant it goes quiet -- someone pausing
    mid-sentence to think would get cut off. It waits for a sustained quiet
    stretch, not just one quiet instant.
    """
    rate = sample_rate or SAMPLE_RATE
    hold = silence_hold if silence_hold is not None else SILENCE_HOLD_SECONDS
    threshold = rms_threshold if rms_threshold is not None else SILENCE_RMS_THRESHOLD

    if termux_audio.is_termux():
        return termux_audio.record_until_silence_termux(max_seconds, rate, hold, threshold)

    import numpy as np
    import sounddevice as sd

    block_seconds = 0.2
    block_size = int(rate * block_seconds)
    blocks = []
    silent_blocks_needed = max(1, int(hold / block_seconds))
    consecutive_silent = 0
    heard_speech = False
    max_blocks = int(max_seconds / block_seconds)

    with sd.InputStream(samplerate=rate, channels=1, dtype="float32") as stream:
        for _ in range(max_blocks):
            block, _overflow = stream.read(block_size)
            block = block.reshape(-1)
            blocks.append(block)
            rms = float(np.sqrt(np.mean(np.square(block)))) if len(block) else 0.0
            if rms >= threshold:
                heard_speech = True
                consecutive_silent = 0
            else:
                consecutive_silent += 1
            if heard_speech and consecutive_silent >= silent_blocks_needed:
                break

    if not blocks:
        return np.zeros(0, dtype="float32")
    return np.concatenate(blocks)
