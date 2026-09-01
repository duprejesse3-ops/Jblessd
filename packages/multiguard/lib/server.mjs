// Copyright (c) 2026 [SELLER]. All rights reserved.
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
        record({ kind: 'registered', summary: `Registered "${connector.name}"`, detail: connector.baseUrl })
        const { token, ...safe } = connector
        return json(res, 201, { connector: safe })
      } catch (err) {
        return json(res, err instanceof RegistryError ? 400 : 500, { error: err.message })
      }
    }

    const removeMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)$/)
    if (req.method === 'DELETE' && removeMatch) {
      try {
        const connector = config.connectors.find((c) => c.id === removeMatch[1])
        removeConnector(config, removeMatch[1], opts.configPath)
        record({ kind: 'removed', summary: `Removed "${connector?.name ?? removeMatch[1]}"`, detail: null })
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
        summary: `Kill switch engaged — ${okCount}/${results.length} connectors switched to read-only`,
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
