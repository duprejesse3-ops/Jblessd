// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Builds and incrementally updates the BM25 index. This is the actual answer
// to "handle much larger workloads": v1/v2's buildLiveContext() re-scanned
// and re-read every eligible file on every single call — fine for a folder
// of a few dozen files, a real bottleneck at a few thousand. updateIndex()
// here only touches files that are NEW or whose mtime changed since the last
// index; an unchanged file costs one stat() call, not a re-read.
//
// readFileSync + chunk + tokenize is the one part of this pipeline that's
// O(file size) rather than O(1) per unchanged file — still real work for a
// freshly-changed large file, but it's work paid once per change, not once
// per query the way v1/v2's live re-scan was.

import { readFileSync } from 'node:fs'
import { walkFiles, shouldRead } from './scan.mjs'
import { chunkText } from './chunk.mjs'
import { termFrequencies, tokenize } from './tokenize.mjs'
import { emptyIndex, loadIndex, saveIndex, removeFileDocs, addFileDocs, recordIneligibleFile, recomputeAggregates } from './index-store.mjs'

function chunksFor(fullPath) {
  let text
  try {
    text = readFileSync(fullPath, 'utf8')
  } catch {
    return [] // unreadable (binary despite the extension, permissions, race with a delete) — treat as no content, not a crash
  }
  return chunkText(text).map((chunkString) => ({
    text: chunkString,
    tokens: termFrequencies(chunkString),
    length: tokenize(chunkString).length,
  }))
}

/**
 * Full (re)build from scratch. Used by `vault index` and automatically the
 * first time a vault with no existing index.json is queried.
 */
export function buildIndex(folder, opts = {}) {
  const index = emptyIndex(folder)
  const files = walkFiles(folder, opts)
  for (const f of files) {
    if (shouldRead(f.name, f.ext, f.sizeBytes, opts)) {
      const chunks = chunksFor(f.fullPath)
      if (chunks.length) addFileDocs(index, f.relPath, chunks, f)
      else recordIneligibleFile(index, f.relPath, f) // eligible by rule but unreadable in practice
    } else {
      recordIneligibleFile(index, f.relPath, f)
    }
  }
  recomputeAggregates(index)
  index.builtAt = new Date().toISOString()
  return index
}

/**
 * Incrementally bring an existing index up to date with the current state
 * of `folder`. Only files that are new, changed (by mtime), or deleted since
 * the index was last built/updated actually get touched — see module
 * comment. Returns { index, added, updated, removed } so callers (the CLI,
 * the watcher) can report what actually happened.
 */
export function updateIndex(existingIndex, folder, opts = {}) {
  const index = existingIndex
  const onDisk = walkFiles(folder, opts)
  const onDiskPaths = new Set(onDisk.map((f) => f.relPath))
  const stats = { added: 0, updated: 0, removed: 0 }

  // Deletions: anything the index still has a record of that's no longer on disk.
  for (const relPath of Object.keys(index.files)) {
    if (!onDiskPaths.has(relPath)) {
      removeFileDocs(index, relPath)
      stats.removed += 1
    }
  }

  // Additions and changes.
  for (const f of onDisk) {
    const existing = index.files[f.relPath]
    const unchanged = existing && existing.mtimeMs === f.mtimeMs
    if (unchanged) continue

    if (existing) {
      removeFileDocs(index, f.relPath) // re-index: undo the old contribution before adding the new one
      stats.updated += 1
    } else {
      stats.added += 1
    }

    if (shouldRead(f.name, f.ext, f.sizeBytes, opts)) {
      const chunks = chunksFor(f.fullPath)
      if (chunks.length) addFileDocs(index, f.relPath, chunks, f)
      else recordIneligibleFile(index, f.relPath, f)
    } else {
      recordIneligibleFile(index, f.relPath, f)
    }
  }

  recomputeAggregates(index)
  index.builtAt = new Date().toISOString()
  return { index, ...stats }
}

/**
 * Load the index at `dest` if it exists and is for the right folder;
 * otherwise build one fresh. Does NOT save — callers that want the result
 * persisted call saveIndex() themselves (see vault.mjs's ensureIndex, which
 * does exactly that).
 */
export function loadOrBuildIndex(dest, folder, opts = {}) {
  const existing = loadIndex(dest)
  if (existing && existing.folder === folder) return existing
  return buildIndex(folder, opts)
}

export { saveIndex, loadIndex } from './index-store.mjs'
