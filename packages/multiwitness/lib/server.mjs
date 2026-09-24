// Copyright (c) 2026 [SELLER]. All rights reserved.
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
