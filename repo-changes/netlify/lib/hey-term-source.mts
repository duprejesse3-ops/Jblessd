// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/hey-term/tools/embed-source.mjs from the real
// package source. Regenerate after changing the package:
//
//   node packages/hey-term/tools/embed-source.mjs
//
// This is the payload for the Hey Term product (SKU AI-AG-130): the
// complete, runnable source the buyer receives at checkout. It is
// embedded rather than read from disk so fulfilment cannot fail on a
// missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const HEY_TERM_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# Hey Term

*Copyright (c) 2026 MultiNiche AI. All rights reserved. See LICENSE.md.*

Say **"Hey Term"**, then say what you want done, in whichever language you
have it configured for. It transcribes you, asks Claude to turn that into
exact shell command(s) plus a one-sentence summary spoken back in your
language, and only runs anything after you say **"confirm"** (or its
equivalent in that language). Say "cancel" -- or don't answer clearly -- and
nothing runs.

\`\`\`
you:      "Hey Term"
Hey Term: "Yes?"
you:      "list the files in this folder"
Hey Term: "Lists every file in the current folder. Say confirm to run it, or cancel."
you:      "confirm"
Hey Term: [runs \`ls -la\` in real bash, reads back a short result]
\`\`\`

A short list of genuinely destructive commands (wiping a disk, force-pushing
over a branch, dropping a database, etc.) is never run on a spoken "confirm"
alone -- those require typing the word \`CONFIRM\` on the keyboard instead. See
\`lib/config.py\`'s \`DANGEROUS_PATTERNS\` to see or extend that list.

Every wake, request, plan, confirmation, and command run is appended to a
plain-text audit log (\`.hey-term-audit.jsonl\` by default) -- a full record of
what Hey Term has ever been asked to do and whether it actually did it.

## Language support

Six languages ship with translated prompts and confirm/cancel words:
English, Spanish, French, German, Portuguese, Italian.

\`\`\`
python main.py --lang es          # speak Spanish after the wake word
python main.py --lang auto        # detect the spoken language per request
python main.py --list-languages   # see what's translated
\`\`\`

The wake phrase itself, "Hey Term," is **not** translated -- like "Hey Siri"
or "Hey Google," it's the product's name and is said the same way whatever
language you're speaking otherwise (see \`lib/i18n.py\`'s module docstring for
why, and \`lib/transcribe.py\`'s \`transcribe_wake()\` for how that's enforced).

Requests spoken in a language that isn't in that list of six still get
planned and run correctly -- Claude and Whisper both understand far more
languages than Hey Term has translated UI strings for -- it just falls back
to speaking prompts and reading commands back in English until someone adds
that language. **Adding a language** is one edit: add an entry to the
\`LANGUAGES\` dict in \`lib/i18n.py\` with the same keys as the \`"en"\` entry
(\`test/test_i18n.py\` enforces every language has exactly the same keys, so a
missing one fails the test suite instead of failing silently at runtime).

## Speech-to-text engine

By default (\`SPEECH_BACKEND=auto\`), Hey Term uses **Windows' own built-in
speech recognizer** -- the same engine behind Win+H voice typing -- whenever
it's running on Windows, since it's typically more accurate on ordinary
speech than the offline Whisper model, especially at the default \`base\` size.
It falls back to Whisper automatically: on Linux/macOS (where the Windows
engine doesn't exist), if the Windows engine can't be reached for some
reason (mic busy, engine missing for the current Windows install), and for
any explicitly requested non-English \`--lang\` (the Windows engine listens in
the system's default recognition language, not per-request, so translated
non-English requests still go through Whisper, which does support them
directly).

\`\`\`
python main.py                          # default: Windows engine on Windows, Whisper elsewhere
python main.py --speech-backend whisper  # always use offline Whisper, even on Windows
python main.py --speech-backend windows  # force the Windows engine; errors if unavailable
\`\`\`

For best accuracy from the Windows engine, check Settings > Privacy &
security > Speech > "Online speech recognition" is turned on -- that's the
same toggle Win+H itself depends on for its more accurate cloud-assisted
mode; it still works offline, just with the smaller on-device model. See
\`lib/speech_windows.py\` for how this is wired up, and \`.env.example\` for the
\`SPEECH_BACKEND\` setting.

## Linux / bash and Windows / PowerShell

The shell invocation is explicit, not left to Python's default: on Linux/
Kali/macOS it always runs your command through real \`bash\` (not whatever
\`/bin/sh\` happens to symlink to -- \`dash\` on Debian and Kali, which breaks
on bash-only syntax like \`[[ ]]\`, arrays, or \`source\`). On Windows it always
runs through real PowerShell, not \`cmd.exe\`. This matters because the
planning step (\`lib/agent.py\`) is told which shell it's targeting and may
use shell-specific syntax; the executor (\`lib/executor.py\`) guarantees that's
actually what runs it. See \`test/test_executor.py\`'s
\`test_actually_runs_real_bash_not_posix_sh\` for the regression test.

## How it works

1. **Wake word** (\`lib/wake.py\`) -- the mic is transcribed in short rolling
   chunks (local, offline, via \`faster-whisper\`, always decoded as English)
   and checked for "Hey Term" with a fuzzy match, so a slightly-off
   transcription ("hey, term." / "a term") still triggers it.
2. **Your request** (\`lib/audio.py\`, \`lib/transcribe.py\`) -- once woken, it
   records until you stop talking (not just the instant you pause) and
   transcribes the whole thing in your configured language.
3. **Planning** (\`lib/agent.py\`) -- your request goes to Claude's API (plain
   HTTPS, no SDK) with instructions to either return an exact command plan
   plus a summary in your language, or ask a clarifying question if the
   request is ambiguous. It never guesses on unclear requests.
4. **Confirmation** (\`lib/confirm.py\`) -- the summary is spoken back, and it
   listens for an unambiguous yes/no in your language. A mumble, silence, or
   contradictory reply all count as "unclear" and cancel -- only a clear
   confirm runs anything.
5. **Execution** (\`lib/executor.py\`) -- commands run one at a time in
   \`WORK_DIR\` via real bash/PowerShell; if one fails, the rest are skipped
   rather than run against a half-finished state.
6. **Audit** (\`lib/audit.py\`) -- every step above appends a JSON line to the
   audit log, independent of whether the request succeeded, was clarified,
   or was canceled.

## Setup

Unzip \`hey-term.zip\` (your purchase download) anywhere, then \`cd\` into that
folder for every command below.

### Option A: one command (recommended)

\`install.sh\` (Linux/Kali/WSL) and \`install.ps1\` (Windows) run the full setup
for you -- system audio deps, best-effort voice packs for whichever
languages you ask for, Python dependencies, bootstrapping \`.env\`, and
pre-downloading the Whisper model.

**Linux / Kali / WSL:**
\`\`\`
chmod +x install.sh
./install.sh                    # English only, asks before installing
./install.sh --langs es,fr,de   # also install voice packs for these
./install.sh --yes              # don't prompt before apt installs
./install.sh --dry-run          # preview what it would do, changes nothing
sudo ./install.sh --langs es    # use sudo if you're not already root
\`\`\`
It installs \`portaudio19-dev\`, \`bash\`, and \`espeak-ng\` (the baseline that
covers every language on its own), then searches \`apt-cache\` for whatever
higher-quality \`mbrola\` voice packages actually exist for your requested
languages on your apt mirror (package names like \`mbrola-es1\` or \`mbrola-
fr4\` aren't uniform across languages or releases, so it looks them up live
rather than guessing) and offers to install those too. Everything is
skippable and \`--dry-run\` prints the plan without touching your system.

**Windows (PowerShell):**
\`\`\`
.\\install.ps1                              # English only
.\\install.ps1 -Langs es,fr,de              # also request voice packs
.\\install.ps1 -Langs es -SkipCapabilities  # skip the admin-only step
\`\`\`
The voice-pack step (installing Windows' built-in Speech/SAPI5 language
capability, e.g. \`es-ES\`) needs an **elevated (Run as Administrator)**
PowerShell and internet access. If you didn't launch it elevated, that one
step is skipped automatically with on-screen instructions for adding the
voice by hand instead (Settings > Time & Language > Language & region > Add
a language > check "Text-to-speech") -- everything else (Python deps,
\`.env\`, the Whisper model) still runs normally either way.

Either one leaves you with a ready \`.env\` (add your API key) and the
Whisper model already downloaded. Skip straight to [step 4](#4-run-it)
below.

\`install.sh\`/\`install.ps1\` are thin wrappers -- they just forward whatever
you pass to \`scripts/setup-linux.sh\` / \`scripts\\setup-windows.ps1\`, so
calling those directly does exactly the same thing if you'd rather.

### Option B: fully manual

#### 1. Install system audio dependencies

**Windows:** nothing extra needed -- \`sounddevice\` uses your existing audio
drivers, and text-to-speech uses Windows' built-in SAPI5 voices. To add a
non-English voice: Settings > Time & Language > Language & region > Add a
language > pick it > make sure "Text-to-speech" is checked (this is exactly
what \`scripts/setup-windows.ps1\` automates when run as Administrator).

**WSL (Ubuntu on Windows):** WSL doesn't have direct microphone access by
default. Recent Windows 11 builds with WSLg pass audio through automatically;
if \`python main.py\` can't see your mic, either enable WSLg audio (\`wsl
--update\`, then restart), or run this natively on Windows Python instead of
inside WSL for the audio side, even if you do your other dev work in WSL.

**Kali / other Linux:**
\`\`\`
sudo apt-get install portaudio19-dev bash espeak-ng
\`\`\`
(\`bash\` is almost always already installed -- this is just making sure it's
actually there, since the executor now depends on it explicitly rather than
whatever \`/bin/sh\` happens to be. \`espeak-ng\` gives more complete non-English
voices than plain \`espeak\` if you're using \`--lang\` for something other than
English.)

For better-quality voices than plain \`espeak-ng\`, look for an \`mbrola\` voice
package matching your language -- e.g. \`apt-cache search mbrola-es\` for
Spanish, \`mbrola-fr\` for French, \`mbrola-de\` for German, \`mbrola-pt\`/\`mbrola-
br\` for Portuguese, \`mbrola-it\` for Italian -- and \`sudo apt-get install\`
whichever package names it finds. \`scripts/setup-linux.sh --langs <codes>\`
does exactly this search-and-install automatically.

#### 2. Install

Either:
\`\`\`
pip install -r requirements.txt
\`\`\`
or, as an installed command (\`hey-term\` on your PATH afterward):
\`\`\`
pip install -e .
\`\`\`

The first run downloads the local Whisper model (\`base\`, the multilingual
variant, ~150MB) -- a one-time download, cached afterward, and runs fully
offline after that (no audio ever leaves your machine for transcription).

#### 3. Set your API key

\`\`\`
cp .env.example .env
\`\`\`
Then edit \`.env\` and paste in your key from console.anthropic.com. See
\`.env.example\` for the full list of optional settings.

### 4. Run it

\`\`\`
python main.py                      # English, current directory, default wake word
python main.py --lang es            # Spanish
python main.py --work-dir ~/projects/my-repo
hey-term --lang fr                  # if installed with \`pip install -e .\`
\`\`\`

Say "Hey Term", wait for it to prompt you, say what you want. Ctrl+C to
quit, or say the wake word then "stop listening" (or its translated
equivalent) for a spoken sign-off.

## Testing

\`\`\`
python test/run.py
\`\`\`

73 tests, all pure-logic (plan parsing, wake-word matching, confirmation
parsing in all six languages, i18n key-consistency across languages, the
safety blocklist, the audit log, and the command executor -- including a
regression test that bash-only syntax actually runs correctly) -- nothing
here needs a microphone or speaker, so it runs identically in CI or on a
machine with no audio hardware at all.

## Tuning

Everything in \`.env.example\` has a default in \`lib/config.py\`, and the most
common ones are also CLI flags (\`--lang\`, \`--wake-word\`, \`--work-dir\`,
\`--audit-log\`; run \`python main.py --help\`). The ones most worth adjusting
after trying it:

- \`WAKE_MATCH_THRESHOLD\` (default \`0.72\`) -- lower it if the wake word isn't
  triggering reliably in your voice/mic/room; raise it if it's triggering on
  unrelated speech.
- \`SILENCE_RMS_THRESHOLD\` / \`SILENCE_HOLD_SECONDS\` -- how sensitive silence
  detection is, and how long a pause has to last before it decides you're
  done talking.
- \`WHISPER_MODEL_SIZE\` -- \`base\` is a good speed/accuracy default across
  languages; \`small\` is more accurate but slower per chunk; \`tiny\` is faster
  but misses more words (all multilingual variants -- don't use an \`*.en\`
  model if you're using anything other than \`LANGUAGE=en\`).

## What this doesn't do (yet)

- No dedicated wake-word engine like Porcupine -- it re-transcribes short
  audio chunks continuously instead, which is simpler to set up (no
  third-party wake-word training/console account needed) but uses more CPU
  while idle than a dedicated wake-word model would.
- Text-to-speech quality/availability in a given language depends on which
  voices are installed on the OS (Windows SAPI5 languages, or \`espeak-ng\`
  language packs on Linux) -- the planning and transcription work in far
  more languages than will get a natural-sounding spoken voice back.
- Runs in the foreground of one terminal, not as a background service.
- The dangerous-command blocklist in \`lib/config.py\` is a short, specific
  safety net for catastrophic single commands -- it is not a general security
  boundary, and voice confirmation for everything else is still just that:
  confirmation, not a sandbox. Point \`WORK_DIR\` at a folder you're
  comfortable running arbitrary confirmed commands in.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# Hey Term -- License

Copyright (c) 2026 MultiNiche AI. All rights reserved.

This software and its source code are the property of MultiNiche AI.
Personal and internal business use, modification, and local redistribution
within your own organization are permitted. Resale, sublicensing, or
redistribution of this software (in original or modified form) as a
standalone product is not permitted without prior written permission from
MultiNiche AI.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
OR OTHER DEALINGS IN THE SOFTWARE -- including, without limitation, damages
resulting from commands it runs on your behalf. Hey Term asks for
confirmation before running anything; the person confirming is responsible
for what gets run.
`,
  },
  {
    path: "main.py",
    contents: `#!/usr/bin/env python3
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
from lib.audio import list_devices, record_fixed, record_until_silence, rms
from lib.confirm import parse_confirmation
from lib.executor import run_commands
from lib.i18n import get as get_strings, is_translated, list_languages
from lib.safety import dangerous_commands
from lib.speak import speak
from lib import speech_windows
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
                    help=f"Wake phrase (default: \\"{config.WAKE_WORD}\\").")
    p.add_argument("--work-dir", default=config.WORK_DIR, metavar="PATH",
                    help="Folder commands run in (default: current directory).")
    p.add_argument("--audit-log", default=config.AUDIT_LOG_PATH, metavar="PATH",
                    help="Path to the JSONL audit log (default: .hey-term-audit.jsonl in --work-dir).")
    p.add_argument("--list-languages", action="store_true", help="List translated languages and exit.")
    p.add_argument("--list-devices", action="store_true",
                    help="List audio input devices (with the system default marked) and exit.")
    p.add_argument("--mic-device", default=None, metavar="INDEX_OR_NAME",
                    help="Force a specific input device (index or name substring from --list-devices) "
                         "instead of the system default. Same as setting MIC_DEVICE in .env.")
    p.add_argument("--speech-backend", default=config.SPEECH_BACKEND, choices=["auto", "windows", "whisper"],
                    metavar="BACKEND",
                    help="Speech-to-text engine: \\"auto\\" (default) uses Windows' own speech recognizer "
                         "when available (usually more accurate than offline Whisper), else Whisper; "
                         "\\"windows\\" forces it and errors if unavailable; \\"whisper\\" always uses "
                         "offline Whisper. Same as setting SPEECH_BACKEND in .env.")
    p.add_argument("--version", action="version", version=f"{config.PRODUCT_NAME} {config.VERSION}")
    return p.parse_args(argv)


def resolve_speech_backend(requested: str) -> str:
    """Turns config/--speech-backend's "auto"/"windows"/"whisper" into the
    engine actually used this run: "windows" or "whisper". Resolved once at
    startup (not per wake-loop chunk) since it touches the Windows Runtime.
    Raises ValueError (caught in main(), printed, causes a clean exit) if
    "windows" was forced but isn't actually available.
    """
    if requested == "whisper":
        return "whisper"
    if requested == "windows":
        if speech_windows.is_available():
            return "windows"
        raise ValueError(
            f"--speech-backend windows (or SPEECH_BACKEND=windows) was requested, but it isn't "
            f"available: {speech_windows.unavailable_reason()}"
        )
    return "windows" if speech_windows.is_available() else "whisper"


def _backend_for_language(backend: str, language: str) -> str:
    """The Windows speech recognizer, constructed with no arguments, listens
    in the system's default recognition language -- it isn't switched per
    Hey Term's --lang the way Whisper is. So it's only used for English/auto
    requests; any other explicitly requested language still goes through
    Whisper, which does support it directly."""
    if backend == "windows" and language not in ("en", "auto"):
        return "whisper"
    return backend


def listen_for_wake_word(wake_word: str, backend: str) -> bool:
    """Returns True if the wake word was heard. Called in a loop by main();
    each attempt is independent, so a miss just means "try again," not a
    lost turn. Always decoded as English -- see lib/transcribe.py's
    transcribe_wake() docstring for why that's true regardless of --lang.

    With backend="windows", Windows' own speech recognizer does its own
    microphone capture and voice-activity detection in one call (see
    lib/speech_windows.py); on any failure (mic busy, engine not installed,
    etc.) this falls back to the Whisper path for that one attempt rather
    than crashing the loop.

    With backend="whisper" (or as that fallback), near-silent chunks skip
    transcription entirely rather than being sent to Whisper -- on silence
    or faint room noise it doesn't reliably return an empty string, it can
    hallucinate a fluent, plausible-sounding sentence instead. Gating on
    energy first is what actually stops those from showing up as [heard]
    lines and (rarely) fuzzy-matching the wake word.
    """
    if backend == "windows":
        try:
            text = speech_windows.recognize_once(timeout_seconds=config.WAKE_CHUNK_SECONDS)
        except RuntimeError as err:
            print(f"[warn] {err} -- falling back to Whisper for this listen")
        else:
            if text:
                print(f"[heard] {text}")
            return heard_wake_word(text, wake_word=wake_word)

    clip = record_fixed(config.WAKE_CHUNK_SECONDS)
    if rms(clip) < config.SILENCE_RMS_THRESHOLD:
        return False
    text = transcribe_wake(clip)
    if text:
        print(f"[heard] {text}")
    return heard_wake_word(text, wake_word=wake_word)


def take_command(language: str, backend: str) -> str:
    strings = get_strings(language)
    speak(strings["listening_prompt"], language=language)

    backend = _backend_for_language(backend, language)
    if backend == "windows":
        try:
            return speech_windows.recognize_once().strip()
        except RuntimeError as err:
            print(f"[warn] {err} -- falling back to Whisper for this command")

    audio = record_until_silence(config.COMMAND_MAX_SECONDS)
    text = transcribe(audio, language=language)
    return text.strip()


def get_confirmation(language: str, backend: str) -> str:
    """Returns "confirm", "cancel", or "unclear" from a spoken reply."""
    backend = _backend_for_language(backend, language)
    if backend == "windows":
        try:
            text = speech_windows.recognize_once(timeout_seconds=5)
        except RuntimeError as err:
            print(f"[warn] {err} -- falling back to Whisper for this confirmation")
        else:
            if text:
                print(f"[heard] {text}")
            return parse_confirmation(text, language=language)

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


def handle_request(request_text: str, language: str, work_dir: str, backend: str) -> None:
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
        answer = get_confirmation(language, backend)
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


def print_banner(language: str, work_dir: str, backend: str) -> None:
    print(f"{config.PRODUCT_NAME} v{config.VERSION} -- {config.COPYRIGHT}")
    print(f"Working directory: {work_dir}")
    print(f"Language: {language}" + ("" if is_translated(language) or language == "auto" else " (untranslated -- using English prompts)"))
    if backend == "windows":
        note = "" if language in ("en", "auto") else " (falls back to Whisper for this non-English language)"
        print(f"Speech-to-text: Windows' built-in speech recognizer{note}")
    else:
        print(f"Speech-to-text: offline Whisper ({config.WHISPER_MODEL_SIZE})")
    print(f"Wake word: \\"{config.WAKE_WORD}\\". Listening in {config.WAKE_CHUNK_SECONDS}s chunks. Ctrl+C to quit.")
    print(f"Audit log: {config.AUDIT_LOG_PATH}")


def main(argv=None) -> int:
    args = parse_args(argv)

    if args.list_languages:
        for code in list_languages():
            print(f"{code}\\t{get_strings(code)['name']}")
        return 0

    if args.list_devices:
        print(list_devices())
        return 0

    if args.mic_device is not None:
        config.MIC_DEVICE = args.mic_device

    if not config.ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.")
        return 1

    try:
        backend = resolve_speech_backend(args.speech_backend)
    except ValueError as err:
        print(err)
        return 1

    language = args.lang
    wake_word = args.wake_word.lower().strip()
    work_dir = args.work_dir
    config.AUDIT_LOG_PATH = args.audit_log  # honor --audit-log override for this run

    print_banner(language, work_dir, backend)
    audit.log_event("startup", language=language, work_dir=work_dir, version=config.VERSION, speech_backend=backend)
    speak(get_strings(language)["ready"], language=language)

    try:
        while True:
            if listen_for_wake_word(wake_word, backend):
                audit.log_event("wake")
                request_text = take_command(language, backend)
                if request_text:
                    print(f"[you] {request_text}")
                handle_request(request_text, language, work_dir, backend)
    except KeyboardInterrupt:
        print("\\nStopped.")
        audit.log_event("shutdown", reason="keyboard_interrupt")
        return 0


if __name__ == "__main__":
    sys.exit(main())
`,
  },
  {
    path: "requirements.txt",
    contents: `sounddevice>=0.4.6
numpy>=1.24
faster-whisper>=1.0.0
pyttsx3>=2.90
requests>=2.31
# Windows' own speech recognizer (used by default on Windows -- see
# lib/speech_windows.py and SPEECH_BACKEND in .env.example). Only installs
# on Windows; Linux/macOS use Whisper only and never import this.
winsdk>=1.0.0; sys_platform == "win32"
`,
  },
  {
    path: "pyproject.toml",
    contents: `[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "hey-term"
version = "1.0.0"
description = "Hey Term -- a voice-activated terminal. Say what you want, it plans and confirms before it runs."
readme = "README.md"
requires-python = ">=3.9"
license = { file = "LICENSE.md" }
authors = [{ name = "MultiNiche AI" }]
dependencies = [
    "sounddevice>=0.4.6",
    "numpy>=1.24",
    "faster-whisper>=1.0.0",
    "pyttsx3>=2.90",
    "requests>=2.31",
]

[project.scripts]
hey-term = "main:main"

[tool.setuptools]
py-modules = ["main"]

[tool.setuptools.packages.find]
include = ["lib*"]
`,
  },
  {
    path: ".env.example",
    contents: `# Hey Term -- Copyright (c) 2026 MultiNiche AI. All rights reserved.

# Required: your Anthropic API key (console.anthropic.com -> API Keys).
ANTHROPIC_API_KEY=

# Optional overrides -- defaults shown. CLI flags (--lang, --wake-word,
# --work-dir, --audit-log) override these for a single run without editing
# this file; run \`python main.py --help\` to see them.
# ANTHROPIC_MODEL=claude-sonnet-4-5

# The wake phrase is Hey Term's name and, like "Hey Siri"/"Hey Google", is
# said the same way regardless of which language you set below.
# WAKE_WORD=hey term
# WAKE_MATCH_THRESHOLD=0.72

# Language spoken/listened to AFTER the wake word. "auto" detects it from
# each utterance instead of assuming one. Run \`python main.py --list-languages\`
# for the languages with translated prompts (en, es, fr, de, pt, it as
# shipped); any language Whisper/Claude understand still works for the
# request itself even if it isn't in that list -- it just gets English
# prompts/confirmation words back. See lib/i18n.py to add a new one.
# LANGUAGE=en

# base is the multilingual Whisper model (required for LANGUAGE != en).
# small is more accurate but slower per chunk; tiny is faster but misses
# more words. All run fully offline once downloaded.
# WHISPER_MODEL_SIZE=base
# WHISPER_DEVICE=cpu

# Which engine turns speech into text. "auto" (default) uses Windows' own
# built-in speech recognizer -- the same engine behind Win+H voice typing --
# when running on Windows, since it's usually more accurate on ordinary
# speech than offline Whisper, and falls back to Whisper everywhere else
# (Linux/macOS) or if the Windows engine can't be reached. "windows" forces
# it and errors out if unavailable; "whisper" always uses offline Whisper
# even on Windows. Only applies to English/auto -- an explicit non-English
# LANGUAGE always uses Whisper, since the Windows engine isn't switched
# per-request the way Whisper is. See lib/speech_windows.py, and Settings >
# Privacy & security > Speech > "Online speech recognition" on Windows for
# the toggle that affects its accuracy.
# SPEECH_BACKEND=auto

# Forces a specific microphone instead of the system default. Run
# \`python main.py --list-devices\` to see indices/names -- useful if the
# default recording device isn't actually your mic (a "Stereo Mix"/"What U
# Hear" loopback device left as Windows' default input will make Hey Term
# hear whatever's playing through your speakers instead of your voice).
# MIC_DEVICE=

# SAMPLE_RATE=16000
# WAKE_CHUNK_SECONDS=2.5
# COMMAND_MAX_SECONDS=12
# SILENCE_HOLD_SECONDS=1.2
# SILENCE_RMS_THRESHOLD=0.012

# Folder commands run in. Defaults to wherever you launch \`python main.py\`
# from -- set this to pin it to one project instead.
# WORK_DIR=/home/you/projects/my-repo

# Every wake/request/plan/confirmation/run is appended here as one JSON
# object per line -- a full audit trail of what Hey Term has ever done.
# Defaults to .hey-term-audit.jsonl inside WORK_DIR.
# AUDIT_LOG_PATH=/home/you/projects/my-repo/.hey-term-audit.jsonl
`,
  },
  {
    path: "install.sh",
    contents: `#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Entry point: hands off to the real Linux setup script (system audio deps,
# best-effort voice packs, Python deps, .env, Whisper model). See
# scripts/setup-linux.sh --help for every flag; anything you pass here is
# forwarded as-is, e.g.:
#
#   ./install.sh --langs es,fr,de
#   ./install.sh --yes
set -euo pipefail
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/scripts/setup-linux.sh" "$@"
`,
  },
  {
    path: "install.ps1",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Entry point: hands off to the real Windows setup script (best-effort
# Speech/SAPI5 voice pack if run elevated, Python deps, .env, Whisper
# model). See scripts\\setup-windows.ps1 for every parameter; anything you
# pass here is forwarded as-is, e.g.:
#
#   .\\install.ps1 -Langs es,fr,de
#   .\\install.ps1 -SkipCapabilities

param(
    [string[]]$Langs = @("en"),
    [switch]$SkipCapabilities,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"
$setupArgs = @{ Langs = $Langs }
if ($SkipCapabilities) { $setupArgs.SkipCapabilities = $true }
if ($Yes) { $setupArgs.Yes = $true }
& (Join-Path $PSScriptRoot "scripts\\setup-windows.ps1") @setupArgs
`,
  },
  {
    path: "lib/__init__.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
`,
  },
  {
    path: "lib/agent.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Turns a spoken request into a plain-English (or plain-<language>) summary
plus exact shell commands, by calling Claude's Messages API directly (plain
HTTP, no SDK dependency -- same pattern as every other Claude-calling product
in this line of tools).

The model is told, explicitly, to prefer asking a clarifying question over
guessing when a request is ambiguous ("clean this up" could mean a dozen
different things) -- a wrong guess that gets voice-confirmed is exactly the
failure mode this whole tool exists to avoid.
"""
import json
import platform

import requests

from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL, is_windows
from .i18n import get as get_strings

API_URL = "https://api.anthropic.com/v1/messages"
TIMEOUT_SECONDS = 30

SYSTEM_PROMPT = """You are Hey Term, a cautious voice-controlled terminal assistant made by MultiNiche AI. \\
The person speaks a request; you turn it into exact shell command(s) to run \\
in their existing terminal session, or ask a clarifying question if the \\
request is ambiguous or you're missing information you'd need to get it right.

Rules:
- Prefer the smallest, safest command that accomplishes exactly what was \\
asked. Do not add steps the person didn't ask for (no extra cleanup, no \\
"while I'm at it" changes).
- If the request could reasonably mean more than one thing, or names a file/\\
target you have no way to confirm exists, ask a clarifying question instead \\
of guessing.
- If the request is not something a shell command can do, say so in "clarify" \\
rather than inventing a command that doesn't actually do it.
- Shell is {shell} on {os_name}. Use syntax that shell actually supports -- \\
real bash (not a generic POSIX sh subset) on Linux/macOS, real PowerShell \\
(not cmd.exe batch syntax) on Windows.
- Never chain an unrelated destructive command onto a benign request.
- Write "summary" (and "clarify", if you use it) in {language_name}, in a \\
short, natural, speakable sentence -- it will be read aloud by text-to-speech, \\
not displayed as text. Commands stay in real shell syntax regardless of \\
{language_name}, since a shell doesn't speak {language_name}.

Respond with ONLY a single JSON object, no other text, in exactly one of \\
these two shapes:

{{"summary": "<one plain sentence in {language_name} describing what will happen>", \\
"commands": ["<command 1>", "<command 2>"]}}

or

{{"clarify": "<one short question in {language_name} to ask back>"}}
"""


class AgentError(Exception):
    pass


def _shell_name() -> str:
    return "PowerShell" if is_windows() else "bash"


def plan(request_text: str, language: str = "en", api_key: str = None) -> dict:
    """Ask Claude to turn spoken text into a plan. Returns either
    {"summary": str, "commands": [str, ...]} or {"clarify": str}.
    Raises AgentError on a network failure or a response that isn't valid
    JSON in one of those two shapes -- callers should treat that as "ask the
    person to repeat themselves," never as a command to run.
    """
    key = api_key or ANTHROPIC_API_KEY
    if not key:
        raise AgentError("ANTHROPIC_API_KEY is not set (see .env.example).")

    language_name = get_strings(language)["name"]
    system = SYSTEM_PROMPT.format(shell=_shell_name(), os_name=platform.system(), language_name=language_name)

    try:
        resp = requests.post(
            API_URL,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 500,
                "system": system,
                "messages": [{"role": "user", "content": request_text}],
            },
            timeout=TIMEOUT_SECONDS,
        )
    except requests.RequestException as err:
        raise AgentError(f"Could not reach Claude's API: {err}") from err

    if resp.status_code != 200:
        raise AgentError(f"Claude's API returned {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        text = "".join(
            block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"
        ).strip()
    except (ValueError, KeyError) as err:
        raise AgentError(f"Unexpected response shape from Claude's API: {err}") from err

    return parse_plan(text)


def parse_plan(text: str) -> dict:
    """Pull the JSON object out of a model response and validate its shape.
    Separated from plan() so it's testable without a network call.
    """
    text = text.strip()
    # Models occasionally wrap JSON in a fenced code block despite being told
    # not to -- strip that rather than fail the whole turn over formatting.
    if text.startswith("\`\`\`"):
        text = text.strip("\`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as err:
        raise AgentError(f"Response wasn't valid JSON: {err}") from err

    if not isinstance(parsed, dict):
        raise AgentError("Response JSON wasn't an object.")

    if "clarify" in parsed:
        question = parsed.get("clarify")
        if not isinstance(question, str) or not question.strip():
            raise AgentError("'clarify' field was empty or not a string.")
        return {"clarify": question.strip()}

    if "summary" in parsed and "commands" in parsed:
        summary = parsed.get("summary")
        commands = parsed.get("commands")
        if not isinstance(summary, str) or not summary.strip():
            raise AgentError("'summary' field was empty or not a string.")
        if not isinstance(commands, list) or not commands:
            raise AgentError("'commands' field must be a non-empty list.")
        if not all(isinstance(c, str) and c.strip() for c in commands):
            raise AgentError("Every entry in 'commands' must be a non-empty string.")
        return {"summary": summary.strip(), "commands": [c.strip() for c in commands]}

    raise AgentError("Response JSON had neither a valid 'clarify' nor a valid 'summary'+'commands' shape.")
`,
  },
  {
    path: "lib/audio.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Microphone capture. Imports sounddevice/numpy lazily inside functions so
that importing this module (e.g. from a test) doesn't require audio hardware
or system audio libraries (portaudio) to be installed.

Imports the config module itself (not its values by name) so a runtime
override of config.MIC_DEVICE -- e.g. main.py's --mic-device flag -- is
actually seen here, the same reason lib/audit.py reads config.AUDIT_LOG_PATH
live instead of importing it by value.
"""
from . import config


def _resolve_device():
    """Returns a sounddevice device index to pass as \`device=\`, or None to
    use the system default. config.MIC_DEVICE can be a numeric index or a
    case-insensitive substring of a device name (see --list-devices)."""
    setting = config.MIC_DEVICE
    if not setting:
        return None
    if setting.isdigit():
        return int(setting)

    import sounddevice as sd

    needle = setting.lower()
    matches = [
        i
        for i, d in enumerate(sd.query_devices())
        if d["max_input_channels"] > 0 and needle in d["name"].lower()
    ]
    if not matches:
        raise RuntimeError(
            f"MIC_DEVICE={setting!r} didn't match any input device. "
            f"Run \`python main.py --list-devices\` to see what's available."
        )
    return matches[0]


def rms(clip) -> float:
    """Root-mean-square energy of a recorded clip. Used to skip sending
    near-silent audio to Whisper -- on silence or faint background noise,
    Whisper doesn't reliably return an empty string, it can hallucinate a
    fluent, plausible-sounding sentence instead (a documented Whisper
    behavior, not a bug in this code). Gating on energy before transcribing
    avoids feeding it the near-silent chunks that trigger this."""
    import numpy as np

    if clip is None or len(clip) == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(clip))))


def list_devices() -> str:
    """Human-readable list of input-capable audio devices, for
    --list-devices. Marks the system default explicitly, since a wrong
    default (e.g. a loopback/"Stereo Mix" device instead of the real mic)
    is the most common cause of Hey Term hearing background audio instead
    of your voice."""
    import sounddevice as sd

    try:
        default_input = sd.default.device[0]
    except Exception:
        default_input = None

    lines = []
    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] <= 0:
            continue
        marker = "  <- system default" if i == default_input else ""
        lines.append(f"  [{i}] {d['name']}{marker}")
    return "\\n".join(lines) if lines else "No input devices found."


def record_fixed(seconds: float, sample_rate: int = None):
    """Records a fixed-length clip and returns a 1-D float32 numpy array."""
    import sounddevice as sd

    rate = sample_rate or config.SAMPLE_RATE
    audio = sd.rec(int(seconds * rate), samplerate=rate, channels=1, dtype="float32",
                    device=_resolve_device())
    sd.wait()
    return audio.reshape(-1)


def record_until_silence(max_seconds: float, sample_rate: int = None,
                          silence_hold: float = None, rms_threshold: float = None):
    """Records in small blocks until the person stops talking (RMS energy
    under threshold for \`silence_hold\` seconds in a row), or \`max_seconds\`
    is reached, whichever comes first. Returns a 1-D float32 numpy array.

    Recording doesn't stop the instant it goes quiet -- someone pausing
    mid-sentence to think would get cut off. It waits for a sustained quiet
    stretch, not just one quiet instant.
    """
    import numpy as np
    import sounddevice as sd

    rate = sample_rate or config.SAMPLE_RATE
    hold = silence_hold if silence_hold is not None else config.SILENCE_HOLD_SECONDS
    threshold = rms_threshold if rms_threshold is not None else config.SILENCE_RMS_THRESHOLD

    block_seconds = 0.2
    block_size = int(rate * block_seconds)
    blocks = []
    silent_blocks_needed = max(1, int(hold / block_seconds))
    consecutive_silent = 0
    heard_speech = False
    max_blocks = int(max_seconds / block_seconds)

    with sd.InputStream(samplerate=rate, channels=1, dtype="float32", device=_resolve_device()) as stream:
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
`,
  },
  {
    path: "lib/audit.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Append-only audit trail: one JSON object per line, one line per event.

A tool that runs shell commands on your spoken say-so needs to be able to
answer, after the fact, exactly what it ran, when, and why it believed you'd
confirmed it -- not just show that in a terminal scrollback that gets closed.
Every wake, request, plan (or clarifying question), confirmation outcome, and
command result is appended here. Nothing is ever removed or rewritten by this
module -- it only appends, so a corrupted or partial write to one line can
never take an earlier entry down with it.
"""
import json
import time

from . import config

# config.AUDIT_LOG_PATH is read fresh on every call (via the \`config\` module
# reference, not imported by value) so that main.py's --audit-log override --
# which reassigns config.AUDIT_LOG_PATH after this module is already
# imported -- actually takes effect instead of silently writing to the
# default path the module happened to see at import time.


def log_event(kind: str, **fields) -> None:
    entry = {"ts": time.time(), "iso": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "kind": kind}
    entry.update(fields)
    target = config.AUDIT_LOG_PATH
    try:
        with open(target, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\\n")
    except OSError as err:  # pragma: no cover - depends on local filesystem permissions
        # Logging failure must never take down the actual task -- print a
        # warning once to the terminal (which is itself a record) and move on.
        print(f"[audit] could not write to {target}: {err}")


def read_events(path: str = None) -> list:
    """Reads the audit log back as a list of dicts. Used by tests and by
    anyone auditing what Hey Term has done; skips (rather than crashes on) a
    line that somehow didn't get written as valid JSON.
    """
    events = []
    target = path or config.AUDIT_LOG_PATH
    try:
        with open(target, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        return []
    return events
`,
  },
  {
    path: "lib/config.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Configuration loaded from environment variables (see .env.example)."""
import os
import platform

PRODUCT_NAME = "Hey Term"
VERSION = "1.0.0"
COPYRIGHT = "Copyright (c) 2026 MultiNiche AI. All rights reserved."


def _get_env_file_pairs(path: str) -> dict:
    pairs = {}
    if not os.path.isfile(path):
        return pairs
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            pairs[key.strip()] = value.strip().strip('"').strip("'")
    return pairs


# Load .env once at import time, without overriding real environment variables
# that are already set (a real env var always wins over the file).
_dotenv = _get_env_file_pairs(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
for _k, _v in _dotenv.items():
    os.environ.setdefault(_k, _v)


ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")

# The wake phrase is the product's name and, like "Hey Siri"/"Hey Google", is
# said the same way regardless of spoken language -- see lib/i18n.py's module
# docstring for why. It's still overridable (e.g. a shorter "term" for a
# noisy room), just not translated per-language by default.
WAKE_WORD = os.environ.get("WAKE_WORD", "hey term").lower().strip()
WAKE_MATCH_THRESHOLD = float(os.environ.get("WAKE_MATCH_THRESHOLD", "0.72"))

# "auto" lets Whisper detect the spoken language per command instead of
# assuming one -- more flexible for a household where different people talk
# to it, at a small accuracy cost vs. naming the language explicitly. See
# lib/i18n.py for which languages have translated prompts; any language
# Whisper/Claude understand still works for the request itself even if it
# isn't in that list, it just gets English prompts back.
LANGUAGE = os.environ.get("LANGUAGE", "en").lower().strip()

WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")

# Which engine turns speech into text. "auto" (default) uses Windows' own
# built-in speech recognizer -- the same on-device/cloud-assisted engine
# behind Win+H voice typing -- when running on Windows, since it's typically
# more accurate on ordinary speech than the offline Whisper "base"/"small"
# models, and falls back to Whisper anywhere else (Linux/macOS, or if the
# Windows engine can't be reached for some reason). "windows" forces the
# Windows engine and errors out if it's unavailable; "whisper" always uses
# offline Whisper regardless of platform, e.g. if you'd rather nothing touch
# Windows' cloud-assisted recognition. See lib/speech_windows.py.
SPEECH_BACKEND = os.environ.get("SPEECH_BACKEND", "auto").lower().strip()

# Optional: force a specific input device instead of relying on the OS
# default (sounddevice/PortAudio otherwise always records from whatever the
# system's default recording device is). Set to a device index (e.g. "1")
# or a case-insensitive substring of a device name (e.g. "Realtek", "USB
# Microphone") -- run \`python main.py --list-devices\` to see what's
# available. Useful when the system default isn't actually the mic you want
# it to hear: a "Stereo Mix"/"What U Hear" loopback device (which records
# whatever's playing through your speakers, not your voice) getting left as
# the Windows default input is the most common way this goes wrong.
MIC_DEVICE = os.environ.get("MIC_DEVICE", "").strip()

SAMPLE_RATE = int(os.environ.get("SAMPLE_RATE", "16000"))
WAKE_CHUNK_SECONDS = float(os.environ.get("WAKE_CHUNK_SECONDS", "2.5"))
COMMAND_MAX_SECONDS = float(os.environ.get("COMMAND_MAX_SECONDS", "12"))
SILENCE_HOLD_SECONDS = float(os.environ.get("SILENCE_HOLD_SECONDS", "1.2"))
SILENCE_RMS_THRESHOLD = float(os.environ.get("SILENCE_RMS_THRESHOLD", "0.012"))

# Working directory the assistant is allowed to run commands in. Defaults to
# wherever the script was launched from -- set this explicitly in .env if you
# want it scoped to one project folder instead of wherever you happened to cd.
WORK_DIR = os.environ.get("WORK_DIR") or os.getcwd()

# Every wake, request, plan, confirmation outcome, and command result is
# appended here as one JSON object per line -- a plain-text audit trail of
# everything Hey Term has ever been asked to do and whether it actually did
# it. Off by default is not an option: a tool that runs shell commands on
# your say-so should always be able to answer "what did you run, and when."
AUDIT_LOG_PATH = os.environ.get("AUDIT_LOG_PATH") or os.path.join(WORK_DIR, ".hey-term-audit.jsonl")

_IS_WINDOWS = platform.system() == "Windows"


def shell_display_name() -> str:
    return "PowerShell" if _IS_WINDOWS else "bash"


def is_windows() -> bool:
    return _IS_WINDOWS


# Commands matching these (case-insensitive substring) patterns are never run
# on a spoken "confirm" alone -- see lib/safety.py. Kept short and specific on
# purpose: a long blocklist gives a false sense of coverage it can't deliver,
# so this exists to catch the handful of single commands that can destroy an
# entire disk or OS install, not to be a general security boundary.
DANGEROUS_PATTERNS = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf .",
    "rm -rf *",
    ":(){ :|:& };:",  # fork bomb
    "mkfs",
    "dd if=",
    "> /dev/sd",
    "format c:",
    "diskpart",
    "shutdown",
    "reboot",
    "del /f /s /q",
    "git push --force",
    "git reset --hard",
    "drop database",
    "drop table",
    "truncate table",
]
`,
  },
  {
    path: "lib/confirm.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
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
    return re.sub(r"[^\\w' ]+", " ", text.lower().strip(), flags=re.UNICODE)


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
`,
  },
  {
    path: "lib/executor.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Runs confirmed shell commands and captures their output. No hidden retries,
no silent continuation past a failure -- if one command in a plan fails, the
rest are skipped and reported as not run, so a partially-applied change never
gets narrated as if it fully succeeded.

Shell selection is explicit, not left to Python's \`shell=True\` default:
\`subprocess.run(cmd, shell=True)\` on Linux runs \`/bin/sh\` (often \`dash\` on
Debian/Kali, not bash), while the agent (lib/agent.py) is told the shell is
"bash" and may emit bash-only syntax (\`[[ ]]\`, arrays, \`source\`, brace
expansion). That mismatch would make some correct plans fail with a syntax
error. Likewise \`shell=True\` on Windows runs \`cmd.exe\`, not PowerShell, even
though the agent is told PowerShell and writes PowerShell syntax. This module
builds the actual interpreter invocation explicitly on both platforms so what
runs always matches what the agent was told it could write.
"""
import os
import shutil
import subprocess
from dataclasses import dataclass, field

from .config import WORK_DIR, is_windows
from .i18n import DEFAULT_LANGUAGE, get as get_strings

COMMAND_TIMEOUT_SECONDS = 120
OUTPUT_TRUNCATE_CHARS = 4000


@dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str
    ran: bool = True
    error: str = ""


@dataclass
class RunReport:
    results: list = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(r.ran and r.returncode == 0 for r in self.results)

    def spoken_summary(self, language: str = DEFAULT_LANGUAGE) -> str:
        strings = get_strings(language)
        ran = [r for r in self.results if r.ran]
        failed = [r for r in ran if r.returncode != 0]
        skipped = [r for r in self.results if not r.ran]
        if not failed and not skipped:
            noun = strings["command_singular"] if len(ran) == 1 else strings["command_plural"]
            return f"{strings['done_prefix']} {len(ran)} {noun} {strings['ran_successfully']}"
        parts = []
        if failed:
            parts.append(f"{len(failed)} {strings['failed_word']}")
        if skipped:
            parts.append(f"{len(skipped)} {strings['skipped_word']}")
        return strings["stopped_prefix"] + " " + ", ".join(parts) + "."


def _truncate(s: str) -> str:
    if len(s) <= OUTPUT_TRUNCATE_CHARS:
        return s
    return s[:OUTPUT_TRUNCATE_CHARS] + f"\\n...[truncated, {len(s) - OUTPUT_TRUNCATE_CHARS} more chars]"


def _build_argv(command: str) -> list:
    """Returns the actual argv to exec for one command string, matching
    whichever shell the agent was told about in lib/agent.py's system prompt.
    """
    if is_windows():
        exe = shutil.which("pwsh") or shutil.which("powershell") or "powershell"
        return [exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]
    # Prefer a real bash over whatever /bin/sh happens to symlink to (dash on
    # Debian/Kali, which doesn't support the bash-only syntax the agent may
    # emit). Falls back to sh only if bash genuinely isn't installed anywhere
    # on this machine -- rare, but better to run something than nothing.
    exe = shutil.which("bash") or ("/bin/bash" if os.path.exists("/bin/bash") else None) or shutil.which("sh") or "/bin/sh"
    return [exe, "-c", command]


def run_commands(commands: list, work_dir: str = None) -> RunReport:
    """Runs each command in order, stopping at the first non-zero exit so a
    later command never runs against a state the earlier one failed to reach.
    """
    cwd = work_dir or WORK_DIR
    report = RunReport()
    stop = False
    for cmd in commands:
        if stop:
            report.results.append(CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=False))
            continue
        try:
            proc = subprocess.run(
                _build_argv(cmd),
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=COMMAND_TIMEOUT_SECONDS,
            )
            result = CommandResult(
                command=cmd,
                returncode=proc.returncode,
                stdout=_truncate(proc.stdout),
                stderr=_truncate(proc.stderr),
                ran=True,
            )
        except subprocess.TimeoutExpired:
            result = CommandResult(
                command=cmd, returncode=-1, stdout="", stderr="", ran=True,
                error=f"Timed out after {COMMAND_TIMEOUT_SECONDS}s",
            )
        except OSError as err:
            result = CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=True, error=str(err))

        report.results.append(result)
        if result.returncode != 0:
            stop = True
    return report
`,
  },
  {
    path: "lib/i18n.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Spoken-language strings and confirm/cancel word lists for Hey Term.

The wake phrase itself ("Hey Term") is NOT translated -- like "Hey Siri" or
"Hey Google", it's the product's name, said the same way regardless of what
language you're speaking otherwise. See lib/wake.py and lib/transcribe.py's
transcribe_wake() for why the wake pass always decodes as English even when
LANGUAGE is set to something else.

Everything AFTER the wake word -- what it says back to you, and what counts
as a yes/no from you -- follows LANGUAGE.

Six languages ship translated by hand (not machine-translated) because I can
vouch for their accuracy; Whisper and Claude both understand many more than
that, so a request spoken in an untranslated language still gets planned and
run correctly, it just gets the English prompts/confirmation words back
until someone adds that language here. See README.md "Adding a language".
"""

DEFAULT_LANGUAGE = "en"

LANGUAGES = {
    "en": {
        "name": "English",
        "whisper_code": "en",
        "ready": "Hey Term ready.",
        "listening_prompt": "Yes?",
        "not_caught": "I didn't catch that.",
        "canceled": "Canceled.",
        "ask_confirm": "Say confirm to run it, or cancel.",
        "unclear_cancel": "I didn't catch a clear yes or no, so I'm canceling this one. Just ask again if you still want it.",
        "requires_typed": "This includes something on my do-not-run-by-voice list, so I need you to type CONFIRM to proceed.",
        "typed_confirm_prompt": "Type CONFIRM (all caps) to run these commands, or press Enter to cancel: ",
        "stopping": "Stopping. Say the wake word again any time.",
        "agent_error": "Something went wrong asking Claude how to do that. Check the terminal for details.",
        "yes_words": {"confirm", "confirmed", "yes", "yeah", "yep", "sure", "do it", "go ahead", "run it", "proceed"},
        "no_words": {"cancel", "cancelled", "canceled", "no", "nope", "stop", "abort", "don't", "never mind", "nevermind"},
        "stop_phrases": {"stop listening", "shut down", "power off", "goodbye"},
        "command_singular": "command",
        "command_plural": "commands",
        "done_prefix": "Done.",
        "ran_successfully": "ran successfully.",
        "stopped_prefix": "Stopped partway:",
        "failed_word": "failed",
        "skipped_word": "skipped after that",
    },
    "es": {
        "name": "Español",
        "whisper_code": "es",
        "ready": "Hey Term listo.",
        "listening_prompt": "¿Sí?",
        "not_caught": "No entendí eso.",
        "canceled": "Cancelado.",
        "ask_confirm": "Di confirmar para ejecutarlo, o cancelar.",
        "unclear_cancel": "No entendí un sí o no claro, así que voy a cancelar esto. Pídemelo de nuevo si todavía lo quieres.",
        "requires_typed": "Esto incluye algo de mi lista de no-ejecutar-por-voz, así que necesito que escribas CONFIRM para continuar.",
        "typed_confirm_prompt": "Escribe CONFIRM (en mayúsculas) para ejecutar estos comandos, o presiona Enter para cancelar: ",
        "stopping": "Deteniendo. Di la palabra de activación cuando quieras.",
        "agent_error": "Algo salió mal al preguntarle a Claude cómo hacer eso. Revisa la terminal para más detalles.",
        "yes_words": {"confirmar", "confirmado", "sí", "si", "vale", "dale", "adelante", "hazlo", "procede"},
        "no_words": {"cancelar", "cancelado", "no", "para", "detente", "aborta", "olvídalo", "olvidalo"},
        "stop_phrases": {"deja de escuchar", "apágate", "apagate", "adiós", "adios"},
        "command_singular": "comando",
        "command_plural": "comandos",
        "done_prefix": "Listo.",
        "ran_successfully": "se ejecutaron correctamente.",
        "stopped_prefix": "Se detuvo a mitad de camino:",
        "failed_word": "fallaron",
        "skipped_word": "se omitieron después",
    },
    "fr": {
        "name": "Français",
        "whisper_code": "fr",
        "ready": "Hey Term est prêt.",
        "listening_prompt": "Oui ?",
        "not_caught": "Je n'ai pas compris.",
        "canceled": "Annulé.",
        "ask_confirm": "Dis confirmer pour l'exécuter, ou annuler.",
        "unclear_cancel": "Je n'ai pas entendu un oui ou un non clair, donc j'annule celui-ci. Redemande si tu le veux toujours.",
        "requires_typed": "Ceci inclut quelque chose sur ma liste à ne pas exécuter par la voix, donc j'ai besoin que tu tapes CONFIRM pour continuer.",
        "typed_confirm_prompt": "Tape CONFIRM (en majuscules) pour exécuter ces commandes, ou appuie sur Entrée pour annuler : ",
        "stopping": "Arrêt. Dis le mot d'activation quand tu veux.",
        "agent_error": "Un problème est survenu en demandant à Claude comment faire cela. Vérifie le terminal pour plus de détails.",
        "yes_words": {"confirmer", "confirmé", "oui", "ouais", "vas-y", "fais-le", "d'accord", "daccord", "procède"},
        "no_words": {"annuler", "annulé", "non", "arrête", "arrete", "stop", "laisse tomber"},
        "stop_phrases": {"arrête d'écouter", "arrete d'ecouter", "éteins-toi", "eteins-toi", "au revoir"},
        "command_singular": "commande",
        "command_plural": "commandes",
        "done_prefix": "Terminé.",
        "ran_successfully": "exécutée(s) avec succès.",
        "stopped_prefix": "Arrêté en cours de route :",
        "failed_word": "ont échoué",
        "skipped_word": "ont été ignorées ensuite",
    },
    "de": {
        "name": "Deutsch",
        "whisper_code": "de",
        "ready": "Hey Term ist bereit.",
        "listening_prompt": "Ja?",
        "not_caught": "Das habe ich nicht verstanden.",
        "canceled": "Abgebrochen.",
        "ask_confirm": "Sag bestätigen, um es auszuführen, oder abbrechen.",
        "unclear_cancel": "Ich habe kein klares Ja oder Nein gehört, also breche ich das hier ab. Frag einfach nochmal, wenn du es noch willst.",
        "requires_typed": "Das enthält etwas von meiner Nicht-per-Sprache-ausführen-Liste, also musst du CONFIRM eintippen, um fortzufahren.",
        "typed_confirm_prompt": "Tippe CONFIRM (großgeschrieben) ein, um diese Befehle auszuführen, oder drücke Enter zum Abbrechen: ",
        "stopping": "Stoppe. Sag jederzeit das Aktivierungswort.",
        "agent_error": "Beim Fragen von Claude ist etwas schiefgelaufen. Details im Terminal.",
        "yes_words": {"bestätigen", "bestatigen", "bestätigt", "ja", "klar", "mach es", "los", "weiter"},
        "no_words": {"abbrechen", "abgebrochen", "nein", "stopp", "stop", "halt", "vergiss es"},
        "stop_phrases": {"hör auf zu hören", "hoer auf zu hoeren", "schalt dich ab", "tschüss", "tschuss"},
        "command_singular": "Befehl",
        "command_plural": "Befehle",
        "done_prefix": "Fertig.",
        "ran_successfully": "erfolgreich ausgeführt.",
        "stopped_prefix": "Auf halbem Weg gestoppt:",
        "failed_word": "fehlgeschlagen",
        "skipped_word": "danach übersprungen",
    },
    "pt": {
        "name": "Português",
        "whisper_code": "pt",
        "ready": "Hey Term pronto.",
        "listening_prompt": "Sim?",
        "not_caught": "Não entendi isso.",
        "canceled": "Cancelado.",
        "ask_confirm": "Diga confirmar para executar, ou cancelar.",
        "unclear_cancel": "Não ouvi um sim ou não claro, então vou cancelar isso. Só pedir de novo se ainda quiser.",
        "requires_typed": "Isso inclui algo da minha lista de não-executar-por-voz, então preciso que você digite CONFIRM para continuar.",
        "typed_confirm_prompt": "Digite CONFIRM (em maiúsculas) para executar esses comandos, ou pressione Enter para cancelar: ",
        "stopping": "Parando. Diga a palavra de ativação quando quiser.",
        "agent_error": "Algo deu errado ao perguntar ao Claude como fazer isso. Veja o terminal para detalhes.",
        "yes_words": {"confirmar", "confirmado", "sim", "vai", "pode", "faça", "faz", "prossiga"},
        "no_words": {"cancelar", "cancelado", "não", "nao", "pare", "para", "esquece"},
        "stop_phrases": {"pare de ouvir", "desliga", "tchau"},
        "command_singular": "comando",
        "command_plural": "comandos",
        "done_prefix": "Pronto.",
        "ran_successfully": "executado(s) com sucesso.",
        "stopped_prefix": "Parou no meio do caminho:",
        "failed_word": "falharam",
        "skipped_word": "foram ignorados depois disso",
    },
    "it": {
        "name": "Italiano",
        "whisper_code": "it",
        "ready": "Hey Term pronto.",
        "listening_prompt": "Sì?",
        "not_caught": "Non ho capito.",
        "canceled": "Annullato.",
        "ask_confirm": "Di' conferma per eseguirlo, o annulla.",
        "unclear_cancel": "Non ho sentito un sì o no chiaro, quindi annullo questo. Chiedimelo di nuovo se lo vuoi ancora.",
        "requires_typed": "Questo include qualcosa nella mia lista di non-eseguire-a-voce, quindi devi digitare CONFIRM per procedere.",
        "typed_confirm_prompt": "Digita CONFIRM (in maiuscolo) per eseguire questi comandi, o premi Invio per annullare: ",
        "stopping": "Mi fermo. Di' la parola di attivazione quando vuoi.",
        "agent_error": "Qualcosa è andato storto chiedendo a Claude come farlo. Controlla il terminale per i dettagli.",
        "yes_words": {"conferma", "confermato", "sì", "si", "vai", "fallo", "procedi", "certo"},
        "no_words": {"annulla", "annullato", "no", "ferma", "fermati", "stop", "lascia perdere"},
        "stop_phrases": {"smetti di ascoltare", "spegniti", "ciao"},
        "command_singular": "comando",
        "command_plural": "comandi",
        "done_prefix": "Fatto.",
        "ran_successfully": "eseguiti con successo.",
        "stopped_prefix": "Fermato a metà:",
        "failed_word": "falliti",
        "skipped_word": "saltati dopo",
    },
}


def get(language: str) -> dict:
    """Returns the string table for \`language\`, falling back to English for
    an unknown or untranslated code so the tool never breaks -- it just
    speaks English prompts while still planning/running the request in
    whatever language the person actually spoke.
    """
    return LANGUAGES.get(language, LANGUAGES[DEFAULT_LANGUAGE])


def is_translated(language: str) -> bool:
    return language in LANGUAGES


def list_languages() -> list:
    return sorted(LANGUAGES.keys())
`,
  },
  {
    path: "lib/safety.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Pattern-based check for commands dangerous enough to need typed, not
spoken, confirmation.

Speech-to-text makes mistakes, and "confirm" said in a noisy room can get
misheard on either end. That's an acceptable risk for "list files" or
"install this package" -- it's not an acceptable risk for something that can
wipe a disk. Anything matching here always falls back to requiring the exact
word CONFIRM typed on the keyboard, no matter what was heard.
"""
from .config import DANGEROUS_PATTERNS


def is_dangerous(command: str) -> bool:
    lowered = command.lower()
    return any(pattern in lowered for pattern in DANGEROUS_PATTERNS)


def dangerous_commands(commands: list) -> list:
    return [c for c in commands if is_dangerous(c)]
`,
  },
  {
    path: "lib/speak.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Text-to-speech via pyttsx3 (offline, cross-platform: SAPI5 on Windows,
espeak on Linux, NSSpeechSynthesizer on macOS). Also prints everything it
says, so the terminal itself is a full transcript even with sound off.

Which languages actually get a real spoken voice (rather than an English
voice reading foreign text with an accent) depends entirely on which voices
are installed on the OS -- Windows Narrator languages, or \`espeak-ng\` on
Linux with the right language packs. This picks a matching installed voice
when one exists and falls back to whatever the default voice is otherwise;
it never fails the whole request over a missing voice.
"""
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
    try:
        _select_voice(language)
        engine = _get_engine()
        engine.say(text)
        engine.runAndWait()
    except Exception as err:  # pragma: no cover - depends on local audio setup
        print(f"[Hey Term] (speech output unavailable: {err})")
`,
  },
  {
    path: "lib/speech_windows.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Speech-to-text via Windows' own built-in speech recognizer -- the same
engine behind Win+H voice typing and Windows Speech Recognition -- instead of
the offline Whisper model in lib/transcribe.py.

Why this exists: Whisper's "base"/"small" models can mishear ordinary speech
that Windows' own dictation gets right, because Windows' modern voice-typing
engine is cloud-assisted by default (falling back to a smaller on-device
model only when offline or when "Online speech recognition" is turned off in
Settings > Privacy & security > Speech). Routing through it gets Hey Term
closer to Win+H-level accuracy on Windows without a bigger Whisper download.

This module is imported lazily and every call is defensive: anything that
isn't actually a working Windows install with the WinRT speech APIs
available should fail in a way lib/config.py's SPEECH_BACKEND="auto" can
catch and fall back to Whisper for, not crash the app.

Architecture note: unlike lib/transcribe.py (which transcribes an
already-recorded numpy clip), the Windows speech recognizer captures audio
itself, directly from the system default microphone, and does its own
silence/end-of-speech detection -- there's no separate "record, then
transcribe" step. recognize_once() below does capture-and-transcribe in one
call. main.py branches on config.SPEECH_BACKEND to call either this or the
record-then-transcribe pair used for Whisper.
"""
import sys

_availability_checked = False
_available = False
_unavailable_reason = ""


def is_available() -> bool:
    """True if the Windows speech recognizer can plausibly be used: running
    on Windows itself, and the winsdk (WinRT projection) package is
    importable. Cached after the first call -- this touches the Windows
    Runtime, not worth repeating every wake-loop iteration."""
    global _availability_checked, _available, _unavailable_reason
    if _availability_checked:
        return _available
    _availability_checked = True

    if sys.platform != "win32":
        _unavailable_reason = "not running on Windows"
        _available = False
        return False

    try:
        import winsdk.windows.media.speechrecognition  # noqa: F401
    except ImportError:
        _unavailable_reason = (
            "the 'winsdk' package isn't installed (pip install winsdk) -- "
            "it ships with requirements.txt on Windows, so this usually "
            "means the install ran on a non-Windows shell/venv"
        )
        _available = False
        return False

    _available = True
    return True


def unavailable_reason() -> str:
    """Human-readable reason is_available() returned False, for the one-time
    startup message. Empty string if is_available() hasn't been called yet
    or returned True."""
    return _unavailable_reason


def recognize_once(timeout_seconds: float = None) -> str:
    """Listens on the system default microphone using Windows' own speech
    recognizer and returns the recognized text (possibly "" if nothing was
    understood, same contract as lib/transcribe.py's functions). Raises
    RuntimeError if the Windows speech engine isn't available or the
    recognition call itself fails -- callers (main.py) catch that and fall
    back to the Whisper path for that turn rather than crashing the app.

    \`timeout_seconds\`, when given, bounds how long this waits for speech to
    start before giving up and returning "" -- used for the short wake-word
    listening chunks so a silent room doesn't block the loop indefinitely.
    Command listening (take_command) omits it and waits for real speech.
    """
    if not is_available():
        raise RuntimeError(
            f"Windows speech recognizer unavailable: {unavailable_reason() or 'unknown reason'}"
        )

    import asyncio

    from winsdk.windows.media.speechrecognition import (
        SpeechContinuousRecognitionSession,
        SpeechRecognizer,
    )

    async def _run():
        recognizer = SpeechRecognizer()
        await recognizer.compile_constraints_async()

        if timeout_seconds is not None:
            # Timeouts on the recognizer's own topic/silence detectors --
            # this is what lets a wake-word chunk give up quickly on silence
            # instead of hanging, without us doing our own RMS gating (the
            # Windows engine already does its own voice-activity detection).
            ms = int(timeout_seconds * 1000)
            recognizer.timeouts.initial_silence_timeout.duration = ms
            recognizer.timeouts.end_silence_timeout.duration = ms

        result = await recognizer.recognize_async()
        return (result.text or "").strip() if result is not None else ""

    try:
        return asyncio.run(_run())
    except Exception as err:  # noqa: BLE001 -- deliberately broad: any WinRT/
        # COM failure here (mic in use, no default device, permission denied,
        # engine not installed for the current language, etc.) should read as
        # "this backend failed for this turn," not crash the whole app.
        raise RuntimeError(f"Windows speech recognition failed: {err}") from err
`,
  },
  {
    path: "lib/transcribe.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
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

# "Initial prompt" text handed to Whisper as decoding context -- it nudges
# ambiguous audio toward these words without forcing them or touching the
# model's actual weights. This is NOT voice training (Whisper's acoustic
# model is never retrained or adapted to a specific speaker); it's closer to
# how predictive text nudges toward likely words when a signal is unclear.
# Kept short and generic on purpose: a long list of every possible command
# dilutes the effect instead of sharpening it -- this only needs to tip
# close calls on common terminal vocabulary, not dictate an exact grammar.
COMMAND_VOCAB_PROMPT = (
    "list files, create folder, delete file, current directory, git status, "
    "run script, install package, show contents, remove folder, move file, "
    "copy file, python, node, npm, git, docker, ls, cd, mkdir, rm"
)

# Biases the wake-listening chunk toward the product's own name, since a
# short 2-3 syllable phrase is exactly where Whisper is most likely to lock
# onto a similar-sounding word instead ("Hey Tom", "Hey Tarp").
WAKE_VOCAB_PROMPT = "Hey Term"


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type="int8")
    return _model


def _transcribe(audio, language, initial_prompt=None):
    import numpy as np

    if audio is None or len(audio) == 0:
        return ""
    model = _get_model()
    segments, _info = model.transcribe(
        np.asarray(audio, dtype="float32"),
        language=language,
        vad_filter=True,
        initial_prompt=initial_prompt,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()


def transcribe(audio, language: str = "en") -> str:
    """Transcribes a command/confirmation clip. \`language\` is a Whisper
    language code ("en", "es", ...), or "auto" to let Whisper detect it from
    the audio itself (a little slower and occasionally wrong on a very short
    clip, but useful when more than one person/language uses the same
    installation). Only uses COMMAND_VOCAB_PROMPT for English -- the prompt
    is English terminal vocabulary, and handing it to Whisper while decoding
    a different language would bias it toward the wrong language entirely.
    """
    prompt = COMMAND_VOCAB_PROMPT if language in ("en", "auto") else None
    return _transcribe(audio, None if language == "auto" else language, initial_prompt=prompt)


def transcribe_wake(audio) -> str:
    """Transcribes a wake-word listening chunk. Always forced to English,
    regardless of the configured LANGUAGE -- "Hey Term" is the product's
    name, said the same way in any language (like "Hey Siri"), and Whisper
    decodes that short phrase far more reliably as English than if it's left
    to guess the audio is some other language first. See lib/i18n.py's
    module docstring for the full reasoning.
    """
    return _transcribe(audio, "en", initial_prompt=WAKE_VOCAB_PROMPT)
`,
  },
  {
    path: "lib/wake.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
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
    return re.sub(r"\\s+", " ", text).strip()


def heard_wake_word(transcript: str, wake_word: str = None, threshold: float = None) -> bool:
    """True if \`transcript\` contains (or closely matches) the wake phrase.
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
`,
  },
  {
    path: "test/__init__.py",
    contents: ``,
  },
  {
    path: "test/run.py",
    contents: `#!/usr/bin/env python3
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Runs every test module in this folder and prints a pass/fail count.
Only exercises pure logic (planning parsing, safety patterns, wake-word
matching, confirmation parsing, the command executor against real \`echo\`/
\`exit\` calls) -- nothing here touches a microphone, speaker, or the network,
so it runs the same in this sandbox as on a real machine.
"""
import sys
import unittest


def main() -> int:
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=".", pattern="test_*.py")
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
`,
  },
  {
    path: "test/test_agent.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest
from unittest import mock

from lib.agent import SYSTEM_PROMPT, AgentError, _shell_name, parse_plan


class TestParsePlan(unittest.TestCase):
    def test_valid_summary_and_commands(self):
        result = parse_plan('{"summary": "Lists the current folder.", "commands": ["ls -la"]}')
        self.assertEqual(result, {"summary": "Lists the current folder.", "commands": ["ls -la"]})

    def test_valid_clarify(self):
        result = parse_plan('{"clarify": "Which file do you mean?"}')
        self.assertEqual(result, {"clarify": "Which file do you mean?"})

    def test_strips_markdown_code_fence(self):
        text = '\`\`\`json\\n{"summary": "ok", "commands": ["echo hi"]}\\n\`\`\`'
        result = parse_plan(text)
        self.assertEqual(result["commands"], ["echo hi"])

    def test_multiple_commands_preserved_in_order(self):
        result = parse_plan('{"summary": "two steps", "commands": ["mkdir foo", "cd foo"]}')
        self.assertEqual(result["commands"], ["mkdir foo", "cd foo"])

    def test_rejects_non_json(self):
        with self.assertRaises(AgentError):
            parse_plan("sure, I'll run ls for you")

    def test_rejects_empty_commands_list(self):
        with self.assertRaises(AgentError):
            parse_plan('{"summary": "ok", "commands": []}')

    def test_rejects_missing_summary(self):
        with self.assertRaises(AgentError):
            parse_plan('{"commands": ["ls"]}')

    def test_rejects_non_string_command(self):
        with self.assertRaises(AgentError):
            parse_plan('{"summary": "ok", "commands": [123]}')

    def test_rejects_empty_clarify(self):
        with self.assertRaises(AgentError):
            parse_plan('{"clarify": "  "}')

    def test_rejects_object_that_is_neither_shape(self):
        with self.assertRaises(AgentError):
            parse_plan('{"foo": "bar"}')

    def test_rejects_json_array_instead_of_object(self):
        with self.assertRaises(AgentError):
            parse_plan('["ls", "-la"]')


class TestShellSelection(unittest.TestCase):
    def test_shell_name_bash_on_posix(self):
        with mock.patch("lib.agent.is_windows", return_value=False):
            self.assertEqual(_shell_name(), "bash")

    def test_shell_name_powershell_on_windows(self):
        with mock.patch("lib.agent.is_windows", return_value=True):
            self.assertEqual(_shell_name(), "PowerShell")


class TestSystemPromptFormatting(unittest.TestCase):
    def test_formats_with_language_name_and_shell(self):
        rendered = SYSTEM_PROMPT.format(shell="bash", os_name="Linux", language_name="Español")
        self.assertIn("Español", rendered)
        self.assertIn("bash", rendered)
        self.assertIn("Hey Term", rendered)
        self.assertIn("MultiNiche AI", rendered)


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_audio.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Only lib.audio.rms() is tested here -- everything else in that module
needs a real microphone/portaudio. rms() is plain math over a numpy array,
so it's fully testable without audio hardware, same as the rest of this
suite."""
import unittest

import numpy as np

from lib.audio import rms


class TestRms(unittest.TestCase):
    def test_silence_is_zero(self):
        self.assertEqual(rms(np.zeros(1000, dtype="float32")), 0.0)

    def test_empty_clip_is_zero(self):
        self.assertEqual(rms(np.zeros(0, dtype="float32")), 0.0)

    def test_none_is_zero(self):
        self.assertEqual(rms(None), 0.0)

    def test_constant_amplitude_matches_its_own_magnitude(self):
        # RMS of a constant-value signal equals the absolute value of that
        # constant -- the simplest case to hand-verify.
        clip = np.full(1000, 0.5, dtype="float32")
        self.assertAlmostEqual(rms(clip), 0.5, places=5)

    def test_louder_clip_has_higher_rms_than_quieter_one(self):
        quiet = np.full(1000, 0.01, dtype="float32")
        loud = np.full(1000, 0.3, dtype="float32")
        self.assertLess(rms(quiet), rms(loud))


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_audit.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import os
import tempfile
import unittest

from lib import audit, config


class TestAudit(unittest.TestCase):
    def setUp(self):
        self._orig_path = config.AUDIT_LOG_PATH
        self._tmpdir = tempfile.TemporaryDirectory()
        config.AUDIT_LOG_PATH = os.path.join(self._tmpdir.name, "audit.jsonl")

    def tearDown(self):
        config.AUDIT_LOG_PATH = self._orig_path
        self._tmpdir.cleanup()

    def test_log_event_appends_a_json_line(self):
        audit.log_event("test_event", foo="bar")
        events = audit.read_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["kind"], "test_event")
        self.assertEqual(events[0]["foo"], "bar")

    def test_multiple_events_append_in_order(self):
        audit.log_event("first")
        audit.log_event("second")
        events = audit.read_events()
        self.assertEqual([e["kind"] for e in events], ["first", "second"])

    def test_every_event_has_a_timestamp(self):
        audit.log_event("timed")
        events = audit.read_events()
        self.assertIn("ts", events[0])
        self.assertIn("iso", events[0])

    def test_read_events_on_missing_file_returns_empty_list(self):
        config.AUDIT_LOG_PATH = os.path.join(self._tmpdir.name, "does-not-exist.jsonl")
        self.assertEqual(audit.read_events(), [])

    def test_read_events_skips_a_corrupted_line_without_crashing(self):
        with open(config.AUDIT_LOG_PATH, "w", encoding="utf-8") as f:
            f.write("not valid json\\n")
            f.write('{"kind": "ok_line"}\\n')
        events = audit.read_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["kind"], "ok_line")


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_confirm.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.confirm import parse_confirmation


class TestParseConfirmation(unittest.TestCase):
    def test_confirm_word(self):
        self.assertEqual(parse_confirmation("confirm"), "confirm")

    def test_yes_variants(self):
        for word in ["yes", "yeah", "yep", "sure"]:
            self.assertEqual(parse_confirmation(word), "confirm")

    def test_go_ahead_phrase(self):
        self.assertEqual(parse_confirmation("go ahead"), "confirm")

    def test_cancel_word(self):
        self.assertEqual(parse_confirmation("cancel"), "cancel")

    def test_no_variants(self):
        for word in ["no", "nope", "stop", "abort"]:
            self.assertEqual(parse_confirmation(word), "cancel")

    def test_never_mind_phrase(self):
        self.assertEqual(parse_confirmation("never mind"), "cancel")

    def test_empty_is_unclear(self):
        self.assertEqual(parse_confirmation(""), "unclear")

    def test_silence_transcript_is_unclear(self):
        self.assertEqual(parse_confirmation("   "), "unclear")

    def test_unrelated_speech_is_unclear(self):
        self.assertEqual(parse_confirmation("what's for dinner"), "unclear")

    def test_conflicting_words_is_unclear(self):
        self.assertEqual(parse_confirmation("yes no wait"), "unclear")

    def test_case_insensitive(self):
        self.assertEqual(parse_confirmation("CONFIRM"), "confirm")


class TestParseConfirmationOtherLanguages(unittest.TestCase):
    def test_spanish_confirm(self):
        self.assertEqual(parse_confirmation("sí", language="es"), "confirm")
        self.assertEqual(parse_confirmation("confirmar", language="es"), "confirm")

    def test_spanish_cancel(self):
        self.assertEqual(parse_confirmation("no", language="es"), "cancel")
        self.assertEqual(parse_confirmation("cancelar", language="es"), "cancel")

    def test_spanish_accented_word_matches(self):
        # Whisper commonly returns the accented form for "sí" -- confirm the
        # normalizer keeps accented letters intact rather than mangling them.
        self.assertEqual(parse_confirmation("Sí, confirmar", language="es"), "confirm")

    def test_french_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("oui", language="fr"), "confirm")
        self.assertEqual(parse_confirmation("annuler", language="fr"), "cancel")

    def test_german_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("ja", language="de"), "confirm")
        self.assertEqual(parse_confirmation("nein", language="de"), "cancel")

    def test_portuguese_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("sim", language="pt"), "confirm")
        self.assertEqual(parse_confirmation("cancelar", language="pt"), "cancel")

    def test_italian_confirm_and_cancel(self):
        self.assertEqual(parse_confirmation("sì", language="it"), "confirm")
        self.assertEqual(parse_confirmation("annulla", language="it"), "cancel")

    def test_unknown_language_falls_back_to_english(self):
        self.assertEqual(parse_confirmation("confirm", language="xx-not-real"), "confirm")

    def test_wrong_language_word_is_unclear_not_a_false_positive(self):
        # Spanish "sí" spoken while configured for French shouldn't accidentally
        # match French's word list and produce a false confirm.
        self.assertEqual(parse_confirmation("sí", language="fr"), "unclear")


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_executor.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import sys
import tempfile
import unittest
from unittest import mock

from lib.executor import _build_argv, run_commands


class TestRunCommands(unittest.TestCase):
    def test_single_successful_command_captures_stdout(self):
        report = run_commands(["echo hello-voice-terminal"])
        self.assertTrue(report.ok)
        self.assertEqual(len(report.results), 1)
        self.assertEqual(report.results[0].returncode, 0)
        self.assertIn("hello-voice-terminal", report.results[0].stdout)

    def test_stops_after_first_failure_and_skips_rest(self):
        report = run_commands(["exit 1", "echo should-not-run"])
        self.assertFalse(report.ok)
        self.assertEqual(report.results[0].returncode, 1)
        self.assertFalse(report.results[1].ran)

    def test_multiple_successful_commands_all_run(self):
        report = run_commands(["echo one", "echo two"])
        self.assertTrue(report.ok)
        self.assertEqual(len(report.results), 2)
        self.assertTrue(all(r.ran for r in report.results))

    def test_runs_in_specified_work_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            cmd = "cd ." if sys.platform != "win32" else "cd ."
            report = run_commands(["pwd" if sys.platform != "win32" else "cd"], work_dir=tmp)
            self.assertTrue(report.ok)

    def test_spoken_summary_all_ok(self):
        report = run_commands(["echo a", "echo b"])
        self.assertIn("2 commands ran successfully", report.spoken_summary())

    def test_spoken_summary_on_failure_mentions_skip(self):
        report = run_commands(["exit 1", "echo x"])
        summary = report.spoken_summary()
        self.assertIn("failed", summary)
        self.assertIn("skipped", summary)

    def test_spoken_summary_in_spanish(self):
        report = run_commands(["echo a"])
        summary = report.spoken_summary(language="es")
        self.assertIn("Listo.", summary)
        self.assertIn("comando", summary)

    @unittest.skipIf(sys.platform == "win32", "bash-only syntax test")
    def test_actually_runs_real_bash_not_posix_sh(self):
        # [[ ]] is a bash-only conditional -- it's a syntax error under dash,
        # which is /bin/sh on Debian/Kali. This is the regression test for
        # the fix: the agent is told the shell is bash and may emit bash-only
        # syntax, so the executor must actually invoke bash, not shell=True's
        # default interpreter.
        report = run_commands(['[[ "a" == "a" ]] && echo matched'])
        self.assertTrue(report.ok)
        self.assertIn("matched", report.results[0].stdout)

    @unittest.skipIf(sys.platform == "win32", "POSIX argv shape")
    def test_build_argv_uses_bash_on_posix(self):
        with mock.patch("lib.executor.is_windows", return_value=False):
            argv = _build_argv("echo hi")
        self.assertTrue(argv[0].endswith("bash") or argv[0].endswith("sh"))
        self.assertEqual(argv[-2:], ["-c", "echo hi"])

    def test_build_argv_uses_powershell_on_windows(self):
        with mock.patch("lib.executor.is_windows", return_value=True), \\
             mock.patch("lib.executor.shutil.which", return_value="powershell.exe"):
            argv = _build_argv("Get-ChildItem")
        self.assertIn("powershell.exe", argv[0])
        self.assertIn("-Command", argv)
        self.assertEqual(argv[-1], "Get-ChildItem")


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_i18n.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.i18n import DEFAULT_LANGUAGE, get, is_translated, list_languages


class TestI18n(unittest.TestCase):
    def test_default_language_is_english(self):
        self.assertEqual(DEFAULT_LANGUAGE, "en")

    def test_get_known_language_returns_its_own_strings(self):
        strings = get("es")
        self.assertEqual(strings["name"], "Español")

    def test_get_unknown_language_falls_back_to_english(self):
        strings = get("xx-not-real")
        self.assertEqual(strings["name"], "English")

    def test_is_translated_true_for_known_language(self):
        self.assertTrue(is_translated("fr"))

    def test_is_translated_false_for_unknown_language(self):
        self.assertFalse(is_translated("xx-not-real"))

    def test_list_languages_includes_all_shipped_translations(self):
        langs = list_languages()
        for expected in ["en", "es", "fr", "de", "pt", "it"]:
            self.assertIn(expected, langs)

    def test_every_language_has_the_same_string_keys_as_english(self):
        english_keys = set(get("en").keys())
        for code in list_languages():
            with self.subTest(language=code):
                self.assertEqual(set(get(code).keys()), english_keys, f"{code} is missing or has extra keys vs. en")

    def test_every_language_has_nonempty_yes_and_no_word_lists(self):
        for code in list_languages():
            with self.subTest(language=code):
                strings = get(code)
                self.assertTrue(strings["yes_words"])
                self.assertTrue(strings["no_words"])
                # A word can't mean both yes and no in the same language --
                # that would make every reply in that word ambiguous.
                self.assertEqual(strings["yes_words"] & strings["no_words"], set())


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_safety.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.safety import dangerous_commands, is_dangerous


class TestSafety(unittest.TestCase):
    def test_catches_rm_rf_root(self):
        self.assertTrue(is_dangerous("sudo rm -rf /"))

    def test_catches_case_insensitively(self):
        self.assertTrue(is_dangerous("Format C:"))

    def test_catches_fork_bomb(self):
        self.assertTrue(is_dangerous(":(){ :|:& };:"))

    def test_catches_force_push(self):
        self.assertTrue(is_dangerous("git push --force origin main"))

    def test_allows_benign_command(self):
        self.assertFalse(is_dangerous("ls -la"))

    def test_allows_benign_rm_of_specific_file(self):
        self.assertFalse(is_dangerous("rm notes.txt"))

    def test_dangerous_commands_filters_a_list(self):
        cmds = ["ls -la", "rm -rf /", "echo hi"]
        self.assertEqual(dangerous_commands(cmds), ["rm -rf /"])

    def test_dangerous_commands_empty_when_none_match(self):
        self.assertEqual(dangerous_commands(["ls", "pwd"]), [])


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_speech_backend.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Tests for main.py's backend-selection logic and lib/speech_windows.py's
availability check. What's NOT tested here: actually calling
speech_windows.recognize_once() -- that talks to the real Windows Runtime
and a live microphone, so it has no meaningful behavior to unit-test on a
machine that isn't Windows (or, for that matter, on one that is -- it's
exercised by hand per README.md, same as the rest of the audio path)."""
import unittest

from lib import speech_windows
from main import _backend_for_language, resolve_speech_backend


class TestIsAvailable(unittest.TestCase):
    def test_not_available_on_non_windows_platform(self):
        # This suite always runs on Linux/macOS CI, never Windows, so this
        # is really asserting "the platform check works," not "Windows
        # itself lacks the engine."
        import sys

        if sys.platform == "win32":
            self.skipTest("only meaningful off Windows")
        self.assertFalse(speech_windows.is_available())
        self.assertIn("Windows", speech_windows.unavailable_reason())


class TestResolveSpeechBackend(unittest.TestCase):
    def test_whisper_requested_stays_whisper_even_if_windows_available(self):
        self.assertEqual(resolve_speech_backend("whisper"), "whisper")

    def test_windows_requested_raises_when_unavailable(self):
        import sys

        if sys.platform == "win32":
            self.skipTest("only meaningful off Windows")
        with self.assertRaises(ValueError):
            resolve_speech_backend("windows")

    def test_auto_falls_back_to_whisper_when_windows_unavailable(self):
        import sys

        if sys.platform == "win32":
            self.skipTest("only meaningful off Windows")
        self.assertEqual(resolve_speech_backend("auto"), "whisper")


class TestBackendForLanguage(unittest.TestCase):
    def test_windows_backend_kept_for_english(self):
        self.assertEqual(_backend_for_language("windows", "en"), "windows")

    def test_windows_backend_kept_for_auto(self):
        self.assertEqual(_backend_for_language("windows", "auto"), "windows")

    def test_windows_backend_falls_back_to_whisper_for_other_languages(self):
        self.assertEqual(_backend_for_language("windows", "es"), "whisper")

    def test_whisper_backend_is_unaffected_by_language(self):
        self.assertEqual(_backend_for_language("whisper", "es"), "whisper")


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_wake.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

from lib.wake import heard_wake_word


class TestWakeWord(unittest.TestCase):
    def test_exact_match(self):
        self.assertTrue(heard_wake_word("hey terminal", wake_word="hey terminal"))

    def test_match_with_punctuation_and_case(self):
        self.assertTrue(heard_wake_word("Hey, Terminal!", wake_word="hey terminal"))

    def test_match_embedded_in_longer_utterance(self):
        self.assertTrue(heard_wake_word("okay hey terminal what time is it", wake_word="hey terminal"))

    def test_near_miss_stt_error_still_matches(self):
        # A plausible whisper mis-transcription of "hey terminal".
        self.assertTrue(heard_wake_word("hey term no", wake_word="hey terminal"))

    def test_unrelated_speech_does_not_match(self):
        self.assertFalse(heard_wake_word("what's the weather like today", wake_word="hey terminal"))

    def test_empty_transcript_does_not_match(self):
        self.assertFalse(heard_wake_word("", wake_word="hey terminal"))

    def test_silence_transcript_does_not_match(self):
        self.assertFalse(heard_wake_word("   ", wake_word="hey terminal"))

    def test_respects_custom_wake_word(self):
        self.assertTrue(heard_wake_word("computer run the tests", wake_word="computer"))
        self.assertFalse(heard_wake_word("hey terminal", wake_word="computer"))


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "scripts/setup-linux.sh",
    contents: `#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Linux (Kali, Debian/Ubuntu-based, WSL).
# Installs system audio deps + best-effort voice packs, installs Python
# deps, bootstraps .env, and pre-downloads the Whisper model.
#
# Usage:
#   ./scripts/setup-linux.sh                    # English only, asks before installing
#   ./scripts/setup-linux.sh --langs es,fr,de    # also try to install voice packs for these
#   ./scripts/setup-linux.sh --yes               # don't prompt before system package installs
#   ./scripts/setup-linux.sh --dry-run           # print what it would do, change nothing
#   sudo ./scripts/setup-linux.sh --langs es     # (needed unless already root, e.g. some containers)
set -euo pipefail

LANGS="en"
ASSUME_YES=0
DRY_RUN=0

usage() {
  echo "Usage: $0 [--langs es,fr,de,pt,it] [--yes] [--dry-run]"
  echo "  --langs   Comma-separated language codes to also install voice packs for."
  echo "            Supported by Hey Term's translated prompts: en es fr de pt it."
  echo "  --yes     Don't prompt before running apt (implied inside CI/non-interactive shells)."
  echo "  --dry-run Print what would happen; run nothing that changes the system."
  exit "\${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --langs) LANGS="$2"; shift 2 ;;
    --langs=*) LANGS="\${1#*=}"; shift ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

confirm_or_exit() {
  if [ "$ASSUME_YES" = "1" ] || [ "$DRY_RUN" = "1" ] || [ ! -t 0 ]; then
    return 0
  fi
  read -r -p "$1 [y/N] " reply
  case "$reply" in
    [yY]|[yY][eE][sS]) return 0 ;;
    *) echo "Skipped."; return 1 ;;
  esac
}

SUDO=""
if [ "$(id -u)" != "0" ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "Not running as root and no sudo found -- system package installs will be skipped." >&2
  fi
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script is for Debian/Ubuntu/Kali-family systems (needs apt-get)."
  echo "On another distro, install manually: portaudio (dev headers), bash, espeak-ng, then continue at 'pip install' below."
  exit 1
fi

echo "== Hey Term Linux setup =="
echo "Languages requested: $LANGS"
echo

# --- 1. Core system audio dependencies ---------------------------------
CORE_PACKAGES="portaudio19-dev bash espeak-ng"
if confirm_or_exit "Install core packages ($CORE_PACKAGES) via apt?"; then
  run \${SUDO} apt-get update -qq
  run \${SUDO} apt-get install -y $CORE_PACKAGES
fi

# --- 2. Best-effort mbrola voice packs for requested languages ---------
# mbrola voice package names aren't uniform across languages (mbrola-en1,
# mbrola-us2, mbrola-es1, mbrola-fr4, ...), so rather than hardcoding names
# that might not exist on this apt mirror or might be wrong for a given
# Debian/Ubuntu release, this searches apt-cache for whatever actually
# exists that starts with the language's mbrola prefix and installs those.
# espeak-ng (installed above) already covers every language on its own --
# this is purely a quality upgrade where it's available.
declare -A MBROLA_PREFIX=(
  [en]="mbrola-en mbrola-us mbrola-gb"
  [es]="mbrola-es"
  [fr]="mbrola-fr"
  [de]="mbrola-de"
  [pt]="mbrola-pt mbrola-br"
  [it]="mbrola-it"
)

IFS=',' read -ra LANG_ARR <<< "$LANGS"
FOUND_ANY_MBROLA=0
MBROLA_TO_INSTALL=()
for lang in "\${LANG_ARR[@]}"; do
  lang="$(echo "$lang" | tr -d '[:space:]')"
  prefixes="\${MBROLA_PREFIX[$lang]:-}"
  [ -z "$prefixes" ] && continue
  for prefix in $prefixes; do
    matches=$(apt-cache search --names-only "^\${prefix}" 2>/dev/null | awk '{print $1}' || true)
    if [ -n "$matches" ]; then
      FOUND_ANY_MBROLA=1
      while IFS= read -r pkg; do
        MBROLA_TO_INSTALL+=("$pkg")
      done <<< "$matches"
    fi
  done
done

if [ "$FOUND_ANY_MBROLA" = "1" ]; then
  echo "Found mbrola voice packages for your requested languages:"
  printf '  %s\\n' "\${MBROLA_TO_INSTALL[@]}"
  if confirm_or_exit "Install these mbrola voice packages (better quality than plain espeak-ng)?"; then
    run \${SUDO} apt-get install -y "\${MBROLA_TO_INSTALL[@]}"
  fi
else
  echo "No mbrola voice packages found on this apt mirror for: $LANGS"
  echo "espeak-ng (already installed above) still covers these languages -- just more robotic-sounding."
fi
echo

# --- 3. Python dependencies ---------------------------------------------
echo "Installing Python dependencies..."
PIP_ARGS=""
if python3 -c "import sys; sys.exit(0 if sys.prefix != sys.base_prefix else 1)" 2>/dev/null; then
  echo "(virtual environment detected -- installing into it)"
else
  echo "(no virtual environment detected -- installing with --break-system-packages)"
  PIP_ARGS="--break-system-packages"
fi
run python3 -m pip install -q $PIP_ARGS -r "$(dirname "$0")/../requirements.txt"

# --- 4. .env bootstrap ---------------------------------------------------
ENV_DIR="$(dirname "$0")/.."
if [ ! -f "$ENV_DIR/.env" ]; then
  run cp "$ENV_DIR/.env.example" "$ENV_DIR/.env"
  echo "Created .env -- edit it and add your ANTHROPIC_API_KEY before running Hey Term."
else
  echo ".env already exists -- leaving it alone."
fi

# --- 5. Pre-download the Whisper model -----------------------------------
if [ "$DRY_RUN" = "0" ]; then
  echo "Pre-downloading the Whisper speech-to-text model (one-time, ~150MB)..."
  python3 -c "from faster_whisper import WhisperModel; WhisperModel('base')" || \\
    echo "Model pre-download failed or was skipped -- it will just download on first run instead."
else
  echo "[dry-run] would pre-download the Whisper model"
fi

echo
echo "Done. Next steps:"
echo "  1. Edit .env and set ANTHROPIC_API_KEY."
echo "  2. Run: python3 main.py --lang en   (or --lang es / fr / de / pt / it)"
`,
  },
  {
    path: "scripts/setup-windows.ps1",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Windows.
# Installs Python deps, bootstraps .env, pre-downloads the Whisper model,
# and makes a best-effort attempt to install Windows Speech (SAPI5) language
# packs for the languages you ask for -- that part needs an elevated
# (Administrator) PowerShell and an internet connection; everything else
# does not.
#
# Usage (from a regular PowerShell prompt, in the hey-term folder):
#   .\\scripts\\setup-windows.ps1                          # English only
#   .\\scripts\\setup-windows.ps1 -Langs es,fr,de           # also request voice packs
#   .\\scripts\\setup-windows.ps1 -Langs es -SkipCapabilities   # skip the admin-only step
#
# If you didn't launch PowerShell as Administrator, the capability-install
# step is skipped automatically with instructions for doing it by hand from
# Settings instead -- everything else in the script still runs normally.

param(
    [string[]]$Langs = @("en"),
    [switch]$SkipCapabilities,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# Hey Term's language codes -> Windows locale tags for the Speech (SAPI5 /
# Narrator) Feature-on-Demand capability.
$LocaleMap = @{
    en = "en-US"
    es = "es-ES"
    fr = "fr-FR"
    de = "de-DE"
    pt = "pt-PT"
    it = "it-IT"
}

function Confirm-Or-Skip {
    param([string]$Prompt)
    if ($Yes -or -not [Environment]::UserInteractive) { return $true }
    $reply = Read-Host "$Prompt [y/N]"
    return ($reply -match '^[Yy]')
}

Write-Host "== Hey Term Windows setup ==" -ForegroundColor Cyan
Write-Host "Languages requested: $($Langs -join ', ')"
Write-Host ""

# --- 1. Speech language capabilities (needs Administrator) ---------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($SkipCapabilities) {
    Write-Host "Skipping speech language capability install (-SkipCapabilities)."
} elseif (-not $isAdmin) {
    Write-Warning "Not running as Administrator -- skipping automatic speech language install."
    Write-Host "To add a voice by hand instead: Settings > Time & Language > Language & region >" -ForegroundColor Yellow
    Write-Host "  Add a language > pick it > make sure 'Text-to-speech' is checked." -ForegroundColor Yellow
    Write-Host "Or re-run this script from an Administrator PowerShell to do it automatically." -ForegroundColor Yellow
} else {
    foreach ($lang in $Langs) {
        if (-not $LocaleMap.ContainsKey($lang)) {
            Write-Host "No known Windows locale mapping for '$lang' -- skipping." -ForegroundColor Yellow
            continue
        }
        $locale = $LocaleMap[$lang]
        $capName = "Language.Speech~~~$locale~0.0.1.0"
        try {
            $capability = Get-WindowsCapability -Online -Name $capName -ErrorAction Stop
            if ($capability.State -eq "Installed") {
                Write-Host "$locale speech voice already installed."
            } elseif (Confirm-Or-Skip "Install $locale speech voice?") {
                Write-Host "Installing $locale speech voice (this can take a minute)..."
                Add-WindowsCapability -Online -Name $capName | Out-Null
                Write-Host "$locale speech voice installed."
            }
        } catch {
            Write-Warning "Couldn't install $locale speech voice automatically: $($_.Exception.Message)"
            Write-Host "Install it by hand instead: Settings > Time & Language > Language & region > Add a language > pick $locale > check 'Text-to-speech'." -ForegroundColor Yellow
        }
    }
}
Write-Host ""

# --- 2. Python dependencies ------------------------------------------------
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) {
    Write-Error "Python was not found on PATH. Install Python 3.9+ from python.org or the Microsoft Store, then re-run this script."
    exit 1
}

Write-Host "Installing Python dependencies with $($python.Source)..."
$repoRoot = Split-Path -Parent $PSScriptRoot
& $python.Source -m pip install -q -r (Join-Path $repoRoot "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    Write-Error "pip install failed -- see output above."
    exit 1
}

# --- 3. .env bootstrap ------------------------------------------------------
$envPath = Join-Path $repoRoot ".env"
$envExamplePath = Join-Path $repoRoot ".env.example"
if (-not (Test-Path $envPath)) {
    Copy-Item $envExamplePath $envPath
    Write-Host "Created .env -- edit it and add your ANTHROPIC_API_KEY before running Hey Term." -ForegroundColor Green
} else {
    Write-Host ".env already exists -- leaving it alone."
}

# --- 4. Pre-download the Whisper model --------------------------------------
Write-Host "Pre-downloading the Whisper speech-to-text model (one-time, ~150MB)..."
& $python.Source -c "from faster_whisper import WhisperModel; WhisperModel('base')"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Model pre-download failed or was skipped -- it will just download on first run instead."
}

Write-Host ""
Write-Host "Done. Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env and set ANTHROPIC_API_KEY."
Write-Host "  2. Run: python main.py --lang en   (or --lang es / fr / de / pt / it)"
`,
  },
]
