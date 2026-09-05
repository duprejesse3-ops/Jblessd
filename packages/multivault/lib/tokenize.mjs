// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A deliberately simple tokenizer: lowercase, split on anything that isn't a
// letter/digit, drop tokens under 2 characters (mostly punctuation debris and
// single letters that add noise without adding signal), cap token length at
// 40 (guards against pathological input — a 10,000-character "word" from a
// minified file or a URL blob isn't a real search term). No stemming, no
// stopword list: deliberately, both are corpus-dependent tuning that would
// need real usage data to get right, and a wrong stopword list actively hurts
// (strips a term someone actually searches for). BM25's own math already
// down-weights common words via IDF — see lib/bm25.mjs.

const TOKEN_PATTERN = /[a-z0-9]+/g
const MIN_TOKEN_LENGTH = 2
const MAX_TOKEN_LENGTH = 40

/**
 * Tokenize a string into an array of lowercase terms.
 */
export function tokenize(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const matches = lower.match(TOKEN_PATTERN) ?? []
  return matches.filter((t) => t.length >= MIN_TOKEN_LENGTH && t.length <= MAX_TOKEN_LENGTH)
}

/**
 * Tokenize and count term frequencies in one pass — the shape the index and
 * BM25 scoring both actually want, so callers don't tokenize twice.
 * Returns a plain object: { term: count }.
 */
export function termFrequencies(text) {
  const freq = Object.create(null)
  for (const term of tokenize(text)) {
    freq[term] = (freq[term] ?? 0) + 1
  }
  return freq
}
