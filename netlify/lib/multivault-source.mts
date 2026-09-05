// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multivault/tools/embed-source.mjs from the real
// package source. Regenerate after changing the package:
//
//   node packages/multivault/tools/embed-source.mjs
//
// This is the payload for the MultiVault product (SKU AI-CN-008): the
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

export const MULTIVAULT_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# multivault

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

- **CLI mode** — \`vault sync\` reads your folder and calendar file, encrypts
  what it found, and writes it to disk. \`vault context\` decrypts that
  snapshot and formats it for you to paste somewhere. This is the portable,
  works-anywhere path: any AI chat UI, any script, offline-safe.
- **MCP mode** — \`vault-mcp\` runs as a long-lived local server that an
  MCP-aware AI client calls directly. No encrypted snapshot, no passphrase
  at query time. See [MCP mode](#mcp-mode-automatic-context) below.
- **Search mode** — \`vault context --query "..."\` (or the MCP \`get_context\`
  tool's \`query\` argument) ranks your folder's content with BM25 — the same
  ranking family real search engines use — and returns only the relevant
  chunks. This is what makes large folders practical: see
  [Search mode: large folders](#search-mode-large-folders) below.

**What it watches, in all three modes:**
- **One local folder.** File names, sizes, and modified times are always
  included. For a small allowlist of plain-text formats (\`.md\`, \`.txt\`,
  \`.csv\`, \`.json\`) under 2MB, the full content is read for indexing/search;
  whole-folder mode's flat listing still caps its inline excerpt at 2000
  characters per file (search mode doesn't need that cap — see below).
  Anything else (images, PDFs, spreadsheets, executables, anything with
  "key", "secret", "credential", or "password" in the filename) is listed
  by name only; its contents are never read.
- **One \`.ics\` calendar file**, if you point one at it. This is a *file*, not
  a live Google/Outlook/etc. connection — most calendar apps have an
  export-to-\`.ics\` or auto-sync-to-file option; point \`--ics\` at that file.

**What it explicitly does NOT do:**
- No OAuth or live API connection to Google Calendar, Outlook, email, or
  anything else — MCP and search modes close the manual-paste and
  everything-or-nothing gaps, not the local-files-only boundary.
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

Whole-folder mode (\`vault context\`, no query) is fine for a few dozen
files — it hands over everything. Past that, "everything" stops being
useful context and starts being noise an AI has to wade through. Search
mode fixes this by indexing your folder once and ranking chunks by
relevance to what you actually asked:

\`\`\`
vault index                              # optional — builds automatically on first query
vault context --query "invoice overdue"  # ranked results, no passphrase needed
\`\`\`

Search mode needs no passphrase at all — nothing is decrypted, nothing at
rest is read. It builds (or incrementally updates) a plain index file,
\`index.json\`, next to your vault.

**How the index stays current:**
- **On-demand** — every \`--query\` call brings the index up to date first,
  automatically. For an unchanged folder this costs one \`stat()\` call per
  file, not a re-read — cheap even at thousands of files.
- **In the background** — \`vault watch\` runs continuously and updates the
  index reactively as files change (via \`fs.watch\`), so queries never pay
  even the stat-scan cost. Useful for very large trees where you'd rather
  pay that cost once, off the critical path:
  \`\`\`
  vault watch    # Ctrl+C to stop
  \`\`\`

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

**Everything from v1/v2 still works unchanged.** \`vault context\` with no
\`--query\` returns the exact same whole-folder brief it always did — search
mode is purely additive.

## Quick start

\`\`\`
npm install    # nothing to install — zero dependencies, this just verifies your Node version
node bin/vault.mjs init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
\`\`\`

This prints a **passphrase — save it now.** There is no recovery if you lose
it; see LICENSE.md.

\`\`\`
node bin/vault.mjs sync
node bin/vault.mjs context
\`\`\`

\`vault context\` prints a markdown brief. Paste it at the top of a chat with
any AI, or:

\`\`\`
node bin/vault.mjs context --format json | your-script.js
\`\`\`

## Piping into the Claude API

\`vault context\` is deliberately just stdout, so it composes with anything.
For example, prepending it to a Claude API call:

\`\`\`js
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
    messages: [{ role: 'user', content: \`\${context}\\n\\nGiven the above, ...\` }],
  }),
})
\`\`\`

## MCP mode: automatic context

This is what closes the manual-paste gap. Instead of running \`vault sync\`
then \`vault context\` then copying the result somewhere, an MCP-aware client
calls MultiVault directly and gets your current folder/calendar state — no
copy-paste, and never stale, because it re-scans live on every call.

**Setup — one-time:**

\`\`\`
node bin/vault.mjs init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
\`\`\`

(Save the passphrase this prints if you also plan to use CLI mode — MCP mode
itself never asks for it.)

**Point your MCP client at it.** For Claude Desktop, add to your config file
(\`claude_desktop_config.json\` — Claude menu → Settings → Developer → Edit
Config):

\`\`\`json
{
  "mcpServers": {
    "multivault": {
      "command": "node",
      "args": ["/absolute/path/to/multivault/bin/vault-mcp.mjs", "--dest", "/absolute/path/to/.multivault"]
    }
  }
}
\`\`\`

Restart Claude Desktop. It will now be able to call two tools on its own,
whenever relevant to what you're asking:

- **\`get_context\`** — call with no arguments for the full folder/calendar
  brief (same content as CLI mode's \`vault context\`, fetched fresh, no
  staleness). Call with a \`query\` argument for ranked search instead — same
  BM25 index as CLI mode's \`vault context --query\`, useful for large
  folders where "everything" would be too much. Optional \`topK\` caps result
  count (default 8) and \`format\` picks \`markdown\` or \`json\`.
- **\`vault_status\`** — what folder/calendar this vault is configured to
  watch, whether MultiWitness logging is active, and the search index's
  current size/freshness — without reading any file contents.

Claude Code and other MCP-compatible clients follow the same shape — see
your client's own docs for exactly where its MCP server config lives.

**Why MCP mode needs no passphrase:** nothing is written to or read from an
encrypted file in this path — see \`buildLiveContext()\` in \`lib/vault.mjs\` if
you want to verify this yourself. An MCP server answers a live, in-process
query over stdio to a client already running as you, on your machine; there
is no "resting file" for encryption-at-rest to protect, unlike the portable
snapshot CLI mode produces. The search index (\`index.json\`) is likewise not
encrypted — see "Security model" below for why, and how to keep \`--dest\`
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

\`\`\`
MULTIWITNESS_INGEST_TOKEN=<your MultiWitness ingest token> node bin/vault-mcp.mjs
\`\`\`

Or add it to your MCP client's config alongside the command:

\`\`\`json
{
  "mcpServers": {
    "multivault": {
      "command": "node",
      "args": ["/absolute/path/to/multivault/bin/vault-mcp.mjs", "--dest", "/absolute/path/to/.multivault"],
      "env": { "MULTIWITNESS_INGEST_TOKEN": "your-ingest-token-here" }
    }
  }
}
\`\`\`

Verify the chain any time, independent of whether MultiVault or MultiWitness
are even running — from MultiWitness's own CLI:

\`\`\`
node bin/witness.mjs verify
\`\`\`

**Entirely optional.** No token set → MultiVault works exactly the same,
just without the audit trail. A missing token, an unreachable MultiWitness,
or a slow response all fail silently and instantly — logging what the AI saw
must never be able to block or delay serving it that context.

## Keeping it fresh (CLI mode)

If you're using MCP mode, skip this section — it re-scans live on every
call, so there's nothing to schedule.

For CLI mode, a vault is only as useful as its last sync. Three scheduling
adapters are included in \`adapters/\` — pick whichever fits your machine:

- \`adapters/cron.sh\` — any Linux/macOS machine with cron
- \`adapters/launchd.plist\` — macOS, preferred over cron there (survives sleep/wake)
- \`adapters/windows-task.ps1\` — Windows Task Scheduler

Each reads \`MULTIVAULT_PASSPHRASE\` from the environment rather than needing
you to type it in on every run. See the header comment in each file for setup
steps.

## Commands

\`\`\`
vault init    [--folder <path>] [--ics <path>] [--dest <path>]
vault sync    [--dest <path>]
vault index   [--dest <path>] [--folder <path>]
vault watch   [--dest <path>] [--folder <path>]
vault context [--dest <path>] [--query <text>] [--topk <n>] [--format text|markdown|json]
vault status  [--dest <path>]
vault-mcp     [--dest <path>]    # MCP server — see "MCP mode" above; not for interactive use
\`\`\`

\`vault status\` reads only the unencrypted metadata file (last sync time, file
count) — it never needs your passphrase, so you can check freshness from a
script without exposing the secret. Its MCP-mode equivalent, \`vault_status\`,
also reports whether MultiWitness logging is active and the search index's
current size.

\`vault context --query\` needs no passphrase either — see "MCP mode"'s note
on why search mode has no resting file to protect.

## Security model, plainly stated

- The vault file (\`vault.enc\`) is AES-256-GCM encrypted. The key is derived
  from your passphrase with scrypt (a slow, memory-hard KDF specifically to
  raise the cost of brute-forcing a stolen vault file).
- The passphrase is generated randomly at \`vault init\` and shown to you
  **exactly once**. This tool never stores it anywhere — not in a config
  file, not in an environment file it writes, nowhere. You are responsible
  for saving it (a password manager is recommended).
- \`vault.meta.json\` next to the vault is **not** encrypted — it only holds
  the folder path, calendar path, and sync timestamps, so \`vault status\` can
  work without the passphrase. If those paths themselves are sensitive on
  your machine, keep \`--dest\` somewhere access-controlled.
- **\`index.json\`, search mode's index, is also not encrypted.** It holds the
  same plain-text content a \`vault sync\` snapshot would have shown anyway —
  same eligibility rules (extension allowlist, size cap, sensitive-filename
  exclusion — see \`lib/scan.mjs\`'s \`shouldRead\`) — just chunked and
  tokenized for ranking instead of encrypted at rest. This is a deliberate
  trade: encrypting the index would mean decrypting it (and re-encrypting
  after every incremental update) on every single query, defeating the
  point of an index being fast. If that trade doesn't work for your threat
  model, keep \`--dest\` access-controlled, same as \`vault.meta.json\` above.
- **CLI mode** makes no network request, ever. **MCP mode and search mode**
  talk only over stdio/local disk — also no network request to serve
  context. The one exception, and it's opt-in: if
  \`MULTIWITNESS_INGEST_TOKEN\` is set, MCP mode makes a \`localhost\`-only POST
  per context call, and that call never carries file/calendar content — only
  a count. Leave the token unset and there is zero network activity anywhere
  in this package, full stop.
- **Dependencies, honestly stated:** the CLI (\`vault init/sync/context/status/
  index/watch\`) and core library — encryption, folder scanning, \`.ics\`
  parsing, tokenizing, BM25 ranking, chunking, indexing, and the file
  watcher — are all zero-dependency, plain Node.js, nothing to audit beyond
  what ships with Node itself. Search mode (indexing, ranking, watching) is
  NOT an exception to this — it's pure JS, same as v1's core always was.
  **MCP mode is the one actual exception**: it depends on
  \`@modelcontextprotocol/sdk\` (Anthropic's real, published MCP SDK) and
  \`zod\`, because implementing the MCP protocol correctly from scratch would
  be reinventing a well-tested wheel, badly. If you don't use MCP mode, you
  never load either dependency.
- Read the source. It's plain JavaScript specifically so every claim above is
  easy to verify yourself rather than something you have to take on faith.

## Standalone binaries (optional)

By default this runs as a Node script (\`node bin/vault.mjs ...\`), same as the
rest of this catalog — no separate install step beyond having Node 18+.

If you'd rather have a double-clickable executable that doesn't require Node
to be installed, run this once **on each OS you want a binary for** (it uses
Node's own built-in Single Executable Application support, injecting into a
copy of whatever Node binary is already on that machine — so it isn't a
cross-compile, but it also needs no download of a foreign platform's Node):

\`\`\`
npm install
npm run build:binary
\`\`\`

- Run on Windows → \`dist/vault-win-x64.exe\`
- Run on a Mac → \`dist/vault-macos-x64\` or \`dist/vault-macos-arm64\`
- Run on Linux → \`dist/vault-linux-x64\`

Verified working end-to-end (full init/sync/context cycle against the
compiled binary, not just \`--help\`).

**Important:** these binaries are not code-signed. Windows SmartScreen will
show an "Unknown Publisher" warning, and macOS Gatekeeper will refuse to open
an app from an "unidentified developer" until you right-click → Open once (or
run \`xattr -d com.apple.quarantine <path>\`). This is standard for any
unsigned binary, not a bug — code-signing certificates from Microsoft and
Apple are a separate purchase if you want that warning gone.

## Testing

\`\`\`
npm test
\`\`\`

Runs all seven suites (64 tests total):
- \`test/run.mjs\` — encryption round-trip, \`.ics\` parsing, folder scanning,
  and the full CLI-mode vault lifecycle, against real throwaway temp
  directories.
- \`test/bm25.test.mjs\` — the ranking engine itself, tested against known
  mathematical properties: diminishing returns on repeated terms (not raw
  linear term-frequency counting), length normalization (a long document
  mentioning a term once should rank below a short, focused one), and IDF
  behaving correctly at the edges (a term in every document shouldn't score
  negative, rarer terms should outrank common ones).
- \`test/indexer.test.mjs\` — building and incrementally updating the index
  against a real filesystem: adding, modifying, and deleting files, and
  specifically verifying that a deleted file's term-frequency contribution
  is actually cleaned up (not left dangling and silently skewing future
  rankings), and that an unchanged file triggers zero re-indexing work.
- \`test/query.test.mjs\` — \`buildLiveContext\`'s query path end-to-end,
  including confirming the no-query path is byte-for-byte the same v1/v2
  behavior it always was.
- \`test/watcher.test.mjs\` — the background file watcher, against real
  \`fs.watch\` events on a real temp directory: a newly-created file is
  picked up and becomes searchable without any manual trigger, and \`stop()\`
  actually tears the watcher down rather than leaving it running.
- \`test/mcp.test.mjs\` — MCP mode, driven by a **real
  \`@modelcontextprotocol/sdk\` \`Client\`** talking to the real \`McpServer\`
  over the SDK's in-memory transport — the same client/server code path a
  real MCP host exercises, including the new \`query\` argument returning
  ranked results through the actual protocol, not just the library function.
- \`test/witness-log.test.mjs\` — the MultiWitness integration's request
  contract (auth header, event shape, silent-fail behavior when
  unconfigured or unreachable), against a bare local HTTP server standing
  in for MultiWitness's real API — kept dependency-free from MultiWitness's
  own source since that's a separate product.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multivault — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines as you like. Do not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines that you own or operate.
- Modify the source freely. It is plain JavaScript with no build step precisely so
  that you can — point it at different folders, change what gets excerpted,
  add your own output format, anything.
- Keep using it indefinitely. There is no license key, no activation, no expiry,
  no phone-home, and nothing that stops working if [SELLER] does.
- Keep and use any version you have received, forever, regardless of what happens
  to later versions or to [SELLER].

## What you may not do

- Resell, relicense, sublicense or redistribute the software itself, in whole or
  in substantial part, as a product or as part of a product whose value is
  substantially this software.
- Publish the source publicly, or include it in a public repository, package
  registry, or template that others can obtain without buying it.
- Remove or alter this license file or the attribution in the source headers.

## Updates

Any updates published within twelve months of your purchase are included at no
extra cost. After that, your existing copy keeps working forever; new versions may
require a new purchase. There is no subscription and no recurring charge of any
kind.

## Refunds

Because this is source code and delivery is immediate, a refund is available
within 14 days of purchase if the software does not work as described. Run
\`npm test\` before you ask — it takes a second and tells you whether the software
is at fault.

## Warranty and liability

The software is provided "as is", without warranty of any kind, express or
implied, including but not limited to the warranties of merchantability, fitness
for a particular purpose and non-infringement.

In no event shall [SELLER] be liable for any claim, damages or other liability,
whether in an action of contract, tort or otherwise, arising from, out of or in
connection with the software or its use.

In particular: this software reads files from whatever folder you point it at,
and encrypts a snapshot of their names, sizes, and (for a small set of plain-text
formats) short excerpts of their contents, using a passphrase that only you hold.
**There is no password recovery.** If you lose your passphrase, the vault file
cannot be decrypted by [SELLER], by this software, or by anyone else — you are
responsible for storing it safely (a password manager is recommended). You are
also responsible for reviewing what folder you point the tool at and for keeping
your own backups of anything important. Nothing in this software transmits vault
contents, the passphrase, or any file it reads to [SELLER] or to any third party;
you are responsible for verifying this for your own compliance needs by reading
the source, which is provided precisely so that you can.

## Governing law

This license is governed by the laws of [JURISDICTION].

---

Copyright © 2026 [SELLER]. All rights reserved.

The source files each carry the same notice. Copyright in this software arises
automatically on creation and is not conditional on registration, on this notice,
or on any filing — the notice exists to make ownership unambiguous and to travel
with a file that gets separated from this license.
`,
  },
  {
    path: "package.json",
    contents: `{
  "name": "multivault",
  "version": "3.0.0",
  "description": "A local, encrypted context snapshot of a folder and calendar file, with a BM25-ranked search index for large folders and an MCP server for automatic, zero-paste context. Optional provably-logged serving via MultiWitness. No account, no OAuth, no cloud storage.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "vault": "./bin/vault.mjs",
    "vault-mcp": "./bin/vault-mcp.mjs"
  },
  "main": "./lib/vault.mjs",
  "exports": {
    ".": "./lib/vault.mjs",
    "./crypto": "./lib/crypto.mjs",
    "./scan": "./lib/scan.mjs",
    "./calendar": "./lib/calendar.mjs",
    "./mcp-server": "./lib/mcp-server.mjs",
    "./witness-log": "./lib/witness-log.mjs",
    "./tokenize": "./lib/tokenize.mjs",
    "./bm25": "./lib/bm25.mjs",
    "./chunk": "./lib/chunk.mjs",
    "./index-store": "./lib/index-store.mjs",
    "./indexer": "./lib/indexer.mjs",
    "./watcher": "./lib/watcher.mjs"
  },
  "files": [
    "bin",
    "lib",
    "adapters",
    "README.md",
    "LICENSE.md"
  ],
  "scripts": {
    "vault": "node bin/vault.mjs",
    "vault-mcp": "node bin/vault-mcp.mjs",
    "test": "node test/run.mjs && node test/bm25.test.mjs && node test/indexer.test.mjs && node test/query.test.mjs && node test/watcher.test.mjs && node test/mcp.test.mjs && node test/witness-log.test.mjs",
    "build:binary": "node scripts/build-sea.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "esbuild": "^0.28.2",
    "postject": "^1.0.0-alpha.6"
  }
}
`,
  },
  {
    path: "lib/bm25.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Okapi BM25 — the same ranking family real search engines (Elasticsearch,
// Lucene) use by default, implemented here in plain JS against MultiVault's
// own index (see lib/index-store.mjs) instead of pulling in a search
// library. This is genuinely the least trivial piece of this package: correct
// IDF weighting, correct length normalization, and correct incremental
// index maintenance are what separate "search that actually ranks well" from
// "grep with extra steps" — see test/bm25.test.mjs for the formula tests
// that pin this down.
//
// Standard parameters (k1=1.5, b=0.75) are Lucene/Elasticsearch's own
// defaults — deliberately not "tuned" for this corpus, since a corpus of
// one person's folder is too small and too idiosyncratic to responsibly
// tune against; these defaults are well-studied across a huge range of
// real corpora and are the sane, boring choice.

const K1 = 1.5
const B = 0.75

/**
 * Inverse document frequency, +1-smoothed (the modern/Lucene variant) so a
 * term appearing in every document scores a small positive IDF instead of
 * going negative, which the classic textbook formula can do.
 *
 * @param {number} totalDocs
 * @param {number} docsContainingTerm
 */
export function idf(totalDocs, docsContainingTerm) {
  return Math.log(1 + (totalDocs - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5))
}

/**
 * BM25 score for one document against one already-tokenized query.
 *
 * @param {string[]} queryTerms
 * @param {{ tokens: Record<string, number>, length: number }} doc
 * @param {{ totalDocs: number, avgDocLength: number, docFreq: Record<string, number> }} corpus
 */
export function scoreDoc(queryTerms, doc, corpus) {
  let score = 0
  for (const term of queryTerms) {
    const docFreq = corpus.docFreq[term]
    if (!docFreq) continue // term never appears in the corpus — contributes nothing, not a penalty
    const tf = doc.tokens[term] ?? 0
    if (tf === 0) continue
    const termIdf = idf(corpus.totalDocs, docFreq)
    const lengthNorm = 1 - B + B * (doc.length / (corpus.avgDocLength || 1))
    score += termIdf * ((tf * (K1 + 1)) / (tf + K1 * lengthNorm))
  }
  return score
}

/**
 * Rank every doc in the index against a tokenized query, descending by
 * score, dropping zero-score docs (a doc that shares no term with the query
 * is not "slightly relevant", it's irrelevant — including it just pads the
 * result with noise).
 *
 * @param {string[]} queryTerms
 * @param {{ docs: Array<{tokens: Record<string, number>, length: number}> }} index
 * @returns {Array<{ doc: object, score: number }>}
 */
export function rank(queryTerms, index) {
  const corpus = { totalDocs: index.totalDocs, avgDocLength: index.avgDocLength, docFreq: index.docFreq }
  const scored = []
  for (const doc of index.docs) {
    const score = scoreDoc(queryTerms, doc, corpus)
    if (score > 0) scored.push({ doc, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored
}
`,
  },
  {
    path: "lib/calendar.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A small, dependency-free .ics (iCalendar) parser — just enough of RFC 5545
// to pull events out of a calendar export. Not a full implementation (no
// recurrence-rule expansion, no timezone database) — v1 reads whatever
// concrete events are already in the file, which is what most calendar apps
// write when you export or auto-sync a .ics.
//
// Deliberately local-file only. This reads a file the user already has on
// disk (their calendar app's own export/auto-sync feature writes it) rather
// than talking to a Google/Outlook/etc. API — no OAuth app to register, no
// token to store, no third-party account access at all. See README for how
// to get your calendar app to keep that file updated.

import { readFileSync, existsSync } from 'node:fs'

function unfold(text) {
  // RFC 5545 line folding: a continuation line starts with a space or tab.
  return text.replace(/\\r\\n/g, '\\n').replace(/\\n[ \\t]/g, '')
}

function unescapeText(value) {
  return value.replace(/\\\\n/gi, '\\n').replace(/\\\\,/g, ',').replace(/\\\\;/g, ';').replace(/\\\\\\\\/g, '\\\\')
}

function parseDate(value) {
  // Handles the two common forms: YYYYMMDD (all-day) and
  // YYYYMMDDTHHMMSS[Z] (timed). Returns an ISO string, or the raw value if
  // it doesn't match either — better to pass through an odd value than drop
  // the event.
  const m = value.match(/^(\\d{4})(\\d{2})(\\d{2})(?:T(\\d{2})(\\d{2})(\\d{2})(Z)?)?$/)
  if (!m) return value
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m
  const iso = \`\${y}-\${mo}-\${d}T\${h}:\${mi}:\${s}\${z ? 'Z' : ''}\`
  return iso
}

/**
 * Parse .ics text into a flat array of events:
 *   { summary, start, end, location, description }
 * Any field not present in the source is omitted.
 */
export function parseIcs(icsText) {
  const lines = unfold(icsText).split('\\n')
  const events = []
  let current = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current && (current.summary || current.start)) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1)
    const key = rawKey.split(';')[0].toUpperCase() // strip parameters like ;TZID=...

    if (key === 'SUMMARY') current.summary = unescapeText(value)
    else if (key === 'DTSTART') current.start = parseDate(value)
    else if (key === 'DTEND') current.end = parseDate(value)
    else if (key === 'LOCATION') current.location = unescapeText(value)
    else if (key === 'DESCRIPTION') current.description = unescapeText(value)
  }

  return events
}

/**
 * Read and parse a .ics file. Returns [] (not an error) if the path doesn't
 * exist — a calendar file is optional for MultiVault, and a missing one
 * should degrade the context, not fail the sync.
 */
export function readIcsFile(path) {
  if (!path || !existsSync(path)) return []
  try {
    return parseIcs(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}
`,
  },
  {
    path: "lib/chunk.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Splits text into chunks for indexing, preferring paragraph boundaries so a
// chunk stays semantically coherent rather than being a mid-sentence
// character cutoff. This is what lets v3 handle large files at all: v1/v2
// excerpted the first 2000 characters of a file and stopped — useful context
// buried on page 40 of a doc was simply invisible. Chunking + per-chunk BM25
// scoring means the relevant section wins on its own merits, wherever it is
// in the file.
//
// A small overlap between consecutive chunks (default 80 chars) means a
// sentence that happens to fall right on a chunk boundary still appears
// intact in at least one chunk, rather than being split with half its
// meaning in each neighbor.

const DEFAULT_CHUNK_SIZE = 800
const DEFAULT_OVERLAP = 80

/**
 * @param {string} text
 * @param {{ chunkSize?: number, overlap?: number }} [opts]
 * @returns {string[]} — always at least one chunk for non-empty input, even
 *   if the whole text fits in a single chunk (no pointless splitting).
 */
export function chunkText(text, opts = {}) {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE
  const overlap = opts.overlap ?? DEFAULT_OVERLAP
  if (!text) return []
  if (text.length <= chunkSize) return [text]

  const paragraphs = text.split(/\\n{2,}/)
  const chunks = []
  let current = ''

  function flush() {
    if (current.trim()) chunks.push(current.trim())
  }

  for (const para of paragraphs) {
    // A single paragraph longer than a whole chunk: hard-split it by
    // character count rather than letting one paragraph blow the budget —
    // this is the fallback for minified code, a giant CSV row, etc.
    if (para.length > chunkSize) {
      flush()
      current = ''
      for (let i = 0; i < para.length; i += chunkSize - overlap) {
        chunks.push(para.slice(i, i + chunkSize).trim())
      }
      continue
    }

    const candidate = current ? \`\${current}\\n\\n\${para}\` : para
    if (candidate.length > chunkSize && current) {
      flush()
      // Start the next chunk with a small tail of the previous one, so
      // content right at the boundary isn't orphaned from its neighbor.
      const tail = current.slice(Math.max(0, current.length - overlap))
      current = \`\${tail}\\n\\n\${para}\`
    } else {
      current = candidate
    }
  }
  flush()

  return chunks.length ? chunks : [text.slice(0, chunkSize)]
}
`,
  },
  {
    path: "lib/crypto.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Encryption for the vault file itself. AES-256-GCM, key derived from the
// user's passphrase with scrypt (a fresh random salt per encrypt, stored
// alongside the ciphertext — the salt is not secret, only the passphrase is).
//
// Everything here is Node's own \`node:crypto\`. No third-party crypto library,
// so there is nothing to audit beyond what ships with Node itself, and
// nothing that can silently change behavior on an \`npm update\` you never ran
// (this package has no dependencies at all — see package.json).
//
// File layout written by encrypt(): [salt(16)][iv(12)][authTag(16)][ciphertext]
// All fixed-length except the ciphertext, so decrypt() can slice deterministically.

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32 // AES-256
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } // ~100ms on a modern laptop; deliberately slow to raise the cost of brute-forcing a stolen vault file

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, KEY_LEN, SCRYPT_OPTS)
}

export function encrypt(plaintext, passphrase) {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(passphrase, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, authTag, ciphertext])
}

export class DecryptError extends Error {}

export function decrypt(blob, passphrase) {
  if (blob.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new DecryptError('Vault file is too short to be valid — it may be corrupt.')
  }
  const salt = blob.subarray(0, SALT_LEN)
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const authTag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const ciphertext = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    // GCM's auth tag check fails on any wrong passphrase or any tampering —
    // both collapse to the same message so nothing about the failure mode
    // leaks to an attacker guessing passphrases.
    throw new DecryptError('Could not open the vault. Wrong passphrase, or the file is corrupt/tampered.')
  }
}

// A random, readable-enough passphrase generated once at \`vault init\` and
// shown to the user exactly one time. Nothing about it is derived from the
// machine or the account — losing it means losing access to that vault's
// contents, by design (see README's "if you lose the passphrase" section).
export function generatePassphrase() {
  return randomBytes(24).toString('base64url') // 32 chars, URL-safe, no padding
}
`,
  },
  {
    path: "lib/index-store.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The index's on-disk shape and the low-level operations for keeping its
// BM25 aggregates (docFreq, totalDocs, avgDocLength) correct as documents
// are added and removed. Deliberately plain JSON, not a binary format or an
// embedded database — this index is meant to be inspectable (open it in any
// editor) and to have zero new dependencies, consistent with the rest of
// this package.
//
// One entry in \`docs\` is one CHUNK (see lib/chunk.mjs), not one file — a
// large file becomes several docs. \`files\` tracks one entry per actual file,
// pointing at which doc ids currently belong to it, which is what makes
// incremental updates possible: to re-index a changed file, remove exactly
// its docs (and undo their docFreq contribution) before adding the new ones,
// without touching any other file's data or rebuilding from scratch.
//
// NOT encrypted at rest, unlike vault.enc. The index holds the same
// plain-text excerpts a vault sync would have shown anyway (same
// eligibility rules — see lib/scan.mjs's shouldRead) — see README's
// "Security model" for the reasoning and how to keep --dest access-controlled
// if that matters on your machine.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const INDEX_FILE = 'index.json'

export function indexPath(dest) {
  return join(dest, INDEX_FILE)
}

/**
 * A fresh, empty index for \`folder\`. Adding docs to this and calling
 * recomputeAggregates() is the whole story — see indexer.mjs for the
 * higher-level build/update orchestration that actually walks the
 * filesystem and calls these.
 */
export function emptyIndex(folder) {
  return {
    version: 1,
    folder,
    builtAt: null,
    totalDocs: 0,
    avgDocLength: 0,
    docFreq: Object.create(null),
    docs: [],
    files: Object.create(null), // relPath -> { mtimeMs, sizeBytes, ext, docIds: string[], eligible: boolean }
  }
}

export function loadIndex(dest) {
  const path = indexPath(dest)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null // corrupt/partial index — caller should rebuild, not crash
  }
}

export function saveIndex(dest, index) {
  writeFileSync(indexPath(dest), JSON.stringify(index), 'utf8')
}

let nextDocSeq = 0
function freshDocId(relPath, chunkIndex) {
  // Includes a process-local monotonic counter, not just relPath+chunkIndex,
  // so two docs can never collide even across a remove-then-immediately-
  // re-add for the same file (which happens on every re-index of a changed
  // file) — old ids fully retire rather than risk being confused with new
  // ones that happen to reuse the same (relPath, chunkIndex) pair.
  nextDocSeq += 1
  return \`\${relPath}::\${chunkIndex}::\${nextDocSeq}\`
}

/**
 * Remove every doc belonging to \`relPath\` and undo their docFreq
 * contribution. Safe to call on a file with no docs (nothing to do) — the
 * standard first step before re-indexing an existing file, or the whole
 * step for a file that was deleted.
 */
export function removeFileDocs(index, relPath) {
  const fileEntry = index.files[relPath]
  if (!fileEntry) return
  const idsToRemove = new Set(fileEntry.docIds)
  if (idsToRemove.size) {
    index.docs = index.docs.filter((doc) => {
      if (!idsToRemove.has(doc.id)) return true
      for (const term of Object.keys(doc.tokens)) {
        const next = (index.docFreq[term] ?? 0) - 1
        if (next <= 0) delete index.docFreq[term]
        else index.docFreq[term] = next
      }
      return false
    })
  }
  delete index.files[relPath]
}

/**
 * Add one file's chunks as new docs and record its file-level metadata.
 * Assumes removeFileDocs() was already called for this relPath if it was
 * previously indexed — indexer.mjs's updateIndex() always does remove-then-
 * add for a changed file, never a blind add, so docFreq can't double-count.
 *
 * @param {Array<{ text: string, tokens: Record<string, number>, length: number }>} chunks
 */
export function addFileDocs(index, relPath, chunks, meta) {
  const docIds = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const id = freshDocId(relPath, i)
    index.docs.push({ id, relPath, chunkIndex: i, length: chunk.length, tokens: chunk.tokens, text: chunk.text })
    docIds.push(id)
    for (const term of Object.keys(chunk.tokens)) {
      index.docFreq[term] = (index.docFreq[term] ?? 0) + 1
    }
  }
  index.files[relPath] = { mtimeMs: meta.mtimeMs, sizeBytes: meta.sizeBytes, ext: meta.ext, docIds, eligible: chunks.length > 0 }
}

/** Record a file that exists but isn't eligible for content indexing (wrong extension, too big, looks sensitive) — still listed, never chunked. */
export function recordIneligibleFile(index, relPath, meta) {
  index.files[relPath] = { mtimeMs: meta.mtimeMs, sizeBytes: meta.sizeBytes, ext: meta.ext, docIds: [], eligible: false }
}

/** Recompute totalDocs/avgDocLength from the current docs array. Call this once after a batch of add/remove operations, not per-operation. */
export function recomputeAggregates(index) {
  index.totalDocs = index.docs.length
  index.avgDocLength = index.totalDocs ? index.docs.reduce((sum, d) => sum + d.length, 0) / index.totalDocs : 0
}
`,
  },
  {
    path: "lib/indexer.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Builds and incrementally updates the BM25 index. This is the actual answer
// to "handle much larger workloads": v1/v2's buildLiveContext() re-scanned
// and re-read every eligible file on every single call — fine for a folder
// of a few dozen files, a real bottleneck at a few thousand. updateIndex()
// here only touches files that are NEW or whose mtime changed since the last
// index; an unchanged file costs one stat() call, not a re-read.
//
// readFileSync + chunk + tokenize is the one part of this pipeline that's
// O(file size) rather than O(1) per unchanged file — still real work for a
// freshly-changed large file, but it's work paid once per change, not once
// per query the way v1/v2's live re-scan was.

import { readFileSync } from 'node:fs'
import { walkFiles, shouldRead } from './scan.mjs'
import { chunkText } from './chunk.mjs'
import { termFrequencies, tokenize } from './tokenize.mjs'
import { emptyIndex, loadIndex, saveIndex, removeFileDocs, addFileDocs, recordIneligibleFile, recomputeAggregates } from './index-store.mjs'

function chunksFor(fullPath) {
  let text
  try {
    text = readFileSync(fullPath, 'utf8')
  } catch {
    return [] // unreadable (binary despite the extension, permissions, race with a delete) — treat as no content, not a crash
  }
  return chunkText(text).map((chunkString) => ({
    text: chunkString,
    tokens: termFrequencies(chunkString),
    length: tokenize(chunkString).length,
  }))
}

/**
 * Full (re)build from scratch. Used by \`vault index\` and automatically the
 * first time a vault with no existing index.json is queried.
 */
export function buildIndex(folder, opts = {}) {
  const index = emptyIndex(folder)
  const files = walkFiles(folder, opts)
  for (const f of files) {
    if (shouldRead(f.name, f.ext, f.sizeBytes, opts)) {
      const chunks = chunksFor(f.fullPath)
      if (chunks.length) addFileDocs(index, f.relPath, chunks, f)
      else recordIneligibleFile(index, f.relPath, f) // eligible by rule but unreadable in practice
    } else {
      recordIneligibleFile(index, f.relPath, f)
    }
  }
  recomputeAggregates(index)
  index.builtAt = new Date().toISOString()
  return index
}

/**
 * Incrementally bring an existing index up to date with the current state
 * of \`folder\`. Only files that are new, changed (by mtime), or deleted since
 * the index was last built/updated actually get touched — see module
 * comment. Returns { index, added, updated, removed } so callers (the CLI,
 * the watcher) can report what actually happened.
 */
export function updateIndex(existingIndex, folder, opts = {}) {
  const index = existingIndex
  const onDisk = walkFiles(folder, opts)
  const onDiskPaths = new Set(onDisk.map((f) => f.relPath))
  const stats = { added: 0, updated: 0, removed: 0 }

  // Deletions: anything the index still has a record of that's no longer on disk.
  for (const relPath of Object.keys(index.files)) {
    if (!onDiskPaths.has(relPath)) {
      removeFileDocs(index, relPath)
      stats.removed += 1
    }
  }

  // Additions and changes.
  for (const f of onDisk) {
    const existing = index.files[f.relPath]
    const unchanged = existing && existing.mtimeMs === f.mtimeMs
    if (unchanged) continue

    if (existing) {
      removeFileDocs(index, f.relPath) // re-index: undo the old contribution before adding the new one
      stats.updated += 1
    } else {
      stats.added += 1
    }

    if (shouldRead(f.name, f.ext, f.sizeBytes, opts)) {
      const chunks = chunksFor(f.fullPath)
      if (chunks.length) addFileDocs(index, f.relPath, chunks, f)
      else recordIneligibleFile(index, f.relPath, f)
    } else {
      recordIneligibleFile(index, f.relPath, f)
    }
  }

  recomputeAggregates(index)
  index.builtAt = new Date().toISOString()
  return { index, ...stats }
}

/**
 * Load the index at \`dest\` if it exists and is for the right folder;
 * otherwise build one fresh. Does NOT save — callers that want the result
 * persisted call saveIndex() themselves (see vault.mjs's ensureIndex, which
 * does exactly that).
 */
export function loadOrBuildIndex(dest, folder, opts = {}) {
  const existing = loadIndex(dest)
  if (existing && existing.folder === folder) return existing
  return buildIndex(folder, opts)
}

export { saveIndex, loadIndex } from './index-store.mjs'
`,
  },
  {
    path: "lib/mcp-server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// MultiVault's MCP (Model Context Protocol) server — the piece that closes
// the "manual paste" gap from v1. Instead of running \`vault context\` and
// pasting the output into a chat, an MCP-aware client (Claude Desktop,
// Claude Code, and other MCP clients) calls this tool directly and gets the
// current folder/calendar context on demand, live, automatically.
//
// Two things this deliberately does NOT do:
//   - It never touches vault.enc or asks for a passphrase. See
//     buildLiveContext() in lib/vault.mjs for why — this mode re-scans live
//     on every call instead of trusting a snapshot that might be stale.
//   - It never makes an outbound network call to serve context. The ONLY
//     network activity anywhere in this file is the optional, best-effort,
//     localhost-only POST to MultiWitness (see lib/witness-log.mjs) — and
//     that's for logging that context was served, never the content itself.
//
// Requires @modelcontextprotocol/sdk — the one real dependency in this
// product. Everything else (encryption, folder scanning, .ics parsing, the
// CLI) stays zero-dependency exactly as in v1; this is additive, not a
// change to that.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { resolve } from 'node:path'
import { buildLiveContext, statusVault } from './vault.mjs'
import { loadIndex } from './index-store.mjs'
import { logContextServed, witnessConfigured } from './witness-log.mjs'

export function createMultiVaultServer(dest) {
  const server = new McpServer({ name: 'multivault', version: '3.0.0' })

  server.registerTool(
    'get_context',
    {
      title: 'Get local context',
      description:
        'Returns local context from the watched folder and calendar file. Two modes: ' +
        'call with no arguments for a full brief (file names, sizes, short excerpts, calendar events) — ' +
        'suitable for small-to-medium folders. Call WITH a \`query\` for large or many-file folders: this ' +
        'searches an incrementally-maintained local index (BM25 ranking, same approach real search ' +
        'engines use) and returns only the most relevant chunks instead of everything, so it stays fast ' +
        'and useful even against thousands of files. Nothing is cached across calls in either mode — the ' +
        'index updates itself against current disk state on every query, so results always reflect what\\'s ' +
        'actually there now.',
      inputSchema: {
        query: z.string().optional().describe('Search terms. Omit for a full whole-folder brief instead of a targeted search.'),
        topK: z.number().int().positive().max(50).optional().describe('Max results when using query. Defaults to 8.'),
        format: z.enum(['markdown', 'json']).optional().describe('Output format. Defaults to markdown.'),
      },
    },
    async ({ query, topK, format }) => {
      try {
        const { snapshot, text } = buildLiveContext(dest, { query, topK, format: format ?? 'markdown' })
        // Best-effort, non-blocking, content-free logging — see
        // lib/witness-log.mjs. Never awaited-and-branched-on beyond this:
        // a logging failure must never affect the response below. The two
        // modes have different snapshot shapes (a query returns { results,
        // events }, no query returns { files, events }), so the logged
        // detail branches on which one actually ran.
        const detail = snapshot.results
          ? \`query "\${snapshot.query}" -> \${snapshot.results.length} result(s), \${snapshot.events.length} event(s)\`
          : \`\${snapshot.files.length} file(s), \${snapshot.events.length} event(s) from \${snapshot.folder ?? '(no folder)'}\`
        logContextServed(detail)
        return { content: [{ type: 'text', text }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: \`MultiVault error: \${err.message}\` }],
          isError: true,
        }
      }
    },
  )

  server.registerTool(
    'vault_status',
    {
      title: 'Vault status',
      description:
        'Reports what folder/calendar this vault is configured to watch and whether MultiWitness ' +
        'logging is active — without reading any file contents. Useful for confirming setup.',
      inputSchema: {},
    },
    async () => {
      const meta = statusVault(dest)
      if (!meta) {
        return {
          content: [{ type: 'text', text: \`No vault found at \${dest}. Run "vault init" first.\` }],
          isError: true,
        }
      }
      // Read-only: reports whatever index currently exists on disk without
      // triggering a build/update, so vault_status stays cheap regardless
      // of folder size — that cost only happens when get_context is
      // actually called with a query.
      const index = loadIndex(dest)
      const lines = [
        \`Folder: \${meta.folder ?? '(none configured)'}\`,
        \`Calendar: \${meta.icsPath ?? '(none configured)'}\`,
        \`MultiWitness logging: \${witnessConfigured() ? 'active' : 'not configured (set MULTIWITNESS_INGEST_TOKEN to enable)'}\`,
        index
          ? \`Search index: \${Object.keys(index.files).length} file(s) tracked, \${index.docs.length} indexed chunk(s), last updated \${index.builtAt}\`
          : 'Search index: not built yet (built automatically on first query, or run "vault index")',
      ]
      return { content: [{ type: 'text', text: lines.join('\\n') }] }
    },
  )

  return server
}

export async function startMultiVaultServer(dest) {
  const server = createMultiVaultServer(resolve(dest))
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
`,
  },
  {
    path: "lib/scan.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Walks a watched folder and decides what's eligible to have its content
// read at all — shared by two callers with different needs:
//   - scanFolder() below: v1/v2's flat listing-with-a-short-excerpt, used
//     when buildLiveContext() is called with no search query (see
//     lib/vault.mjs) — unchanged behavior from v1/v2.
//   - lib/indexer.mjs: v3's full-content chunking + BM25 indexing pipeline,
//     which needs the same "is this file safe/sane to read" decision but
//     wants the FULL content (to chunk), not a flat 2000-char excerpt.
//
// Deliberately conservative about what it reads, in both callers:
//   - Only a fixed allowlist of plain-text extensions are ever read.
//     Anything else (images, PDFs, spreadsheets, executables, .env files,
//     anything with "key", "secret", or "credential" in the name) is listed
//     by name and metadata only — never opened.
//   - Hidden files/folders (dotfiles) and common noise directories
//     (node_modules, .git) are skipped outright.
//
// v3 raises the volume caps substantially (500 files -> 20,000; 3 folder
// levels -> 12) versus v1/v2, because the cost of a large folder is now
// absorbed by the incremental index (lib/indexer.mjs) instead of being
// paid fresh on every single call — see that file's module comment.

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

export const DEFAULTS = {
  maxFiles: 20_000,
  maxDepth: 12,
  excerptCharLimit: 2000, // v1/v2 flat-excerpt mode only — see scanFolder()
  maxFileBytes: 2_000_000, // per-file cap for READING content at all, in either mode — 2MB of plain text is already an unusual single file, and chunking (lib/chunk.mjs) means indexing mode doesn't need this to be small the way a flat excerpt did
}

const EXCERPT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json'])
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '.cache'])

// Filenames that look like they hold secrets are skipped even if their
// extension is otherwise excerptable (e.g. a stray "notes.txt" is fine;
// "api-keys.txt" is not).
const SENSITIVE_NAME_PATTERN = /(secret|password|credential|\\bkeys?\\b|\\.env)/i

export function isHidden(name) {
  return name.startsWith('.')
}

/**
 * Whether a file's CONTENT is safe/eligible to read at all — by extension,
 * size, and filename. Used by both scanFolder() (v1/v2) and lib/indexer.mjs
 * (v3), so this one decision stays in exactly one place.
 */
export function shouldRead(name, ext, sizeBytes, opts = {}) {
  const maxFileBytes = opts.maxFileBytes ?? DEFAULTS.maxFileBytes
  if (isHidden(name)) return false
  if (!EXCERPT_EXTENSIONS.has(ext)) return false
  if (sizeBytes > maxFileBytes) return false
  if (SENSITIVE_NAME_PATTERN.test(name)) return false
  return true
}

/**
 * Walk \`folder\` up to \`maxDepth\` levels and return a flat list of every
 * file's metadata — no content read yet. Stops early once \`maxFiles\`
 * entries have been collected. This is the shared "what's on disk" pass;
 * callers decide what to do with each entry (scanFolder excerpts eligible
 * ones inline below; lib/indexer.mjs reads+chunks+tokenizes eligible ones).
 *
 * @returns {Array<{ relPath: string, fullPath: string, name: string, ext: string, sizeBytes: number, mtimeMs: number }>}
 */
export function walkFiles(folder, opts = {}) {
  const { maxFiles, maxDepth } = { ...DEFAULTS, ...opts }
  const entries = []

  function walk(dir, depth) {
    if (entries.length >= maxFiles || depth > maxDepth) return
    let names
    try {
      names = readdirSync(dir)
    } catch {
      return // unreadable directory — skip rather than fail the whole scan
    }
    for (const name of names) {
      if (entries.length >= maxFiles) return
      if (isHidden(name) || SKIP_DIR_NAMES.has(name)) continue
      const fullPath = join(dir, name)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
        continue
      }
      if (!stat.isFile()) continue
      entries.push({
        relPath: relative(folder, fullPath),
        fullPath,
        name,
        ext: extname(name).toLowerCase(),
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
      })
    }
  }

  walk(folder, 0)
  return entries
}

function readExcerpt(fullPath, charLimit) {
  try {
    const text = readFileSync(fullPath, 'utf8')
    return text.length > charLimit ? text.slice(0, charLimit) + '\\n… (truncated)' : text
  } catch {
    return null // unreadable (binary despite the extension, permissions, etc.) — skip silently
  }
}

/**
 * v1/v2 behavior, unchanged: a flat list with a short (2000-char) excerpt
 * per eligible file. Used when buildLiveContext() is called with no search
 * query — see lib/vault.mjs.
 *
 * @returns {Array<{ relPath, sizeBytes, mtimeMs, ext, excerpt: string | null }>}
 */
export function scanFolder(folder, opts = {}) {
  const files = walkFiles(folder, opts)
  const charLimit = opts.excerptCharLimit ?? DEFAULTS.excerptCharLimit
  return files.map((f) => ({
    relPath: f.relPath,
    sizeBytes: f.sizeBytes,
    mtimeMs: f.mtimeMs,
    ext: f.ext,
    excerpt: shouldRead(f.name, f.ext, f.sizeBytes, opts) ? readExcerpt(f.fullPath, charLimit) : null,
  }))
}
`,
  },
  {
    path: "lib/tokenize.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A deliberately simple tokenizer: lowercase, split on anything that isn't a
// letter/digit, drop tokens under 2 characters (mostly punctuation debris and
// single letters that add noise without adding signal), cap token length at
// 40 (guards against pathological input — a 10,000-character "word" from a
// minified file or a URL blob isn't a real search term). No stemming, no
// stopword list: deliberately, both are corpus-dependent tuning that would
// need real usage data to get right, and a wrong stopword list actively hurts
// (strips a term someone actually searches for). BM25's own math already
// down-weights common words via IDF — see lib/bm25.mjs.

const TOKEN_PATTERN = /[a-z0-9]+/g
const MIN_TOKEN_LENGTH = 2
const MAX_TOKEN_LENGTH = 40

/**
 * Tokenize a string into an array of lowercase terms.
 */
export function tokenize(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const matches = lower.match(TOKEN_PATTERN) ?? []
  return matches.filter((t) => t.length >= MIN_TOKEN_LENGTH && t.length <= MAX_TOKEN_LENGTH)
}

/**
 * Tokenize and count term frequencies in one pass — the shape the index and
 * BM25 scoring both actually want, so callers don't tokenize twice.
 * Returns a plain object: { term: count }.
 */
export function termFrequencies(text) {
  const freq = Object.create(null)
  for (const term of tokenize(text)) {
    freq[term] = (freq[term] ?? 0) + 1
  }
  return freq
}
`,
  },
  {
    path: "lib/vault.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Vault lifecycle: init (create), sync (snapshot the folder + calendar into
// an encrypted file), context (decrypt + format for pasting into an AI), and
// status (check freshness without needing the passphrase).
//
// Everything lives on disk, next to wherever the user points --dest. Nothing
// in this file makes a network request. That's the whole trust story: a
// vault is a local, encrypted snapshot of a folder and a calendar file — not
// a live tunnel into either.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { encrypt, decrypt, generatePassphrase, DecryptError } from './crypto.mjs'
import { scanFolder } from './scan.mjs'
import { readIcsFile } from './calendar.mjs'
import { loadIndex, buildIndex, updateIndex, saveIndex } from './indexer.mjs'
import { rank } from './bm25.mjs'
import { tokenize } from './tokenize.mjs'

export { DecryptError }

const VAULT_FILE = 'vault.enc'
const META_FILE = 'vault.meta.json'
const FORMAT_VERSION = 1

function vaultPaths(dest) {
  return { vaultPath: join(dest, VAULT_FILE), metaPath: join(dest, META_FILE) }
}

function readMeta(dest) {
  const { metaPath } = vaultPaths(dest)
  if (!existsSync(metaPath)) return null
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    return null
  }
}

function writeMeta(dest, meta) {
  const { metaPath } = vaultPaths(dest)
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\\n', 'utf8')
}

/**
 * Create a new, empty vault at \`dest\`. Returns the generated passphrase —
 * the ONLY time it is ever available in plaintext from this library. The
 * caller (bin/vault.mjs) is responsible for showing it to the user once and
 * telling them to save it; nothing here persists it anywhere.
 */
export function initVault(dest, { folder, icsPath } = {}) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  const { vaultPath } = vaultPaths(dest)
  if (existsSync(vaultPath)) {
    throw new Error(\`A vault already exists at \${dest}. Delete \${VAULT_FILE} first if you want to start over.\`)
  }
  const passphrase = generatePassphrase()
  const emptySnapshot = { folder: folder ?? null, icsPath: icsPath ?? null, files: [], events: [], syncedAt: null }
  writeFileSync(vaultPath, encrypt(Buffer.from(JSON.stringify(emptySnapshot)), passphrase))
  writeMeta(dest, {
    version: FORMAT_VERSION,
    folder: folder ?? null,
    icsPath: icsPath ?? null,
    createdAt: new Date().toISOString(),
    lastSyncAt: null,
    fileCount: 0,
    eventCount: 0,
  })
  return passphrase
}

/**
 * Re-scan the watched folder (and calendar file, if configured) and write a
 * fresh encrypted snapshot. Requires the passphrase to decrypt-then-overwrite
 * cleanly, even though a sync could technically just overwrite blind — this
 * way a wrong passphrase fails loudly at sync time, not silently at the next
 * \`context\` call.
 */
export function syncVault(dest, passphrase, opts = {}) {
  const meta = readMeta(dest)
  if (!meta) throw new Error(\`No vault found at \${dest}. Run "vault init" first.\`)

  // Confirm the passphrase is correct before doing any scanning work.
  const { vaultPath } = vaultPaths(dest)
  decrypt(readFileSync(vaultPath), passphrase)

  const folder = opts.folder ?? meta.folder
  const icsPath = opts.icsPath ?? meta.icsPath
  if (!folder && !icsPath) {
    throw new Error('Nothing configured to sync. Pass --folder and/or --ics, or set one at "vault init" time.')
  }

  const files = folder ? scanFolder(folder, opts.scan) : []
  const events = readIcsFile(icsPath)
  const syncedAt = new Date().toISOString()
  const snapshot = { folder, icsPath, files, events, syncedAt }

  writeFileSync(vaultPath, encrypt(Buffer.from(JSON.stringify(snapshot)), passphrase))
  writeMeta(dest, { ...meta, folder, icsPath, lastSyncAt: syncedAt, fileCount: files.length, eventCount: events.length })
  return { fileCount: files.length, eventCount: events.length, syncedAt }
}

/**
 * Decrypt the vault and return the raw snapshot object. Most callers want
 * buildContext() instead, which formats this for pasting into an AI — this
 * is exposed mainly for tests and for --format json.
 */
export function readSnapshot(dest, passphrase) {
  const { vaultPath } = vaultPaths(dest)
  if (!existsSync(vaultPath)) throw new Error(\`No vault found at \${dest}. Run "vault init" first.\`)
  const plaintext = decrypt(readFileSync(vaultPath), passphrase)
  return JSON.parse(plaintext.toString('utf8'))
}

/**
 * Format a snapshot object (from readSnapshot() or a live scan) into the
 * pasteable context brief. Shared by buildContext() (reads the encrypted
 * at-rest snapshot) and buildLiveContext() (scans fresh, no passphrase) —
 * both produce identically-shaped output from this one function.
 */
export function formatContext(snapshot, { format = 'markdown' } = {}) {
  if (format === 'json') return JSON.stringify(snapshot, null, 2)

  const lines = []
  lines.push(\`# Context — synced \${snapshot.syncedAt ?? 'never'}\`)
  lines.push('')
  if (snapshot.folder) {
    lines.push(\`## Folder: \${snapshot.folder}\`)
    if (!snapshot.files.length) {
      lines.push('(empty, or nothing matched — run \`vault sync\`)')
    } else {
      for (const f of snapshot.files) {
        lines.push(\`- \${f.relPath} (\${f.sizeBytes} bytes)\`)
        if (f.excerpt) {
          const indented = f.excerpt
            .split('\\n')
            .map((l) => \`  > \${l}\`)
            .join('\\n')
          lines.push(indented)
        }
      }
    }
    lines.push('')
  }
  if (snapshot.icsPath) {
    lines.push(\`## Calendar: \${snapshot.icsPath}\`)
    if (!snapshot.events.length) {
      lines.push('(no events found, or file missing — run \`vault sync\`)')
    } else {
      for (const e of snapshot.events) {
        const when = [e.start, e.end].filter(Boolean).join(' – ')
        const where = e.location ? \` @ \${e.location}\` : ''
        lines.push(\`- \${e.summary ?? '(untitled)'}\${when ? \` — \${when}\` : ''}\${where}\`)
        if (e.description) lines.push(\`  > \${e.description}\`)
      }
    }
  }
  return lines.join('\\n') + '\\n'
}

/**
 * Build the pasteable context snippet described in the product blurb: a
 * compact brief of what's in the watched folder and what's on the calendar,
 * meant to be dropped at the top of a chat with an AI agent (or piped into a
 * Claude API call — see README "Piping into the Claude API").
 */
export function buildContext(dest, passphrase, opts = {}) {
  return formatContext(readSnapshot(dest, passphrase), opts)
}

/**
 * The MCP-mode path: build context LIVE, with no passphrase and no
 * encrypted-snapshot round-trip. Reads only vault.meta.json (unencrypted —
 * just the folder/ics paths, not their contents) to know what to scan, then
 * scans the folder and parses the calendar file fresh, right now.
 *
 * This is deliberate, not a shortcut: an MCP server answers a live query
 * from a local AI client over stdio — nothing is written to disk or sent
 * over a network in this path, so there is no "resting file" for
 * encryption-at-rest to protect. Re-scanning live also means an MCP client
 * always sees the CURRENT folder/calendar state, never a snapshot that's
 * gone stale because someone forgot to run \`vault sync\` — that staleness
 * gap is exactly what made v1's workflow feel manual.
 *
 * Requires a vault to have been \`init\`ed at \`dest\` (so the folder/ics paths
 * are known) but does not require or use its passphrase at all.
 */
export function buildLiveContext(dest, opts = {}) {
  const meta = readMeta(dest)
  if (!meta) throw new Error(\`No vault found at \${dest}. Run "vault init" first.\`)
  if (!meta.folder && !meta.icsPath) {
    throw new Error('Nothing configured. Run "vault init --folder ... [--ics ...]" first.')
  }

  // Query given -> v3's indexed/ranked path: only the relevant chunks, not
  // the whole folder. No query -> exact v1/v2 behavior, unchanged, so
  // anything already relying on "get everything" keeps working.
  if (opts.query && meta.folder) {
    const index = ensureIndex(dest, meta.folder, opts.scan)
    const results = rank(tokenize(opts.query), index).slice(0, opts.topK ?? 8)
    const events = readIcsFile(meta.icsPath)
    return { snapshot: { query: opts.query, results, events }, text: formatSearchResults(opts.query, results, events, index, opts) }
  }

  const files = meta.folder ? scanFolder(meta.folder, opts.scan) : []
  const events = readIcsFile(meta.icsPath)
  const snapshot = { folder: meta.folder, icsPath: meta.icsPath, files, events, syncedAt: new Date().toISOString() }
  return { snapshot, text: formatContext(snapshot, opts) }
}

/**
 * Bring the on-disk index for \`dest\` up to date with \`folder\` and persist
 * it — build fresh if none exists yet (or it's for a different folder),
 * otherwise an incremental update (see indexer.mjs — cheap for files that
 * haven't changed). Called automatically by buildLiveContext()'s query path
 * on every call, so a query always searches current content; also exposed
 * directly for \`vault index\` to pre-warm the index ahead of time.
 */
export function ensureIndex(dest, folder, scanOpts = {}) {
  const existing = loadIndex(dest)
  const index = existing && existing.folder === folder ? updateIndex(existing, folder, scanOpts).index : buildIndex(folder, scanOpts)
  saveIndex(dest, index)
  return index
}

function formatSearchResults(query, results, events, index, { format = 'markdown' } = {}) {
  if (format === 'json') {
    return JSON.stringify(
      { query, resultCount: results.length, indexedFiles: Object.keys(index.files).length, results: results.map((r) => ({ relPath: r.doc.relPath, score: r.score, text: r.doc.text })), events },
      null,
      2,
    )
  }

  const lines = []
  lines.push(\`# Search: "\${query}"\`)
  lines.push(\`(\${results.length} relevant chunk(s) out of \${Object.keys(index.files).length} indexed file(s))\`)
  lines.push('')
  if (!results.length) {
    lines.push('No matching content found. Try different terms, or use \`vault context\` with no query for the full folder listing.')
  } else {
    for (const { doc, score } of results) {
      lines.push(\`## \${doc.relPath} (relevance \${score.toFixed(2)})\`)
      const indented = doc.text
        .split('\\n')
        .map((l) => \`  > \${l}\`)
        .join('\\n')
      lines.push(indented)
      lines.push('')
    }
  }
  if (events.length) {
    lines.push('## Calendar')
    for (const e of events) {
      const when = [e.start, e.end].filter(Boolean).join(' – ')
      const where = e.location ? \` @ \${e.location}\` : ''
      lines.push(\`- \${e.summary ?? '(untitled)'}\${when ? \` — \${when}\` : ''}\${where}\`)
    }
  }
  return lines.join('\\n') + '\\n'
}

/**
 * Cheap status check that never needs the passphrase — reads only the
 * unencrypted metadata file, so \`vault status\` works as a quick freshness
 * check without unlocking anything.
 */
export function statusVault(dest) {
  const meta = readMeta(dest)
  if (!meta) return null
  return meta
}
`,
  },
  {
    path: "lib/watcher.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional background watcher: keeps the index updated reactively via
// fs.watch instead of relying solely on the on-query incremental scan (see
// ensureIndex in lib/vault.mjs). Both approaches are correct — the on-query
// path already handles "index might be stale" on every call — this exists
// purely as a latency optimization for very large trees, where even a
// stat()-only walk of thousands of files on every single query adds
// noticeable delay. Run \`vault watch\` once and queries stay fast because
// the index is already current by the time they arrive.
//
// Node's fs.watch recursive option is NOT cross-platform: it works natively
// on macOS and Windows, but on Linux it throws (inotify has no native
// recursive-watch primitive). This module handles that honestly rather than
// silently under-watching on Linux: it watches every subdirectory
// individually there, discovered via the same walkFiles() used elsewhere,
// and re-scans for newly-created subdirectories periodically (60s) since a
// brand-new directory has no watch on it yet until the next such pass.
//
// Debounced: filesystem events tend to arrive in bursts (an editor's
// save-as-temp-then-rename pattern can fire several events for one logical
// save) — changes are batched for DEBOUNCE_MS before a single incremental
// update runs, rather than re-indexing on every individual event.

import { watch } from 'node:fs'
import { platform } from 'node:process'
import { walkFiles } from './scan.mjs'
import { loadIndex, buildIndex, updateIndex, saveIndex } from './indexer.mjs'

const DEBOUNCE_MS = 800
const LINUX_RESCAN_INTERVAL_MS = 60_000

/**
 * Start watching \`folder\` and keep the index at \`dest\` continuously
 * updated. Returns a controller with stop() to tear everything down —
 * used by tests, and by \`vault watch\` to handle Ctrl+C cleanly.
 */
export function startWatcher(dest, folder, opts = {}) {
  let index = loadIndex(dest)
  if (!index || index.folder !== folder) index = buildIndex(folder, opts)
  saveIndex(dest, index)

  let debounceTimer = null
  let stopped = false
  const onEvent = opts.onUpdate ?? (() => {})

  function scheduleUpdate() {
    if (stopped) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (stopped) return
      const result = updateIndex(index, folder, opts)
      index = result.index
      saveIndex(dest, index)
      if (result.added || result.updated || result.removed) onEvent(result)
    }, DEBOUNCE_MS)
  }

  const watchers = []

  if (platform !== 'linux') {
    // macOS/Windows: fs.watch's recursive option is a real, single OS-level
    // watch covering the whole subtree.
    try {
      watchers.push(watch(folder, { recursive: true }, scheduleUpdate))
    } catch {
      // Fall through to the manual per-directory approach below if the
      // platform claims recursive support but it fails in practice.
    }
  }

  let rescanTimer = null
  if (platform === 'linux' || watchers.length === 0) {
    const watchedDirs = new Set()
    function watchAllDirs() {
      if (stopped) return
      const dirs = new Set([folder, ...walkFiles(folder, opts).map((f) => f.fullPath.slice(0, f.fullPath.length - f.name.length - 1))])
      for (const dir of dirs) {
        if (watchedDirs.has(dir)) continue
        try {
          watchers.push(watch(dir, scheduleUpdate))
          watchedDirs.add(dir)
        } catch {
          // Directory vanished between the walk and the watch call, or a
          // permissions issue — skip it rather than fail the whole watcher.
        }
      }
    }
    watchAllDirs()
    rescanTimer = setInterval(watchAllDirs, LINUX_RESCAN_INTERVAL_MS)
  }

  return {
    stop() {
      stopped = true
      clearTimeout(debounceTimer)
      if (rescanTimer) clearInterval(rescanTimer)
      for (const w of watchers) w.close()
    },
    getIndex() {
      return index
    },
  }
}
`,
  },
  {
    path: "lib/witness-log.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional, best-effort integration with MultiWitness (sold separately) —
// its tamper-evident, hash-chained local log. If MULTIWITNESS_INGEST_TOKEN
// is set, every context-serving event is logged there: what was served and
// when, NEVER the actual file/calendar content. This is what makes "provably
// logged" a real claim rather than a slogan — the log is independently
// verifiable offline (see MultiWitness's own \`witness verify\`), and its
// hash chain means a served-context event can't be quietly edited or
// deleted after the fact without breaking the chain.
//
// Entirely optional: MultiVault works exactly the same with or without
// MultiWitness installed. A missing token, an unreachable server, or a
// slow response all fail silently here — logging what the AI saw must
// never be able to block or break serving it that context in the first
// place.

const LOG_TIMEOUT_MS = 800 // local loopback call — generous but bounded so a stalled MultiWitness never noticeably delays a context response

/**
 * Best-effort: log a context-serving event to MultiWitness, if configured.
 * Never throws — a logging failure must never prevent context from being
 * served. Returns true if the event was actually logged, false otherwise
 * (not configured, MultiWitness unreachable, etc.) — callers that want to
 * report logging status (e.g. an MCP tool's response) can use this, but
 * nothing should ever branch on it to decide whether to proceed.
 */
export async function logContextServed(detail) {
  const token = process.env.MULTIWITNESS_INGEST_TOKEN
  if (!token) return false
  const url = process.env.MULTIWITNESS_URL || 'http://localhost:8429'

  try {
    const res = await fetch(\`\${url}/api/events\`, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'multivault', action: 'context.served', detail }),
      signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    // MultiWitness not running, wrong port, network hiccup — all the same
    // outcome here: proceed without logging. See module comment.
    return false
  }
}

/** Whether MultiWitness logging is configured at all (for status/UX only). */
export function witnessConfigured() {
  return Boolean(process.env.MULTIWITNESS_INGEST_TOKEN)
}
`,
  },
  {
    path: "bin/vault-mcp.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point for MCP mode. This is what an MCP client (Claude Desktop,
// Claude Code, etc.) actually launches — see README's "MCP mode" section for
// the exact client config. Not meant to be run by hand in a normal terminal:
// it speaks JSON-RPC over stdio and expects a client on the other end.
//
// Usage (in an MCP client's config, not typed directly):
//   node bin/vault-mcp.mjs [--dest <path>]
//
// --dest defaults to ./.multivault, same default as the main CLI.

import process from 'node:process'
import { join } from 'node:path'
import { startMultiVaultServer } from '../lib/mcp-server.mjs'

function parseDest(argv) {
  const i = argv.indexOf('--dest')
  if (i !== -1 && argv[i + 1]) return argv[i + 1]
  return join(process.cwd(), '.multivault')
}

const dest = parseDest(process.argv.slice(2))

startMultiVaultServer(dest).catch((err) => {
  // MCP clients read stderr for diagnostics, not a JSON-RPC-shaped error —
  // this only fires on a startup failure (e.g. bad --dest), since ordinary
  // per-call errors are already handled inside the tool and returned as a
  // normal (isError: true) tool result instead of a process crash.
  process.stderr.write(\`multivault-mcp failed to start: \${err.message}\\n\`)
  process.exit(1)
})
`,
  },
  {
    path: "bin/vault.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Command-line runner for MultiVault.
//
// A local, encrypted snapshot of one folder (and, optionally, one .ics
// calendar file) that you can turn into a short context brief — paste it
// into any AI chat, or pipe it into an API call — instead of re-explaining
// your situation every time. No account, no OAuth, no cloud storage, nothing
// phoning home: the vault file lives on your machine and only your
// passphrase can open it.
//
// Subcommands:
//   vault init    [--folder <path>] [--ics <path>] [--dest <path>]
//   vault sync    [--dest <path>]
//   vault context [--dest <path>] [--format text|markdown|json]
//   vault status  [--dest <path>]
//
// Exit codes:
//   0  ran successfully
//   1  ran, but the passphrase was wrong or the vault could not be decrypted
//   2  could not run at all (bad usage, no vault found, folder not found)

import process from 'node:process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initVault, syncVault, buildContext, buildLiveContext, ensureIndex, statusVault, DecryptError } from '../lib/vault.mjs'
import { startWatcher } from '../lib/watcher.mjs'

const USAGE = \`multivault — a local, encrypted context snapshot of a folder and calendar,
with a BM25-ranked search index for large folders

Usage
  vault <command> [options]

Commands
  init      Create a new vault (generates and prints your passphrase — save it!)
  sync      Re-scan the folder/calendar and refresh the encrypted snapshot
  index     Build/update the search index once, without decrypting or printing anything
  watch     Keep the search index continuously updated in the background (Ctrl+C to stop)
  context   Print a context brief — whole-folder, or ranked search results with --query
  status    Show last-sync time and counts, without needing the passphrase

Options
  --folder <path>    Folder to watch (init: required unless already set; sync/index: overrides)
  --ics <path>       Path to a .ics calendar file to include (optional)
  --dest <path>      Where the vault lives (default: ./.multivault)
  --query <text>     context: search instead of dumping the whole folder — no passphrase needed
  --topk <n>         context --query: max results (default 8)
  --format <fmt>     context: text|markdown (default) or json
  --passphrase <p>   Passphrase (or set MULTIVAULT_PASSPHRASE — preferred, keeps it
                      out of your shell history). Not needed for context --query.
  -h, --help          Show this message
  -v, --version       Show the version

Examples
  vault init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
  vault sync                                     # whole-folder mode: snapshot + encrypt
  vault context                                  # paste this into a chat
  vault index                                    # pre-warm the search index (optional — auto-builds on first query)
  vault context --query "invoice overdue"        # ranked search, no passphrase needed
  vault context --format json | your-script      # pipe into your own tooling
  MULTIVAULT_PASSPHRASE=xxxx vault sync          # for cron/launchd/Task Scheduler
\`

class UsageError extends Error {}

function defaultDest() {
  return join(process.cwd(), '.multivault')
}

function parseArgs(argv) {
  const command = argv[0]
  const opts = { folder: null, ics: null, dest: null, format: 'markdown', passphrase: null, query: null, topK: null }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') { process.stdout.write(USAGE); process.exit(0) }
    if (arg === '-v' || arg === '--version') { process.stdout.write('multivault 3.0.0\\n'); process.exit(0) }
    if (arg === '--folder') { opts.folder = argv[++i]; continue }
    if (arg === '--ics') { opts.ics = argv[++i]; continue }
    if (arg === '--dest') { opts.dest = argv[++i]; continue }
    if (arg === '--format') { opts.format = argv[++i]; continue }
    if (arg === '--passphrase') { opts.passphrase = argv[++i]; continue }
    if (arg === '--query') { opts.query = argv[++i]; continue }
    if (arg === '--topk') { opts.topK = Number(argv[++i]); continue }
    throw new UsageError(\`Unknown option: \${arg}\`)
  }
  return { command, opts }
}

function resolvePassphrase(opts) {
  const passphrase = opts.passphrase ?? process.env.MULTIVAULT_PASSPHRASE
  if (!passphrase) {
    throw new UsageError(
      'No passphrase given. Pass --passphrase, or set MULTIVAULT_PASSPHRASE (recommended for scheduled runs).',
    )
  }
  return passphrase
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE)
    process.exit(0)
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    process.stdout.write('multivault 3.0.0\\n')
    process.exit(0)
  }
  const { command, opts } = parseArgs(argv)
  const dest = resolve(opts.dest ?? defaultDest())

  if (command === 'init') {
    const folder = opts.folder ? resolve(opts.folder) : null
    if (folder && (!existsSync(folder) || !statSync(folder).isDirectory())) {
      process.stderr.write(\`Folder not found: \${folder}\\n\`)
      process.exit(2)
    }
    const ics = opts.ics ? resolve(opts.ics) : null
    const passphrase = initVault(dest, { folder, icsPath: ics })
    process.stdout.write(\`Vault created at \${dest}\\n\\n\`)
    process.stdout.write(\`Your passphrase (shown once — save it now, e.g. in a password manager):\\n\\n\`)
    process.stdout.write(\`  \${passphrase}\\n\\n\`)
    process.stdout.write(
      \`There is no recovery if you lose this. It is never stored anywhere by this tool.\\n\` +
        \`Run "vault sync" next to take your first snapshot, or "vault context --query ..." to search — that path builds its own index automatically and needs no passphrase.\\n\`,
    )
    return
  }

  if (command === 'sync') {
    const passphrase = resolvePassphrase(opts)
    const result = syncVault(dest, passphrase, {
      folder: opts.folder ? resolve(opts.folder) : undefined,
      icsPath: opts.ics ? resolve(opts.ics) : undefined,
    })
    process.stdout.write(
      \`Synced: \${result.fileCount} file(s), \${result.eventCount} calendar event(s) at \${result.syncedAt}\\n\`,
    )
    return
  }

  if (command === 'index') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stderr.write(\`No vault found at \${dest}. Run "vault init" first.\\n\`)
      process.exit(2)
    }
    const folder = opts.folder ? resolve(opts.folder) : meta.folder
    if (!folder) {
      process.stderr.write('No folder configured. Pass --folder, or set one at "vault init" time.\\n')
      process.exit(2)
    }
    const index = ensureIndex(dest, folder)
    process.stdout.write(
      \`Indexed: \${Object.keys(index.files).length} file(s), \${index.docs.length} searchable chunk(s) at \${index.builtAt}\\n\`,
    )
    return
  }

  if (command === 'watch') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stderr.write(\`No vault found at \${dest}. Run "vault init" first.\\n\`)
      process.exit(2)
    }
    const folder = opts.folder ? resolve(opts.folder) : meta.folder
    if (!folder) {
      process.stderr.write('No folder configured. Pass --folder, or set one at "vault init" time.\\n')
      process.exit(2)
    }
    process.stdout.write(\`Watching \${folder} — index will stay current in the background. Ctrl+C to stop.\\n\`)
    const controller = startWatcher(dest, folder, {
      onUpdate: (result) => {
        const stamp = new Date().toISOString()
        process.stdout.write(\`\${stamp} re-indexed: +\${result.added} ~\${result.updated} -\${result.removed}\\n\`)
      },
    })
    // Keep the process alive until Ctrl+C; stop() closes the underlying
    // fs.watch handles cleanly rather than leaving them dangling.
    process.on('SIGINT', () => {
      controller.stop()
      process.stdout.write('\\nStopped.\\n')
      process.exit(0)
    })
    await new Promise(() => {}) // run forever
    return
  }

  if (command === 'context') {
    const format = opts.format === 'json' ? 'json' : 'markdown'
    if (opts.query) {
      // Search mode: no passphrase needed — see buildLiveContext in
      // lib/vault.mjs for why (nothing decrypted, nothing at rest read).
      const { text } = buildLiveContext(dest, { query: opts.query, topK: opts.topK ?? undefined, format })
      process.stdout.write(text)
      return
    }
    const passphrase = resolvePassphrase(opts)
    process.stdout.write(buildContext(dest, passphrase, { format }))
    return
  }

  if (command === 'status') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stdout.write(\`No vault found at \${dest}.\\n\`)
      process.exit(2)
    }
    process.stdout.write(JSON.stringify(meta, null, 2) + '\\n')
    return
  }

  throw new UsageError(\`Unknown command: \${command}\`)
}

main().catch((err) => {
  if (err instanceof UsageError) {
    process.stderr.write(\`\${err.message}\\n\\n\${USAGE}\`)
    process.exit(2)
  }
  if (err instanceof DecryptError) {
    process.stderr.write(\`\${err.message}\\n\`)
    process.exit(1)
  }
  process.stderr.write(\`\${err.message}\\n\`)
  process.exit(2)
})
`,
  },
  {
    path: "adapters/cron.sh",
    contents: `#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+.
#
# Runs "vault sync" on a schedule so your context brief never goes stale.
# Works anywhere: a spare laptop left on, a $4 VPS, a Raspberry Pi.
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (runs every hour, at :22 — off the hour, since cron everywhere
#      stacks up at :00):
#
#        22 * * * * MULTIVAULT_PASSPHRASE=xxxx MULTIVAULT_DEST=/home/you/.multivault /path/to/adapters/cron.sh
#
# Environment:
#   MULTIVAULT_PASSPHRASE  required — the passphrase shown at "vault init"
#   MULTIVAULT_DEST        where the vault lives (default: ./.multivault next to this package)
#   MULTIVAULT_LOG         where run logs are appended (default: ./multivault.log)
#
# Your passphrase lives only in the crontab line above (or better: a
# separate 0600-permissioned file you source before calling this script). It
# is never written by this adapter to the log or anywhere else.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")

DEST=\${MULTIVAULT_DEST:-"$PACKAGE_DIR/.multivault"}
LOG=\${MULTIVAULT_LOG:-"$PACKAGE_DIR/multivault.log"}

if [ -z "\${MULTIVAULT_PASSPHRASE:-}" ]; then
  echo "MULTIVAULT_PASSPHRASE is not set — see the header of this script." >&2
  exit 2
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "--- $STAMP ---"
  node "$PACKAGE_DIR/bin/vault.mjs" sync --dest "$DEST"
} >> "$LOG" 2>&1

echo "$STAMP $DEST -> see $LOG"
`,
  },
  {
    path: "adapters/launchd.plist",
    contents: `<!-- Copyright (c) 2026 [SELLER]. All rights reserved. -->
<!-- Licensed to a single purchaser under the terms in LICENSE.md. -->
<!-- Redistribution or resale of this source, in whole or in part, is not permitted. -->

<!--
  Adapter: launchd, the native scheduler on macOS. Preferred over cron there —
  launchd runs your jobs even after the machine sleeps and wakes.

  Install:
    1. Copy this file to ~/Library/LaunchAgents/com.multivault.sync.plist
    2. Edit the placeholders below: YOUR_USERNAME (three times), the package
       path (twice), and YOUR_PASSPHRASE_HERE (once) to match your setup.
       Prefer a wrapper script that reads the passphrase from a
       0600-permissioned file over pasting it into this plist directly, if
       other users can read your LaunchAgents folder.
    3. Load it:
         launchctl load ~/Library/LaunchAgents/com.multivault.sync.plist
    4. Check it's running:
         launchctl list | grep multivault

  Runs once an hour by default (StartInterval, in seconds — 3600 = 1 hour).

  To stop it:
    launchctl unload ~/Library/LaunchAgents/com.multivault.sync.plist
-->
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.multivault.sync</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/multivault/bin/vault.mjs</string>
    <string>sync</string>
    <string>--dest</string>
    <string>/Users/YOUR_USERNAME/.multivault</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>MULTIVAULT_PASSPHRASE</key>
    <string>YOUR_PASSPHRASE_HERE</string>
  </dict>

  <key>StartInterval</key>
  <integer>3600</integer>

  <key>RunAtLoad</key>
  <false/>

  <key>StandardOutPath</key>
  <string>/Users/YOUR_USERNAME/multivault/multivault.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/YOUR_USERNAME/multivault/multivault.log</string>
</dict>
</plist>
`,
  },
  {
    path: "adapters/windows-task.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: Windows Task Scheduler.
#
# Registers a scheduled task that runs "vault sync" hourly. Run this script
# ONCE to set it up; Windows takes it from there.
#
# Install:
#   1. Open PowerShell (does not need to be Administrator)
#   2. Run, replacing the passphrase with the one "vault init" printed:
#        powershell -ExecutionPolicy Bypass -File adapters\\windows-task.ps1 -Passphrase "xxxx"
#
# To remove the scheduled task later:
#   Unregister-ScheduledTask -TaskName "MultiVaultSync" -Confirm:$false
#
# The passphrase is stored as a per-user environment variable
# (MULTIVAULT_PASSPHRASE), not embedded in the task definition itself, so it
# does not show up in Task Scheduler's UI or export.

param(
  [Parameter(Mandatory = $true)]
  [string]$Passphrase,
  [string]$Dest = "$env:USERPROFILE\\.multivault"
)

$PackageDir = Split-Path -Parent $PSScriptRoot
$BinPath = Join-Path $PackageDir "bin\\vault.mjs"
$LogPath = Join-Path $PackageDir "multivault.log"

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org first."
  exit 2
}

[System.Environment]::SetEnvironmentVariable('MULTIVAULT_PASSPHRASE', $Passphrase, 'User')

$Arguments = "\`"$BinPath\`" sync --dest \`"$Dest\`""
$FullArguments = "/c \`"$NodePath\`" $Arguments >> \`"$LogPath\`" 2>&1"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $FullArguments
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "MultiVaultSync" \`
  -Action $Action -Trigger $Trigger -Settings $Settings \`
  -Description "Refreshes the MultiVault encrypted context snapshot hourly." \`
  -Force

Write-Host "Scheduled task 'MultiVaultSync' registered — syncing hourly."
Write-Host "Logs will be written to $LogPath"
Write-Host "Note: MULTIVAULT_PASSPHRASE was saved as a per-user environment variable."
`,
  },
  {
    path: "test/bm25.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { tokenize, termFrequencies } from '../lib/tokenize.mjs'
import { idf, scoreDoc, rank } from '../lib/bm25.mjs'

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

test('tokenize lowercases and splits on non-alphanumeric', () => {
  assert.deepEqual(tokenize('Client Prefers Async-Updates!'), ['client', 'prefers', 'async', 'updates'])
})

test('tokenize drops single-character tokens', () => {
  assert.deepEqual(tokenize('a b cc'), ['cc'])
})

test('tokenize handles empty/null input without throwing', () => {
  assert.deepEqual(tokenize(''), [])
  assert.deepEqual(tokenize(null), [])
  assert.deepEqual(tokenize(undefined), [])
})

test('termFrequencies counts correctly', () => {
  const result = termFrequencies('the cat sat on the mat')
  assert.deepEqual({ ...result }, { the: 2, cat: 1, sat: 1, on: 1, mat: 1 })
})

// ---------------------------------------------------------------------------
// BM25 — tested against known mathematical properties of the algorithm,
// not just "does it run"
// ---------------------------------------------------------------------------

test('idf: a term in every document scores a small positive number, not negative', () => {
  // The classic (unsmoothed) BM25 IDF formula goes negative here — this is
  // exactly the failure case the +1-smoothed variant exists to fix.
  const score = idf(10, 10)
  assert.ok(score > 0, \`expected positive IDF, got \${score}\`)
})

test('idf: a rare term scores higher than a common term', () => {
  const rare = idf(1000, 2)
  const common = idf(1000, 500)
  assert.ok(rare > common, 'a term in 2/1000 docs should outrank a term in 500/1000 docs')
})

test('idf: increases monotonically as a term gets rarer', () => {
  const scores = [900, 500, 100, 10, 1].map((df) => idf(1000, df))
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i] > scores[i - 1], \`idf should strictly increase as document frequency drops\`)
  }
})

test('scoreDoc: a document matching the query term outscores one that does not', () => {
  const corpus = { totalDocs: 2, avgDocLength: 5, docFreq: { async: 1 } }
  const matching = { tokens: { async: 1, updates: 1 }, length: 5 }
  const nonMatching = { tokens: { sync: 1, calls: 1 }, length: 5 }
  const queryTerms = ['async']
  assert.ok(scoreDoc(queryTerms, matching, corpus) > 0)
  assert.equal(scoreDoc(queryTerms, nonMatching, corpus), 0)
})

test('scoreDoc: higher term frequency scores higher (with diminishing returns)', () => {
  const corpus = { totalDocs: 3, avgDocLength: 10, docFreq: { budget: 3 } }
  const oneOccurrence = { tokens: { budget: 1 }, length: 10 }
  const fiveOccurrences = { tokens: { budget: 5 }, length: 10 }
  const tenOccurrences = { tokens: { budget: 10 }, length: 10 }
  const s1 = scoreDoc(['budget'], oneOccurrence, corpus)
  const s5 = scoreDoc(['budget'], fiveOccurrences, corpus)
  const s10 = scoreDoc(['budget'], tenOccurrences, corpus)
  assert.ok(s5 > s1, 'more occurrences should score higher')
  assert.ok(s10 > s5, 'more occurrences should score higher')
  // Diminishing returns: going from 5->10 occurrences should gain LESS than
  // going from 1->5 did, per unit — this is BM25's whole point vs. raw term
  // frequency, which would double-count a stuffed document linearly.
  const gain1to5 = s5 - s1
  const gain5to10 = s10 - s5
  assert.ok(gain5to10 < gain1to5, 'term-frequency saturation: later occurrences should matter less')
})

test('scoreDoc: a longer document with the same term density scores lower (length normalization)', () => {
  // Same term frequency, but the long doc is mostly OTHER content — BM25
  // should discount that relative to a short, focused document.
  const corpus = { totalDocs: 2, avgDocLength: 50, docFreq: { invoice: 2 } }
  const short = { tokens: { invoice: 3 }, length: 20 }
  const long = { tokens: { invoice: 3 }, length: 200 }
  assert.ok(scoreDoc(['invoice'], short, corpus) > scoreDoc(['invoice'], long, corpus))
})

test('scoreDoc: a query term absent from the whole corpus contributes zero, not an error', () => {
  const corpus = { totalDocs: 1, avgDocLength: 10, docFreq: { known: 1 } }
  const doc = { tokens: { known: 1 }, length: 10 }
  assert.equal(scoreDoc(['known', 'never-appears-anywhere'], doc, corpus), scoreDoc(['known'], doc, corpus))
})

test('rank: sorts descending by score and drops zero-score (irrelevant) docs', () => {
  const index = {
    totalDocs: 3,
    avgDocLength: 6,
    docFreq: { pricing: 2, refund: 1 },
    docs: [
      { id: 'a', tokens: { pricing: 1 }, length: 6 },
      { id: 'b', tokens: { pricing: 3, refund: 1 }, length: 6 },
      { id: 'c', tokens: { unrelated: 5 }, length: 6 }, // shares no term with the query
    ],
  }
  const results = rank(['pricing', 'refund'], index)
  assert.equal(results.length, 2, 'doc c shares no query term and should be dropped, not scored 0 and kept')
  assert.equal(results[0].doc.id, 'b', 'doc b matches both query terms and should rank first')
  assert.equal(results[1].doc.id, 'a')
})

test('rank: an exact, focused match beats a long document that only mentions the term once', () => {
  const index = {
    totalDocs: 2,
    avgDocLength: 100,
    docFreq: { deadline: 2 },
    docs: [
      { id: 'focused', tokens: { deadline: 4 }, length: 15 },
      { id: 'sprawling', tokens: { deadline: 1 }, length: 400 },
    ],
  }
  const results = rank(['deadline'], index)
  assert.equal(results[0].doc.id, 'focused')
})
`,
  },
  {
    path: "test/indexer.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync, unlinkSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildIndex, updateIndex } from '../lib/indexer.mjs'
import { rank } from '../lib/bm25.mjs'
import { tokenize } from '../lib/tokenize.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

test('buildIndex indexes eligible files and lists ineligible ones without content', () => {
  const dir = tempDir('idx-build')
  try {
    writeFileSync(join(dir, 'notes.md'), 'Client prefers async updates over calls.')
    writeFileSync(join(dir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const index = buildIndex(dir)
    assert.ok(index.files['notes.md'].eligible)
    assert.ok(index.files['notes.md'].docIds.length > 0)
    assert.equal(index.files['photo.png'].eligible, false)
    assert.equal(index.files['photo.png'].docIds.length, 0)
    assert.equal(index.totalDocs, index.docs.length)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('buildIndex never reads a file matching the sensitive-name pattern', () => {
  const dir = tempDir('idx-build')
  try {
    writeFileSync(join(dir, 'api-keys.txt'), 'sk-super-secret-value')
    const index = buildIndex(dir)
    assert.equal(index.files['api-keys.txt'].eligible, false)
    assert.equal(index.docs.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a query finds content via BM25 ranking against a built index', () => {
  const dir = tempDir('idx-build')
  try {
    writeFileSync(join(dir, 'a.md'), 'The invoice for Acme Corp is overdue by two weeks.')
    writeFileSync(join(dir, 'b.md'), 'Weekly standup notes: nothing blocking, ship on Friday.')
    const index = buildIndex(dir)
    const results = rank(tokenize('invoice overdue'), index)
    assert.ok(results.length > 0)
    assert.equal(results[0].doc.relPath, 'a.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex picks up a newly added file without touching unrelated docs', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Original content about pricing.')
    let index = buildIndex(dir)
    const originalDocCount = index.docs.length

    writeFileSync(join(dir, 'b.md'), 'New file about refunds.')
    const result = updateIndex(index, dir)
    assert.equal(result.added, 1)
    assert.equal(result.updated, 0)
    assert.equal(result.removed, 0)
    assert.ok(result.index.docs.length > originalDocCount)
    assert.ok(result.index.files['a.md'], 'unrelated file a.md should be untouched')
    assert.ok(result.index.files['b.md'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex detects a modified file (by mtime) and re-indexes only that file', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Old content mentions apples.')
    writeFileSync(join(dir, 'b.md'), 'Unrelated content about oranges.')
    let index = buildIndex(dir)

    // Change a.md's content AND bump its mtime forward so the change is detected.
    writeFileSync(join(dir, 'a.md'), 'New content mentions bananas now.')
    const future = new Date(Date.now() + 5000)
    utimesSync(join(dir, 'a.md'), future, future)

    const result = updateIndex(index, dir)
    assert.equal(result.updated, 1)
    assert.equal(result.added, 0)

    const appleResults = rank(tokenize('apples'), result.index)
    const bananaResults = rank(tokenize('bananas'), result.index)
    assert.equal(appleResults.length, 0, 'old content should no longer be findable')
    assert.equal(bananaResults.length, 1, 'new content should be findable')
    assert.equal(bananaResults[0].doc.relPath, 'a.md')

    // b.md's doc should be untouched — same doc id it had before.
    const bDoc = result.index.docs.find((d) => d.relPath === 'b.md')
    assert.ok(bDoc)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex removes a deleted file\\'s docs and its docFreq contribution', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Unique term zephyrsaurus appears only here.')
    writeFileSync(join(dir, 'b.md'), 'Common content about meetings.')
    let index = buildIndex(dir)
    assert.equal(index.docFreq['zephyrsaurus'], 1)

    unlinkSync(join(dir, 'a.md'))
    const result = updateIndex(index, dir)
    assert.equal(result.removed, 1)
    assert.equal(result.index.files['a.md'], undefined)
    assert.equal(result.index.docFreq['zephyrsaurus'], undefined, 'docFreq for the deleted file\\'s only term should be cleaned up, not left dangling')

    const results = rank(tokenize('zephyrsaurus'), result.index)
    assert.equal(results.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex is a no-op (no re-reads) for files whose mtime has not changed', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Stable content.')
    let index = buildIndex(dir)
    const originalDocIds = index.files['a.md'].docIds.slice()

    const result = updateIndex(index, dir) // nothing changed on disk
    assert.equal(result.added, 0)
    assert.equal(result.updated, 0)
    assert.equal(result.removed, 0)
    assert.deepEqual(result.index.files['a.md'].docIds, originalDocIds, 'doc ids should be identical, proving the file was not re-chunked/re-indexed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a large file is chunked and only its relevant chunk ranks highly for a specific query', () => {
  const dir = tempDir('idx-large')
  try {
    const filler = 'The quarterly newsletter covers many unrelated topics. '.repeat(60)
    const relevantSection = '\\n\\nIMPORTANT: the client contract renewal deadline is March 15th, confirmed by legal.\\n\\n'
    const moreFiller = 'More unrelated newsletter content follows here. '.repeat(60)
    writeFileSync(join(dir, 'newsletter.md'), filler + relevantSection + moreFiller)

    const index = buildIndex(dir)
    assert.ok(index.files['newsletter.md'].docIds.length > 1, 'a large file should produce multiple chunks')

    const results = rank(tokenize('contract renewal deadline'), index)
    assert.ok(results.length > 0)
    assert.ok(results[0].doc.text.includes('March 15th'), 'the top-ranked chunk should be the one actually containing the relevant content')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "test/mcp.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests for MultiVault v2's MCP mode. Run with: node test/mcp.test.mjs
//
// The MCP server test drives a REAL @modelcontextprotocol/sdk Client against
// the REAL createMultiVaultServer(), connected over the SDK's own in-memory
// linked-pair transport — not a hand-rolled mock of the protocol. This is
// the same client/server code path an actual MCP host (Claude Desktop,
// Claude Code) exercises; only the transport (in-memory vs. real stdio) and
// the client (the SDK's Client vs. a host application) differ.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { initVault, buildLiveContext } from '../lib/vault.mjs'
import { createMultiVaultServer } from '../lib/mcp-server.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

// ---------------------------------------------------------------------------
// buildLiveContext — the no-passphrase, always-fresh path MCP mode relies on
// ---------------------------------------------------------------------------

test('buildLiveContext reflects the CURRENT folder state, not a stale snapshot', () => {
  const watchedDir = tempDir('live-watch')
  const vaultDest = tempDir('live-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'first version')
    initVault(vaultDest, { folder: watchedDir }) // no sync — deliberately never synced

    const { text: before } = buildLiveContext(vaultDest)
    assert.ok(before.includes('a.md'))
    assert.ok(before.includes('first version'))

    // Change the folder AFTER init, with no \`vault sync\` in between.
    writeFileSync(join(watchedDir, 'b.md'), 'a second file appeared')
    const { text: after } = buildLiveContext(vaultDest)
    assert.ok(after.includes('b.md'), 'a file added after init should appear without a sync step')
    assert.ok(after.includes('a second file appeared'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('buildLiveContext requires no passphrase at all', () => {
  const watchedDir = tempDir('live-watch')
  const vaultDest = tempDir('live-dest')
  try {
    initVault(vaultDest, { folder: watchedDir }) // passphrase is generated and discarded here
    // No passphrase captured, none passed below — this must still work.
    const { snapshot } = buildLiveContext(vaultDest, { format: 'json' })
    assert.equal(snapshot.files.length, 0) // empty folder, but no error
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('buildLiveContext fails clearly when no vault has been initialized', () => {
  const emptyDest = tempDir('never-init')
  try {
    assert.throws(() => buildLiveContext(emptyDest), /Run "vault init" first/)
  } finally {
    rmSync(emptyDest, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// MCP server — real Client, real Server, real (in-memory) transport
// ---------------------------------------------------------------------------

async function connectedClient(dest) {
  const server = createMultiVaultServer(dest)
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, server }
}

test('MCP: tools/list exposes get_context and vault_status', async () => {
  const vaultDest = tempDir('mcp-dest')
  try {
    initVault(vaultDest, { folder: null })
    const { client } = await connectedClient(vaultDest)
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    assert.deepEqual(names, ['get_context', 'vault_status'])
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context returns live folder contents through the real protocol round-trip', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    writeFileSync(join(watchedDir, 'notes.md'), 'Client prefers async updates.')
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const result = await client.callTool({ name: 'get_context', arguments: {} })
    assert.equal(result.isError, undefined)
    const text = result.content[0].text
    assert.ok(text.includes('notes.md'))
    assert.ok(text.includes('Client prefers async updates.'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context picks up a file added AFTER the client connected (no restart needed)', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const firstResult = await client.callTool({ name: 'get_context', arguments: {} })
    assert.ok(!firstResult.content[0].text.includes('late.txt'))

    writeFileSync(join(watchedDir, 'late.txt'), 'added after the MCP session started')
    const secondResult = await client.callTool({ name: 'get_context', arguments: {} })
    assert.ok(secondResult.content[0].text.includes('late.txt'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context respects the format argument (json)', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    writeFileSync(join(watchedDir, 'x.md'), 'hello')
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const result = await client.callTool({ name: 'get_context', arguments: { format: 'json' } })
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.files[0].relPath, 'x.md')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: vault_status reports configured folder without needing a passphrase', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)
    const result = await client.callTool({ name: 'vault_status', arguments: {} })
    assert.ok(result.content[0].text.includes(watchedDir))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context with a query returns ranked, relevant results through the real protocol', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    writeFileSync(join(watchedDir, 'contract.md'), 'The renewal deadline for the Acme contract is March 15th.')
    writeFileSync(join(watchedDir, 'lunch.md'), 'Team lunch order: half want tacos, half want sushi.')
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const result = await client.callTool({ name: 'get_context', arguments: { query: 'contract renewal deadline' } })
    assert.equal(result.isError, undefined)
    assert.ok(result.content[0].text.includes('contract.md'))
    assert.ok(!result.content[0].text.includes('lunch.md'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: vault_status reflects the index once a query has run', async () => {
  const watchedDir = tempDir('mcp-watch')
  const vaultDest = tempDir('mcp-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Some indexed content.')
    initVault(vaultDest, { folder: watchedDir })
    const { client } = await connectedClient(vaultDest)

    const before = await client.callTool({ name: 'vault_status', arguments: {} })
    assert.ok(before.content[0].text.includes('not built yet'))

    await client.callTool({ name: 'get_context', arguments: { query: 'indexed' } })

    const after = await client.callTool({ name: 'vault_status', arguments: {} })
    assert.ok(after.content[0].text.includes('1 file(s) tracked'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('MCP: get_context on a never-initialized vault returns isError, not a crash', async () => {
  const emptyDest = tempDir('mcp-never-init')
  try {
    // Deliberately skip initVault — createMultiVaultServer + callTool must
    // still respond cleanly rather than throwing out of the MCP transport.
    const { client } = await connectedClient(emptyDest)
    const result = await client.callTool({ name: 'get_context', arguments: {} })
    assert.equal(result.isError, true)
    assert.ok(result.content[0].text.includes('vault init'))
  } finally {
    rmSync(emptyDest, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "test/query.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initVault, buildLiveContext, ensureIndex } from '../lib/vault.mjs'
import { loadIndex } from '../lib/index-store.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

test('buildLiveContext with no query behaves exactly like v1/v2 (whole-folder listing)', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Some content here.')
    initVault(vaultDest, { folder: watchedDir })
    const { text } = buildLiveContext(vaultDest)
    assert.ok(text.startsWith('# Context'), 'no-query path should still use the v1/v2 whole-folder format')
    assert.ok(text.includes('a.md'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('buildLiveContext with a query returns only relevant chunks, ranked', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'invoice.md'), 'Acme Corp invoice #4471 is overdue by 12 days.')
    writeFileSync(join(watchedDir, 'standup.md'), 'Daily standup: nothing blocking, on track for Friday.')
    initVault(vaultDest, { folder: watchedDir })

    const { text, snapshot } = buildLiveContext(vaultDest, { query: 'overdue invoice' })
    assert.ok(text.startsWith('# Search:'))
    assert.ok(text.includes('invoice.md'))
    assert.ok(!text.includes('standup.md'), 'irrelevant file should not appear in a targeted query result')
    assert.equal(snapshot.results[0].doc.relPath, 'invoice.md')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('a query automatically indexes on first call — no separate "vault index" step required', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'notes.md'), 'Project Phoenix launches in Q3.')
    initVault(vaultDest, { folder: watchedDir })
    // No explicit ensureIndex/vault-index call — buildLiveContext's query path should handle it.
    const { text } = buildLiveContext(vaultDest, { query: 'Phoenix launch' })
    assert.ok(text.includes('notes.md'))
    assert.ok(loadIndex(vaultDest), 'querying should have persisted an index to disk')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('a query picks up a file added after the vault was initialized (index updates incrementally)', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    buildLiveContext(vaultDest, { query: 'anything' }) // builds an initial (empty) index

    writeFileSync(join(watchedDir, 'late.md'), 'This file about zeppelins arrived after init.')
    const { text } = buildLiveContext(vaultDest, { query: 'zeppelins' })
    assert.ok(text.includes('late.md'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('a query with no matches returns a clear empty result, not an error', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Completely unrelated content.')
    initVault(vaultDest, { folder: watchedDir })
    const { text, snapshot } = buildLiveContext(vaultDest, { query: 'xyznonexistentterm' })
    assert.equal(snapshot.results.length, 0)
    assert.ok(text.includes('No matching content found'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('query respects topK to limit result count', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(watchedDir, \`doc\${i}.md\`), \`This document number \${i} discusses budgets extensively. Budget budget budget.\`)
    }
    initVault(vaultDest, { folder: watchedDir })
    const { snapshot } = buildLiveContext(vaultDest, { query: 'budgets', topK: 2 })
    assert.equal(snapshot.results.length, 2)
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('ensureIndex persists to disk and a second call is a cheap incremental no-op when nothing changed', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Stable content.')
    initVault(vaultDest, { folder: watchedDir })
    const first = ensureIndex(vaultDest, watchedDir)
    const firstDocIds = first.files['a.md'].docIds.slice()
    const second = ensureIndex(vaultDest, watchedDir)
    assert.deepEqual(second.files['a.md'].docIds, firstDocIds, 'unchanged file should keep the same doc ids across ensureIndex calls')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "test/run.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Test suite. Run with: npm test   (or: node test/run.mjs)
//
// Uses node:test and node:assert — both built in, so the package still
// installs nothing. Every test that touches the filesystem creates a real
// temporary directory and cleans up after itself — no mocked filesystem, so
// what passes here is what will actually happen on a buyer's machine.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encrypt, decrypt, generatePassphrase, DecryptError } from '../lib/crypto.mjs'
import { parseIcs } from '../lib/calendar.mjs'
import { scanFolder } from '../lib/scan.mjs'
import { initVault, syncVault, buildContext, statusVault, readSnapshot } from '../lib/vault.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

// ---------------------------------------------------------------------------
// crypto
// ---------------------------------------------------------------------------

test('encrypt/decrypt round-trips exactly', () => {
  const passphrase = generatePassphrase()
  const plaintext = Buffer.from(JSON.stringify({ hello: 'world', n: 42 }))
  const blob = encrypt(plaintext, passphrase)
  const out = decrypt(blob, passphrase)
  assert.equal(out.toString('utf8'), plaintext.toString('utf8'))
})

test('wrong passphrase fails to decrypt', () => {
  const blob = encrypt(Buffer.from('secret data'), 'correct-horse-battery-staple')
  assert.throws(() => decrypt(blob, 'wrong-passphrase'), DecryptError)
})

test('tampered ciphertext fails to decrypt (auth tag catches it)', () => {
  const blob = encrypt(Buffer.from('secret data'), 'a-passphrase')
  const tampered = Buffer.from(blob)
  tampered[tampered.length - 1] ^= 0xff // flip a bit in the ciphertext
  assert.throws(() => decrypt(tampered, 'a-passphrase'), DecryptError)
})

test('generatePassphrase produces distinct, reasonably long values', () => {
  const a = generatePassphrase()
  const b = generatePassphrase()
  assert.notEqual(a, b)
  assert.ok(a.length >= 32)
})

// ---------------------------------------------------------------------------
// calendar
// ---------------------------------------------------------------------------

test('parses a basic VEVENT', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'SUMMARY:Team sync',
    'DTSTART:20260910T150000Z',
    'DTEND:20260910T153000Z',
    'LOCATION:Zoom',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\\r\\n')
  const events = parseIcs(ics)
  assert.equal(events.length, 1)
  assert.equal(events[0].summary, 'Team sync')
  assert.equal(events[0].start, '2026-09-10T15:00:00Z')
  assert.equal(events[0].location, 'Zoom')
})

test('unfolds continuation lines per RFC 5545', () => {
  // The single leading space on the continuation line is the RFC 5545
  // folding whitespace and is removed during unfolding (not converted to a
  // space) — so a real word-boundary space in the folded content needs an
  // explicit second leading space, as below.
  const ics = ['BEGIN:VEVENT', 'SUMMARY:A very long title that got', '  folded onto a second line', 'END:VEVENT'].join(
    '\\r\\n',
  )
  const events = parseIcs(ics)
  assert.equal(events[0].summary, 'A very long title that got folded onto a second line')
})

test('unescapes commas, semicolons, and newlines in text fields', () => {
  const ics = ['BEGIN:VEVENT', 'SUMMARY:Coffee\\\\, then lunch\\\\; then done', 'END:VEVENT'].join('\\r\\n')
  const events = parseIcs(ics)
  assert.equal(events[0].summary, 'Coffee, then lunch; then done')
})

test('ignores malformed input gracefully (no crash, no partial event)', () => {
  assert.deepEqual(parseIcs('not an ics file at all'), [])
})

// ---------------------------------------------------------------------------
// folder scanning
// ---------------------------------------------------------------------------

test('lists files and excerpts allowlisted text formats', () => {
  const dir = tempDir('scan-test')
  try {
    writeFileSync(join(dir, 'notes.md'), '# Project notes\\nSome content here.')
    writeFileSync(join(dir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47])) // fake binary
    const entries = scanFolder(dir)
    const notes = entries.find((e) => e.relPath === 'notes.md')
    const photo = entries.find((e) => e.relPath === 'photo.png')
    assert.ok(notes.excerpt.includes('Project notes'))
    assert.equal(photo.excerpt, null) // never reads non-allowlisted extensions
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('never excerpts filenames that look like secrets, even with an allowlisted extension', () => {
  const dir = tempDir('scan-test')
  try {
    writeFileSync(join(dir, 'api-keys.txt'), 'sk-super-secret-value')
    const entries = scanFolder(dir)
    const keys = entries.find((e) => e.relPath === 'api-keys.txt')
    assert.equal(keys.excerpt, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('skips hidden files and node_modules', () => {
  const dir = tempDir('scan-test')
  try {
    writeFileSync(join(dir, '.hidden'), 'x')
    const entries = scanFolder(dir)
    assert.equal(entries.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('caps total files at maxFiles', () => {
  const dir = tempDir('scan-test')
  try {
    for (let i = 0; i < 10; i++) writeFileSync(join(dir, \`f\${i}.txt\`), 'x')
    const entries = scanFolder(dir, { maxFiles: 3 })
    assert.equal(entries.length, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// full vault lifecycle
// ---------------------------------------------------------------------------

test('init -> sync -> context end-to-end', () => {
  const watchedDir = tempDir('vault-watch')
  const vaultDest = tempDir('vault-dest')
  try {
    writeFileSync(join(watchedDir, 'brief.md'), 'Client prefers async updates over calls.')
    const passphrase = initVault(vaultDest, { folder: watchedDir })
    const result = syncVault(vaultDest, passphrase)
    assert.equal(result.fileCount, 1)

    const markdown = buildContext(vaultDest, passphrase)
    assert.ok(markdown.includes('brief.md'))
    assert.ok(markdown.includes('async updates'))

    const status = statusVault(vaultDest)
    assert.equal(status.fileCount, 1)
    assert.ok(status.lastSyncAt)
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('sync rejects a wrong passphrase instead of silently corrupting the vault', () => {
  const watchedDir = tempDir('vault-watch')
  const vaultDest = tempDir('vault-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    assert.throws(() => syncVault(vaultDest, 'definitely-the-wrong-passphrase'), DecryptError)
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('status works without the passphrase', () => {
  const vaultDest = tempDir('vault-dest')
  try {
    initVault(vaultDest, { folder: null })
    const status = statusVault(vaultDest)
    assert.equal(status.fileCount, 0)
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('init refuses to overwrite an existing vault', () => {
  const vaultDest = tempDir('vault-dest')
  try {
    initVault(vaultDest, { folder: null })
    assert.throws(() => initVault(vaultDest, { folder: null }), /already exists/)
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('readSnapshot reflects calendar events after sync', () => {
  const vaultDest = tempDir('vault-dest')
  const icsPath = join(tempDir('vault-ics'), 'cal.ics')
  writeFileSync(icsPath, ['BEGIN:VEVENT', 'SUMMARY:Quarterly review', 'DTSTART:20260915T120000Z', 'END:VEVENT'].join('\\r\\n'))
  try {
    const passphrase = initVault(vaultDest, { folder: null, icsPath })
    syncVault(vaultDest, passphrase)
    const snapshot = readSnapshot(vaultDest, passphrase)
    assert.equal(snapshot.events.length, 1)
    assert.equal(snapshot.events[0].summary, 'Quarterly review')
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "test/watcher.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { startWatcher } from '../lib/watcher.mjs'
import { rank } from '../lib/bm25.mjs'
import { tokenize } from '../lib/tokenize.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

test('startWatcher builds an initial index immediately', async () => {
  const watchedDir = tempDir('watch-watch')
  const vaultDest = tempDir('watch-dest')
  const controller = startWatcher(vaultDest, watchedDir)
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'initial content')
    // The initial index was built before this file existed, so it should
    // not be in it yet — this just confirms startWatcher() itself doesn't
    // throw and produces a usable index synchronously.
    assert.ok(controller.getIndex())
  } finally {
    controller.stop()
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('startWatcher picks up a new file reactively, without a manual query triggering it', async () => {
  const watchedDir = tempDir('watch-watch')
  const vaultDest = tempDir('watch-dest')
  let updateFired = false
  const controller = startWatcher(vaultDest, watchedDir, { onUpdate: () => { updateFired = true } })
  try {
    writeFileSync(join(watchedDir, 'zeppelin.md'), 'This document is about zeppelins specifically.')

    // Debounce is 800ms — poll for a bit past that rather than a single fixed sleep,
    // so this isn't flaky under slow CI/sandbox scheduling.
    const deadline = Date.now() + 4000
    while (!updateFired && Date.now() < deadline) {
      await sleep(150)
    }
    assert.ok(updateFired, 'onUpdate callback should have fired after the debounce window')

    const results = rank(tokenize('zeppelins'), controller.getIndex())
    assert.ok(results.length > 0, 'the reactively-indexed file should be findable')
    assert.equal(results[0].doc.relPath, 'zeppelin.md')
  } finally {
    controller.stop()
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('stop() actually tears down watching — a later file change is not picked up', async () => {
  const watchedDir = tempDir('watch-watch')
  const vaultDest = tempDir('watch-dest')
  let updateCount = 0
  const controller = startWatcher(vaultDest, watchedDir, { onUpdate: () => { updateCount++ } })
  controller.stop()

  writeFileSync(join(watchedDir, 'after-stop.md'), 'This should not trigger an update.')
  await sleep(1200) // well past the debounce window

  try {
    assert.equal(updateCount, 0, 'no update should fire after stop() was called')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "test/witness-log.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests for the MultiWitness integration in isolation. Stands up a plain
// http.Server matching MultiWitness's real /api/events contract (POST,
// Bearer auth, 201 on success) rather than depending on MultiWitness's own
// source being present — that's a separate product, and this test suite
// must pass on its own for a buyer who only purchased MultiVault.
//
// The real cross-product integration (this code talking to an ACTUAL running
// MultiWitness server, with its real hash chain) was verified separately
// against MultiWitness's real source before shipping; this suite locks in
// the same request/response contract so a future change can't silently
// break that compatibility.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { logContextServed, witnessConfigured } from '../lib/witness-log.mjs'

function startFakeWitness({ expectedToken, status = 201 } = {}) {
  const received = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const auth = req.headers.authorization
    if (expectedToken && auth !== \`Bearer \${expectedToken}\`) {
      res.writeHead(401)
      return res.end()
    }
    received.push(JSON.parse(body || '{}'))
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, received, port: server.address().port }))
  })
}

test('witnessConfigured reflects whether the ingest token env var is set', () => {
  const original = process.env.MULTIWITNESS_INGEST_TOKEN
  try {
    delete process.env.MULTIWITNESS_INGEST_TOKEN
    assert.equal(witnessConfigured(), false)
    process.env.MULTIWITNESS_INGEST_TOKEN = 'x'
    assert.equal(witnessConfigured(), true)
  } finally {
    if (original === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = original
  }
})

test('logContextServed returns false silently when no token is configured (never throws)', async () => {
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  delete process.env.MULTIWITNESS_INGEST_TOKEN
  try {
    const result = await logContextServed('some detail')
    assert.equal(result, false)
  } finally {
    if (originalToken !== undefined) process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})

test('logContextServed posts source/action/detail matching MultiWitness\\'s real event contract', async () => {
  const { server, received, port } = await startFakeWitness({ expectedToken: 'tok123' })
  const originalUrl = process.env.MULTIWITNESS_URL
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  process.env.MULTIWITNESS_URL = \`http://localhost:\${port}\`
  process.env.MULTIWITNESS_INGEST_TOKEN = 'tok123'
  try {
    const result = await logContextServed('2 file(s), 0 event(s) from /tmp/notes')
    assert.equal(result, true)
    assert.equal(received.length, 1)
    assert.equal(received[0].source, 'multivault')
    assert.equal(received[0].action, 'context.served')
    assert.equal(received[0].detail, '2 file(s), 0 event(s) from /tmp/notes')
  } finally {
    server.close()
    if (originalUrl === undefined) delete process.env.MULTIWITNESS_URL
    else process.env.MULTIWITNESS_URL = originalUrl
    if (originalToken === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})

test('logContextServed sends the token as a Bearer header and fails closed on a wrong one', async () => {
  const { server, received, port } = await startFakeWitness({ expectedToken: 'correct-token' })
  const originalUrl = process.env.MULTIWITNESS_URL
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  process.env.MULTIWITNESS_URL = \`http://localhost:\${port}\`
  process.env.MULTIWITNESS_INGEST_TOKEN = 'wrong-token'
  try {
    const result = await logContextServed('detail')
    assert.equal(result, false) // 401 from the server -> res.ok is false -> we report false
    assert.equal(received.length, 0)
  } finally {
    server.close()
    if (originalUrl === undefined) delete process.env.MULTIWITNESS_URL
    else process.env.MULTIWITNESS_URL = originalUrl
    if (originalToken === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})

test('logContextServed never throws when the target is unreachable', async () => {
  const originalUrl = process.env.MULTIWITNESS_URL
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  process.env.MULTIWITNESS_URL = 'http://localhost:1' // nothing listens on port 1
  process.env.MULTIWITNESS_INGEST_TOKEN = 'tok'
  try {
    const result = await logContextServed('detail')
    assert.equal(result, false)
  } finally {
    if (originalUrl === undefined) delete process.env.MULTIWITNESS_URL
    else process.env.MULTIWITNESS_URL = originalUrl
    if (originalToken === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})
`,
  },
  {
    path: "scripts/build-sea.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Builds a standalone, double-clickable executable using Node's own built-in
// Single Executable Application (SEA) support — no third-party binary
// download, no cross-compilation. This is deliberately NOT a cross-platform
// build: SEA works by injecting a JS blob into a COPY of the Node binary
// that's already on the machine running this script, so it produces a
// binary for whatever OS/architecture you run it on.
//
// To get all of Windows, macOS, and Linux binaries, run this once on each:
//   - On Windows:      node scripts/build-sea.mjs   -> dist/vault-win-x64.exe
//   - On a Mac:        node scripts/build-sea.mjs   -> dist/vault-macos-<arch>
//   - On Linux:        node scripts/build-sea.mjs   -> dist/vault-linux-x64
//
// Requires Node 20+ and normal internet access (esbuild/postject need to
// install from npm the first time). Verified working end-to-end on Linux —
// see README's "Standalone binaries" section for the unsigned-binary
// warnings you'll want to know about before shipping these to buyers.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform, arch } from 'node:process'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'dist')
const TMP = join(ROOT, 'dist-tmp')

const PLATFORM_NAMES = { win32: 'win', darwin: 'macos', linux: 'linux' }
const outName = \`vault-\${PLATFORM_NAMES[platform] ?? platform}-\${arch}\${platform === 'win32' ? '.exe' : ''}\`

function run(cmd, args) {
  console.log(\`> \${cmd} \${args.join(' ')}\`)
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT })
}

mkdirSync(DIST, { recursive: true })
mkdirSync(TMP, { recursive: true })

console.log('1/4 Bundling ESM source into a single CommonJS file (esbuild)...')
run('npx', [
  'esbuild',
  join(ROOT, 'bin/vault.mjs'),
  '--bundle',
  '--platform=node',
  '--format=cjs',
  \`--outfile=\${join(TMP, 'vault-bundle.cjs')}\`,
  '--external:node:*',
])

console.log('2/4 Generating the SEA preparation blob...')
const seaConfigPath = join(TMP, 'sea-config.json')
run('node', ['-e', \`require('fs').writeFileSync(\${JSON.stringify(seaConfigPath)}, JSON.stringify({ main: \${JSON.stringify(join(TMP, 'vault-bundle.cjs'))}, output: \${JSON.stringify(join(TMP, 'sea-prep.blob'))}, disableExperimentalSEAWarning: true }))\`])
run('node', ['--experimental-sea-config', seaConfigPath])

console.log('3/4 Copying the local Node binary as the base...')
const outPath = join(DIST, outName)
copyFileSync(process.execPath, outPath)
if (platform !== 'win32') chmodSync(outPath, 0o755)

console.log('4/4 Injecting the blob (postject)...')
const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
const postjectArgs = [outPath, 'NODE_SEA_BLOB', join(TMP, 'sea-prep.blob'), '--sentinel-fuse', sentinel]
if (platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA')
run('npx', ['postject', ...postjectArgs])

console.log(\`\\nDone: \${outPath}\`)
if (platform === 'darwin') {
  console.log('macOS note: this binary is not notarized/signed. Buyers will need to')
  console.log('right-click -> Open the first time, or run: xattr -d com.apple.quarantine <path>')
} else if (platform === 'win32') {
  console.log('Windows note: this binary is not code-signed. SmartScreen will warn on first run.')
}
`,
  },
]
