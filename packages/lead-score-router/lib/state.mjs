// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Dedupe state: which lead IDs have already been scored and routed, so
// re-running against the same export (or a nightly export that re-includes
// older rows) never double-posts to Slack. Same flat-JSON-file pattern as
// every other MultiNicheAI automation that needs state between runs (see
// invoice-chaser's lib/state.mjs, which this mirrors).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/**
 * @param {string} path
 * @returns {Record<string, {score:number, tier:string, routedAt:string}>}
 */
export function loadState(path) {
  if (!existsSync(path)) return {}
  const raw = readFileSync(path, 'utf8')
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
 * @param {string} leadId
 * @returns {boolean}
 */
export function hasBeenRouted(state, leadId) {
  return Object.prototype.hasOwnProperty.call(state, leadId)
}

/**
 * @param {object} state
 * @param {string} leadId
 * @param {{score:number, tier:string}} result
 * @returns {object} state, for chaining across a batch before one save
 */
export function recordRouted(state, leadId, result) {
  state[leadId] = { ...result, routedAt: new Date().toISOString() }
  return state
}
