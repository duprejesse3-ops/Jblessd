// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a watched folder into a compact snapshot: what's there, and — for a
// small set of plain-text formats under a size cap — a short excerpt of each.
//
// Deliberately conservative about what it reads. This is the one piece of
// MultiVault that touches file *contents* rather than just structure, so the
// defaults are narrow on purpose:
//   - Only a fixed allowlist of plain-text extensions are ever excerpted.
//     Anything else (images, PDFs, spreadsheets, executables, .env files,
//     anything with "key", "secret", or "credential" in the name) is listed
//     by name and metadata only — never opened.
//   - Each excerpt is capped at EXCERPT_CHAR_LIMIT characters.
//   - The whole scan stops at MAX_FILES so a huge folder can't turn a sync
//     into a multi-minute read of the entire disk.
//   - Hidden files/folders (dotfiles) and common noise directories
//     (node_modules, .git) are skipped outright.

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

export const DEFAULTS = {
  maxFiles: 500,
  maxDepth: 3,
  excerptCharLimit: 2000,
  excerptMaxFileBytes: 100_000, // don't even attempt to read a text file bigger than this
}

const EXCERPT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json'])
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '.cache'])

// Filenames that look like they hold secrets are skipped even if their
// extension is otherwise excerptable (e.g. a stray "notes.txt" is fine;
// "api-keys.txt" is not).
const SENSITIVE_NAME_PATTERN = /(secret|password|credential|\bkeys?\b|\.env)/i

function isHidden(name) {
  return name.startsWith('.')
}

function shouldExcerpt(name, ext, sizeBytes) {
  if (isHidden(name)) return false
  if (!EXCERPT_EXTENSIONS.has(ext)) return false
  if (sizeBytes > DEFAULTS.excerptMaxFileBytes) return false
  if (SENSITIVE_NAME_PATTERN.test(name)) return false
  return true
}

function readExcerpt(fullPath) {
  try {
    const text = readFileSync(fullPath, 'utf8')
    return text.length > DEFAULTS.excerptCharLimit
      ? text.slice(0, DEFAULTS.excerptCharLimit) + '\n… (truncated)'
      : text
  } catch {
    return null // unreadable (binary despite the extension, permissions, etc.) — skip silently
  }
}

/**
 * Walk `folder` up to `maxDepth` levels and return a flat list of entries:
 *   { relPath, sizeBytes, mtimeMs, ext, excerpt: string | null }
 * Stops early once `maxFiles` entries have been collected.
 */
export function scanFolder(folder, opts = {}) {
  const { maxFiles, maxDepth } = { ...DEFAULTS, ...opts }
  const entries = []

  function walk(dir, depth) {
    if (entries.length >= maxFiles || depth > maxDepth) return
    let names
    try {
      names = readdirSync(dir)
    } catch {
      return // unreadable directory — skip rather than fail the whole sync
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
      const ext = extname(name).toLowerCase()
      const excerpt = shouldExcerpt(name, ext, stat.size) ? readExcerpt(fullPath) : null
      entries.push({
        relPath: relative(folder, fullPath),
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        ext,
        excerpt,
      })
    }
  }

  walk(folder, 0)
  return entries
}
