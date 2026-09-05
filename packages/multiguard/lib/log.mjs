// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The activity log — "connector X registered", "kill switch engaged,
// 3/4 switched" — shown on the dashboard's log tab. Persisted to a plain
// JSON file (guard.log.json, next to guard.config.json) so a restart of
// MultiGuard itself doesn't wipe the record of what just happened, which
// matters most exactly when you'd want it least: right after an incident
// that involved restarting MultiGuard.
//
// This is NOT MultiWitness. MultiWitness (sold separately) is a tamper-
// evident, hash-chained log meant to prove after the fact that an entry
// wasn't altered. This is a plain activity feed for MultiGuard's own
// dashboard — readable, editable JSON on disk, no chaining, no proof
// property. If you need the tamper-evidence guarantee for MultiGuard's own
// actions specifically, that's what MultiWitness is for; the two are
// separate products on purpose, same reasoning as MultiVault's
// `multivault-docs-bridge` split — one small tool, one job.
//
// createLog(logPath) returns an instance bound to one file, rather than
// module-level global state — each MultiGuard process (and, in tests, each
// server instance) gets its own log file and its own in-memory cache, so
// two instances pointed at different --config paths never see each other's
// activity, and tests never leak entries across each other by accident.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const MAX_ENTRIES = 200

/**
 * @typedef {{
 *   id: string,
 *   kind: 'registered' | 'removed' | 'kill-switch' | 'error',
 *   summary: string,
 *   detail: string | null,
 *   at: string
 * }} LogEntry
 */

function loadEntries(logPath) {
  if (!existsSync(logPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(logPath, 'utf8'))
    return Array.isArray(parsed) ? parsed : [] // corrupt/unexpected shape — start fresh rather than crash
  } catch {
    return [] // corrupt/partial file (e.g. killed mid-write) — same "don't crash, start clean" stance as index-store's loadIndex()
  }
}

function persist(logPath, entries) {
  mkdirSync(path.dirname(logPath), { recursive: true })
  writeFileSync(logPath, JSON.stringify(entries, null, 2) + '\n', 'utf8')
}

/**
 * @param {string} logPath
 */
export function createLog(logPath) {
  let entries = loadEntries(logPath)
  let seq = entries.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0)

  return {
    /**
     * @param {Omit<LogEntry, 'id' | 'at'>} entry
     * @returns {LogEntry}
     */
    record(entry) {
      seq += 1
      /** @type {LogEntry} */
      const full = { id: String(seq), at: new Date().toISOString(), ...entry }
      entries.unshift(full)
      if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES
      persist(logPath, entries)
      return full
    },

    /** @returns {LogEntry[]} */
    recent(limit = 50) {
      return entries.slice(0, limit)
    },

    clear() {
      entries = []
      persist(logPath, entries)
    },
  }
}

/** Default location: guard.log.json next to the given guard.config.json path. */
export function defaultLogPath(configPath) {
  return path.join(path.dirname(configPath), 'guard.log.json')
}
