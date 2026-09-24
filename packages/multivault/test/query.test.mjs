// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initVault, buildLiveContext, ensureIndex } from '../lib/vault.mjs'
import { loadIndex } from '../lib/index-store.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

test('buildLiveContext with no query behaves exactly like v1/v2 (whole-folder listing)', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Some content here.')
    initVault(vaultDest, { folder: watchedDir })
    const { text } = buildLiveContext(vaultDest)
    assert.ok(text.startsWith('# Context'), 'no-query path should still use the v1/v2 whole-folder format')
    assert.ok(text.includes('a.md'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('buildLiveContext with a query returns only relevant chunks, ranked', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'invoice.md'), 'Acme Corp invoice #4471 is overdue by 12 days.')
    writeFileSync(join(watchedDir, 'standup.md'), 'Daily standup: nothing blocking, on track for Friday.')
    initVault(vaultDest, { folder: watchedDir })

    const { text, snapshot } = buildLiveContext(vaultDest, { query: 'overdue invoice' })
    assert.ok(text.startsWith('# Search:'))
    assert.ok(text.includes('invoice.md'))
    assert.ok(!text.includes('standup.md'), 'irrelevant file should not appear in a targeted query result')
    assert.equal(snapshot.results[0].doc.relPath, 'invoice.md')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('a query automatically indexes on first call — no separate "vault index" step required', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'notes.md'), 'Project Phoenix launches in Q3.')
    initVault(vaultDest, { folder: watchedDir })
    // No explicit ensureIndex/vault-index call — buildLiveContext's query path should handle it.
    const { text } = buildLiveContext(vaultDest, { query: 'Phoenix launch' })
    assert.ok(text.includes('notes.md'))
    assert.ok(loadIndex(vaultDest), 'querying should have persisted an index to disk')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('a query picks up a file added after the vault was initialized (index updates incrementally)', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    buildLiveContext(vaultDest, { query: 'anything' }) // builds an initial (empty) index

    writeFileSync(join(watchedDir, 'late.md'), 'This file about zeppelins arrived after init.')
    const { text } = buildLiveContext(vaultDest, { query: 'zeppelins' })
    assert.ok(text.includes('late.md'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('a query with no matches returns a clear empty result, not an error', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Completely unrelated content.')
    initVault(vaultDest, { folder: watchedDir })
    const { text, snapshot } = buildLiveContext(vaultDest, { query: 'xyznonexistentterm' })
    assert.equal(snapshot.results.length, 0)
    assert.ok(text.includes('No matching content found'))
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('query respects topK to limit result count', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(watchedDir, `doc${i}.md`), `This document number ${i} discusses budgets extensively. Budget budget budget.`)
    }
    initVault(vaultDest, { folder: watchedDir })
    const { snapshot } = buildLiveContext(vaultDest, { query: 'budgets', topK: 2 })
    assert.equal(snapshot.results.length, 2)
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('ensureIndex persists to disk and a second call is a cheap incremental no-op when nothing changed', () => {
  const watchedDir = tempDir('q-watch')
  const vaultDest = tempDir('q-dest')
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'Stable content.')
    initVault(vaultDest, { folder: watchedDir })
    const first = ensureIndex(vaultDest, watchedDir)
    const firstDocIds = first.files['a.md'].docIds.slice()
    const second = ensureIndex(vaultDest, watchedDir)
    assert.deepEqual(second.files['a.md'].docIds, firstDocIds, 'unchanged file should keep the same doc ids across ensureIndex calls')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})
