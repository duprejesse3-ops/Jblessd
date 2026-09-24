// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A small in-memory ring buffer of recent webhook activity — the "see every
// webhook call, live" test console from the product listing. Deliberately not
// persisted to disk: this is a debugging aid for the session you're in, not
// an audit trail, and keeping it in memory means zero setup and nothing to
// rotate or clean up.

const MAX_ENTRIES = 200

/**
 * @typedef {{
 *   id: string,
 *   direction: 'inbound' | 'outbound',
 *   status: 'ok' | 'error',
 *   statusCode: number | null,
 *   summary: string,
 *   detail: string | null,
 *   at: string
 * }} LogEntry
 */

/** @type {LogEntry[]} */
const entries = []
let seq = 0

/**
 * @param {Omit<LogEntry, 'id' | 'at'>} entry
 * @returns {LogEntry}
 */
export function record(entry) {
  seq += 1
  /** @type {LogEntry} */
  const full = { id: String(seq), at: new Date().toISOString(), ...entry }
  entries.unshift(full)
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES
  return full
}

/** @returns {LogEntry[]} */
export function recent(limit = 50) {
  return entries.slice(0, limit)
}

export function clear() {
  entries.length = 0
}
