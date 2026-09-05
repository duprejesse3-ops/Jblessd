// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Okapi BM25 — the same ranking family real search engines (Elasticsearch,
// Lucene) use by default, implemented here in plain JS against MultiVault's
// own index (see lib/index-store.mjs) instead of pulling in a search
// library. This is genuinely the least trivial piece of this package: correct
// IDF weighting, correct length normalization, and correct incremental
// index maintenance are what separate "search that actually ranks well" from
// "grep with extra steps" — see test/bm25.test.mjs for the formula tests
// that pin this down.
//
// Standard parameters (k1=1.5, b=0.75) are Lucene/Elasticsearch's own
// defaults — deliberately not "tuned" for this corpus, since a corpus of
// one person's folder is too small and too idiosyncratic to responsibly
// tune against; these defaults are well-studied across a huge range of
// real corpora and are the sane, boring choice.

const K1 = 1.5
const B = 0.75

/**
 * Inverse document frequency, +1-smoothed (the modern/Lucene variant) so a
 * term appearing in every document scores a small positive IDF instead of
 * going negative, which the classic textbook formula can do.
 *
 * @param {number} totalDocs
 * @param {number} docsContainingTerm
 */
export function idf(totalDocs, docsContainingTerm) {
  return Math.log(1 + (totalDocs - docsContainingTerm + 0.5) / (docsContainingTerm + 0.5))
}

/**
 * BM25 score for one document against one already-tokenized query.
 *
 * @param {string[]} queryTerms
 * @param {{ tokens: Record<string, number>, length: number }} doc
 * @param {{ totalDocs: number, avgDocLength: number, docFreq: Record<string, number> }} corpus
 */
export function scoreDoc(queryTerms, doc, corpus) {
  let score = 0
  for (const term of queryTerms) {
    const docFreq = corpus.docFreq[term]
    if (!docFreq) continue // term never appears in the corpus — contributes nothing, not a penalty
    const tf = doc.tokens[term] ?? 0
    if (tf === 0) continue
    const termIdf = idf(corpus.totalDocs, docFreq)
    const lengthNorm = 1 - B + B * (doc.length / (corpus.avgDocLength || 1))
    score += termIdf * ((tf * (K1 + 1)) / (tf + K1 * lengthNorm))
  }
  return score
}

/**
 * Rank every doc in the index against a tokenized query, descending by
 * score, dropping zero-score docs (a doc that shares no term with the query
 * is not "slightly relevant", it's irrelevant — including it just pads the
 * result with noise).
 *
 * @param {string[]} queryTerms
 * @param {{ docs: Array<{tokens: Record<string, number>, length: number}> }} index
 * @returns {Array<{ doc: object, score: number }>}
 */
export function rank(queryTerms, index) {
  const corpus = { totalDocs: index.totalDocs, avgDocLength: index.avgDocLength, docFreq: index.docFreq }
  const scored = []
  for (const doc of index.docs) {
    const score = scoreDoc(queryTerms, doc, corpus)
    if (score > 0) scored.push({ doc, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored
}
