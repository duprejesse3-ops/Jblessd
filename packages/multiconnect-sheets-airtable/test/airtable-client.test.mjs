// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { listRecords, createRecord, AirtableApiError } from '../lib/airtable-client.mjs'

function baseConfig(overrides = {}) {
  return {
    safeMode: 'read-only',
    airtable: { apiKey: 'pat_test', baseId: 'appTest', tableName: 'Leads' },
    ...overrides,
  }
}

function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, apiBase: `http://localhost:${server.address().port}` })))
}

test('listRecords returns the records array', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer pat_test')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ records: [{ id: 'rec1', fields: { Name: 'Ada' } }] }))
  })
  try {
    const records = await listRecords(baseConfig(), { apiBase })
    assert.deepEqual(records, [{ id: 'rec1', fields: { Name: 'Ada' } }])
  } finally {
    server.close()
  }
})

test('createRecord refuses when safe mode is read-only, without making a request', async () => {
  let called = false
  const { server, apiBase } = await startFixture((req, res) => {
    called = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  try {
    const config = baseConfig({ safeMode: 'read-only' })
    await assert.rejects(
      () => createRecord(config, { Name: 'Ada' }, { apiBase }),
      (err) => err instanceof AirtableApiError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
  } finally {
    server.close()
  }
})

test('createRecord succeeds when safe mode is read-write', async () => {
  let receivedBody
  const { server, apiBase } = await startFixture((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      receivedBody = JSON.parse(body)
      assert.equal(req.method, 'POST')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ id: 'rec2', fields: { Name: 'Grace' } }))
    })
  })
  try {
    const config = baseConfig({ safeMode: 'read-write' })
    const created = await createRecord(config, { Name: 'Grace' }, { apiBase })
    assert.deepEqual(receivedBody, { fields: { Name: 'Grace' } })
    assert.equal(created.id, 'rec2')
  } finally {
    server.close()
  }
})

test('throws a clear error when Airtable is not connected', async () => {
  const config = baseConfig({ airtable: { apiKey: null, baseId: null, tableName: null } })
  await assert.rejects(
    () => listRecords(config),
    (err) => err instanceof AirtableApiError && /not connected/.test(err.message),
  )
})

test('surfaces an Airtable API error with the status code attached', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    res.writeHead(422, { 'content-type': 'text/plain' })
    res.end('Unprocessable')
  })
  try {
    await assert.rejects(
      () => listRecords(baseConfig(), { apiBase }),
      (err) => err instanceof AirtableApiError && err.status === 422,
    )
  } finally {
    server.close()
  }
})
