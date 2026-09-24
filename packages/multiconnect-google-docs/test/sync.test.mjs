// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests mock only Google's HTTP endpoints — the one thing genuinely
// untestable without live credentials. Everything downstream of that (file
// writes, incremental skip logic, rename/delete cleanup, state persistence)
// runs against a real temp directory with real file I/O, so those parts are
// tested for real, not simulated.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listGoogleDocs, exportDocAsMarkdown } from '../lib/drive.mjs'
import { syncDocs } from '../lib/sync.mjs'
import { refreshAccessToken } from '../lib/auth.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

function installFetchMock(handler) {
  const original = globalThis.fetch
  globalThis.fetch = async (url, opts) => handler(String(url), opts)
  return () => {
    globalThis.fetch = original
  }
}

// ---------------------------------------------------------------------------
// drive.mjs — request construction and response parsing, against a mock
// ---------------------------------------------------------------------------

test('listGoogleDocs sends the correct query and parses the response', async () => {
  let capturedUrl
  const restore = installFetchMock(async (url) => {
    capturedUrl = url
    return {
      ok: true,
      json: async () => ({ files: [{ id: 'abc123', name: 'Northwind MSA', modifiedTime: '2026-03-01T00:00:00Z' }] }),
    }
  })
  try {
    const docs = await listGoogleDocs('fake-token', { folderId: 'folder-xyz' })
    assert.equal(docs.length, 1)
    assert.equal(docs[0].name, 'Northwind MSA')
    const decoded = decodeURIComponent(capturedUrl.replace(/\+/g, ' '))
    assert.ok(decoded.includes("mimeType='application/vnd.google-apps.document'"))
    assert.ok(decoded.includes("'folder-xyz' in parents"))
    assert.ok(decoded.includes('trashed=false'))
  } finally {
    restore()
  }
})

test('listGoogleDocs follows pagination and returns the complete list', async () => {
  let callCount = 0
  const restore = installFetchMock(async () => {
    callCount += 1
    if (callCount === 1) {
      return { ok: true, json: async () => ({ nextPageToken: 'page2', files: [{ id: '1', name: 'Doc One', modifiedTime: 't1' }] }) }
    }
    return { ok: true, json: async () => ({ files: [{ id: '2', name: 'Doc Two', modifiedTime: 't2' }] }) }
  })
  try {
    const docs = await listGoogleDocs('fake-token', {})
    assert.equal(docs.length, 2)
    assert.equal(callCount, 2)
  } finally {
    restore()
  }
})

test('listGoogleDocs surfaces a clear error on a non-OK response, not a silent empty list', async () => {
  const restore = installFetchMock(async () => ({ ok: false, status: 401, text: async () => 'Invalid Credentials' }))
  try {
    await assert.rejects(() => listGoogleDocs('bad-token', {}), /401/)
  } finally {
    restore()
  }
})

test('exportDocAsMarkdown requests the markdown mimeType and returns the body text', async () => {
  let capturedUrl
  const restore = installFetchMock(async (url) => {
    capturedUrl = url
    return { ok: true, text: async () => '# Northwind MSA\n\nAuto-renews 12 months...' }
  })
  try {
    const text = await exportDocAsMarkdown('fake-token', 'abc123')
    assert.ok(text.includes('Auto-renews'))
    assert.ok(capturedUrl.includes('/files/abc123/export'))
    assert.ok(capturedUrl.includes('mimeType=text%2Fmarkdown'))
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// auth.mjs — token refresh against a mock
// ---------------------------------------------------------------------------

test('refreshAccessToken exchanges a refresh token for an access token', async () => {
  const restore = installFetchMock(async () => ({ ok: true, json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }) }))
  try {
    const { accessToken, expiresAt } = await refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' })
    assert.equal(accessToken, 'fresh-token')
    assert.ok(expiresAt > Date.now())
  } finally {
    restore()
  }
})

test('refreshAccessToken gives an actionable error message on failure, not a raw fetch error', async () => {
  const restore = installFetchMock(async () => ({ ok: false, json: async () => ({ error: 'invalid_grant', error_description: 'Token has been revoked' }) }))
  try {
    await assert.rejects(() => refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'revoked' }), /revoked/)
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// sync.mjs — real file I/O and real incremental/state logic, mocked network
// ---------------------------------------------------------------------------

function mockGoogleApi({ docs, exports }) {
  return installFetchMock(async (url) => {
    if (url.includes('oauth2.googleapis.com/token')) {
      return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    }
    if (url.includes('/export')) {
      const id = url.match(/\/files\/([^/]+)\/export/)[1]
      return { ok: true, text: async () => exports[id] }
    }
    if (url.includes('/files')) {
      return { ok: true, json: async () => ({ files: docs }) }
    }
    throw new Error(`Unexpected mock fetch: ${url}`)
  })
}

test('syncDocs writes new docs as real .md files on disk', async () => {
  const dest = tempDir('sync-dest')
  const restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Client Notes', modifiedTime: '2026-03-01T00:00:00Z' }],
    exports: { d1: '# Client Notes\n\nPrefers async updates.' },
  })
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.exported, 1)
    const written = readFileSync(join(dest, 'Client Notes.md'), 'utf8')
    assert.ok(written.includes('Prefers async updates'))
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs skips re-exporting a doc whose modifiedTime has not changed', async () => {
  const dest = tempDir('sync-dest')
  const restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Stable Doc', modifiedTime: '2026-03-01T00:00:00Z' }],
    exports: { d1: 'version A' },
  })
  try {
    await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    const secondRun = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(secondRun.exported, 0)
    assert.equal(secondRun.unchanged, 1)
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs re-exports when modifiedTime changes, and the new content lands on disk', async () => {
  const dest = tempDir('sync-dest')
  let restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Changing Doc', modifiedTime: '2026-03-01T00:00:00Z' }],
    exports: { d1: 'old content' },
  })
  await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
  restore()

  restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Changing Doc', modifiedTime: '2026-03-02T00:00:00Z' }],
    exports: { d1: 'new content' },
  })
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.exported, 1)
    assert.equal(readFileSync(join(dest, 'Changing Doc.md'), 'utf8'), 'new content')
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs cleans up the old filename when a doc is renamed in Drive', async () => {
  const dest = tempDir('sync-dest')
  let restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Old Name', modifiedTime: 't1' }],
    exports: { d1: 'content' },
  })
  await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
  restore()
  assert.ok(existsSync(join(dest, 'Old Name.md')))

  restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'New Name', modifiedTime: 't2' }],
    exports: { d1: 'content' },
  })
  try {
    await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(existsSync(join(dest, 'Old Name.md')), false, 'the stale filename should be removed, not left as a duplicate')
    assert.ok(existsSync(join(dest, 'New Name.md')))
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs removes the local file for a doc that no longer appears in Drive (deleted or moved out of scope)', async () => {
  const dest = tempDir('sync-dest')
  let restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Will Be Deleted', modifiedTime: 't1' }],
    exports: { d1: 'content' },
  })
  await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
  restore()
  assert.ok(existsSync(join(dest, 'Will Be Deleted.md')))

  restore = mockGoogleApi({ docs: [], exports: {} }) // doc no longer returned by Drive
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.removed, 1)
    assert.equal(existsSync(join(dest, 'Will Be Deleted.md')), false)
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs sanitizes unsafe filename characters from doc titles', async () => {
  const dest = tempDir('sync-dest')
  const restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Q3 Report: Revenue / Costs?', modifiedTime: 't1' }],
    exports: { d1: 'content' },
  })
  try {
    await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    const files = existsSync(join(dest, 'Q3 Report- Revenue - Costs-.md'))
    assert.ok(files, 'unsafe characters (: / ?) should be replaced, not cause a write failure')
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs continues past a single export failure and reports it, rather than aborting the whole run', async () => {
  const dest = tempDir('sync-dest')
  const restore = installFetchMock(async (url) => {
    if (url.includes('oauth2.googleapis.com/token')) return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    if (url.includes('/files/bad-doc/export')) return { ok: false, status: 403, text: async () => 'Export failed' }
    if (url.includes('/export')) return { ok: true, text: async () => 'fine content' }
    if (url.includes('/files')) {
      return {
        ok: true,
        json: async () => ({
          files: [
            { id: 'bad-doc', name: 'Broken Doc', modifiedTime: 't1' },
            { id: 'good-doc', name: 'Working Doc', modifiedTime: 't1' },
          ],
        }),
      }
    }
    throw new Error('unexpected')
  })
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.exported, 1, 'the working doc should still export despite the other one failing')
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0].name, 'Broken Doc')
    assert.ok(existsSync(join(dest, 'Working Doc.md')))
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})
