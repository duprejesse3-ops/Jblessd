// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcg-test-'))
  const configPath = path.join(dir, 'guard.config.json')
  const { server, config } = createServer({ port: 0, configPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    token: config.dashboardToken,
    close: () => {
      server.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('healthz responds without auth', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/healthz`)
    assert.equal(res.status, 200)
  } finally {
    ctx.close()
  }
})

test('api routes reject requests without a valid token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/config`)
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('registering a connector never leaks the stored token back over the API', async () => {
  const ctx = await boot()
  try {
    const addRes = await fetch(`http://localhost:${ctx.port}/api/connectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ name: 'Shopify', baseUrl: 'http://localhost:8421', token: 'SUPER_SECRET_TOKEN' }),
    })
    assert.equal(addRes.status, 201)
    const { connector } = await addRes.json()
    assert.ok(!('token' in connector))

    const configRes = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const config = await configRes.json()
    assert.ok(!JSON.stringify(config).includes('SUPER_SECRET_TOKEN'))
    assert.equal(config.connectors[0].hasToken, true)
  } finally {
    ctx.close()
  }
})

test('status route probes a real fixture connector end to end', async () => {
  const fixture = http.createServer((req, res) => {
    if (req.url.startsWith('/api/config')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ safeMode: 'read-write' }))
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ entries: [{ id: '1' }] }))
  })
  await new Promise((resolve) => fixture.listen(0, resolve))
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/connectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ name: 'Fixture', baseUrl: `http://localhost:${fixture.address().port}`, token: 'fixture-token' }),
    })
    const statusRes = await fetch(`http://localhost:${ctx.port}/api/status`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { results } = await statusRes.json()
    assert.equal(results.length, 1)
    assert.equal(results[0].reachable, true)
    assert.equal(results[0].safeMode, 'read-write')
  } finally {
    ctx.close()
    fixture.close()
  }
})

test('kill switch route logs the outcome in the activity log', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/connectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ name: 'Offline', baseUrl: 'http://localhost:1', token: 't' }),
    })
    const killRes = await fetch(`http://localhost:${ctx.port}/api/kill-switch`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ctx.token}` },
    })
    assert.equal(killRes.status, 200)

    const logRes = await fetch(`http://localhost:${ctx.port}/api/log`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.kind === 'kill-switch'))
  } finally {
    ctx.close()
  }
})

test('removing a connector via the API works and is reflected in status', async () => {
  const ctx = await boot()
  try {
    const addRes = await fetch(`http://localhost:${ctx.port}/api/connectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ name: 'x', baseUrl: 'http://localhost:1', token: 't' }),
    })
    const { connector } = await addRes.json()

    const delRes = await fetch(`http://localhost:${ctx.port}/api/connectors/${connector.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${ctx.token}` },
    })
    assert.equal(delRes.status, 200)

    const statusRes = await fetch(`http://localhost:${ctx.port}/api/status`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { results } = await statusRes.json()
    assert.equal(results.length, 0)
  } finally {
    ctx.close()
  }
})

test('dashboard root serves HTML', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/html/)
  } finally {
    ctx.close()
  }
})
