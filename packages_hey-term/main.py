#!/usr/bin/env python3
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Hey Term -- a voice-activated terminal.

    "Hey Term" -> "<your request>" -> hears back what it's about to run
    -> you say "confirm" or "cancel" -> it runs (or doesn't).

Every command is voice-confirmed before it runs -- see README.md for the one
exception (a short blocklist of genuinely disk/system-destroying commands
that require the word CONFIRM typed on the keyboard instead of spoken).

Run:  python main.py [--lang es] [--wake-word "hey term"] [--work-dir .]
Stop: Ctrl+C, or say the wake word then "stop listening".
"""
import argparse
import sys

from lib import audit, config
from lib.agent import AgentError, plan
from lib.audio import record_fixed, record_until_silence
from lib.confirm import parse_confirmation
from lib.executor import run_commands
from lib.i18n import get as get_strings, is_translated, list_languages
from lib.safety import dangerous_commands
from lib.speak import speak
from lib.transcribe import transcribe, transcribe_wake
from lib.wake import heard_wake_word


def parse_args(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="hey-term",
        description=f"{config.PRODUCT_NAME} -- a voice-activated terminal. {config.COPYRIGHT}",
    )
    p.add_argument("--lang", default=config.LANGUAGE, metavar="CODE",
                    help=f"Language to speak/listen in after the wake word (default: {config.LANGUAGE}). "
                         f"'auto' detects per-utterance. Translated: {', '.join(list_languages())}.")
    p.add_argument("--wake-word", default=config.WAKE_WORD, metavar="PHRASE",
                    help=f"Wake phrase (default: \"{config.WAKE_WORD}\").")
    p.add_argument("--work-dir", default=config.WORK_DIR, metavar="PATH",
                    help="Folder commands run in (default: current directory).")
    p.add_argument("--audit-log", default=config.AUDIT_LOG_PATH, metavar="PATH",
                    help="Path to the JSONL audit log (default: .hey-term-audit.jsonl in --work-dir).")
    p.add_argument("--list-languages", action="store_true", help="List translated languages and exit.")
    p.add_argument("--version", action="version", version=f"{config.PRODUCT_NAME} {config.VERSION}")
    return p.parse_args(argv)


def listen_for_wake_word(wake_word: str) -> bool:
    """Records a short chunk and returns True if the wake word was heard in
    it. Called in a loop by main(); each chunk is independent, so a missed
    wake word just means "try the next chunk," not a lost turn. Always
    decoded as English -- see lib/transcribe.py's transcribe_wake().
    """
    clip = record_fixed(config.WAKE_CHUNK_SECONDS)
    text = transcribe_wake(clip)
    if text:
        print(f"[heard] {text}")
    return heard_wake_word(text, wake_word=wake_word)


def take_command(language: str) -> str:
    strings = get_strings(language)
    speak(strings["listening_prompt"], language=language)
    audio = record_until_silence(config.COMMAND_MAX_SECONDS)
    text = transcribe(audio, language=language)
    return text.strip()


def get_confirmation(language: str) -> str:
    """Returns "confirm", "cancel", or "unclear" from a spoken reply."""
    audio = record_until_silence(max_seconds=5)
    text = transcribe(audio, language=language)
    if text:
        print(f"[heard] {text}")
    return parse_confirmation(text, language=language)


def get_typed_confirmation(prompt: str) -> bool:
    try:
        typed = input(prompt)
    except EOFError:
        return False
    return typed.strip() == "CONFIRM"


def handle_request(request_text: str, language: str, work_dir: str) -> None:
    strings = get_strings(language)

    if not request_text:
        speak(strings["not_caught"], language=language)
        audit.log_event("request", language=language, text="", outcome="empty")
        return

    normalized = request_text.lower().strip(" .!?¡¿")
    if normalized in strings["stop_phrases"]:
        speak(strings["stopping"], language=language)
        audit.log_event("request", language=language, text=request_text, outcome="stop_phrase")
        return

    audit.log_event("request", language=language, text=request_text)

    try:
        result = plan(request_text, language=language)
    except AgentError as err:
        print(f"[error] {err}")
        speak(strings["agent_error"], language=language)
        audit.log_event("plan_error", language=language, error=str(err))
        return

    if "clarify" in result:
        speak(result["clarify"], language=language)
        audit.log_event("clarify", language=language, question=result["clarify"])
        return

    summary = result["summary"]
    commands = result["commands"]
    audit.log_event("plan", language=language, summary=summary, commands=commands)

    risky = dangerous_commands(commands)
    if risky:
        speak(f"{summary} {strings['requires_typed']}", language=language)
        for cmd in commands:
            flag = "  [REQUIRES TYPED CONFIRM]" if cmd in risky else ""
            print(f"    $ {cmd}{flag}")
        confirmed = get_typed_confirmation(strings["typed_confirm_prompt"])
        audit.log_event("confirmation", language=language, method="typed", commands=commands,
                         dangerous=risky, outcome="confirm" if confirmed else "cancel")
        if not confirmed:
            speak(strings["canceled"], language=language)
            return
    else:
        speak(f"{summary} {strings['ask_confirm']}", language=language)
        for cmd in commands:
            print(f"    $ {cmd}")
        answer = get_confirmation(language)
        audit.log_event("confirmation", language=language, method="voice", commands=commands, outcome=answer)
        if answer == "unclear":
            speak(strings["unclear_cancel"], language=language)
            return
        if answer == "cancel":
            speak(strings["canceled"], language=language)
            return

    report = run_commands(commands, work_dir=work_dir)
    speak(report.spoken_summary(language=language), language=language)
    audit.log_event(
        "run",
        language=language,
        ok=report.ok,
        results=[
            {"command": r.command, "returncode": r.returncode, "ran": r.ran, "error": r.error}
            for r in report.results
        ],
    )
    for r in report.results:
        if not r.ran:
            print(f"    (skipped) $ {r.command}")
            continue
        print(f"    $ {r.command}  -> exit {r.returncode}")
        if r.stdout:
            print(r.stdout)
        if r.stderr:
            print(f"[stderr] {r.stderr}")
        if r.error:
            print(f"[error] {r.error}")


def print_banner(language: str, work_dir: str) -> None:
    print(f"{config.PRODUCT_NAME} v{config.VERSION} -- {config.COPYRIGHT}")
    print(f"Working directory: {work_dir}")
    print(f"Language: {language}" + ("" if is_translated(language) or language == "auto" else " (untranslated -- using English prompts)"))
    print(f"Wake word: \"{config.WAKE_WORD}\". Listening in {config.WAKE_CHUNK_SECONDS}s chunks. Ctrl+C to quit.")
    print(f"Audit log: {config.AUDIT_LOG_PATH}")


def main(argv=None) -> int:
    args = parse_args(argv)

    if args.list_languages:
        for code in list_languages():
            print(f"{code}\t{get_strings(code)['name']}")
        return 0

    if not config.ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.")
        return 1

    language = args.lang
    wake_word = args.wake_word.lower().strip()
    work_dir = args.work_dir
    config.AUDIT_LOG_PATH = args.audit_log  # honor --audit-log override for this run

    print_banner(language, work_dir)
    audit.log_event("startup", language=language, work_dir=work_dir, version=config.VERSION)
    speak(get_strings(language)["ready"], language=language)

    try:
        while True:
            if listen_for_wake_word(wake_word):
                audit.log_event("wake")
                request_text = take_command(language)
                if request_text:
                    print(f"[you] {request_text}")
                handle_request(request_text, language, work_dir)
    except KeyboardInterrupt:
        print("\nStopped.")
        audit.log_event("shutdown", reason="keyboard_interrupt")
        return 0


if __name__ == "__main__":
    sys.exit(main())
