// embeddings.js
// Local, offline embedding generation. Uses @xenova/transformers, which runs
// models via ONNX Runtime entirely in-process — no network call at query
// time. The model weights (~80MB for all-MiniLM-L6-v2) are downloaded once
// from Hugging Face and cached to disk on first run; after that, everything
// is local. This is the one thing to flag honestly in "Honest limits" copy:
// first-run setup needs internet to fetch the model, same as installing any
// desktop app. No document content or query ever leaves the machine.

let pipelinePromise = null;

async function getEmbedder() {
  if (!pipelinePromise) {
    const { pipeline } = await import('@xenova/transformers');
    pipelinePromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return pipelinePromise;
}

/**
 * Embed a batch of strings. Returns array of Float32Array (384-dim, L2-normalized).
 */
async function embed(texts) {
  const embedder = await getEmbedder();
  const results = [];
  for (const text of texts) {
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    results.push(Float32Array.from(output.data));
  }
  return results;
}

function cosineSimilarity(a, b) {
  // Vectors from embed() are already L2-normalized, so dot product == cosine similarity.
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

module.exports = { embed, cosineSimilarity, getEmbedder };
