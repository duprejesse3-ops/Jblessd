// chunker.js
// Splits a document's text into overlapping chunks. Chunking (not whole-doc)
// matters for both BM25 and embeddings: a doc mentioning "Northwind is
// wobbling" once in a 5,000-word file gets diluted if the whole doc is one
// vector. Smaller chunks keep the signal concentrated.

const DEFAULT_CHUNK_CHARS = 800;   // ~150-200 words, a reasonable semantic unit
const DEFAULT_OVERLAP_CHARS = 150; // keeps sentences that straddle a boundary searchable from either side

/**
 * Split raw text into paragraph-aware chunks with overlap.
 * @param {string} text
 * @param {object} opts
 * @returns {Array<{text: string, start: number, end: number}>}
 */
function chunkText(text, opts = {}) {
  const chunkChars = opts.chunkChars || DEFAULT_CHUNK_CHARS;
  const overlapChars = opts.overlapChars || DEFAULT_OVERLAP_CHARS;

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Split on paragraph breaks first so we don't cut mid-sentence when we can help it.
  const paragraphs = normalized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const chunks = [];
  let buffer = '';
  let bufferStart = 0;
  let cursor = 0;

  const flush = (endCursor) => {
    if (buffer.trim()) {
      chunks.push({ text: buffer.trim(), start: bufferStart, end: endCursor });
    }
  };

  for (const para of paragraphs) {
    const paraStart = normalized.indexOf(para, cursor);
    const effectiveStart = paraStart === -1 ? cursor : paraStart;

    if (buffer.length === 0) bufferStart = effectiveStart;

    if (buffer.length + para.length + 1 > chunkChars && buffer.length > 0) {
      flush(effectiveStart);
      // start next buffer with overlap tail of previous buffer
      const overlapTail = buffer.slice(Math.max(0, buffer.length - overlapChars));
      buffer = overlapTail + '\n\n' + para;
      bufferStart = effectiveStart - overlapTail.length;
    } else {
      buffer = buffer ? buffer + '\n\n' + para : para;
    }

    cursor = effectiveStart + para.length;

    // Hard-split paragraphs longer than chunkChars on their own
    while (buffer.length > chunkChars * 1.5) {
      const cut = buffer.slice(0, chunkChars);
      chunks.push({ text: cut.trim(), start: bufferStart, end: bufferStart + cut.length });
      const overlapTail = buffer.slice(Math.max(0, chunkChars - overlapChars), chunkChars);
      buffer = overlapTail + buffer.slice(chunkChars);
      bufferStart = bufferStart + chunkChars - overlapTail.length;
    }
  }
  flush(normalized.length);

  return chunks;
}

module.exports = { chunkText, DEFAULT_CHUNK_CHARS, DEFAULT_OVERLAP_CHARS };
