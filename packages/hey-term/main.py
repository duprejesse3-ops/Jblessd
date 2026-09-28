#!/usr/bin/env python3
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Hey Term -- a voice-activated terminal.

    "Hey Term" -> "<your request>" -> hears back what it's about to run
    -> you say "confirm" or "cancel" -> it runs (or doesn't).

Every command is voice-confirmed before it runs -- see README.md for the one
exception (a short blocklist of genuinely disk/system-destroying commands
that require the word CONFIRM typed on the keyboard instead of spoken).

A few requests are handled directly instead of being sent to Claude as a
shell-command request -- see MetaCommand below: "jobs" (check background
jobs), "cost" (this project's running Claude API spend), and "revert" (undo
the file changes from the last thing Hey Term ran, best-effort, git-only).
These are recognized in English regardless of --lang for now, matching the
audit log's existing English-first convention -- see README.md.

Run:  python main.py [--lang es] [--wake-word "hey term"] [--work-dir .]
Stop: Ctrl+C, or say the wake word then "stop listening".
"""
import argparse
import sys

from lib import audit, config, cost, jobs, offline_fallback, snapshot
from lib.agent import AgentError, plan
from lib.audio import record_fixed, record_until_silence
from lib.confirm import parse_confirmation
from lib.executor import run_commands
from lib.i18n import get as get_strings, is_translated, list_languages
from lib.safety import dangerous_commands
from lib.speak import speak
from lib.transcribe import transcribe, transcribe_wake
from lib.wake import heard_wake_word

# Phrases that route a request to a local handler instead of Claude. Kept
# separate from lib/i18n.py's per-language stop_phrases/yes_words/no_words on
# purpose -- these are operator commands about Hey Term itself, not part of
# the conversational confirm/cancel vocabulary, and adding six-language
# variants for all of them before they've been used by a single real person
# would be effort spent on the wrong thing. Recognized in English only for
# now; README.md says so.
JOBS_PHRASES = {"jobs", "check jobs", "list jobs", "job status"}
COST_PHRASES = {"cost", "session cost", "how much has this cost", "what has this cost"}
REVERT_PHRASES = {"revert", "revert that", "undo that", "undo it"}

# A request containing any of these gets a longer timeout for its commands --
# said when someone knows up front that what they're asking for is slow (a
# big install, a full build) instead of hitting the default and having to
# re-ask. The phrase itself is stripped before the request is sent to Claude
# so it doesn't confuse the planner.
LONGER_TIMEOUT_PHRASES = ["take your time", "give it more time", "this will take a while", "no rush"]
LONGER_TIMEOUT_SECONDS_MULTIPLIER = 5

# A request containing any of these launches as a detached background job
# instead of blocking the voice loop -- see lib/jobs.py. Also stripped before
# the request goes to Claude.
BACKGROUND_PHRASES = ["in the background", "run it in the background", "as a background job"]

# Per-run-loop state: the most recent snapshot taken before running commands,
# and which paths changed, so a later "revert" request has something to act
# on. Module-level and single-slot on purpose -- Hey Term is one interactive
# session talking to one person, not a multi-session server, so "the last
# thing that ran" is an unambiguous, correct scope for "revert" without
# needing a job/snapshot ID system.
_last_snapshot = None
_last_changed_paths = []

# Tracks whether the fallback-language notice has already been spoken this
# run, so it's said once at startup, not on every single request.
_fallback_notice_given = False


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
    p.add_argument("--timeout", type=float, default=config.COMMAND_TIMEOUT_SECONDS, metavar="SECONDS",
                    help=f"Per-command timeout in seconds (default: {config.COMMAND_TIMEOUT_SECONDS}).")
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


def _strip_phrase(text: str, phrases: list) -> tuple:
    """Returns (text_with_phrase_removed, found: bool) for the first matching
    phrase, case-insensitively. Used to pull operator hints ("...in the
    background", "...take your time") out of a request before it's sent to
    Claude, so the planner reasons about the actual task, not Hey Term's own
    control phrases.
    """
    lowered = text.lower()
    for phrase in phrases:
        if phrase in lowered:
            idx = lowered.find(phrase)
            cleaned = (text[:idx] + text[idx + len(phrase):]).strip(" ,.")
            return cleaned, True
    return text, False


def handle_jobs_command(language: str, work_dir: str) -> None:
    strings = get_strings(language)
    records = jobs.list_jobs(work_dir)
    audit.log_event("jobs_check", count=len(records))
    if not records:
        speak(strings["jobs_none"], language=language)
        return
    running = [r for r in records if r.get("status") == "running"]
    finished = [r for r in records if r.get("status") != "running"]
    for r in records:
        print(f"    [{r['status']}] {r['id']}  {r.get('label') or r['command']}")
    speak(f"{len(running)} running, {len(finished)} finished.", language=language)


def handle_cost_command(language: str) -> None:
    audit.log_event("cost_check")
    summary = cost.spoken_summary()
    print(f"    {summary}")
    speak(summary, language=language)


def handle_revert_command(language: str) -> None:
    global _last_snapshot, _last_changed_paths
    strings = get_strings(language)
    if not _last_snapshot or not _last_changed_paths:
        speak(strings["revert_none"], language=language)
        audit.log_event("revert", outcome="nothing_to_revert")
        return
    reverted, skipped = snapshot.revert(_last_snapshot, _last_changed_paths)
    for path in reverted:
        print(f"    reverted: {path}")
    for path in skipped:
        print(f"    skipped (already had unrelated changes): {path}")
    audit.log_event("revert", reverted=reverted, skipped=skipped)
    speak(strings["revert_done"].format(n=len(reverted)), language=language)
    _last_snapshot, _last_changed_paths = None, []


def handle_request(request_text: str, language: str, work_dir: str, timeout_seconds: float) -> None:
    global _last_snapshot, _last_changed_paths
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

    if normalized in JOBS_PHRASES:
        handle_jobs_command(language, work_dir)
        return
    if normalized in COST_PHRASES:
        handle_cost_command(language)
        return
    if normalized in REVERT_PHRASES:
        handle_revert_command(language)
        return

    audit.log_event("request", language=language, text=request_text)

    request_text, run_longer = _strip_phrase(request_text, LONGER_TIMEOUT_PHRASES)
    request_text, run_background = _strip_phrase(request_text, BACKGROUND_PHRASES)
    effective_timeout = timeout_seconds * LONGER_TIMEOUT_SECONDS_MULTIPLIER if run_longer else timeout_seconds

    try:
        result = plan(request_text, language=language)
    except AgentError as err:
        print(f"[error] {err}")
        audit.log_event("plan_error", language=language, error=str(err))
        offline_result = offline_fallback.try_offline_plan(request_text)
        if offline_result is None:
            speak(strings["offline_no_match"], language=language)
            return
        speak(strings["offline_notice"], language=language)
        result = offline_result
        audit.log_event("offline_plan", language=language, summary=result["summary"], commands=result["commands"])

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

    # Note: a background request still went through the same confirm gate
    # above -- risky commands still required typed CONFIRM either way. Only
    # what happens AFTER confirmation differs here: detached instead of
    # waited-on in the foreground.
    if run_background:
        joined = " && ".join(commands)
        record = jobs.start(joined, work_dir=work_dir, label=summary)
        audit.log_event("background_start", job_id=record["id"], commands=commands)
        speak(strings["background_started"], language=language)
        print(f"    job {record['id']} started (pid {record.get('pid')})")
        return

    snap = snapshot.take(work_dir)

    report = run_commands(commands, work_dir=work_dir, timeout_seconds=effective_timeout)

    changed = snapshot.changed_since(snap)
    _last_snapshot, _last_changed_paths = snap, changed

    speak(report.spoken_summary(language=language), language=language)
    audit.log_event(
        "run",
        language=language,
        ok=report.ok,
        changed_files=changed,
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
    if changed:
        print(f"    ({len(changed)} file(s) changed -- say \"revert\" to undo)")


def print_banner(language: str, work_dir: str) -> None:
    print(f"{config.PRODUCT_NAME} v{config.VERSION} -- {config.COPYRIGHT}")
    print(f"Working directory: {work_dir}")
    print(f"Language: {language}" + ("" if is_translated(language) or language == "auto" else " (untranslated -- using English prompts)"))
    print(f"Wake word: \"{config.WAKE_WORD}\". Listening in {config.WAKE_CHUNK_SECONDS}s chunks. Ctrl+C to quit.")
    print(f"Audit log: {config.AUDIT_LOG_PATH}")
    print(f"Command timeout: {config.COMMAND_TIMEOUT_SECONDS}s (say \"take your time\" in a request for a longer one)")
    print("Say \"jobs\", \"cost\", or \"revert\" any time for background-job status, session spend, or to undo the last run.")


def main(argv=None) -> int:
    global _fallback_notice_given
    args = parse_args(argv)

    if args.list_languages:
        for code in list_languages():
            print(f"{code}\t{get_strings(code)['name']}")
        return 0

    if not config.ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in. "
              "Hey Term will still answer a small set of common requests (see lib/offline_fallback.py) "
              "without it, but full planning needs a key.")

    language = args.lang
    wake_word = args.wake_word.lower().strip()
    work_dir = args.work_dir
    config.AUDIT_LOG_PATH = args.audit_log  # honor --audit-log override for this run
    config.COMMAND_TIMEOUT_SECONDS = args.timeout  # honor --timeout override for this run

    print_banner(language, work_dir)
    audit.log_event("startup", language=language, work_dir=work_dir, version=config.VERSION)

    if language != "auto" and not is_translated(language) and not _fallback_notice_given:
        speak(get_strings(language)["fallback_language_notice"], language=DEFAULT_LANGUAGE_FOR_NOTICE)
        _fallback_notice_given = True

    speak(get_strings(language)["ready"], language=language)

    try:
        while True:
            if listen_for_wake_word(wake_word):
                audit.log_event("wake")
                request_text = take_command(language)
                if request_text:
                    print(f"[you] {request_text}")
                handle_request(request_text, language, work_dir, config.COMMAND_TIMEOUT_SECONDS)
    except KeyboardInterrupt:
        print("\nStopped.")
        audit.log_event("shutdown", reason="keyboard_interrupt")
        return 0


# get_strings() already falls back an untranslated language's strings to
# English, so the notice itself is always spoken in English -- named as a
# constant, not lib.i18n.DEFAULT_LANGUAGE re-imported under a new name, so
# it's clear at the call site *why* English is forced here rather than
# leaving a reader to wonder if it's a bug.
DEFAULT_LANGUAGE_FOR_NOTICE = "en"


if __name__ == "__main__":
    sys.exit(main())
