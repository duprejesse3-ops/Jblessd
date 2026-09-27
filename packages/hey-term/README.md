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
   request is ambiguous. It never guesses on unclear requests.
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

Either one leaves you with a ready `.env` (add your API key) and the
Whisper model already downloaded. Skip straight to [step 4](#4-run-it)
below.

`install.sh`/`install.ps1` are thin wrappers -- they just forward whatever
you pass to `scripts/setup-linux.sh` / `scripts\setup-windows.ps1`, so
calling those directly does exactly the same thing if you'd rather.

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

#### 2. Install

Either:
```
pip install -r requirements.txt
```
or, as an installed command (`hey-term` on your PATH afterward):
```
pip install -e .
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

Say "Hey Term", wait for it to prompt you, say what you want. Ctrl+C to
quit, or say the wake word then "stop listening" (or its translated
equivalent) for a spoken sign-off.

## Testing

```
python test/run.py
```

73 tests, all pure-logic (plan parsing, wake-word matching, confirmation
parsing in all six languages, i18n key-consistency across languages, the
safety blocklist, the audit log, and the command executor -- including a
regression test that bash-only syntax actually runs correctly) -- nothing
here needs a microphone or speaker, so it runs identically in CI or on a
machine with no audio hardware at all.

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
