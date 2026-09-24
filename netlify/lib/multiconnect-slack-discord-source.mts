// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiconnect-slack-discord/tools/embed-source.mjs
// from the real package source. Regenerate after changing the package:
//
//   node packages/multiconnect-slack-discord/tools/embed-source.mjs
//
// This is the payload for the MultiConnect: Slack/Discord product (SKU
// AI-CN-005): the complete, runnable source the buyer receives at
// checkout. It is embedded rather than read from disk so fulfilment cannot
// fail on a missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTICONNECT_SLACK_DISCORD_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiConnect: Slack/Discord

Bring your AI agent into the channels you already use.

Runs entirely on your own machine: a local dashboard for wiring up named
"routes" (channel destinations), posting agent-triggered updates and alerts
to Slack and/or Discord, and receiving slash commands from both — with a
safe-mode switch that keeps posts off until you turn them on.

## Install

Windows: \`.\\install.ps1\`
macOS / Linux: \`./install.sh\`

Either way, this starts the connector in the foreground and prints a
dashboard URL, a local auth token, and both webhook/interaction URLs.

## Setting up Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Under **Incoming Webhooks**, activate them and create one per channel
   you want to post to — each gives you a webhook URL to paste into a
   route in the dashboard.
3. Under **Basic Information**, copy the **Signing Secret** into the
   dashboard's Slack section.
4. If you want slash commands, add one under **Slash Commands** pointing
   at the "Slack request URL" the dashboard shows you.

## Setting up Discord

1. Create an application at the
   [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **General Information**, copy the **Public Key** into the
   dashboard's Discord section.
3. Under a server's **Integrations → Webhooks**, create one per channel —
   paste the URL into a route in the dashboard.
4. If you want slash commands, set **Interactions Endpoint URL** (under
   General Information) to the "Discord interactions" URL the dashboard
   shows you. Discord will send a verification ping the moment you save
   this — the connector answers it automatically as long as it's running.

## Routes

A route is a named destination. Give it a Slack webhook, a Discord
webhook, or both — posting to that route posts to whichever are set, so
one alert can reach both platforms at once.

## Safe mode

Every install starts **read-only**: incoming slash commands are received
and logged, but nothing posts. Switch to **read/write** to let posts
through \`POST /api/post\`. Every send checks this first and refuses
outright if it's not enabled.

## Development

\`\`\`
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step. Slack's HMAC
signing and Discord's Ed25519 signing are both implemented directly with
\`node:crypto\`.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiconnect-slack-discord — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines, workspaces, and servers as you like. Do not resell it as a product of
its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines and connect it to unlimited Slack workspaces and
  Discord servers you own or administer.
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

In particular: this software posts to Slack and Discord channels using webhook
URLs and verifies inbound requests using signing credentials you provide. You are
responsible for keeping your Slack signing secret, Discord public key, webhook
URLs, and local dashboard auth token private, and for reviewing safe-mode
settings before enabling read/write posting.

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
  "name": "multiconnect-slack-discord",
  "version": "1.0.0",
  "description": "Bring your AI agent into the channels you already use. Automated updates, alerts, and commands in Slack or Discord.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiconnect-messaging": "./bin/messaging-connect.mjs"
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
    "start": "node bin/messaging-connect.mjs start",
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
echo "Starting MultiConnect: Slack/Discord..."
echo ""
node "$DIR/bin/messaging-connect.mjs" start
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

Write-Host "Starting MultiConnect: Slack/Discord..."
Write-Host ""
node "$PSScriptRoot\\bin\\messaging-connect.mjs" start
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — Slack/Discord credentials, the
// named routes (channels) the agent can post to, and safe mode. No
// database: this file is the whole install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8427

/**
 * @typedef {{ id: string, name: string, slackWebhookUrl: string | null, discordWebhookUrl: string | null }} Route
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   safeMode: 'read-only' | 'read-write',
 *   slack: { enabled: boolean, signingSecret: string | null },
 *   discord: { enabled: boolean, publicKey: string | null },
 *   routes: Route[],
 *   createdAt: string
 * }} MessagingConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {MessagingConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    // Read-only by default: the agent can always be *told about* inbound
    // slash commands/mentions (that's just reading), but posting to a real
    // channel is a write and stays off until deliberately enabled.
    safeMode: 'read-only',
    slack: { enabled: false, signingSecret: null },
    discord: { enabled: false, publicKey: null },
    routes: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {MessagingConfig}
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
    slack: { ...base.slack, ...(parsed.slack ?? {}) },
    discord: { ...base.discord, ...(parsed.discord ?? {}) },
    routes: Array.isArray(parsed.routes) ? parsed.routes : base.routes,
  }
}

/**
 * @param {MessagingConfig} config
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
    path: "lib/discord-client.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two halves: posting to a Discord webhook (outbound), and verifying the
// Ed25519 signature Discord attaches to interaction requests — slash
// commands (inbound). Discord signs "{timestamp}{raw body}" with Ed25519
// and sends X-Signature-Ed25519 / X-Signature-Timestamp headers, verified
// against the app's public key. See
// https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization.

import { createPublicKey, verify as cryptoVerify } from 'node:crypto'

const REQUEST_TIMEOUT_MS = 10_000

export class DiscordApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'DiscordApiError'
    this.status = status
  }
}

/**
 * Post a message to a Discord webhook URL.
 * @param {string} webhookUrl
 * @param {string} content
 */
export async function postToDiscord(webhookUrl, content) {
  if (!webhookUrl) throw new DiscordApiError('No Discord webhook URL configured for this route.', 0)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    })
    if (!res.ok && res.status !== 204) {
      const body = await res.text().catch(() => '')
      throw new DiscordApiError(\`Discord webhook \${res.status}: \${body.slice(0, 300)}\`, res.status)
    }
    return { ok: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verify a Discord interaction request's Ed25519 signature.
 * @param {string} rawBody the exact, unparsed request body
 * @param {string} signatureHex the X-Signature-Ed25519 header (hex-encoded)
 * @param {string} timestampHeader the X-Signature-Timestamp header
 * @param {string} publicKeyHex the app's public key from the Discord dev portal (hex-encoded)
 */
export function verifyDiscordSignature(rawBody, signatureHex, timestampHeader, publicKeyHex) {
  if (!publicKeyHex || !signatureHex || !timestampHeader) return false
  try {
    const message = Buffer.from(timestampHeader + rawBody, 'utf8')
    const signature = Buffer.from(signatureHex, 'hex')
    // Node's Ed25519 keys are DER/PEM-wrapped; Discord gives a raw 32-byte
    // public key as hex, so it has to be wrapped in the standard SPKI
    // header for Ed25519 before node:crypto will accept it.
    const rawKey = Buffer.from(publicKeyHex, 'hex')
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const der = Buffer.concat([spkiPrefix, rawKey])
    const publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' })
    return cryptoVerify(null, message, publicKey, signature)
  } catch {
    return false
  }
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
 *   platform: 'slack' | 'discord' | 'system',
 *   kind: 'command' | 'posted' | 'error',
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
    path: "lib/routes.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A "route" is a named channel destination — the "route different events
// to different channels" feature. Each route can have a Slack webhook, a
// Discord webhook, or both; posting to a route posts to every webhook it
// has configured. This is the one module that actually gates writes behind
// safe mode, matching every other connector in this line.

import { randomUUID } from 'node:crypto'
import { postToSlack } from './slack-client.mjs'
import { postToDiscord } from './discord-client.mjs'
import { saveConfig } from './config.mjs'
import { record } from './log.mjs'

export class RouteError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RouteError'
  }
}

/**
 * @param {import('./config.mjs').MessagingConfig} config
 * @param {{ name: string, slackWebhookUrl?: string, discordWebhookUrl?: string }} input
 * @param {string} [configPath]
 * @returns {import('./config.mjs').Route}
 */
export function addRoute(config, input, configPath) {
  if (!input.name) throw new RouteError('A route needs a name.')
  if (!input.slackWebhookUrl && !input.discordWebhookUrl) {
    throw new RouteError('A route needs at least one webhook URL (Slack or Discord).')
  }
  /** @type {import('./config.mjs').Route} */
  const route = {
    id: randomUUID(),
    name: input.name,
    slackWebhookUrl: input.slackWebhookUrl || null,
    discordWebhookUrl: input.discordWebhookUrl || null,
  }
  config.routes.push(route)
  saveConfig(config, configPath)
  return route
}

/** @param {import('./config.mjs').MessagingConfig} config */
export function listRoutes(config) {
  return config.routes
}

/**
 * @param {import('./config.mjs').MessagingConfig} config
 * @param {string} routeId
 * @param {string} [configPath]
 */
export function removeRoute(config, routeId, configPath) {
  const before = config.routes.length
  config.routes = config.routes.filter((r) => r.id !== routeId)
  if (config.routes.length === before) throw new RouteError('No such route.')
  saveConfig(config, configPath)
}

/**
 * Post a message to a named route's configured webhook(s). Refuses outright
 * unless safe mode is read-write — this is the only place in the package
 * that sends a real message to a real channel.
 * @param {import('./config.mjs').MessagingConfig} config
 * @param {string} routeId
 * @param {string} message
 * @param {{ slackPost?: typeof postToSlack, discordPost?: typeof postToDiscord }} [opts]
 */
export async function postToRoute(config, routeId, message, opts = {}) {
  if (config.safeMode !== 'read-write') {
    throw new RouteError('Refused: safe mode is read-only. Switch to read-write in the dashboard to post messages.')
  }
  const route = config.routes.find((r) => r.id === routeId)
  if (!route) throw new RouteError('No such route.')

  const slackPost = opts.slackPost ?? postToSlack
  const discordPost = opts.discordPost ?? postToDiscord
  const results = { slack: null, discord: null }

  if (route.slackWebhookUrl) {
    results.slack = await slackPost(route.slackWebhookUrl, message)
    record({ platform: 'slack', kind: 'posted', summary: \`Posted to "\${route.name}"\`, detail: message.slice(0, 200) })
  }
  if (route.discordWebhookUrl) {
    results.discord = await discordPost(route.discordWebhookUrl, message)
    record({ platform: 'discord', kind: 'posted', summary: \`Posted to "\${route.name}"\`, detail: message.slice(0, 200) })
  }
  return results
}
`,
  },
  {
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole connector in one process: dashboard UI, a JSON API for config/
// routes/log, and two inbound receiver routes — one for Slack slash
// commands (HMAC-verified) and one for Discord interactions (Ed25519-
// verified, including the required PING handshake). Runs on localhost —
// a tool that lives on the customer's own machine.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig, saveConfig } from './config.mjs'
import { addRoute, listRoutes, removeRoute, postToRoute, RouteError } from './routes.mjs'
import { verifySlackSignature } from './slack-client.mjs'
import { verifyDiscordSignature } from './discord-client.mjs'
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

/** Reads the raw body as a string — needed unparsed for both signature schemes. */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 1_000_000) { reject(new Error('Payload too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseUrlEncoded(raw) {
  const params = new URLSearchParams(raw)
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, v] of params) out[k] = v
  return out
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

    // ---- Slack slash commands: HMAC-verified via headers, no bearer token ----
    if (req.method === 'POST' && url.pathname === '/webhook/slack') {
      const rawBody = await readRawBody(req)
      const timestamp = req.headers['x-slack-request-timestamp']
      const signature = req.headers['x-slack-signature']
      if (!verifySlackSignature(rawBody, /** @type {string} */ (timestamp ?? ''), /** @type {string} */ (signature ?? ''), config.slack.signingSecret ?? '')) {
        record({ platform: 'slack', kind: 'error', summary: 'Rejected unverified Slack request', detail: null })
        return json(res, 401, { error: 'Invalid signature.' })
      }
      const body = parseUrlEncoded(rawBody)
      record({ platform: 'slack', kind: 'command', summary: \`\${body.command ?? 'command'} from \${body.user_name ?? 'someone'}: \${body.text ?? ''}\`, detail: null })
      // Slack expects a fast, simple acknowledgement; the agent picks the
      // event up from the activity log rather than blocking this response.
      return json(res, 200, { response_type: 'ephemeral', text: 'Got it — your agent will follow up.' })
    }

    // ---- Discord interactions: Ed25519-verified, including the PING handshake ----
    if (req.method === 'POST' && url.pathname === '/webhook/discord') {
      const rawBody = await readRawBody(req)
      const signature = req.headers['x-signature-ed25519']
      const timestamp = req.headers['x-signature-timestamp']
      if (!verifyDiscordSignature(rawBody, /** @type {string} */ (signature ?? ''), /** @type {string} */ (timestamp ?? ''), config.discord.publicKey ?? '')) {
        record({ platform: 'discord', kind: 'error', summary: 'Rejected unverified Discord request', detail: null })
        res.writeHead(401)
        return res.end('invalid request signature')
      }
      let body
      try {
        body = JSON.parse(rawBody)
      } catch {
        return json(res, 400, { error: 'Invalid JSON body' })
      }
      // Discord's endpoint verification handshake: every interactions URL
      // must answer a PING (type 1) with a PONG (type 1) or Discord refuses
      // to save the URL in the developer portal.
      if (body.type === 1) return json(res, 200, { type: 1 })

      if (body.type === 2) {
        const name = body.data?.name ?? 'command'
        const user = body.member?.user?.username ?? body.user?.username ?? 'someone'
        record({ platform: 'discord', kind: 'command', summary: \`/\${name} from \${user}\`, detail: null })
        // Type 4 = respond immediately with a message.
        return json(res, 200, { type: 4, data: { content: 'Got it — your agent will follow up.' } })
      }

      return json(res, 200, { type: 1 })
    }

    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404)
      return res.end('Not found')
    }

    if (!isAuthorized(req, config.authToken)) {
      return json(res, 401, { error: 'Unauthorized. Use the token shown when the connector started.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { authToken, slack, discord, ...safe } = config
      return json(res, 200, {
        ...safe,
        slack: { enabled: slack.enabled, hasSigningSecret: Boolean(slack.signingSecret) },
        discord: { enabled: discord.enabled, hasPublicKey: Boolean(discord.publicKey) },
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      const body = await readRawBody(req).then((t) => JSON.parse(t || '{}'))
      if (body.safeMode === 'read-only' || body.safeMode === 'read-write') config.safeMode = body.safeMode
      if (body.slack) {
        config.slack = {
          enabled: Boolean(body.slack.enabled ?? config.slack.enabled),
          signingSecret: body.slack.signingSecret || config.slack.signingSecret,
        }
      }
      if (body.discord) {
        config.discord = {
          enabled: Boolean(body.discord.enabled ?? config.discord.enabled),
          publicKey: body.discord.publicKey || config.discord.publicKey,
        }
      }
      saveConfig(config, opts.configPath)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/routes') {
      return json(res, 200, { routes: listRoutes(config) })
    }
    if (req.method === 'POST' && url.pathname === '/api/routes') {
      try {
        const body = await readRawBody(req).then((t) => JSON.parse(t || '{}'))
        const route = addRoute(config, body, opts.configPath)
        return json(res, 201, { route })
      } catch (err) {
        return json(res, err instanceof RouteError ? 400 : 500, { error: err.message })
      }
    }
    const routeIdMatch = url.pathname.match(/^\\/api\\/routes\\/([^/]+)$/)
    if (req.method === 'DELETE' && routeIdMatch) {
      try {
        removeRoute(config, routeIdMatch[1], opts.configPath)
        return json(res, 200, { ok: true })
      } catch (err) {
        return json(res, err instanceof RouteError ? 404 : 500, { error: err.message })
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/post') {
      try {
        const body = await readRawBody(req).then((t) => JSON.parse(t || '{}'))
        if (!body.routeId || !body.message) return json(res, 400, { error: 'routeId and message are required.' })
        const result = await postToRoute(config, body.routeId, body.message)
        return json(res, 200, { result })
      } catch (err) {
        record({ platform: 'system', kind: 'error', summary: err.message, detail: null })
        return json(res, err instanceof RouteError ? 400 : 502, { error: err.message })
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
    path: "lib/slack-client.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two halves: posting to a Slack Incoming Webhook (outbound), and verifying
// the signature Slack attaches to slash-command/event requests (inbound).
// Slack's signing scheme: HMAC-SHA256 of "v0:{timestamp}:{raw body}" using
// the app's signing secret, compared against the X-Slack-Signature header.
// See https://api.slack.com/authentication/verifying-requests-from-slack.

import { createHmac, timingSafeEqual } from 'node:crypto'

const REQUEST_TIMEOUT_MS = 10_000
// Slack recommends rejecting anything older than 5 minutes, to block replay
// of a captured request.
const MAX_TIMESTAMP_SKEW_SEC = 60 * 5

export class SlackApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'SlackApiError'
    this.status = status
  }
}

/**
 * Post a message to a Slack Incoming Webhook URL.
 * @param {string} webhookUrl
 * @param {string} text
 */
export async function postToSlack(webhookUrl, text) {
  if (!webhookUrl) throw new SlackApiError('No Slack webhook URL configured for this route.', 0)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new SlackApiError(\`Slack webhook \${res.status}: \${body.slice(0, 300)}\`, res.status)
    }
    return { ok: true }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verify a Slack request signature.
 * @param {string} rawBody the exact, unparsed request body
 * @param {string} timestampHeader the X-Slack-Request-Timestamp header
 * @param {string} signatureHeader the X-Slack-Signature header
 * @param {string} signingSecret
 * @param {number} [now] unix seconds, injectable for tests
 */
export function verifySlackSignature(rawBody, timestampHeader, signatureHeader, signingSecret, now = Math.floor(Date.now() / 1000)) {
  if (!signingSecret || !timestampHeader || !signatureHeader) return false
  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_SKEW_SEC) return false

  const base = \`v0:\${timestampHeader}:\${rawBody}\`
  const computed = 'v0=' + createHmac('sha256', signingSecret).update(base, 'utf8').digest('hex')
  const a = Buffer.from(computed)
  const b = Buffer.from(signatureHeader)
  return a.length === b.length && timingSafeEqual(a, b)
}
`,
  },
  {
    path: "lib/ui/app.js",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mcd-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mcd-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mcd-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-safe').addEventListener('click', async () => {
  await api('/api/config', { method: 'POST', body: JSON.stringify({ safeMode: document.getElementById('safe-mode').value }) })
  await refreshConfig()
})

document.getElementById('save-slack').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({ slack: { enabled: true, signingSecret: document.getElementById('slack-secret').value.trim() } }),
  })
  document.getElementById('slack-secret').value = ''
  await refreshConfig()
})

document.getElementById('save-discord').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({ discord: { enabled: true, publicKey: document.getElementById('discord-key').value.trim() } }),
  })
  document.getElementById('discord-key').value = ''
  await refreshConfig()
})

document.getElementById('add-route').addEventListener('click', async () => {
  const name = document.getElementById('route-name').value.trim()
  const slackWebhookUrl = document.getElementById('route-slack').value.trim()
  const discordWebhookUrl = document.getElementById('route-discord').value.trim()
  const data = await api('/api/routes', { method: 'POST', body: JSON.stringify({ name, slackWebhookUrl, discordWebhookUrl }) })
  if (!data.error) {
    document.getElementById('route-name').value = ''
    document.getElementById('route-slack').value = ''
    document.getElementById('route-discord').value = ''
  }
  await refreshRoutes()
})

document.getElementById('send-test').addEventListener('click', async () => {
  const routeId = document.getElementById('test-route').value
  const message = document.getElementById('test-message').value.trim()
  const el = document.getElementById('test-result')
  if (!routeId || !message) { el.textContent = 'Pick a route and enter a message.'; return }
  const data = await api('/api/post', { method: 'POST', body: JSON.stringify({ routeId, message }) })
  el.textContent = data.error ? \`Error: \${data.error}\` : 'Sent.'
  await refreshLog()
})

async function refreshRoutes() {
  const { routes } = await api('/api/routes')
  const el = document.getElementById('routes')
  el.innerHTML = routes.length
    ? routes.map((r) => \`
      <div class="route">
        <strong>\${r.name}</strong>
        <div class="meta">\${r.slackWebhookUrl ? 'Slack ✓' : ''} \${r.discordWebhookUrl ? 'Discord ✓' : ''}</div>
        <button class="danger" data-remove="\${r.id}">Remove</button>
      </div>
    \`).join('')
    : '<p class="sub">No routes yet.</p>'
  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(\`/api/routes/\${btn.dataset.remove}\`, { method: 'DELETE' })
      await refreshRoutes()
    })
  })

  const select = document.getElementById('test-route')
  select.innerHTML = routes.map((r) => \`<option value="\${r.id}">\${r.name}</option>\`).join('')
}

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
  document.getElementById('slack-url').value = \`\${location.origin}/webhook/slack\`
  document.getElementById('discord-url').value = \`\${location.origin}/webhook/discord\`
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
  await refreshRoutes()
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
<title>MultiConnect: Slack/Discord</title>
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
  button{background:var(--brass);color:var(--ink);font-weight:600;font-size:13px;padding:8px 14px;border:none;border-radius:4px;cursor:pointer}
  button.ghost{background:transparent;color:var(--brass);border:1px solid var(--line)}
  button.danger{background:transparent;color:#ff786e;border:1px solid #5a2020}
  .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .safe-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
  .safe-badge.ro{background:#1a3d1a;color:#7cd67c}
  .safe-badge.rw{background:#3d1a1a;color:#ff9c9c}
  .route{border:1px solid var(--line);border-radius:4px;padding:10px;margin-bottom:8px;font-size:13px}
  .route .meta{color:var(--muted);font-size:11px}
  .log-entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .log-entry.error{color:#ff786e}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  #token-gate{text-align:center;padding-top:60px}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiConnect: Slack/Discord</h1>
    <p class="sub">Paste the token shown in your terminal when the connector started.</p>
    <input id="token-input" placeholder="local auth token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiConnect: Slack/Discord</h1>
  <p class="sub">Running locally · nothing posts until safe mode is read/write.</p>

  <section>
    <h2>Safe mode <span id="safe-badge" class="safe-badge ro">read-only</span></h2>
    <label for="safe-mode">Access level</label>
    <select id="safe-mode">
      <option value="read-only">Read-only — commands are received and logged, nothing posts</option>
      <option value="read-write">Read/write — agent-triggered posts actually send</option>
    </select>
    <button id="save-safe">Save</button>
  </section>

  <section>
    <h2>Slack</h2>
    <label for="slack-secret">Signing secret (from your Slack app's Basic Information page)</label>
    <input id="slack-secret" type="password"/>
    <label>Slash command / Events request URL</label>
    <input id="slack-url" readonly/>
    <button id="save-slack">Save</button>
  </section>

  <section>
    <h2>Discord</h2>
    <label for="discord-key">Public key (from your Discord app's General Information page)</label>
    <input id="discord-key" type="password"/>
    <label>Interactions endpoint URL</label>
    <input id="discord-url" readonly/>
    <button id="save-discord">Save</button>
  </section>

  <section>
    <h2>Routes</h2>
    <p class="sub">A named channel destination — set a Slack webhook, a Discord webhook, or both.</p>
    <div id="routes"></div>
    <label for="route-name">Route name</label>
    <input id="route-name" placeholder="e.g. ops-alerts"/>
    <label for="route-slack">Slack webhook URL (optional)</label>
    <input id="route-slack" placeholder="https://hooks.slack.com/services/..."/>
    <label for="route-discord">Discord webhook URL (optional)</label>
    <input id="route-discord" placeholder="https://discord.com/api/webhooks/..."/>
    <button id="add-route">Add route</button>
  </section>

  <section>
    <h2>Test post</h2>
    <label for="test-route">Route</label>
    <select id="test-route"></select>
    <label for="test-message">Message</label>
    <input id="test-message" placeholder="Test message from the dashboard"/>
    <button id="send-test">Send</button>
    <div id="test-result" class="sub"></div>
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
    path: "bin/messaging-connect.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`multiconnect-messaging — connect your AI agent to Slack and Discord

Usage
  multiconnect-messaging start [options]

Options
  --port <n>       Port to listen on (default: 8427)
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
    console.log('  MultiConnect: Slack/Discord is running.')
    console.log('')
    console.log(\`  Dashboard:  http://localhost:\${config.port}\`)
    console.log(\`  Token:      \${config.authToken}\`)
    console.log('')
    console.log(\`  Slack request URL:    http://localhost:\${config.port}/webhook/slack\`)
    console.log(\`  Discord interactions: http://localhost:\${config.port}/webhook/discord\`)
    console.log('')
    console.log('  Safe mode starts as read-only. Posts are logged but not sent until you')
    console.log('  switch to read-write in the dashboard.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiconnect-messaging: fatal —', err.message)
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
#   cp adapters/systemd.service ~/.config/systemd/user/multiconnect-messaging.service
#   systemctl --user enable --now multiconnect-messaging

[Unit]
Description=MultiConnect Slack/Discord
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/messaging-connect.mjs start
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
$binPath = Join-Path $packageRoot 'bin\\messaging-connect.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiConnect Slack Discord" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. The connector will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiConnect Slack Discord'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiConnect Slack Discord'"
`,
  },
  {
    path: "test/routes.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { addRoute, listRoutes, removeRoute, postToRoute, RouteError } from '../lib/routes.mjs'
import { loadConfig } from '../lib/config.mjs'

function tempConfig() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcd-routes-'))
  const configPath = path.join(dir, 'bridge.config.json')
  const config = loadConfig(configPath)
  return { config, configPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('addRoute requires a name and at least one webhook URL', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    assert.throws(() => addRoute(config, { slackWebhookUrl: 'https://x' }, configPath), RouteError)
    assert.throws(() => addRoute(config, { name: 'ops' }, configPath), RouteError)
  } finally {
    cleanup()
  }
})

test('addRoute succeeds and persists to disk', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops-alerts', slackWebhookUrl: 'https://hooks.slack.com/x' }, configPath)
    assert.equal(route.name, 'ops-alerts')
    assert.equal(listRoutes(config).length, 1)

    const reloaded = loadConfig(configPath)
    assert.equal(reloaded.routes.length, 1)
    assert.equal(reloaded.routes[0].name, 'ops-alerts')
  } finally {
    cleanup()
  }
})

test('removeRoute deletes an existing route and throws on an unknown one', () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops', slackWebhookUrl: 'https://x' }, configPath)
    removeRoute(config, route.id, configPath)
    assert.equal(listRoutes(config).length, 0)
    assert.throws(() => removeRoute(config, 'nonexistent', configPath), RouteError)
  } finally {
    cleanup()
  }
})

test('postToRoute refuses in read-only mode without calling either platform client', async () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops', slackWebhookUrl: 'https://x', discordWebhookUrl: 'https://y' }, configPath)
    config.safeMode = 'read-only'
    let called = false
    const slackPost = async () => { called = true; return { ok: true } }
    const discordPost = async () => { called = true; return { ok: true } }
    await assert.rejects(
      () => postToRoute(config, route.id, 'hello', { slackPost, discordPost }),
      (err) => err instanceof RouteError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
  } finally {
    cleanup()
  }
})

test('postToRoute posts to both platforms when both are configured, in read-write mode', async () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'ops', slackWebhookUrl: 'https://slack.x', discordWebhookUrl: 'https://discord.x' }, configPath)
    config.safeMode = 'read-write'
    const slackCalls = []
    const discordCalls = []
    const slackPost = async (url, text) => { slackCalls.push({ url, text }); return { ok: true } }
    const discordPost = async (url, content) => { discordCalls.push({ url, content }); return { ok: true } }

    const result = await postToRoute(config, route.id, 'Deploy finished', { slackPost, discordPost })
    assert.equal(slackCalls.length, 1)
    assert.equal(discordCalls.length, 1)
    assert.equal(slackCalls[0].text, 'Deploy finished')
    assert.equal(discordCalls[0].content, 'Deploy finished')
    assert.ok(result.slack.ok && result.discord.ok)
  } finally {
    cleanup()
  }
})

test('postToRoute only posts to the platform(s) actually configured on that route', async () => {
  const { config, configPath, cleanup } = tempConfig()
  try {
    const route = addRoute(config, { name: 'slack-only', slackWebhookUrl: 'https://slack.x' }, configPath)
    config.safeMode = 'read-write'
    let discordCalled = false
    const slackPost = async () => ({ ok: true })
    const discordPost = async () => { discordCalled = true; return { ok: true } }

    const result = await postToRoute(config, route.id, 'hi', { slackPost, discordPost })
    assert.equal(discordCalled, false)
    assert.equal(result.discord, null)
  } finally {
    cleanup()
  }
})

test('postToRoute throws for an unknown route id', async () => {
  const { config, cleanup } = tempConfig()
  try {
    config.safeMode = 'read-write'
    await assert.rejects(() => postToRoute(config, 'nonexistent', 'hi'), RouteError)
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

import './signatures.test.mjs'
import './routes.test.mjs'
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
import { createHmac, generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcd-test-'))
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

test('config API never echoes the signing secret or public key, only presence flags', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ slack: { enabled: true, signingSecret: 'SLACK_SECRET' }, discord: { enabled: true, publicKey: 'DISCORD_KEY' } }),
    })
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.slack.hasSigningSecret, true)
    assert.equal(body.discord.hasPublicKey, true)
    assert.ok(!JSON.stringify(body).includes('SLACK_SECRET'))
    assert.ok(!JSON.stringify(body).includes('DISCORD_KEY'))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('adding a route via the API and posting requires read-write safe mode', async () => {
  const ctx = await boot()
  try {
    const routeRes = await fetch(\`http://localhost:\${ctx.port}/api/routes\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ name: 'ops', slackWebhookUrl: 'https://hooks.slack.com/services/x' }),
    })
    assert.equal(routeRes.status, 201)
    const { route } = await routeRes.json()

    const postRes = await fetch(\`http://localhost:\${ctx.port}/api/post\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ routeId: route.id, message: 'hi' }),
    })
    // Read-only by default, and the fake Slack URL isn't reachable anyway —
    // either way this must not silently succeed.
    assert.equal(postRes.status, 400)
    const body = await postRes.json()
    assert.match(body.error, /read-only/)
  } finally {
    ctx.close()
  }
})

test('Slack webhook route rejects a request with no valid signature', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/webhook/slack\`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': '1700000000', 'x-slack-signature': 'v0=bad' },
      body: 'command=%2Fstatus',
    })
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('Slack webhook route accepts a correctly signed request and logs the command', async () => {
  const ctx = await boot()
  try {
    const secret = 'test-signing-secret'
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ slack: { signingSecret: secret } }),
    })

    const body = 'command=%2Fstatus&text=deploy&user_name=jesse'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = 'v0=' + createHmac('sha256', secret).update(\`v0:\${timestamp}:\${body}\`, 'utf8').digest('hex')

    const res = await fetch(\`http://localhost:\${ctx.port}/webhook/slack\`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
      body,
    })
    assert.equal(res.status, 200)

    const logRes = await fetch(\`http://localhost:\${ctx.port}/api/log\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.platform === 'slack' && e.kind === 'command' && e.summary.includes('jesse')))
  } finally {
    ctx.close()
  }
})

test('Discord interactions route answers the PING handshake correctly', async () => {
  const ctx = await boot()
  try {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex')
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ discord: { publicKey: publicKeyHex } }),
    })

    const timestamp = '1700000000'
    const body = JSON.stringify({ type: 1 })
    const signature = cryptoSign(null, Buffer.from(timestamp + body, 'utf8'), privateKey).toString('hex')

    const res = await fetch(\`http://localhost:\${ctx.port}/webhook/discord\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp },
      body,
    })
    assert.equal(res.status, 200)
    const responseBody = await res.json()
    assert.deepEqual(responseBody, { type: 1 })
  } finally {
    ctx.close()
  }
})

test('Discord interactions route rejects an unsigned request', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/webhook/discord\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 1 }),
    })
    assert.equal(res.status, 401)
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
    path: "test/signatures.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac, generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { verifySlackSignature } from '../lib/slack-client.mjs'
import { verifyDiscordSignature } from '../lib/discord-client.mjs'

// ---- Slack (HMAC-SHA256) ----

function slackSign(body, secret, timestamp) {
  const base = \`v0:\${timestamp}:\${body}\`
  return 'v0=' + createHmac('sha256', secret).update(base, 'utf8').digest('hex')
}

test('verifySlackSignature accepts a correctly signed request', () => {
  const now = 1_700_000_000
  const body = 'command=%2Fstatus&text=hello'
  const secret = 'slack-signing-secret'
  const signature = slackSign(body, secret, String(now))
  assert.equal(verifySlackSignature(body, String(now), signature, secret, now), true)
})

test('verifySlackSignature rejects a signature from the wrong secret', () => {
  const now = 1_700_000_000
  const body = 'command=%2Fstatus'
  const signature = slackSign(body, 'wrong-secret', String(now))
  assert.equal(verifySlackSignature(body, String(now), signature, 'real-secret', now), false)
})

test('verifySlackSignature rejects a tampered body', () => {
  const now = 1_700_000_000
  const secret = 'slack-signing-secret'
  const signature = slackSign('command=%2Fstatus', secret, String(now))
  assert.equal(verifySlackSignature('command=%2Fother', String(now), signature, secret, now), false)
})

test('verifySlackSignature rejects a request outside the timestamp window (replay protection)', () => {
  const originalTime = 1_700_000_000
  const secret = 'slack-signing-secret'
  const body = 'command=%2Fstatus'
  const signature = slackSign(body, secret, String(originalTime))
  const tenMinutesLater = originalTime + 600
  assert.equal(verifySlackSignature(body, String(originalTime), signature, secret, tenMinutesLater), false)
})

test('verifySlackSignature rejects when secret or headers are missing', () => {
  assert.equal(verifySlackSignature('body', '123', 'v0=abc', ''), false)
  assert.equal(verifySlackSignature('body', '', 'v0=abc', 'secret'), false)
  assert.equal(verifySlackSignature('body', '123', '', 'secret'), false)
})

// ---- Discord (Ed25519) ----

function discordKeypairHex() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex')
  return { privateKey, publicKeyHex }
}

function discordSign(privateKey, timestamp, body) {
  const message = Buffer.from(timestamp + body, 'utf8')
  return cryptoSign(null, message, privateKey).toString('hex')
}

test('verifyDiscordSignature accepts a correctly signed request', () => {
  const { privateKey, publicKeyHex } = discordKeypairHex()
  const timestamp = '1700000000'
  const body = JSON.stringify({ type: 1 })
  const signature = discordSign(privateKey, timestamp, body)
  assert.equal(verifyDiscordSignature(body, signature, timestamp, publicKeyHex), true)
})

test('verifyDiscordSignature rejects a signature from a different keypair', () => {
  const { privateKey } = discordKeypairHex()
  const { publicKeyHex: wrongPublicKey } = discordKeypairHex()
  const timestamp = '1700000000'
  const body = JSON.stringify({ type: 1 })
  const signature = discordSign(privateKey, timestamp, body)
  assert.equal(verifyDiscordSignature(body, signature, timestamp, wrongPublicKey), false)
})

test('verifyDiscordSignature rejects a tampered body', () => {
  const { privateKey, publicKeyHex } = discordKeypairHex()
  const timestamp = '1700000000'
  const signature = discordSign(privateKey, timestamp, JSON.stringify({ type: 1 }))
  assert.equal(verifyDiscordSignature(JSON.stringify({ type: 2 }), signature, timestamp, publicKeyHex), false)
})

test('verifyDiscordSignature rejects when a header or key is missing', () => {
  assert.equal(verifyDiscordSignature('body', '', '123', 'key'), false)
  assert.equal(verifyDiscordSignature('body', 'ab', '', 'key'), false)
  assert.equal(verifyDiscordSignature('body', 'ab', '123', ''), false)
})

test('verifyDiscordSignature never throws on malformed hex input', () => {
  assert.doesNotThrow(() => verifyDiscordSignature('body', 'not-hex!!', '123', 'also-not-hex'))
  assert.equal(verifyDiscordSignature('body', 'not-hex!!', '123', 'also-not-hex'), false)
})
`,
  },
]
