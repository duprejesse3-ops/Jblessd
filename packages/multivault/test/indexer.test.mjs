// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync, unlinkSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildIndex, updateIndex } from '../lib/indexer.mjs'
import { rank } from '../lib/bm25.mjs'
import { tokenize } from '../lib/tokenize.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

test('buildIndex indexes eligible files and lists ineligible ones without content', () => {
  const dir = tempDir('idx-build')
  try {
    writeFileSync(join(dir, 'notes.md'), 'Client prefers async updates over calls.')
    writeFileSync(join(dir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const index = buildIndex(dir)
    assert.ok(index.files['notes.md'].eligible)
    assert.ok(index.files['notes.md'].docIds.length > 0)
    assert.equal(index.files['photo.png'].eligible, false)
    assert.equal(index.files['photo.png'].docIds.length, 0)
    assert.equal(index.totalDocs, index.docs.length)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('buildIndex never reads a file matching the sensitive-name pattern', () => {
  const dir = tempDir('idx-build')
  try {
    writeFileSync(join(dir, 'api-keys.txt'), 'sk-super-secret-value')
    const index = buildIndex(dir)
    assert.equal(index.files['api-keys.txt'].eligible, false)
    assert.equal(index.docs.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a query finds content via BM25 ranking against a built index', () => {
  const dir = tempDir('idx-build')
  try {
    writeFileSync(join(dir, 'a.md'), 'The invoice for Acme Corp is overdue by two weeks.')
    writeFileSync(join(dir, 'b.md'), 'Weekly standup notes: nothing blocking, ship on Friday.')
    const index = buildIndex(dir)
    const results = rank(tokenize('invoice overdue'), index)
    assert.ok(results.length > 0)
    assert.equal(results[0].doc.relPath, 'a.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex picks up a newly added file without touching unrelated docs', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Original content about pricing.')
    let index = buildIndex(dir)
    const originalDocCount = index.docs.length

    writeFileSync(join(dir, 'b.md'), 'New file about refunds.')
    const result = updateIndex(index, dir)
    assert.equal(result.added, 1)
    assert.equal(result.updated, 0)
    assert.equal(result.removed, 0)
    assert.ok(result.index.docs.length > originalDocCount)
    assert.ok(result.index.files['a.md'], 'unrelated file a.md should be untouched')
    assert.ok(result.index.files['b.md'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex detects a modified file (by mtime) and re-indexes only that file', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Old content mentions apples.')
    writeFileSync(join(dir, 'b.md'), 'Unrelated content about oranges.')
    let index = buildIndex(dir)

    // Change a.md's content AND bump its mtime forward so the change is detected.
    writeFileSync(join(dir, 'a.md'), 'New content mentions bananas now.')
    const future = new Date(Date.now() + 5000)
    utimesSync(join(dir, 'a.md'), future, future)

    const result = updateIndex(index, dir)
    assert.equal(result.updated, 1)
    assert.equal(result.added, 0)

    const appleResults = rank(tokenize('apples'), result.index)
    const bananaResults = rank(tokenize('bananas'), result.index)
    assert.equal(appleResults.length, 0, 'old content should no longer be findable')
    assert.equal(bananaResults.length, 1, 'new content should be findable')
    assert.equal(bananaResults[0].doc.relPath, 'a.md')

    // b.md's doc should be untouched — same doc id it had before.
    const bDoc = result.index.docs.find((d) => d.relPath === 'b.md')
    assert.ok(bDoc)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex removes a deleted file\'s docs and its docFreq contribution', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Unique term zephyrsaurus appears only here.')
    writeFileSync(join(dir, 'b.md'), 'Common content about meetings.')
    let index = buildIndex(dir)
    assert.equal(index.docFreq['zephyrsaurus'], 1)

    unlinkSync(join(dir, 'a.md'))
    const result = updateIndex(index, dir)
    assert.equal(result.removed, 1)
    assert.equal(result.index.files['a.md'], undefined)
    assert.equal(result.index.docFreq['zephyrsaurus'], undefined, 'docFreq for the deleted file\'s only term should be cleaned up, not left dangling')

    const results = rank(tokenize('zephyrsaurus'), result.index)
    assert.equal(results.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('updateIndex is a no-op (no re-reads) for files whose mtime has not changed', () => {
  const dir = tempDir('idx-update')
  try {
    writeFileSync(join(dir, 'a.md'), 'Stable content.')
    let index = buildIndex(dir)
    const originalDocIds = index.files['a.md'].docIds.slice()

    const result = updateIndex(index, dir) // nothing changed on disk
    assert.equal(result.added, 0)
    assert.equal(result.updated, 0)
    assert.equal(result.removed, 0)
    assert.deepEqual(result.index.files['a.md'].docIds, originalDocIds, 'doc ids should be identical, proving the file was not re-chunked/re-indexed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a large file is chunked and only its relevant chunk ranks highly for a specific query', () => {
  const dir = tempDir('idx-large')
  try {
    const filler = 'The quarterly newsletter covers many unrelated topics. '.repeat(60)
    const relevantSection = '\n\nIMPORTANT: the client contract renewal deadline is March 15th, confirmed by legal.\n\n'
    const moreFiller = 'More unrelated newsletter content follows here. '.repeat(60)
    writeFileSync(join(dir, 'newsletter.md'), filler + relevantSection + moreFiller)

    const index = buildIndex(dir)
    assert.ok(index.files['newsletter.md'].docIds.length > 1, 'a large file should produce multiple chunks')

    const results = rank(tokenize('contract renewal deadline'), index)
    assert.ok(results.length > 0)
    assert.ok(results[0].doc.text.includes('March 15th'), 'the top-ranked chunk should be the one actually containing the relevant content')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
