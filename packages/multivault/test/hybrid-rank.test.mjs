// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests hybridRank() and ensureEmbeddings() from lib/hybrid-rank.mjs against
// an INJECTED fake embedding function, never the real @xenova/transformers
// model — a real model download needs network access to Hugging Face, which
// CI/build environments can't always assume, and these tests should be fast
// and deterministic regardless. lib/hybrid-rank.mjs accepts embedBatch/
// cosineSimilarity/modelId as an optional `deps` argument for exactly this
// reason; production code (see buildLiveContextHybrid in lib/vault.mjs)
// simply omits `deps` and gets the real ones from lib/embeddings.mjs.
//
// The fake embedding groups words into hand-picked concept clusters instead
// of literal word overlap — standing in for what a real embedding model
// already knows (that "usage dropped, contact gone quiet" and "churn risk"
// are related concepts, without sharing a single word). A literal-overlap
// fake couldn't exercise the actual scenario this feature exists for.

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIndex } from '../lib/indexer.mjs'
import { rank } from '../lib/bm25.mjs'
import { tokenize } from '../lib/tokenize.mjs'
import { hybridRank, ensureEmbeddings } from '../lib/hybrid-rank.mjs'
import { EmbeddingsUnavailableError } from '../lib/embeddings.mjs'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

const FAKE_MODEL_ID = 'fake-test-model-v1'
const CONCEPT_GROUPS = [
  ['churn', 'risk', 'wobbling', 'dropped', 'quiet', 'flag'], // "customer at risk of leaving" concept
  ['invoice', 'overdue', 'renewal', 'paid', 'outstanding'], // "billing status" concept
  ['office', 'supplies', 'coffee', 'paper'], // unrelated concept, kept apart
]

function fakeVector(text) {
  const lower = text.toLowerCase()
  const v = CONCEPT_GROUPS.map((group) => group.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0))
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return Float32Array.from(v.map((x) => x / norm))
}

function fakeCosineSimilarity(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

const fakeDeps = {
  embedBatch: async (texts) => texts.map(fakeVector),
  cosineSimilarity: fakeCosineSimilarity,
  modelId: () => FAKE_MODEL_ID,
}

// ---------------------------------------------------------------------------
// ensureEmbeddings
// ---------------------------------------------------------------------------

test('ensureEmbeddings adds a vector to every doc and records the model id', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(join(dir, 'a.md'), 'Northwind is wobbling.')
    const index = buildIndex(dir)
    const ok = await ensureEmbeddings(index, fakeDeps)
    assert.equal(ok, true)
    assert.equal(index.embeddingModel, FAKE_MODEL_ID)
    for (const doc of index.docs) assert.ok(Array.isArray(doc.vector) && doc.vector.length > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ensureEmbeddings does not re-embed docs that already have a current vector (cache is respected)', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(join(dir, 'a.md'), 'Northwind is wobbling.')
    const index = buildIndex(dir)
    await ensureEmbeddings(index, fakeDeps)
    const cachedVector = index.docs[0].vector

    let embedCalls = 0
    const countingDeps = {
      ...fakeDeps,
      embedBatch: async (texts) => {
        embedCalls += 1
        return texts.map(fakeVector)
      },
    }
    await ensureEmbeddings(index, countingDeps)
    assert.equal(embedCalls, 0, 'no docs should have needed re-embedding')
    assert.deepEqual(index.docs[0].vector, cachedVector)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ensureEmbeddings recomputes vectors when the recorded model id no longer matches', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(join(dir, 'a.md'), 'Northwind is wobbling.')
    const index = buildIndex(dir)
    index.embeddingModel = 'some-old-model'
    index.docs[0].vector = [0, 0, 0]

    let embedCalls = 0
    const countingDeps = { ...fakeDeps, embedBatch: async (texts) => { embedCalls += 1; return texts.map(fakeVector) } }
    await ensureEmbeddings(index, countingDeps)
    assert.equal(embedCalls, 1, 'stale-model vectors should be recomputed')
    assert.equal(index.embeddingModel, FAKE_MODEL_ID)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ensureEmbeddings returns false (not a throw) when the embedder is unavailable', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(join(dir, 'a.md'), 'Northwind is wobbling.')
    const index = buildIndex(dir)
    const failingDeps = {
      embedBatch: async () => { throw new EmbeddingsUnavailableError('no internet for first-run model download') },
      modelId: () => FAKE_MODEL_ID,
    }
    const ok = await ensureEmbeddings(index, failingDeps)
    assert.equal(ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// hybridRank — the actual product scenario
// ---------------------------------------------------------------------------

test('hybridRank surfaces a paraphrased doc that shares no words with the query, which plain bm25 rank() cannot', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(
      join(dir, 'status-update.md'),
      'Quick note for the team.\n\nNorthwind is wobbling — usage dropped 40% and the contact has gone quiet.\n\nWe should flag this before the renewal call.',
    )
    writeFileSync(join(dir, 'invoices.md'), 'Invoice log.\n\nGlobex renewal invoice is outstanding, 12 days overdue.')
    writeFileSync(join(dir, 'unrelated.md'), 'Office supplies order.\n\nOrdered more printer paper and coffee.')

    const index = buildIndex(dir)

    // Sanity check: plain BM25 genuinely cannot find this — the whole point
    // of the feature. If this assertion ever fails, the fixture text below
    // needs adjusting, since the hybrid test downstream would no longer be
    // testing anything meaningful.
    const bm25Only = rank(tokenize('churn risk'), index)
    assert.equal(bm25Only.length, 0, 'fixture should share zero terms with "churn risk" for BM25')

    const { results, usedSemantic } = await hybridRank('churn risk', index, fakeDeps)
    assert.equal(usedSemantic, true)
    assert.ok(results.length > 0)
    assert.equal(results[0].doc.relPath, 'status-update.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hybridRank still ranks an exact keyword match first (BM25 signal is not lost inside the blend)', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(join(dir, 'status-update.md'), 'Northwind is wobbling — usage dropped and the contact has gone quiet.')
    writeFileSync(join(dir, 'invoices.md'), 'Invoice log.\n\nGlobex renewal invoice is outstanding, 12 days overdue.')
    writeFileSync(join(dir, 'unrelated.md'), 'Office supplies order.\n\nOrdered more printer paper and coffee.')

    const index = buildIndex(dir)
    const { results } = await hybridRank('invoice overdue Globex', index, fakeDeps)
    assert.equal(results[0].doc.relPath, 'invoices.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hybridRank falls back to plain BM25 results and reports usedSemantic: false when embeddings are unavailable', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    writeFileSync(join(dir, 'invoices.md'), 'Invoice log.\n\nGlobex renewal invoice is outstanding, 12 days overdue.')
    const index = buildIndex(dir)

    const bm25Only = rank(tokenize('invoice overdue'), index)
    const failingDeps = { embedBatch: async () => { throw new EmbeddingsUnavailableError('offline') }, modelId: () => FAKE_MODEL_ID }

    const { results, usedSemantic } = await hybridRank('invoice overdue', index, failingDeps)
    assert.equal(usedSemantic, false)
    assert.deepEqual(results, bm25Only)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hybridRank on an empty index returns no results and usedSemantic: false without calling the embedder', async () => {
  const dir = tempDir('mv-hybrid')
  try {
    const index = buildIndex(dir) // empty folder
    let called = false
    const trackingDeps = { ...fakeDeps, embedBatch: async (t) => { called = true; return fakeDeps.embedBatch(t) } }
    const { results, usedSemantic } = await hybridRank('anything', index, trackingDeps)
    assert.deepEqual(results, [])
    assert.equal(usedSemantic, false)
    assert.equal(called, false, 'no docs to embed — the embedder should never be invoked')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
