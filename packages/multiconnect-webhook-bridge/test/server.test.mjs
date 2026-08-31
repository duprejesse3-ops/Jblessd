// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

/** Boots a real server on an ephemeral port against a throwaway config file. */
async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcb-test-'))
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

test('api routes accept the correct bearer token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, {
      headers: { authorization: `Bearer ${ctx.token}` },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.ok(!('authToken' in body), 'the config API must never echo the auth token back')
  } finally {
    ctx.close()
  }
})

test('inbound webhook accepts a POST with no auth and returns the mapped payload', async () => {
  const ctx = await boot()
  try {
    // Set an inbound mapping first so the response isn't trivially empty.
    await fetch(`http://localhost:${ctx.port}/api/mappings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ direction: 'inbound', rules: [{ id: '1', sourcePath: 'name', targetField: 'agent_name' }] }),
    })
    const res = await fetch(`http://localhost:${ctx.port}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.deepEqual(body.mapped, { agent_name: 'Ada' })
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
