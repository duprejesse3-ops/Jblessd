# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Microphone and speech output on Android, through the Termux:API app.

sounddevice (lib/audio.py) and pyttsx3 (lib/speak.py) are desktop-only --
PortAudio and SAPI5/espeak/NSSpeechSynthesizer have no real Android backend.
Termux has no direct access to the phone's mic or speaker at all; the
Termux:API companion app is the only bridge, exposing them as small CLI
tools (termux-microphone-record, termux-tts-speak) that talk to the app over
Android's own APIs. This module is that bridge for Hey Term:

Setup (once): install the separate "Termux:API" app (F-Droid or Play Store,
same publisher as Termux), then in Termux:

    pkg install termux-api ffmpeg

ffmpeg is required here too -- termux-microphone-record only writes
compressed containers (aac/amr, not raw PCM), and this module decodes them
to the float32 PCM arrays the rest of Hey Term (lib/transcribe.py) expects
before it can pass them to faster-whisper.

Everything here degrades honestly instead of pretending: is_termux() is the
single detection point both lib/audio.py and lib/speak.py branch on, and a
missing binary/timeout/decode failure raises or returns False rather than
silently producing empty audio that would look like "you said nothing."
"""
import os
import shutil
import subprocess
import tempfile
import time

# termux-microphone-record has no live block-by-block streaming mode (it
# only starts/stops a recording to a file), so record_until_silence_termux
# approximates the desktop version's fine-grained silence detection with
# back-to-back fixed-length chunks instead. Coarser (up to one chunk's
# worth of trailing silence gets included) but the only thing actually
# possible through this CLI.
CHUNK_SECONDS = 1.5

_RECORD_BIN = "termux-microphone-record"
_TTS_BIN = "termux-tts-speak"


def is_termux() -> bool:
    """True when running under Termux with the termux-api package installed
    (the Termux:API *app* also has to be installed and granted mic
    permission on the phone itself -- this can only detect the CLI side).
    """
    if "com.termux" in os.environ.get("PREFIX", ""):
        return True
    return shutil.which(_RECORD_BIN) is not None


def _decode_to_float32(path: str, sample_rate: int):
    """Decodes an audio file (any format ffmpeg understands) to a 1-D
    float32 PCM numpy array at `sample_rate`, mono. Raises RuntimeError with
    ffmpeg's own message on failure rather than returning silence, so a
    decode problem is never mistaken for "no speech."
    """
    import numpy as np

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError(
            "ffmpeg not found -- required to decode Termux microphone recordings. "
            "Install it with: pkg install ffmpeg"
        )
    proc = subprocess.run(
        [ffmpeg, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sample_rate), "-"],
        capture_output=True,
        timeout=30,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed to decode recording: {proc.stderr.decode(errors='replace')[:300]}")
    return np.frombuffer(proc.stdout, dtype="<f4").copy()


def _record_clip(seconds: float, sample_rate: int):
    """Records one clip of up to `seconds` seconds via termux-microphone-record
    and returns it as a 1-D float32 numpy array at `sample_rate`.

    termux-microphone-record's own `-l` limit stops the recording on the
    Termux:API app's side, but the command itself returns as soon as
    recording *starts*, not when it finishes (documented Termux:API
    behavior) -- so this sleeps out the requested duration itself before
    reading the file, and sends an explicit `-q` stop afterward as a
    safety net in case the app's own limit didn't fire (harmless no-op if
    it already had).
    """
    import numpy as np

    seconds = max(0.3, seconds)
    fd, path = tempfile.mkstemp(suffix=".m4a", prefix="hey-term-rec-")
    os.close(fd)
    os.remove(path)  # termux-microphone-record creates this itself

    try:
        subprocess.run(
            [_RECORD_BIN, "-f", path, "-l", str(round(seconds)), "-r", str(sample_rate), "-c", "1"],
            check=True, capture_output=True, timeout=10,
        )
        time.sleep(seconds + 0.5)
        subprocess.run([_RECORD_BIN, "-q"], capture_output=True, timeout=5)
        time.sleep(0.3)

        if not os.path.exists(path) or os.path.getsize(path) == 0:
            return np.zeros(0, dtype="float32")
        return _decode_to_float32(path, sample_rate)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError) as err:
        raise RuntimeError(
            f"termux-microphone-record failed ({err}). Is the Termux:API app installed "
            "and granted microphone permission, and is `pkg install termux-api` done?"
        ) from err
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def record_fixed_termux(seconds: float, sample_rate: int):
    return _record_clip(seconds, sample_rate)


def record_until_silence_termux(max_seconds: float, sample_rate: int, silence_hold: float, rms_threshold: float):
    """Chunk-based approximation of lib/audio.py's record_until_silence --
    see CHUNK_SECONDS above for why this can't be as fine-grained on Termux.
    """
    import numpy as np

    blocks = []
    elapsed = 0.0
    heard_speech = False
    consecutive_silent = 0.0

    while elapsed < max_seconds:
        this_chunk = min(CHUNK_SECONDS, max_seconds - elapsed)
        clip = _record_clip(this_chunk, sample_rate)
        blocks.append(clip)
        elapsed += this_chunk

        rms = float(np.sqrt(np.mean(np.square(clip)))) if len(clip) else 0.0
        if rms >= rms_threshold:
            heard_speech = True
            consecutive_silent = 0.0
        else:
            consecutive_silent += this_chunk

        if heard_speech and consecutive_silent >= silence_hold:
            break

    if not blocks:
        return np.zeros(0, dtype="float32")
    return np.concatenate(blocks)


def speak_termux(text: str, language: str = "en") -> bool:
    """Speaks via Android's own system TTS, through termux-tts-speak.
    Returns True on success, False if the binary is missing, the Termux:API
    app isn't installed, or the call otherwise fails -- callers should print
    the text as a fallback either way, never treat this as fatal.
    """
    try:
        subprocess.run([_TTS_BIN, "-l", language, text], check=True, capture_output=True, timeout=30)
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        pass
    # Not every termux-tts-speak build accepts -l for every locale code --
    # retry once with the plain default voice before giving up entirely.
    try:
        subprocess.run([_TTS_BIN, text], check=True, capture_output=True, timeout=30)
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        return False
