# multivault

A local, encrypted context snapshot of a folder and calendar file — three
ways to use it: a manual brief you paste into any AI chat, **automatically**
via a local MCP server, or **searched** via a local BM25-ranked index so
large folders return only what's actually relevant instead of everything.

No account. No OAuth. No cloud storage. The encrypted vault file lives on
your machine, and only your passphrase can open it. Neither MCP mode nor
search mode ever make a network call to serve context — the only network
activity anywhere in this package is an *optional*, localhost-only log line
to MultiWitness (sold separately), and even that never carries your actual
file/calendar content, only a note that context was served and how much.

## What this actually is

**Three modes, one underlying vault:**

- **CLI mode** — `vault sync` reads your folder and calendar file, encrypts
  what it found, and writes it to disk. `vault context` decrypts that
  snapshot and formats it for you to paste somewhere. This is the portable,
  works-anywhere path: any AI chat UI, any script, offline-safe.
- **MCP mode** — `vault-mcp` runs as a long-lived local server that an
  MCP-aware AI client calls directly. No encrypted snapshot, no passphrase
  at query time. See [MCP mode](#mcp-mode-automatic-context) below.
- **Search mode** — `vault context --query "..."` (or the MCP `get_context`
  tool's `query` argument) ranks your folder's content with BM25 — the same
  ranking family real search engines use — and returns only the relevant
  chunks. This is what makes large folders practical: see
  [Search mode: large folders](#search-mode-large-folders) below.

**What it watches, in all three modes:**
- **One local folder.** File names, sizes, and modified times are always
  included. For a small allowlist of plain-text formats (`.md`, `.txt`,
  `.csv`, `.json`) under 2MB, the full content is read for indexing/search;
  whole-folder mode's flat listing still caps its inline excerpt at 2000
  characters per file (search mode doesn't need that cap — see below).
  Anything else (images, PDFs, spreadsheets, executables, anything with
  "key", "secret", "credential", or "password" in the filename) is listed
  by name only; its contents are never read.
- **One `.ics` calendar file**, if you point one at it. This is a *file*, not
  a live Google/Outlook/etc. connection — most calendar apps have an
  export-to-`.ics` or auto-sync-to-file option; point `--ics` at that file.

**What it explicitly does NOT do:**
- No OAuth or live API connection to Google Calendar, Outlook, email, or
  anything else built into MultiVault itself — MCP and search modes close
  the manual-paste and everything-or-nothing gaps, not the local-files-only
  boundary. If your content lives in Google Docs specifically, note that
  Drive for Desktop sync does NOT solve this: a synced `.gdoc` is a small
  pointer file linking back to Google's servers, not the document's actual
  content. [`multivault-docs-bridge`](../multivault-docs-bridge) (sold
  separately, zero dependencies, same local-only ethos) is a real, tested
  fix for that specific gap — it exports Google Docs to real local `.md`
  files on a schedule, which MultiVault's own watcher then picks up like
  any other file. It's a separate tool on purpose: MultiVault's core stays
  free of the OAuth dependency that a Google integration requires, whether
  or not you happen to use Google Docs.
- No embeddings, no vector database, no call to any AI model to rank
  results — BM25 is a lexical/statistical ranker, running entirely in this
  process, in milliseconds, on data that never leaves your machine.
- Up to 20,000 files and 12 folder levels deep by default (v1 capped at 500
  files/3 levels) — raised because search mode's index absorbs the cost of
  a large folder incrementally instead of re-reading everything on every
  call. Still a real ceiling, not "unlimited," so a scan can't turn into an
  unbounded disk read.

If you need more than this (a live calendar API, semantic/embeddings-based
ranking), that's a real v4 conversation — this README describes what ships
today, not a roadmap promise.

## Search mode: large folders

Whole-folder mode (`vault context`, no query) is fine for a few dozen
files — it hands over everything. Past that, "everything" stops being
useful context and starts being noise an AI has to wade through. Search
mode fixes this by indexing your folder once and ranking chunks by
relevance to what you actually asked:

```
vault index                              # optional — builds automatically on first query
vault context --query "invoice overdue"  # ranked results, no passphrase needed
```

Search mode needs no passphrase at all — nothing is decrypted, nothing at
rest is read. It builds (or incrementally updates) a plain index file,
`index.json`, next to your vault.

**How the index stays current:**
- **On-demand** — every `--query` call brings the index up to date first,
  automatically. For an unchanged folder this costs one `stat()` call per
  file, not a re-read — cheap even at thousands of files.
- **In the background** — `vault watch` runs continuously and updates the
  index reactively as files change (via `fs.watch`), so queries never pay
  even the stat-scan cost. Useful for very large trees where you'd rather
  pay that cost once, off the critical path:
  ```
  vault watch    # Ctrl+C to stop
  ```

**How ranking works, plainly:** [BM25](https://en.wikipedia.org/wiki/Okapi_BM25) —
the same ranking family Elasticsearch and Lucene use by default. A chunk
that mentions your search terms often, in a short/focused piece of content,
ranks above one that mentions them once in a sprawling file. No AI model is
involved in ranking; it's a well-established statistical method, computed
entirely in this process.

**Large files are chunked, not truncated.** A 50-page document gets split
into overlapping pieces (paragraph-aware where possible), each ranked on
its own — so the one relevant paragraph on page 40 can outrank the whole
rest of the file, instead of being invisible past a flat character cutoff.

**Everything from v1/v2 still works unchanged.** `vault context` with no
`--query` returns the exact same whole-folder brief it always did — search
mode is purely additive.

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

- **`get_context`** — call with no arguments for the full folder/calendar
  brief (same content as CLI mode's `vault context`, fetched fresh, no
  staleness). Call with a `query` argument for ranked search instead — same
  BM25 index as CLI mode's `vault context --query`, useful for large
  folders where "everything" would be too much. Optional `topK` caps result
  count (default 8) and `format` picks `markdown` or `json`.
- **`vault_status`** — what folder/calendar this vault is configured to
  watch, whether MultiWitness logging is active, and the search index's
  current size/freshness — without reading any file contents.

Claude Code and other MCP-compatible clients follow the same shape — see
your client's own docs for exactly where its MCP server config lives.

**Why MCP mode needs no passphrase:** nothing is written to or read from an
encrypted file in this path — see `buildLiveContext()` in `lib/vault.mjs` if
you want to verify this yourself. An MCP server answers a live, in-process
query over stdio to a client already running as you, on your machine; there
is no "resting file" for encryption-at-rest to protect, unlike the portable
snapshot CLI mode produces. The search index (`index.json`) is likewise not
encrypted — see "Security model" below for why, and how to keep `--dest`
access-controlled if that matters on your machine.

## Provable logging with MultiWitness (optional)

Every cloud AI-memory product asks you to trust that it's using your data
correctly — you can't see their logs. MultiVault can do the opposite: log
every time context was served to a **tamper-evident, hash-chained** local
log via [MultiWitness](https://jblessd.com) (sold separately, same store),
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
vault index   [--dest <path>] [--folder <path>]
vault watch   [--dest <path>] [--folder <path>]
vault context [--dest <path>] [--query <text>] [--topk <n>] [--format text|markdown|json]
vault status  [--dest <path>]
vault-mcp     [--dest <path>]    # MCP server — see "MCP mode" above; not for interactive use
```

`vault status` reads only the unencrypted metadata file (last sync time, file
count) — it never needs your passphrase, so you can check freshness from a
script without exposing the secret. Its MCP-mode equivalent, `vault_status`,
also reports whether MultiWitness logging is active and the search index's
current size.

`vault context --query` needs no passphrase either — see "MCP mode"'s note
on why search mode has no resting file to protect.

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
- **`index.json`, search mode's index, is also not encrypted.** It holds the
  same plain-text content a `vault sync` snapshot would have shown anyway —
  same eligibility rules (extension allowlist, size cap, sensitive-filename
  exclusion — see `lib/scan.mjs`'s `shouldRead`) — just chunked and
  tokenized for ranking instead of encrypted at rest. This is a deliberate
  trade: encrypting the index would mean decrypting it (and re-encrypting
  after every incremental update) on every single query, defeating the
  point of an index being fast. If that trade doesn't work for your threat
  model, keep `--dest` access-controlled, same as `vault.meta.json` above.
- **CLI mode** makes no network request, ever. **MCP mode and search mode**
  talk only over stdio/local disk — also no network request to serve
  context. The one exception, and it's opt-in: if
  `MULTIWITNESS_INGEST_TOKEN` is set, MCP mode makes a `localhost`-only POST
  per context call, and that call never carries file/calendar content — only
  a count. Leave the token unset and there is zero network activity anywhere
  in this package, full stop.
- **Dependencies, honestly stated:** the CLI (`vault init/sync/context/status/
  index/watch`) and core library — encryption, folder scanning, `.ics`
  parsing, tokenizing, BM25 ranking, chunking, indexing, and the file
  watcher — are all zero-dependency, plain Node.js, nothing to audit beyond
  what ships with Node itself. Search mode (indexing, ranking, watching) is
  NOT an exception to this — it's pure JS, same as v1's core always was.
  **MCP mode is the one actual exception**: it depends on
  `@modelcontextprotocol/sdk` (Anthropic's real, published MCP SDK) and
  `zod`, because implementing the MCP protocol correctly from scratch would
  be reinventing a well-tested wheel, badly. If you don't use MCP mode, you
  never load either dependency.
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

Runs all seven suites (64 tests total):
- `test/run.mjs` — encryption round-trip, `.ics` parsing, folder scanning,
  and the full CLI-mode vault lifecycle, against real throwaway temp
  directories.
- `test/bm25.test.mjs` — the ranking engine itself, tested against known
  mathematical properties: diminishing returns on repeated terms (not raw
  linear term-frequency counting), length normalization (a long document
  mentioning a term once should rank below a short, focused one), and IDF
  behaving correctly at the edges (a term in every document shouldn't score
  negative, rarer terms should outrank common ones).
- `test/indexer.test.mjs` — building and incrementally updating the index
  against a real filesystem: adding, modifying, and deleting files, and
  specifically verifying that a deleted file's term-frequency contribution
  is actually cleaned up (not left dangling and silently skewing future
  rankings), and that an unchanged file triggers zero re-indexing work.
- `test/query.test.mjs` — `buildLiveContext`'s query path end-to-end,
  including confirming the no-query path is byte-for-byte the same v1/v2
  behavior it always was.
- `test/watcher.test.mjs` — the background file watcher, against real
  `fs.watch` events on a real temp directory: a newly-created file is
  picked up and becomes searchable without any manual trigger, and `stop()`
  actually tears the watcher down rather than leaving it running.
- `test/mcp.test.mjs` — MCP mode, driven by a **real
  `@modelcontextprotocol/sdk` `Client`** talking to the real `McpServer`
  over the SDK's in-memory transport — the same client/server code path a
  real MCP host exercises, including the new `query` argument returning
  ranked results through the actual protocol, not just the library function.
- `test/witness-log.test.mjs` — the MultiWitness integration's request
  contract (auth header, event shape, silent-fail behavior when
  unconfigured or unreachable), against a bare local HTTP server standing
  in for MultiWitness's real API — kept dependency-free from MultiWitness's
  own source since that's a separate product.
