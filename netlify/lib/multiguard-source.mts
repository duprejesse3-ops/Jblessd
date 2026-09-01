// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiguard/tools/embed-source.mjs from the real
// package source. Regenerate after changing the package:
//
//   node packages/multiguard/tools/embed-source.mjs
//
// This is the payload for the MultiGuard product (SKU AI-CN-007): the
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

export const MULTIGUARD_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiGuard

One dashboard and kill switch for every MultiConnect tool you run.

Each MultiConnect connector has its own safe-mode switch and its own log —
useful, but it means checking five separate dashboards to see what's
happening, or flipping five separate switches during an incident.
MultiGuard is the layer above them: register any connector by its
dashboard URL and token, see all of them in one place, and — the whole
point — hit one button to switch every one of them to read-only at once.

## Install

Windows: \`.\\install.ps1\`
macOS / Linux: \`./install.sh\`

This starts MultiGuard in the foreground and prints a dashboard URL and a
token.

## Registering a connector

In the dashboard's **Register a connector** section, add:

- **Name** — whatever you want to call it
- **Base URL** — where that connector's own dashboard is running (e.g.
  \`http://localhost:8421\` for the Shopify connector)
- **Its dashboard token** — the token that connector printed when *it*
  started

MultiGuard works generically: it doesn't need to know which specific
MultiConnect product you're registering. It just needs a \`GET /api/config\`
that may report a \`safeMode\`, and a \`GET /api/log\` or \`GET /api/entries\`
that returns recent activity — the convention every MultiConnect tool
follows.

## Security note — read this before you use it

The tokens you paste into MultiGuard are real credentials for your other
connectors, stored in plain text in MultiGuard's own config file on this
machine. Anyone with access to that file, or to MultiGuard's own
dashboard, could reach into any connector you've registered. Treat
MultiGuard's dashboard token — and this machine — with the same care you'd
give the connectors themselves.

## The kill switch

Hitting **Engage kill switch** sends \`{ "safeMode": "read-only" }\` to
every registered connector's own config endpoint, in parallel. A connector
that's offline, or that doesn't have a safe-mode concept at all (like the
Webhook Bridge or MultiWitness), is reported honestly as such — this never
pretends something worked when it didn't.

## Development

\`\`\`
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiguard — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines as you like, watching as many of your own connectors as you like. Do
not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines, watching unlimited connectors of your own.
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

In particular: this software stores real credentials (the dashboard tokens of
other tools you register) in a local config file, and its kill switch sends
real requests to those tools' own APIs. You are responsible for keeping this
machine, MultiGuard's own dashboard token, and the config file it writes
appropriately secured — see the security note in README.md.

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
  "name": "multiguard",
  "version": "1.0.0",
  "description": "One dashboard and kill switch for every MultiConnect tool you run — see and control them all in one place.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiguard": "./bin/guard.mjs"
  },
  "main": "./lib/server.mjs",
  "exports": {
    ".": "./lib/server.mjs",
    "./probe": "./lib/probe.mjs",
    "./killswitch": "./lib/killswitch.mjs"
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
    "start": "node bin/guard.mjs start",
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
echo "Starting MultiGuard..."
echo ""
node "$DIR/bin/guard.mjs" start
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

Write-Host "Starting MultiGuard..."
Write-Host ""
node "$PSScriptRoot\\bin\\guard.mjs" start
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The registry is deliberately generic: a "watched connector" is just a
// name, a base URL, and that connector's own dashboard token. MultiGuard
// doesn't hardcode which MultiConnect product is which — it works with any
// local tool that happens to expose a GET /api/config with a safeMode
// field and a GET /api/log or /api/entries with an { entries: [...] }
// shape, which is every MultiConnect connector by convention, and any
// future one built the same way.
//
// The tokens stored here are real credentials for other services — see
// the security note in README.md before you use this on anything you
// don't fully control.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8431

/** @typedef {{ id: string, name: string, baseUrl: string, token: string }} WatchedConnector */
/**
 * @typedef {{
 *   port: number,
 *   dashboardToken: string,
 *   connectors: WatchedConnector[],
 *   createdAt: string
 * }} GuardConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'guard.config.json')
}

/** @returns {GuardConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    dashboardToken: randomBytes(16).toString('hex'),
    connectors: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {GuardConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) {
    const fresh = defaults()
    saveConfig(fresh, configPath)
    return fresh
  }
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  const base = defaults()
  return { ...base, ...parsed, connectors: Array.isArray(parsed.connectors) ? parsed.connectors : base.connectors }
}

/**
 * @param {GuardConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\\n', 'utf8')
}

/** Strip the base URL of a trailing slash so URL joins never produce "//api". */
export function normalizeBaseUrl(input) {
  return String(input ?? '').trim().replace(/\\/+$/, '')
}

export { defaultConfigPath, DEFAULT_PORT, randomUUID }
`,
  },
  {
    path: "lib/killswitch.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole point of the product: one action that sets every registered
// connector's safe mode to read-only at once, instead of opening five
// separate dashboards during an incident. Works generically — it POSTs
// { safeMode: 'read-only' } to every connector's own /api/config, and a
// connector that doesn't have a safeMode concept (MultiWitness, the
// Webhook Bridge) either ignores the unknown field or 404s; either way
// this reports it accurately rather than pretending it worked.

const REQUEST_TIMEOUT_MS = 6_000

/**
 * @typedef {{ id: string, name: string, ok: boolean, message: string }} EngageResult
 */

/**
 * @param {import('./config.mjs').WatchedConnector} connector
 * @returns {Promise<EngageResult>}
 */
async function engageOne(connector) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(\`\${connector.baseUrl}/api/config\`, {
      method: 'POST',
      headers: { authorization: \`Bearer \${connector.token}\`, 'content-type': 'application/json' },
      body: JSON.stringify({ safeMode: 'read-only' }),
      signal: controller.signal,
    })
    if (res.status === 404) {
      return { id: connector.id, name: connector.name, ok: false, message: 'This connector has no safe-mode concept — nothing to engage.' }
    }
    if (!res.ok) {
      return { id: connector.id, name: connector.name, ok: false, message: \`Request failed (HTTP \${res.status}).\` }
    }
    return { id: connector.id, name: connector.name, ok: true, message: 'Switched to read-only.' }
  } catch {
    return { id: connector.id, name: connector.name, ok: false, message: 'Unreachable — is it running?' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Engage the kill switch on every registered connector, in parallel. Never
 * throws — a connector that's offline or doesn't support safe mode is
 * reported as such alongside the ones that succeeded, rather than aborting
 * the whole operation.
 * @param {import('./config.mjs').WatchedConnector[]} connectors
 * @returns {Promise<EngageResult[]>}
 */
export async function engageKillSwitch(connectors) {
  return Promise.all(connectors.map(engageOne))
}
`,
  },
  {
    path: "lib/log.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

const MAX_ENTRIES = 200

/**
 * @typedef {{
 *   id: string,
 *   kind: 'registered' | 'removed' | 'kill-switch' | 'error',
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
    path: "lib/probe.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Talks to a watched connector using nothing but the conventions every
// MultiConnect tool already follows: GET /api/config (Bearer-token gated,
// returns a plain object that MAY include a safeMode field), and GET
// /api/log or GET /api/entries (same auth, returns { entries: [...] }).
// This is what lets MultiGuard work with any connector built the same way
// without hardcoding which product is which.

const REQUEST_TIMEOUT_MS = 6_000

/**
 * @param {string} url
 * @param {string} token
 */
async function getJson(url, token) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { authorization: \`Bearer \${token}\` }, signal: controller.signal })
    return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : null }
  } catch {
    return { ok: false, status: 0, body: null }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   reachable: boolean,
 *   safeMode: 'read-only' | 'read-write' | null,
 *   recentEntryCount: number
 * }} ProbeResult
 */

/**
 * @param {import('./config.mjs').WatchedConnector} connector
 * @returns {Promise<ProbeResult>}
 */
export async function probeConnector(connector) {
  const configRes = await getJson(\`\${connector.baseUrl}/api/config\`, connector.token)
  if (!configRes.ok) {
    return { id: connector.id, name: connector.name, reachable: false, safeMode: null, recentEntryCount: 0 }
  }

  const safeMode = configRes.body?.safeMode === 'read-only' || configRes.body?.safeMode === 'read-write' ? configRes.body.safeMode : null

  // Try /api/log first (used by 4 of the 5 current MultiConnect tools),
  // fall back to /api/entries (used by MultiWitness) — either way the
  // response shares the same { entries: [...] } envelope by convention.
  let entryCount = 0
  const logRes = await getJson(\`\${connector.baseUrl}/api/log?limit=50\`, connector.token)
  if (logRes.ok && Array.isArray(logRes.body?.entries)) {
    entryCount = logRes.body.entries.length
  } else {
    const entriesRes = await getJson(\`\${connector.baseUrl}/api/entries?limit=50\`, connector.token)
    if (entriesRes.ok && Array.isArray(entriesRes.body?.entries)) entryCount = entriesRes.body.entries.length
  }

  return { id: connector.id, name: connector.name, reachable: true, safeMode, recentEntryCount: entryCount }
}

/**
 * @param {import('./config.mjs').WatchedConnector[]} connectors
 * @returns {Promise<ProbeResult[]>}
 */
export async function probeAll(connectors) {
  return Promise.all(connectors.map(probeConnector))
}
`,
  },
  {
    path: "lib/registry.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { saveConfig, normalizeBaseUrl, randomUUID } from './config.mjs'

export class RegistryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RegistryError'
  }
}

/**
 * @param {import('./config.mjs').GuardConfig} config
 * @param {{ name: string, baseUrl: string, token: string }} input
 * @param {string} [configPath]
 * @returns {import('./config.mjs').WatchedConnector}
 */
export function addConnector(config, input, configPath) {
  if (!input.name) throw new RegistryError('A connector needs a name.')
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!baseUrl) throw new RegistryError('A connector needs a base URL (e.g. http://localhost:8421).')
  if (!input.token) throw new RegistryError('A connector needs its own dashboard token, so MultiGuard can talk to it.')

  /** @type {import('./config.mjs').WatchedConnector} */
  const connector = { id: randomUUID(), name: input.name, baseUrl, token: input.token }
  config.connectors.push(connector)
  saveConfig(config, configPath)
  return connector
}

/** @param {import('./config.mjs').GuardConfig} config */
export function listConnectors(config) {
  return config.connectors
}

/**
 * @param {import('./config.mjs').GuardConfig} config
 * @param {string} connectorId
 * @param {string} [configPath]
 */
export function removeConnector(config, connectorId, configPath) {
  const before = config.connectors.length
  config.connectors = config.connectors.filter((c) => c.id !== connectorId)
  if (config.connectors.length === before) throw new RegistryError('No such connector.')
  saveConfig(config, configPath)
}
`,
  },
  {
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// One process: dashboard UI, a JSON API to register/remove watched
// connectors, a status route that polls all of them, and the kill-switch
// route. Everything here talks outward to other local tools' APIs — this
// process itself has no ingest route and no write surface for anything
// but its own registry, which is exactly what a control plane should be.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig } from './config.mjs'
import { addConnector, listConnectors, removeConnector, RegistryError } from './registry.mjs'
import { probeAll } from './probe.mjs'
import { engageKillSwitch } from './killswitch.mjs'
import { record, recent, clear as clearLog } from './log.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.join(__dirname, 'ui')

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

function isAuthorized(req, expectedToken) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return token === expectedToken
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
 * @param {{ configPath?: string, port?: number }} [opts]
 */
export function createServer(opts = {}) {
  let config = loadConfig(opts.configPath)
  if (opts.port) config.port = opts.port

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveStatic(res, 'index.html')
    if (req.method === 'GET' && url.pathname === '/app.js') return serveStatic(res, 'app.js')
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })

    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404)
      return res.end('Not found')
    }

    if (!isAuthorized(req, config.dashboardToken)) {
      return json(res, 401, { error: 'Unauthorized. Use the dashboard token shown when MultiGuard started.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { dashboardToken, connectors, ...safe } = config
      // Tokens for OTHER connectors are real credentials — never send them
      // back over the wire once saved, even to the authenticated dashboard.
      const safeConnectors = connectors.map(({ token, ...c }) => ({ ...c, hasToken: Boolean(token) }))
      return json(res, 200, { ...safe, connectors: safeConnectors })
    }

    if (req.method === 'POST' && url.pathname === '/api/connectors') {
      try {
        const body = await readJsonBody(req)
        const connector = addConnector(config, body, opts.configPath)
        record({ kind: 'registered', summary: \`Registered "\${connector.name}"\`, detail: connector.baseUrl })
        const { token, ...safe } = connector
        return json(res, 201, { connector: safe })
      } catch (err) {
        return json(res, err instanceof RegistryError ? 400 : 500, { error: err.message })
      }
    }

    const removeMatch = url.pathname.match(/^\\/api\\/connectors\\/([^/]+)$/)
    if (req.method === 'DELETE' && removeMatch) {
      try {
        const connector = config.connectors.find((c) => c.id === removeMatch[1])
        removeConnector(config, removeMatch[1], opts.configPath)
        record({ kind: 'removed', summary: \`Removed "\${connector?.name ?? removeMatch[1]}"\`, detail: null })
        return json(res, 200, { ok: true })
      } catch (err) {
        return json(res, err instanceof RegistryError ? 404 : 500, { error: err.message })
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      const results = await probeAll(listConnectors(config))
      return json(res, 200, { results })
    }

    if (req.method === 'POST' && url.pathname === '/api/kill-switch') {
      const results = await engageKillSwitch(listConnectors(config))
      const okCount = results.filter((r) => r.ok).length
      record({
        kind: 'kill-switch',
        summary: \`Kill switch engaged — \${okCount}/\${results.length} connectors switched to read-only\`,
        detail: JSON.stringify(results),
      })
      return json(res, 200, { results })
    }

    if (req.method === 'GET' && url.pathname === '/api/log') {
      return json(res, 200, { entries: recent(Number(url.searchParams.get('limit') ?? 50)) })
    }
    if (req.method === 'POST' && url.pathname === '/api/log/clear') {
      clearLog()
      return json(res, 200, { ok: true })
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

let token = sessionStorage.getItem('mcg-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcg-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcg-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('add-connector').addEventListener('click', async () => {
  const name = document.getElementById('c-name').value.trim()
  const baseUrl = document.getElementById('c-url').value.trim()
  const tokenVal = document.getElementById('c-token').value.trim()
  const data = await api('/api/connectors', { method: 'POST', body: JSON.stringify({ name, baseUrl, token: tokenVal }) })
  if (!data.error) {
    document.getElementById('c-name').value = ''
    document.getElementById('c-url').value = ''
    document.getElementById('c-token').value = ''
  }
  await refreshStatus()
})

function badgeFor(result) {
  if (!result.reachable) return '<span class="badge offline">offline</span>'
  if (result.safeMode === 'read-only') return '<span class="badge ro">read-only</span>'
  if (result.safeMode === 'read-write') return '<span class="badge rw">read/write</span>'
  return '<span class="badge na">no safe mode</span>'
}

async function refreshStatus() {
  const { results } = await api('/api/status')
  const el = document.getElementById('connectors')
  el.innerHTML = results.length
    ? results.map((r) => \`
      <div class="connector">
        <strong>\${r.name}</strong> \${badgeFor(r)}
        <div class="meta">\${r.reachable ? \`\${r.recentEntryCount} recent events\` : 'unreachable'}</div>
        <button class="ghost" data-remove="\${r.id}">Remove</button>
      </div>
    \`).join('')
    : '<p class="sub">No connectors registered yet.</p>'
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(\`/api/connectors/\${btn.dataset.remove}\`, { method: 'DELETE' })
      await refreshStatus()
    })
  })
}
document.getElementById('refresh-status').addEventListener('click', refreshStatus)

document.getElementById('kill-switch').addEventListener('click', async () => {
  if (!confirm('Switch every registered connector to read-only?')) return
  const { results } = await api('/api/kill-switch', { method: 'POST' })
  const el = document.getElementById('kill-result')
  el.innerHTML = results.map((r) => \`<div class="log-entry">\${r.ok ? '✓' : '✗'} \${r.name}: \${r.message}</div>\`).join('')
  await refreshStatus()
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
    ? entries.map((e) => \`<div class="log-entry"><span class="tag">\${e.kind} · \${e.at}</span><br/>\${e.summary}</div>\`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshStatus()
  await refreshLog()
  setInterval(() => { refreshStatus(); refreshLog() }, 8000)
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
<title>MultiGuard</title>
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
  button.danger{background:#3d1a1a;color:#ff9c9c;border:1px solid #5a2020;font-weight:700}
  .connector{border:1px solid var(--line);border-radius:4px;padding:12px;margin-bottom:8px;font-size:13px}
  .connector .meta{color:var(--muted);font-size:11px}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
  .badge.ro{background:#1a3d1a;color:#7cd67c}
  .badge.rw{background:#3d1a1a;color:#ff9c9c}
  .badge.na{background:#333;color:#999}
  .badge.offline{background:#3d1a1a;color:#ff786e}
  .log-entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  #token-gate{text-align:center;padding-top:60px}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiGuard</h1>
    <p class="sub">Paste the dashboard token shown in your terminal when it started.</p>
    <input id="token-input" placeholder="dashboard token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiGuard</h1>
  <p class="sub">One place to see and control every MultiConnect tool you run.</p>

  <section>
    <h2>Kill switch</h2>
    <p class="sub">Switches every registered connector that supports safe mode to read-only, in one action.</p>
    <button class="danger" id="kill-switch">🛑 Engage kill switch — switch all to read-only</button>
    <div id="kill-result" style="margin-top:10px"></div>
  </section>

  <section>
    <h2>Watched connectors</h2>
    <div id="connectors"></div>
    <button class="ghost" id="refresh-status">Refresh status</button>
  </section>

  <section>
    <h2>Register a connector</h2>
    <p class="sub">Add any MultiConnect tool by its dashboard URL and its own dashboard token.</p>
    <label for="c-name">Name</label>
    <input id="c-name" placeholder="e.g. Shopify"/>
    <label for="c-url">Base URL</label>
    <input id="c-url" placeholder="http://localhost:8421"/>
    <label for="c-token">Its dashboard token</label>
    <input id="c-token" type="password"/>
    <button id="add-connector">Register</button>
  </section>

  <section>
    <h2>Activity log</h2>
    <button class="ghost" id="clear-log">Clear</button>
    <div id="log"></div>
  </section>
</div>

<script src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "bin/guard.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`multiguard — one dashboard and kill switch for every MultiConnect tool

Usage
  multiguard start [options]

Options
  --port <n>       Port to listen on (default: 8431)
  --config <path>  Path to guard.config.json (default: ./guard.config.json)
  -h, --help       Show this message
  -v, --version    Show the version
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

  if (args.help) { console.log(USAGE); process.exit(0) }
  if (args.version) { console.log('1.0.0'); process.exit(0) }
  if (cmd !== 'start') { console.log(USAGE); process.exit(2) }

  const { server, config } = createServer({ port: args.port, configPath: args.config ?? defaultConfigPath() })

  server.listen(config.port, () => {
    console.log('')
    console.log('  MultiGuard is running.')
    console.log('')
    console.log(\`  Dashboard:  http://localhost:\${config.port}\`)
    console.log(\`  Token:      \${config.dashboardToken}\`)
    console.log('')
    console.log('  Register your other MultiConnect tools in the dashboard by their own')
    console.log('  base URL and dashboard token to start watching them.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiguard: fatal —', err.message)
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
#   cp adapters/systemd.service ~/.config/systemd/user/multiguard.service
#   systemctl --user enable --now multiguard

[Unit]
Description=MultiGuard
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/guard.mjs start
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
# Registers MultiGuard as a Windows Scheduled Task that starts silently at
# logon and keeps running in the background.
#
# Usage (from an elevated PowerShell prompt, run from the package root):
#   .\\adapters\\windows-task.ps1

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$binPath = Join-Path $packageRoot 'bin\\guard.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiGuard" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. MultiGuard will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiGuard'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiGuard'"
`,
  },
  {
    path: "test/killswitch.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { engageKillSwitch } from '../lib/killswitch.mjs'

function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, baseUrl: \`http://localhost:\${server.address().port}\` })))
}

test('engageKillSwitch succeeds against a connector that accepts safeMode', async () => {
  let receivedBody
  const { server, baseUrl } = await startFixture((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      receivedBody = JSON.parse(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
  })
  try {
    const results = await engageKillSwitch([{ id: '1', name: 'Shopify', baseUrl, token: 't' }])
    assert.equal(results[0].ok, true)
    assert.equal(receivedBody.safeMode, 'read-only')
  } finally {
    server.close()
  }
})

test('engageKillSwitch reports a 404 connector (no safeMode concept) as not-ok, without throwing', async () => {
  const { server, baseUrl } = await startFixture((req, res) => {
    res.writeHead(404)
    res.end()
  })
  try {
    const results = await engageKillSwitch([{ id: '1', name: 'MultiWitness', baseUrl, token: 't' }])
    assert.equal(results[0].ok, false)
    assert.match(results[0].message, /no safe-mode concept/)
  } finally {
    server.close()
  }
})

test('engageKillSwitch reports an offline connector as not-ok, without throwing', async () => {
  const results = await engageKillSwitch([{ id: '1', name: 'Offline', baseUrl: 'http://localhost:1', token: 't' }])
  assert.equal(results[0].ok, false)
  assert.match(results[0].message, /Unreachable/)
})

test('engageKillSwitch handles a mix of successes and failures across multiple connectors', async () => {
  const { server: good, baseUrl: goodUrl } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  const { server: bad, baseUrl: badUrl } = await startFixture((req, res) => {
    res.writeHead(500)
    res.end()
  })
  try {
    const results = await engageKillSwitch([
      { id: '1', name: 'Good', baseUrl: goodUrl, token: 't' },
      { id: '2', name: 'Bad', baseUrl: badUrl, token: 't' },
    ])
    assert.equal(results.find((r) => r.id === '1').ok, true)
    assert.equal(results.find((r) => r.id === '2').ok, false)
  } finally {
    good.close()
    bad.close()
  }
})

test('engageKillSwitch on an empty connector list returns an empty array', async () => {
  const results = await engageKillSwitch([])
  assert.deepEqual(results, [])
})
`,
  },
  {
    path: "test/probe.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { probeConnector, probeAll } from '../lib/probe.mjs'

/** Fixture standing in for a real MultiConnect connector's HTTP surface. */
function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, baseUrl: \`http://localhost:\${server.address().port}\` })))
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(payload)
}

test('probeConnector reports reachable, safeMode, and recent entry count for a Shopify-like connector', async () => {
  const { server, baseUrl } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { safeMode: 'read-write', shopDomain: 'x.myshopify.com' })
    if (req.url.startsWith('/api/log')) return send(res, 200, { entries: [{ id: '1' }, { id: '2' }] })
    send(res, 404, {})
  })
  try {
    const result = await probeConnector({ id: '1', name: 'Shopify', baseUrl, token: 'tok' })
    assert.equal(result.reachable, true)
    assert.equal(result.safeMode, 'read-write')
    assert.equal(result.recentEntryCount, 2)
  } finally {
    server.close()
  }
})

test('probeConnector falls back to /api/entries when /api/log 404s (MultiWitness shape)', async () => {
  const { server, baseUrl } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { port: 8429 }) // no safeMode field at all
    if (req.url.startsWith('/api/log')) return send(res, 404, {})
    if (req.url.startsWith('/api/entries')) return send(res, 200, { entries: [{ id: '1' }] })
    send(res, 404, {})
  })
  try {
    const result = await probeConnector({ id: '1', name: 'MultiWitness', baseUrl, token: 'tok' })
    assert.equal(result.reachable, true)
    assert.equal(result.safeMode, null)
    assert.equal(result.recentEntryCount, 1)
  } finally {
    server.close()
  }
})

test('probeConnector reports unreachable for a connector that is not running', async () => {
  const result = await probeConnector({ id: '1', name: 'Offline', baseUrl: 'http://localhost:1', token: 'tok' })
  assert.equal(result.reachable, false)
  assert.equal(result.safeMode, null)
  assert.equal(result.recentEntryCount, 0)
})

test('probeConnector reports unreachable when the token is rejected (401)', async () => {
  const { server, baseUrl } = await startFixture((req, res) => send(res, 401, { error: 'bad token' }))
  try {
    const result = await probeConnector({ id: '1', name: 'x', baseUrl, token: 'wrong' })
    assert.equal(result.reachable, false)
  } finally {
    server.close()
  }
})

test('probeAll probes multiple connectors in parallel and preserves each result', async () => {
  const { server: s1, baseUrl: url1 } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { safeMode: 'read-only' })
    send(res, 200, { entries: [] })
  })
  const { server: s2, baseUrl: url2 } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { safeMode: 'read-write' })
    send(res, 200, { entries: [] })
  })
  try {
    const results = await probeAll([
      { id: '1', name: 'One', baseUrl: url1, token: 't' },
      { id: '2', name: 'Two', baseUrl: url2, token: 't' },
    ])
    assert.equal(results.length, 2)
    assert.equal(results.find((r) => r.id === '1').safeMode, 'read-only')
    assert.equal(results.find((r) => r.id === '2').safeMode, 'read-write')
  } finally {
    s1.close()
    s2.close()
  }
})
`,
  },
  {
    path: "test/registry.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { addConnector, listConnectors, removeConnector, RegistryError } from '../lib/registry.mjs'
import { loadConfig } from '../lib/config.mjs'

function tempConfig() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcg-registry-'))
  const configPath = path.join(dir, 'guard.config.json')
  const config = loadConfig(configPath)
  return { config, configPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('addConnector requires a name, base URL, and token', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    assert.throws(() => addConnector(config, { baseUrl: 'http://x', token: 't' }, configPath), RegistryError)
    assert.throws(() => addConnector(config, { name: 'x', token: 't' }, configPath), RegistryError)
    assert.throws(() => addConnector(config, { name: 'x', baseUrl: 'http://x' }, configPath), RegistryError)
  } finally {
    cleanup()
  }
})

test('addConnector strips a trailing slash from the base URL', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const connector = addConnector(config, { name: 'Shopify', baseUrl: 'http://localhost:8421/', token: 't' }, configPath)
    assert.equal(connector.baseUrl, 'http://localhost:8421')
  } finally {
    cleanup()
  }
})

test('addConnector persists to disk', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    addConnector(config, { name: 'Shopify', baseUrl: 'http://localhost:8421', token: 't' }, configPath)
    const reloaded = loadConfig(configPath)
    assert.equal(reloaded.connectors.length, 1)
    assert.equal(reloaded.connectors[0].name, 'Shopify')
  } finally {
    cleanup()
  }
})

test('removeConnector deletes an existing connector and throws on an unknown one', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const connector = addConnector(config, { name: 'x', baseUrl: 'http://x', token: 't' }, configPath)
    removeConnector(config, connector.id, configPath)
    assert.equal(listConnectors(config).length, 0)
    assert.throws(() => removeConnector(config, 'nonexistent', configPath), RegistryError)
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

import './registry.test.mjs'
import './probe.test.mjs'
import './killswitch.test.mjs'
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
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcg-test-'))
  const configPath = path.join(dir, 'guard.config.json')
  const { server, config } = createServer({ port: 0, configPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    token: config.dashboardToken,
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

test('registering a connector never leaks the stored token back over the API', async () => {
  const ctx = await boot()
  try {
    const addRes = await fetch(\`http://localhost:\${ctx.port}/api/connectors\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ name: 'Shopify', baseUrl: 'http://localhost:8421', token: 'SUPER_SECRET_TOKEN' }),
    })
    assert.equal(addRes.status, 201)
    const { connector } = await addRes.json()
    assert.ok(!('token' in connector))

    const configRes = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const config = await configRes.json()
    assert.ok(!JSON.stringify(config).includes('SUPER_SECRET_TOKEN'))
    assert.equal(config.connectors[0].hasToken, true)
  } finally {
    ctx.close()
  }
})

test('status route probes a real fixture connector end to end', async () => {
  const fixture = http.createServer((req, res) => {
    if (req.url.startsWith('/api/config')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ safeMode: 'read-write' }))
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ entries: [{ id: '1' }] }))
  })
  await new Promise((resolve) => fixture.listen(0, resolve))
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/connectors\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ name: 'Fixture', baseUrl: \`http://localhost:\${fixture.address().port}\`, token: 'fixture-token' }),
    })
    const statusRes = await fetch(\`http://localhost:\${ctx.port}/api/status\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { results } = await statusRes.json()
    assert.equal(results.length, 1)
    assert.equal(results[0].reachable, true)
    assert.equal(results[0].safeMode, 'read-write')
  } finally {
    ctx.close()
    fixture.close()
  }
})

test('kill switch route logs the outcome in the activity log', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/connectors\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ name: 'Offline', baseUrl: 'http://localhost:1', token: 't' }),
    })
    const killRes = await fetch(\`http://localhost:\${ctx.port}/api/kill-switch\`, {
      method: 'POST',
      headers: { authorization: \`Bearer \${ctx.token}\` },
    })
    assert.equal(killRes.status, 200)

    const logRes = await fetch(\`http://localhost:\${ctx.port}/api/log\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.kind === 'kill-switch'))
  } finally {
    ctx.close()
  }
})

test('removing a connector via the API works and is reflected in status', async () => {
  const ctx = await boot()
  try {
    const addRes = await fetch(\`http://localhost:\${ctx.port}/api/connectors\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ name: 'x', baseUrl: 'http://localhost:1', token: 't' }),
    })
    const { connector } = await addRes.json()

    const delRes = await fetch(\`http://localhost:\${ctx.port}/api/connectors/\${connector.id}\`, {
      method: 'DELETE',
      headers: { authorization: \`Bearer \${ctx.token}\` },
    })
    assert.equal(delRes.status, 200)

    const statusRes = await fetch(\`http://localhost:\${ctx.port}/api/status\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { results } = await statusRes.json()
    assert.equal(results.length, 0)
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
