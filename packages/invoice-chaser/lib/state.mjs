// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Dedupe state: which escalation thresholds have already fired a reminder
// for which invoice, so re-running the job (daily, or twice in one day
// after a fix) never re-sends the same threshold. Deliberately a single
// flat JSON file, not a database — same pattern every zero-dependency
// product in this repo uses for state that needs to survive between runs.
// The read/write helpers touch the filesystem; the lookup/update helpers
// are plain object functions so the dedupe logic itself has a test that
// doesn't need a real file on disk.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/**
 * @param {string} path
 * @returns {Record<string, {sentThresholds:number[], lastSentAt?:string}>}
 */
export function loadState(path) {
  if (!existsSync(path)) return {}
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(`Could not read state file at "${path}": ${err.message}`)
  }
  if (!raw.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`"${path}" is not valid JSON: ${err.message}`)
  }
}

/**
 * @param {string} path
 * @param {object} state
 */
export function saveState(path, state) {
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n')
}

/**
 * @param {object} state
 * @param {string} invoiceId
 * @returns {number[]}
 */
export function getSentThresholds(state, invoiceId) {
  return state[invoiceId]?.sentThresholds ?? []
}

/**
 * @param {object} state
 * @param {string} invoiceId
 * @param {number} days
 * @returns {boolean}
 */
export function hasReminderBeenSent(state, invoiceId, days) {
  return getSentThresholds(state, invoiceId).includes(days)
}

/**
 * Records that a reminder for `days` went out for `invoiceId`. Mutates and
 * returns `state` so callers can chain it across a batch of invoices before
 * a single saveState() call at the end of the run.
 *
 * @param {object} state
 * @param {string} invoiceId
 * @param {number} days
 * @param {string} [sentAt]  ISO timestamp; defaults to now
 * @returns {object} state
 */
export function recordReminderSent(state, invoiceId, days, sentAt = new Date().toISOString()) {
  const entry = state[invoiceId] ?? { sentThresholds: [] }
  if (!entry.sentThresholds.includes(days)) entry.sentThresholds.push(days)
  entry.lastSentAt = sentAt
  state[invoiceId] = entry
  return state
}

/**
 * Drops entries for invoices no longer present in the current Stripe pull
 * (i.e. paid, voided, or deleted) so state.json doesn't grow forever.
 *
 * @param {object} state
 * @param {string[]} currentInvoiceIds
 * @returns {object} a new state object containing only current invoices
 */
export function pruneState(state, currentInvoiceIds) {
  const keep = new Set(currentInvoiceIds)
  const next = {}
  for (const [id, entry] of Object.entries(state)) {
    if (keep.has(id)) next[id] = entry
  }
  return next
}
