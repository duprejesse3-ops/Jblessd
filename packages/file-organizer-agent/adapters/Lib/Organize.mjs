// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The engine: scan a folder, classify every file into a category, and produce
// a *plan* (never a direct mutation) that the caller applies explicitly. This
// split — plan, then apply — is what makes --dry-run (the default) genuinely
// safe: planFolder() never touches the filesystem, so a buyer can see exactly
// what would happen before a single file moves.
//
// Classification is rule-based by default: extension plus a handful of
// filename-keyword patterns (invoices, receipts, screenshots). No network
// call, no account, no API key, nothing phoning home — same promise as the
// Site Audit Agent. An optional AI fallback (classifyWithAI in ./ai.mjs) only
// ever runs for files the rules genuinely can't place, and only if the buyer
// has set ANTHROPIC_API_KEY — the product works completely without it.

import { readdirSync, statSync, existsSync, renameSync, mkdirSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

export const DEFAULTS = {
  // Files newer than this are left alone — something still mid-download or
  // just saved shouldn't get yanked out from under an open app.
  minAgeMinutes: 2,
  destRoot: null, // null = create "Organized" inside the watched folder
}

// ---- category rules ------------------------------------------------------
//
// Order matters: filename-keyword rules are checked before pure-extension
// rules, so "invoice-march.pdf" lands in Invoices & Receipts rather than the
// generic Documents bucket a bare .pdf would get.

const EXT_CATEGORY = {
  // Documents
  '.pdf': 'Documents', '.doc': 'Documents', '.docx': 'Documents',
  '.txt': 'Documents', '.rtf': 'Documents', '.odt': 'Documents',
  // Spreadsheets
  '.xls': 'Spreadsheets', '.xlsx': 'Spreadsheets', '.csv': 'Spreadsheets', '.ods': 'Spreadsheets',
  // Presentations
  '.ppt': 'Presentations', '.pptx': 'Presentations', '.key': 'Presentations',
  // Images
  '.jpg': 'Images', '.jpeg': 'Images', '.png': 'Images', '.gif': 'Images',
  '.webp': 'Images', '.heic': 'Images', '.svg': 'Images', '.bmp': 'Images', '.tiff': 'Images',
  // Audio
  '.mp3': 'Audio', '.wav': 'Audio', '.m4a': 'Audio', '.flac': 'Audio', '.aac': 'Audio',
  // Video
  '.mp4': 'Video', '.mov': 'Video', '.mkv': 'Video', '.avi': 'Video', '.webm': 'Video',
  // Archives
  '.zip': 'Archives', '.rar': 'Archives', '.7z': 'Archives', '.tar': 'Archives', '.gz': 'Archives',
  // Installers
  '.dmg': 'Installers', '.pkg': 'Installers', '.exe': 'Installers', '.msi': 'Installers', '.appimage': 'Installers',
  // Code
  '.js': 'Code', '.ts': 'Code', '.py': 'Code', '.json': 'Code', '.html': 'Code', '.css': 'Code',
}

// Filename-keyword rules, checked before the extension table above. Matched
// case-insensitively against the base filename (without extension).
const KEYWORD_RULES = [
  { category: 'Invoices & Receipts', patterns: [/invoice/i, /receipt/i, /\breceipt[-_ ]?\d/i, /order[-_ ]?confirmation/i] },
  { category: 'Screenshots', patterns: [/^screenshot/i, /^screen[-_ ]?shot/i, /^capture[-_ ]?\d/i] },
  { category: 'Statements', patterns: [/statement/i, /^stmt/i] },
  { category: 'Contracts', patterns: [/contract/i, /agreement/i, /\bnda\b/i] },
]

export function classifyByRules(filename) {
  const base = basename(filename, extname(filename))
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(base))) return rule.category
  }
  const ext = extname(filename).toLowerCase()
  return EXT_CATEGORY[ext] ?? null // null = rules couldn't place it
}

// ---- scanning --------------------------------------------------------------

/** List files directly in `dir` (not recursive) old enough to be safe to move. */
export function scanFolder(dir, opts = {}) {
  const minAgeMs = (opts.minAgeMinutes ?? DEFAULTS.minAgeMinutes) * 60_000
  const now = Date.now()
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (entry.name.startsWith('.')) continue // dotfiles: leave alone
    const full = join(dir, entry.name)
    const stat = statSync(full)
    // Clamp to zero: filesystem mtime precision or clock skew can make a
    // file written a moment ago appear to be timestamped fractionally after
    // `now`, producing a negative delta here. A negative age is never "too
    // fresh" in any meaningful sense, so without the clamp that quirk could
    // spuriously skip a file that's actually well past minAgeMinutes.
    const ageMs = Math.max(0, now - stat.mtimeMs)
    if (ageMs < minAgeMs) continue // too fresh, possibly still writing
    files.push({ name: entry.name, path: full, size: stat.size, mtime: stat.mtime })
  }
  return files
}

// ---- planning ---------------------------------------------------------------

/**
 * Build a move plan for every file in `dir`. Never touches the filesystem —
 * see applyPlan() for the step that actually does. `classifyUnplaced`, if
 * given, is called for any file the rules can't place (e.g. the optional AI
 * fallback); it receives the filename and must return a category string or
 * null.
 */
export async function planFolder(dir, opts = {}) {
  const destRoot = opts.destRoot ?? join(dir, 'Organized')
  const files = scanFolder(dir, opts)
  const plan = []

  for (const file of files) {
    let category = classifyByRules(file.name)
    let source = 'rules'
    if (!category && opts.classifyUnplaced) {
      category = await opts.classifyUnplaced(file.name)
      source = category ? 'ai' : null
    }
    if (!category) {
      category = 'Other'
      source = 'fallback'
    }
    const destDir = join(destRoot, category)
    const destPath = uniqueDestPath(destDir, file.name)
    plan.push({ file: file.name, from: file.path, to: destPath, category, source })
  }
  return plan
}

/** Pick a non-colliding destination path, appending " (2)", " (3)", etc. */
function uniqueDestPath(destDir, filename) {
  const ext = extname(filename)
  const base = basename(filename, ext)
  let candidate = join(destDir, filename)
  let n = 2
  while (existsSync(candidate)) {
    candidate = join(destDir, `${base} (${n})${ext}`)
    n++
  }
  return candidate
}

// ---- applying ---------------------------------------------------------------

/** Execute a plan from planFolder(). Creates destination folders as needed. */
export function applyPlan(plan) {
  const results = []
  for (const item of plan) {
    try {
      mkdirSync(join(item.to, '..'), { recursive: true })
      renameSync(item.from, item.to)
      results.push({ ...item, ok: true })
    } catch (err) {
      results.push({ ...item, ok: false, error: err.message })
    }
  }
  return results
}

/** Group a plan by category, for a readable summary before/after applying. */
export function summarizePlan(plan) {
  const byCategory = new Map()
  for (const item of plan) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, [])
    byCategory.get(item.category).push(item.file)
  }
  return byCategory
                           }
