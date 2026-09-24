// search.js
// Loads a prebuilt index and answers a query by combining BM25 (keyword)
// and embedding (semantic) results.
//
// Combining strategy: Reciprocal Rank Fusion (RRF) rather than a raw
// weighted sum of scores. BM25 scores and cosine similarities live on
// different, non-comparable scales, and that mismatch is exactly what
// breaks naive "0.6*bm25 + 0.4*cosine" blends. RRF sidesteps this by only
// looking at each chunk's *rank* in each list, not its raw score:
//
//   RRF(chunk) = sum over each ranked list of  1 / (k + rank_in_that_list)
//
// A chunk that ranks well in either list (or both) rises to the top with no
// score-scale tuning required. k=60 is the standard constant from the
// original RRF paper (Cormack et al.) and works well without adjustment.

const fs = require('fs');
const { BM25Index } = require('./bm25');
const { embed, cosineSimilarity } = require('./embeddings');

const RRF_K = 60;

function loadIndex(indexPath) {
  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

function rrfCombine(rankedLists) {
  // rankedLists: array of arrays of chunk ids, each already sorted best-first
  const scores = new Map();
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      const contribution = 1 / (RRF_K + rank + 1);
      scores.set(id, (scores.get(id) || 0) + contribution);
    });
  }
  return scores;
}

/**
 * @param {string} indexPath
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<Array<{docPath: string, text: string, score: number}>>}
 */
async function search(indexPath, query, topK = 5) {
  const index = loadIndex(indexPath);
  if (!index.chunks || index.chunks.length === 0) return [];

  // --- BM25 ranking ---
  const bm25 = new BM25Index(index.bm25Params || {});
  bm25.addDocuments(index.chunks.map(c => ({ id: c.id, text: c.text })));
  const bm25Scores = bm25.score(query); // Map id -> raw score
  const bm25Ranked = [...bm25Scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // --- Semantic ranking ---
  const [queryVec] = await embed([query]);
  const semanticScored = index.chunks.map(c => ({
    id: c.id,
    sim: cosineSimilarity(queryVec, Float32Array.from(c.vector)),
  }));
  const semanticRanked = semanticScored
    .sort((a, b) => b.sim - a.sim)
    .map(c => c.id);

  // --- Combine via RRF ---
  const combined = rrfCombine([bm25Ranked, semanticRanked]);
  const chunkById = new Map(index.chunks.map(c => [c.id, c]));

  const results = [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, rrfScore]) => {
      const c = chunkById.get(id);
      return {
        docPath: c.docPath,
        text: c.text,
        rrfScore,
        bm25Rank: bm25Ranked.indexOf(id) + 1 || null,
        semanticRank: semanticRanked.indexOf(id) + 1,
      };
    });

  return results;
}

module.exports = { search, rrfCombine };
