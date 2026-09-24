// Copyright (c) 2026 [SELLER]. All rights reserved.
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
      record({ platform: 'slack', kind: 'command', summary: `${body.command ?? 'command'} from ${body.user_name ?? 'someone'}: ${body.text ?? ''}`, detail: null })
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
        record({ platform: 'discord', kind: 'command', summary: `/${name} from ${user}`, detail: null })
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
    const routeIdMatch = url.pathname.match(/^\/api\/routes\/([^/]+)$/)
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
