// Copyright (c) 2026 [SELLER]. All rights reserved.
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
        record({ platform: 'sheets', kind: 'read', summary: `Read ${rows.length} rows`, detail: null })
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
        record({ platform: 'airtable', kind: 'read', summary: `Read ${records.length} records`, detail: null })
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
