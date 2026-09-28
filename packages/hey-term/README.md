# Hey Term

*Copyright (c) 2026 MultiNiche AI. All rights reserved. See LICENSE.md.*

Say **"Hey Term"**, then say what you want done, in whichever language you
have it configured for. It transcribes you, asks Claude to turn that into
exact shell command(s) plus a one-sentence summary spoken back in your
language, and only runs anything after you say **"confirm"** (or its
equivalent in that language). Say "cancel" -- or don't answer clearly -- and
nothing runs.

```
you:      "Hey Term"
Hey Term: "Yes?"
you:      "list the files in this folder"
Hey Term: "Lists every file in the current folder. Say confirm to run it, or cancel."
you:      "confirm"
Hey Term: [runs `ls -la` in real bash, reads back a short result]
```

A short list of genuinely destructive commands (wiping a disk, force-pushing
over a branch, dropping a database, etc.) is never run on a spoken "confirm"
alone -- those require typing the word `CONFIRM` on the keyboard instead. See
`lib/config.py`'s `DANGEROUS_PATTERNS` to see or extend that list.

**You don't have to speak at all.** Type a request and press Enter any time
-- no need to say "Hey Term" first -- and it's picked up the same as if it
had been spoken (checked between wake-word listening chunks, so there's up
to one chunk's worth of delay, a couple of seconds by default). This only
needs an interactive terminal; it's silently unavailable when stdin is
piped, redirected, or otherwise non-interactive (voice still works either
way). Confirmations themselves are unaffected by this -- an ordinary
command still expects a spoken "confirm"/"cancel", and only the dangerous-
command blocklist above still asks for typed `CONFIRM`.

Every wake, request, plan, confirmation, and command run is appended to a
plain-text audit log (`.hey-term-audit.jsonl` by default) -- a full record of
what Hey Term has ever been asked to do and whether it actually did it.

## Language support

Six languages ship with translated prompts and confirm/cancel words:
English, Spanish, French, German, Portuguese, Italian.

```
python main.py --lang es          # speak Spanish after the wake word
python main.py --lang auto        # detect the spoken language per request
python main.py --list-languages   # see what's translated
```

The wake phrase itself, "Hey Term," is **not** translated -- like "Hey Siri"
or "Hey Google," it's the product's name and is said the same way whatever
language you're speaking otherwise (see `lib/i18n.py`'s module docstring for
why, and `lib/transcribe.py`'s `transcribe_wake()` for how that's enforced).

Requests spoken in a language that isn't in that list of six still get
planned and run correctly -- Claude and Whisper both understand far more
languages than Hey Term has translated UI strings for -- it just falls back
to speaking prompts and reading commands back in English until someone adds
that language. **Adding a language** is one edit: add an entry to the
`LANGUAGES` dict in `lib/i18n.py` with the same keys as the `"en"` entry
(`test/test_i18n.py` enforces every language has exactly the same keys, so a
missing one fails the test suite instead of failing silently at runtime).

## Linux / bash and Windows / PowerShell

The shell invocation is explicit, not left to Python's default: on Linux/
Kali/macOS it always runs your command through real `bash` (not whatever
`/bin/sh` happens to symlink to -- `dash` on Debian and Kali, which breaks
on bash-only syntax like `[[ ]]`, arrays, or `source`). On Windows it always
runs through real PowerShell, not `cmd.exe`. This matters because the
planning step (`lib/agent.py`) is told which shell it's targeting and may
use shell-specific syntax; the executor (`lib/executor.py`) guarantees that's
actually what runs it. See `test/test_executor.py`'s
`test_actually_runs_real_bash_not_posix_sh` for the regression test.

## How it works

1. **Wake word** (`lib/wake.py`) -- the mic is transcribed in short rolling
   chunks (local, offline, via `faster-whisper`, always decoded as English)
   and checked for "Hey Term" with a fuzzy match, so a slightly-off
   transcription ("hey, term." / "a term") still triggers it.
2. **Your request** (`lib/audio.py`, `lib/transcribe.py`) -- once woken, it
   records until you stop talking (not just the instant you pause) and
   transcribes the whole thing in your configured language.
3. **Planning** (`lib/agent.py`) -- your request goes to Claude's API (plain
   HTTPS, no SDK) with instructions to either return an exact command plan
   plus a summary in your language, or ask a clarifying question if the
   request is ambiguous. It never guesses on unclear requests. Recent turns
   go with it (see "Conversational memory" below), so a clarifying answer or
   a follow-up like "undo that" is understood in context.
4. **Confirmation** (`lib/confirm.py`) -- the summary is spoken back, and it
   listens for an unambiguous yes/no in your language. A mumble, silence, or
   contradictory reply all count as "unclear" and cancel -- only a clear
   confirm runs anything.
5. **Execution** (`lib/executor.py`) -- commands run one at a time in
   `WORK_DIR` via real bash/PowerShell; if one fails, the rest are skipped
   rather than run against a half-finished state.
6. **Audit** (`lib/audit.py`) -- every step above appends a JSON line to the
   audit log, independent of whether the request succeeded, was clarified,
   or was canceled.

## Conversational memory

The back-and-forth with Claude within one run is remembered (`main.py`'s
`_conversation_history`, capped at the most recent 12 messages so it doesn't
grow -- and cost -- indefinitely) and sent along with each new request, so:

```
you:      "Hey Term"
Hey Term: "Yes?"
you:      "delete the log file"
Hey Term: "Which log file did you mean?"
you:      "Hey Term"
Hey Term: "Yes?"
you:      "the one in /var/log/app"
Hey Term: "Deletes /var/log/app/app.log. Say confirm to run it, or cancel."
```

answering a clarifying question, or referring back to what just ran ("undo
that", "run it again but in the background") actually lands in context
instead of Claude re-planning from nothing each time. It resets on "stop
listening" (or its translated equivalent) -- the one phrase that already
means "start over" -- and isn't affected by the offline fallback below,
which never talks to Claude in the first place. `jobs`/`cost`/`revert` don't
touch it either, since they're answered locally and never go to Claude.

## Safety net: reverting what just ran

Before running a confirmed plan, Hey Term takes a snapshot of `git status`
in `WORK_DIR` (see `lib/snapshot.py`) -- if it's not a git repository, this
is a silent no-op, everything else works exactly the same. After running,
it diffs against that snapshot to see which paths changed, and says so:

```
    $ npm install some-package
    (2 file(s) changed -- say "revert" to undo)
```

Say **"revert"** (or "undo that") right after, and it undoes just that run:
a brand-new file gets deleted, a modified tracked file gets restored from
`HEAD` via `git checkout --`. A file that was *already* dirty before Hey
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

```
you: "Hey Term"
you: "run the test suite in the background"
Hey Term: "Started in the background. Say jobs to check on it."
```

It's still voice-confirmed exactly like any other request first -- background
only changes what happens *after* you confirm. Say **"jobs"** any time to see
what's running or finished (`lib/jobs.py`); each job's full output is logged
to `.hey-term-jobs/<job-id>/output.log` in `WORK_DIR`.

## Session cost

Hey Term is bring-your-own-`ANTHROPIC_API_KEY` -- your key, your bill, no
markup. Every planning call's token usage is used to keep a running,
approximate cost total for this project (`lib/cost.py`), persisted to
`.hey-term-cost.json`. Say **"cost"** any time to hear it. This is an
estimate from Anthropic's published per-token pricing, not a real-time
bill -- check the Anthropic console for the actual number.

## Working without Claude's API

If Claude's API can't be reached (no key set, or a network failure), Hey
Term doesn't just fail every request -- a small, fixed set of common,
read-only requests (`lib/offline_fallback.py`) still work by matching
directly to a safe command instead of asking Claude to plan one: listing
files, git status, disk space, the current date, and a handful of others.
Every one of those is read-only by construction; nothing in that fallback
table writes, deletes, or installs anything, since there's no Claude call to
reason about whether a given request is actually safe once it's this far
outside the normal planning path. Anything outside that small list still
needs a working connection to Claude, and Hey Term says so plainly instead
of guessing at a command.

## Custom "always ask me to type it" commands

The built-in list of commands that require typed `CONFIRM` instead of a
spoken one (`lib/config.py`'s `DANGEROUS_PATTERNS`) only covers things that
can take down an entire disk or OS install -- it can't know your production
database's actual name or which branch is your release branch. Add your own:

```
# EXTRA_DANGEROUS_PATTERNS in .env, comma-separated:
EXTRA_DANGEROUS_PATTERNS=drop prod_customers,git push origin release

# or a longer list, one per line, in ~/.hey-term/dangerous_patterns.txt
# (# comments allowed; set PATTERNS_FILE in .env to use a different path)
```

Both are purely additive -- neither can remove a built-in pattern.

## Setup

Unzip `hey-term.zip` (your purchase download) anywhere, then `cd` into that
folder for every command below.

### Option A: one command (recommended)

`install.sh` (Linux/Kali/WSL) and `install.ps1` (Windows) run the full setup
for you -- system audio deps, best-effort voice packs for whichever
languages you ask for, Python dependencies, bootstrapping `.env`, and
pre-downloading the Whisper model.

**Linux / Kali / WSL:**
```
chmod +x install.sh
./install.sh                    # English only, asks before installing
./install.sh --langs es,fr,de   # also install voice packs for these
./install.sh --yes              # don't prompt before apt installs
./install.sh --dry-run          # preview what it would do, changes nothing
sudo ./install.sh --langs es    # use sudo if you're not already root
```
It installs `portaudio19-dev`, `bash`, and `espeak-ng` (the baseline that
covers every language on its own), then searches `apt-cache` for whatever
higher-quality `mbrola` voice packages actually exist for your requested
languages on your apt mirror (package names like `mbrola-es1` or `mbrola-
fr4` aren't uniform across languages or releases, so it looks them up live
rather than guessing) and offers to install those too. Everything is
skippable and `--dry-run` prints the plan without touching your system.

**Windows (PowerShell):**
```
.\install.ps1                              # English only
.\install.ps1 -Langs es,fr,de              # also request voice packs
.\install.ps1 -Langs es -SkipCapabilities  # skip the admin-only step
```
The voice-pack step (installing Windows' built-in Speech/SAPI5 language
capability, e.g. `es-ES`) needs an **elevated (Run as Administrator)**
PowerShell and internet access. If you didn't launch it elevated, that one
step is skipped automatically with on-screen instructions for adding the
voice by hand instead (Settings > Time & Language > Language & region > Add
a language > check "Text-to-speech") -- everything else (Python deps,
`.env`, the Whisper model) still runs normally either way.

**Android (Termux):**
```
chmod +x install.sh
./install.sh                    # detects Termux automatically, asks before installing
./install.sh --yes              # don't prompt before pkg installs
./install.sh --dry-run          # preview what it would do, changes nothing
```
`install.sh` detects Termux (via `$PREFIX`) and runs `scripts/setup-termux.sh`
instead of the Linux script -- it installs `termux-api` and `ffmpeg` via
`pkg` rather than `portaudio19-dev`/`espeak-ng`, since voice on Android goes
through a completely different path (see "Voice on Android (Termux)" below),
then Python dependencies from `requirements-termux.txt`, `.env`, and the
Whisper model, same as the other platforms.

Either one leaves you with a ready `.env` (add your API key) and the
Whisper model already downloaded. Skip straight to [step 4](#4-run-it)
below.

`install.sh`/`install.ps1` are thin wrappers -- they just forward whatever
you pass to `scripts/setup-linux.sh` / `scripts/setup-termux.sh` /
`scripts\setup-windows.ps1`, so calling those directly does exactly the same
thing if you'd rather.

### Voice on Android (Termux)

Termux itself has no access to the phone's microphone or speaker -- nothing
running inside it can reach either one directly. The bridge is a separate
app, **Termux:API** (same publisher as Termux, get it from the same store --
F-Droid or Play Store, don't mix sources), plus its CLI package:

```
pkg install termux-api ffmpeg
```

(`./install.sh` does this for you.) Once both the app and the CLI package
are installed, grant microphone permission the first time Android prompts
for it (or set it by hand under Android's App Info screen for Termux:API if
the prompt never appears). `ffmpeg` decodes what the mic-recording tool
captures into the format the rest of Hey Term expects -- it's a real
dependency, not optional.

Recording works in short clips rather than one continuous stream (that's a
limitation of `termux-microphone-record` itself, which only starts/stops a
recording to a file), so silence detection on Termux is coarser than on
desktop -- it can include up to one extra clip's worth of trailing silence.
Speech is still accurate; it just doesn't cut off the instant you stop
talking, the same trade-off as pausing mid-sentence on desktop.

If you see `(speech output unavailable: termux-tts-speak failed -- ...)` or
a `termux-microphone-record failed` error, it almost always means the
Termux:API **app** isn't installed, or the mic permission was denied -- the
CLI package alone can't do either without it.

### Option B: fully manual

#### 1. Install system audio dependencies

**Windows:** nothing extra needed -- `sounddevice` uses your existing audio
drivers, and text-to-speech uses Windows' built-in SAPI5 voices. To add a
non-English voice: Settings > Time & Language > Language & region > Add a
language > pick it > make sure "Text-to-speech" is checked (this is exactly
what `scripts/setup-windows.ps1` automates when run as Administrator).

**WSL (Ubuntu on Windows):** WSL doesn't have direct microphone access by
default. Recent Windows 11 builds with WSLg pass audio through automatically;
if `python main.py` can't see your mic, either enable WSLg audio (`wsl
--update`, then restart), or run this natively on Windows Python instead of
inside WSL for the audio side, even if you do your other dev work in WSL.

**Kali / other Linux:**
```
sudo apt-get install portaudio19-dev bash espeak-ng
```
(`bash` is almost always already installed -- this is just making sure it's
actually there, since the executor now depends on it explicitly rather than
whatever `/bin/sh` happens to be. `espeak-ng` gives more complete non-English
voices than plain `espeak` if you're using `--lang` for something other than
English.)

For better-quality voices than plain `espeak-ng`, look for an `mbrola` voice
package matching your language -- e.g. `apt-cache search mbrola-es` for
Spanish, `mbrola-fr` for French, `mbrola-de` for German, `mbrola-pt`/`mbrola-
br` for Portuguese, `mbrola-it` for Italian -- and `sudo apt-get install`
whichever package names it finds. `scripts/setup-linux.sh --langs <codes>`
does exactly this search-and-install automatically.

**Android (Termux):** different dependencies entirely -- see "Voice on
Android (Termux)" above. Install `termux-api` and `ffmpeg` via `pkg`, not
`portaudio19-dev`/`espeak-ng`.

#### 2. Install

Either (Windows/Linux/macOS):
```
pip install -r requirements.txt
```
or, as an installed command (`hey-term` on your PATH afterward):
```
pip install -e .
```
On Termux, use the Termux-specific requirements file instead (it omits
`sounddevice`/`pyttsx3`, which have no Android build):
```
pip install -r requirements-termux.txt
```

The first run downloads the local Whisper model (`base`, the multilingual
variant, ~150MB) -- a one-time download, cached afterward, and runs fully
offline after that (no audio ever leaves your machine for transcription).

#### 3. Set your API key

```
cp .env.example .env
```
Then edit `.env` and paste in your key from console.anthropic.com. See
`.env.example` for the full list of optional settings.

### 4. Run it

```
python main.py                      # English, current directory, default wake word
python main.py --lang es            # Spanish
python main.py --work-dir ~/projects/my-repo
hey-term --lang fr                  # if installed with `pip install -e .`
```

Say "Hey Term", wait for it to prompt you, say what you want -- or just type
your request and press Enter, no wake word needed. Ctrl+C to quit, or say
the wake word then "stop listening" (or its translated equivalent) for a
spoken sign-off.

## Testing

```
python test/run.py
```

142 tests, all pure-logic (plan parsing, wake-word matching, confirmation
parsing in all six languages, i18n key-consistency across languages, the
safety blocklist, the audit log, the command executor -- including a
regression test that bash-only syntax actually runs correctly -- the revert
safety net, background jobs, cost tracking, the offline fallback, the typed-
request reader thread/queue, conversational-memory bookkeeping (forwarding,
remembering, capping, and resetting history -- both at the `plan()` level
and the `handle_request()` level), and the Termux audio bridge's command-
building/error-handling/decode logic) -- nothing here needs a real
microphone, speaker, or a phone, so it runs identically in CI, on a machine
with no audio hardware at all, or in this sandbox (the one exception,
decoding a real audio file through the actual `ffmpeg` binary, is skipped
automatically
if `ffmpeg` isn't on the `PATH`).

## Tuning

Everything in `.env.example` has a default in `lib/config.py`, and the most
common ones are also CLI flags (`--lang`, `--wake-word`, `--work-dir`,
`--audit-log`; run `python main.py --help`). The ones most worth adjusting
after trying it:

- `WAKE_MATCH_THRESHOLD` (default `0.72`) -- lower it if the wake word isn't
  triggering reliably in your voice/mic/room; raise it if it's triggering on
  unrelated speech.
- `SILENCE_RMS_THRESHOLD` / `SILENCE_HOLD_SECONDS` -- how sensitive silence
  detection is, and how long a pause has to last before it decides you're
  done talking.
- `WHISPER_MODEL_SIZE` -- `base` is a good speed/accuracy default across
  languages; `small` is more accurate but slower per chunk; `tiny` is faster
  but misses more words (all multilingual variants -- don't use an `*.en`
  model if you're using anything other than `LANGUAGE=en`).

## What this doesn't do (yet)

- No dedicated wake-word engine like Porcupine -- it re-transcribes short
  audio chunks continuously instead, which is simpler to set up (no
  third-party wake-word training/console account needed) but uses more CPU
  while idle than a dedicated wake-word model would.
- Text-to-speech quality/availability in a given language depends on which
  voices are installed on the OS (Windows SAPI5 languages, or `espeak-ng`
  language packs on Linux) -- the planning and transcription work in far
  more languages than will get a natural-sounding spoken voice back.
- Runs in the foreground of one terminal, not as a background service.
- The dangerous-command blocklist in `lib/config.py` is a short, specific
  safety net for catastrophic single commands -- it is not a general security
  boundary, and voice confirmation for everything else is still just that:
  confirmation, not a sandbox. Point `WORK_DIR` at a folder you're
  comfortable running arbitrary confirmed commands in.
