// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac, generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcd-test-'))
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

test('config API never echoes the signing secret or public key, only presence flags', async () => {
  const ctx = await boot()
  try {
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ slack: { enabled: true, signingSecret: 'SLACK_SECRET' }, discord: { enabled: true, publicKey: 'DISCORD_KEY' } }),
    })
    const res = await fetch(`http://localhost:${ctx.port}/api/config`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const body = await res.json()
    assert.equal(body.slack.hasSigningSecret, true)
    assert.equal(body.discord.hasPublicKey, true)
    assert.ok(!JSON.stringify(body).includes('SLACK_SECRET'))
    assert.ok(!JSON.stringify(body).includes('DISCORD_KEY'))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('adding a route via the API and posting requires read-write safe mode', async () => {
  const ctx = await boot()
  try {
    const routeRes = await fetch(`http://localhost:${ctx.port}/api/routes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ name: 'ops', slackWebhookUrl: 'https://hooks.slack.com/services/x' }),
    })
    assert.equal(routeRes.status, 201)
    const { route } = await routeRes.json()

    const postRes = await fetch(`http://localhost:${ctx.port}/api/post`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ routeId: route.id, message: 'hi' }),
    })
    // Read-only by default, and the fake Slack URL isn't reachable anyway —
    // either way this must not silently succeed.
    assert.equal(postRes.status, 400)
    const body = await postRes.json()
    assert.match(body.error, /read-only/)
  } finally {
    ctx.close()
  }
})

test('Slack webhook route rejects a request with no valid signature', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/webhook/slack`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': '1700000000', 'x-slack-signature': 'v0=bad' },
      body: 'command=%2Fstatus',
    })
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('Slack webhook route accepts a correctly signed request and logs the command', async () => {
  const ctx = await boot()
  try {
    const secret = 'test-signing-secret'
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ slack: { signingSecret: secret } }),
    })

    const body = 'command=%2Fstatus&text=deploy&user_name=jesse'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${body}`, 'utf8').digest('hex')

    const res = await fetch(`http://localhost:${ctx.port}/webhook/slack`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature },
      body,
    })
    assert.equal(res.status, 200)

    const logRes = await fetch(`http://localhost:${ctx.port}/api/log`, { headers: { authorization: `Bearer ${ctx.token}` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.platform === 'slack' && e.kind === 'command' && e.summary.includes('jesse')))
  } finally {
    ctx.close()
  }
})

test('Discord interactions route answers the PING handshake correctly', async () => {
  const ctx = await boot()
  try {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex')
    await fetch(`http://localhost:${ctx.port}/api/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ discord: { publicKey: publicKeyHex } }),
    })

    const timestamp = '1700000000'
    const body = JSON.stringify({ type: 1 })
    const signature = cryptoSign(null, Buffer.from(timestamp + body, 'utf8'), privateKey).toString('hex')

    const res = await fetch(`http://localhost:${ctx.port}/webhook/discord`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp },
      body,
    })
    assert.equal(res.status, 200)
    const responseBody = await res.json()
    assert.deepEqual(responseBody, { type: 1 })
  } finally {
    ctx.close()
  }
})

test('Discord interactions route rejects an unsigned request', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(`http://localhost:${ctx.port}/webhook/discord`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 1 }),
    })
    assert.equal(res.status, 401)
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
