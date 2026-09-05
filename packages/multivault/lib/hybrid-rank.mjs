// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Combines lib/bm25.mjs's keyword ranking with lib/embeddings.mjs's local
// semantic similarity. Deliberately additive, not a replacement: bm25.mjs's
// rank() is called here exactly as it always was, and every existing test in
// test/bm25.test.mjs, test/indexer.test.mjs, test/query.test.mjs, and
// test/mcp.test.mjs keeps passing untouched — this file only adds a new,
// optional path.
//
// Combining strategy: Reciprocal Rank Fusion (RRF), not a weighted sum of
// raw scores. BM25 scores and cosine similarities live on incomparable
// scales (a BM25 score of 14 and a cosine similarity of 0.6 aren't the same
// kind of number), which is exactly what breaks a naive "0.6*bm25 +
// 0.4*cosine" blend — the mix ends up dominated by whichever score happens
// to have the larger numeric range, not whichever result is actually more
// relevant. RRF sidesteps the whole problem by looking only at each
// document's RANK in each list, never its raw score:
//
//   RRF(doc) = sum over each ranked list containing doc of  1 / (k + rank)
//
// A doc that ranks well in either list (or both) rises to the top with zero
// score-scale tuning. k=60 is the constant from the original RRF paper
// (Cormack, Clarke & Buettcher 2009) and is standard enough not to need
// per-corpus adjustment.
//
// Embeddings are computed once per chunk and cached on the doc itself
// (doc.vector, persisted in index.json by whichever caller calls saveIndex()
// afterward — see buildLiveContextHybrid in lib/vault.mjs) so a query never
// re-embeds content that hasn't changed. If the corpus's embeddings were
// computed under a different model id than embeddings.mjs currently reports
// (e.g. after an upgrade), they're treated as stale and recomputed — see
// ensureEmbeddings below.

import { rank } from './bm25.mjs'
import { tokenize } from './tokenize.mjs'
import { embedBatch as defaultEmbedBatch, cosineSimilarity as defaultCosineSimilarity, modelId as defaultModelId, EmbeddingsUnavailableError } from './embeddings.mjs'

const RRF_K = 60

/**
 * Make sure every doc in `index` has an up-to-date `.vector`. Mutates
 * `index.docs` in place and sets `index.embeddingModel`. Only embeds docs
 * that are missing a vector or were embedded under a different model — an
 * unchanged file's chunks (which keep their doc ids across queries; see
 * lib/index-store.mjs) are never re-embedded.
 *
 * @param {object} index
 * @param {{ embedBatch?: Function, modelId?: Function }} [deps] - injectable for tests
 * @returns {Promise<boolean>} true if the index now has usable vectors, false if embedding is unavailable
 */
export async function ensureEmbeddings(index, deps = {}) {
  const embedBatchFn = deps.embedBatch ?? defaultEmbedBatch
  const modelIdFn = deps.modelId ?? defaultModelId
  const currentModel = modelIdFn()

  const stale = index.docs.filter((doc) => !doc.vector || index.embeddingModel !== currentModel)
  if (stale.length === 0) return index.docs.length > 0 && index.embeddingModel === currentModel

  try {
    const vectors = await embedBatchFn(stale.map((doc) => doc.text))
    stale.forEach((doc, i) => {
      doc.vector = Array.from(vectors[i])
    })
    index.embeddingModel = currentModel
    return true
  } catch (err) {
    if (err instanceof EmbeddingsUnavailableError || err?.name === 'EmbeddingsUnavailableError') {
      return false // graceful degrade — caller falls back to BM25-only
    }
    throw err // an unexpected error (bad input, etc.) should surface, not be silently swallowed
  }
}

function rrfCombine(rankedIdLists) {
  const scores = new Map()
  for (const ids of rankedIdLists) {
    ids.forEach((id, rank0) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank0 + 1))
    })
  }
  return scores
}

/**
 * Rank `index`'s docs against `query` using BM25 + semantic similarity
 * combined via RRF, falling back to plain BM25 if the local embedding model
 * isn't available (first-run download failed, offline, etc.).
 *
 * @param {string} query
 * @param {object} index
 * @param {{ embedBatch?: Function, cosineSimilarity?: Function, modelId?: Function }} [deps] - injectable for tests
 * @returns {Promise<{ results: Array<{doc: object, score: number}>, usedSemantic: boolean }>}
 */
export async function hybridRank(query, index, deps = {}) {
  const queryTerms = tokenize(query)
  const bm25Results = rank(queryTerms, index) // [{doc, score}], unchanged behavior

  if (index.docs.length === 0) return { results: bm25Results, usedSemantic: false }

  const embeddingsReady = await ensureEmbeddings(index, deps)
  if (!embeddingsReady) return { results: bm25Results, usedSemantic: false }

  const embedBatchFn = deps.embedBatch ?? defaultEmbedBatch
  const cosineSimilarityFn = deps.cosineSimilarity ?? defaultCosineSimilarity

  let queryVector
  try {
    ;[queryVector] = await embedBatchFn([query])
  } catch (err) {
    if (err instanceof EmbeddingsUnavailableError || err?.name === 'EmbeddingsUnavailableError') {
      return { results: bm25Results, usedSemantic: false }
    }
    throw err
  }

  const semanticScored = index.docs
    .map((doc) => ({ doc, sim: cosineSimilarityFn(queryVector, Float32Array.from(doc.vector)) }))
    .sort((a, b) => b.sim - a.sim)

  const bm25RankedIds = bm25Results.map((r) => r.doc.id)
  const semanticRankedIds = semanticScored.map((r) => r.doc.id)
  const combined = rrfCombine([bm25RankedIds, semanticRankedIds])

  const bm25ScoreById = new Map(bm25Results.map((r) => [r.doc.id, r.score]))
  const docById = new Map(index.docs.map((d) => [d.id, d]))

  const results = [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({
      doc: docById.get(id),
      score, // RRF score — replaces the raw BM25 score for combined results, same {doc, score} shape formatSearchResults() already expects
      bm25Score: bm25ScoreById.get(id) ?? 0, // kept for callers/tests that want to show why a result ranked where it did
    }))

  return { results, usedSemantic: true }
}
