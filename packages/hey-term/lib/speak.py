# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Text-to-speech via pyttsx3 (offline, cross-platform: SAPI5 on Windows,
espeak on Linux, NSSpeechSynthesizer on macOS). Also prints everything it
says, so the terminal itself is a full transcript even with sound off.

Which languages actually get a real spoken voice (rather than an English
voice reading foreign text with an accent) depends entirely on which voices
are installed on the OS -- Windows Narrator languages, or `espeak-ng` on
Linux with the right language packs. This picks a matching installed voice
when one exists and falls back to whatever the default voice is otherwise;
it never fails the whole request over a missing voice.

pyttsx3 has no Android backend at all (no SAPI5/espeak/NSSpeechSynthesizer
there), so on Termux this instead goes through lib.termux_audio.speak_termux,
which drives Android's own system TTS via the Termux:API app. The printed
transcript line always happens either way.
"""
from . import termux_audio

_engine = None
_voice_set_for_language = None


def _get_engine():
    global _engine
    if _engine is None:
        import pyttsx3

        _engine = pyttsx3.init()
    return _engine


def _select_voice(language: str) -> None:
    global _voice_set_for_language
    if language == _voice_set_for_language:
        return
    engine = _get_engine()
    try:
        voices = engine.getProperty("voices") or []
        for voice in voices:
            langs = getattr(voice, "languages", None) or []
            langs_text = " ".join(str(l).lower() for l in langs)
            name_id = f"{voice.name} {voice.id}".lower()
            if language.lower() in langs_text or language.lower() in name_id:
                engine.setProperty("voice", voice.id)
                break
    except Exception:  # pragma: no cover - depends on local TTS backend
        pass
    _voice_set_for_language = language


def speak(text: str, language: str = "en") -> None:
    print(f"[Hey Term] {text}")

    if termux_audio.is_termux():
        if not termux_audio.speak_termux(text, language):
            print("[Hey Term] (speech output unavailable: termux-tts-speak failed -- "
                  "is the Termux:API app installed, and `pkg install termux-api` done?)")
        return

    try:
        _select_voice(language)
        engine = _get_engine()
        engine.say(text)
        engine.runAndWait()
    except Exception as err:  # pragma: no cover - depends on local audio setup
        print(f"[Hey Term] (speech output unavailable: {err})")
