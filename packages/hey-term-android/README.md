# Hey Term (Android app) -- v1

A real, installable Android app version of Hey Term -- not a wrapper
around Termux, not a bridge into a separate app. This is a standalone
Kotlin app that:

- Listens for "hey term" in the background via a foreground service (no
  terminal window to keep open)
- Transcribes speech with whisper.cpp, linked directly into the app as a
  native library (JNI) -- same real, self-built, MIT-licensed engine as
  the Termux version, just compiled in rather than run as a separate
  process
- Plans requests by calling Claude's API directly (same prompt/contract as
  the desktop and Termux versions' `lib/agent.py`)
- Runs the resulting shell commands through Android's own `/system/bin/sh`
  (present on every device -- see `DeviceShell.kt` for why this isn't
  "borrowing" the way the OS speech recognizer was rejected earlier)
- Confirms before running: tap Confirm/Cancel on a notification for
  ordinary commands, or type the literal word `CONFIRM` into the app for
  anything matching the same short dangerous-command blocklist the other
  versions use
- Keeps the same plain-JSONL audit log

## What's different from the desktop/Termux versions (v1 scope)

- **English only.** No i18n yet -- the desktop/Termux versions' 6-language
  support isn't ported. Straightforward to add later; left out here to
  actually ship a working v1.
- **Runs in its own sandboxed workspace**, not your whole device
  filesystem. This is an Android OS rule for any regular, non-rooted app --
  not something this build chose to leave out. `Config.workDir()` is that
  workspace (under the app's private storage).
- **No jobs/cost/revert meta-commands yet** -- just the core wake -> plan
  -> confirm -> run -> speak loop.
- **Debug-signed only.** Fine for sideloading onto your own phone; a real
  release build (your own keystore) is a later step if you want to
  distribute this more widely.

## Building

Not something to build locally unless you already have the Android
SDK/NDK set up -- `.github/workflows/build-hey-term-android.yml` builds it
in the cloud on every push to `packages/hey-term-android/**` (or trigger it
manually from the Actions tab). Download the resulting APK from the
run's build artifacts and sideload it.

First build will very likely need at least one round of fixes -- none of
this was compiled locally before being written (the sandbox that wrote it
has no route to Google's Android SDK/NDK servers), so the CI log is the
first real compiler feedback this code gets.

## Setup on your phone

1. Install the APK (enable "install unknown apps" for whatever app you
   downloaded it with).
2. Open Hey Term, grant microphone + notification permissions when asked.
3. Paste in your Anthropic API key when prompted (stored only on-device,
   in SharedPreferences -- never compiled into the app).
4. Tap "Start Listening."
