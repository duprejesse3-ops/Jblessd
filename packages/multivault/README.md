# multivault

A local, encrypted context snapshot of one folder and one calendar file —
available two ways: as a manual brief you paste into any AI chat, or
**automatically**, via a local MCP server that lets Claude Desktop, Claude
Code, and other MCP-aware tools pull in your current context on their own,
live, with zero copy-pasting.

No account. No OAuth. No cloud storage. The encrypted vault file lives on
your machine, and only your passphrase can open it. The MCP server never
makes a network call to serve context — the only network activity anywhere
in this package is an *optional*, localhost-only log line to MultiWitness
(sold separately), and even that never carries your actual file/calendar
content, only a note that context was served and how much.

## What this actually is

**Two modes, one underlying vault:**

- **CLI mode** — `vault sync` reads your folder and calendar file, encrypts
  what it found, and writes it to disk. `vault context` decrypts that
  snapshot and formats it for you to paste somewhere. This is the portable,
  works-anywhere path: any AI chat UI, any script, offline-safe.
- **MCP mode** — `vault-mcp` runs as a long-lived local server that an
  MCP-aware AI client calls directly. No encrypted snapshot, no passphrase
  at query time: it re-scans your folder and re-reads your calendar file
  live, on every call, so it's always current — no manual `sync` step, ever.
  See [MCP mode](#mcp-mode-automatic-context) below.

**What it watches, in both modes:**
- **One local folder.** File names, sizes, and modified times are always
  included. For a small allowlist of plain-text formats (`.md`, `.txt`,
  `.csv`, `.json`) under 100KB, a short excerpt of the content is also
  included — capped at 2000 characters per file. Anything else (images,
  PDFs, spreadsheets, executables, anything with "key", "secret",
  "credential", or "password" in the filename) is listed by name only; its
  contents are never read.
- **One `.ics` calendar file**, if you point one at it. This is a *file*, not
  a live Google/Outlook/etc. connection — most calendar apps have an
  export-to-`.ics` or auto-sync-to-file option; point `--ics` at that file.

**What it explicitly does NOT do:**
- No OAuth or live API connection to Google Calendar, Outlook, email, or
  anything else — MCP mode closes the manual-paste gap, not the
  local-files-only boundary.
- No recursive scan past 3 folder levels deep, and no more than 500 files per
  call, so a huge folder can't turn a scan into a multi-minute disk read.

If you need more than this (a live calendar API, deeper folder trees, more
file types), that's a real v3 conversation — this README describes what
ships today, not a roadmap promise.

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

## MCP mode: automatic context

This is what closes the manual-paste gap. Instead of running `vault sync`
then `vault context` then copying the result somewhere, an MCP-aware client
calls MultiVault directly and gets your current folder/calendar state — no
copy-paste, and never stale, because it re-scans live on every call.

**Setup — one-time:**

```
node bin/vault.mjs init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
```

(Save the passphrase this prints if you also plan to use CLI mode — MCP mode
itself never asks for it.)

**Point your MCP client at it.** For Claude Desktop, add to your config file
(`claude_desktop_config.json` — Claude menu → Settings → Developer → Edit
Config):

```json
{
  "mcpServers": {
    "multivault": {
      "command": "node",
      "args": ["/absolute/path/to/multivault/bin/vault-mcp.mjs", "--dest", "/absolute/path/to/.multivault"]
    }
  }
}
```

Restart Claude Desktop. It will now be able to call two tools on its own,
whenever relevant to what you're asking:

- **`get_context`** — the live folder/calendar brief (same content as CLI
  mode's `vault context`, fetched fresh, no staleness).
- **`vault_status`** — what folder/calendar this vault is configured to
  watch, and whether MultiWitness logging is active (see below) — without
  reading any file contents.

Claude Code and other MCP-compatible clients follow the same shape — see
your client's own docs for exactly where its MCP server config lives.

**Why MCP mode needs no passphrase:** nothing is written to or read from an
encrypted file in this path — see `buildLiveContext()` in `lib/vault.mjs` if
you want to verify this yourself. An MCP server answers a live, in-process
query over stdio to a client already running as you, on your machine; there
is no "resting file" for encryption-at-rest to protect, unlike the portable
snapshot CLI mode produces.

## Provable logging with MultiWitness (optional)

Every cloud AI-memory product asks you to trust that it's using your data
correctly — you can't see their logs. MultiVault can do the opposite: log
every time context was served to a **tamper-evident, hash-chained** local
log via [MultiWitness](https://multinicheai.com) (sold separately, same store),
independently verifiable offline, by you, at any time.

**What gets logged:** only *that* context was served, when, and how much —
file count, event count, which folder. **Never the actual file contents,
excerpts, or calendar details.** The log answers "was my AI's context
genuinely local and genuinely current," not "what was in it."

**Setup:**

```
MULTIWITNESS_INGEST_TOKEN=<your MultiWitness ingest token> node bin/vault-mcp.mjs
```

Or add it to your MCP client's config alongside the command:

```json
{
  "mcpServers": {
    "multivault": {
      "command": "node",
      "args": ["/absolute/path/to/multivault/bin/vault-mcp.mjs", "--dest", "/absolute/path/to/.multivault"],
      "env": { "MULTIWITNESS_INGEST_TOKEN": "your-ingest-token-here" }
    }
  }
}
```

Verify the chain any time, independent of whether MultiVault or MultiWitness
are even running — from MultiWitness's own CLI:

```
node bin/witness.mjs verify
```

**Entirely optional.** No token set → MultiVault works exactly the same,
just without the audit trail. A missing token, an unreachable MultiWitness,
or a slow response all fail silently and instantly — logging what the AI saw
must never be able to block or delay serving it that context.

## Keeping it fresh (CLI mode)

If you're using MCP mode, skip this section — it re-scans live on every
call, so there's nothing to schedule.

For CLI mode, a vault is only as useful as its last sync. Three scheduling
adapters are included in `adapters/` — pick whichever fits your machine:

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
vault-mcp     [--dest <path>]    # MCP server — see "MCP mode" above; not for interactive use
```

`vault status` reads only the unencrypted metadata file (last sync time, file
count) — it never needs your passphrase, so you can check freshness from a
script without exposing the secret. Its MCP-mode equivalent, `vault_status`,
also reports whether MultiWitness logging is active.

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
- **CLI mode** makes no network request, ever. **MCP mode** talks only over
  stdio to whatever local client launched it — also no network request to
  serve context. The one exception, and it's opt-in: if
  `MULTIWITNESS_INGEST_TOKEN` is set, MCP mode makes a `localhost`-only POST
  per context call, and that call never carries file/calendar content — only
  a count. Leave the token unset and there is zero network activity anywhere
  in this package, full stop.
- **Dependencies, honestly stated:** the CLI (`vault init/sync/context/status`)
  and core library (`lib/crypto.mjs`, `lib/scan.mjs`, `lib/calendar.mjs`) are
  zero-dependency, same as v1 — plain Node.js, nothing to audit beyond what
  ships with Node itself. **MCP mode is the one exception**: it depends on
  `@modelcontextprotocol/sdk` (Anthropic's real, published MCP SDK) and
  `zod`, because implementing the MCP protocol correctly from scratch would
  be reinventing a well-tested wheel, badly. If you don't use MCP mode, you
  never load either dependency — `vault.mjs`, `crypto.mjs`, `scan.mjs`, and
  `calendar.mjs` don't import them.
- Read the source. It's plain JavaScript specifically so every claim above is
  easy to verify yourself rather than something you have to take on faith.

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

Runs all three suites (31 tests total):
- `test/run.mjs` — encryption round-trip, `.ics` parsing, folder scanning,
  and the full CLI-mode vault lifecycle, against real throwaway temp
  directories.
- `test/mcp.test.mjs` — MCP mode, driven by a **real
  `@modelcontextprotocol/sdk` `Client`** talking to the real `McpServer`
  over the SDK's in-memory transport — the same client/server code path a
  real MCP host exercises, including a test that adds a file mid-session
  with no restart and confirms `get_context` picks it up immediately.
- `test/witness-log.test.mjs` — the MultiWitness integration's request
  contract (auth header, event shape, silent-fail behavior when
  unconfigured or unreachable), against a bare local HTTP server standing
  in for MultiWitness's real API — kept dependency-free from MultiWitness's
  own source since that's a separate product.
