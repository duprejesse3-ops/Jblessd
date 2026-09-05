// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { tokenize, termFrequencies } from '../lib/tokenize.mjs'
import { idf, scoreDoc, rank } from '../lib/bm25.mjs'

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

test('tokenize lowercases and splits on non-alphanumeric', () => {
  assert.deepEqual(tokenize('Client Prefers Async-Updates!'), ['client', 'prefers', 'async', 'updates'])
})

test('tokenize drops single-character tokens', () => {
  assert.deepEqual(tokenize('a b cc'), ['cc'])
})

test('tokenize handles empty/null input without throwing', () => {
  assert.deepEqual(tokenize(''), [])
  assert.deepEqual(tokenize(null), [])
  assert.deepEqual(tokenize(undefined), [])
})

test('termFrequencies counts correctly', () => {
  const result = termFrequencies('the cat sat on the mat')
  assert.deepEqual({ ...result }, { the: 2, cat: 1, sat: 1, on: 1, mat: 1 })
})

// ---------------------------------------------------------------------------
// BM25 — tested against known mathematical properties of the algorithm,
// not just "does it run"
// ---------------------------------------------------------------------------

test('idf: a term in every document scores a small positive number, not negative', () => {
  // The classic (unsmoothed) BM25 IDF formula goes negative here — this is
  // exactly the failure case the +1-smoothed variant exists to fix.
  const score = idf(10, 10)
  assert.ok(score > 0, `expected positive IDF, got ${score}`)
})

test('idf: a rare term scores higher than a common term', () => {
  const rare = idf(1000, 2)
  const common = idf(1000, 500)
  assert.ok(rare > common, 'a term in 2/1000 docs should outrank a term in 500/1000 docs')
})

test('idf: increases monotonically as a term gets rarer', () => {
  const scores = [900, 500, 100, 10, 1].map((df) => idf(1000, df))
  for (let i = 1; i < scores.length; i++) {
    assert.ok(scores[i] > scores[i - 1], `idf should strictly increase as document frequency drops`)
  }
})

test('scoreDoc: a document matching the query term outscores one that does not', () => {
  const corpus = { totalDocs: 2, avgDocLength: 5, docFreq: { async: 1 } }
  const matching = { tokens: { async: 1, updates: 1 }, length: 5 }
  const nonMatching = { tokens: { sync: 1, calls: 1 }, length: 5 }
  const queryTerms = ['async']
  assert.ok(scoreDoc(queryTerms, matching, corpus) > 0)
  assert.equal(scoreDoc(queryTerms, nonMatching, corpus), 0)
})

test('scoreDoc: higher term frequency scores higher (with diminishing returns)', () => {
  const corpus = { totalDocs: 3, avgDocLength: 10, docFreq: { budget: 3 } }
  const oneOccurrence = { tokens: { budget: 1 }, length: 10 }
  const fiveOccurrences = { tokens: { budget: 5 }, length: 10 }
  const tenOccurrences = { tokens: { budget: 10 }, length: 10 }
  const s1 = scoreDoc(['budget'], oneOccurrence, corpus)
  const s5 = scoreDoc(['budget'], fiveOccurrences, corpus)
  const s10 = scoreDoc(['budget'], tenOccurrences, corpus)
  assert.ok(s5 > s1, 'more occurrences should score higher')
  assert.ok(s10 > s5, 'more occurrences should score higher')
  // Diminishing returns: going from 5->10 occurrences should gain LESS than
  // going from 1->5 did, per unit — this is BM25's whole point vs. raw term
  // frequency, which would double-count a stuffed document linearly.
  const gain1to5 = s5 - s1
  const gain5to10 = s10 - s5
  assert.ok(gain5to10 < gain1to5, 'term-frequency saturation: later occurrences should matter less')
})

test('scoreDoc: a longer document with the same term density scores lower (length normalization)', () => {
  // Same term frequency, but the long doc is mostly OTHER content — BM25
  // should discount that relative to a short, focused document.
  const corpus = { totalDocs: 2, avgDocLength: 50, docFreq: { invoice: 2 } }
  const short = { tokens: { invoice: 3 }, length: 20 }
  const long = { tokens: { invoice: 3 }, length: 200 }
  assert.ok(scoreDoc(['invoice'], short, corpus) > scoreDoc(['invoice'], long, corpus))
})

test('scoreDoc: a query term absent from the whole corpus contributes zero, not an error', () => {
  const corpus = { totalDocs: 1, avgDocLength: 10, docFreq: { known: 1 } }
  const doc = { tokens: { known: 1 }, length: 10 }
  assert.equal(scoreDoc(['known', 'never-appears-anywhere'], doc, corpus), scoreDoc(['known'], doc, corpus))
})

test('rank: sorts descending by score and drops zero-score (irrelevant) docs', () => {
  const index = {
    totalDocs: 3,
    avgDocLength: 6,
    docFreq: { pricing: 2, refund: 1 },
    docs: [
      { id: 'a', tokens: { pricing: 1 }, length: 6 },
      { id: 'b', tokens: { pricing: 3, refund: 1 }, length: 6 },
      { id: 'c', tokens: { unrelated: 5 }, length: 6 }, // shares no term with the query
    ],
  }
  const results = rank(['pricing', 'refund'], index)
  assert.equal(results.length, 2, 'doc c shares no query term and should be dropped, not scored 0 and kept')
  assert.equal(results[0].doc.id, 'b', 'doc b matches both query terms and should rank first')
  assert.equal(results[1].doc.id, 'a')
})

test('rank: an exact, focused match beats a long document that only mentions the term once', () => {
  const index = {
    totalDocs: 2,
    avgDocLength: 100,
    docFreq: { deadline: 2 },
    docs: [
      { id: 'focused', tokens: { deadline: 4 }, length: 15 },
      { id: 'sprawling', tokens: { deadline: 1 }, length: 400 },
    ],
  }
  const results = rank(['deadline'], index)
  assert.equal(results[0].doc.id, 'focused')
})
