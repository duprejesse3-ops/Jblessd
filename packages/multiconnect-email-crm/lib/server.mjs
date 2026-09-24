// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole connector in one process: dashboard UI, a JSON API for config/
// contacts/queue/log, and an inbound-email webhook route for a provider
// like SendGrid Inbound Parse or Mailgun Routes to call with a parsed
// message. Runs on localhost — a tool that lives on the customer's own
// machine.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig, saveConfig } from './config.mjs'
import { enqueueDraft, listDrafts, approveDraft, rejectDraft, QueueError } from './queue.mjs'
import { listContacts, addContact, ContactsError } from './contacts.mjs'
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
 * @param {{ configPath?: string, queuePath?: string, contactsPath?: string, port?: number }} [opts]
 */
export function createServer(opts = {}) {
  let config = loadConfig(opts.configPath)
  if (opts.port) config.port = opts.port

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveStatic(res, 'index.html')
    if (req.method === 'GET' && url.pathname === '/app.js') return serveStatic(res, 'app.js')
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })

    // ---- inbound email webhook: called by an email-parsing provider, not
    // the dashboard, so it's gated by a shared secret in the URL rather
    // than the dashboard's bearer token. ----
    if (req.method === 'POST' && url.pathname === '/webhook/inbound-email') {
      if (url.searchParams.get('secret') !== config.inboundSecret) {
        return json(res, 401, { error: 'Invalid or missing secret.' })
      }
      const body = await readJsonBody(req).catch(() => null)
      if (!body) return json(res, 400, { error: 'Invalid JSON body.' })
      record({
        kind: 'inbound',
        summary: `Inbound email from ${body.from ?? 'unknown'}: "${(body.subject ?? '').slice(0, 60)}"`,
        detail: JSON.stringify(body).slice(0, 1000),
      })
      return json(res, 200, { received: true })
    }

    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404)
      return res.end('Not found')
    }

    if (!isAuthorized(req, config.authToken)) {
      return json(res, 401, { error: 'Unauthorized. Use the token shown when the connector started.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { authToken, smtp, ...safe } = config
      return json(res, 200, {
        ...safe,
        smtp: {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          fromAddress: smtp.fromAddress,
          fromName: smtp.fromName,
          hasPassword: Boolean(smtp.pass),
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      const body = await readJsonBody(req)
      if (body.safeMode === 'read-only' || body.safeMode === 'read-write') config.safeMode = body.safeMode
      if (Number.isFinite(Number(body.sendLimitPerHour))) config.sendLimitPerHour = Number(body.sendLimitPerHour)
      if (body.smtp) {
        config.smtp = {
          ...config.smtp,
          host: body.smtp.host || config.smtp.host,
          port: Number.isFinite(Number(body.smtp.port)) ? Number(body.smtp.port) : config.smtp.port,
          secure: typeof body.smtp.secure === 'boolean' ? body.smtp.secure : config.smtp.secure,
          user: body.smtp.user || config.smtp.user,
          pass: body.smtp.pass || config.smtp.pass,
          fromAddress: body.smtp.fromAddress || config.smtp.fromAddress,
          fromName: body.smtp.fromName ?? config.smtp.fromName,
        }
      }
      saveConfig(config, opts.configPath)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/contacts') {
      return json(res, 200, { contacts: listContacts(opts.contactsPath) })
    }
    if (req.method === 'POST' && url.pathname === '/api/contacts') {
      try {
        const body = await readJsonBody(req)
        const contact = addContact(config, body, opts.contactsPath)
        record({ kind: 'drafted', summary: `Added contact ${contact.email}`, detail: null })
        return json(res, 201, { contact })
      } catch (err) {
        return json(res, err instanceof ContactsError ? 400 : 500, { error: err.message })
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/drafts') {
      return json(res, 200, { drafts: listDrafts(opts.queuePath) })
    }
    if (req.method === 'POST' && url.pathname === '/api/drafts') {
      const body = await readJsonBody(req)
      if (!body.to || !body.subject) return json(res, 400, { error: 'A draft needs "to" and "subject" at minimum.' })
      const draft = enqueueDraft(body, opts.queuePath)
      record({ kind: 'drafted', summary: `Drafted email to ${draft.to}: "${draft.subject}"`, detail: null })
      return json(res, 201, { draft })
    }
    const approveMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/approve$/)
    if (req.method === 'POST' && approveMatch) {
      try {
        const draft = await approveDraft(config, approveMatch[1], { queuePath: opts.queuePath })
        record({ kind: 'sent', summary: `Sent email to ${draft.to}: "${draft.subject}"`, detail: null })
        return json(res, 200, { draft })
      } catch (err) {
        record({ kind: 'error', summary: err.message, detail: null })
        return json(res, err instanceof QueueError ? 400 : 502, { error: err.message })
      }
    }
    const rejectMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/reject$/)
    if (req.method === 'POST' && rejectMatch) {
      try {
        const draft = rejectDraft(rejectMatch[1], opts.queuePath)
        record({ kind: 'rejected', summary: `Rejected draft to ${draft.to}`, detail: null })
        return json(res, 200, { draft })
      } catch (err) {
        return json(res, 400, { error: err.message })
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
