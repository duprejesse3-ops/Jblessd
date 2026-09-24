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
  const dir = mkdtempSync(path.join(tmpdir(), 'mcsa-test-'))
  const configPath = path.join(dir, 'bridge.config.json')
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

test('new installs default to read-only safe mode, both platforms disabled', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.safeMode, 'read-only')
    assert.equal(body.sheets.enabled, false)
    assert.equal(body.airtable.enabled, false)
  } finally {
    ctx.close()
  }
})

test('config API never echoes secrets back, only presence flags', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({
        sheets: { serviceAccountEmail: 'bot@x.iam.gserviceaccount.com', privateKey: 'SECRET_KEY_MATERIAL', spreadsheetId: 'sheet1' },
        airtable: { apiKey: 'pat_SECRET', baseId: 'appX', tableName: 'Leads' },
      }),
    })
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.sheets.hasServiceAccount, true)
    assert.equal(body.airtable.hasApiKey, true)
    assert.ok(!JSON.stringify(body).includes('SECRET'))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('mapping API saves read and write rules independently', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/mappings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ direction: 'read', rules: [{ id: '1', sourcePath: 'Name', targetField: 'full_name' }] }),
    })
    await fetch(`http://localhost:${ctx.port}/api/mappings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ direction: 'write', rules: [{ id: '1', sourcePath: 'email', targetField: 'Email' }] }),
    })
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.readMappings.length, 1)
    assert.equal(body.writeMappings.length, 1)
    assert.equal(body.readMappings[0].targetField, 'full_name')
    assert.equal(body.writeMappings[0].targetField, 'Email')
  } finally {
    ctx.close()
  }
})

test('mapping API rejects an unknown direction', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/mappings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ direction: 'sideways', rules: [] }),
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
