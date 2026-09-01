// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiwitness/tools/embed-source.mjs from the real
// package source. Regenerate after changing the package:
//
//   node packages/multiwitness/tools/embed-source.mjs
//
// This is the payload for the MultiWitness product (SKU AI-CN-006): the
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

export const MULTIWITNESS_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiWitness

A tamper-evident, hash-chained action log for your AI agents.

Every event any tool logs here is chained to the one before it with a
SHA-256 hash — editing, deleting, or reordering a past entry breaks every
hash after it. Point your other MultiConnect tools (or anything else) at
it, and you get a provable answer to "what did my agent actually do,"
checkable by anyone with the log file — no server, no trust required.

## Install

Windows: \`.\\install.ps1\`
macOS / Linux: \`./install.sh\`

This starts MultiWitness in the foreground and prints a dashboard URL,
a dashboard token, and a separate ingest token.

## Two tokens, on purpose

- **Dashboard token** — for you. Reads the history, runs verification.
- **Ingest token** — for other tools. Can only append a new event; there is
  no update or delete route for it to misuse even if it leaks.

Give the ingest token to any of your other MultiConnect connectors (or
your own scripts, cron jobs, anything) so their actions get logged here
too.

## Logging an event

\`\`\`bash
curl -X POST http://localhost:8429/api/events \\
  -H "Authorization: Bearer YOUR_INGEST_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"source":"multiconnect-shopify","action":"order.confirmation_drafted","detail":"Order #4821"}'
\`\`\`

## Verifying the chain

From the dashboard, hit **Verify chain now**. Or, without the server even
running — this is the point of the whole product — from the command line:

\`\`\`bash
node bin/witness.mjs verify
# or, from anywhere:
multiwitness verify /path/to/witness.log.jsonl
\`\`\`

It reads the raw log file, recomputes every hash, and tells you plainly
whether the chain is intact or exactly where it broke.

## Development

\`\`\`bash
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step, no database. The
log is a plain JSON Lines file you can back up, move, or hand to someone
else to verify independently.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiwitness — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines as you like, logging as many of your own tools as you like. Do not
resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines and log events from unlimited tools of your own.
- Modify the source freely. It is plain JavaScript with no build step precisely so
  that you can.
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

In particular: this software provides tamper-EVIDENCE, not tamper-PREVENTION —
it detects after the fact whether the log file has been altered; it does not
stop someone with access to the file from altering it. You are responsible for
keeping your dashboard token, ingest token, and the log file itself
appropriately secured for whatever you're using it as evidence of.

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
  "name": "multiwitness",
  "version": "1.0.0",
  "description": "A tamper-evident, hash-chained action log for your AI agents — proof of what they did, checkable by anyone with the file.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiwitness": "./bin/witness.mjs"
  },
  "main": "./lib/server.mjs",
  "exports": {
    ".": "./lib/server.mjs",
    "./chain": "./lib/chain.mjs"
  },
  "files": [
    "bin",
    "lib",
    "adapters",
    "install.sh",
    "install.ps1",
    "README.md",
    "LICENSE.md"
  ],
  "scripts": {
    "start": "node bin/witness.mjs start",
    "test": "node test/run.mjs"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
  },
  {
    path: "install.sh",
    contents: `#!/usr/bin/env bash
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install it from https://nodejs.org and re-run this script." >&2
  exit 1
fi

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node $(node --version) found, but 18+ is required." >&2
  exit 1
fi

DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
echo "Starting MultiWitness..."
echo ""
node "$DIR/bin/witness.mjs" start
`,
  },
  {
    path: "install.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "Node.js 18+ is required. Install it from https://nodejs.org and re-run this script."
    exit 1
}

$version = (& node --version) -replace 'v', ''
$major = [int]($version.Split('.')[0])
if ($major -lt 18) {
    Write-Error "Node $version found, but 18+ is required."
    exit 1
}

Write-Host "Starting MultiWitness..."
Write-Host ""
node "$PSScriptRoot\\bin\\witness.mjs" start
`,
  },
  {
    path: "lib/chain.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole product, really. Every event appended here includes a SHA-256
// hash of the *previous* entry's hash, so changing or deleting any past
// entry breaks every hash after it — the same construction a blockchain
// uses, applied to a plain append-only file instead of a distributed
// ledger, because a single local file with a checkable chain is all a
// small business actually needs: proof of what an agent did, checkable by
// anyone with the file, no server trust required.
//
// The log is a JSON Lines file (one JSON object per line) specifically so
// verifyChain() can work on the raw file directly — including from the CLI
// with the witness process not even running — rather than requiring a
// database or this package's own server to be trusted to tell the truth
// about its own history.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const GENESIS_HASH = '0'.repeat(64)

function defaultLogPath() {
  return path.resolve(process.cwd(), 'witness.log.jsonl')
}

/**
 * @typedef {{
 *   seq: number,
 *   at: string,
 *   source: string,
 *   action: string,
 *   detail: string | null,
 *   prevHash: string,
 *   hash: string
 * }} ChainEntry
 */

/**
 * The hash covers everything about this entry except its own hash field —
 * changing any of seq/at/source/action/detail/prevHash after the fact
 * produces a different hash than what's stored, which is exactly what
 * verifyChain() checks for.
 * @param {Omit<ChainEntry, 'hash'>} entry
 */
function computeHash(entry) {
  const payload = JSON.stringify({
    seq: entry.seq,
    at: entry.at,
    source: entry.source,
    action: entry.action,
    detail: entry.detail,
    prevHash: entry.prevHash,
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/** Reads every line of the log file as parsed entries, in order. */
function readEntries(logPath) {
  if (!existsSync(logPath)) return []
  const raw = readFileSync(logPath, 'utf8')
  return raw
    .split('\\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

/** The last entry's hash, or the genesis hash if the log is empty. */
function tipHash(entries) {
  return entries.length ? entries[entries.length - 1].hash : GENESIS_HASH
}

/**
 * Append one event to the chain. This is the ONLY way an entry is ever
 * added — there is deliberately no update or delete function anywhere in
 * this module. A witness log you can edit isn't a witness log.
 * @param {{ source: string, action: string, detail?: string | null }} event
 * @param {string} [logPath]
 * @returns {ChainEntry}
 */
export function appendEvent(event, logPath = defaultLogPath()) {
  if (!event.source || !event.action) {
    throw new Error('An event needs at least a source and an action.')
  }
  const entries = readEntries(logPath)
  const prevHash = tipHash(entries)
  const base = {
    seq: entries.length + 1,
    at: new Date().toISOString(),
    source: event.source,
    action: event.action,
    detail: event.detail ?? null,
    prevHash,
  }
  const hash = computeHash(base)
  /** @type {ChainEntry} */
  const full = { ...base, hash }

  mkdirSync(path.dirname(logPath), { recursive: true })
  appendFileSync(logPath, JSON.stringify(full) + '\\n', 'utf8')
  return full
}

/**
 * @param {string} [logPath]
 * @param {number} [limit]
 * @returns {ChainEntry[]} most recent first
 */
export function recentEntries(logPath = defaultLogPath(), limit = 50) {
  const entries = readEntries(logPath)
  return entries.slice(-limit).reverse()
}

/**
 * Recompute every hash in the chain from scratch and compare against what's
 * stored. The moment one entry's stored hash doesn't match what its own
 * fields recompute to, OR its prevHash doesn't match the entry before it,
 * the chain is broken from that point on — everything after an edited or
 * deleted entry becomes unverifiable, which is the entire point.
 * @param {string} [logPath]
 * @returns {{ valid: boolean, totalEntries: number, brokenAtSeq: number | null, reason: string | null }}
 */
export function verifyChain(logPath = defaultLogPath()) {
  const entries = readEntries(logPath)
  let expectedPrevHash = GENESIS_HASH

  for (const entry of entries) {
    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtSeq: entry.seq,
        reason: \`Entry \${entry.seq}'s prevHash doesn't match the previous entry's hash — the chain link is broken here (an entry before this one was likely altered, reordered, or deleted).\`,
      }
    }
    const recomputed = computeHash({
      seq: entry.seq,
      at: entry.at,
      source: entry.source,
      action: entry.action,
      detail: entry.detail,
      prevHash: entry.prevHash,
    })
    if (recomputed !== entry.hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtSeq: entry.seq,
        reason: \`Entry \${entry.seq}'s stored hash doesn't match its own contents — this entry's fields were edited after it was written.\`,
      }
    }
    expectedPrevHash = entry.hash
  }

  return { valid: true, totalEntries: entries.length, brokenAtSeq: null, reason: null }
}

export { defaultLogPath, GENESIS_HASH }
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two tokens, deliberately separate: dashboardToken gates reading the log
// and running verification (what you type into the dashboard yourself);
// ingestToken gates writing to it (what you configure other tools — your
// other MultiConnect connectors, a cron job, anything — to send). Splitting
// them means a connector you've configured to log events here only ever
// holds a token that can append, never one that can read the whole
// history or trigger a verify.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8429

/**
 * @typedef {{
 *   port: number,
 *   dashboardToken: string,
 *   ingestToken: string,
 *   createdAt: string
 * }} WitnessConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'witness.config.json')
}

/** @returns {WitnessConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    dashboardToken: randomBytes(16).toString('hex'),
    ingestToken: randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {WitnessConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) {
    const fresh = defaults()
    saveConfig(fresh, configPath)
    return fresh
  }
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  return { ...defaults(), ...parsed }
}

/**
 * @param {WitnessConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
`,
  },
  {
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two surfaces behind two different tokens. /api/events (POST) is the
// ingest route — any other tool with the ingest token can append an event,
// and that's ALL the ingest token can do; there's no update or delete route
// for it to misuse even if leaked. Everything else (reading history,
// running verification, seeing both tokens) requires the dashboard token,
// which you keep for yourself.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig } from './config.mjs'
import { appendEvent, recentEntries, verifyChain, defaultLogPath } from './chain.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.join(__dirname, 'ui')

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

function bearerToken(req) {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 200_000) { reject(new Error('Payload too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

function serveStatic(res, file) {
  try {
    const full = path.join(UI_DIR, file)
    if (!full.startsWith(UI_DIR)) throw new Error('bad path')
    const body = readFileSync(full)
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

/**
 * @param {{ configPath?: string, logPath?: string, port?: number }} [opts]
 */
export function createServer(opts = {}) {
  let config = loadConfig(opts.configPath)
  if (opts.port) config.port = opts.port
  const logPath = opts.logPath ?? defaultLogPath()

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveStatic(res, 'index.html')
    if (req.method === 'GET' && url.pathname === '/app.js') return serveStatic(res, 'app.js')
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })

    // ---- ingest: append-only, gated by its own separate token ----
    if (req.method === 'POST' && url.pathname === '/api/events') {
      if (bearerToken(req) !== config.ingestToken) {
        return json(res, 401, { error: 'Unauthorized. Use the ingest token, not the dashboard token.' })
      }
      try {
        const body = await readJsonBody(req)
        const entry = appendEvent({ source: body.source, action: body.action, detail: body.detail }, logPath)
        return json(res, 201, { entry })
      } catch (err) {
        return json(res, 400, { error: err.message })
      }
    }

    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404)
      return res.end('Not found')
    }

    // ---- everything else: dashboard token only ----
    if (bearerToken(req) !== config.dashboardToken) {
      return json(res, 401, { error: 'Unauthorized. Use the dashboard token shown when the connector started.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { dashboardToken, ingestToken, ...safe } = config
      return json(res, 200, { ...safe, ingestToken })
    }

    if (req.method === 'GET' && url.pathname === '/api/entries') {
      return json(res, 200, { entries: recentEntries(logPath, Number(url.searchParams.get('limit') ?? 50)) })
    }

    if (req.method === 'GET' && url.pathname === '/api/verify') {
      return json(res, 200, verifyChain(logPath))
    }

    res.writeHead(404)
    res.end()
  })

  return { server, config }
}
`,
  },
  {
    path: "lib/ui/app.js",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcw-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcw-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcw-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

async function runVerify() {
  const result = await api('/api/verify')
  const el = document.getElementById('verify-status')
  if (result.valid) {
    el.innerHTML = \`<div class="verify-status ok">✓ Chain intact — \${result.totalEntries} entries, all verified.</div>\`
  } else {
    el.innerHTML = \`<div class="verify-status broken">✗ Chain broken at entry \${result.brokenAtSeq}.<br/>\${result.reason}</div>\`
  }
}
document.getElementById('run-verify').addEventListener('click', runVerify)

async function refreshEntries() {
  const { entries } = await api('/api/entries?limit=50')
  const el = document.getElementById('entries')
  el.innerHTML = entries.length
    ? entries.map((e) => \`
      <div class="entry">
        <span class="tag">#\${e.seq} · \${e.source} · \${e.at}</span><br/>
        <strong>\${e.action}</strong>\${e.detail ? ' — ' + e.detail : ''}<br/>
        <span class="hash">hash: \${e.hash}</span>
      </div>
    \`).join('')
    : '<p class="sub">No events yet.</p>'
}
document.getElementById('refresh').addEventListener('click', refreshEntries)

async function init() {
  gate.hidden = true
  app.hidden = false
  const config = await api('/api/config')
  document.getElementById('ingest-url').value = \`\${location.origin}/api/events\`
  document.getElementById('ingest-token').value = config.ingestToken
  await runVerify()
  await refreshEntries()
}

if (token) init()
`,
  },
  {
    path: "lib/ui/index.html",
    contents: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MultiWitness</title>
<style>
  :root{--ink:#080000;--panel:#150808;--line:#4A1212;--paper:#FFD4D4;--muted:#E86A6A;--brass:#FF2A2A;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--paper);font-family:system-ui,-apple-system,sans-serif;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 60px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:var(--muted);font-size:13px;margin:0 0 28px}
  section{border:1px solid var(--line);border-radius:6px;padding:18px;margin-bottom:18px;background:var(--panel)}
  h2{font-size:15px;margin:0 0 12px}
  label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
  input{width:100%;background:#0c0404;color:var(--paper);border:1px solid var(--line);border-radius:4px;padding:8px 10px;font-family:inherit;font-size:14px;margin-bottom:10px}
  button{background:var(--brass);color:var(--ink);font-weight:600;font-size:13px;padding:8px 14px;border:none;border-radius:4px;cursor:pointer}
  button.ghost{background:transparent;color:var(--brass);border:1px solid var(--line)}
  .entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  .hash{color:#7a5252;font-size:10px;word-break:break-all}
  .verify-status{padding:14px;border-radius:6px;margin-bottom:12px;font-size:14px}
  .verify-status.ok{background:#1a3d1a;color:#7cd67c}
  .verify-status.broken{background:#3d1a1a;color:#ff9c9c}
  #token-gate{text-align:center;padding-top:60px}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiWitness</h1>
    <p class="sub">Paste the dashboard token shown in your terminal when it started.</p>
    <input id="token-input" placeholder="dashboard token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiWitness</h1>
  <p class="sub">A tamper-evident, hash-chained record of what your tools have done.</p>

  <section>
    <h2>Chain integrity</h2>
    <div id="verify-status"></div>
    <button id="run-verify">Verify chain now</button>
  </section>

  <section>
    <h2>Ingest</h2>
    <p class="sub">Give this token (not your dashboard token) to any tool you want logging events here.</p>
    <label>Ingest endpoint</label>
    <input id="ingest-url" readonly/>
    <label>Ingest token</label>
    <input id="ingest-token" readonly/>
  </section>

  <section>
    <h2>Recent events</h2>
    <button class="ghost" id="refresh">Refresh</button>
    <div id="entries"></div>
  </section>
</div>

<script src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "bin/witness.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two commands. \`start\` runs the dashboard/ingest server, same as every
// other MultiConnect tool. \`verify\` is the one this product is built
// around: it reads the log file directly and recomputes the whole chain,
// with witness NOT running and no server, no token, nothing to trust but
// the file itself and this code. That's deliberate — a witness log an
// auditor can only check by trusting your running server isn't much of a
// witness log.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'
import { verifyChain, defaultLogPath } from '../lib/chain.mjs'

const USAGE = \`multiwitness — a tamper-evident, hash-chained action log

Usage
  multiwitness start [options]
  multiwitness verify [path]

Options (start)
  --port <n>       Port to listen on (default: 8429)
  --config <path>  Path to witness.config.json (default: ./witness.config.json)

verify reads the log directly and recomputes the whole hash chain — no
server, no token required. Point it at a log file (default:
./witness.log.jsonl) and it tells you whether every entry is intact.

  -h, --help       Show this message
  -v, --version    Show the version
\`

function parseStartArgs(argv) {
  const args = { port: undefined, config: undefined }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') args.port = Number(argv[++i])
    else if (argv[i] === '--config') args.config = argv[++i]
  }
  return args
}

function runVerify(argv) {
  const logPath = argv[0] && !argv[0].startsWith('-') ? argv[0] : defaultLogPath()
  const result = verifyChain(logPath)
  console.log('')
  console.log(\`  Checked: \${logPath}\`)
  console.log(\`  Entries: \${result.totalEntries}\`)
  console.log('')
  if (result.valid) {
    console.log('  ✓ Chain is intact. Every entry\\'s hash matches its contents, and every')
    console.log('    prevHash correctly links to the entry before it.')
    console.log('')
    process.exit(0)
  } else {
    console.log(\`  ✗ Chain is BROKEN at entry \${result.brokenAtSeq}.\`)
    console.log(\`    \${result.reason}\`)
    console.log('')
    process.exit(1)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]

  if (cmd === '-h' || cmd === '--help' || !cmd) {
    console.log(USAGE)
    process.exit(cmd ? 0 : 2)
  }
  if (cmd === '-v' || cmd === '--version') {
    console.log('1.0.0')
    process.exit(0)
  }
  if (cmd === 'verify') {
    runVerify(argv.slice(1))
    return
  }
  if (cmd !== 'start') {
    console.log(USAGE)
    process.exit(2)
  }

  const args = parseStartArgs(argv.slice(1))
  const { server, config } = createServer({ port: args.port, configPath: args.config ?? defaultConfigPath() })

  server.listen(config.port, () => {
    console.log('')
    console.log('  MultiWitness is running.')
    console.log('')
    console.log(\`  Dashboard:      http://localhost:\${config.port}\`)
    console.log(\`  Dashboard token: \${config.dashboardToken}\`)
    console.log('')
    console.log(\`  Ingest endpoint: http://localhost:\${config.port}/api/events\`)
    console.log(\`  Ingest token:    \${config.ingestToken}\`)
    console.log('')
    console.log('  Give the ingest token (not the dashboard token) to any other tool you')
    console.log('  want logging events here.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiwitness: fatal —', err.message)
  process.exit(2)
})
`,
  },
  {
    path: "adapters/systemd.service",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Linux equivalent of adapters/windows-task.ps1.
#
# Install:
#   sed -i "s|REPLACE_WITH_PACKAGE_PATH|$(pwd)|g" adapters/systemd.service
#   mkdir -p ~/.config/systemd/user
#   cp adapters/systemd.service ~/.config/systemd/user/multiwitness.service
#   systemctl --user enable --now multiwitness

[Unit]
Description=MultiWitness
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/witness.mjs start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`,
  },
  {
    path: "adapters/windows-task.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Registers MultiWitness as a Windows Scheduled Task that starts silently at
# logon and keeps running in the background.
#
# Usage (from an elevated PowerShell prompt, run from the package root):
#   .\\adapters\\windows-task.ps1

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$binPath = Join-Path $packageRoot 'bin\\witness.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiWitness" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. MultiWitness will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiWitness'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiWitness'"
`,
  },
  {
    path: "test/chain.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { appendEvent, recentEntries, verifyChain, GENESIS_HASH } from '../lib/chain.mjs'

function tempLogPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcw-chain-'))
  return { logPath: path.join(dir, 'witness.log.jsonl'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('appendEvent requires a source and an action', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    assert.throws(() => appendEvent({ action: 'x' }, logPath))
    assert.throws(() => appendEvent({ source: 'x' }, logPath))
  } finally {
    cleanup()
  }
})

test('the first entry chains to the genesis hash', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const entry = appendEvent({ source: 'test', action: 'first' }, logPath)
    assert.equal(entry.seq, 1)
    assert.equal(entry.prevHash, GENESIS_HASH)
    assert.equal(entry.hash.length, 64)
  } finally {
    cleanup()
  }
})

test('each subsequent entry chains to the previous entry\\'s hash', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const first = appendEvent({ source: 'test', action: 'one' }, logPath)
    const second = appendEvent({ source: 'test', action: 'two' }, logPath)
    const third = appendEvent({ source: 'test', action: 'three' }, logPath)
    assert.equal(second.prevHash, first.hash)
    assert.equal(third.prevHash, second.hash)
    assert.equal(third.seq, 3)
  } finally {
    cleanup()
  }
})

test('verifyChain reports valid on an untouched, freshly written chain', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)
    appendEvent({ source: 'c', action: 'three' }, logPath)
    const result = verifyChain(logPath)
    assert.equal(result.valid, true)
    assert.equal(result.totalEntries, 3)
    assert.equal(result.brokenAtSeq, null)
  } finally {
    cleanup()
  }
})

test('verifyChain reports valid on an empty (nonexistent) log', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const result = verifyChain(logPath)
    assert.equal(result.valid, true)
    assert.equal(result.totalEntries, 0)
  } finally {
    cleanup()
  }
})

test('verifyChain detects a directly edited field in an entry', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)
    appendEvent({ source: 'c', action: 'three' }, logPath)

    // Simulate tampering: rewrite entry 2's action without recomputing its hash.
    const lines = readFileSync(logPath, 'utf8').trim().split('\\n')
    const tampered = JSON.parse(lines[1])
    tampered.action = 'something else entirely'
    lines[1] = JSON.stringify(tampered)
    writeFileSync(logPath, lines.join('\\n') + '\\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
    assert.equal(result.brokenAtSeq, 2)
    assert.match(result.reason, /own contents/)
  } finally {
    cleanup()
  }
})

test('verifyChain detects a deleted middle entry, breaking the chain link', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)
    appendEvent({ source: 'c', action: 'three' }, logPath)

    // Simulate tampering: remove entry 2 entirely, leaving 1 and 3.
    const lines = readFileSync(logPath, 'utf8').trim().split('\\n')
    writeFileSync(logPath, [lines[0], lines[2]].join('\\n') + '\\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
    // Entry 3's prevHash still points at the (now-missing) entry 2's hash,
    // so the break surfaces at entry 3's seq, not entry 2's.
    assert.equal(result.brokenAtSeq, 3)
    assert.match(result.reason, /prevHash/)
  } finally {
    cleanup()
  }
})

test('verifyChain detects entries reordered out of sequence', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)

    const lines = readFileSync(logPath, 'utf8').trim().split('\\n')
    writeFileSync(logPath, [lines[1], lines[0]].join('\\n') + '\\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
  } finally {
    cleanup()
  }
})

test('verifyChain catches tampering with the LAST entry too, not just middle ones', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)

    const lines = readFileSync(logPath, 'utf8').trim().split('\\n')
    const tampered = JSON.parse(lines[1])
    tampered.detail = 'injected after the fact'
    lines[1] = JSON.stringify(tampered)
    writeFileSync(logPath, lines.join('\\n') + '\\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
    assert.equal(result.brokenAtSeq, 2)
  } finally {
    cleanup()
  }
})

test('recentEntries returns most-recent-first, respecting the limit', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    for (let i = 1; i <= 5; i++) appendEvent({ source: 'test', action: \`event-\${i}\` }, logPath)
    const entries = recentEntries(logPath, 3)
    assert.equal(entries.length, 3)
    assert.equal(entries[0].action, 'event-5')
    assert.equal(entries[2].action, 'event-3')
  } finally {
    cleanup()
  }
})

test('detail defaults to null when not provided, and is preserved when it is', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const withDetail = appendEvent({ source: 'a', action: 'x', detail: 'some detail' }, logPath)
    const withoutDetail = appendEvent({ source: 'a', action: 'y' }, logPath)
    assert.equal(withDetail.detail, 'some detail')
    assert.equal(withoutDetail.detail, null)
  } finally {
    cleanup()
  }
})
`,
  },
  {
    path: "test/run.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import './chain.test.mjs'
import './server.test.mjs'
`,
  },
  {
    path: "test/server.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcw-test-'))
  const configPath = path.join(dir, 'witness.config.json')
  const logPath = path.join(dir, 'witness.log.jsonl')
  const { server, config } = createServer({ port: 0, configPath, logPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    dashboardToken: config.dashboardToken,
    ingestToken: config.ingestToken,
    close: () => {
      server.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('healthz responds without auth', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/healthz\`)
    assert.equal(res.status, 200)
  } finally {
    ctx.close()
  }
})

test('the two tokens are different from each other', async () => {
  const ctx = await boot()
  try {
    assert.notEqual(ctx.dashboardToken, ctx.ingestToken)
  } finally {
    ctx.close()
  }
})

test('ingesting an event requires the ingest token, not the dashboard token', async () => {
  const ctx = await boot()
  try {
    const withDashboardToken = await fetch(\`http://localhost:\${ctx.port}/api/events\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.dashboardToken}\` },
      body: JSON.stringify({ source: 'test', action: 'test-event' }),
    })
    assert.equal(withDashboardToken.status, 401)

    const withIngestToken = await fetch(\`http://localhost:\${ctx.port}/api/events\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.ingestToken}\` },
      body: JSON.stringify({ source: 'test', action: 'test-event' }),
    })
    assert.equal(withIngestToken.status, 201)
  } finally {
    ctx.close()
  }
})

test('reading entries requires the dashboard token, not the ingest token', async () => {
  const ctx = await boot()
  try {
    const withIngestToken = await fetch(\`http://localhost:\${ctx.port}/api/entries\`, {
      headers: { authorization: \`Bearer \${ctx.ingestToken}\` },
    })
    assert.equal(withIngestToken.status, 401)

    const withDashboardToken = await fetch(\`http://localhost:\${ctx.port}/api/entries\`, {
      headers: { authorization: \`Bearer \${ctx.dashboardToken}\` },
    })
    assert.equal(withDashboardToken.status, 200)
  } finally {
    ctx.close()
  }
})

test('running verify requires the dashboard token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/verify\`, {
      headers: { authorization: \`Bearer \${ctx.ingestToken}\` },
    })
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('an ingested event shows up in the dashboard entries list and passes verification', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/events\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.ingestToken}\` },
      body: JSON.stringify({ source: 'multiconnect-shopify', action: 'order.confirmation_drafted', detail: 'Order #4821' }),
    })
    const entriesRes = await fetch(\`http://localhost:\${ctx.port}/api/entries\`, { headers: { authorization: \`Bearer \${ctx.dashboardToken}\` } })
    const { entries } = await entriesRes.json()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].source, 'multiconnect-shopify')

    const verifyRes = await fetch(\`http://localhost:\${ctx.port}/api/verify\`, { headers: { authorization: \`Bearer \${ctx.dashboardToken}\` } })
    const verify = await verifyRes.json()
    assert.equal(verify.valid, true)
    assert.equal(verify.totalEntries, 1)
  } finally {
    ctx.close()
  }
})

test('config API exposes the ingest token (needed to configure other tools) but never the dashboard token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.dashboardToken}\` } })
    const body = await res.json()
    assert.equal(body.ingestToken, ctx.ingestToken)
    assert.ok(!('dashboardToken' in body))
  } finally {
    ctx.close()
  }
})

test('ingest rejects an event missing source or action', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/events\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.ingestToken}\` },
      body: JSON.stringify({ action: 'no-source' }),
    })
    assert.equal(res.status, 400)
  } finally {
    ctx.close()
  }
})

test('dashboard root serves HTML', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/\`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\\/html/)
  } finally {
    ctx.close()
  }
})
`,
  },
]
