// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests for the MultiWitness integration in isolation. Stands up a plain
// http.Server matching MultiWitness's real /api/events contract (POST,
// Bearer auth, 201 on success) rather than depending on MultiWitness's own
// source being present — that's a separate product, and this test suite
// must pass on its own for a buyer who only purchased MultiVault.
//
// The real cross-product integration (this code talking to an ACTUAL running
// MultiWitness server, with its real hash chain) was verified separately
// against MultiWitness's real source before shipping; this suite locks in
// the same request/response contract so a future change can't silently
// break that compatibility.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { logContextServed, witnessConfigured } from '../lib/witness-log.mjs'

function startFakeWitness({ expectedToken, status = 201 } = {}) {
  const received = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    const auth = req.headers.authorization
    if (expectedToken && auth !== `Bearer ${expectedToken}`) {
      res.writeHead(401)
      return res.end()
    }
    received.push(JSON.parse(body || '{}'))
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, received, port: server.address().port }))
  })
}

test('witnessConfigured reflects whether the ingest token env var is set', () => {
  const original = process.env.MULTIWITNESS_INGEST_TOKEN
  try {
    delete process.env.MULTIWITNESS_INGEST_TOKEN
    assert.equal(witnessConfigured(), false)
    process.env.MULTIWITNESS_INGEST_TOKEN = 'x'
    assert.equal(witnessConfigured(), true)
  } finally {
    if (original === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = original
  }
})

test('logContextServed returns false silently when no token is configured (never throws)', async () => {
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  delete process.env.MULTIWITNESS_INGEST_TOKEN
  try {
    const result = await logContextServed('some detail')
    assert.equal(result, false)
  } finally {
    if (originalToken !== undefined) process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})

test('logContextServed posts source/action/detail matching MultiWitness\'s real event contract', async () => {
  const { server, received, port } = await startFakeWitness({ expectedToken: 'tok123' })
  const originalUrl = process.env.MULTIWITNESS_URL
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  process.env.MULTIWITNESS_URL = `http://localhost:${port}`
  process.env.MULTIWITNESS_INGEST_TOKEN = 'tok123'
  try {
    const result = await logContextServed('2 file(s), 0 event(s) from /tmp/notes')
    assert.equal(result, true)
    assert.equal(received.length, 1)
    assert.equal(received[0].source, 'multivault')
    assert.equal(received[0].action, 'context.served')
    assert.equal(received[0].detail, '2 file(s), 0 event(s) from /tmp/notes')
  } finally {
    server.close()
    if (originalUrl === undefined) delete process.env.MULTIWITNESS_URL
    else process.env.MULTIWITNESS_URL = originalUrl
    if (originalToken === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})

test('logContextServed sends the token as a Bearer header and fails closed on a wrong one', async () => {
  const { server, received, port } = await startFakeWitness({ expectedToken: 'correct-token' })
  const originalUrl = process.env.MULTIWITNESS_URL
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  process.env.MULTIWITNESS_URL = `http://localhost:${port}`
  process.env.MULTIWITNESS_INGEST_TOKEN = 'wrong-token'
  try {
    const result = await logContextServed('detail')
    assert.equal(result, false) // 401 from the server -> res.ok is false -> we report false
    assert.equal(received.length, 0)
  } finally {
    server.close()
    if (originalUrl === undefined) delete process.env.MULTIWITNESS_URL
    else process.env.MULTIWITNESS_URL = originalUrl
    if (originalToken === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})

test('logContextServed never throws when the target is unreachable', async () => {
  const originalUrl = process.env.MULTIWITNESS_URL
  const originalToken = process.env.MULTIWITNESS_INGEST_TOKEN
  process.env.MULTIWITNESS_URL = 'http://localhost:1' // nothing listens on port 1
  process.env.MULTIWITNESS_INGEST_TOKEN = 'tok'
  try {
    const result = await logContextServed('detail')
    assert.equal(result, false)
  } finally {
    if (originalUrl === undefined) delete process.env.MULTIWITNESS_URL
    else process.env.MULTIWITNESS_URL = originalUrl
    if (originalToken === undefined) delete process.env.MULTIWITNESS_INGEST_TOKEN
    else process.env.MULTIWITNESS_INGEST_TOKEN = originalToken
  }
})
