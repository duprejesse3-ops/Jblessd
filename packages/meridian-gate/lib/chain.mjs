// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Every allow, block, and rule change Gate makes gets appended here, and each
// entry includes a SHA-256 hash of the previous entry's hash — so editing or
// deleting a past line breaks every hash after it. This is a standalone
// implementation (not a dependency on the separately-sold MultiWitness
// product) so Gate's receipt of what left is verifiable with nothing but
// this file and Node, even offline, even years later.
//
// JSON Lines on purpose: verifyChain() works directly on the raw file,
// without Gate's own process running and without trusting Gate to tell the
// truth about its own history.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const GENESIS_HASH = '0'.repeat(64)

function defaultLogPath() {
  return path.resolve(process.cwd(), 'gate.log.jsonl')
}

/**
 * @typedef {{
 *   seq: number,
 *   at: string,
 *   action: 'allow' | 'block' | 'rule-add' | 'rule-remove' | 'start' | 'stop',
 *   host: string | null,
 *   by: string | null,
 *   detail: string | null,
 *   prevHash: string,
 *   hash: string
 * }} ChainEntry
 */

function computeHash(entry) {
  const payload = JSON.stringify({
    seq: entry.seq,
    at: entry.at,
    action: entry.action,
    host: entry.host,
    by: entry.by,
    detail: entry.detail,
    prevHash: entry.prevHash,
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

function readEntries(logPath) {
  if (!existsSync(logPath)) return []
  const raw = readFileSync(logPath, 'utf8')
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function tipHash(entries) {
  return entries.length ? entries[entries.length - 1].hash : GENESIS_HASH
}

/**
 * Append one event to the chain. There is deliberately no update or delete
 * function anywhere in this module — a receipt you can edit isn't a receipt.
 * @param {{ action: ChainEntry['action'], host?: string | null, by?: string | null, detail?: string | null }} event
 * @param {string} [logPath]
 * @returns {ChainEntry}
 */
export function appendEvent(event, logPath = defaultLogPath()) {
  if (!event.action) {
    throw new Error('An event needs an action.')
  }
  const entries = readEntries(logPath)
  const prevHash = tipHash(entries)
  const base = {
    seq: entries.length + 1,
    at: new Date().toISOString(),
    action: event.action,
    host: event.host ?? null,
    by: event.by ?? null,
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
 * Recompute every hash from scratch and compare against what's stored.
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
    const recomputed = computeHash(entry)
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
