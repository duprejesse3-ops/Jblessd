// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { probeConnector, probeAll } from '../lib/probe.mjs'

/** Fixture standing in for a real MultiConnect connector's HTTP surface. */
function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, baseUrl: `http://localhost:${server.address().port}` })))
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(payload)
}

test('probeConnector reports reachable, safeMode, and recent entry count for a Shopify-like connector', async () => {
  const { server, baseUrl } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { safeMode: 'read-write', shopDomain: 'x.myshopify.com' })
    if (req.url.startsWith('/api/log')) return send(res, 200, { entries: [{ id: '1' }, { id: '2' }] })
    send(res, 404, {})
  })
  try {
    const result = await probeConnector({ id: '1', name: 'Shopify', baseUrl, token: 'tok' })
    assert.equal(result.reachable, true)
    assert.equal(result.safeMode, 'read-write')
    assert.equal(result.recentEntryCount, 2)
  } finally {
    server.close()
  }
})

test('probeConnector falls back to /api/entries when /api/log 404s (MultiWitness shape)', async () => {
  const { server, baseUrl } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { port: 8429 }) // no safeMode field at all
    if (req.url.startsWith('/api/log')) return send(res, 404, {})
    if (req.url.startsWith('/api/entries')) return send(res, 200, { entries: [{ id: '1' }] })
    send(res, 404, {})
  })
  try {
    const result = await probeConnector({ id: '1', name: 'MultiWitness', baseUrl, token: 'tok' })
    assert.equal(result.reachable, true)
    assert.equal(result.safeMode, null)
    assert.equal(result.recentEntryCount, 1)
  } finally {
    server.close()
  }
})

test('probeConnector reports unreachable for a connector that is not running', async () => {
  const result = await probeConnector({ id: '1', name: 'Offline', baseUrl: 'http://localhost:1', token: 'tok' })
  assert.equal(result.reachable, false)
  assert.equal(result.safeMode, null)
  assert.equal(result.recentEntryCount, 0)
})

test('probeConnector reports unreachable when the token is rejected (401)', async () => {
  const { server, baseUrl } = await startFixture((req, res) => send(res, 401, { error: 'bad token' }))
  try {
    const result = await probeConnector({ id: '1', name: 'x', baseUrl, token: 'wrong' })
    assert.equal(result.reachable, false)
  } finally {
    server.close()
  }
})

test('probeAll probes multiple connectors in parallel and preserves each result', async () => {
  const { server: s1, baseUrl: url1 } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { safeMode: 'read-only' })
    send(res, 200, { entries: [] })
  })
  const { server: s2, baseUrl: url2 } = await startFixture((req, res) => {
    if (req.url.startsWith('/api/config')) return send(res, 200, { safeMode: 'read-write' })
    send(res, 200, { entries: [] })
  })
  try {
    const results = await probeAll([
      { id: '1', name: 'One', baseUrl: url1, token: 't' },
      { id: '2', name: 'Two', baseUrl: url2, token: 't' },
    ])
    assert.equal(results.length, 2)
    assert.equal(results.find((r) => r.id === '1').safeMode, 'read-only')
    assert.equal(results.find((r) => r.id === '2').safeMode, 'read-write')
  } finally {
    s1.close()
    s2.close()
  }
})
