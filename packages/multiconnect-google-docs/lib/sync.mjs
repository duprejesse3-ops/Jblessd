// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Orchestrates one sync run: refresh the access token, list Google Docs,
// export only the ones that actually changed since last run (by
// modifiedTime — same incremental philosophy as MultiVault's own indexer:
// don't pay for work that's already done), write them as .md files into the
// destination folder, and record state for next time.
//
// One-way, by design: this reads from Drive and writes local files. It
// never writes back to Drive, and once a file is on disk, MultiVault's own
// watcher (a separate, already-owned product) picks it up from there —
// this tool's job ends at "write accurate .md files locally."

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { refreshAccessToken } from './auth.mjs'
import { listGoogleDocs, exportDocAsMarkdown } from './drive.mjs'

const STATE_FILE = 'docs-bridge-state.json'

function sanitizeFilename(name) {
  // Strip characters that are unsafe/awkward across Windows, macOS, and
  // Linux filesystems alike, collapse whitespace, and cap length — a very
  // long Doc title shouldn't produce a filename some filesystems choke on.
  const cleaned = name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
  return cleaned || 'untitled'
}

function loadState(dest) {
  const path = join(dest, STATE_FILE)
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {} // corrupt state file — treat as empty rather than crash; worst case, everything re-exports once
  }
}

function saveState(dest, state) {
  writeFileSync(join(dest, STATE_FILE), JSON.stringify(state, null, 2), 'utf8')
}

/**
 * Run one sync pass. Returns { exported, unchanged, removed, errors } so
 * callers (the CLI, a scheduler) can report what actually happened.
 */
export async function syncDocs({ clientId, clientSecret, refreshToken, dest, folderId }) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

  const { accessToken } = await refreshAccessToken({ clientId, clientSecret, refreshToken })
  const docs = await listGoogleDocs(accessToken, { folderId })
  const state = loadState(dest)
  const seenIds = new Set()
  const result = { exported: 0, unchanged: 0, removed: 0, errors: [] }

  for (const doc of docs) {
    seenIds.add(doc.id)
    const prior = state[doc.id]
    if (prior && prior.modifiedTime === doc.modifiedTime) {
      result.unchanged += 1
      continue
    }

    try {
      const markdown = await exportDocAsMarkdown(accessToken, doc.id)
      const filename = `${sanitizeFilename(doc.name)}.md`

      // A rename in Drive shouldn't leave the old filename behind as an
      // orphaned duplicate — remove it before writing the new one.
      if (prior && prior.filename && prior.filename !== filename) {
        const oldPath = join(dest, prior.filename)
        if (existsSync(oldPath)) unlinkSync(oldPath)
      }

      writeFileSync(join(dest, filename), markdown, 'utf8')
      state[doc.id] = { name: doc.name, filename, modifiedTime: doc.modifiedTime }
      result.exported += 1
    } catch (err) {
      result.errors.push({ id: doc.id, name: doc.name, message: err.message })
    }
  }

  // A Doc deleted (or moved out of scope) in Drive since last run — remove
  // its exported file rather than leaving a stale copy on disk forever.
  for (const [id, entry] of Object.entries(state)) {
    if (!seenIds.has(id)) {
      const path = join(dest, entry.filename)
      if (existsSync(path)) unlinkSync(path)
      delete state[id]
      result.removed += 1
    }
  }

  saveState(dest, state)
  return result
}
