// bm25.js
// Minimal, dependency-free BM25 implementation over a set of chunks.
// This is MultiVault's existing search behavior — kept as-is so exact
// keyword/name matches ("Northwind", "Q3-forecast.xlsx") still win when
// they should. Hybrid search combines this with embeddings.js, it doesn't
// replace it.

const STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','of','to','in','on','for',
  'is','are','was','were','be','been','it','this','that','with','as','at',
  'by','from','into','about','over','after','before','so','than','too'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}

class BM25Index {
  constructor({ k1 = 1.5, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docs = [];        // [{id, tokens, termFreq: Map}]
    this.docFreq = new Map(); // term -> number of docs containing it
    this.avgDocLen = 0;
  }

  addDocuments(docs) {
    // docs: [{id, text}]
    for (const doc of docs) {
      const tokens = tokenize(doc.text);
      const termFreq = new Map();
      for (const t of tokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);
      this.docs.push({ id: doc.id, length: tokens.length, termFreq });
      for (const term of termFreq.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
      }
    }
    this.avgDocLen = this.docs.reduce((s, d) => s + d.length, 0) / (this.docs.length || 1);
  }

  idf(term) {
    const n = this.docs.length;
    const df = this.docFreq.get(term) || 0;
    // BM25 idf with +1 smoothing so unseen terms don't produce negative scores
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  // Returns raw BM25 scores keyed by doc id (not yet normalized 0-1)
  score(query) {
    const qTokens = tokenize(query);
    const scores = new Map();
    for (const doc of this.docs) {
      let score = 0;
      for (const term of qTokens) {
        const tf = doc.termFreq.get(term) || 0;
        if (tf === 0) continue;
        const idf = this.idf(term);
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgDocLen));
        score += idf * (numerator / denominator);
      }
      if (score > 0) scores.set(doc.id, score);
    }
    return scores;
  }
}

module.exports = { BM25Index, tokenize };
