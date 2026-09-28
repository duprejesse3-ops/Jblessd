# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Speech input and output on Android, through the Termux:API app plus a
real, self-built offline speech recognizer -- not Android's own OS/cloud
recognizer, and not a hosted API. Hey Term owns its transcription the same
way on every platform; only how it reaches the microphone differs.

sounddevice (lib/audio.py) and faster-whisper (lib/transcribe.py) are the
desktop pipeline -- record raw audio, transcribe it locally. Neither half of
that works on Android: sounddevice has no PortAudio backend there at all,
and less obviously, faster-whisper's inference engine, ctranslate2, has no
build for Android whatsoever -- no wheel, no working source install -- so
the desktop transcription path cannot run under Termux no matter how the
audio gets captured.

This module replaces both halves for Termux:
  - Capture: termux-microphone-record (the Termux:API app's mic bridge) to a
    compressed clip, decoded to float32 PCM with ffmpeg -- same idea as the
    desktop capture, just reaching the mic through Android's API instead of
    PortAudio.
  - Transcription: a real Whisper model, run entirely on-device by
    whisper.cpp (https://github.com/ggml-org/whisper.cpp, MIT licensed) --
    a from-scratch C++ reimplementation of Whisper inference that, unlike
    ctranslate2, compiles and runs fine on Android's ARM CPUs with nothing
    more than Termux's own clang/cmake/make. scripts/setup-termux.sh clones
    and builds it once, and downloads the same-sized ggml model that
    WHISPER_MODEL_SIZE names for desktop, so the two platforms use
    comparable models. Nothing is sent anywhere -- this is exactly as
    offline as the desktop path, just a different implementation of the
    same algorithm because the desktop one can't run here.

`termux-tts-speak` (unrelated to any of the above; it was never a Whisper
problem) still handles speech output the same way it always has.

Setup (once): install the separate "Termux:API" app (F-Droid or Play Store,
same publisher as Termux), then run ./install.sh (or scripts/setup-termux.sh
directly), which installs termux-api/ffmpeg/build tools, builds whisper.cpp,
and downloads its model.

Transcription runs through whisper.cpp's own bundled HTTP server
(whisper-server), not the whisper-cli one-shot binary -- scripts/setup-
termux.sh's plain `cmake --build` already compiles both from the same
source tree, so nothing extra needs building for this. whisper-cli reloads
the whole model from disk on every single invocation (there's no "keep it
warm" option for a one-shot CLI), which on a phone CPU is real, repeated
seconds of latency on top of the transcription itself -- felt as "slow to
respond" on every wake-word chunk and every command. whisper-server loads
the model once into memory and stays running for the life of the Hey Term
process, so only the very first transcription after startup pays that
cost; every call after that is just the actual inference time. It's
started lazily (on first use), bound to 127.0.0.1 only -- still exactly as
offline as before, this is loopback-only, nothing reachable off-device --
and torn down when Hey Term exits. If the server binary is missing (an
older build from before this existed) or it fails to start for any reason,
this transparently falls back to the original per-call whisper-cli path
instead of breaking transcription.
"""
import atexit
import os
import shutil
import subprocess
import tempfile
import time
import wave

from . import config

_RECORD_BIN = "termux-microphone-record"
_TTS_BIN = "termux-tts-speak"

# termux-microphone-record has no live block-by-block streaming mode (it
# only starts/stops a recording to a file), so record_until_silence_termux
# approximates the desktop version's fine-grained silence detection with
# back-to-back fixed-length chunks instead. Coarser (up to one chunk's
# worth of trailing silence gets included) but the only thing actually
# possible through this CLI.
CHUNK_SECONDS = 1.5

# whisper-cli's own timeout guard -- transcribing a short command clip on a
# phone CPU is normally a couple of seconds; this is a ceiling against a
# hung process, not a value expected to be hit in practice.
_TRANSCRIBE_TIMEOUT_SECONDS = 60

# How long to wait for whisper-server to finish loading the model and start
# answering requests, the first time it's started. Generous on purpose --
# a phone CPU loading a multi-hundred-MB model from flash storage is slower
# than a desktop, and this only happens once per Hey Term run, not per call.
_SERVER_STARTUP_TIMEOUT_SECONDS = 45

# Loopback-only -- see module docstring. Overridable in case something else
# on the phone is already using this port.
_server_proc = None
_server_start_failed = False


def _server_base_url() -> str:
    return f"http://127.0.0.1:{config.WHISPER_SERVER_PORT}"


def find_whisper_server():
    """Path to the whisper.cpp server binary, next to whisper-cli in the
    same build, or None if this build predates it / wasn't found."""
    server_path = os.path.join(os.path.dirname(config.WHISPER_CPP_BIN), "whisper-server")
    return server_path if os.path.isfile(server_path) and os.access(server_path, os.X_OK) else None


def _server_is_up() -> bool:
    import requests

    try:
        requests.get(_server_base_url() + "/", timeout=0.5)
        return True
    except requests.exceptions.RequestException:
        return False


def _stop_server() -> None:
    """Registered with atexit so whisper-server doesn't outlive the Hey Term
    process it was started for."""
    global _server_proc
    if _server_proc is not None and _server_proc.poll() is None:
        _server_proc.terminate()
        try:
            _server_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _server_proc.kill()
    _server_proc = None


def _ensure_server_running(server_binary: str, model: str) -> bool:
    """Starts whisper-server the first time this is called and waits for it
    to be ready; a no-op check on every later call once it's already up.
    Returns False (never raises) if it can't be started or doesn't become
    ready in time, so callers can fall back to the per-call whisper-cli
    path instead of failing transcription outright.
    """
    global _server_proc, _server_start_failed

    if _server_proc is not None and _server_proc.poll() is None:
        return True  # already running from an earlier call

    _server_proc = subprocess.Popen(
        [server_binary, "-m", model, "--host", "127.0.0.1", "--port", str(config.WHISPER_SERVER_PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    atexit.register(_stop_server)

    deadline = time.time() + _SERVER_STARTUP_TIMEOUT_SECONDS
    while time.time() < deadline:
        if _server_proc.poll() is not None:
            break  # exited already -- e.g. bad model file -- won't come up
        if _server_is_up():
            return True
        time.sleep(0.3)

    if not _server_start_failed:
        print("[Hey Term] (the fast local speech server didn't start in time -- "
              "falling back to the slower per-request mode; still fully offline, just slower)")
        _server_start_failed = True
    return False


def _transcribe_via_server(wav_path: str, language: str):
    """Posts a clip to the already-running local whisper-server. Returns the
    transcript (possibly ""), or None if the request itself failed -- the
    None/"" distinction lets the caller tell "server unreachable, try the
    fallback" apart from "server answered, there was just no speech."
    """
    import requests

    try:
        with open(wav_path, "rb") as f:
            resp = requests.post(
                _server_base_url() + "/inference",
                files={"file": (os.path.basename(wav_path), f, "audio/wav")},
                data={
                    "language": language,
                    "response_format": "text",
                    "no_timestamps": "true",
                    "suppress_nst": "true",  # suppress non-speech tokens -- extra guard against hallucinated text
                },
                timeout=_TRANSCRIBE_TIMEOUT_SECONDS,
            )
        if resp.status_code != 200:
            return None
        return resp.text.strip()
    except requests.exceptions.RequestException:
        return None


# Printed once, not on every wake-word chunk (every ~2.5s), if whisper.cpp
# isn't built/the model isn't downloaded yet -- the setup step this needs.
_setup_incomplete_warned = False

# Hey Term's own language codes (lib/i18n.py's LANGUAGES keys) are plain
# ISO 639-1 ("en", "es"...), which is also exactly what whisper.cpp's `-l`
# expects (same convention as faster-whisper) -- no mapping needed for
# transcription. Android's TTS, below, is the one place that needs a
# different, BCP-47 tag ("en-US", "es-ES"...).
ANDROID_TTS_LANGUAGE_TAGS = {
    "en": "en-US",
    "es": "es-ES",
    "fr": "fr-FR",
    "de": "de-DE",
    "pt": "pt-BR",
    "it": "it-IT",
}


def android_tts_language_tag(language: str):
    """Maps a Hey Term language code to the BCP-47 tag Android's TTS
    expects, or None for "auto" or anything unrecognized -- passing None to
    speak_termux() just uses Android's own default voice instead of failing.
    """
    return ANDROID_TTS_LANGUAGE_TAGS.get(language)


def is_termux() -> bool:
    """True when running under Termux with the termux-api package installed
    (the Termux:API *app* also has to be installed and granted microphone
    permission on the phone itself -- this can only detect the CLI side).
    """
    if "com.termux" in os.environ.get("PREFIX", ""):
        return True
    return shutil.which(_RECORD_BIN) is not None


def find_whisper_cli():
    """Path to the whisper.cpp CLI binary scripts/setup-termux.sh built, or
    None if setup hasn't been run (or hasn't finished) yet.
    """
    path = config.WHISPER_CPP_BIN
    return path if os.path.isfile(path) and os.access(path, os.X_OK) else None


def find_whisper_model():
    """Path to the ggml model matching WHISPER_MODEL_SIZE, or None if it
    hasn't been downloaded yet.
    """
    path = os.path.join(config.WHISPER_CPP_MODELS_DIR, f"ggml-{config.WHISPER_MODEL_SIZE}.bin")
    return path if os.path.isfile(path) else None


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


def _write_wav(audio, sample_rate: int, path: str) -> None:
    """Writes a 1-D float32 [-1, 1] array as 16-bit PCM mono WAV --
    whisper-cli reads wav/flac/mp3/ogg directly, not raw arrays, so this is
    the hand-off point between "audio as Python already has it" and "audio
    as the external binary wants it." Uses the stdlib `wave` module --
    no extra dependency for something this small.
    """
    import numpy as np

    clipped = np.clip(audio, -1.0, 1.0)
    pcm16 = (clipped * 32767.0).astype("<i2")
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(pcm16.tobytes())


def transcribe_termux(audio, sample_rate: int, language: str = "en") -> str:
    """Transcribes a captured clip with the on-device whisper.cpp build.
    Returns "" if there's no audio, setup hasn't been completed yet (missing
    binary or model -- printed once, not on every call), or the process
    fails for any reason -- exactly the same "didn't catch that" contract
    lib/transcribe.py's desktop functions already have, never a crash.

    `language` is a plain Whisper code ("en", "es", ... or "auto") -- the
    same convention lib/i18n.py and lib/transcribe.py already use, since
    whisper.cpp's `-l` takes the identical codes faster-whisper does.
    """
    global _setup_incomplete_warned

    if audio is None or len(audio) == 0:
        return ""

    # whisper.cpp does no voice-activity detection of its own (unlike
    # faster-whisper's vad_filter=True on desktop, in lib/transcribe.py), so
    # handing it a clip that's silence or faint background noise doesn't
    # reliably come back empty -- it's a known whisper.cpp behavior to
    # *hallucinate* a short phrase out of near-silent audio instead. On a
    # wake-word chunk recorded every ~2.5s, most chunks ARE silence, so
    # without this gate that hallucinated text sometimes fuzzy-matches the
    # wake word and fires a false wake. Using the same RMS floor as
    # record_until_silence_termux's own "has speech stopped" check --
    # anything this quiet is silence by Hey Term's own definition, so it's
    # never sent to whisper.cpp at all.
    import numpy as np

    rms = float(np.sqrt(np.mean(np.square(audio))))
    if rms < config.SILENCE_RMS_THRESHOLD:
        return ""

    binary = find_whisper_cli()
    model = find_whisper_model()
    if not binary or not model:
        if not _setup_incomplete_warned:
            print("[Hey Term] (speech recognition isn't set up yet -- run ./install.sh "
                  "or scripts/setup-termux.sh to build whisper.cpp and download its model)")
            _setup_incomplete_warned = True
        return ""

    fd, wav_path = tempfile.mkstemp(suffix=".wav", prefix="hey-term-stt-")
    os.close(fd)
    out_base = wav_path[:-4]  # whisper-cli appends ".txt" itself to -of's basename
    txt_path = out_base + ".txt"
    try:
        _write_wav(audio, sample_rate, wav_path)

        # Prefer the persistent whisper-server (loads the model once, stays
        # warm for the life of the process) over spawning whisper-cli fresh
        # -- see the module docstring for why the CLI alone is noticeably
        # slower here than the identical model is on desktop. Anything that
        # keeps this from working (older build without the server binary,
        # server fails to start, one request drops) transparently falls
        # through to the original per-call whisper-cli path below instead
        # of ever failing transcription outright.
        server_binary = find_whisper_server()
        if server_binary and _ensure_server_running(server_binary, model):
            result = _transcribe_via_server(wav_path, language or "auto")
            if result is not None:
                return result

        args = [
            binary, "-m", model, "-f", wav_path,
            "-l", language or "auto",
            "-nt", "-np", "-sns", "-otxt", "-of", out_base,
        ]
        proc = subprocess.run(args, capture_output=True, timeout=_TRANSCRIBE_TIMEOUT_SECONDS)
        if proc.returncode != 0:
            return ""
        if not os.path.isfile(txt_path):
            return ""
        with open(txt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except (subprocess.TimeoutExpired, OSError):
        return ""
    finally:
        for p in (wav_path, txt_path):
            try:
                os.remove(p)
            except OSError:
                pass


def speak_termux(text: str, language: str = "en") -> bool:
    """Speaks via Android's own system TTS, through termux-tts-speak.
    Returns True on success, False if the binary is missing, the Termux:API
    app isn't installed, or the call otherwise fails -- callers should print
    the text as a fallback either way, never treat this as fatal.
    """
    tag = android_tts_language_tag(language)
    if tag:
        try:
            subprocess.run([_TTS_BIN, "-l", tag, text], check=True, capture_output=True, timeout=30)
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            pass
    # No mapped tag, or the tagged call failed (not every termux-tts-speak
    # build accepts -l for every locale) -- retry with the plain default
    # voice before giving up entirely.
    try:
        subprocess.run([_TTS_BIN, text], check=True, capture_output=True, timeout=30)
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        return False
