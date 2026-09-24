// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiconnect-sheets-airtable/tools/embed-source.mjs
// from the real package source. Regenerate after changing the package:
//
//   node packages/multiconnect-sheets-airtable/tools/embed-source.mjs
//
// This is the payload for the MultiConnect: Sheets/Airtable product (SKU
// AI-CN-003): the complete, runnable source the buyer receives at
// checkout. It is embedded rather than read from disk so fulfilment cannot
// fail on a missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTICONNECT_SHEETS_AIRTABLE_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiConnect: Sheets/Airtable

Turn a spreadsheet into your agent's database.

Runs entirely on your own machine: a local dashboard for connecting Google
Sheets and/or Airtable, mapping fields with point-and-click, and reading or
appending rows — with a safe-mode switch that keeps writes off until you
turn them on.

## Install

Windows: \`.\\install.ps1\`
macOS / Linux: \`./install.sh\`

Either way, this starts the connector in the foreground and prints a
dashboard URL and a local auth token.

## Setting up Google Sheets

1. In [Google Cloud Console](https://console.cloud.google.com), create a
   service account and download its JSON key.
2. From that JSON, copy the \`client_email\` into the dashboard's "Service
   account email" field, and the \`private_key\` into "Service account
   private key" (paste it exactly as it appears, including the
   \`-----BEGIN PRIVATE KEY-----\` lines).
3. Open your Google Sheet, click **Share**, and share it with that service
   account's email address (Editor access if you want write access).
4. Copy the spreadsheet ID from the sheet's URL
   (\`docs.google.com/spreadsheets/d/\`**\`THIS_PART\`**\`/edit\`) into the
   dashboard.

## Setting up Airtable

1. Create a [personal access token](https://airtable.com/create/tokens)
   scoped to the base you want to connect, with \`data.records:read\` (and
   \`data.records:write\` if you want write access).
2. Copy the token, your base ID (from the base's API docs page), and the
   table name into the dashboard.

## Safe mode

Every install starts **read-only**. Switch to **read/write** only when
you're ready to let the agent append rows or records. Every write call
checks this setting first and refuses outright if it's not enabled.

## Using it

- \`GET /api/sheets/rows\` / \`GET /api/airtable/records\` — read current data,
  mapped through your saved read mapping if you've set one.
- \`POST /api/sheets/rows\` / \`POST /api/airtable/records\` — append a new
  row/record, mapped through your saved write mapping.

All routes require your dashboard's auth token as a Bearer header.

## Development

\`\`\`
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step. Google's OAuth2
service-account flow is implemented directly with \`node:crypto\` rather than
pulling in the \`googleapis\` package.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiconnect-sheets-airtable — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines, sheets, and bases as you like. Do not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines and connect it to unlimited spreadsheets and
  Airtable bases you own or operate.
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

In particular: this software connects to your live Google Sheets and/or Airtable
account using credentials you provide. You are responsible for keeping your
service account key, Airtable token, and local dashboard auth token private, and
for reviewing safe-mode settings before enabling read/write access.

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
  "name": "multiconnect-sheets-airtable",
  "version": "1.0.0",
  "description": "Turn a spreadsheet into your agent's database. Two-way sync with Google Sheets or Airtable — no code needed.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiconnect-sheets": "./bin/sheets-connect.mjs"
  },
  "main": "./lib/server.mjs",
  "exports": {
    ".": "./lib/server.mjs",
    "./config": "./lib/config.mjs"
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
    "start": "node bin/sheets-connect.mjs start",
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
echo "Starting MultiConnect: Sheets/Airtable..."
echo ""
node "$DIR/bin/sheets-connect.mjs" start
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

Write-Host "Starting MultiConnect: Sheets/Airtable..."
Write-Host ""
node "$PSScriptRoot\\bin\\sheets-connect.mjs" start
`,
  },
  {
    path: "lib/airtable-client.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Thin wrapper over the Airtable REST API — read/create records in a base's
// table. Much simpler than Sheets: a personal access token, no signed JWTs.
// Every write path checks safeMode first, matching every other connector.

const REQUEST_TIMEOUT_MS = 10_000

export class AirtableApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'AirtableApiError'
    this.status = status
  }
}

function assertConfigured(config) {
  if (!config.airtable?.apiKey || !config.airtable?.baseId || !config.airtable?.tableName) {
    throw new AirtableApiError('Airtable is not connected yet — set the API key, base ID, and table name first.', 0)
  }
}

function assertWritable(config) {
  if (config.safeMode !== 'read-write') {
    throw new AirtableApiError('Refused: safe mode is read-only. Switch to read-write in the dashboard to allow writes.', 0)
  }
}

/**
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {string} path
 * @param {{ method?: string, body?: unknown, apiBase?: string }} [opts]
 */
async function request(config, path, opts = {}) {
  assertConfigured(config)
  const apiBase = opts.apiBase ?? 'https://api.airtable.com/v0'
  const url = \`\${apiBase}/\${config.airtable.baseId}/\${encodeURIComponent(config.airtable.tableName)}\${path}\`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { authorization: \`Bearer \${config.airtable.apiKey}\`, 'content-type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AirtableApiError(\`Airtable API \${res.status}: \${text.slice(0, 300)}\`, res.status)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {import('./config.mjs').SheetsConfig} config
 * @returns {Promise<Array<{ id: string, fields: Record<string, unknown> }>>}
 */
export async function listRecords(config, opts = {}) {
  const data = await request(config, '?pageSize=100', opts)
  return data.records ?? []
}

/**
 * Create one record. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {Record<string, unknown>} fields
 */
export async function createRecord(config, fields, opts = {}) {
  assertWritable(config)
  const data = await request(config, '', { ...opts, method: 'POST', body: { fields } })
  return data
}
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — which platform is active (Sheets,
// Airtable, or both), the credentials for each, the saved column mapping,
// and safe mode. No database, no account beyond the customer's own Google/
// Airtable accounts: the config file is the install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8423

/** @typedef {{ id: string, sourcePath: string, targetField: string }} MappingRule */
/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   safeMode: 'read-only' | 'read-write',
 *   sheets: {
 *     enabled: boolean,
 *     serviceAccountEmail: string | null,
 *     privateKey: string | null,
 *     spreadsheetId: string | null,
 *     sheetName: string
 *   },
 *   airtable: {
 *     enabled: boolean,
 *     apiKey: string | null,
 *     baseId: string | null,
 *     tableName: string | null
 *   },
 *   readMappings: MappingRule[],
 *   writeMappings: MappingRule[],
 *   createdAt: string
 * }} SheetsConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {SheetsConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    // Read-only by default, same reasoning as every other connector in this
    // line: a fresh install should never be able to overwrite a customer's
    // real spreadsheet or base until they deliberately allow it.
    safeMode: 'read-only',
    sheets: { enabled: false, serviceAccountEmail: null, privateKey: null, spreadsheetId: null, sheetName: 'Sheet1' },
    airtable: { enabled: false, apiKey: null, baseId: null, tableName: null },
    readMappings: [],
    writeMappings: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {SheetsConfig}
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
  return {
    ...base,
    ...parsed,
    sheets: { ...base.sheets, ...(parsed.sheets ?? {}) },
    airtable: { ...base.airtable, ...(parsed.airtable ?? {}) },
  }
}

/**
 * @param {SheetsConfig} config
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
    path: "lib/google-auth.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Google's Sheets API needs an OAuth2 access token, and a server-to-server
// tool gets one via a signed JWT exchanged at Google's token endpoint — the
// standard "service account" flow. The official googleapis package pulls in
// a large dependency tree for this one step, so this reimplements just the
// JWT construction and signing (RS256, via node:crypto) plus the token
// exchange call, keeping the whole package at zero dependencies.

import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const TOKEN_LIFETIME_SEC = 3600

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
}

/**
 * Build and sign the JWT assertion Google's token endpoint expects.
 * @param {string} serviceAccountEmail
 * @param {string} privateKey PEM-formatted private key from the service account JSON
 * @param {number} [now] unix seconds, injectable for tests
 */
export function buildAssertion(serviceAccountEmail, privateKey, now = Math.floor(Date.now() / 1000)) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: serviceAccountEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + TOKEN_LIFETIME_SEC,
  }
  const unsigned = \`\${base64url(JSON.stringify(header))}.\${base64url(JSON.stringify(claims))}\`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  // Normalize a private key that arrived with literal "\\n" sequences (common
  // when it's pasted from a JSON file into a single-line config field).
  const key = privateKey.includes('\\\\n') ? privateKey.replace(/\\\\n/g, '\\n') : privateKey
  const signature = signer.sign(key).toString('base64').replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
  return \`\${unsigned}.\${signature}\`
}

/**
 * Exchange a signed assertion for a bearer access token.
 * @param {string} serviceAccountEmail
 * @param {string} privateKey
 * @param {{ fetchImpl?: typeof fetch, tokenUrl?: string }} [opts] injectable for tests
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function getAccessToken(serviceAccountEmail, privateKey, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const tokenUrl = opts.tokenUrl ?? TOKEN_URL
  const assertion = buildAssertion(serviceAccountEmail, privateKey)
  const res = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`Google token exchange failed (\${res.status}): \${text.slice(0, 300)}\`)
  }
  const data = await res.json()
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}

export { TOKEN_URL, SCOPE }
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
 *   platform: 'sheets' | 'airtable' | 'system',
 *   kind: 'read' | 'write' | 'error',
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

// Applies a saved list of mapping rules (source field -> target field) to a
// plain row object. Same shape as MultiConnect's webhook bridge mapping
// engine — column names instead of JSON paths, but the same idea: no manual
// reformatting, the customer builds the mapping by clicking in the dashboard.

/**
 * @param {Record<string, unknown>} source
 * @param {import('./config.mjs').MappingRule[]} rules
 * @returns {Record<string, unknown>}
 */
export function applyMapping(source, rules) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const rule of rules) {
    const value = source?.[rule.sourcePath]
    if (value !== undefined) out[rule.targetField] = value
  }
  return out
}
`,
  },
  {
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole connector in one process: a local HTTP server serving the
// dashboard, a JSON API for config/mapping/log, and read/write routes for
// whichever of Sheets or Airtable (or both) the customer has enabled. Runs
// on localhost — this is a tool that runs on the customer's own machine.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig, saveConfig } from './config.mjs'
import { readRows, appendRow } from './sheets-client.mjs'
import { listRecords, createRecord } from './airtable-client.mjs'
import { applyMapping } from './mapping.mjs'
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
      if (size > 1_000_000) { reject(new Error('Payload too large')); req.destroy(); return }
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

    if (!isAuthorized(req, config.authToken)) {
      return json(res, 401, { error: 'Unauthorized. Use the token shown when the connector started.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { authToken, sheets, airtable, ...safe } = config
      return json(res, 200, {
        ...safe,
        sheets: {
          enabled: sheets.enabled,
          spreadsheetId: sheets.spreadsheetId,
          sheetName: sheets.sheetName,
          hasServiceAccount: Boolean(sheets.serviceAccountEmail && sheets.privateKey),
        },
        airtable: {
          enabled: airtable.enabled,
          baseId: airtable.baseId,
          tableName: airtable.tableName,
          hasApiKey: Boolean(airtable.apiKey),
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      const body = await readJsonBody(req)
      if (body.safeMode === 'read-only' || body.safeMode === 'read-write') config.safeMode = body.safeMode
      if (body.sheets) {
        config.sheets = {
          ...config.sheets,
          enabled: Boolean(body.sheets.enabled ?? config.sheets.enabled),
          serviceAccountEmail: body.sheets.serviceAccountEmail || config.sheets.serviceAccountEmail,
          privateKey: body.sheets.privateKey || config.sheets.privateKey,
          spreadsheetId: body.sheets.spreadsheetId ?? config.sheets.spreadsheetId,
          sheetName: body.sheets.sheetName || config.sheets.sheetName,
        }
      }
      if (body.airtable) {
        config.airtable = {
          ...config.airtable,
          enabled: Boolean(body.airtable.enabled ?? config.airtable.enabled),
          apiKey: body.airtable.apiKey || config.airtable.apiKey,
          baseId: body.airtable.baseId ?? config.airtable.baseId,
          tableName: body.airtable.tableName ?? config.airtable.tableName,
        }
      }
      saveConfig(config, opts.configPath)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/api/mappings') {
      const body = await readJsonBody(req)
      if (body.direction === 'read') config.readMappings = body.rules ?? []
      else if (body.direction === 'write') config.writeMappings = body.rules ?? []
      else return json(res, 400, { error: 'direction must be "read" or "write"' })
      saveConfig(config, opts.configPath)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/sheets/rows') {
      try {
        const { headers, rows } = await readRows(config)
        record({ platform: 'sheets', kind: 'read', summary: \`Read \${rows.length} rows\`, detail: null })
        const mapped = config.readMappings.length ? rows.map((r) => applyMapping(r, config.readMappings)) : rows
        return json(res, 200, { headers, rows: mapped })
      } catch (err) {
        record({ platform: 'sheets', kind: 'error', summary: err.message, detail: null })
        return json(res, err.status ? 502 : 500, { error: err.message })
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/sheets/rows') {
      try {
        const body = await readJsonBody(req)
        const { headers } = await readRows(config)
        const mapped = config.writeMappings.length ? applyMapping(body, config.writeMappings) : body
        await appendRow(config, headers, mapped)
        record({ platform: 'sheets', kind: 'write', summary: 'Appended a row', detail: JSON.stringify(mapped) })
        return json(res, 200, { ok: true })
      } catch (err) {
        record({ platform: 'sheets', kind: 'error', summary: err.message, detail: null })
        return json(res, err.status ? 502 : 500, { error: err.message })
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/airtable/records') {
      try {
        const records = await listRecords(config)
        record({ platform: 'airtable', kind: 'read', summary: \`Read \${records.length} records\`, detail: null })
        return json(res, 200, { records })
      } catch (err) {
        record({ platform: 'airtable', kind: 'error', summary: err.message, detail: null })
        return json(res, err.status ? 502 : 500, { error: err.message })
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/airtable/records') {
      try {
        const body = await readJsonBody(req)
        const mapped = config.writeMappings.length ? applyMapping(body, config.writeMappings) : body
        await createRecord(config, mapped)
        record({ platform: 'airtable', kind: 'write', summary: 'Created a record', detail: JSON.stringify(mapped) })
        return json(res, 200, { ok: true })
      } catch (err) {
        record({ platform: 'airtable', kind: 'error', summary: err.message, detail: null })
        return json(res, err.status ? 502 : 500, { error: err.message })
      }
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
    path: "lib/sheets-client.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Thin wrapper over the Google Sheets API v4 — read/write rows as arrays of
// plain values, keyed by A1-style ranges. Every write path checks safeMode
// first, matching every other connector in this line.

import { getAccessToken } from './google-auth.mjs'

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const REQUEST_TIMEOUT_MS = 10_000

export class SheetsApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'SheetsApiError'
    this.status = status
  }
}

function assertConfigured(config) {
  if (!config.sheets?.serviceAccountEmail || !config.sheets?.privateKey || !config.sheets?.spreadsheetId) {
    throw new SheetsApiError('Google Sheets is not connected yet — set the service account and spreadsheet ID first.', 0)
  }
}

function assertWritable(config) {
  if (config.safeMode !== 'read-write') {
    throw new SheetsApiError('Refused: safe mode is read-only. Switch to read-write in the dashboard to allow writes.', 0)
  }
}

/**
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {string} path
 * @param {{ method?: string, body?: unknown, apiBase?: string, tokenFn?: typeof getAccessToken }} [opts]
 */
async function request(config, path, opts = {}) {
  assertConfigured(config)
  const tokenFn = opts.tokenFn ?? getAccessToken
  const { accessToken } = await tokenFn(config.sheets.serviceAccountEmail, config.sheets.privateKey)
  const apiBase = opts.apiBase ?? SHEETS_API
  const url = \`\${apiBase}/\${config.sheets.spreadsheetId}\${path}\`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { authorization: \`Bearer \${accessToken}\`, 'content-type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new SheetsApiError(\`Sheets API \${res.status}: \${text.slice(0, 300)}\`, res.status)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read all rows from the configured sheet, first row treated as headers.
 * @param {import('./config.mjs').SheetsConfig} config
 * @returns {Promise<{ headers: string[], rows: Record<string, string>[] }>}
 */
export async function readRows(config, opts = {}) {
  const range = \`\${config.sheets.sheetName}!A1:ZZ1000\`
  const data = await request(config, \`/values/\${encodeURIComponent(range)}\`, opts)
  const values = data.values ?? []
  if (values.length === 0) return { headers: [], rows: [] }
  const [headers, ...body] = values
  const rows = body.map((row) => {
    /** @type {Record<string, string>} */
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

/**
 * Append one row to the end of the sheet. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').SheetsConfig} config
 * @param {string[]} headers the sheet's current header row, to order values correctly
 * @param {Record<string, string>} rowObject
 */
export async function appendRow(config, headers, rowObject, opts = {}) {
  assertWritable(config)
  const values = [headers.map((h) => rowObject[h] ?? '')]
  const range = \`\${config.sheets.sheetName}!A1\`
  const data = await request(
    config,
    \`/values/\${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED\`,
    { ...opts, method: 'POST', body: { values } },
  )
  return data
}
`,
  },
  {
    path: "lib/ui/app.js",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcsa-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcsa-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcsa-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-safe').addEventListener('click', async () => {
  await api('/api/config', { method: 'POST', body: JSON.stringify({ safeMode: document.getElementById('safe-mode').value }) })
  await refreshConfig()
})

document.getElementById('save-sheets').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      sheets: {
        enabled: document.getElementById('sheets-enabled').checked,
        serviceAccountEmail: document.getElementById('sa-email').value.trim(),
        privateKey: document.getElementById('sa-key').value.trim(),
        spreadsheetId: document.getElementById('spreadsheet-id').value.trim(),
        sheetName: document.getElementById('sheet-name').value.trim() || 'Sheet1',
      },
    }),
  })
  document.getElementById('sa-key').value = ''
  await refreshConfig()
})

document.getElementById('save-airtable').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      airtable: {
        enabled: document.getElementById('airtable-enabled').checked,
        apiKey: document.getElementById('at-key').value.trim(),
        baseId: document.getElementById('at-base').value.trim(),
        tableName: document.getElementById('at-table').value.trim(),
      },
    }),
  })
  document.getElementById('at-key').value = ''
  await refreshConfig()
})

document.getElementById('sheets-test').addEventListener('click', async () => {
  const el = document.getElementById('sheets-result')
  el.textContent = 'Fetching…'
  const data = await api('/api/sheets/rows')
  el.textContent = data.error ? \`Error: \${data.error}\` : \`Fetched \${data.rows.length} rows, columns: \${data.headers.join(', ')}\`
  await refreshLog()
})
document.getElementById('airtable-test').addEventListener('click', async () => {
  const el = document.getElementById('airtable-result')
  el.textContent = 'Fetching…'
  const data = await api('/api/airtable/records')
  el.textContent = data.error ? \`Error: \${data.error}\` : \`Fetched \${data.records.length} records.\`
  await refreshLog()
})

function mappingRow(rule) {
  const row = document.createElement('div')
  row.className = 'row'
  row.innerHTML = \`
    <input placeholder="source field" value="\${rule.sourcePath ?? ''}" data-field="sourcePath"/>
    <span class="tag">→</span>
    <input placeholder="target field" value="\${rule.targetField ?? ''}" data-field="targetField"/>
    <button class="ghost" data-remove>×</button>
  \`
  row.querySelector('[data-remove]').addEventListener('click', () => row.remove())
  return row
}
function readRules(containerId) {
  return Array.from(document.querySelectorAll(\`#\${containerId} .row\`)).map((row, i) => ({
    id: String(i),
    sourcePath: row.querySelector('[data-field="sourcePath"]').value.trim(),
    targetField: row.querySelector('[data-field="targetField"]').value.trim(),
  })).filter((r) => r.sourcePath && r.targetField)
}
function addMappingUI(containerId, rules) {
  const container = document.getElementById(containerId)
  container.innerHTML = ''
  for (const rule of rules) container.appendChild(mappingRow(rule))
}
document.getElementById('add-read-rule').addEventListener('click', () => document.getElementById('read-mapping').appendChild(mappingRow({})))
document.getElementById('add-write-rule').addEventListener('click', () => document.getElementById('write-mapping').appendChild(mappingRow({})))
document.getElementById('save-read-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'read', rules: readRules('read-mapping') }) })
})
document.getElementById('save-write-mapping').addEventListener('click', async () => {
  await api('/api/mappings', { method: 'POST', body: JSON.stringify({ direction: 'write', rules: readRules('write-mapping') }) })
})

document.getElementById('clear-log').addEventListener('click', async () => {
  await api('/api/log/clear', { method: 'POST' })
  await refreshLog()
})
async function refreshLog() {
  const { entries } = await api('/api/log?limit=50')
  const el = document.getElementById('log')
  el.innerHTML = entries.length
    ? entries.map((e) => \`<div class="log-entry \${e.kind === 'error' ? 'error' : ''}"><span class="tag">\${e.platform} · \${e.kind} · \${e.at}</span><br/>\${e.summary}</div>\`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function refreshConfig() {
  const config = await api('/api/config')
  document.getElementById('safe-mode').value = config.safeMode
  const badge = document.getElementById('safe-badge')
  badge.textContent = config.safeMode
  badge.className = \`safe-badge \${config.safeMode === 'read-write' ? 'rw' : 'ro'}\`

  document.getElementById('sheets-enabled').checked = config.sheets.enabled
  document.getElementById('sa-email').value = config.sheets.serviceAccountEmail || ''
  document.getElementById('spreadsheet-id').value = config.sheets.spreadsheetId || ''
  document.getElementById('sheet-name').value = config.sheets.sheetName || 'Sheet1'

  document.getElementById('airtable-enabled').checked = config.airtable.enabled
  document.getElementById('at-base').value = config.airtable.baseId || ''
  document.getElementById('at-table').value = config.airtable.tableName || ''

  addMappingUI('read-mapping', config.readMappings || [])
  addMappingUI('write-mapping', config.writeMappings || [])
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
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
<title>MultiConnect: Sheets/Airtable</title>
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
  input,select,textarea{width:100%;background:#0c0404;color:var(--paper);border:1px solid var(--line);border-radius:4px;padding:8px 10px;font-family:inherit;font-size:14px;margin-bottom:10px}
  textarea{min-height:70px;font-family:monospace;font-size:12px}
  button{background:var(--brass);color:var(--ink);font-weight:600;font-size:13px;padding:8px 14px;border:none;border-radius:4px;cursor:pointer}
  button.ghost{background:transparent;color:var(--brass);border:1px solid var(--line)}
  .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .row input{margin-bottom:0}
  .mapping-list{margin-bottom:10px}
  .safe-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
  .safe-badge.ro{background:#1a3d1a;color:#7cd67c}
  .safe-badge.rw{background:#3d1a1a;color:#ff9c9c}
  .log-entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .log-entry.error{color:#ff786e}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  #token-gate{text-align:center;padding-top:60px}
  .toggle{display:flex;align-items:center;gap:8px;margin-bottom:12px}
  .toggle input{width:auto;margin:0}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiConnect: Sheets/Airtable</h1>
    <p class="sub">Paste the token shown in your terminal when the connector started.</p>
    <input id="token-input" placeholder="local auth token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiConnect: Sheets/Airtable</h1>
  <p class="sub">Running locally · your credentials never leave this machine.</p>

  <section>
    <h2>Safe mode <span id="safe-badge" class="safe-badge ro">read-only</span></h2>
    <label for="safe-mode">Access level</label>
    <select id="safe-mode">
      <option value="read-only">Read-only — agent can see rows, never add or change them</option>
      <option value="read-write">Read/write — agent can append rows/records</option>
    </select>
    <button id="save-safe">Save</button>
  </section>

  <section>
    <div class="toggle"><input type="checkbox" id="sheets-enabled"/><h2 style="margin:0">Google Sheets</h2></div>
    <label for="sa-email">Service account email</label>
    <input id="sa-email" placeholder="my-bot@my-project.iam.gserviceaccount.com"/>
    <label for="sa-key">Service account private key</label>
    <textarea id="sa-key" placeholder="-----BEGIN PRIVATE KEY-----..."></textarea>
    <label for="spreadsheet-id">Spreadsheet ID (from the sheet's URL)</label>
    <input id="spreadsheet-id" placeholder="1BxiMVs0XRA5nFMd..."/>
    <label for="sheet-name">Sheet/tab name</label>
    <input id="sheet-name" value="Sheet1"/>
    <button id="save-sheets">Save Sheets connection</button>
    <div class="row" style="margin-top:10px">
      <button class="ghost" id="sheets-test">Fetch rows</button>
    </div>
    <div id="sheets-result" class="sub"></div>
  </section>

  <section>
    <div class="toggle"><input type="checkbox" id="airtable-enabled"/><h2 style="margin:0">Airtable</h2></div>
    <label for="at-key">Personal access token</label>
    <input id="at-key" type="password" placeholder="pat..."/>
    <label for="at-base">Base ID</label>
    <input id="at-base" placeholder="app..."/>
    <label for="at-table">Table name</label>
    <input id="at-table" placeholder="Leads"/>
    <button id="save-airtable">Save Airtable connection</button>
    <div class="row" style="margin-top:10px">
      <button class="ghost" id="airtable-test">Fetch records</button>
    </div>
    <div id="airtable-result" class="sub"></div>
  </section>

  <section>
    <h2>Field mapping</h2>
    <p class="sub">Maps agent field names to your sheet columns / Airtable field names, both directions.</p>
    <label>Read mapping (source column → agent field)</label>
    <div id="read-mapping" class="mapping-list"></div>
    <button class="ghost" id="add-read-rule">+ Add field</button>
    <button id="save-read-mapping">Save</button>
    <label style="margin-top:16px">Write mapping (agent field → target column)</label>
    <div id="write-mapping" class="mapping-list"></div>
    <button class="ghost" id="add-write-rule">+ Add field</button>
    <button id="save-write-mapping">Save</button>
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
    path: "bin/sheets-connect.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`multiconnect-sheets — connect your AI agent to Google Sheets and Airtable

Usage
  multiconnect-sheets start [options]

Options
  --port <n>       Port to listen on (default: 8423)
  --config <path>  Path to bridge.config.json (default: ./bridge.config.json)
  -h, --help       Show this message
  -v, --version    Show the connector version
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
    console.log('  MultiConnect: Sheets/Airtable is running.')
    console.log('')
    console.log(\`  Dashboard:  http://localhost:\${config.port}\`)
    console.log(\`  Token:      \${config.authToken}\`)
    console.log('')
    console.log('  Safe mode starts as read-only. Switch to read-write in the dashboard when ready.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiconnect-sheets: fatal —', err.message)
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
#   cp adapters/systemd.service ~/.config/systemd/user/multiconnect-sheets.service
#   systemctl --user enable --now multiconnect-sheets

[Unit]
Description=MultiConnect Sheets/Airtable
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/sheets-connect.mjs start
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
# Registers the connector as a Windows Scheduled Task that starts silently at
# logon and keeps running in the background.
#
# Usage (from an elevated PowerShell prompt, run from the package root):
#   .\\adapters\\windows-task.ps1

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$binPath = Join-Path $packageRoot 'bin\\sheets-connect.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiConnect Sheets Airtable" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. The connector will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiConnect Sheets Airtable'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiConnect Sheets Airtable'"
`,
  },
  {
    path: "test/airtable-client.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { listRecords, createRecord, AirtableApiError } from '../lib/airtable-client.mjs'

function baseConfig(overrides = {}) {
  return {
    safeMode: 'read-only',
    airtable: { apiKey: 'pat_test', baseId: 'appTest', tableName: 'Leads' },
    ...overrides,
  }
}

function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, apiBase: \`http://localhost:\${server.address().port}\` })))
}

test('listRecords returns the records array', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer pat_test')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ records: [{ id: 'rec1', fields: { Name: 'Ada' } }] }))
  })
  try {
    const records = await listRecords(baseConfig(), { apiBase })
    assert.deepEqual(records, [{ id: 'rec1', fields: { Name: 'Ada' } }])
  } finally {
    server.close()
  }
})

test('createRecord refuses when safe mode is read-only, without making a request', async () => {
  let called = false
  const { server, apiBase } = await startFixture((req, res) => {
    called = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  try {
    const config = baseConfig({ safeMode: 'read-only' })
    await assert.rejects(
      () => createRecord(config, { Name: 'Ada' }, { apiBase }),
      (err) => err instanceof AirtableApiError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
  } finally {
    server.close()
  }
})

test('createRecord succeeds when safe mode is read-write', async () => {
  let receivedBody
  const { server, apiBase } = await startFixture((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      receivedBody = JSON.parse(body)
      assert.equal(req.method, 'POST')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: 'rec2', fields: { Name: 'Grace' } }))
    })
  })
  try {
    const config = baseConfig({ safeMode: 'read-write' })
    const created = await createRecord(config, { Name: 'Grace' }, { apiBase })
    assert.deepEqual(receivedBody, { fields: { Name: 'Grace' } })
    assert.equal(created.id, 'rec2')
  } finally {
    server.close()
  }
})

test('throws a clear error when Airtable is not connected', async () => {
  const config = baseConfig({ airtable: { apiKey: null, baseId: null, tableName: null } })
  await assert.rejects(
    () => listRecords(config),
    (err) => err instanceof AirtableApiError && /not connected/.test(err.message),
  )
})

test('surfaces an Airtable API error with the status code attached', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    res.writeHead(422, { 'content-type': 'text/plain' })
    res.end('Unprocessable')
  })
  try {
    await assert.rejects(
      () => listRecords(baseConfig(), { apiBase }),
      (err) => err instanceof AirtableApiError && err.status === 422,
    )
  } finally {
    server.close()
  }
})
`,
  },
  {
    path: "test/google-auth.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.
//
// Verifies the JWT construction and signature directly (using a throwaway
// test keypair — never used against real Google infrastructure), plus the
// token exchange against a local fixture server standing in for Google's
// token endpoint. No real Google account or network access required.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { createVerify, createPrivateKey, createPublicKey } from 'node:crypto'
import { buildAssertion, getAccessToken, TOKEN_URL, SCOPE } from '../lib/google-auth.mjs'

// A throwaway 2048-bit RSA test keypair, generated solely for this test
// suite. It has never been registered with Google and is not used for
// anything outside verifying that buildAssertion() signs correctly.
const TEST_PRIVATE_KEY = \`-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCvtxoJDlXzpKU4
r3fwnnHlEoM/Px/mF4Ijq4vz2h9GDFfNxvhxLm+1UtZNIPUnt/ElgcH2OBiBMB9K
b+i1JwWO59GWnbOSKge7GOZRS1s98gNgVgYlocmpdUxKsMkiJPpujRP0b8V7wLqy
iOnJ/SFUuxXrwC8u7PQb17nRdWqO19eB95bBTcZXWHzLO7Ky86RUbVoo2XaoeaaU
tsXulJcUfH11pdYLr4NOD4Nj0pIFIAv9NrRt1j7P9VFOP+0HQJvfMx8SI4nX9n+t
WnaRdIfgCJgI6UpOTnzn8NgFGg2XqCzJeABbwWLCQtCtFroC4c4cP/kC4AYdOn+V
Zf20L2GXAgMBAAECggEAG4jAIiomatLidwL78u8JHuGrQlZka7xETs2bVR9ZZjMZ
8StcE/Q4Wfv8i8J91/b5aSyvlaMNp/S/+nyVxQkz1ERcMdNNZ7qBUp6gvJ1n00mg
oNBqDyyOeqjgRxXzto9/1KHzvgpjsjQtrTtKEzZAqlPUqAgJ/Lrxt4ky23EgPPiw
Cs6WGBBix0rqQrzYiqoSYUzUirBTlhE3L7DNLONQNCEQ9UOvSpKdKCLGQzeNHogp
WLnFJV4w0sRDy2iET9TJmliRym43vWQxxhuwzT3U3qkErC4R3Xt7YCIv/QLKkwZx
u7y1bv1g6Rv+Mt9AnFAKugkpLACiXPM2Sk+it4N9jQKBgQDddUmX/0GlMt3qEtMf
iXBq0DAHUx7AqvROn7WAymf8tDoQeyaUyg3IGAWpwlnT5A9YJWelNUEaJR96SCpU
Cg6N5J8uWL9s02yIY+AhG+foEAhYoULAHRtm7B0OPKXZ4RkMRDMXMn93s1VkOmyx
OAfD8EfnkFLTHFUzUEAcPOTc9QKBgQDLH1KflBSPIjfNORXLObNcIe4UsD2aGSvR
9TrIYivA0RPlIvblduF3iYyzYO/trXdcHG7m9WSKfNDQvNAK4JNTdnqo5MQR9Zib
bnwRjnYy1tJViUKaAgB5BT+jEIoMp70jVTvoTwQS6ARWYJrdsJ+bafSsOPW2yMSc
cEaMZRNs2wKBgQCP03OXXrUAmDedpNou2jEDffAjYa1QTfba9UiIu2urqFUpjQGy
kkM/F7Ld3JZAUhZRFgHpPtvoIgH+hc3PxLRNHRTwoby47drH/a17c0c65Oa2wQy7
/mtkfaYlL+g6x8FfwQ85WpeEYxjrPjKHKi+I5o2ca5QO/ZCsAcuRS08L3QKBgQC9
60qYtJ9IeakNNMvg2dGPWpY+N89RbymexZkx1UCtp4/flgKd6LrFxxGMgx2y8JeC
w38aaeWY6z1ffrtTAEogJs5nboa5eBY5dmOBEuAHhv7hRVbFowuIHFU1BXjeflQF
XmOGQaNAfjnX/bmvgL6rVLWV9iggwLW8w+niyXsRMwKBgQDJU5SbK4RdUWz6UTlx
nLy99rtUZojCoQNjoVnKhzBuRp9kLWJJZUp5Qp7HCR0jTLmk4ZWs5PM6+NS7igz1
/agZPmDtVdHC1xdonhPD18sUnHpFuho+n6RRNdCn/mQu2M8t+M5FmZDjMuwIb6I+
CGOFMAI5MOzD91nb1n9JS6DG8g==
-----END PRIVATE KEY-----\`

test('buildAssertion produces a well-formed, correctly signed JWT', () => {
  const now = 1_700_000_000
  const jwt = buildAssertion('bot@my-project.iam.gserviceaccount.com', TEST_PRIVATE_KEY, now)
  const parts = jwt.split('.')
  assert.equal(parts.length, 3, 'JWT must have header.claims.signature')

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
  assert.deepEqual(header, { alg: 'RS256', typ: 'JWT' })

  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  assert.equal(claims.iss, 'bot@my-project.iam.gserviceaccount.com')
  assert.equal(claims.scope, SCOPE)
  assert.equal(claims.aud, TOKEN_URL)
  assert.equal(claims.iat, now)
  assert.equal(claims.exp, now + 3600)
})

test('buildAssertion signature verifies against the matching public key', () => {
  const jwt = buildAssertion('bot@my-project.iam.gserviceaccount.com', TEST_PRIVATE_KEY)
  const [headerB64, claimsB64, sigB64] = jwt.split('.')
  const signedInput = \`\${headerB64}.\${claimsB64}\`
  const signature = Buffer.from(sigB64, 'base64url')

  // Derive the real public key from the private key rather than trusting a
  // separately-pasted one, so this test can't silently drift out of sync.
  const pub = createPublicKey(createPrivateKey(TEST_PRIVATE_KEY))

  const verifier = createVerify('RSA-SHA256')
  verifier.update(signedInput)
  verifier.end()
  assert.equal(verifier.verify(pub, signature), true)
})

test('buildAssertion normalizes an escaped-newline private key', () => {
  const escaped = TEST_PRIVATE_KEY.replace(/\\n/g, '\\\\n')
  // Should not throw — the escaped form is what a service-account JSON key
  // looks like when pasted into a single-line config field.
  assert.doesNotThrow(() => buildAssertion('bot@x.iam.gserviceaccount.com', escaped))
})

test('getAccessToken exchanges the assertion at the token endpoint', async () => {
  let received
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      received = new URLSearchParams(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'fake-access-token', expires_in: 3600 }))
    })
  })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const port = server.address().port
    const { accessToken, expiresIn } = await getAccessToken('bot@x.iam.gserviceaccount.com', TEST_PRIVATE_KEY, {
      tokenUrl: \`http://localhost:\${port}/token\`,
    })
    assert.equal(accessToken, 'fake-access-token')
    assert.equal(expiresIn, 3600)
    assert.equal(received.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer')
    assert.ok(received.get('assertion'))
  } finally {
    server.close()
  }
})

test('getAccessToken throws a clear error on a failed exchange', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(401, { 'content-type': 'text/plain' })
    res.end('invalid_grant')
  })
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const port = server.address().port
    await assert.rejects(
      () => getAccessToken('bot@x.iam.gserviceaccount.com', TEST_PRIVATE_KEY, { tokenUrl: \`http://localhost:\${port}/token\` }),
      /token exchange failed/,
    )
  } finally {
    server.close()
  }
})
`,
  },
  {
    path: "test/mapping.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { applyMapping } from '../lib/mapping.mjs'

test('applyMapping renames fields per the rules', () => {
  const out = applyMapping({ Name: 'Ada', Email: 'ada@example.com' }, [
    { id: '1', sourcePath: 'Name', targetField: 'full_name' },
    { id: '2', sourcePath: 'Email', targetField: 'email' },
  ])
  assert.deepEqual(out, { full_name: 'Ada', email: 'ada@example.com' })
})

test('applyMapping drops unmapped fields', () => {
  const out = applyMapping({ Name: 'Ada', Secret: 'x' }, [{ id: '1', sourcePath: 'Name', targetField: 'full_name' }])
  assert.deepEqual(out, { full_name: 'Ada' })
})

test('applyMapping skips a rule whose source field is missing', () => {
  const out = applyMapping({ a: 1 }, [{ id: '1', sourcePath: 'b', targetField: 'x' }])
  assert.deepEqual(out, {})
})

test('applyMapping with no rules returns an empty object', () => {
  const out = applyMapping({ a: 1, b: 2 }, [])
  assert.deepEqual(out, {})
})
`,
  },
  {
    path: "test/run.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import './mapping.test.mjs'
import './google-auth.test.mjs'
import './sheets-client.test.mjs'
import './airtable-client.test.mjs'
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
  const dir = mkdtempSync(path.join(tmpdir(), 'mcsa-test-'))
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

test('new installs default to read-only safe mode, both platforms disabled', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.safeMode, 'read-only')
    assert.equal(body.sheets.enabled, false)
    assert.equal(body.airtable.enabled, false)
  } finally {
    ctx.close()
  }
})

test('config API never echoes secrets back, only presence flags', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({
        sheets: { serviceAccountEmail: 'bot@x.iam.gserviceaccount.com', privateKey: 'SECRET_KEY_MATERIAL', spreadsheetId: 'sheet1' },
        airtable: { apiKey: 'pat_SECRET', baseId: 'appX', tableName: 'Leads' },
      }),
    })
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.sheets.hasServiceAccount, true)
    assert.equal(body.airtable.hasApiKey, true)
    assert.ok(!JSON.stringify(body).includes('SECRET'))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('mapping API saves read and write rules independently', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/mappings\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ direction: 'read', rules: [{ id: '1', sourcePath: 'Name', targetField: 'full_name' }] }),
    })
    await fetch(\`http://localhost:\${ctx.port}/api/mappings\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ direction: 'write', rules: [{ id: '1', sourcePath: 'email', targetField: 'Email' }] }),
    })
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.readMappings.length, 1)
    assert.equal(body.writeMappings.length, 1)
    assert.equal(body.readMappings[0].targetField, 'full_name')
    assert.equal(body.writeMappings[0].targetField, 'Email')
  } finally {
    ctx.close()
  }
})

test('mapping API rejects an unknown direction', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/mappings\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ direction: 'sideways', rules: [] }),
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
  {
    path: "test/sheets-client.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { readRows, appendRow, SheetsApiError } from '../lib/sheets-client.mjs'

const FAKE_TOKEN_FN = async () => ({ accessToken: 'fake-token', expiresIn: 3600 })

function baseConfig(overrides = {}) {
  return {
    safeMode: 'read-only',
    sheets: {
      serviceAccountEmail: 'bot@x.iam.gserviceaccount.com',
      privateKey: 'irrelevant-because-tokenFn-is-stubbed',
      spreadsheetId: 'sheet123',
      sheetName: 'Sheet1',
    },
    ...overrides,
  }
}

function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, apiBase: \`http://localhost:\${server.address().port}\` })))
}

test('readRows parses the header row and returns objects keyed by header', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ values: [['Name', 'Email'], ['Ada', 'ada@example.com'], ['Grace', 'grace@example.com']] }))
  })
  try {
    const { headers, rows } = await readRows(baseConfig(), { apiBase, tokenFn: FAKE_TOKEN_FN })
    assert.deepEqual(headers, ['Name', 'Email'])
    assert.deepEqual(rows, [{ Name: 'Ada', Email: 'ada@example.com' }, { Name: 'Grace', Email: 'grace@example.com' }])
  } finally {
    server.close()
  }
})

test('readRows returns empty when the sheet has no data', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({}))
  })
  try {
    const { headers, rows } = await readRows(baseConfig(), { apiBase, tokenFn: FAKE_TOKEN_FN })
    assert.deepEqual(headers, [])
    assert.deepEqual(rows, [])
  } finally {
    server.close()
  }
})

test('appendRow refuses when safe mode is read-only, without making a request', async () => {
  let called = false
  const { server, apiBase } = await startFixture((req, res) => {
    called = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  try {
    const config = baseConfig({ safeMode: 'read-only' })
    await assert.rejects(
      () => appendRow(config, ['Name', 'Email'], { Name: 'Ada' }, { apiBase, tokenFn: FAKE_TOKEN_FN }),
      (err) => err instanceof SheetsApiError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
  } finally {
    server.close()
  }
})

test('appendRow succeeds when safe mode is read-write, ordering values by header', async () => {
  let receivedBody
  const { server, apiBase } = await startFixture((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      receivedBody = JSON.parse(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  })
  try {
    const config = baseConfig({ safeMode: 'read-write' })
    await appendRow(config, ['Name', 'Email'], { Email: 'ada@example.com', Name: 'Ada' }, { apiBase, tokenFn: FAKE_TOKEN_FN })
    assert.deepEqual(receivedBody.values, [['Ada', 'ada@example.com']])
  } finally {
    server.close()
  }
})

test('throws a clear error when Sheets is not connected', async () => {
  const config = baseConfig({ sheets: { serviceAccountEmail: null, privateKey: null, spreadsheetId: null, sheetName: 'Sheet1' } })
  await assert.rejects(
    () => readRows(config, { tokenFn: FAKE_TOKEN_FN }),
    (err) => err instanceof SheetsApiError && /not connected/.test(err.message),
  )
})
`,
  },
]
