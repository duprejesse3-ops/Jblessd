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
  const dir = mkdtempSync(path.join(tmpdir(), 'mce-test-'))
  const configPath = path.join(dir, 'bridge.config.json')
  const queuePath = path.join(dir, 'email-queue.json')
  const contactsPath = path.join(dir, 'contacts.json')
  const { server, config } = createServer({ port: 0, configPath, queuePath, contactsPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    token: config.authToken,
    inboundSecret: config.inboundSecret,
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

test('new installs default to read-only safe mode', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.safeMode, 'read-only')
    assert.equal(body.sendLimitPerHour, 20)
  } finally {
    ctx.close()
  }
})

test('config API never echoes the SMTP password, only presence flag', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ smtp: { host: 'smtp.example.com', user: 'me', pass: 'SUPER_SECRET', fromAddress: 'me@example.com' } }),
    })
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.smtp.hasPassword, true)
    assert.ok(!JSON.stringify(body).includes('SUPER_SECRET'))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('drafting an email works via the API and appears in the queue', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/drafts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ to: 'lead@example.com', subject: 'Following up', text: 'Hi there' }),
    })
    assert.equal(res.status, 201)
    const { draft } = await res.json()
    assert.equal(draft.status, 'pending')

    const listRes = await fetch(`http://localhost:${ctx.port}/api/drafts`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { drafts } = await listRes.json()
    assert.equal(drafts.length, 1)
  } finally {
    ctx.close()
  }
})

test('approving a draft in read-only mode is rejected', async () => {
  const ctx = await boot()
  try {
    const draftRes = await fetch(`http://localhost:${ctx.port}/api/drafts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ to: 'lead@example.com', subject: 'Hi', text: 'Hi' }),
    })
    const { draft } = await draftRes.json()

    const approveRes = await fetch(`http://localhost:${ctx.port}/api/drafts/${draft.id}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${ctx.token}` },
    })
    assert.equal(approveRes.status, 400)
    const body = await approveRes.json()
    assert.match(body.error, /read-only/)
  } finally {
    ctx.close()
  }
})

test('adding a contact requires read-write mode', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/contacts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    })
    assert.equal(res.status, 400)
  } finally {
    ctx.close()
  }
})

test('inbound webhook requires the correct secret', async () => {
  const ctx = await boot()
  try {
    const badRes = await fetch(`http://localhost:${ctx.port}/webhook/inbound-email?secret=wrong`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'x@example.com', subject: 'Hi' }),
    })
    assert.equal(badRes.status, 401)

    const goodRes = await fetch(`http://localhost:${ctx.port}/webhook/inbound-email?secret=${ctx.inboundSecret}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'x@example.com', subject: 'Question about pricing' }),
    })
    assert.equal(goodRes.status, 200)

    const logRes = await fetch(`http://localhost:${ctx.port}/api/log`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.kind === 'inbound' && e.summary.includes('pricing')))
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
