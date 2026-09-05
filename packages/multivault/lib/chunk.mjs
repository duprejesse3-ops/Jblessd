// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Splits text into chunks for indexing, preferring paragraph boundaries so a
// chunk stays semantically coherent rather than being a mid-sentence
// character cutoff. This is what lets v3 handle large files at all: v1/v2
// excerpted the first 2000 characters of a file and stopped — useful context
// buried on page 40 of a doc was simply invisible. Chunking + per-chunk BM25
// scoring means the relevant section wins on its own merits, wherever it is
// in the file.
//
// A small overlap between consecutive chunks (default 80 chars) means a
// sentence that happens to fall right on a chunk boundary still appears
// intact in at least one chunk, rather than being split with half its
// meaning in each neighbor.

const DEFAULT_CHUNK_SIZE = 800
const DEFAULT_OVERLAP = 80

/**
 * @param {string} text
 * @param {{ chunkSize?: number, overlap?: number }} [opts]
 * @returns {string[]} — always at least one chunk for non-empty input, even
 *   if the whole text fits in a single chunk (no pointless splitting).
 */
export function chunkText(text, opts = {}) {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE
  const overlap = opts.overlap ?? DEFAULT_OVERLAP
  if (!text) return []
  if (text.length <= chunkSize) return [text]

  const paragraphs = text.split(/\n{2,}/)
  const chunks = []
  let current = ''

  function flush() {
    if (current.trim()) chunks.push(current.trim())
  }

  for (const para of paragraphs) {
    // A single paragraph longer than a whole chunk: hard-split it by
    // character count rather than letting one paragraph blow the budget —
    // this is the fallback for minified code, a giant CSV row, etc.
    if (para.length > chunkSize) {
      flush()
      current = ''
      for (let i = 0; i < para.length; i += chunkSize - overlap) {
        chunks.push(para.slice(i, i + chunkSize).trim())
      }
      continue
    }

    const candidate = current ? `${current}\n\n${para}` : para
    if (candidate.length > chunkSize && current) {
      flush()
      // Start the next chunk with a small tail of the previous one, so
      // content right at the boundary isn't orphaned from its neighbor.
      const tail = current.slice(Math.max(0, current.length - overlap))
      current = `${tail}\n\n${para}`
    } else {
      current = candidate
    }
  }
  flush()

  return chunks.length ? chunks : [text.slice(0, chunkSize)]
}
