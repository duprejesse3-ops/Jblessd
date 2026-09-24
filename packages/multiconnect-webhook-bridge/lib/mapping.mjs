// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a saved list of mapping rules (source JSON path -> target field name)
// into an actual transformed payload. This is what replaces "no manual JSON
// editing" — the customer builds these rules by clicking in the dashboard UI
// (server.mjs's /api/mappings routes), and this module is the only thing
// that actually reads them at request time.

/**
 * Resolve a dotted/bracketed path like "order.items[0].sku" against an
 * object. Returns undefined if any segment along the way is missing —
 * mapping a field that isn't present in a given payload should never throw,
 * it should just come through as empty.
 * @param {unknown} obj
 * @param {string} pathExpr
 */
function getByPath(obj, pathExpr) {
  const segments = pathExpr
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur = obj
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = /** @type {Record<string, unknown>} */ (cur)[seg]
  }
  return cur
}

/**
 * @param {Record<string, unknown>} target
 * @param {string} fieldName
 * @param {unknown} value
 */
function setField(target, fieldName, value) {
  // Target fields can also be dotted, so the customer can shape a nested
  // outbound payload (e.g. "customer.email") without needing raw JSON.
  const segments = fieldName.split('.').filter(Boolean)
  let cur = target
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {}
    cur = /** @type {Record<string, unknown>} */ (cur[seg])
  }
  cur[segments[segments.length - 1]] = value
}

/**
 * Apply a list of mapping rules to a source payload, producing a new object
 * built entirely from the mapped fields. Unmapped source fields are dropped
 * on purpose — the mapping *is* the contract for what leaves this machine.
 * @param {unknown} sourcePayload
 * @param {import('./config.mjs').MappingRule[]} rules
 * @returns {Record<string, unknown>}
 */
export function applyMapping(sourcePayload, rules) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const rule of rules) {
    const value = getByPath(sourcePayload, rule.sourcePath)
    if (value !== undefined) setField(out, rule.targetField, value)
  }
  return out
}

export { getByPath }
