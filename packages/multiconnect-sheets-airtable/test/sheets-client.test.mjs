// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { readRows, appendRow, SheetsApiError } from '../lib/sheets-client.mjs'

const FAKE_TOKEN_FN = async () => ({ accessToken: 'fake-token', expiresIn: 3600 })

function baseConfig(overrides = {}) {
  return {
    safeMode: 'read-only',
    sheets: {
      serviceAccountEmail: 'bot@x.iam.gserviceaccount.com',
      privateKey: 'irrelevant-because-tokenFn-is-stubbed',
      spreadsheetId: 'sheet123',
      sheetName: 'Sheet1',
    },
    ...overrides,
  }
}

function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => server.listen(0, () => resolve({ server, apiBase: `http://localhost:${server.address().port}` })))
}

test('readRows parses the header row and returns objects keyed by header', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ values: [['Name', 'Email'], ['Ada', 'ada@example.com'], ['Grace', 'grace@example.com']] }))
  })
  try {
    const { headers, rows } = await readRows(baseConfig(), { apiBase, tokenFn: FAKE_TOKEN_FN })
    assert.deepEqual(headers, ['Name', 'Email'])
    assert.deepEqual(rows, [{ Name: 'Ada', Email: 'ada@example.com' }, { Name: 'Grace', Email: 'grace@example.com' }])
  } finally {
    server.close()
  }
})

test('readRows returns empty when the sheet has no data', async () => {
  const { server, apiBase } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({}))
  })
  try {
    const { headers, rows } = await readRows(baseConfig(), { apiBase, tokenFn: FAKE_TOKEN_FN })
    assert.deepEqual(headers, [])
    assert.deepEqual(rows, [])
  } finally {
    server.close()
  }
})

test('appendRow refuses when safe mode is read-only, without making a request', async () => {
  let called = false
  const { server, apiBase } = await startFixture((req, res) => {
    called = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  try {
    const config = baseConfig({ safeMode: 'read-only' })
    await assert.rejects(
      () => appendRow(config, ['Name', 'Email'], { Name: 'Ada' }, { apiBase, tokenFn: FAKE_TOKEN_FN }),
      (err) => err instanceof SheetsApiError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
  } finally {
    server.close()
  }
})

test('appendRow succeeds when safe mode is read-write, ordering values by header', async () => {
  let receivedBody
  const { server, apiBase } = await startFixture((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      receivedBody = JSON.parse(body)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{}')
    })
  })
  try {
    const config = baseConfig({ safeMode: 'read-write' })
    await appendRow(config, ['Name', 'Email'], { Email: 'ada@example.com', Name: 'Ada' }, { apiBase, tokenFn: FAKE_TOKEN_FN })
    assert.deepEqual(receivedBody.values, [['Ada', 'ada@example.com']])
  } finally {
    server.close()
  }
})

test('throws a clear error when Sheets is not connected', async () => {
  const config = baseConfig({ sheets: { serviceAccountEmail: null, privateKey: null, spreadsheetId: null, sheetName: 'Sheet1' } })
  await assert.rejects(
    () => readRows(config, { tokenFn: FAKE_TOKEN_FN }),
    (err) => err instanceof SheetsApiError && /not connected/.test(err.message),
  )
})
