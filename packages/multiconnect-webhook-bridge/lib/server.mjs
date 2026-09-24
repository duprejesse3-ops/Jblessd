// Copyright (c) 2026 [SELLER]. All rights reserved.
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
