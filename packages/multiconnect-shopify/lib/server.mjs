// Copyright (c) 2026 [SELLER]. All rights reserved.
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
        record({ kind: 'error', summary: `Rejected unverified webhook (${topic})`, detail: null })
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
          summary: `New order #${payload.order_number ?? payload.id} — $${payload.total_price ?? '?'}`,
          detail: JSON.stringify({ id: payload.id, email: payload.email, total: payload.total_price }),
        })
      } else if (topic === 'inventory_levels/update') {
        const available = Number(payload.available)
        const threshold = config.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD
        if (isLowStock(available, threshold)) {
          record({
            kind: 'inventory',
            summary: `Low stock: item ${payload.inventory_item_id} at ${available} units (threshold ${threshold})`,
            detail: JSON.stringify(payload),
          })
        } else {
          record({ kind: 'inventory', summary: `Inventory updated: item ${payload.inventory_item_id} — ${available} units`, detail: null })
        }
      } else {
        record({ kind: 'sync', summary: `Received ${topic}`, detail: JSON.stringify(payload).slice(0, 500) })
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
          record({ kind: 'sync', summary: `Synced ${products.length} products`, detail: null })
          return json(res, 200, { products })
        } catch (err) {
          return json(res, err instanceof ShopifyApiError ? 502 : 500, { error: err.message })
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/orders') {
        try {
          const orders = await listOrders(config)
          record({ kind: 'sync', summary: `Synced ${orders.length} orders`, detail: null })
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
