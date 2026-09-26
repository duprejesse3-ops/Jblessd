// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Per-domain enrichment cache, so re-running against a lead list you've
// already researched doesn't re-fetch the site or re-spend an API call on
// a domain it already has an answer for. Same flat-JSON-file pattern as
// every other MultiNicheAI automation that needs state between runs (see
// invoice-chaser's lib/state.mjs).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

/**
 * @param {string} path
 * @returns {Record<string, object>}
 */
export function loadCache(path) {
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
 * @param {object} cache
 */
export function saveCache(path, cache) {
  writeFileSync(path, JSON.stringify(cache, null, 2) + '\n')
}

/**
 * @param {object} cache
 * @param {string} domain
 * @returns {boolean}
 */
export function hasCached(cache, domain) {
  return Object.prototype.hasOwnProperty.call(cache, domain)
}

/**
 * @param {object} cache
 * @param {string} domain
 * @param {object} result
 * @returns {object} cache, for chaining across a batch before one save
 */
export function recordCache(cache, domain, result) {
  cache[domain] = { ...result, cachedAt: new Date().toISOString() }
  return cache
}
