// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The index's on-disk shape and the low-level operations for keeping its
// BM25 aggregates (docFreq, totalDocs, avgDocLength) correct as documents
// are added and removed. Deliberately plain JSON, not a binary format or an
// embedded database — this index is meant to be inspectable (open it in any
// editor) and to have zero new dependencies, consistent with the rest of
// this package.
//
// One entry in `docs` is one CHUNK (see lib/chunk.mjs), not one file — a
// large file becomes several docs. `files` tracks one entry per actual file,
// pointing at which doc ids currently belong to it, which is what makes
// incremental updates possible: to re-index a changed file, remove exactly
// its docs (and undo their docFreq contribution) before adding the new ones,
// without touching any other file's data or rebuilding from scratch.
//
// NOT encrypted at rest, unlike vault.enc. The index holds the same
// plain-text excerpts a vault sync would have shown anyway (same
// eligibility rules — see lib/scan.mjs's shouldRead) — see README's
// "Security model" for the reasoning and how to keep --dest access-controlled
// if that matters on your machine.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const INDEX_FILE = 'index.json'

export function indexPath(dest) {
  return join(dest, INDEX_FILE)
}

/**
 * A fresh, empty index for `folder`. Adding docs to this and calling
 * recomputeAggregates() is the whole story — see indexer.mjs for the
 * higher-level build/update orchestration that actually walks the
 * filesystem and calls these.
 */
export function emptyIndex(folder) {
  return {
    version: 1,
    folder,
    builtAt: null,
    totalDocs: 0,
    avgDocLength: 0,
    docFreq: Object.create(null),
    docs: [],
    files: Object.create(null), // relPath -> { mtimeMs, sizeBytes, ext, docIds: string[], eligible: boolean }
  }
}

export function loadIndex(dest) {
  const path = indexPath(dest)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null // corrupt/partial index — caller should rebuild, not crash
  }
}

export function saveIndex(dest, index) {
  writeFileSync(indexPath(dest), JSON.stringify(index), 'utf8')
}

let nextDocSeq = 0
function freshDocId(relPath, chunkIndex) {
  // Includes a process-local monotonic counter, not just relPath+chunkIndex,
  // so two docs can never collide even across a remove-then-immediately-
  // re-add for the same file (which happens on every re-index of a changed
  // file) — old ids fully retire rather than risk being confused with new
  // ones that happen to reuse the same (relPath, chunkIndex) pair.
  nextDocSeq += 1
  return `${relPath}::${chunkIndex}::${nextDocSeq}`
}

/**
 * Remove every doc belonging to `relPath` and undo their docFreq
 * contribution. Safe to call on a file with no docs (nothing to do) — the
 * standard first step before re-indexing an existing file, or the whole
 * step for a file that was deleted.
 */
export function removeFileDocs(index, relPath) {
  const fileEntry = index.files[relPath]
  if (!fileEntry) return
  const idsToRemove = new Set(fileEntry.docIds)
  if (idsToRemove.size) {
    index.docs = index.docs.filter((doc) => {
      if (!idsToRemove.has(doc.id)) return true
      for (const term of Object.keys(doc.tokens)) {
        const next = (index.docFreq[term] ?? 0) - 1
        if (next <= 0) delete index.docFreq[term]
        else index.docFreq[term] = next
      }
      return false
    })
  }
  delete index.files[relPath]
}

/**
 * Add one file's chunks as new docs and record its file-level metadata.
 * Assumes removeFileDocs() was already called for this relPath if it was
 * previously indexed — indexer.mjs's updateIndex() always does remove-then-
 * add for a changed file, never a blind add, so docFreq can't double-count.
 *
 * @param {Array<{ text: string, tokens: Record<string, number>, length: number }>} chunks
 */
export function addFileDocs(index, relPath, chunks, meta) {
  const docIds = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const id = freshDocId(relPath, i)
    index.docs.push({ id, relPath, chunkIndex: i, length: chunk.length, tokens: chunk.tokens, text: chunk.text })
    docIds.push(id)
    for (const term of Object.keys(chunk.tokens)) {
      index.docFreq[term] = (index.docFreq[term] ?? 0) + 1
    }
  }
  index.files[relPath] = { mtimeMs: meta.mtimeMs, sizeBytes: meta.sizeBytes, ext: meta.ext, docIds, eligible: chunks.length > 0 }
}

/** Record a file that exists but isn't eligible for content indexing (wrong extension, too big, looks sensitive) — still listed, never chunked. */
export function recordIneligibleFile(index, relPath, meta) {
  index.files[relPath] = { mtimeMs: meta.mtimeMs, sizeBytes: meta.sizeBytes, ext: meta.ext, docIds: [], eligible: false }
}

/** Recompute totalDocs/avgDocLength from the current docs array. Call this once after a batch of add/remove operations, not per-operation. */
export function recomputeAggregates(index) {
  index.totalDocs = index.docs.length
  index.avgDocLength = index.totalDocs ? index.docs.reduce((sum, d) => sum + d.length, 0) / index.totalDocs : 0
}
