// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Local semantic embeddings — the piece BM25 alone can't do. BM25 (see
// lib/bm25.mjs) ranks by shared vocabulary: query "churn risk" against a doc
// that only ever says "Northwind is wobbling" scores zero, because the two
// share no term. An embedding model recognizes the two are about the same
// thing even with no words in common. See lib/hybrid-rank.mjs for how the
// two signals get combined.
//
// Runs via @xenova/transformers, which executes the model in-process through
// ONNX Runtime — there is no API call at embedding time, no document text or
// query text is ever sent anywhere. This is the one honest exception to this
// package's "zero new dependencies" history (the other being
// @modelcontextprotocol/sdk for MCP mode — see lib/mcp-server.mjs's header):
// worth being upfront about in the README rather than pretending it isn't
// there.
//
// The model (Xenova/all-MiniLM-L6-v2, ~80MB) is fetched from Hugging Face
// and cached to disk the FIRST time embedding actually happens — normal for
// any app that ships a model rather than bundling multi-hundred-MB weights
// in the installer. Every call after that first one is fully offline. If
// that first fetch can't complete (no internet at that moment, a corporate
// firewall blocking huggingface.co, etc.), this module fails closed: it
// throws EmbeddingsUnavailableError and stays unavailable for the rest of
// the process rather than retrying on every single query. Callers (see
// hybridRank in lib/hybrid-rank.mjs) catch that and fall back to BM25-only
// ranking — semantic search is a bonus layer, never a hard requirement for
// MultiVault to keep working.

export class EmbeddingsUnavailableError extends Error {}

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

let pipelinePromise = null
let permanentlyUnavailable = false

async function getEmbedder() {
  if (permanentlyUnavailable) {
    throw new EmbeddingsUnavailableError('Local embedding model is unavailable for this process (failed once already).')
  }
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      try {
        const { pipeline } = await import('@xenova/transformers')
        return await pipeline('feature-extraction', MODEL_ID)
      } catch (err) {
        permanentlyUnavailable = true
        pipelinePromise = null
        throw new EmbeddingsUnavailableError(`Could not load local embedding model: ${err.message}`)
      }
    })()
  }
  return pipelinePromise
}

/**
 * Embed a batch of strings into L2-normalized vectors (384-dim for
 * all-MiniLM-L6-v2). Because vectors are normalized, cosineSimilarity()
 * below reduces to a plain dot product.
 *
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 * @throws {EmbeddingsUnavailableError} if the model can't be loaded
 */
export async function embedBatch(texts) {
  const embedder = await getEmbedder()
  const out = []
  for (const text of texts) {
    const result = await embedder(text, { pooling: 'mean', normalize: true })
    out.push(Float32Array.from(result.data))
  }
  return out
}

export function cosineSimilarity(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

export function modelId() {
  return MODEL_ID
}

/** Test/diagnostic hook: forget any cached load attempt so the next embedBatch() call retries from scratch. */
export function resetEmbedderForTests() {
  pipelinePromise = null
  permanentlyUnavailable = false
}
