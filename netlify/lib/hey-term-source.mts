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

**You don't have to speak at all.** Type a request and press Enter any time
-- no need to say "Hey Term" first -- and it's picked up the same as if it
had been spoken (checked between wake-word listening chunks, so there's up
to one chunk's worth of delay, a couple of seconds by default). This only
needs an interactive terminal; it's silently unavailable when stdin is
piped, redirected, or otherwise non-interactive (voice still works either
way). Confirmations themselves are unaffected by this -- an ordinary
command still expects a spoken "confirm"/"cancel", and only the dangerous-
command blocklist above still asks for typed \`CONFIRM\`.

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
   request is ambiguous. It never guesses on unclear requests. Recent turns
   go with it (see "Conversational memory" below), so a clarifying answer or
   a follow-up like "undo that" is understood in context.
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

## Conversational memory

The back-and-forth with Claude within one run is remembered (\`main.py\`'s
\`_conversation_history\`, capped at the most recent 12 messages so it doesn't
grow -- and cost -- indefinitely) and sent along with each new request, so:

\`\`\`
you:      "Hey Term"
Hey Term: "Yes?"
you:      "delete the log file"
Hey Term: "Which log file did you mean?"
you:      "Hey Term"
Hey Term: "Yes?"
you:      "the one in /var/log/app"
Hey Term: "Deletes /var/log/app/app.log. Say confirm to run it, or cancel."
\`\`\`

answering a clarifying question, or referring back to what just ran ("undo
that", "run it again but in the background") actually lands in context
instead of Claude re-planning from nothing each time. It resets on "stop
listening" (or its translated equivalent) -- the one phrase that already
means "start over" -- and isn't affected by the offline fallback below,
which never talks to Claude in the first place. \`jobs\`/\`cost\`/\`revert\` don't
touch it either, since they're answered locally and never go to Claude.

## Safety net: reverting what just ran

Before running a confirmed plan, Hey Term takes a snapshot of \`git status\`
in \`WORK_DIR\` (see \`lib/snapshot.py\`) -- if it's not a git repository, this
is a silent no-op, everything else works exactly the same. After running,
it diffs against that snapshot to see which paths changed, and says so:

\`\`\`
    $ npm install some-package
    (2 file(s) changed -- say "revert" to undo)
\`\`\`

Say **"revert"** (or "undo that") right after, and it undoes just that run:
a brand-new file gets deleted, a modified tracked file gets restored from
\`HEAD\` via \`git checkout --\`. A file that was *already* dirty before Hey
Term ran anything is always left alone and reported as skipped rather than
guessed at -- there's no reliable way to tell "changes already there" apart
from "changes this run just made" to the same file, and guessing wrong
there is worse than doing nothing. This is one run deep, not a full undo
stack: only the most recent run can be reverted.

## Background jobs

Add "in the background" (or "as a background job") to a request and Hey
Term launches it detached instead of waiting for it -- useful for a build,
an install, or anything slow enough that you'd rather keep talking than
stare at the terminal:

\`\`\`
you: "Hey Term"
you: "run the test suite in the background"
Hey Term: "Started in the background. Say jobs to check on it."
\`\`\`

It's still voice-confirmed exactly like any other request first -- background
only changes what happens *after* you confirm. Say **"jobs"** any time to see
what's running or finished (\`lib/jobs.py\`); each job's full output is logged
to \`.hey-term-jobs/<job-id>/output.log\` in \`WORK_DIR\`.

## Session cost

Hey Term is bring-your-own-\`ANTHROPIC_API_KEY\` -- your key, your bill, no
markup. Every planning call's token usage is used to keep a running,
approximate cost total for this project (\`lib/cost.py\`), persisted to
\`.hey-term-cost.json\`. Say **"cost"** any time to hear it. This is an
estimate from Anthropic's published per-token pricing, not a real-time
bill -- check the Anthropic console for the actual number.

## Working without Claude's API

If Claude's API can't be reached (no key set, or a network failure), Hey
Term doesn't just fail every request -- a small, fixed set of common,
read-only requests (\`lib/offline_fallback.py\`) still work by matching
directly to a safe command instead of asking Claude to plan one: listing
files, git status, disk space, the current date, and a handful of others.
Every one of those is read-only by construction; nothing in that fallback
table writes, deletes, or installs anything, since there's no Claude call to
reason about whether a given request is actually safe once it's this far
outside the normal planning path. Anything outside that small list still
needs a working connection to Claude, and Hey Term says so plainly instead
of guessing at a command.

## Custom "always ask me to type it" commands

The built-in list of commands that require typed \`CONFIRM\` instead of a
spoken one (\`lib/config.py\`'s \`DANGEROUS_PATTERNS\`) only covers things that
can take down an entire disk or OS install -- it can't know your production
database's actual name or which branch is your release branch. Add your own:

\`\`\`
# EXTRA_DANGEROUS_PATTERNS in .env, comma-separated:
EXTRA_DANGEROUS_PATTERNS=drop prod_customers,git push origin release

# or a longer list, one per line, in ~/.hey-term/dangerous_patterns.txt
# (# comments allowed; set PATTERNS_FILE in .env to use a different path)
\`\`\`

Both are purely additive -- neither can remove a built-in pattern.

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

**Android (Termux):**
\`\`\`
chmod +x install.sh
./install.sh                    # detects Termux automatically, asks before installing
./install.sh --yes              # don't prompt before pkg installs
./install.sh --dry-run          # preview what it would do, changes nothing
\`\`\`
\`install.sh\` detects Termux (via \`$PREFIX\`) and runs \`scripts/setup-termux.sh\`
instead of the Linux script -- it installs \`termux-api\` and \`ffmpeg\` via
\`pkg\` rather than \`portaudio19-dev\`/\`espeak-ng\`, since voice on Android goes
through a completely different path (see "Voice on Android (Termux)" below),
then Python dependencies from \`requirements-termux.txt\`, \`.env\`, and the
Whisper model, same as the other platforms.

Either one leaves you with a ready \`.env\` (add your API key) and the
Whisper model already downloaded. Skip straight to [step 4](#4-run-it)
below.

\`install.sh\`/\`install.ps1\` are thin wrappers -- they just forward whatever
you pass to \`scripts/setup-linux.sh\` / \`scripts/setup-termux.sh\` /
\`scripts\\setup-windows.ps1\`, so calling those directly does exactly the same
thing if you'd rather.

### Voice on Android (Termux)

Termux itself has no access to the phone's microphone or speaker -- nothing
running inside it can reach either one directly. The bridge is a separate
app, **Termux:API** (same publisher as Termux, get it from the same store --
F-Droid or Play Store, don't mix sources), plus its CLI package:

\`\`\`
pkg install termux-api ffmpeg
\`\`\`

(\`./install.sh\` does this for you.) Once both the app and the CLI package
are installed, grant microphone permission the first time Android prompts
for it (or set it by hand under Android's App Info screen for Termux:API if
the prompt never appears). \`ffmpeg\` decodes what the mic-recording tool
captures into the format the rest of Hey Term expects -- it's a real
dependency, not optional.

Recording works in short clips rather than one continuous stream (that's a
limitation of \`termux-microphone-record\` itself, which only starts/stops a
recording to a file), so silence detection on Termux is coarser than on
desktop -- it can include up to one extra clip's worth of trailing silence.
Speech is still accurate; it just doesn't cut off the instant you stop
talking, the same trade-off as pausing mid-sentence on desktop.

If you see \`(speech output unavailable: termux-tts-speak failed -- ...)\` or
a \`termux-microphone-record failed\` error, it almost always means the
Termux:API **app** isn't installed, or the mic permission was denied -- the
CLI package alone can't do either without it.

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

**Android (Termux):** different dependencies entirely -- see "Voice on
Android (Termux)" above. Install \`termux-api\` and \`ffmpeg\` via \`pkg\`, not
\`portaudio19-dev\`/\`espeak-ng\`.

#### 2. Install

Either (Windows/Linux/macOS):
\`\`\`
pip install -r requirements.txt
\`\`\`
or, as an installed command (\`hey-term\` on your PATH afterward):
\`\`\`
pip install -e .
\`\`\`
On Termux, use the Termux-specific requirements file instead (it omits
\`sounddevice\`/\`pyttsx3\`, which have no Android build):
\`\`\`
pip install -r requirements-termux.txt
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

Say "Hey Term", wait for it to prompt you, say what you want -- or just type
your request and press Enter, no wake word needed. Ctrl+C to quit, or say
the wake word then "stop listening" (or its translated equivalent) for a
spoken sign-off.

## Testing

\`\`\`
python test/run.py
\`\`\`

142 tests, all pure-logic (plan parsing, wake-word matching, confirmation
parsing in all six languages, i18n key-consistency across languages, the
safety blocklist, the audit log, the command executor -- including a
regression test that bash-only syntax actually runs correctly -- the revert
safety net, background jobs, cost tracking, the offline fallback, the typed-
request reader thread/queue, conversational-memory bookkeeping (forwarding,
remembering, capping, and resetting history -- both at the \`plan()\` level
and the \`handle_request()\` level), and the Termux audio bridge's command-
building/error-handling/decode logic) -- nothing here needs a real
microphone, speaker, or a phone, so it runs identically in CI, on a machine
with no audio hardware at all, or in this sandbox (the one exception,
decoding a real audio file through the actual \`ffmpeg\` binary, is skipped
automatically
if \`ffmpeg\` isn't on the \`PATH\`).

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
import json
import queue
import sys
import threading

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

# Short-term conversational memory: the Claude-facing back-and-forth so far
# this run, as {"role", "content"} messages, sent ahead of each new request
# (see lib/agent.py's plan()) so a clarifying answer or a follow-up
# reference ("undo that") lands in context instead of starting over. Reset
# on "stop listening" (handle_request's stop_phrase branch) -- an
# indefinitely growing history would otherwise keep costing tokens for
# context that's stopped being relevant, and "stop listening" is the one
# phrase a person already says specifically to mean "start fresh." Capped at
# MAX_HISTORY_MESSAGES for the same reason even within one still-active
# conversation. Only real Claude round-trips are added -- see
# handle_request's offline-fallback branch for why that path is excluded.
MAX_HISTORY_MESSAGES = 12
_conversation_history = []

# Tracks whether the fallback-language notice has already been spoken this
# run, so it's said once at startup, not on every single request.
_fallback_notice_given = False

# Typed input goes through one background reader thread and one queue,
# whatever it's for -- a request typed instead of spoken, or a typed CONFIRM
# for a dangerous command -- rather than each call site doing its own input()
# read. Two independent input() calls racing each other on the same stdin is
# how a keystroke ends up silently eaten by the wrong one; one reader thread
# and one queue means there's only ever one thing consuming stdin, so a typed
# line always reaches whichever consumer is actually waiting for it next.
_typed_input_queue: "queue.Queue" = queue.Queue()
_stdin_reader_thread = None


def _stdin_reader_loop(input_fn=input, out_queue=None) -> None:
    """Reads lines from stdin forever and enqueues non-empty, stripped ones.
    Exits (returns) on EOFError -- stdin closed, redirected from an
    exhausted pipe, or otherwise non-interactive -- rather than spinning.
    Takes input_fn/out_queue as parameters so it can be unit-tested with a
    fake stdin instead of the real one.
    """
    if out_queue is None:
        out_queue = _typed_input_queue
    while True:
        try:
            line = input_fn()
        except EOFError:
            return
        line = line.strip()
        if line:
            out_queue.put(line)


def start_stdin_reader() -> bool:
    """Starts the background stdin-reader thread once, only when stdin is an
    interactive terminal. Returns whether it's running (already-started
    counts). A no-op on a piped/redirected/non-interactive stdin (including
    the test suite and a scheduled/headless run) -- typing instead of the
    wake word just isn't offered there, but voice keeps working either way,
    and nothing blocks or crashes over the missing terminal.
    """
    global _stdin_reader_thread
    if _stdin_reader_thread is not None:
        return True
    try:
        interactive = sys.stdin is not None and sys.stdin.isatty()
    except Exception:
        interactive = False
    if not interactive:
        return False
    _stdin_reader_thread = threading.Thread(target=_stdin_reader_loop, daemon=True)
    _stdin_reader_thread.start()
    return True


def take_typed_request():
    """Non-blocking check for a request typed instead of spoken. Returns the
    text, or None if nothing's waiting -- called once per wake-word-loop
    iteration so a typed request is picked up between mic chunks without
    ever blocking the voice path."""
    try:
        return _typed_input_queue.get_nowait()
    except queue.Empty:
        return None


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
    print(prompt, end="", flush=True)
    if start_stdin_reader():
        typed = _typed_input_queue.get()  # blocks until the reader thread enqueues a line
    else:
        try:
            typed = input()
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


def _remember_turn(role: str, content: str) -> None:
    global _conversation_history
    _conversation_history.append({"role": role, "content": content})
    if len(_conversation_history) > MAX_HISTORY_MESSAGES:
        _conversation_history = _conversation_history[-MAX_HISTORY_MESSAGES:]


def _reset_conversation() -> None:
    global _conversation_history
    _conversation_history = []


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
        _reset_conversation()
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
        result = plan(request_text, language=language, history=_conversation_history)
        # Only a real Claude round-trip joins the remembered conversation --
        # see MAX_HISTORY_MESSAGES's comment above for why the offline-
        # fallback branch below deliberately doesn't do this too.
        _remember_turn("user", request_text)
        _remember_turn("assistant", json.dumps(result))
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
        print(f"    ({len(changed)} file(s) changed -- say \\"revert\\" to undo)")


def print_banner(language: str, work_dir: str, typing_available: bool) -> None:
    print(f"{config.PRODUCT_NAME} v{config.VERSION} -- {config.COPYRIGHT}")
    print(f"Working directory: {work_dir}")
    print(f"Language: {language}" + ("" if is_translated(language) or language == "auto" else " (untranslated -- using English prompts)"))
    print(f"Wake word: \\"{config.WAKE_WORD}\\". Listening in {config.WAKE_CHUNK_SECONDS}s chunks. Ctrl+C to quit.")
    if typing_available:
        print("You can also just type a request and press Enter, any time -- no need to say the wake word first.")
    print(f"Audit log: {config.AUDIT_LOG_PATH}")
    print(f"Command timeout: {config.COMMAND_TIMEOUT_SECONDS}s (say \\"take your time\\" in a request for a longer one)")
    print("Say \\"jobs\\", \\"cost\\", or \\"revert\\" any time for background-job status, session spend, or to undo the last run.")


def main(argv=None) -> int:
    global _fallback_notice_given
    _reset_conversation()
    args = parse_args(argv)

    if args.list_languages:
        for code in list_languages():
            print(f"{code}\\t{get_strings(code)['name']}")
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

    typing_available = start_stdin_reader()
    print_banner(language, work_dir, typing_available)
    audit.log_event("startup", language=language, work_dir=work_dir, version=config.VERSION, typing_available=typing_available)

    if language != "auto" and not is_translated(language) and not _fallback_notice_given:
        speak(get_strings(language)["fallback_language_notice"], language=DEFAULT_LANGUAGE_FOR_NOTICE)
        _fallback_notice_given = True

    speak(get_strings(language)["ready"], language=language)

    try:
        while True:
            typed_request = take_typed_request()
            if typed_request is not None:
                print(f"[you] {typed_request}")
                audit.log_event("wake", via="typed")
                handle_request(typed_request, language, work_dir, config.COMMAND_TIMEOUT_SECONDS)
                continue
            if listen_for_wake_word(wake_word):
                audit.log_event("wake", via="voice")
                request_text = take_command(language)
                if request_text:
                    print(f"[you] {request_text}")
                handle_request(request_text, language, work_dir, config.COMMAND_TIMEOUT_SECONDS)
    except KeyboardInterrupt:
        print("\\nStopped.")
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
`,
  },
  {
    path: "requirements.txt",
    contents: `# For a regular Windows/Linux/macOS install. On Android/Termux, use
# requirements-termux.txt instead (scripts/setup-termux.sh does this for
# you) -- sounddevice and pyttsx3 below have no Android wheel and aren't
# needed there, since lib/audio.py and lib/speak.py route through
# lib/termux_audio.py (the Termux:API app's CLI tools + ffmpeg) instead of
# these two when running under Termux.
sounddevice>=0.4.6
numpy>=1.24
faster-whisper>=1.0.0
pyttsx3>=2.90
requests>=2.31
`,
  },
  {
    path: "requirements-termux.txt",
    contents: `# Termux (Android) dependencies. Same as requirements.txt but WITHOUT
# sounddevice and pyttsx3: both are desktop-only audio backends, and pip has
# no prebuilt wheel for either on Android -- attempting to build sounddevice
# from source there needs PortAudio dev headers Termux doesn't ship, and it
# would install for nothing anyway, since lib/audio.py and lib/speak.py
# import both lazily and only take that code path when NOT running under
# Termux (see lib/termux_audio.py, used instead on Android). Everything else
# here is unchanged from requirements.txt.
numpy>=1.24
faster-whisper>=1.0.0
requests>=2.31
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
    contents: `# Copy this file to .env and fill in at least ANTHROPIC_API_KEY.
# Every setting below is optional except that one -- Hey Term runs with just
# the built-in defaults for everything else. See lib/config.py for how each
# of these is read and README.md for what they do.

# Required. Your own Anthropic API key -- Hey Term is bring-your-own-key,
# your usage, your bill, no markup. Get one at https://console.anthropic.com
ANTHROPIC_API_KEY=

# Which Claude model plans your requests.
# ANTHROPIC_MODEL=claude-sonnet-4-5

# The wake phrase. Not translated per-language on purpose -- see lib/i18n.py.
# WAKE_WORD=hey term
# WAKE_MATCH_THRESHOLD=0.72

# Spoken/listening language after the wake word. "auto" detects per request.
# See \`python main.py --list-languages\` for what's translated.
# LANGUAGE=en

# Offline speech-to-text model size/device (faster-whisper).
# WHISPER_MODEL_SIZE=base
# WHISPER_DEVICE=cpu

# Audio tuning -- rarely needs changing.
# SAMPLE_RATE=16000
# WAKE_CHUNK_SECONDS=2.5
# COMMAND_MAX_SECONDS=12
# SILENCE_HOLD_SECONDS=1.2
# SILENCE_RMS_THRESHOLD=0.012

# Folder commands run in. Defaults to wherever you launched Hey Term from.
# WORK_DIR=

# Where the JSONL audit log and the running cost total are written.
# Default to WORK_DIR/.hey-term-audit.jsonl and WORK_DIR/.hey-term-cost.json.
# AUDIT_LOG_PATH=
# COST_LOG_PATH=

# How long (seconds) a single command may run before Hey Term kills it and
# reports a timeout. Say "take your time" in a request for a one-off longer
# timeout without raising this default.
# COMMAND_TIMEOUT_SECONDS=120

# Your own additions to the built-in dangerous-command blocklist (see
# README.md's "Custom always-ask-me-to-type-it commands"). Comma-separated
# here, or point PATTERNS_FILE at a longer one-per-line file instead.
# EXTRA_DANGEROUS_PATTERNS=
# PATTERNS_FILE=
`,
  },
  {
    path: "install.sh",
    contents: `#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Entry point: detects Termux (Android) vs. a regular Linux machine and hands
# off to the matching setup script, since the two need different system
# packages -- Termux has no PortAudio/espeak-ng to install and instead needs
# the Termux:API CLI tools + ffmpeg (see scripts/setup-termux.sh's own header
# for why). See that script's or scripts/setup-linux.sh's --help for every
# flag; anything you pass here is forwarded as-is, e.g.:
#
#   ./install.sh --langs es,fr,de      # regular Linux
#   ./install.sh --yes                 # either
set -euo pipefail
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
if [ -n "\${PREFIX:-}" ] && [ "\${PREFIX#*com.termux}" != "$PREFIX" ]; then
  exec "$DIR/scripts/setup-termux.sh" "$@"
fi
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

from . import cost
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


def plan(request_text: str, language: str = "en", api_key: str = None, history: list = None) -> dict:
    """Ask Claude to turn spoken text into a plan. Returns either
    {"summary": str, "commands": [str, ...]} or {"clarify": str}.
    Raises AgentError on a network failure or a response that isn't valid
    JSON in one of those two shapes -- callers should treat that as "ask the
    person to repeat themselves," never as a command to run.

    \`history\` is the conversation so far as a list of {"role", "content"}
    messages (main.py keeps this across requests within a run, reset on
    "stop listening") -- it's sent ahead of \`request_text\` so a clarifying
    answer ("just the tools with pkg") or a follow-up reference ("undo
    that") is understood in context instead of being planned in isolation.
    Callers, not this function, decide what belongs in history and when to
    reset it -- this just forwards whatever it's given.
    """
    key = api_key or ANTHROPIC_API_KEY
    if not key:
        raise AgentError("ANTHROPIC_API_KEY is not set (see .env.example).")

    language_name = get_strings(language)["name"]
    system = SYSTEM_PROMPT.format(shell=_shell_name(), os_name=platform.system(), language_name=language_name)
    messages = list(history or []) + [{"role": "user", "content": request_text}]

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
                "messages": messages,
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

    # Track spend from the API's own reported token counts -- best-effort,
    # never lets a cost-tracking hiccup fail a request that otherwise
    # succeeded. See lib/cost.py for why this exists.
    try:
        usage = data.get("usage") or {}
        cost.record_usage(
            model=ANTHROPIC_MODEL,
            input_tokens=int(usage.get("input_tokens", 0)),
            output_tokens=int(usage.get("output_tokens", 0)),
        )
    except Exception:
        pass

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

On Android/Termux, sounddevice has nothing to talk to -- there is no
PortAudio backend there -- so both functions below check lib.termux_audio's
is_termux() first and delegate to its termux-microphone-record-based
implementation instead. Desktop (Windows/Linux/macOS) behavior is unchanged.
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
    under threshold for \`silence_hold\` seconds in a row), or \`max_seconds\`
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
VERSION = "1.2.0"
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

# How long a single command is allowed to run before Hey Term kills it and
# reports a timeout, in seconds. Was a fixed 120s; now overridable per install
# (via .env/COMMAND_TIMEOUT_SECONDS) and per-request (a spoken "give it more
# time" -- see main.py's LONGER_TIMEOUT_PHRASES) for the genuinely slow stuff
# (a big install, a long build) without raising the default for everything.
COMMAND_TIMEOUT_SECONDS = float(os.environ.get("COMMAND_TIMEOUT_SECONDS", "120"))

# Session running-total cost tracking (see lib/cost.py). Off by default would
# defeat the point -- someone handing Hey Term their own API key should always
# be able to ask "what has this cost me so far" without digging through the
# Anthropic console. Persisted per work_dir so "cost" reflects this project,
# not every project Hey Term has ever touched.
COST_LOG_PATH = os.environ.get("COST_LOG_PATH") or os.path.join(WORK_DIR, ".hey-term-cost.json")

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
_BUILTIN_DANGEROUS_PATTERNS = [
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


def _load_extra_patterns() -> list:
    """User-defined additions to the built-in blocklist above.

    The built-in list only covers things that can nuke an entire disk or OS
    install -- it deliberately says nothing about a specific person's own
    "don't touch this" list (their production database's actual name, their
    release branch, a customer-data table). Those are just as dangerous *to
    that person* but can't be guessed in advance, so this loads more patterns
    from two places, both optional and additive (nothing here can remove a
    built-in pattern):

    - EXTRA_DANGEROUS_PATTERNS env var / .env entry: comma-separated.
    - A patterns file, one pattern per line ("#" comments allowed), at
      PATTERNS_FILE if set, else ~/.hey-term/dangerous_patterns.txt if it
      exists. Easier to keep a long list here than crammed into one env var.
    """
    extra = []

    env_val = os.environ.get("EXTRA_DANGEROUS_PATTERNS", "")
    if env_val:
        extra.extend(p.strip() for p in env_val.split(",") if p.strip())

    patterns_file = os.environ.get("PATTERNS_FILE") or os.path.expanduser(
        os.path.join("~", ".hey-term", "dangerous_patterns.txt")
    )
    if os.path.isfile(patterns_file):
        with open(patterns_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    extra.append(line)

    return extra


# Commands matching these (case-insensitive substring) patterns are never run
# on a spoken "confirm" alone -- see lib/safety.py. The built-in list is kept
# short and specific on purpose: a long blocklist gives a false sense of
# coverage it can't deliver, so it exists to catch the handful of single
# commands that can destroy an entire disk or OS install, not to be a general
# security boundary. Anything install-specific belongs in _load_extra_patterns
# instead of growing this list.
DANGEROUS_PATTERNS = _BUILTIN_DANGEROUS_PATTERNS + [
    p for p in _load_extra_patterns() if p.lower() not in {b.lower() for b in _BUILTIN_DANGEROUS_PATTERNS}
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
    path: "lib/cost.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Running total of what this project's Hey Term sessions have spent calling
Claude's API, in dollars.

Hey Term is bring-your-own-API-key: the person's key, their bill, no
markup, no metering on MultiNiche AI's end. That also means the only way
someone finds out what a voice-controlled terminal has been costing them is
the Anthropic console -- easy to forget to check. This keeps a local,
approximate running total instead, computed from the token counts the API
itself returns with every response (see lib/agent.py's plan()), persisted to
config.COST_LOG_PATH so it survives restarts and reflects one project's
usage, not every project Hey Term has ever touched.

Prices are approximate and only cover models this product is actually
configured to call -- see PRICING below. A model not listed falls back to
the default entry rather than raising, since "the estimate might be slightly
off" is a far better failure mode for a cost *estimate* than "Hey Term
crashed because a model string didn't match."
"""
import json
import os
import threading

from . import config

_LOCK = threading.Lock()

# Dollars per million tokens (input, output). Anthropic's published pricing
# as of when this was written -- check the current rates if this number
# looks stale, this is a local estimate, not a bill.
PRICING = {
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-opus-4-5": (5.00, 25.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "_default": (3.00, 15.00),
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = PRICING.get(model, PRICING["_default"])
    return (input_tokens / 1_000_000) * in_rate + (output_tokens / 1_000_000) * out_rate


def _load(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and "total_cost_usd" in data:
                return data
    except (OSError, json.JSONDecodeError):
        pass
    return {"total_cost_usd": 0.0, "total_input_tokens": 0, "total_output_tokens": 0, "requests": 0}


def record_usage(model: str, input_tokens: int, output_tokens: int, path: str = None) -> dict:
    """Adds one API call's usage to the running total and persists it.
    Returns the updated totals. Thread-safe (the background-jobs feature and
    the main loop could in principle both touch this) and best-effort -- a
    write failure here must never take down the request it's tracking.
    """
    target = path or config.COST_LOG_PATH
    cost = estimate_cost(model, input_tokens, output_tokens)
    with _LOCK:
        totals = _load(target)
        totals["total_cost_usd"] = round(totals["total_cost_usd"] + cost, 6)
        totals["total_input_tokens"] += input_tokens
        totals["total_output_tokens"] += output_tokens
        totals["requests"] += 1
        try:
            os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                json.dump(totals, f)
        except OSError:
            pass
    return totals


def get_totals(path: str = None) -> dict:
    return _load(path or config.COST_LOG_PATH)


def spoken_summary(path: str = None) -> str:
    totals = get_totals(path)
    cost = totals["total_cost_usd"]
    requests = totals["requests"]
    if requests == 0:
        return "This project hasn't made any Claude requests yet."
    noun = "request" if requests == 1 else "requests"
    return f"This project has used about \${cost:.2f} across {requests} {noun}."
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

Output streams live instead of only after the command finishes -- a build or
install that takes a while used to look hung until the whole thing completed
or the fixed timeout killed it. Streaming is done with a reader thread per
pipe (stdout, stderr) so the overall wall-clock timeout is still enforced even
when the child process goes quiet for a while, not just when it's spewing
output.
"""
import os
import queue
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass, field

from . import config
from .config import WORK_DIR, is_windows
from .i18n import DEFAULT_LANGUAGE, get as get_strings

# Kept for backward compatibility with anything importing the old constant
# directly; config.COMMAND_TIMEOUT_SECONDS is the live, overridable value.
COMMAND_TIMEOUT_SECONDS = config.COMMAND_TIMEOUT_SECONDS
OUTPUT_TRUNCATE_CHARS = 4000

# How often the reader loop checks the wall-clock deadline while waiting for
# output. Small enough that a timeout is enforced promptly, large enough not
# to busy-loop.
_POLL_SECONDS = 0.5


@dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str
    ran: bool = True
    error: str = ""
    timed_out: bool = False


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


def _stream_process(argv, cwd, timeout_seconds, on_line=None):
    """Runs argv, streaming stdout/stderr line-by-line as they arrive instead
    of blocking until the process exits. Returns (stdout, stderr, returncode,
    timed_out). on_line, if given, is called as on_line(stream, line) for
    every line as it's read, where stream is "stdout" or "stderr" -- this is
    what lets a caller print output live instead of only after the fact.
    """
    proc = subprocess.Popen(
        argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1,
    )
    q = queue.Queue()

    def _reader(stream, tag):
        try:
            for line in iter(stream.readline, ""):
                q.put((tag, line))
        finally:
            q.put((tag, None))
            try:
                stream.close()
            except OSError:
                pass

    threads = [
        threading.Thread(target=_reader, args=(proc.stdout, "stdout"), daemon=True),
        threading.Thread(target=_reader, args=(proc.stderr, "stderr"), daemon=True),
    ]
    for t in threads:
        t.start()

    out_parts, err_parts = [], []
    finished_streams = set()
    start = time.monotonic()
    timed_out = False

    while len(finished_streams) < 2:
        remaining = timeout_seconds - (time.monotonic() - start)
        if remaining <= 0:
            timed_out = True
            proc.kill()
            break
        try:
            tag, line = q.get(timeout=min(remaining, _POLL_SECONDS))
        except queue.Empty:
            continue
        if line is None:
            finished_streams.add(tag)
            continue
        (out_parts if tag == "stdout" else err_parts).append(line)
        if on_line:
            on_line(tag, line.rstrip("\\n"))

    if timed_out:
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        returncode = -1
    else:
        returncode = proc.wait()

    return "".join(out_parts), "".join(err_parts), returncode, timed_out


def run_commands(commands: list, work_dir: str = None, timeout_seconds: float = None, on_line=None) -> RunReport:
    """Runs each command in order, stopping at the first non-zero exit so a
    later command never runs against a state the earlier one failed to reach.

    timeout_seconds overrides config.COMMAND_TIMEOUT_SECONDS for this call --
    useful for a request that's expected to take a while (a big install, a
    long build) without raising the default for every command. on_line, if
    given, is called live as output arrives: on_line(stream, line).
    """
    cwd = work_dir or WORK_DIR
    limit = timeout_seconds if timeout_seconds is not None else config.COMMAND_TIMEOUT_SECONDS
    report = RunReport()
    stop = False
    for cmd in commands:
        if stop:
            report.results.append(CommandResult(command=cmd, returncode=-1, stdout="", stderr="", ran=False))
            continue
        try:
            stdout, stderr, returncode, timed_out = _stream_process(
                _build_argv(cmd), cwd, limit, on_line=on_line,
            )
            if timed_out:
                result = CommandResult(
                    command=cmd, returncode=-1, stdout=_truncate(stdout), stderr=_truncate(stderr),
                    ran=True, error=f"Timed out after {limit}s", timed_out=True,
                )
            else:
                result = CommandResult(
                    command=cmd, returncode=returncode, stdout=_truncate(stdout), stderr=_truncate(stderr),
                    ran=True,
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
        "fallback_language_notice": "I don't have that language translated yet, so I'll use English for now.",
        "offline_notice": "I can't reach Claude right now, so I'm using a basic offline command for this.",
        "offline_no_match": "I can't reach Claude to plan that, and it's not one of the basic commands I can run offline.",
        "background_started": "Started in the background. Say jobs to check on it.",
        "jobs_none": "No background jobs yet.",
        "revert_none": "Nothing to revert.",
        "revert_done": "Reverted {n} file(s).",
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
        "fallback_language_notice": "No tengo ese idioma traducido todavía, así que usaré inglés por ahora.",
        "offline_notice": "No puedo comunicarme con Claude ahora mismo, así que voy a usar un comando básico sin conexión para esto.",
        "offline_no_match": "No puedo comunicarme con Claude para planear eso, y no es uno de los comandos básicos que puedo ejecutar sin conexión.",
        "background_started": "Iniciado en segundo plano. Di jobs para revisarlo.",
        "jobs_none": "Todavía no hay tareas en segundo plano.",
        "revert_none": "No hay nada que revertir.",
        "revert_done": "Se revirtieron {n} archivo(s).",
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
        "fallback_language_notice": "Je n'ai pas encore cette langue traduite, donc je vais utiliser l'anglais pour l'instant.",
        "offline_notice": "Je ne peux pas joindre Claude en ce moment, donc j'utilise une commande de base hors ligne pour ça.",
        "offline_no_match": "Je ne peux pas joindre Claude pour planifier ça, et ce n'est pas une des commandes de base que je peux exécuter hors ligne.",
        "background_started": "Démarré en arrière-plan. Dis jobs pour vérifier.",
        "jobs_none": "Aucune tâche en arrière-plan pour l'instant.",
        "revert_none": "Rien à annuler.",
        "revert_done": "{n} fichier(s) annulé(s).",
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
        "fallback_language_notice": "Diese Sprache ist noch nicht übersetzt, also verwende ich vorerst Englisch.",
        "offline_notice": "Ich kann Claude gerade nicht erreichen, also verwende ich dafür einen einfachen Offline-Befehl.",
        "offline_no_match": "Ich kann Claude nicht erreichen, um das zu planen, und das ist keiner der einfachen Befehle, die ich offline ausführen kann.",
        "background_started": "Im Hintergrund gestartet. Sag jobs, um nachzusehen.",
        "jobs_none": "Noch keine Hintergrundaufgaben.",
        "revert_none": "Nichts rückgängig zu machen.",
        "revert_done": "{n} Datei(en) zurückgesetzt.",
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
        "fallback_language_notice": "Ainda não tenho esse idioma traduzido, então vou usar inglês por enquanto.",
        "offline_notice": "Não consigo falar com o Claude agora, então vou usar um comando básico offline para isso.",
        "offline_no_match": "Não consigo falar com o Claude para planejar isso, e não é um dos comandos básicos que sei executar offline.",
        "background_started": "Iniciado em segundo plano. Diga jobs para verificar.",
        "jobs_none": "Ainda não há tarefas em segundo plano.",
        "revert_none": "Nada para reverter.",
        "revert_done": "{n} arquivo(s) revertido(s).",
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
        "fallback_language_notice": "Non ho ancora questa lingua tradotta, quindi userò l'inglese per ora.",
        "offline_notice": "Non riesco a raggiungere Claude in questo momento, quindi uso un comando offline di base per questo.",
        "offline_no_match": "Non riesco a raggiungere Claude per pianificarlo, e non è uno dei comandi di base che posso eseguire offline.",
        "background_started": "Avviato in background. Di' jobs per controllare.",
        "jobs_none": "Ancora nessun lavoro in background.",
        "revert_none": "Niente da annullare.",
        "revert_done": "{n} file ripristinati.",
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
    path: "lib/jobs.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Detached background jobs, for a request the person doesn't want to block
the voice loop on ("kick off the build" and keep talking, instead of staring
at the terminal until it finishes or hits the timeout).

A job is still confirmed exactly like any other command -- the only thing
"background" changes is that Hey Term doesn't wait for it, so nothing here
weakens the spoken/typed confirmation model in lib/confirm.py and
lib/safety.py. Each job is a real detached subprocess (still run through the
same explicit bash/PowerShell invocation as lib/executor.py, not
shell=True), with its own log file and a status file main.py's "jobs" command
reads back.

State lives in JOBS_DIR (".hey-term-jobs" under the work dir by default), one
subfolder per job -- no daemon, no database, just files, so a job someone
started, closed the terminal, and reopened Hey Term for is still checkable.
"""
import json
import os
import subprocess
import threading
import time
import uuid

from .config import WORK_DIR, is_windows

JOBS_DIRNAME = ".hey-term-jobs"


def _jobs_dir(work_dir: str) -> str:
    path = os.path.join(work_dir, JOBS_DIRNAME)
    os.makedirs(path, exist_ok=True)
    return path


def _build_argv(command: str) -> list:
    # Deliberately duplicated from lib/executor.py rather than imported: a
    # background job's argv-building must never change behavior just because
    # someone edits the foreground executor, and the two are small enough
    # that keeping them independently readable beats a shared abstraction.
    if is_windows():
        import shutil
        exe = shutil.which("pwsh") or shutil.which("powershell") or "powershell"
        return [exe, "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]
    import shutil
    exe = shutil.which("bash") or ("/bin/bash" if os.path.exists("/bin/bash") else None) or shutil.which("sh") or "/bin/sh"
    return [exe, "-c", command]


def start(command: str, work_dir: str = None, label: str = "") -> dict:
    """Launches \`command\` detached and returns its job record immediately --
    does not wait for it to finish. The job's own stdout+stderr go to
    <job_dir>/output.log; its exit code (once known) goes to status.json.
    """
    cwd = work_dir or WORK_DIR
    jobs_dir = _jobs_dir(cwd)
    job_id = uuid.uuid4().hex[:8]
    job_dir = os.path.join(jobs_dir, job_id)
    os.makedirs(job_dir, exist_ok=True)

    log_path = os.path.join(job_dir, "output.log")
    status_path = os.path.join(job_dir, "status.json")

    record = {
        "id": job_id,
        "command": command,
        "label": label,
        "work_dir": cwd,
        "started_at": time.time(),
        "finished_at": None,
        "returncode": None,
        "status": "running",
        "log_path": log_path,
    }
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(record, f)

    log_file = open(log_path, "w", encoding="utf-8")
    # start_new_session detaches the child from Hey Term's own process group
    # on POSIX so Ctrl+C in the foreground loop doesn't also kill the job;
    # CREATE_NEW_PROCESS_GROUP is the Windows equivalent.
    kwargs = {}
    if is_windows():
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True

    proc = subprocess.Popen(
        _build_argv(command), cwd=cwd, stdout=log_file, stderr=subprocess.STDOUT, **kwargs,
    )

    record["pid"] = proc.pid
    _write_status(status_path, record)

    # A background job's Popen handle would otherwise never be wait()ed on --
    # main.py doesn't block on it, that's the whole point -- which leaves a
    # zombie/defunct process behind on POSIX once it exits. A zombie's PID
    # stays valid, so checking "is this PID still alive" (os.kill(pid, 0))
    # would report it as running forever. A daemon thread that actually
    # wait()s reaps the process AND gets the real exit code, instead of
    # polling PID liveness and guessing.
    def _reap():
        returncode = proc.wait()
        try:
            log_file.close()
        except OSError:
            pass
        record["status"] = "finished"
        record["returncode"] = returncode
        record["finished_at"] = time.time()
        _write_status(status_path, record)

    threading.Thread(target=_reap, daemon=True).start()

    return record


def _write_status(status_path: str, record: dict) -> None:
    try:
        with open(status_path, "w", encoding="utf-8") as f:
            json.dump(record, f)
    except OSError:
        pass


def _refresh(job_dir: str) -> dict:
    """Reads a job's current status.json. The reaper thread started in
    start() keeps this file up to date as the job finishes -- but only for
    the lifetime of the Hey Term process that started it. If Hey Term itself
    was restarted while a job was still running, there's no reaper thread
    left to update the file, so this falls back to a one-off liveness check
    (a process can only be wait()ed on by its own parent, and a restarted
    Hey Term isn't that parent -- os.kill(pid, 0) is the best a *different*
    process can do). A job found dead this way is marked finished with an
    unknown exit code rather than guessing success.
    """
    status_path = os.path.join(job_dir, "status.json")
    try:
        with open(status_path, "r", encoding="utf-8") as f:
            record = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}

    if record.get("status") == "running" and record.get("pid") is not None:
        try:
            os.kill(record["pid"], 0)
        except OSError:
            record["status"] = "finished"
            record["finished_at"] = time.time()
            record.setdefault("returncode", None)
            _write_status(status_path, record)

    return record


def list_jobs(work_dir: str = None) -> list:
    cwd = work_dir or WORK_DIR
    jobs_dir = os.path.join(cwd, JOBS_DIRNAME)
    if not os.path.isdir(jobs_dir):
        return []
    records = []
    for job_id in sorted(os.listdir(jobs_dir)):
        job_dir = os.path.join(jobs_dir, job_id)
        if os.path.isdir(job_dir):
            record = _refresh(job_dir)
            if record:
                records.append(record)
    return records


def tail_log(job_id: str, work_dir: str = None, max_chars: int = 2000) -> str:
    cwd = work_dir or WORK_DIR
    log_path = os.path.join(cwd, JOBS_DIRNAME, job_id, "output.log")
    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_chars))
            return f.read()
    except OSError:
        return ""
`,
  },
  {
    path: "lib/offline_fallback.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""A small, deliberately narrow rule-based matcher for common read-only
requests, used only when Claude's API can't be reached (no key set, or a
network failure) -- see lib/agent.py's AgentError and main.py's
handle_request().

This is NOT a local LLM and doesn't try to be one. Full request planning
still needs Claude -- that's the actual product. What this covers is the
handful of requests common enough, and safe enough, that answering "sorry,
I need the internet for that" every single time would be a worse experience
than just answering them: listing files, checking git status, disk space,
the current date, and so on. Every pattern here maps to exactly one
non-destructive, read-only command -- nothing in this table writes, deletes,
or installs anything, on purpose, since there's no Claude call to reason
about whether a request is actually safe once it's this far outside the
normal planning path.

Matching is intentionally simple (substring/keyword, not NLU) and
conservative: an ambiguous or unrecognized request returns None so the
caller falls through to its normal "couldn't reach Claude" error instead of
guessing.
"""
from .config import is_windows

# Each entry: (keywords that must ALL appear in the lowercased request,
# posix command, windows command, one-line spoken description).
_RULES = [
    (("list", "file"), "ls -la", "Get-ChildItem", "Lists the files in the current folder."),
    (("what", "director"), "pwd", "Get-Location", "Shows the current folder."),
    (("current", "director"), "pwd", "Get-Location", "Shows the current folder."),
    (("disk", "space"), "df -h .", "Get-PSDrive -PSProvider FileSystem", "Shows disk space."),
    (("git", "status"), "git status", "git status", "Shows the git status of this folder."),
    (("git", "log"), "git log --oneline -10", "git log --oneline -10", "Shows the last 10 git commits."),
    (("what", "date"), "date", "Get-Date", "Shows the current date and time."),
    (("what", "time"), "date", "Get-Date", "Shows the current date and time."),
    (("who", "am", "i"), "whoami", "whoami", "Shows the current user."),
    (("what", "ip"), "curl -s ifconfig.me || hostname -I", "ipconfig", "Shows this machine's IP information."),
    (("environment", "variable"), "env", "Get-ChildItem Env:", "Lists environment variables."),
    (("python", "version"), "python3 --version || python --version", "python --version", "Shows the installed Python version."),
    (("node", "version"), "node --version", "node --version", "Shows the installed Node version."),
]


def try_offline_plan(request_text: str) -> dict:
    """Returns {"summary": str, "commands": [str]} if the request matches a
    known safe read-only pattern, else None. Callers should treat None
    exactly like "couldn't plan this," not as an error on its own.
    """
    lowered = (request_text or "").lower()
    if not lowered.strip():
        return None

    for keywords, posix_cmd, windows_cmd, description in _RULES:
        if all(kw in lowered for kw in keywords):
            command = windows_cmd if is_windows() else posix_cmd
            return {"summary": description, "commands": [command]}

    return None
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
    path: "lib/snapshot.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
"""Best-effort before/after safety net for file-changing commands, inside a
git repository only.

Voice confirmation lowers the bar to running a command; this exists to lower
the cost of having confirmed the wrong one. It is NOT a general undo system --
it can only ever see what git can see, and it never touches a file that was
already dirty before Hey Term ran anything (touching that would risk
destroying changes that had nothing to do with what Hey Term just did, which
is worse than doing nothing).

What it actually does: record \`git status --porcelain -uall\` before running
a plan's commands, record it again after, and diff the two. Any path whose
status changed -- newly modified, newly created, newly deleted -- is a
candidate for "revert". A path that was *already* dirty before the snapshot
was taken is always left alone, reported but not reverted, since there's no
reliable way to separate "changes already there" from "changes Hey Term just
made" to the same file.
"""
import os
import subprocess

GIT_TIMEOUT_SECONDS = 10


def _run_git(args: list, cwd: str):
    try:
        proc = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, timeout=GIT_TIMEOUT_SECONDS,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except (OSError, subprocess.TimeoutExpired):
        return 1, "", "git unavailable"


def is_git_repo(work_dir: str) -> bool:
    code, out, _ = _run_git(["rev-parse", "--is-inside-work-tree"], work_dir)
    return code == 0 and out.strip() == "true"


def _status_map(work_dir: str) -> dict:
    """Returns {path: two-char status code} from \`git status --porcelain\`,
    e.g. {"foo.py": " M", "new.txt": "??"}. -uall so a new file inside a new
    untracked directory is still listed individually, not collapsed to the
    directory name.
    """
    code, out, _ = _run_git(["status", "--porcelain", "-uall"], work_dir)
    result = {}
    if code != 0:
        return result
    for line in out.splitlines():
        if len(line) < 4:
            continue
        status = line[:2]
        path = line[3:]
        if " -> " in path:  # rename: "old -> new" -- track the new path
            path = path.split(" -> ", 1)[1]
        result[path] = status
    return result


class Snapshot:
    """Opaque handle returned by take(); pass it straight to changed_since()
    and revert(). is_git is False whenever work_dir isn't (or isn't inside) a
    git repository -- every other function on this module treats that as
    "nothing to do" rather than raising, since most commands never touch a
    git repo at all and that's a completely normal, unremarkable case.
    """

    def __init__(self, work_dir: str, is_git: bool, before: dict):
        self.work_dir = work_dir
        self.is_git = is_git
        self.before = before


def take(work_dir: str) -> Snapshot:
    is_git = is_git_repo(work_dir)
    before = _status_map(work_dir) if is_git else {}
    return Snapshot(work_dir=work_dir, is_git=is_git, before=before)


def changed_since(snap: Snapshot) -> list:
    """Paths whose git status is different now than when the snapshot was
    taken -- newly modified, newly created, newly deleted, or newly staged.
    Returns [] outside a git repo, or if nothing changed.
    """
    if not snap.is_git:
        return []
    after = _status_map(snap.work_dir)
    all_paths = set(snap.before) | set(after)
    return sorted(p for p in all_paths if snap.before.get(p) != after.get(p))


def revert(snap: Snapshot, paths: list) -> tuple:
    """Best-effort revert of \`paths\` back to how they were when the snapshot
    was taken. Returns (reverted, skipped) -- two lists of paths. A path is
    skipped, never forced, when it was already dirty before the snapshot (see
    module docstring), when it's outside a git repo, or when the underlying
    git/filesystem operation fails.
    """
    if not snap.is_git:
        return [], list(paths)

    after = _status_map(snap.work_dir)
    reverted, skipped = [], []

    for path in paths:
        if snap.before.get(path) is not None:
            # Already dirty before Hey Term touched anything -- don't guess
            # which part of the diff is "ours" to undo.
            skipped.append(path)
            continue

        after_status = after.get(path, "")
        full_path = os.path.join(snap.work_dir, path)

        try:
            if after_status.startswith("??"):
                # Brand-new untracked file -- reverting means deleting it.
                if os.path.isfile(full_path):
                    os.remove(full_path)
                    reverted.append(path)
                else:
                    skipped.append(path)
            else:
                # Tracked file that went from clean to modified/deleted --
                # restore it from HEAD.
                code, _, _ = _run_git(["checkout", "--", path], snap.work_dir)
                if code == 0:
                    reverted.append(path)
                else:
                    skipped.append(path)
        except OSError:
            skipped.append(path)

    return reverted, skipped
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
                  "is the Termux:API app installed, and \`pkg install termux-api\` done?)")
        return

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
    path: "lib/termux_audio.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
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
    float32 PCM numpy array at \`sample_rate\`, mono. Raises RuntimeError with
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
    """Records one clip of up to \`seconds\` seconds via termux-microphone-record
    and returns it as a 1-D float32 numpy array at \`sample_rate\`.

    termux-microphone-record's own \`-l\` limit stops the recording on the
    Termux:API app's side, but the command itself returns as soon as
    recording *starts*, not when it finishes (documented Termux:API
    behavior) -- so this sleeps out the requested duration itself before
    reading the file, and sends an explicit \`-q\` stop afterward as a
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
            "and granted microphone permission, and is \`pkg install termux-api\` done?"
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
    """Transcribes a command/confirmation clip. \`language\` is a Whisper
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
import json
import unittest
from unittest import mock

from lib.agent import SYSTEM_PROMPT, AgentError, _shell_name, parse_plan, plan


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


def _fake_response(payload: dict, usage=None):
    return mock.Mock(
        status_code=200,
        json=mock.Mock(return_value={
            "content": [{"type": "text", "text": json.dumps(payload)}],
            "usage": usage or {"input_tokens": 10, "output_tokens": 5},
        }),
    )


class TestPlanConversationHistory(unittest.TestCase):
    """plan()'s \`history\` param is what main.py's conversational-memory
    feature relies on to let a follow-up ("undo that") or a clarifying
    answer land in context -- see main.py's _remember_turn/_reset_conversation
    and its module docstring. These tests cover plan()'s side of that
    contract without a real network call.
    """

    def test_no_history_sends_only_the_current_request(self):
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["ls"]})) as post:
            plan("list files", api_key="test-key")
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent, [{"role": "user", "content": "list files"}])

    def test_history_is_forwarded_ahead_of_the_new_request(self):
        history = [
            {"role": "user", "content": "list files"},
            {"role": "assistant", "content": '{"summary": "Lists files.", "commands": ["ls -la"]}'},
        ]
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["rm foo"]})) as post:
            plan("undo that", api_key="test-key", history=history)
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent, history + [{"role": "user", "content": "undo that"}])

    def test_none_history_is_treated_the_same_as_no_history(self):
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["ls"]})) as post:
            plan("list files", api_key="test-key", history=None)
        sent = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(sent, [{"role": "user", "content": "list files"}])

    def test_does_not_mutate_the_caller_s_history_list(self):
        history = [{"role": "user", "content": "list files"}]
        original_len = len(history)
        with mock.patch("lib.agent.requests.post", return_value=_fake_response({"summary": "ok", "commands": ["ls"]})):
            plan("and now what", api_key="test-key", history=history)
        self.assertEqual(len(history), original_len)


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
    path: "test/test_config.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import importlib
import os
import tempfile
import unittest
from unittest import mock

from lib import config


class TestExtraDangerousPatterns(unittest.TestCase):
    def test_builtin_patterns_always_present(self):
        self.assertIn("rm -rf /", config.DANGEROUS_PATTERNS)

    def test_env_var_adds_patterns(self):
        with mock.patch.dict(os.environ, {"EXTRA_DANGEROUS_PATTERNS": "kubectl delete namespace, terraform destroy"}):
            extra = config._load_extra_patterns()
        self.assertIn("kubectl delete namespace", extra)
        self.assertIn("terraform destroy", extra)

    def test_patterns_file_adds_patterns(self):
        with tempfile.TemporaryDirectory() as tmp:
            patterns_path = os.path.join(tmp, "patterns.txt")
            with open(patterns_path, "w") as f:
                f.write("# a comment\\n")
                f.write("drop prod_customers\\n")
                f.write("\\n")
                f.write("git push origin release\\n")
            with mock.patch.dict(os.environ, {"PATTERNS_FILE": patterns_path}, clear=False):
                extra = config._load_extra_patterns()
        self.assertEqual(extra, ["drop prod_customers", "git push origin release"])

    def test_missing_patterns_file_is_not_an_error(self):
        with mock.patch.dict(os.environ, {"PATTERNS_FILE": "/no/such/file.txt"}):
            extra = config._load_extra_patterns()
        self.assertEqual(extra, [])

    def test_command_timeout_seconds_configurable_via_env(self):
        with mock.patch.dict(os.environ, {"COMMAND_TIMEOUT_SECONDS": "45"}):
            reloaded = importlib.reload(config)
        try:
            self.assertEqual(reloaded.COMMAND_TIMEOUT_SECONDS, 45.0)
        finally:
            importlib.reload(config)  # restore normal env for every other test


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
    path: "test/test_conversation_history.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest

import main


class TestConversationHistory(unittest.TestCase):
    def setUp(self):
        self._original = list(main._conversation_history)
        main._reset_conversation()

    def tearDown(self):
        main._conversation_history = self._original

    def test_starts_empty_after_reset(self):
        self.assertEqual(main._conversation_history, [])

    def test_remember_turn_appends_role_and_content(self):
        main._remember_turn("user", "list files")
        main._remember_turn("assistant", '{"summary": "ok", "commands": ["ls"]}')
        self.assertEqual(main._conversation_history, [
            {"role": "user", "content": "list files"},
            {"role": "assistant", "content": '{"summary": "ok", "commands": ["ls"]}'},
        ])

    def test_reset_clears_previously_remembered_turns(self):
        main._remember_turn("user", "list files")
        main._reset_conversation()
        self.assertEqual(main._conversation_history, [])

    def test_history_is_capped_at_max_history_messages(self):
        for i in range(main.MAX_HISTORY_MESSAGES + 5):
            main._remember_turn("user", f"request {i}")
        self.assertEqual(len(main._conversation_history), main.MAX_HISTORY_MESSAGES)
        # Oldest turns age out first -- the most recent ones survive.
        self.assertEqual(
            main._conversation_history[-1],
            {"role": "user", "content": f"request {main.MAX_HISTORY_MESSAGES + 4}"},
        )


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_cost.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import os
import tempfile
import unittest

from lib import cost


class TestCost(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.path = os.path.join(self._tmp.name, "cost.json")

    def tearDown(self):
        self._tmp.cleanup()

    def test_estimate_cost_known_model(self):
        # 1M input + 1M output tokens on sonnet-4-5 at $3/$15 per million.
        value = cost.estimate_cost("claude-sonnet-4-5", 1_000_000, 1_000_000)
        self.assertAlmostEqual(value, 18.00, places=2)

    def test_estimate_cost_unknown_model_uses_default(self):
        known = cost.estimate_cost("claude-sonnet-4-5", 1000, 1000)
        unknown = cost.estimate_cost("some-future-model", 1000, 1000)
        self.assertEqual(known, unknown)

    def test_get_totals_empty_when_no_file(self):
        totals = cost.get_totals(self.path)
        self.assertEqual(totals["total_cost_usd"], 0.0)
        self.assertEqual(totals["requests"], 0)

    def test_record_usage_accumulates(self):
        cost.record_usage("claude-sonnet-4-5", 1000, 500, path=self.path)
        cost.record_usage("claude-sonnet-4-5", 2000, 1000, path=self.path)
        totals = cost.get_totals(self.path)
        self.assertEqual(totals["requests"], 2)
        self.assertEqual(totals["total_input_tokens"], 3000)
        self.assertEqual(totals["total_output_tokens"], 1500)
        self.assertGreater(totals["total_cost_usd"], 0)

    def test_spoken_summary_no_requests(self):
        summary = cost.spoken_summary(self.path)
        self.assertIn("hasn't made any Claude requests", summary)

    def test_spoken_summary_after_usage(self):
        cost.record_usage("claude-sonnet-4-5", 1_000_000, 1_000_000, path=self.path)
        summary = cost.spoken_summary(self.path)
        self.assertIn("$18.00", summary)
        self.assertIn("1 request", summary)


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

    @unittest.skipIf(sys.platform == "win32", "sleep/timeout syntax differs")
    def test_slow_command_is_killed_after_custom_timeout(self):
        report = run_commands(["sleep 5"], timeout_seconds=0.5)
        self.assertEqual(len(report.results), 1)
        result = report.results[0]
        self.assertTrue(result.timed_out)
        self.assertEqual(result.returncode, -1)

    def test_stderr_captured_separately_from_stdout(self):
        cmd = "echo to-stdout; echo to-stderr 1>&2" if sys.platform != "win32" else \\
            "Write-Output to-stdout; Write-Error to-stderr"
        report = run_commands([cmd])
        result = report.results[0]
        self.assertIn("to-stdout", result.stdout)
        self.assertIn("to-stderr", result.stderr)

    def test_on_line_callback_receives_streamed_output(self):
        seen = []
        run_commands(["echo one && echo two"], on_line=lambda stream, line: seen.append((stream, line)))
        lines = [line for _, line in seen]
        self.assertIn("one", lines)
        self.assertIn("two", lines)

    def test_default_timeout_comes_from_config_when_not_overridden(self):
        with mock.patch("lib.executor.config.COMMAND_TIMEOUT_SECONDS", 0.5):
            report = run_commands(["sleep 5" if sys.platform != "win32" else "Start-Sleep -Seconds 5"])
        self.assertTrue(report.results[0].timed_out)


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_handle_request_history.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import json
import tempfile
import unittest
from unittest import mock

import main
from lib.agent import AgentError
from lib.executor import CommandResult


class TestHandleRequestConversationHistory(unittest.TestCase):
    """handle_request() is what actually wires main.py's conversational
    memory together -- forwarding _conversation_history into plan(),
    remembering a successful turn, resetting on "stop listening", and
    deliberately NOT remembering an offline-fallback turn (see
    MAX_HISTORY_MESSAGES's comment in main.py for why). Heavily mocked since
    the function itself talks to voice/confirmation/execution, but the
    history bookkeeping is real.
    """

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.work_dir = self._tmp.name
        main._reset_conversation()

    def tearDown(self):
        self._tmp.cleanup()
        main._reset_conversation()

    def test_successful_plan_is_forwarded_history_and_then_remembered(self):
        main._conversation_history = [{"role": "user", "content": "earlier turn"}]
        seen_history = []

        def fake_plan(request_text, language, history=None):
            # handle_request passes the live module-level list by reference,
            # not a copy -- snapshot it immediately, the same way the real
            # plan() does internally (see lib/agent.py's \`list(history or [])\`),
            # since later _remember_turn() calls mutate that same object.
            seen_history.append(list(history or []))
            return {"summary": "Lists files.", "commands": ["ls"]}

        with mock.patch("main.plan", side_effect=fake_plan), \\
             mock.patch("main.speak"), \\
             mock.patch("main.get_confirmation", return_value="cancel"):
            main.handle_request("list files", "en", self.work_dir, 30)

        self.assertEqual(seen_history, [[{"role": "user", "content": "earlier turn"}]])
        self.assertEqual(main._conversation_history[-2], {"role": "user", "content": "list files"})
        self.assertEqual(
            json.loads(main._conversation_history[-1]["content"]),
            {"summary": "Lists files.", "commands": ["ls"]},
        )

    def test_clarify_response_is_also_remembered(self):
        with mock.patch("main.plan", return_value={"clarify": "Which file do you mean?"}), \\
             mock.patch("main.speak"):
            main.handle_request("delete it", "en", self.work_dir, 30)

        self.assertEqual(main._conversation_history[-2], {"role": "user", "content": "delete it"})
        self.assertEqual(json.loads(main._conversation_history[-1]["content"]), {"clarify": "Which file do you mean?"})

    def test_offline_fallback_does_not_join_the_remembered_conversation(self):
        offline_result = {"summary": "Lists files.", "commands": ["ls -la"]}
        with mock.patch("main.plan", side_effect=AgentError("no API key")), \\
             mock.patch("main.offline_fallback.try_offline_plan", return_value=offline_result), \\
             mock.patch("main.speak"), \\
             mock.patch("main.get_confirmation", return_value="cancel"):
            main.handle_request("list files", "en", self.work_dir, 30)

        self.assertEqual(main._conversation_history, [])

    def test_stop_phrase_resets_conversation(self):
        main._conversation_history = [{"role": "user", "content": "earlier turn"}]
        with mock.patch("main.speak"):
            main.handle_request("stop listening", "en", self.work_dir, 30)
        self.assertEqual(main._conversation_history, [])

    def test_a_meta_command_like_jobs_leaves_history_untouched(self):
        main._conversation_history = [{"role": "user", "content": "earlier turn"}]
        with mock.patch("main.speak"):
            main.handle_request("jobs", "en", self.work_dir, 30)
        self.assertEqual(main._conversation_history, [{"role": "user", "content": "earlier turn"}])


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
    path: "test/test_jobs.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import sys
import tempfile
import time
import unittest

from lib import jobs


class TestJobs(unittest.TestCase):
    def setUp(self):
        # ignore_cleanup_errors: a job's daemon reaper thread (see
        # lib/jobs.py's start()) can still be writing status.json in this
        # directory the instant a test ends and tearDown races it to delete
        # the folder -- that's a harmless timing overlap in the test, not a
        # product bug, so cleanup tolerates "directory not empty" instead of
        # failing the test that happened to run last.
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.work_dir = self._tmp.name

    def tearDown(self):
        self._tmp.cleanup()

    def _wait_until_finished(self, job_id, timeout=10):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            for record in jobs.list_jobs(self.work_dir):
                if record["id"] == job_id and record["status"] == "finished":
                    return record
            time.sleep(0.1)
        self.fail(f"job {job_id} did not finish within {timeout}s")

    def test_start_returns_a_job_record_with_pid(self):
        # A near-instant command may already be reaped (status "finished")
        # by the time start() returns, since the reaper thread races the
        # caller -- that's correct, not flaky, so this only asserts the
        # shape of the record, not a status that a fast command can't
        # reliably still be in by the time we check it.
        record = jobs.start("echo background-job-output", work_dir=self.work_dir)
        self.assertIn("id", record)
        self.assertIn("pid", record)
        self.assertIn(record["status"], ("running", "finished"))

    def test_list_jobs_empty_when_none_started(self):
        self.assertEqual(jobs.list_jobs(self.work_dir), [])

    def test_job_eventually_reports_finished(self):
        record = jobs.start("echo done-marker", work_dir=self.work_dir)
        finished = self._wait_until_finished(record["id"])
        self.assertEqual(finished["status"], "finished")

    def test_tail_log_contains_command_output(self):
        record = jobs.start("echo hello-from-job", work_dir=self.work_dir)
        self._wait_until_finished(record["id"])
        log = jobs.tail_log(record["id"], work_dir=self.work_dir)
        self.assertIn("hello-from-job", log)

    def test_tail_log_missing_job_returns_empty_string(self):
        self.assertEqual(jobs.tail_log("no-such-job", work_dir=self.work_dir), "")

    def test_list_jobs_includes_label(self):
        jobs.start("echo x", work_dir=self.work_dir, label="test label")
        records = jobs.list_jobs(self.work_dir)
        self.assertEqual(records[0]["label"], "test label")


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_offline_fallback.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import unittest
from unittest import mock

from lib import offline_fallback


class TestOfflineFallback(unittest.TestCase):
    def test_no_match_returns_none(self):
        self.assertIsNone(offline_fallback.try_offline_plan("write me a poem about clouds"))

    def test_empty_request_returns_none(self):
        self.assertIsNone(offline_fallback.try_offline_plan(""))

    def test_list_files_matches_on_posix(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=False):
            result = offline_fallback.try_offline_plan("list the files here")
        self.assertIsNotNone(result)
        self.assertEqual(result["commands"], ["ls -la"])

    def test_list_files_matches_on_windows(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=True):
            result = offline_fallback.try_offline_plan("list the files here")
        self.assertIsNotNone(result)
        self.assertEqual(result["commands"], ["Get-ChildItem"])

    def test_git_status_matches(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=False):
            result = offline_fallback.try_offline_plan("what's the git status")
        self.assertEqual(result["commands"], ["git status"])

    def test_result_never_contains_destructive_keywords(self):
        # Cheap guardrail: every command this module can ever return should
        # be obviously read-only, never touching rm/del/drop/format.
        destructive = ("rm ", "del ", "drop ", "format", "mkfs", "dd if=")
        for _, posix_cmd, windows_cmd, _ in offline_fallback._RULES:
            for cmd in (posix_cmd, windows_cmd):
                lowered = cmd.lower()
                self.assertFalse(
                    any(d in lowered for d in destructive),
                    f"offline fallback command looked destructive: {cmd}",
                )

    def test_summary_is_a_nonempty_string(self):
        with mock.patch("lib.offline_fallback.is_windows", return_value=False):
            result = offline_fallback.try_offline_plan("what is the current date")
        self.assertTrue(isinstance(result["summary"], str) and result["summary"])


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
    path: "test/test_snapshot.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import subprocess
import tempfile
import unittest
import os

from lib import snapshot


def _git(args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


def _git_available() -> bool:
    try:
        subprocess.run(["git", "--version"], capture_output=True, check=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


@unittest.skipUnless(_git_available(), "git not installed in this environment")
class TestSnapshot(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.repo = self._tmp.name
        _git(["init", "-q"], self.repo)
        _git(["config", "user.email", "test@example.com"], self.repo)
        _git(["config", "user.name", "Test"], self.repo)
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("original\\n")
        _git(["add", "."], self.repo)
        _git(["commit", "-q", "-m", "init"], self.repo)

    def tearDown(self):
        self._tmp.cleanup()

    def test_is_git_repo_true_inside_repo(self):
        self.assertTrue(snapshot.is_git_repo(self.repo))

    def test_is_git_repo_false_outside_repo(self):
        with tempfile.TemporaryDirectory() as other:
            self.assertFalse(snapshot.is_git_repo(other))

    def test_no_changes_reports_empty(self):
        snap = snapshot.take(self.repo)
        self.assertEqual(snapshot.changed_since(snap), [])

    def test_detects_new_untracked_file(self):
        snap = snapshot.take(self.repo)
        with open(os.path.join(self.repo, "new.txt"), "w") as f:
            f.write("hello\\n")
        self.assertIn("new.txt", snapshot.changed_since(snap))

    def test_detects_modified_tracked_file(self):
        snap = snapshot.take(self.repo)
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("changed\\n")
        self.assertIn("tracked.txt", snapshot.changed_since(snap))

    def test_revert_deletes_newly_created_file(self):
        snap = snapshot.take(self.repo)
        new_path = os.path.join(self.repo, "new.txt")
        with open(new_path, "w") as f:
            f.write("hello\\n")
        reverted, skipped = snapshot.revert(snap, ["new.txt"])
        self.assertEqual(reverted, ["new.txt"])
        self.assertEqual(skipped, [])
        self.assertFalse(os.path.exists(new_path))

    def test_revert_restores_modified_tracked_file(self):
        snap = snapshot.take(self.repo)
        tracked_path = os.path.join(self.repo, "tracked.txt")
        with open(tracked_path, "w") as f:
            f.write("changed\\n")
        reverted, skipped = snapshot.revert(snap, ["tracked.txt"])
        self.assertEqual(reverted, ["tracked.txt"])
        with open(tracked_path) as f:
            self.assertEqual(f.read(), "original\\n")

    def test_revert_skips_file_that_was_already_dirty(self):
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("already dirty before snapshot\\n")
        snap = snapshot.take(self.repo)  # snapshot taken AFTER dirtying it
        with open(os.path.join(self.repo, "tracked.txt"), "w") as f:
            f.write("even more changed\\n")
        reverted, skipped = snapshot.revert(snap, ["tracked.txt"])
        self.assertEqual(reverted, [])
        self.assertEqual(skipped, ["tracked.txt"])

    def test_changed_since_empty_outside_git_repo(self):
        with tempfile.TemporaryDirectory() as other:
            snap = snapshot.take(other)
            with open(os.path.join(other, "whatever.txt"), "w") as f:
                f.write("x\\n")
            self.assertEqual(snapshot.changed_since(snap), [])

    def test_revert_outside_git_repo_skips_everything(self):
        with tempfile.TemporaryDirectory() as other:
            snap = snapshot.take(other)
            reverted, skipped = snapshot.revert(snap, ["whatever.txt"])
            self.assertEqual(reverted, [])
            self.assertEqual(skipped, ["whatever.txt"])


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_termux_audio.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

import numpy as np

from lib import termux_audio


class TestIsTermux(unittest.TestCase):
    def test_true_when_prefix_env_contains_com_termux(self):
        with mock.patch.dict("os.environ", {"PREFIX": "/data/data/com.termux/files/usr"}):
            self.assertTrue(termux_audio.is_termux())

    def test_true_when_record_binary_is_on_path_even_without_prefix(self):
        with mock.patch.dict("os.environ", {"PREFIX": ""}, clear=False):
            with mock.patch("shutil.which", return_value="/usr/bin/termux-microphone-record"):
                self.assertTrue(termux_audio.is_termux())

    def test_false_on_a_plain_desktop_environment(self):
        with mock.patch.dict("os.environ", {"PREFIX": "/usr"}, clear=False):
            with mock.patch("shutil.which", return_value=None):
                self.assertFalse(termux_audio.is_termux())


class TestDecodeToFloat32(unittest.TestCase):
    def setUp(self):
        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg not available in this environment")

    def test_decodes_a_real_wav_file_to_the_expected_float32_array(self):
        rate = 16000
        tone = (0.5 * np.sin(2 * np.pi * 440 * np.arange(rate) / rate)).astype("float32")

        with tempfile.NamedTemporaryFile(suffix=".wav") as wav_file:
            # Write a real WAV using ffmpeg itself so this test round-trips
            # through the exact binary termux_audio shells out to, rather
            # than trusting a second, unrelated WAV writer to agree with it.
            proc = subprocess.run(
                [
                    "ffmpeg", "-y", "-v", "error",
                    "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "-",
                    wav_file.name,
                ],
                input=tone.tobytes(),
                capture_output=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)

            decoded = termux_audio._decode_to_float32(wav_file.name, rate)

        self.assertEqual(decoded.dtype, np.dtype("float32"))
        self.assertGreater(len(decoded), 0)
        # Lossy container round-trip (this exercises the real ffmpeg binary),
        # so compare on shape/energy rather than bit-for-bit equality.
        self.assertAlmostEqual(
            float(np.sqrt(np.mean(np.square(decoded)))),
            float(np.sqrt(np.mean(np.square(tone)))),
            places=2,
        )

    def test_missing_ffmpeg_raises_a_runtime_error_instead_of_returning_silence(self):
        with mock.patch("shutil.which", return_value=None):
            with self.assertRaises(RuntimeError):
                termux_audio._decode_to_float32("/tmp/does-not-matter.m4a", 16000)

    def test_ffmpeg_failure_raises_with_its_stderr_instead_of_returning_silence(self):
        with mock.patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            failed = subprocess.CompletedProcess(args=[], returncode=1, stdout=b"", stderr=b"no such file")
            with mock.patch("subprocess.run", return_value=failed):
                with self.assertRaises(RuntimeError):
                    termux_audio._decode_to_float32("/tmp/does-not-exist.m4a", 16000)


class TestRecordClip(unittest.TestCase):
    def test_missing_termux_api_binary_raises_a_clear_runtime_error(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError()):
            with self.assertRaises(RuntimeError) as ctx:
                termux_audio._record_clip(1.0, 16000)
        self.assertIn("termux-microphone-record", str(ctx.exception))

    def test_recording_that_never_produces_a_file_returns_silence_not_an_error(self):
        # termux-microphone-record itself exits 0 (start/stop both succeed)
        # but if the Termux:API app declined mic permission, no file ever
        # appears -- that's "no audio captured", not a crash.
        with mock.patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0)):
            with mock.patch("time.sleep"):
                with mock.patch("os.path.exists", return_value=False):
                    result = termux_audio._record_clip(1.0, 16000)
        self.assertEqual(len(result), 0)


class TestSpeakTermux(unittest.TestCase):
    def test_returns_true_when_the_language_specific_call_succeeds(self):
        with mock.patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0)) as run:
            self.assertTrue(termux_audio.speak_termux("hello", "en"))
        run.assert_called_once()
        self.assertIn("-l", run.call_args[0][0])

    def test_falls_back_to_default_voice_when_language_flag_is_rejected(self):
        calls = [
            subprocess.CalledProcessError(1, ["termux-tts-speak", "-l", "xx", "hi"]),
            subprocess.CompletedProcess([], 0),
        ]

        def fake_run(*args, **kwargs):
            result = calls.pop(0)
            if isinstance(result, Exception):
                raise result
            return result

        with mock.patch("subprocess.run", side_effect=fake_run) as run:
            self.assertTrue(termux_audio.speak_termux("hi", "xx"))
        self.assertEqual(run.call_count, 2)

    def test_returns_false_when_the_binary_is_missing_entirely(self):
        with mock.patch("subprocess.run", side_effect=FileNotFoundError()):
            self.assertFalse(termux_audio.speak_termux("hello"))


if __name__ == "__main__":
    unittest.main()
`,
  },
  {
    path: "test/test_typed_input.py",
    contents: `# Copyright (c) 2026 MultiNiche AI. All rights reserved.
import queue
import time
import unittest
from unittest import mock

import main


class TestStdinReaderLoop(unittest.TestCase):
    def test_enqueues_each_nonempty_stripped_line_until_eof(self):
        lines = iter(["  list files  ", "", "cost", EOFError()])

        def fake_input():
            item = next(lines)
            if isinstance(item, Exception):
                raise item
            return item

        q = queue.Queue()
        main._stdin_reader_loop(input_fn=fake_input, out_queue=q)

        self.assertEqual(q.get_nowait(), "list files")
        self.assertEqual(q.get_nowait(), "cost")
        self.assertTrue(q.empty())

    def test_returns_immediately_on_first_eof_without_enqueuing_anything(self):
        def fake_input():
            raise EOFError()

        q = queue.Queue()
        main._stdin_reader_loop(input_fn=fake_input, out_queue=q)
        self.assertTrue(q.empty())


class TestTakeTypedRequest(unittest.TestCase):
    def setUp(self):
        # take_typed_request() reads the module-level queue -- swap it out
        # per test so tests can't see each other's leftover items.
        self._original_queue = main._typed_input_queue
        main._typed_input_queue = queue.Queue()

    def tearDown(self):
        main._typed_input_queue = self._original_queue

    def test_returns_none_when_nothing_has_been_typed(self):
        self.assertIsNone(main.take_typed_request())

    def test_returns_a_queued_line_without_blocking(self):
        main._typed_input_queue.put("check disk space")
        start = time.monotonic()
        result = main.take_typed_request()
        elapsed = time.monotonic() - start
        self.assertEqual(result, "check disk space")
        self.assertLess(elapsed, 0.5)


class TestStartStdinReader(unittest.TestCase):
    def setUp(self):
        self._original_thread = main._stdin_reader_thread

    def tearDown(self):
        main._stdin_reader_thread = self._original_thread

    def test_returns_false_and_starts_nothing_when_stdin_is_not_a_tty(self):
        main._stdin_reader_thread = None
        with mock.patch("sys.stdin") as fake_stdin:
            fake_stdin.isatty.return_value = False
            self.assertFalse(main.start_stdin_reader())
        self.assertIsNone(main._stdin_reader_thread)

    def test_returns_true_and_starts_a_thread_when_stdin_is_a_tty(self):
        main._stdin_reader_thread = None
        with mock.patch("sys.stdin") as fake_stdin:
            fake_stdin.isatty.return_value = True
            with mock.patch("threading.Thread") as fake_thread_cls:
                fake_thread = mock.Mock()
                fake_thread_cls.return_value = fake_thread
                self.assertTrue(main.start_stdin_reader())
        fake_thread.start.assert_called_once()

    def test_second_call_is_a_noop_once_already_started(self):
        main._stdin_reader_thread = mock.Mock()  # pretend already started
        with mock.patch("threading.Thread") as fake_thread_cls:
            self.assertTrue(main.start_stdin_reader())
        fake_thread_cls.assert_not_called()


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
    path: "scripts/setup-termux.sh",
    contents: `#!/usr/bin/env bash
# Copyright (c) 2026 MultiNiche AI. All rights reserved.
#
# Automated setup for Hey Term on Android, inside Termux.
#
# This is a different script from scripts/setup-linux.sh (not just "Linux
# with different package names") because voice I/O itself is different on
# Termux: there is no PortAudio and no espeak-ng speech engine reaching real
# hardware, so lib/audio.py and lib/speak.py both route through
# lib/termux_audio.py instead, which drives the mic and speaker through the
# separate Termux:API app's CLI tools (termux-microphone-record,
# termux-tts-speak). Those tools -- and ffmpeg, needed to decode what
# termux-microphone-record records -- are what this script installs;
# sounddevice/pyttsx3's system dependencies (portaudio, espeak-ng) are not
# needed here at all.
#
# Usage:
#   ./scripts/setup-termux.sh              # installs termux-api, ffmpeg, Python deps, .env
#   ./scripts/setup-termux.sh --yes        # don't prompt before pkg installs
#   ./scripts/setup-termux.sh --dry-run    # print what it would do, change nothing
set -euo pipefail

ASSUME_YES=0
DRY_RUN=0

usage() {
  echo "Usage: $0 [--yes] [--dry-run]"
  echo "  --yes     Don't prompt before running pkg install."
  echo "  --dry-run Print what would happen; run nothing that changes the system."
  exit "\${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
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

if [ -z "\${PREFIX:-}" ] || [ "\${PREFIX#*com.termux}" = "$PREFIX" ]; then
  echo "This doesn't look like Termux (no com.termux in \\$PREFIX)." >&2
  echo "On a regular Linux machine, use ./install.sh (scripts/setup-linux.sh) instead." >&2
  exit 1
fi

echo "== Hey Term Termux setup =="
echo

# --- 1. termux-api (the CLI side of the Termux:API bridge) + ffmpeg -----
echo "Note: this installs the *CLI tools* (termux-api package). You still need"
echo "the separate \\"Termux:API\\" app installed from the same store you got"
echo "Termux from (F-Droid or Play Store, matching publisher) -- the CLI tools"
echo "talk to that app, and can't reach the mic/speaker without it."
echo
if confirm_or_exit "Install termux-api and ffmpeg via pkg?"; then
  run pkg update -y
  run pkg install -y termux-api ffmpeg
fi
echo

# --- 2. Mic permission reminder -----------------------------------------
echo "Android will prompt for microphone permission the first time Hey Term"
echo "listens -- grant it, or set it manually in Android's App Info screen"
echo "for Termux:API if the prompt doesn't appear."
echo

# --- 3. Python dependencies -----------------------------------------------
echo "Installing Python dependencies..."
PIP_ARGS=""
if python3 -c "import sys; sys.exit(0 if sys.prefix != sys.base_prefix else 1)" 2>/dev/null; then
  echo "(virtual environment detected -- installing into it)"
else
  PIP_ARGS="--break-system-packages"
fi
run python3 -m pip install -q $PIP_ARGS -r "$(dirname "$0")/../requirements-termux.txt"

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
echo "  1. Install the \\"Termux:API\\" app if you haven't already (same store as Termux)."
echo "  2. Edit .env and set ANTHROPIC_API_KEY."
echo "  3. Run: python main.py --lang en   (or --lang es / fr / de / pt / it)"
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
