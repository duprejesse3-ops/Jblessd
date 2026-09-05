// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Vault lifecycle: init (create), sync (snapshot the folder + calendar into
// an encrypted file), context (decrypt + format for pasting into an AI), and
// status (check freshness without needing the passphrase).
//
// Everything lives on disk, next to wherever the user points --dest. Nothing
// in this file makes a network request. That's the whole trust story: a
// vault is a local, encrypted snapshot of a folder and a calendar file — not
// a live tunnel into either.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { encrypt, decrypt, generatePassphrase, DecryptError } from './crypto.mjs'
import { scanFolder } from './scan.mjs'
import { readIcsFile } from './calendar.mjs'
import { loadIndex, buildIndex, updateIndex, saveIndex } from './indexer.mjs'
import { rank } from './bm25.mjs'
import { tokenize } from './tokenize.mjs'

export { DecryptError }

const VAULT_FILE = 'vault.enc'
const META_FILE = 'vault.meta.json'
const FORMAT_VERSION = 1

function vaultPaths(dest) {
  return { vaultPath: join(dest, VAULT_FILE), metaPath: join(dest, META_FILE) }
}

function readMeta(dest) {
  const { metaPath } = vaultPaths(dest)
  if (!existsSync(metaPath)) return null
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    return null
  }
}

function writeMeta(dest, meta) {
  const { metaPath } = vaultPaths(dest)
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8')
}

/**
 * Create a new, empty vault at `dest`. Returns the generated passphrase —
 * the ONLY time it is ever available in plaintext from this library. The
 * caller (bin/vault.mjs) is responsible for showing it to the user once and
 * telling them to save it; nothing here persists it anywhere.
 */
export function initVault(dest, { folder, icsPath } = {}) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  const { vaultPath } = vaultPaths(dest)
  if (existsSync(vaultPath)) {
    throw new Error(`A vault already exists at ${dest}. Delete ${VAULT_FILE} first if you want to start over.`)
  }
  const passphrase = generatePassphrase()
  const emptySnapshot = { folder: folder ?? null, icsPath: icsPath ?? null, files: [], events: [], syncedAt: null }
  writeFileSync(vaultPath, encrypt(Buffer.from(JSON.stringify(emptySnapshot)), passphrase))
  writeMeta(dest, {
    version: FORMAT_VERSION,
    folder: folder ?? null,
    icsPath: icsPath ?? null,
    createdAt: new Date().toISOString(),
    lastSyncAt: null,
    fileCount: 0,
    eventCount: 0,
  })
  return passphrase
}

/**
 * Re-scan the watched folder (and calendar file, if configured) and write a
 * fresh encrypted snapshot. Requires the passphrase to decrypt-then-overwrite
 * cleanly, even though a sync could technically just overwrite blind — this
 * way a wrong passphrase fails loudly at sync time, not silently at the next
 * `context` call.
 */
export function syncVault(dest, passphrase, opts = {}) {
  const meta = readMeta(dest)
  if (!meta) throw new Error(`No vault found at ${dest}. Run "vault init" first.`)

  // Confirm the passphrase is correct before doing any scanning work.
  const { vaultPath } = vaultPaths(dest)
  decrypt(readFileSync(vaultPath), passphrase)

  const folder = opts.folder ?? meta.folder
  const icsPath = opts.icsPath ?? meta.icsPath
  if (!folder && !icsPath) {
    throw new Error('Nothing configured to sync. Pass --folder and/or --ics, or set one at "vault init" time.')
  }

  const files = folder ? scanFolder(folder, opts.scan) : []
  const events = readIcsFile(icsPath)
  const syncedAt = new Date().toISOString()
  const snapshot = { folder, icsPath, files, events, syncedAt }

  writeFileSync(vaultPath, encrypt(Buffer.from(JSON.stringify(snapshot)), passphrase))
  writeMeta(dest, { ...meta, folder, icsPath, lastSyncAt: syncedAt, fileCount: files.length, eventCount: events.length })
  return { fileCount: files.length, eventCount: events.length, syncedAt }
}

/**
 * Decrypt the vault and return the raw snapshot object. Most callers want
 * buildContext() instead, which formats this for pasting into an AI — this
 * is exposed mainly for tests and for --format json.
 */
export function readSnapshot(dest, passphrase) {
  const { vaultPath } = vaultPaths(dest)
  if (!existsSync(vaultPath)) throw new Error(`No vault found at ${dest}. Run "vault init" first.`)
  const plaintext = decrypt(readFileSync(vaultPath), passphrase)
  return JSON.parse(plaintext.toString('utf8'))
}

/**
 * Format a snapshot object (from readSnapshot() or a live scan) into the
 * pasteable context brief. Shared by buildContext() (reads the encrypted
 * at-rest snapshot) and buildLiveContext() (scans fresh, no passphrase) —
 * both produce identically-shaped output from this one function.
 */
export function formatContext(snapshot, { format = 'markdown' } = {}) {
  if (format === 'json') return JSON.stringify(snapshot, null, 2)

  const lines = []
  lines.push(`# Context — synced ${snapshot.syncedAt ?? 'never'}`)
  lines.push('')
  if (snapshot.folder) {
    lines.push(`## Folder: ${snapshot.folder}`)
    if (!snapshot.files.length) {
      lines.push('(empty, or nothing matched — run `vault sync`)')
    } else {
      for (const f of snapshot.files) {
        lines.push(`- ${f.relPath} (${f.sizeBytes} bytes)`)
        if (f.excerpt) {
          const indented = f.excerpt
            .split('\n')
            .map((l) => `  > ${l}`)
            .join('\n')
          lines.push(indented)
        }
      }
    }
    lines.push('')
  }
  if (snapshot.icsPath) {
    lines.push(`## Calendar: ${snapshot.icsPath}`)
    if (!snapshot.events.length) {
      lines.push('(no events found, or file missing — run `vault sync`)')
    } else {
      for (const e of snapshot.events) {
        const when = [e.start, e.end].filter(Boolean).join(' – ')
        const where = e.location ? ` @ ${e.location}` : ''
        lines.push(`- ${e.summary ?? '(untitled)'}${when ? ` — ${when}` : ''}${where}`)
        if (e.description) lines.push(`  > ${e.description}`)
      }
    }
  }
  return lines.join('\n') + '\n'
}

/**
 * Build the pasteable context snippet described in the product blurb: a
 * compact brief of what's in the watched folder and what's on the calendar,
 * meant to be dropped at the top of a chat with an AI agent (or piped into a
 * Claude API call — see README "Piping into the Claude API").
 */
export function buildContext(dest, passphrase, opts = {}) {
  return formatContext(readSnapshot(dest, passphrase), opts)
}

/**
 * The MCP-mode path: build context LIVE, with no passphrase and no
 * encrypted-snapshot round-trip. Reads only vault.meta.json (unencrypted —
 * just the folder/ics paths, not their contents) to know what to scan, then
 * scans the folder and parses the calendar file fresh, right now.
 *
 * This is deliberate, not a shortcut: an MCP server answers a live query
 * from a local AI client over stdio — nothing is written to disk or sent
 * over a network in this path, so there is no "resting file" for
 * encryption-at-rest to protect. Re-scanning live also means an MCP client
 * always sees the CURRENT folder/calendar state, never a snapshot that's
 * gone stale because someone forgot to run `vault sync` — that staleness
 * gap is exactly what made v1's workflow feel manual.
 *
 * Requires a vault to have been `init`ed at `dest` (so the folder/ics paths
 * are known) but does not require or use its passphrase at all.
 */
export function buildLiveContext(dest, opts = {}) {
  const meta = readMeta(dest)
  if (!meta) throw new Error(`No vault found at ${dest}. Run "vault init" first.`)
  if (!meta.folder && !meta.icsPath) {
    throw new Error('Nothing configured. Run "vault init --folder ... [--ics ...]" first.')
  }

  // Query given -> v3's indexed/ranked path: only the relevant chunks, not
  // the whole folder. No query -> exact v1/v2 behavior, unchanged, so
  // anything already relying on "get everything" keeps working.
  if (opts.query && meta.folder) {
    const index = ensureIndex(dest, meta.folder, opts.scan)
    const results = rank(tokenize(opts.query), index).slice(0, opts.topK ?? 8)
    const events = readIcsFile(meta.icsPath)
    return { snapshot: { query: opts.query, results, events }, text: formatSearchResults(opts.query, results, events, index, opts) }
  }

  const files = meta.folder ? scanFolder(meta.folder, opts.scan) : []
  const events = readIcsFile(meta.icsPath)
  const snapshot = { folder: meta.folder, icsPath: meta.icsPath, files, events, syncedAt: new Date().toISOString() }
  return { snapshot, text: formatContext(snapshot, opts) }
}

/**
 * Bring the on-disk index for `dest` up to date with `folder` and persist
 * it — build fresh if none exists yet (or it's for a different folder),
 * otherwise an incremental update (see indexer.mjs — cheap for files that
 * haven't changed). Called automatically by buildLiveContext()'s query path
 * on every call, so a query always searches current content; also exposed
 * directly for `vault index` to pre-warm the index ahead of time.
 */
export function ensureIndex(dest, folder, scanOpts = {}) {
  const existing = loadIndex(dest)
  const index = existing && existing.folder === folder ? updateIndex(existing, folder, scanOpts).index : buildIndex(folder, scanOpts)
  saveIndex(dest, index)
  return index
}

function formatSearchResults(query, results, events, index, { format = 'markdown' } = {}) {
  if (format === 'json') {
    return JSON.stringify(
      { query, resultCount: results.length, indexedFiles: Object.keys(index.files).length, results: results.map((r) => ({ relPath: r.doc.relPath, score: r.score, text: r.doc.text })), events },
      null,
      2,
    )
  }

  const lines = []
  lines.push(`# Search: "${query}"`)
  lines.push(`(${results.length} relevant chunk(s) out of ${Object.keys(index.files).length} indexed file(s))`)
  lines.push('')
  if (!results.length) {
    lines.push('No matching content found. Try different terms, or use `vault context` with no query for the full folder listing.')
  } else {
    for (const { doc, score } of results) {
      lines.push(`## ${doc.relPath} (relevance ${score.toFixed(2)})`)
      const indented = doc.text
        .split('\n')
        .map((l) => `  > ${l}`)
        .join('\n')
      lines.push(indented)
      lines.push('')
    }
  }
  if (events.length) {
    lines.push('## Calendar')
    for (const e of events) {
      const when = [e.start, e.end].filter(Boolean).join(' – ')
      const where = e.location ? ` @ ${e.location}` : ''
      lines.push(`- ${e.summary ?? '(untitled)'}${when ? ` — ${when}` : ''}${where}`)
    }
  }
  return lines.join('\n') + '\n'
}

/**
 * Cheap status check that never needs the passphrase — reads only the
 * unencrypted metadata file, so `vault status` works as a quick freshness
 * check without unlocking anything.
 */
export function statusVault(dest) {
  const meta = readMeta(dest)
  if (!meta) return null
  return meta
}
