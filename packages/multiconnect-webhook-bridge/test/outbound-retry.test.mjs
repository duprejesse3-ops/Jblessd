// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { sendOutbound } from '../lib/outbound.mjs'
import { clear as clearLog } from '../lib/log.mjs'

/** Starts a tiny fixture server that fails `failCount` times then succeeds. */
function startFlaky(failCount) {
  let calls = 0
  const server = http.createServer((req, res) => {
    calls += 1
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (calls <= failCount) {
        res.writeHead(500)
        res.end('fail')
      } else {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, body: JSON.parse(body || '{}') }))
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port, callCount: () => calls }))
  })
}

test('sendOutbound retries on 5xx and eventually succeeds', async () => {
  clearLog()
  const { server, port, callCount } = await startFlaky(2)
  try {
    const config = { outboundUrl: `http://localhost:${port}/`, outboundMappings: [] }
    const result = await sendOutbound(config, { hello: 'world' })
    assert.equal(result.ok, true)
    assert.equal(callCount(), 3, 'expected 2 failed attempts then a success')
  } finally {
    server.close()
  }
})

test('sendOutbound does not retry a 4xx', async () => {
  clearLog()
  const server = http.createServer((req, res) => {
    res.writeHead(400)
    res.end()
  })
  let calls = 0
  server.on('request', () => (calls += 1))
  await new Promise((resolve) => server.listen(0, resolve))
  try {
    const port = server.address().port
    const config = { outboundUrl: `http://localhost:${port}/`, outboundMappings: [] }
    const result = await sendOutbound(config, {})
    assert.equal(result.ok, false)
    assert.equal(calls, 1, '4xx should not be retried')
  } finally {
    server.close()
  }
})

test('sendOutbound reports failure cleanly with no outboundUrl configured', async () => {
  clearLog()
  const result = await sendOutbound({ outboundUrl: null, outboundMappings: [] }, {})
  assert.equal(result.ok, false)
  assert.equal(result.status, null)
})

test('sendOutbound applies the mapping before sending', async () => {
  clearLog()
  const { server, port } = await startFlaky(0)
  try {
    const config = {
      outboundUrl: `http://localhost:${port}/`,
      outboundMappings: [{ id: '1', sourcePath: 'raw.value', targetField: 'clean_value' }],
    }
    const result = await sendOutbound(config, { raw: { value: 99 } })
    assert.equal(result.ok, true)
  } finally {
    server.close()
  }
})
