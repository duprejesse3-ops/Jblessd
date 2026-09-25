// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The one decision this whole product makes: given a current stock level and
// a configured threshold, does this line need a purchase order? Kept as its
// own tiny, pure module so the decision has a test independent of the
// Shopify/email plumbing around it.

/**
 * @param {number} available   current stock level from Shopify
 * @param {number} threshold   the configured reorder point for this SKU
 * @returns {boolean}
 */
export function needsReorder(available, threshold) {
  if (!Number.isFinite(threshold) || threshold <= 0) return false
  return Number.isFinite(available) && available <= threshold
}

/**
 * Groups the configured lines that currently need a reorder by supplier, so
 * one supplier with three low SKUs gets ONE combined PO/email, not three.
 *
 * @param {Array<{sku:string,name:string,available:number,threshold:number,
 *   reorderQty:number,unitCost?:number,supplierName:string,supplierEmail:string}>} lines
 *   `available` must already be attached to each line (see bin/sync.mjs).
 * @returns {Map<string, {supplierName:string, supplierEmail:string, items:Array}>}
 *   keyed by supplierEmail
 */
export function groupReorderBySupplier(lines) {
  const bySupplier = new Map()
  for (const line of lines) {
    if (!needsReorder(line.available, line.threshold)) continue
    const key = line.supplierEmail
    if (!bySupplier.has(key)) {
      bySupplier.set(key, { supplierName: line.supplierName, supplierEmail: line.supplierEmail, items: [] })
    }
    bySupplier.get(key).items.push(line)
  }
  return bySupplier
}
