// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads current stock levels from Shopify's Admin REST API. Deliberately
// narrow — this product only ever needs "how many of this SKU are available
// right now," nothing else about your store. A private/custom app token
// scoped to read_inventory + read_products is all it needs; it never writes
// to Shopify.

const API_VERSION = '2024-10'

function storeUrl(store) {
  const s = store ?? process.env.SHOPIFY_STORE
  if (!s) throw new Error('SHOPIFY_STORE is not set (e.g. "your-shop.myshopify.com").')
  return `https://${s}/admin/api/${API_VERSION}`
}

function authHeaders(token) {
  const t = token ?? process.env.SHOPIFY_ACCESS_TOKEN
  if (!t) throw new Error('SHOPIFY_ACCESS_TOKEN is not set — create a custom app with read_inventory + read_products scopes.')
  return { 'X-Shopify-Access-Token': t, 'Content-Type': 'application/json' }
}

/**
 * Looks up current available stock for a list of SKUs. Shopify's REST API
 * has no "get by SKU" endpoint, so this does one product-search call per
 * SKU (fine at the scale a single-store PO run needs — dozens of SKUs, run
 * every few hours, not thousands run every minute).
 *
 * @param {string[]} skus
 * @param {object} [options]
 * @param {string} [options.store]
 * @param {string} [options.token]
 * @returns {Promise<Map<string, number>>} sku -> total available across all locations
 */
export async function getAvailableBySku(skus, options = {}) {
  const base = storeUrl(options.store)
  const headers = authHeaders(options.token)
  const result = new Map()

  for (const sku of skus) {
    const res = await fetch(`${base}/products.json?fields=variants&limit=1&sku=${encodeURIComponent(sku)}`, { headers })
    if (!res.ok) {
      throw new Error(`Shopify API returned HTTP ${res.status} looking up SKU "${sku}"`)
    }
    const data = await res.json()
    const variant = data?.products?.[0]?.variants?.find((v) => v.sku === sku)
    // inventory_quantity on the variant is Shopify's own summed-across-locations
    // total — no need to walk inventory_levels separately for this use case.
    result.set(sku, variant ? Number(variant.inventory_quantity ?? 0) : 0)
  }

  return result
}
