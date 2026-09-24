// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { engageKillSwitch } from '../lib/killswitch.mjs'

function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, baseUrl: `http://localhost:${server.address().port}` })))
}

test('engageKillSwitch succeeds against a connector that accepts safeMode', async () => {
  let receivedBody
  const { server, baseUrl } = await startFixture((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      receivedBody = JSON.parse(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
    })
  })
  try {
    const results = await engageKillSwitch([{ id: '1', name: 'Shopify', baseUrl, token: 't' }])
    assert.equal(results[0].ok, true)
    assert.equal(receivedBody.safeMode, 'read-only')
  } finally {
    server.close()
  }
})

test('engageKillSwitch reports a 404 connector (no safeMode concept) as not-ok, without throwing', async () => {
  const { server, baseUrl } = await startFixture((req, res) => {
    res.writeHead(404)
    res.end()
  })
  try {
    const results = await engageKillSwitch([{ id: '1', name: 'MultiWitness', baseUrl, token: 't' }])
    assert.equal(results[0].ok, false)
    assert.match(results[0].message, /no safe-mode concept/)
  } finally {
    server.close()
  }
})

test('engageKillSwitch reports an offline connector as not-ok, without throwing', async () => {
  const results = await engageKillSwitch([{ id: '1', name: 'Offline', baseUrl: 'http://localhost:1', token: 't' }])
  assert.equal(results[0].ok, false)
  assert.match(results[0].message, /Unreachable/)
})

test('engageKillSwitch handles a mix of successes and failures across multiple connectors', async () => {
  const { server: good, baseUrl: goodUrl } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  const { server: bad, baseUrl: badUrl } = await startFixture((req, res) => {
    res.writeHead(500)
    res.end()
  })
  try {
    const results = await engageKillSwitch([
      { id: '1', name: 'Good', baseUrl: goodUrl, token: 't' },
      { id: '2', name: 'Bad', baseUrl: badUrl, token: 't' },
    ])
    assert.equal(results.find((r) => r.id === '1').ok, true)
    assert.equal(results.find((r) => r.id === '2').ok, false)
  } finally {
    good.close()
    bad.close()
  }
})

test('engageKillSwitch on an empty connector list returns an empty array', async () => {
  const results = await engageKillSwitch([])
  assert.deepEqual(results, [])
})
