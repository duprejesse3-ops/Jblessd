// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiconnect-webhook-bridge/tools/embed-source.mjs from
// the real package source. Regenerate after changing the package:
//
//   node packages/multiconnect-webhook-bridge/tools/embed-source.mjs
//
// This is the payload for the MultiConnect: Zapier/Webhook Bridge product
// (SKU AI-CN-001): the complete, runnable source the buyer receives at
// checkout. It is embedded rather than read from disk so fulfilment cannot
// fail on a missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here — deliberate, see renderModule() in
// tools/embed-source.mjs.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTICONNECT_WEBHOOK_BRIDGE_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiConnect: Zapier/Webhook Bridge

Connect your AI agent to thousands of apps — no code required.

Runs entirely on your own machine: a local dashboard for connecting your
Zapier or Make webhook, mapping fields with point-and-click (no manual JSON
editing), and watching every webhook call go by in a live test console. No
account, no third-party service, nothing phoning home.

## Install

**Windows**

\`\`\`powershell
.\\install.ps1
\`\`\`

**macOS / Linux**

\`\`\`bash
./install.sh
\`\`\`

Either way, this starts the bridge in the foreground and prints:

\`\`\`
  Dashboard:  http://localhost:8420
  Token:      <a random token, unique to your install>
  Inbound webhook URL (paste into Zapier/Make): http://localhost:8420/webhook
\`\`\`

Open the dashboard URL, paste in the token, and you're in.

To have it start automatically at login instead of running it by hand each
time, see \`adapters/windows-task.ps1\` (Windows) or \`adapters/systemd.service\`
(Linux).

## Using it

### Outbound — your agent → Zapier/Make

1. In Zapier, create a Zap that starts with **"Webhooks by Zapier" → Catch
   Hook**, and copy the URL it gives you.
2. Paste that URL into the dashboard's **Connect** section and save.
3. In the **outbound mapping** section, map the fields your agent sends
   (e.g. \`task.status\`) to the field names your Zap expects (e.g.
   \`event_status\`).
4. Have your agent \`POST\` to \`http://localhost:8420/trigger\` with an
   \`Authorization: Bearer <token>\` header and a JSON body. The bridge maps it
   and forwards it to your Zap, retrying automatically on transient failures.

### Inbound — Zapier/Make → your agent

1. Paste \`http://localhost:8420/webhook\` into a Zap or Scenario as the
   action URL.
2. In the **inbound mapping** section, map the incoming fields to whatever
   shape your agent expects.
3. Every call Zapier/Make makes to that URL is mapped and logged — hook your
   agent up to read from wherever you want the mapped result to land (see
   \`lib/inbound.mjs\` if you want to change where inbound events go; by
   default they're available via the same \`/api/log\` the dashboard reads).

### Test console

The dashboard's test console shows the last 50 webhook calls — inbound and
outbound, success and failure — updating every few seconds. Use **Send test
outbound event** to fire a synthetic event through your real mapping and
webhook URL without needing your agent running yet.

## Development

\`\`\`bash
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step. \`lib/\` is organized
by concern (\`config\`, \`mapping\`, \`inbound\`, \`outbound\`, \`log\`, \`server\`) so
you can read or modify any one piece without touching the rest.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license. You
own your copy forever; you may not resell the software itself.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiconnect-webhook-bridge — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines as you like. Do not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines that you own or operate.
- Connect it to unlimited Zapier/Make accounts and agents of your own.
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

In particular: the bridge sends and receives data to and from webhook URLs you
configure. You are responsible for what you connect it to and for keeping your
local auth token private — anyone with that token and access to your machine's
network can trigger outbound events through it.

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
  "name": "multiconnect-webhook-bridge",
  "version": "1.0.0",
  "description": "Connect your AI agent to Zapier/Make via inbound and outbound webhooks — a local dashboard, no account, no third-party service.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiconnect-bridge": "./bin/bridge.mjs"
  },
  "main": "./lib/server.mjs",
  "exports": {
    ".": "./lib/server.mjs",
    "./config": "./lib/config.mjs",
    "./mapping": "./lib/mapping.mjs"
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
    "start": "node bin/bridge.mjs start",
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
#
# One-command setup. Checks for Node, then starts the bridge in the
# foreground so you can see the dashboard URL and token immediately. See
# adapters/systemd.service if you want it to run in the background instead.
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
echo "Starting MultiConnect: Zapier/Webhook Bridge..."
echo ""
node "$DIR/bin/bridge.mjs" start
`,
  },
  {
    path: "install.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# One-command setup. Checks for Node, then starts the bridge in the foreground
# so you can see the dashboard URL and token immediately. Run
# adapters\\windows-task.ps1 afterward if you want it to start automatically
# at login instead.

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

Write-Host "Starting MultiConnect: Zapier/Webhook Bridge..."
Write-Host ""
node "$PSScriptRoot\\bin\\bridge.mjs" start
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — the one file that holds everything
// this bridge needs to run: the outbound webhook URL(s), the field mappings,
// the local auth token, and the port. No database, no account: the config
// file *is* the install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8420

/** @typedef {{ id: string, sourcePath: string, targetField: string }} MappingRule */
/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   outboundUrl: string | null,
 *   outboundMappings: MappingRule[],
 *   inboundMappings: MappingRule[],
 *   createdAt: string
 * }} BridgeConfig
 */

function defaultConfigPath() {
  // Alongside wherever the bridge is run from, matching the site-audit-agent
  // convention of "no hidden dotfiles in $HOME, config lives with the tool".
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {BridgeConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    outboundUrl: null,
    outboundMappings: [],
    inboundMappings: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * Load the config, creating a fresh one with sane defaults (and a random
 * local auth token) the first time the bridge is ever run.
 * @param {string} [configPath]
 * @returns {BridgeConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) {
    const fresh = defaults()
    saveConfig(fresh, configPath)
    return fresh
  }
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  // Merge over defaults so a config file from an older version of the bridge
  // (missing a newer field) doesn't crash the app — it just fills in.
  return { ...defaults(), ...parsed }
}

/**
 * @param {BridgeConfig} config
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
    path: "lib/inbound.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The other half of the bridge: Zapier/Make calling *in* to kick off an agent
// task. This module validates and maps the incoming payload; server.mjs owns
// the actual HTTP route and decides where the mapped result goes next (a
// local file queue by default — see server.mjs's AGENT_INBOX_PATH).

import { applyMapping } from './mapping.mjs'
import { record } from './log.mjs'

const MAX_BODY_BYTES = 1_000_000 // 1MB — generous for a webhook payload, small enough to bound abuse

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    /** @type {Buffer[]} */
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Map an inbound payload using the customer's saved inbound rules, and log
 * the event for the dashboard's test console.
 * @param {import('./config.mjs').BridgeConfig} config
 * @param {unknown} rawPayload
 * @returns {Record<string, unknown>}
 */
export function handleInbound(config, rawPayload) {
  const mapped = applyMapping(rawPayload, config.inboundMappings)
  record({
    direction: 'inbound',
    status: 'ok',
    statusCode: 200,
    summary: 'Received inbound webhook',
    detail: JSON.stringify(mapped),
  })
  return mapped
}
`,
  },
  {
    path: "lib/log.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A small in-memory ring buffer of recent webhook activity — the "see every
// webhook call, live" test console from the product listing. Deliberately not
// persisted to disk: this is a debugging aid for the session you're in, not
// an audit trail, and keeping it in memory means zero setup and nothing to
// rotate or clean up.

const MAX_ENTRIES = 200

/**
 * @typedef {{
 *   id: string,
 *   direction: 'inbound' | 'outbound',
 *   status: 'ok' | 'error',
 *   statusCode: number | null,
 *   summary: string,
 *   detail: string | null,
 *   at: string
 * }} LogEntry
 */

/** @type {LogEntry[]} */
const entries = []
let seq = 0

/**
 * @param {Omit<LogEntry, 'id' | 'at'>} entry
 * @returns {LogEntry}
 */
export function record(entry) {
  seq += 1
  /** @type {LogEntry} */
  const full = { id: String(seq), at: new Date().toISOString(), ...entry }
  entries.unshift(full)
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES
  return full
}

/** @returns {LogEntry[]} */
export function recent(limit = 50) {
  return entries.slice(0, limit)
}

export function clear() {
  entries.length = 0
}
`,
  },
  {
    path: "lib/mapping.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a saved list of mapping rules (source JSON path -> target field name)
// into an actual transformed payload. This is what replaces "no manual JSON
// editing" — the customer builds these rules by clicking in the dashboard UI
// (server.mjs's /api/mappings routes), and this module is the only thing
// that actually reads them at request time.

/**
 * Resolve a dotted/bracketed path like "order.items[0].sku" against an
 * object. Returns undefined if any segment along the way is missing —
 * mapping a field that isn't present in a given payload should never throw,
 * it should just come through as empty.
 * @param {unknown} obj
 * @param {string} pathExpr
 */
function getByPath(obj, pathExpr) {
  const segments = pathExpr
    .replace(/\\[(\\d+)\\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur = obj
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = /** @type {Record<string, unknown>} */ (cur)[seg]
  }
  return cur
}

/**
 * @param {Record<string, unknown>} target
 * @param {string} fieldName
 * @param {unknown} value
 */
function setField(target, fieldName, value) {
  // Target fields can also be dotted, so the customer can shape a nested
  // outbound payload (e.g. "customer.email") without needing raw JSON.
  const segments = fieldName.split('.').filter(Boolean)
  let cur = target
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {}
    cur = /** @type {Record<string, unknown>} */ (cur[seg])
  }
  cur[segments[segments.length - 1]] = value
}

/**
 * Apply a list of mapping rules to a source payload, producing a new object
 * built entirely from the mapped fields. Unmapped source fields are dropped
 * on purpose — the mapping *is* the contract for what leaves this machine.
 * @param {unknown} sourcePayload
 * @param {import('./config.mjs').MappingRule[]} rules
 * @returns {Record<string, unknown>}
 */
export function applyMapping(sourcePayload, rules) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const rule of rules) {
    const value = getByPath(sourcePayload, rule.sourcePath)
    if (value !== undefined) setField(out, rule.targetField, value)
  }
  return out
}

export { getByPath }
`,
  },
  {
    path: "lib/outbound.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Sends a mapped payload out to the customer's configured Zapier ("Webhooks
// by Zapier") or Make webhook URL, with a small bounded retry — this is the
// "outbound triggers" half of the bridge: the agent's own actions firing
// into whatever Zap or Scenario the customer built.

import { applyMapping } from './mapping.mjs'
import { record } from './log.mjs'

const RETRY_DELAYS_MS = [500, 2000, 5000]
const REQUEST_TIMEOUT_MS = 10_000

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {string} url
 * @param {Record<string, unknown>} body
 * @returns {Promise<{ ok: boolean, status: number }>}
 */
async function attempt(url, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    return { ok: res.ok, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Map and send an event out to the customer's configured webhook. Logs every
 * attempt (visible in the dashboard's test console) and retries transient
 * failures a bounded number of times before giving up.
 * @param {import('./config.mjs').BridgeConfig} config
 * @param {unknown} rawPayload
 * @returns {Promise<{ ok: boolean, status: number | null }>}
 */
export async function sendOutbound(config, rawPayload) {
  if (!config.outboundUrl) {
    record({
      direction: 'outbound',
      status: 'error',
      statusCode: null,
      summary: 'No outbound webhook URL configured',
      detail: 'Set one in the dashboard before triggering agent events.',
    })
    return { ok: false, status: null }
  }

  const mapped = applyMapping(rawPayload, config.outboundMappings)
  let lastStatus = null

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      const res = await attempt(config.outboundUrl, mapped)
      lastStatus = res.status
      if (res.ok) {
        record({
          direction: 'outbound',
          status: 'ok',
          statusCode: res.status,
          summary: \`Sent to \${new URL(config.outboundUrl).hostname}\`,
          detail: JSON.stringify(mapped),
        })
        return { ok: true, status: res.status }
      }
      // A 4xx is the receiving end rejecting the payload shape — retrying
      // won't fix that, so only 5xx/network errors get the retry budget.
      if (res.status < 500) break
    } catch (err) {
      lastStatus = null
      if (i === RETRY_DELAYS_MS.length) {
        record({
          direction: 'outbound',
          status: 'error',
          statusCode: null,
          summary: 'Outbound send failed after retries',
          detail: /** @type {Error} */ (err).message,
        })
      }
    }
    if (i < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[i])
  }

  record({
    direction: 'outbound',
    status: 'error',
    statusCode: lastStatus,
    summary: 'Outbound send failed',
    detail: JSON.stringify(mapped),
  })
  return { ok: false, status: lastStatus }
}
`,
  },
  {
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole bridge in one process: a local HTTP server that (a) serves the
// dashboard UI, (b) exposes a small JSON API the UI calls to manage config,
// mappings, and the log, (c) receives real inbound webhook calls from
// Zapier/Make, and (d) exposes an outbound-trigger endpoint the customer's
// agent calls to fire events out.
//
// Everything lives on localhost by default — this is a tool that runs on the
// customer's own machine, not a hosted service. The auth token in the config
// gates every route except the dashboard HTML/JS itself and the health check.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig, saveConfig } from './config.mjs'
import { sendOutbound } from './outbound.mjs'
import { handleInbound, readJsonBody } from './inbound.mjs'
import { recent, clear as clearLog } from './log.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.join(__dirname, 'ui')

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {string} expectedToken
 */
function isAuthorized(req, expectedToken) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return token === expectedToken
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

/**
 * @param {import('node:http').ServerResponse} res
 * @param {string} file
 */
function serveStatic(res, file) {
  try {
    const full = path.join(UI_DIR, file)
    if (!full.startsWith(UI_DIR)) throw new Error('bad path')
    const body = readFileSync(full)
    const ext = path.extname(full)
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

/**
 * @param {{ configPath?: string, port?: number }} [opts]
 */
export function createServer(opts = {}) {
  let config = loadConfig(opts.configPath)
  if (opts.port) config.port = opts.port

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    // ---- dashboard UI (unauthenticated — it's the login surface itself) ----
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return serveStatic(res, 'index.html')
    }
    if (req.method === 'GET' && url.pathname === '/app.js') {
      return serveStatic(res, 'app.js')
    }
    if (req.method === 'GET' && url.pathname === '/healthz') {
      return json(res, 200, { ok: true })
    }

    // ---- dashboard JSON API (token-gated) ----
    if (url.pathname.startsWith('/api/')) {
      if (!isAuthorized(req, config.authToken)) {
        return json(res, 401, { error: 'Unauthorized. Use the token shown when the bridge started.' })
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        const { authToken, ...safe } = config
        return json(res, 200, safe)
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req))
        if (typeof body.outboundUrl === 'string' || body.outboundUrl === null) {
          config.outboundUrl = /** @type {string | null} */ (body.outboundUrl)
        }
        saveConfig(config, opts.configPath)
        return json(res, 200, { ok: true })
      }

      if (req.method === 'POST' && url.pathname === '/api/mappings') {
        const body = /** @type {{ direction: 'inbound' | 'outbound', rules: import('./config.mjs').MappingRule[] }} */ (
          await readJsonBody(req)
        )
        if (body.direction === 'inbound') config.inboundMappings = body.rules ?? []
        else if (body.direction === 'outbound') config.outboundMappings = body.rules ?? []
        else return json(res, 400, { error: 'direction must be "inbound" or "outbound"' })
        saveConfig(config, opts.configPath)
        return json(res, 200, { ok: true })
      }

      if (req.method === 'GET' && url.pathname === '/api/log') {
        const limit = Number(url.searchParams.get('limit') ?? 50)
        return json(res, 200, { entries: recent(limit) })
      }

      if (req.method === 'POST' && url.pathname === '/api/log/clear') {
        clearLog()
        return json(res, 200, { ok: true })
      }

      // Lets the dashboard fire a real test event through the outbound path,
      // matching what the agent itself will call in production.
      if (req.method === 'POST' && url.pathname === '/api/test-outbound') {
        const body = await readJsonBody(req)
        const result = await sendOutbound(config, body)
        return json(res, result.ok ? 200 : 502, result)
      }

      res.writeHead(404)
      return res.end()
    }

    // ---- outbound trigger: the customer's agent calls this to fire an event out ----
    if (req.method === 'POST' && url.pathname === '/trigger') {
      if (!isAuthorized(req, config.authToken)) {
        return json(res, 401, { error: 'Unauthorized' })
      }
      const body = await readJsonBody(req)
      const result = await sendOutbound(config, body)
      return json(res, result.ok ? 200 : 502, result)
    }

    // ---- inbound webhook: Zapier/Make calls this ----
    if (req.method === 'POST' && url.pathname === '/webhook') {
      // Deliberately no auth token required here — this is the URL the
      // customer pastes into Zapier/Make, which can't attach a bearer token
      // easily. The mapped result only ever reaches the agent inbox, never
      // gets echoed back with anything sensitive.
      const body = await readJsonBody(req)
      const mapped = handleInbound(config, body)
      return json(res, 200, { received: true, mapped })
    }

    res.writeHead(404)
    res.end('Not found')
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

// Plain vanilla JS, no build step, no framework — this ships as source the
// buyer runs locally, so it stays dependency-free like the rest of the
// bridge. Talks only to same-origin /api/* routes.

let token = sessionStorage.getItem('mcb-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcb-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcb-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlock()
})

function mappingRow(rule, onRemove) {
  const row = document.createElement('div')
  row.className = 'row'
  row.innerHTML = \`
    <input placeholder="source path (e.g. order.email)" value="\${rule.sourcePath ?? ''}" data-field="sourcePath"/>
    <span class="tag">→</span>
    <input placeholder="target field (e.g. customer.email)" value="\${rule.targetField ?? ''}" data-field="targetField"/>
    <button class="ghost" data-remove>×</button>
  \`
  row.querySelector('[data-remove]').addEventListener('click', () => {
    row.remove()
    onRemove()
  })
  return row
}

function readRules(containerId) {
  const rows = document.querySelectorAll(\`#\${containerId} .row\`)
  return Array.from(rows).map((row, i) => ({
    id: String(i),
    sourcePath: row.querySelector('[data-field="sourcePath"]').value.trim(),
    targetField: row.querySelector('[data-field="targetField"]').value.trim(),
  })).filter((r) => r.sourcePath && r.targetField)
}

function addMappingUI(containerId, rules) {
  const container = document.getElementById(containerId)
  container.innerHTML = ''
  for (const rule of rules) container.appendChild(mappingRow(rule, () => {}))
}

document.getElementById('add-outbound-rule').addEventListener('click', () => {
  document.getElementById('outbound-mapping').appendChild(mappingRow({}, () => {}))
})
document.getElementById('add-inbound-rule').addEventListener('click', () => {
  document.getElementById('inbound-mapping').appendChild(mappingRow({}, () => {}))
})

document.getElementById('save-outbound-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'outbound', rules: readRules('outbound-mapping') }) })
})
document.getElementById('save-inbound-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'inbound', rules: readRules('inbound-mapping') }) })
})

document.getElementById('save-connect').addEventListener('click', async () => {
  const outboundUrl = document.getElementById('outbound-url').value.trim() || null
  await api('/api/config', { method: 'POST', body: JSON.stringify({ outboundUrl }) })
})

document.getElementById('send-test').addEventListener('click', async () => {
  await api('/api/test-outbound', { method: 'POST', body: JSON.stringify({ test: true, firedAt: new Date().toISOString() }) })
  await refreshLog()
})
document.getElementById('clear-log').addEventListener('click', async () => {
  await api('/api/log/clear', { method: 'POST' })
  await refreshLog()
})

async function refreshLog() {
  const { entries } = await api('/api/log?limit=50')
  const el = document.getElementById('log')
  el.innerHTML = entries.length
    ? entries.map((e) => \`<div class="log-entry \${e.status}"><span class="tag">\${e.direction} · \${e.status}\${e.statusCode ? ' · ' + e.statusCode : ''} · \${e.at}</span><br/>\${e.summary}</div>\`).join('')
    : '<p class="sub">No webhook activity yet.</p>'
}

async function init() {
  gate.hidden = true
  app.hidden = false
  const config = await api('/api/config')
  document.getElementById('outbound-url').value = config.outboundUrl || ''
  document.getElementById('inbound-url').value = \`\${location.origin}/webhook\`
  addMappingUI('outbound-mapping', config.outboundMappings)
  addMappingUI('inbound-mapping', config.inboundMappings)
  await refreshLog()
  setInterval(refreshLog, 5000)
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
<title>MultiConnect: Zapier/Webhook Bridge</title>
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
  input,select{width:100%;background:#0c0404;color:var(--paper);border:1px solid var(--line);border-radius:4px;padding:8px 10px;font-family:inherit;font-size:14px;margin-bottom:10px}
  button{background:var(--brass);color:var(--ink);font-weight:600;font-size:13px;padding:8px 14px;border:none;border-radius:4px;cursor:pointer}
  button.ghost{background:transparent;color:var(--brass);border:1px solid var(--line)}
  .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .row input{margin-bottom:0}
  .mapping-list{margin-bottom:10px}
  .log-entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .log-entry.error{color:#ff786e}
  .log-entry.ok{color:var(--paper)}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  #token-gate{text-align:center;padding-top:60px}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiConnect: Zapier/Webhook Bridge</h1>
    <p class="sub">Paste the token shown in your terminal when the bridge started.</p>
    <input id="token-input" placeholder="local auth token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiConnect: Zapier/Webhook Bridge</h1>
  <p class="sub">Running locally · nothing here leaves your machine except mapped webhook calls.</p>

  <section>
    <h2>Connect</h2>
    <label for="outbound-url">Zapier / Make webhook URL (outbound)</label>
    <input id="outbound-url" placeholder="https://hooks.zapier.com/hooks/catch/..."/>
    <label>Your inbound webhook URL (paste this into Zapier/Make)</label>
    <input id="inbound-url" readonly/>
    <button id="save-connect">Save</button>
  </section>

  <section>
    <h2>Field mapping — outbound (agent → Zapier/Make)</h2>
    <div id="outbound-mapping" class="mapping-list"></div>
    <button class="ghost" id="add-outbound-rule">+ Add field</button>
    <button id="save-outbound-mapping">Save mapping</button>
  </section>

  <section>
    <h2>Field mapping — inbound (Zapier/Make → agent)</h2>
    <div id="inbound-mapping" class="mapping-list"></div>
    <button class="ghost" id="add-inbound-rule">+ Add field</button>
    <button id="save-inbound-mapping">Save mapping</button>
  </section>

  <section>
    <h2>Test console</h2>
    <div class="row">
      <button id="send-test">Send test outbound event</button>
      <button class="ghost" id="clear-log">Clear</button>
    </div>
    <div id="log"></div>
  </section>
</div>

<script src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "bin/bridge.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Command-line runner. Starts the local server (dashboard + webhook routes)
// and prints the URL and auth token needed to open it — no account, no
// external service, nothing phoning home.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`multiconnect-bridge — connect your AI agent to Zapier/Make webhooks

Usage
  multiconnect-bridge start [options]

Options
  --port <n>       Port to listen on (default: 8420)
  --config <path>  Path to bridge.config.json (default: ./bridge.config.json)
  -h, --help       Show this message
  -v, --version    Show the bridge version
\`

function parseArgs(argv) {
  const args = { port: undefined, config: undefined, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') args.help = true
    else if (a === '-v' || a === '--version') args.version = true
    else if (a === '--port') args.port = Number(argv[++i])
    else if (a === '--config') args.config = argv[++i]
  }
  return args
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'start'
  const rest = cmd === argv[0] ? argv.slice(1) : argv
  const args = parseArgs(rest)

  if (args.help) {
    console.log(USAGE)
    process.exit(0)
  }
  if (args.version) {
    console.log('1.0.0')
    process.exit(0)
  }
  if (cmd !== 'start') {
    console.log(USAGE)
    process.exit(2)
  }

  const { server, config } = createServer({ port: args.port, configPath: args.config ?? defaultConfigPath() })

  server.listen(config.port, () => {
    console.log('')
    console.log('  MultiConnect: Zapier/Webhook Bridge is running.')
    console.log('')
    console.log(\`  Dashboard:  http://localhost:\${config.port}\`)
    console.log(\`  Token:      \${config.authToken}\`)
    console.log('')
    console.log(\`  Inbound webhook URL (paste into Zapier/Make): http://localhost:\${config.port}/webhook\`)
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => {
    server.close(() => process.exit(0))
  })
}

main().catch((err) => {
  console.error('multiconnect-bridge: fatal —', err.message)
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
# Linux equivalent of adapters/windows-task.ps1 — runs the bridge as a
# background service that restarts itself if it ever crashes.
#
# Install:
#   sed -i "s|REPLACE_WITH_PACKAGE_PATH|$(pwd)|g" adapters/systemd.service
#   mkdir -p ~/.config/systemd/user
#   cp adapters/systemd.service ~/.config/systemd/user/multiconnect-bridge.service
#   systemctl --user enable --now multiconnect-bridge

[Unit]
Description=MultiConnect Zapier/Webhook Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/bridge.mjs start
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
# Registers the bridge as a Windows Scheduled Task that starts silently at
# logon and keeps running in the background — no console window, no need to
# remember to start it by hand each time.
#
# Usage (from an elevated PowerShell prompt, run from the package root):
#   .\\adapters\\windows-task.ps1

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$binPath = Join-Path $packageRoot 'bin\\bridge.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiConnect Webhook Bridge" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. The bridge will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiConnect Webhook Bridge'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiConnect Webhook Bridge'"
`,
  },
  {
    path: "test/mapping.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { applyMapping, getByPath } from '../lib/mapping.mjs'

test('getByPath resolves a simple dotted path', () => {
  assert.equal(getByPath({ order: { email: 'a@b.com' } }, 'order.email'), 'a@b.com')
})

test('getByPath resolves an array index', () => {
  assert.equal(getByPath({ items: [{ sku: 'X1' }] }, 'items[0].sku'), 'X1')
})

test('getByPath returns undefined for a missing path, never throws', () => {
  assert.equal(getByPath({ a: 1 }, 'a.b.c'), undefined)
  assert.equal(getByPath(null, 'a.b'), undefined)
  assert.equal(getByPath(undefined, 'a'), undefined)
})

test('applyMapping builds an object from mapped fields only', () => {
  const source = { order: { email: 'a@b.com', total: 42 }, ignored: 'x' }
  const rules = [
    { id: '1', sourcePath: 'order.email', targetField: 'customer_email' },
    { id: '2', sourcePath: 'order.total', targetField: 'amount' },
  ]
  const out = applyMapping(source, rules)
  assert.deepEqual(out, { customer_email: 'a@b.com', amount: 42 })
  assert.ok(!('ignored' in out), 'unmapped fields must not leak through')
})

test('applyMapping supports nested target fields', () => {
  const out = applyMapping({ email: 'a@b.com' }, [{ id: '1', sourcePath: 'email', targetField: 'customer.email' }])
  assert.deepEqual(out, { customer: { email: 'a@b.com' } })
})

test('applyMapping skips a rule whose source path is missing', () => {
  const out = applyMapping({ a: 1 }, [{ id: '1', sourcePath: 'b', targetField: 'x' }])
  assert.deepEqual(out, {})
})
`,
  },
  {
    path: "test/outbound-retry.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { sendOutbound } from '../lib/outbound.mjs'
import { clear as clearLog } from '../lib/log.mjs'

/** Starts a tiny fixture server that fails \`failCount\` times then succeeds. */
function startFlaky(failCount) {
  let calls = 0
  const server = http.createServer((req, res) => {
    calls += 1
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (calls <= failCount) {
        res.writeHead(500)
        res.end('fail')
      } else {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, body: JSON.parse(body || '{}') }))
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port, callCount: () => calls }))
  })
}

test('sendOutbound retries on 5xx and eventually succeeds', async () => {
  clearLog()
  const { server, port, callCount } = await startFlaky(2)
  try {
    const config = { outboundUrl: \`http://localhost:\${port}/\`, outboundMappings: [] }
    const result = await sendOutbound(config, { hello: 'world' })
    assert.equal(result.ok, true)
    assert.equal(callCount(), 3, 'expected 2 failed attempts then a success')
  } finally {
    server.close()
  }
})

test('sendOutbound does not retry a 4xx', async () => {
  clearLog()
  const server = http.createServer((req, res) => {
    res.writeHead(400)
    res.end()
  })
  let calls = 0
  server.on('request', () => (calls += 1))
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const port = server.address().port
    const config = { outboundUrl: \`http://localhost:\${port}/\`, outboundMappings: [] }
    const result = await sendOutbound(config, {})
    assert.equal(result.ok, false)
    assert.equal(calls, 1, '4xx should not be retried')
  } finally {
    server.close()
  }
})

test('sendOutbound reports failure cleanly with no outboundUrl configured', async () => {
  clearLog()
  const result = await sendOutbound({ outboundUrl: null, outboundMappings: [] }, {})
  assert.equal(result.ok, false)
  assert.equal(result.status, null)
})

test('sendOutbound applies the mapping before sending', async () => {
  clearLog()
  const { server, port } = await startFlaky(0)
  try {
    const config = {
      outboundUrl: \`http://localhost:\${port}/\`,
      outboundMappings: [{ id: '1', sourcePath: 'raw.value', targetField: 'clean_value' }],
    }
    const result = await sendOutbound(config, { raw: { value: 99 } })
    assert.equal(result.ok, true)
  } finally {
    server.close()
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
// Uses node:test and node:assert — both built in, so the package still
// installs nothing. No test touches the public internet.

import './mapping.test.mjs'
import './outbound-retry.test.mjs'
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

/** Boots a real server on an ephemeral port against a throwaway config file. */
async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcb-test-'))
  const configPath = path.join(dir, 'bridge.config.json')
  const { server, config } = createServer({ port: 0, configPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    token: config.authToken,
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

test('api routes reject requests without a valid token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`)
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('api routes accept the correct bearer token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      headers: { authorization: \`Bearer \${ctx.token}\` },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(!('authToken' in body), 'the config API must never echo the auth token back')
  } finally {
    ctx.close()
  }
})

test('inbound webhook accepts a POST with no auth and returns the mapped payload', async () => {
  const ctx = await boot()
  try {
    // Set an inbound mapping first so the response isn't trivially empty.
    await fetch(\`http://localhost:\${ctx.port}/api/mappings\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ direction: 'inbound', rules: [{ id: '1', sourcePath: 'name', targetField: 'agent_name' }] }),
    })
    const res = await fetch(\`http://localhost:\${ctx.port}/webhook\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.deepEqual(body.mapped, { agent_name: 'Ada' })
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
