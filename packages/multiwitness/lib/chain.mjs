// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole product, really. Every event appended here includes a SHA-256
// hash of the *previous* entry's hash, so changing or deleting any past
// entry breaks every hash after it — the same construction a blockchain
// uses, applied to a plain append-only file instead of a distributed
// ledger, because a single local file with a checkable chain is all a
// small business actually needs: proof of what an agent did, checkable by
// anyone with the file, no server trust required.
//
// The log is a JSON Lines file (one JSON object per line) specifically so
// verifyChain() can work on the raw file directly — including from the CLI
// with the witness process not even running — rather than requiring a
// database or this package's own server to be trusted to tell the truth
// about its own history.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const GENESIS_HASH = '0'.repeat(64)

function defaultLogPath() {
  return path.resolve(process.cwd(), 'witness.log.jsonl')
}

/**
 * @typedef {{
 *   seq: number,
 *   at: string,
 *   source: string,
 *   action: string,
 *   detail: string | null,
 *   prevHash: string,
 *   hash: string
 * }} ChainEntry
 */

/**
 * The hash covers everything about this entry except its own hash field —
 * changing any of seq/at/source/action/detail/prevHash after the fact
 * produces a different hash than what's stored, which is exactly what
 * verifyChain() checks for.
 * @param {Omit<ChainEntry, 'hash'>} entry
 */
function computeHash(entry) {
  const payload = JSON.stringify({
    seq: entry.seq,
    at: entry.at,
    source: entry.source,
    action: entry.action,
    detail: entry.detail,
    prevHash: entry.prevHash,
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/** Reads every line of the log file as parsed entries, in order. */
function readEntries(logPath) {
  if (!existsSync(logPath)) return []
  const raw = readFileSync(logPath, 'utf8')
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

/** The last entry's hash, or the genesis hash if the log is empty. */
function tipHash(entries) {
  return entries.length ? entries[entries.length - 1].hash : GENESIS_HASH
}

/**
 * Append one event to the chain. This is the ONLY way an entry is ever
 * added — there is deliberately no update or delete function anywhere in
 * this module. A witness log you can edit isn't a witness log.
 * @param {{ source: string, action: string, detail?: string | null }} event
 * @param {string} [logPath]
 * @returns {ChainEntry}
 */
export function appendEvent(event, logPath = defaultLogPath()) {
  if (!event.source || !event.action) {
    throw new Error('An event needs at least a source and an action.')
  }
  const entries = readEntries(logPath)
  const prevHash = tipHash(entries)
  const base = {
    seq: entries.length + 1,
    at: new Date().toISOString(),
    source: event.source,
    action: event.action,
    detail: event.detail ?? null,
    prevHash,
  }
  const hash = computeHash(base)
  /** @type {ChainEntry} */
  const full = { ...base, hash }

  mkdirSync(path.dirname(logPath), { recursive: true })
  appendFileSync(logPath, JSON.stringify(full) + '\n', 'utf8')
  return full
}

/**
 * @param {string} [logPath]
 * @param {number} [limit]
 * @returns {ChainEntry[]} most recent first
 */
export function recentEntries(logPath = defaultLogPath(), limit = 50) {
  const entries = readEntries(logPath)
  return entries.slice(-limit).reverse()
}

/**
 * Recompute every hash in the chain from scratch and compare against what's
 * stored. The moment one entry's stored hash doesn't match what its own
 * fields recompute to, OR its prevHash doesn't match the entry before it,
 * the chain is broken from that point on — everything after an edited or
 * deleted entry becomes unverifiable, which is the entire point.
 * @param {string} [logPath]
 * @returns {{ valid: boolean, totalEntries: number, brokenAtSeq: number | null, reason: string | null }}
 */
export function verifyChain(logPath = defaultLogPath()) {
  const entries = readEntries(logPath)
  let expectedPrevHash = GENESIS_HASH

  for (const entry of entries) {
    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtSeq: entry.seq,
        reason: `Entry ${entry.seq}'s prevHash doesn't match the previous entry's hash — the chain link is broken here (an entry before this one was likely altered, reordered, or deleted).`,
      }
    }
    const recomputed = computeHash({
      seq: entry.seq,
      at: entry.at,
      source: entry.source,
      action: entry.action,
      detail: entry.detail,
      prevHash: entry.prevHash,
    })
    if (recomputed !== entry.hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAtSeq: entry.seq,
        reason: `Entry ${entry.seq}'s stored hash doesn't match its own contents — this entry's fields were edited after it was written.`,
      }
    }
    expectedPrevHash = entry.hash
  }

  return { valid: true, totalEntries: entries.length, brokenAtSeq: null, reason: null }
}

export { defaultLogPath, GENESIS_HASH }
