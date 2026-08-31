// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The "instant triggers" feature: when an inventory level webhook comes in,
// decide whether it crosses the customer's configured low-stock threshold —
// kept as its own tiny module so the decision logic has a test of its own,
// independent of the webhook plumbing around it.

/**
 * @param {number} available current stock level after the update
 * @param {number} threshold the customer's configured alert threshold
 * @returns {boolean} true if this level should fire a low-stock alert
 */
export function isLowStock(available, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0) return false
  return Number.isFinite(available) && available <= threshold
}
