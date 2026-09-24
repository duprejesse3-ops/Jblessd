// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcw-test-'))
  const configPath = path.join(dir, 'witness.config.json')
  const logPath = path.join(dir, 'witness.log.jsonl')
  const { server, config } = createServer({ port: 0, configPath, logPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    dashboardToken: config.dashboardToken,
    ingestToken: config.ingestToken,
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

test('the two tokens are different from each other', async () => {
  const ctx = await boot()
  try {
    assert.notEqual(ctx.dashboardToken, ctx.ingestToken)
  } finally {
    ctx.close()
  }
})

test('ingesting an event requires the ingest token, not the dashboard token', async () => {
  const ctx = await boot()
  try {
    const withDashboardToken = await fetch(`http://localhost:${ctx.port}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.dashboardToken}` },
      body: JSON.stringify({ source: 'test', action: 'test-event' }),
    })
    assert.equal(withDashboardToken.status, 401)

    const withIngestToken = await fetch(`http://localhost:${ctx.port}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.ingestToken}` },
      body: JSON.stringify({ source: 'test', action: 'test-event' }),
    })
    assert.equal(withIngestToken.status, 201)
  } finally {
    ctx.close()
  }
})

test('reading entries requires the dashboard token, not the ingest token', async () => {
  const ctx = await boot()
  try {
    const withIngestToken = await fetch(`http://localhost:${ctx.port}/api/entries`, {
      headers: { authorization: `Bearer ${ctx.ingestToken}` },
    })
    assert.equal(withIngestToken.status, 401)

    const withDashboardToken = await fetch(`http://localhost:${ctx.port}/api/entries`, {
      headers: { authorization: `Bearer ${ctx.dashboardToken}` },
    })
    assert.equal(withDashboardToken.status, 200)
  } finally {
    ctx.close()
  }
})

test('running verify requires the dashboard token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/verify`, {
      headers: { authorization: `Bearer ${ctx.ingestToken}` },
    })
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('an ingested event shows up in the dashboard entries list and passes verification', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.ingestToken}` },
      body: JSON.stringify({ source: 'multiconnect-shopify', action: 'order.confirmation_drafted', detail: 'Order #4821' }),
    })
    const entriesRes = await fetch(`http://localhost:${ctx.port}/api/entries`, { headers: { authorization: `Bearer ${ctx.dashboardToken}` } })
    const { entries } = await entriesRes.json()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].source, 'multiconnect-shopify')

    const verifyRes = await fetch(`http://localhost:${ctx.port}/api/verify`, { headers: { authorization: `Bearer ${ctx.dashboardToken}` } })
    const verify = await verifyRes.json()
    assert.equal(verify.valid, true)
    assert.equal(verify.totalEntries, 1)
  } finally {
    ctx.close()
  }
})

test('config API exposes the ingest token (needed to configure other tools) but never the dashboard token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.dashboardToken}` } })
    const body = await res.json()
    assert.equal(body.ingestToken, ctx.ingestToken)
    assert.ok(!('dashboardToken' in body))
  } finally {
    ctx.close()
  }
})

test('ingest rejects an event missing source or action', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.ingestToken}` },
      body: JSON.stringify({ action: 'no-source' }),
    })
    assert.equal(res.status, 400)
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
