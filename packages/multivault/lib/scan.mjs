// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Walks a watched folder and decides what's eligible to have its content
// read at all — shared by two callers with different needs:
//   - scanFolder() below: v1/v2's flat listing-with-a-short-excerpt, used
//     when buildLiveContext() is called with no search query (see
//     lib/vault.mjs) — unchanged behavior from v1/v2.
//   - lib/indexer.mjs: v3's full-content chunking + BM25 indexing pipeline,
//     which needs the same "is this file safe/sane to read" decision but
//     wants the FULL content (to chunk), not a flat 2000-char excerpt.
//
// Deliberately conservative about what it reads, in both callers:
//   - Only a fixed allowlist of plain-text extensions are ever read.
//     Anything else (images, PDFs, spreadsheets, executables, .env files,
//     anything with "key", "secret", or "credential" in the name) is listed
//     by name and metadata only — never opened.
//   - Hidden files/folders (dotfiles) and common noise directories
//     (node_modules, .git) are skipped outright.
//
// v3 raises the volume caps substantially (500 files -> 20,000; 3 folder
// levels -> 12) versus v1/v2, because the cost of a large folder is now
// absorbed by the incremental index (lib/indexer.mjs) instead of being
// paid fresh on every single call — see that file's module comment.

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

export const DEFAULTS = {
  maxFiles: 20_000,
  maxDepth: 12,
  excerptCharLimit: 2000, // v1/v2 flat-excerpt mode only — see scanFolder()
  maxFileBytes: 2_000_000, // per-file cap for READING content at all, in either mode — 2MB of plain text is already an unusual single file, and chunking (lib/chunk.mjs) means indexing mode doesn't need this to be small the way a flat excerpt did
}

const EXCERPT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json'])
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '.cache'])

// Filenames that look like they hold secrets are skipped even if their
// extension is otherwise excerptable (e.g. a stray "notes.txt" is fine;
// "api-keys.txt" is not).
const SENSITIVE_NAME_PATTERN = /(secret|password|credential|\bkeys?\b|\.env)/i

export function isHidden(name) {
  return name.startsWith('.')
}

/**
 * Whether a file's CONTENT is safe/eligible to read at all — by extension,
 * size, and filename. Used by both scanFolder() (v1/v2) and lib/indexer.mjs
 * (v3), so this one decision stays in exactly one place.
 */
export function shouldRead(name, ext, sizeBytes, opts = {}) {
  const maxFileBytes = opts.maxFileBytes ?? DEFAULTS.maxFileBytes
  if (isHidden(name)) return false
  if (!EXCERPT_EXTENSIONS.has(ext)) return false
  if (sizeBytes > maxFileBytes) return false
  if (SENSITIVE_NAME_PATTERN.test(name)) return false
  return true
}

/**
 * Walk `folder` up to `maxDepth` levels and return a flat list of every
 * file's metadata — no content read yet. Stops early once `maxFiles`
 * entries have been collected. This is the shared "what's on disk" pass;
 * callers decide what to do with each entry (scanFolder excerpts eligible
 * ones inline below; lib/indexer.mjs reads+chunks+tokenizes eligible ones).
 *
 * @returns {Array<{ relPath: string, fullPath: string, name: string, ext: string, sizeBytes: number, mtimeMs: number }>}
 */
export function walkFiles(folder, opts = {}) {
  const { maxFiles, maxDepth } = { ...DEFAULTS, ...opts }
  const entries = []

  function walk(dir, depth) {
    if (entries.length >= maxFiles || depth > maxDepth) return
    let names
    try {
      names = readdirSync(dir)
    } catch {
      return // unreadable directory — skip rather than fail the whole scan
    }
    for (const name of names) {
      if (entries.length >= maxFiles) return
      if (isHidden(name) || SKIP_DIR_NAMES.has(name)) continue
      const fullPath = join(dir, name)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
        continue
      }
      if (!stat.isFile()) continue
      entries.push({
        relPath: relative(folder, fullPath),
        fullPath,
        name,
        ext: extname(name).toLowerCase(),
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
      })
    }
  }

  walk(folder, 0)
  return entries
}

function readExcerpt(fullPath, charLimit) {
  try {
    const text = readFileSync(fullPath, 'utf8')
    return text.length > charLimit ? text.slice(0, charLimit) + '\n… (truncated)' : text
  } catch {
    return null // unreadable (binary despite the extension, permissions, etc.) — skip silently
  }
}

/**
 * v1/v2 behavior, unchanged: a flat list with a short (2000-char) excerpt
 * per eligible file. Used when buildLiveContext() is called with no search
 * query — see lib/vault.mjs.
 *
 * @returns {Array<{ relPath, sizeBytes, mtimeMs, ext, excerpt: string | null }>}
 */
export function scanFolder(folder, opts = {}) {
  const files = walkFiles(folder, opts)
  const charLimit = opts.excerptCharLimit ?? DEFAULTS.excerptCharLimit
  return files.map((f) => ({
    relPath: f.relPath,
    sizeBytes: f.sizeBytes,
    mtimeMs: f.mtimeMs,
    ext: f.ext,
    excerpt: shouldRead(f.name, f.ext, f.sizeBytes, opts) ? readExcerpt(f.fullPath, charLimit) : null,
  }))
}
