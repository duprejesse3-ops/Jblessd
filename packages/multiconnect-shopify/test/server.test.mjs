// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcs-test-'))
  const configPath = path.join(dir, 'shopify.config.json')
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

test('config API never echoes the access token or webhook secret back', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ shopDomain: 'my-shop.myshopify.com', accessToken: 'shpat_secret123', webhookSecret: 'whsec_secret456' }),
    })
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.shopDomain, 'my-shop.myshopify.com')
    assert.equal(body.hasAccessToken, true)
    assert.equal(body.hasWebhookSecret, true)
    assert.ok(!('accessToken' in body))
    assert.ok(!('webhookSecret' in body))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('new installs default to read-only safe mode', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.safeMode, 'read-only')
  } finally {
    ctx.close()
  }
})

test('webhook route rejects a call with no valid signature', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-topic': 'orders/create' },
      body: JSON.stringify({ id: 1 }),
    })
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('webhook route accepts a correctly signed order event and logs it', async () => {
  const ctx = await boot()
  try {
    const secret = 'test-webhook-secret'
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ webhookSecret: secret }),
    })

    const payload = JSON.stringify({ id: 555, order_number: 1042, total_price: '89.00', email: 'a@b.com' })
    const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('base64')

    const res = await fetch(`http://localhost:${ctx.port}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-topic': 'orders/create', 'x-shopify-hmac-sha256': signature },
      body: payload,
    })
    assert.equal(res.status, 200)

    const logRes = await fetch(`http://localhost:${ctx.port}/api/log`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.kind === 'order' && e.summary.includes('1042')))
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
