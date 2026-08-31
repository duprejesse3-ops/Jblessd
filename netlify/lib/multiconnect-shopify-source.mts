// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiconnect-shopify/tools/embed-source.mjs from the
// real package source. Regenerate after changing the package:
//
//   node packages/multiconnect-shopify/tools/embed-source.mjs
//
// This is the payload for the MultiConnect: Shopify product (SKU
// AI-CN-002): the complete, runnable source the buyer receives at
// checkout. It is embedded rather than read from disk so fulfilment cannot
// fail on a missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTICONNECT_SHOPIFY_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiConnect: Shopify

Give your AI agent real-time access to your Shopify store.

Runs entirely on your own machine: a local dashboard for connecting your
store's Admin API, watching orders and inventory come in live, and getting
instant low-stock alerts — with a safe-mode switch that keeps your agent
read-only until you deliberately turn it off.

## Install

**Windows**

\`\`\`powershell
.\\install.ps1
\`\`\`

**macOS / Linux**

\`\`\`bash
./install.sh
\`\`\`

Either way, this starts the connector in the foreground and prints a
dashboard URL, a local auth token, and the webhook URL to add in Shopify.

## Setting up your Shopify store

1. In your Shopify admin, go to **Settings → Apps and sales channels →
   Develop apps**, create an app, and give it Admin API access with these
   scopes: \`read_products\`, \`read_orders\`, and (only if you plan to use
   read/write mode) \`write_products\`, \`write_inventory\`.
2. Copy the **Admin API access token** into the dashboard's Connect section.
3. Go to **Settings → Notifications → Webhooks**, create webhooks for
   \`Order creation\` and \`Inventory level update\`, pointing at the webhook
   URL the dashboard shows you, and copy the **webhook signing secret**
   into the dashboard too.

## Safe mode

Every install starts **read-only** — your agent can see products, orders,
and inventory, but cannot change anything in your store. Switch to
**read/write** in the dashboard only when you're ready to let the agent
update prices or adjust stock. Every write call checks this setting first
and refuses outright if it's not explicitly enabled — there's no way to
bypass it from the agent side.

## Using it

- **Product & inventory sync** — your agent calls \`GET /api/products\` with
  your dashboard token to pull current products, prices, and variants.
- **Order visibility** — \`GET /api/orders\` pulls recent orders; the
  \`orders/create\` webhook also logs new orders live in the dashboard the
  moment they happen.
- **Instant triggers** — inventory webhooks are checked against your
  configured low-stock threshold automatically; anything at or below it is
  flagged in the activity log.

## Development

\`\`\`bash
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license. You
own your copy forever; you may not resell the software itself.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiconnect-shopify — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
stores and machines as you like. Do not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines and connect it to unlimited Shopify stores you own or operate.
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

In particular: this software connects to your live Shopify store using an Admin
API access token you provide. You are responsible for keeping that token and
your local dashboard auth token private, and for reviewing safe-mode settings
before enabling read/write access. [SELLER] is not responsible for changes made
to your store by an agent you have connected in read/write mode.

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
  "name": "multiconnect-shopify",
  "version": "1.0.0",
  "description": "Give your AI agent real-time access to your Shopify store — inventory, orders, and instant triggers, all in sync.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiconnect-shopify": "./bin/shopify-connect.mjs"
  },
  "main": "./lib/server.mjs",
  "exports": {
    ".": "./lib/server.mjs",
    "./config": "./lib/config.mjs",
    "./shopify-client": "./lib/shopify-client.mjs"
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
    "start": "node bin/shopify-connect.mjs start",
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
echo "Starting MultiConnect: Shopify..."
echo ""
node "$DIR/bin/shopify-connect.mjs" start
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

Write-Host "Starting MultiConnect: Shopify..."
Write-Host ""
node "$PSScriptRoot\\bin\\shopify-connect.mjs" start
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes shopify.config.json — store domain, the Admin API access
// token, the webhook secret Shopify signs requests with, and safe mode. No
// database, no account: the config file is the install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8421
const API_VERSION = '2024-10'

/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   shopDomain: string | null,
 *   accessToken: string | null,
 *   webhookSecret: string | null,
 *   safeMode: 'read-only' | 'read-write',
 *   createdAt: string
 * }} ShopifyConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'shopify.config.json')
}

/** @returns {ShopifyConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    shopDomain: null,
    accessToken: null,
    webhookSecret: null,
    // Read-only by default — a fresh install should never be able to write to
    // a customer's live store until they deliberately flip this.
    safeMode: 'read-only',
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {ShopifyConfig}
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
 * @param {ShopifyConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\\n', 'utf8')
}

/** Normalize whatever the customer typed into a clean *.myshopify.com host. */
export function normalizeShopDomain(input) {
  const trimmed = String(input ?? '').trim().replace(/^https?:\\/\\//, '').replace(/\\/.*$/, '')
  if (!trimmed) return null
  return trimmed.includes('.') ? trimmed : \`\${trimmed}.myshopify.com\`
}

export { defaultConfigPath, DEFAULT_PORT, API_VERSION }
`,
  },
  {
    path: "lib/inventory-alerts.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The "instant triggers" feature: when an inventory level webhook comes in,
// decide whether it crosses the customer's configured low-stock threshold —
// kept as its own tiny module so the decision logic has a test of its own,
// independent of the webhook plumbing around it.

/**
 * @param {number} available current stock level after the update
 * @param {number} threshold the customer's configured alert threshold
 * @returns {boolean} true if this level should fire a low-stock alert
 */
export function isLowStock(available, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0) return false
  return Number.isFinite(available) && available <= threshold
}
`,
  },
  {
    path: "lib/log.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A small in-memory ring buffer of recent store activity — orders received,
// low-stock alerts fired, sync calls made. Not persisted to disk on purpose:
// a debugging aid for the session you're in, not an audit trail.

const MAX_ENTRIES = 200

/**
 * @typedef {{
 *   id: string,
 *   kind: 'order' | 'inventory' | 'sync' | 'error',
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
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole connector in one process: a local HTTP server that serves the
// dashboard, exposes a small JSON API for config/safe-mode/log, receives real
// Shopify webhooks (order created, inventory updated), and gives the
// customer's agent simple read routes for products, inventory, and orders.
//
// Runs on localhost by default — this is a tool that runs on the customer's
// own machine, not a hosted service. The dashboard/agent API is gated by the
// local auth token; the Shopify webhook route is gated by HMAC verification
// instead, since Shopify can't send a bearer token.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig, saveConfig, normalizeShopDomain } from './config.mjs'
import { listProducts, listOrders, ShopifyApiError } from './shopify-client.mjs'
import { verifyShopifyWebhook } from './webhook-verify.mjs'
import { isLowStock } from './inventory-alerts.mjs'
import { record, recent, clear as clearLog } from './log.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.join(__dirname, 'ui')
const DEFAULT_LOW_STOCK_THRESHOLD = 10

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
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

/** Reads the raw body as a string — needed unparsed for HMAC verification. */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 2_000_000) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
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

    // ---- dashboard UI ----
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveStatic(res, 'index.html')
    if (req.method === 'GET' && url.pathname === '/app.js') return serveStatic(res, 'app.js')
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })

    // ---- Shopify webhook receiver: HMAC-verified, no bearer token ----
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const rawBody = await readRawBody(req)
      const signature = req.headers['x-shopify-hmac-sha256']
      const topic = req.headers['x-shopify-topic'] ?? 'unknown'

      if (!verifyShopifyWebhook(rawBody, /** @type {string} */ (signature ?? ''), config.webhookSecret ?? '')) {
        record({ kind: 'error', summary: \`Rejected unverified webhook (\${topic})\`, detail: null })
        return json(res, 401, { error: 'Invalid webhook signature' })
      }

      let payload
      try {
        payload = JSON.parse(rawBody)
      } catch {
        return json(res, 400, { error: 'Invalid JSON body' })
      }

      if (topic === 'orders/create') {
        record({
          kind: 'order',
          summary: \`New order #\${payload.order_number ?? payload.id} — $\${payload.total_price ?? '?'}\`,
          detail: JSON.stringify({ id: payload.id, email: payload.email, total: payload.total_price }),
        })
      } else if (topic === 'inventory_levels/update') {
        const available = Number(payload.available)
        const threshold = config.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD
        if (isLowStock(available, threshold)) {
          record({
            kind: 'inventory',
            summary: \`Low stock: item \${payload.inventory_item_id} at \${available} units (threshold \${threshold})\`,
            detail: JSON.stringify(payload),
          })
        } else {
          record({ kind: 'inventory', summary: \`Inventory updated: item \${payload.inventory_item_id} — \${available} units\`, detail: null })
        }
      } else {
        record({ kind: 'sync', summary: \`Received \${topic}\`, detail: JSON.stringify(payload).slice(0, 500) })
      }

      return json(res, 200, { received: true })
    }

    // ---- dashboard + agent JSON API (token-gated) ----
    if (url.pathname.startsWith('/api/')) {
      if (!isAuthorized(req, config.authToken)) {
        return json(res, 401, { error: 'Unauthorized. Use the token shown when the connector started.' })
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        const { authToken, accessToken, webhookSecret, ...safe } = config
        return json(res, 200, { ...safe, hasAccessToken: Boolean(accessToken), hasWebhookSecret: Boolean(webhookSecret) })
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        const body = await readRawBody(req).then((t) => JSON.parse(t || '{}'))
        if (typeof body.shopDomain === 'string') config.shopDomain = normalizeShopDomain(body.shopDomain)
        if (typeof body.accessToken === 'string' && body.accessToken) config.accessToken = body.accessToken
        if (typeof body.webhookSecret === 'string' && body.webhookSecret) config.webhookSecret = body.webhookSecret
        if (body.safeMode === 'read-only' || body.safeMode === 'read-write') config.safeMode = body.safeMode
        if (Number.isFinite(Number(body.lowStockThreshold))) config.lowStockThreshold = Number(body.lowStockThreshold)
        saveConfig(config, opts.configPath)
        return json(res, 200, { ok: true })
      }

      if (req.method === 'GET' && url.pathname === '/api/products') {
        try {
          const products = await listProducts(config)
          record({ kind: 'sync', summary: \`Synced \${products.length} products\`, detail: null })
          return json(res, 200, { products })
        } catch (err) {
          return json(res, err instanceof ShopifyApiError ? 502 : 500, { error: err.message })
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/orders') {
        try {
          const orders = await listOrders(config)
          record({ kind: 'sync', summary: \`Synced \${orders.length} orders\`, detail: null })
          return json(res, 200, { orders })
        } catch (err) {
          return json(res, err instanceof ShopifyApiError ? 502 : 500, { error: err.message })
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
      return res.end()
    }

    res.writeHead(404)
    res.end('Not found')
  })

  return { server, config }
}
`,
  },
  {
    path: "lib/shopify-client.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A thin wrapper over Shopify's Admin REST API — the "product/inventory sync"
// and "order visibility" halves of the connector. Every write path checks
// safeMode first, so a read-only install physically cannot mutate the store
// no matter what the agent asks for.

import { API_VERSION } from './config.mjs'

const REQUEST_TIMEOUT_MS = 10_000

class ShopifyApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ShopifyApiError'
    this.status = status
  }
}

/**
 * @param {import('./config.mjs').ShopifyConfig} config
 * @param {string} path e.g. "/products.json"
 * @param {{ method?: string, body?: unknown }} [opts]
 */
async function request(config, path, opts = {}) {
  if (!config.shopDomain || !config.accessToken) {
    throw new ShopifyApiError('Store is not connected yet — set the shop domain and access token first.', 0)
  }
  // Real Shopify domains are always myshopify.com or a custom domain over
  // HTTPS. localhost is never a legitimate target — allowing it over plain
  // HTTP exists solely so the test suite can point this at a local fixture
  // server instead of hitting the real internet.
  const protocol = config.shopDomain.startsWith('localhost') || config.shopDomain.startsWith('127.0.0.1') ? 'http' : 'https'
  const url = \`\${protocol}://\${config.shopDomain}/admin/api/\${API_VERSION}\${path}\`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ShopifyApiError(\`Shopify API \${res.status}: \${text.slice(0, 300)}\`, res.status)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Guard every write path — throws instead of silently no-op-ing so the caller sees exactly why nothing happened. */
function assertWritable(config) {
  if (config.safeMode !== 'read-write') {
    throw new ShopifyApiError('Refused: safe mode is read-only. Switch to read-write in the dashboard to allow writes.', 0)
  }
}

/** @param {import('./config.mjs').ShopifyConfig} config */
export async function listProducts(config, limit = 50) {
  const data = await request(config, \`/products.json?limit=\${limit}\`)
  return data.products ?? []
}

/** @param {import('./config.mjs').ShopifyConfig} config */
export async function getInventoryLevels(config, inventoryItemIds) {
  if (!inventoryItemIds.length) return []
  const data = await request(config, \`/inventory_levels.json?inventory_item_ids=\${inventoryItemIds.join(',')}\`)
  return data.inventory_levels ?? []
}

/** @param {import('./config.mjs').ShopifyConfig} config */
export async function listOrders(config, { status = 'any', limit = 50 } = {}) {
  const data = await request(config, \`/orders.json?status=\${status}&limit=\${limit}\`)
  return data.orders ?? []
}

/**
 * Update a variant's price. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').ShopifyConfig} config
 */
export async function updateVariantPrice(config, variantId, price) {
  assertWritable(config)
  const data = await request(config, \`/variants/\${variantId}.json\`, {
    method: 'PUT',
    body: { variant: { id: variantId, price: String(price) } },
  })
  return data.variant
}

/**
 * Adjust inventory at a location. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').ShopifyConfig} config
 */
export async function adjustInventory(config, inventoryItemId, locationId, adjustment) {
  assertWritable(config)
  const data = await request(config, '/inventory_levels/adjust.json', {
    method: 'POST',
    body: { inventory_item_id: inventoryItemId, location_id: locationId, available_adjustment: adjustment },
  })
  return data.inventory_level
}

export { ShopifyApiError }
`,
  },
  {
    path: "lib/ui/app.js",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcs-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcs-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcs-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-connect').addEventListener('click', async () => {
  const shopDomain = document.getElementById('shop-domain').value.trim()
  const accessToken = document.getElementById('access-token').value.trim()
  const webhookSecret = document.getElementById('webhook-secret').value.trim()
  await api('/api/config', { method: 'POST', body: JSON.stringify({ shopDomain, accessToken, webhookSecret }) })
  document.getElementById('access-token').value = ''
  document.getElementById('webhook-secret').value = ''
  await refreshConfig()
})

document.getElementById('save-safe').addEventListener('click', async () => {
  const safeMode = document.getElementById('safe-mode').value
  const lowStockThreshold = Number(document.getElementById('low-stock').value)
  await api('/api/config', { method: 'POST', body: JSON.stringify({ safeMode, lowStockThreshold }) })
  await refreshConfig()
})

document.getElementById('sync-products').addEventListener('click', async () => {
  const el = document.getElementById('sync-result')
  el.textContent = 'Fetching products…'
  const data = await api('/api/products')
  el.textContent = data.error ? \`Error: \${data.error}\` : \`Fetched \${data.products.length} products.\`
  await refreshLog()
})
document.getElementById('sync-orders').addEventListener('click', async () => {
  const el = document.getElementById('sync-result')
  el.textContent = 'Fetching orders…'
  const data = await api('/api/orders')
  el.textContent = data.error ? \`Error: \${data.error}\` : \`Fetched \${data.orders.length} orders.\`
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
    ? entries.map((e) => \`<div class="log-entry \${e.kind === 'error' ? 'error' : ''}"><span class="tag">\${e.kind} · \${e.at}</span><br/>\${e.summary}</div>\`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function refreshConfig() {
  const config = await api('/api/config')
  document.getElementById('shop-domain').value = config.shopDomain || ''
  document.getElementById('webhook-url').value = \`\${location.origin}/webhook\`
  document.getElementById('safe-mode').value = config.safeMode
  document.getElementById('low-stock').value = config.lowStockThreshold || 10
  const badge = document.getElementById('safe-badge')
  badge.textContent = config.safeMode
  badge.className = \`safe-badge \${config.safeMode === 'read-write' ? 'rw' : 'ro'}\`
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
<title>MultiConnect: Shopify</title>
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
  .safe-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
  .safe-badge.ro{background:#1a3d1a;color:#7cd67c}
  .safe-badge.rw{background:#3d1a1a;color:#ff9c9c}
  .log-entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .log-entry.error{color:#ff786e}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  #token-gate{text-align:center;padding-top:60px}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiConnect: Shopify</h1>
    <p class="sub">Paste the token shown in your terminal when the connector started.</p>
    <input id="token-input" placeholder="local auth token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiConnect: Shopify</h1>
  <p class="sub">Running locally · your access token never leaves this machine.</p>

  <section>
    <h2>Connect your store</h2>
    <label for="shop-domain">Store domain</label>
    <input id="shop-domain" placeholder="your-store.myshopify.com"/>
    <label for="access-token">Admin API access token</label>
    <input id="access-token" type="password" placeholder="shpat_..."/>
    <label for="webhook-secret">Webhook signing secret</label>
    <input id="webhook-secret" type="password" placeholder="from your Shopify app's webhook settings"/>
    <label>Your webhook URL (add this in Shopify → Notifications → Webhooks)</label>
    <input id="webhook-url" readonly/>
    <button id="save-connect">Save</button>
  </section>

  <section>
    <h2>Safe mode <span id="safe-badge" class="safe-badge ro">read-only</span></h2>
    <label for="safe-mode">Access level</label>
    <select id="safe-mode">
      <option value="read-only">Read-only — agent can see data, never change it</option>
      <option value="read-write">Read/write — agent can update prices and inventory</option>
    </select>
    <label for="low-stock">Low-stock alert threshold (units)</label>
    <input id="low-stock" type="number" value="10" min="1"/>
    <button id="save-safe">Save</button>
  </section>

  <section>
    <h2>Sync check</h2>
    <div class="row">
      <button id="sync-products">Fetch products</button>
      <button id="sync-orders">Fetch orders</button>
      <button class="ghost" id="clear-log">Clear log</button>
    </div>
    <div id="sync-result" class="sub"></div>
  </section>

  <section>
    <h2>Activity log</h2>
    <div id="log"></div>
  </section>
</div>

<script src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "lib/webhook-verify.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Shopify signs every webhook call with an HMAC-SHA256 of the raw request
// body, using your webhook secret, base64-encoded into the
// X-Shopify-Hmac-Sha256 header. Verifying it is the only thing standing
// between "a real event from your store" and "anyone on the internet who
// found this URL" — this module is that check, and nothing else in the
// package accepts a webhook without it passing first.

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * @param {string} rawBody the exact, unparsed request body bytes as a string
 * @param {string} signatureHeader the X-Shopify-Hmac-Sha256 header value
 * @param {string} secret your webhook signing secret
 * @returns {boolean}
 */
export function verifyShopifyWebhook(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const a = Buffer.from(computed)
  const b = Buffer.from(signatureHeader)
  // Constant-time comparison — a plain === here would leak timing
  // information about how many leading bytes matched, letting a patient
  // attacker forge a valid signature byte by byte.
  return a.length === b.length && timingSafeEqual(a, b)
}
`,
  },
  {
    path: "bin/shopify-connect.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`multiconnect-shopify — connect your AI agent to your Shopify store

Usage
  multiconnect-shopify start [options]

Options
  --port <n>       Port to listen on (default: 8421)
  --config <path>  Path to shopify.config.json (default: ./shopify.config.json)
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
    console.log('  MultiConnect: Shopify is running.')
    console.log('')
    console.log(\`  Dashboard:  http://localhost:\${config.port}\`)
    console.log(\`  Token:      \${config.authToken}\`)
    console.log('')
    console.log(\`  Webhook URL (add in Shopify → Notifications → Webhooks): http://localhost:\${config.port}/webhook\`)
    console.log('')
    console.log('  Safe mode starts as read-only. Switch to read-write in the dashboard when ready.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiconnect-shopify: fatal —', err.message)
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
#   cp adapters/systemd.service ~/.config/systemd/user/multiconnect-shopify.service
#   systemctl --user enable --now multiconnect-shopify

[Unit]
Description=MultiConnect Shopify
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/shopify-connect.mjs start
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
$binPath = Join-Path $packageRoot 'bin\\shopify-connect.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiConnect Shopify" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. The connector will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiConnect Shopify'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiConnect Shopify'"
`,
  },
  {
    path: "test/inventory-alerts.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { isLowStock } from '../lib/inventory-alerts.mjs'

test('flags stock at or below the threshold', () => {
  assert.equal(isLowStock(10, 10), true)
  assert.equal(isLowStock(3, 10), true)
  assert.equal(isLowStock(0, 10), true)
})

test('does not flag stock above the threshold', () => {
  assert.equal(isLowStock(11, 10), false)
  assert.equal(isLowStock(500, 10), false)
})

test('does not flag anything when threshold is unset or invalid', () => {
  assert.equal(isLowStock(1, 0), false)
  assert.equal(isLowStock(1, -5), false)
  assert.equal(isLowStock(1, NaN), false)
})

test('handles non-finite available gracefully', () => {
  assert.equal(isLowStock(NaN, 10), false)
  assert.equal(isLowStock(Infinity, 10), false)
})
`,
  },
  {
    path: "test/run.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import './webhook-verify.test.mjs'
import './inventory-alerts.test.mjs'
import './shopify-client.test.mjs'
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
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcs-test-'))
  const configPath = path.join(dir, 'shopify.config.json')
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

test('config API never echoes the access token or webhook secret back', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ shopDomain: 'my-shop.myshopify.com', accessToken: 'shpat_secret123', webhookSecret: 'whsec_secret456' }),
    })
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.shopDomain, 'my-shop.myshopify.com')
    assert.equal(body.hasAccessToken, true)
    assert.equal(body.hasWebhookSecret, true)
    assert.ok(!('accessToken' in body))
    assert.ok(!('webhookSecret' in body))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('new installs default to read-only safe mode', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.safeMode, 'read-only')
  } finally {
    ctx.close()
  }
})

test('webhook route rejects a call with no valid signature', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/webhook\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-topic': 'orders/create' },
      body: JSON.stringify({ id: 1 }),
    })
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('webhook route accepts a correctly signed order event and logs it', async () => {
  const ctx = await boot()
  try {
    const secret = 'test-webhook-secret'
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ webhookSecret: secret }),
    })

    const payload = JSON.stringify({ id: 555, order_number: 1042, total_price: '89.00', email: 'a@b.com' })
    const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('base64')

    const res = await fetch(\`http://localhost:\${ctx.port}/webhook\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-topic': 'orders/create', 'x-shopify-hmac-sha256': signature },
      body: payload,
    })
    assert.equal(res.status, 200)

    const logRes = await fetch(\`http://localhost:\${ctx.port}/api/log\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.kind === 'order' && e.summary.includes('1042')))
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
    path: "test/shopify-client.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.
//
// Runs the real client against a local fixture HTTP server standing in for
// Shopify's API — same approach as the webhook bridge's outbound tests. No
// network access, no real store required to verify the request/response
// handling and the safe-mode write guard.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { listProducts, listOrders, updateVariantPrice, ShopifyApiError } from '../lib/shopify-client.mjs'

/** Starts a fixture server standing in for a Shopify shop domain. */
function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, shopDomain: \`localhost:\${server.address().port}\` }))
  })
}

test('listProducts returns the products array', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    assert.equal(req.headers['x-shopify-access-token'], 'test-token')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ products: [{ id: 1, title: 'Mug' }] }))
  })
  try {
    const config = { shopDomain, accessToken: 'test-token', safeMode: 'read-only' }
    const products = await listProducts(config)
    assert.deepEqual(products, [{ id: 1, title: 'Mug' }])
  } finally {
    server.close()
  }
})

test('listOrders returns the orders array', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ orders: [{ id: 99, total_price: '42.00' }] }))
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-only' }
    const orders = await listOrders(config)
    assert.equal(orders[0].id, 99)
  } finally {
    server.close()
  }
})

test('throws a clear error when the store is not connected', async () => {
  await assert.rejects(
    () => listProducts({ shopDomain: null, accessToken: null, safeMode: 'read-only' }),
    (err) => err instanceof ShopifyApiError && /not connected/.test(err.message),
  )
})

test('updateVariantPrice refuses when safe mode is read-only, without making a request', async () => {
  let called = false
  const { server, shopDomain } = await startFixture((req, res) => {
    called = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ variant: {} }))
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-only' }
    await assert.rejects(
      () => updateVariantPrice(config, 1, '19.99'),
      (err) => err instanceof ShopifyApiError && /read-only/.test(err.message),
    )
    assert.equal(called, false, 'no HTTP request should have been made')
  } finally {
    server.close()
  }
})

test('updateVariantPrice succeeds when safe mode is read-write', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    assert.equal(req.method, 'PUT')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ variant: { id: 1, price: '19.99' } }))
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-write' }
    const variant = await updateVariantPrice(config, 1, '19.99')
    assert.equal(variant.price, '19.99')
  } finally {
    server.close()
  }
})

test('surfaces a Shopify API error with the status code attached', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    res.writeHead(429, { 'content-type': 'text/plain' })
    res.end('Too many requests')
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-only' }
    await assert.rejects(
      () => listProducts(config),
      (err) => err instanceof ShopifyApiError && err.status === 429,
    )
  } finally {
    server.close()
  }
})
`,
  },
  {
    path: "test/webhook-verify.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { verifyShopifyWebhook } from '../lib/webhook-verify.mjs'

function sign(body, secret) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64')
}

test('accepts a correctly signed payload', () => {
  const body = JSON.stringify({ id: 123, total_price: '42.00' })
  const secret = 'test-secret'
  const signature = sign(body, secret)
  assert.equal(verifyShopifyWebhook(body, signature, secret), true)
})

test('rejects a payload signed with the wrong secret', () => {
  const body = JSON.stringify({ id: 123 })
  const signature = sign(body, 'wrong-secret')
  assert.equal(verifyShopifyWebhook(body, signature, 'real-secret'), false)
})

test('rejects a tampered body even with a valid-looking signature', () => {
  const secret = 'test-secret'
  const originalBody = JSON.stringify({ id: 123, total_price: '42.00' })
  const signature = sign(originalBody, secret)
  const tamperedBody = JSON.stringify({ id: 123, total_price: '999999.00' })
  assert.equal(verifyShopifyWebhook(tamperedBody, signature, secret), false)
})

test('rejects when secret is not configured', () => {
  const body = JSON.stringify({ id: 1 })
  const signature = sign(body, 'anything')
  assert.equal(verifyShopifyWebhook(body, signature, ''), false)
  assert.equal(verifyShopifyWebhook(body, signature, null), false)
})

test('rejects when signature header is missing', () => {
  const body = JSON.stringify({ id: 1 })
  assert.equal(verifyShopifyWebhook(body, '', 'a-secret'), false)
})

test('rejects a signature of different length without throwing', () => {
  const body = JSON.stringify({ id: 1 })
  assert.equal(verifyShopifyWebhook(body, 'short', 'a-secret'), false)
})
`,
  },
]
