# multivault

A local, encrypted context snapshot of one folder and one calendar file —
turned into a short brief you can paste into any AI chat, or pipe into your
own API calls, instead of re-explaining your situation every time.

No account. No OAuth. No cloud storage. The vault file lives on your machine,
and only your passphrase can open it.

## What this actually is (v1 scope)

This is a **local snapshot tool**, not a live tunnel into your files or
calendar. `vault sync` reads your folder and calendar file once, encrypts
what it found, and writes it to disk. `vault context` decrypts that snapshot
and formats it. Nothing runs continuously in the background unless you set up
one of the [adapters](#keeping-it-fresh) to sync on a schedule — and even
then, each sync is a single read-and-encrypt pass, not an open connection.

**What it watches:**
- **One local folder.** File names, sizes, and modified times are always
  included. For a small allowlist of plain-text formats (`.md`, `.txt`,
  `.csv`, `.json`) under 100KB, a short excerpt of the content is also
  included — capped at 2000 characters per file. Anything else (images,
  PDFs, spreadsheets, executables, anything with "key", "secret",
  "credential", or "password" in the filename) is listed by name only; its
  contents are never read.
- **One `.ics` calendar file**, if you point one at it. This is a *file*, not
  a live Google/Outlook/etc. connection — most calendar apps have an
  export-to-`.ics` or auto-sync-to-file option; point `--ics` at that file
  and each `vault sync` will pick up whatever's in it.

**What it explicitly does NOT do in v1:**
- No OAuth or live API connection to Google Calendar, Outlook, email, or
  anything else.
- No automatic injection into a third-party AI tool. `vault context` prints a
  snippet — you paste it in, or pipe it into your own script (see below).
- No recursive scan past 3 folder levels deep, and no more than 500 files per
  sync, so a huge folder can't turn a sync into a multi-minute disk read.

If you need more than this (live calendar API, deeper folder trees, more file
types), that's a real v2 conversation — this README describes what v1 ships,
not a roadmap promise.

## Quick start

```
npm install    # nothing to install — zero dependencies, this just verifies your Node version
node bin/vault.mjs init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
```

This prints a **passphrase — save it now.** There is no recovery if you lose
it; see LICENSE.md.

```
node bin/vault.mjs sync
node bin/vault.mjs context
```

`vault context` prints a markdown brief. Paste it at the top of a chat with
any AI, or:

```
node bin/vault.mjs context --format json | your-script.js
```

## Piping into the Claude API

`vault context` is deliberately just stdout, so it composes with anything.
For example, prepending it to a Claude API call:

```js
import { execSync } from 'node:child_process'

const context = execSync('node bin/vault.mjs context', {
  env: { ...process.env, MULTIVAULT_PASSPHRASE: process.env.MULTIVAULT_PASSPHRASE },
}).toString()

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `${context}\n\nGiven the above, ...` }],
  }),
})
```

## Keeping it fresh

A vault is only as useful as its last sync. Three scheduling adapters are
included in `adapters/` — pick whichever fits your machine:

- `adapters/cron.sh` — any Linux/macOS machine with cron
- `adapters/launchd.plist` — macOS, preferred over cron there (survives sleep/wake)
- `adapters/windows-task.ps1` — Windows Task Scheduler

Each reads `MULTIVAULT_PASSPHRASE` from the environment rather than needing
you to type it in on every run. See the header comment in each file for setup
steps.

## Commands

```
vault init    [--folder <path>] [--ics <path>] [--dest <path>]
vault sync    [--dest <path>]
vault context [--dest <path>] [--format text|markdown|json]
vault status  [--dest <path>]
```

`vault status` reads only the unencrypted metadata file (last sync time, file
count) — it never needs your passphrase, so you can check freshness from a
script without exposing the secret.

## Security model, plainly stated

- The vault file (`vault.enc`) is AES-256-GCM encrypted. The key is derived
  from your passphrase with scrypt (a slow, memory-hard KDF specifically to
  raise the cost of brute-forcing a stolen vault file).
- The passphrase is generated randomly at `vault init` and shown to you
  **exactly once**. This tool never stores it anywhere — not in a config
  file, not in an environment file it writes, nowhere. You are responsible
  for saving it (a password manager is recommended).
- `vault.meta.json` next to the vault is **not** encrypted — it only holds
  the folder path, calendar path, and sync timestamps, so `vault status` can
  work without the passphrase. If those paths themselves are sensitive on
  your machine, keep `--dest` somewhere access-controlled.
- Nothing in this package makes a network request. Read the source — it's
  plain, dependency-free JavaScript specifically so that claim is easy to
  verify yourself rather than something you have to take on faith.

## Standalone binaries (optional)

By default this runs as a Node script (`node bin/vault.mjs ...`), same as the
rest of this catalog — no separate install step beyond having Node 18+.

If you'd rather have a double-clickable executable that doesn't require Node
to be installed, run this once **on each OS you want a binary for** (it uses
Node's own built-in Single Executable Application support, injecting into a
copy of whatever Node binary is already on that machine — so it isn't a
cross-compile, but it also needs no download of a foreign platform's Node):

```
npm install
npm run build:binary
```

- Run on Windows → `dist/vault-win-x64.exe`
- Run on a Mac → `dist/vault-macos-x64` or `dist/vault-macos-arm64`
- Run on Linux → `dist/vault-linux-x64`

Verified working end-to-end (full init/sync/context cycle against the
compiled binary, not just `--help`).

**Important:** these binaries are not code-signed. Windows SmartScreen will
show an "Unknown Publisher" warning, and macOS Gatekeeper will refuse to open
an app from an "unidentified developer" until you right-click → Open once (or
run `xattr -d com.apple.quarantine <path>`). This is standard for any
unsigned binary, not a bug — code-signing certificates from Microsoft and
Apple are a separate purchase if you want that warning gone.

## Testing

```
npm test
```

Runs the adapter-free unit tests in `test/run.mjs` — encryption round-trip,
`.ics` parsing, and folder scanning against a throwaway temp directory.
