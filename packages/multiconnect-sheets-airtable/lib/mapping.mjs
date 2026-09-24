// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Applies a saved list of mapping rules (source field -> target field) to a
// plain row object. Same shape as MultiConnect's webhook bridge mapping
// engine — column names instead of JSON paths, but the same idea: no manual
// reformatting, the customer builds the mapping by clicking in the dashboard.

/**
 * @param {Record<string, unknown>} source
 * @param {import('./config.mjs').MappingRule[]} rules
 * @returns {Record<string, unknown>}
 */
export function applyMapping(source, rules) {
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const rule of rules) {
    const value = source?.[rule.sourcePath]
    if (value !== undefined) out[rule.targetField] = value
  }
  return out
}
