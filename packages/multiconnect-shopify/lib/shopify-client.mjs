// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A thin wrapper over Shopify's Admin REST API — the "product/inventory sync"
// and "order visibility" halves of the connector. Every write path checks
// safeMode first, so a read-only install physically cannot mutate the store
// no matter what the agent asks for.

import { API_VERSION } from './config.mjs'

const REQUEST_TIMEOUT_MS = 10_000

class ShopifyApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ShopifyApiError'
    this.status = status
  }
}

/**
 * @param {import('./config.mjs').ShopifyConfig} config
 * @param {string} path e.g. "/products.json"
 * @param {{ method?: string, body?: unknown }} [opts]
 */
async function request(config, path, opts = {}) {
  if (!config.shopDomain || !config.accessToken) {
    throw new ShopifyApiError('Store is not connected yet — set the shop domain and access token first.', 0)
  }
  // Real Shopify domains are always myshopify.com or a custom domain over
  // HTTPS. localhost is never a legitimate target — allowing it over plain
  // HTTP exists solely so the test suite can point this at a local fixture
  // server instead of hitting the real internet.
  const protocol = config.shopDomain.startsWith('localhost') || config.shopDomain.startsWith('127.0.0.1') ? 'http' : 'https'
  const url = `${protocol}://${config.shopDomain}/admin/api/${API_VERSION}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ShopifyApiError(`Shopify API ${res.status}: ${text.slice(0, 300)}`, res.status)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Guard every write path — throws instead of silently no-op-ing so the caller sees exactly why nothing happened. */
function assertWritable(config) {
  if (config.safeMode !== 'read-write') {
    throw new ShopifyApiError('Refused: safe mode is read-only. Switch to read-write in the dashboard to allow writes.', 0)
  }
}

/** @param {import('./config.mjs').ShopifyConfig} config */
export async function listProducts(config, limit = 50) {
  const data = await request(config, `/products.json?limit=${limit}`)
  return data.products ?? []
}

/** @param {import('./config.mjs').ShopifyConfig} config */
export async function getInventoryLevels(config, inventoryItemIds) {
  if (!inventoryItemIds.length) return []
  const data = await request(config, `/inventory_levels.json?inventory_item_ids=${inventoryItemIds.join(',')}`)
  return data.inventory_levels ?? []
}

/** @param {import('./config.mjs').ShopifyConfig} config */
export async function listOrders(config, { status = 'any', limit = 50 } = {}) {
  const data = await request(config, `/orders.json?status=${status}&limit=${limit}`)
  return data.orders ?? []
}

/**
 * Update a variant's price. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').ShopifyConfig} config
 */
export async function updateVariantPrice(config, variantId, price) {
  assertWritable(config)
  const data = await request(config, `/variants/${variantId}.json`, {
    method: 'PUT',
    body: { variant: { id: variantId, price: String(price) } },
  })
  return data.variant
}

/**
 * Adjust inventory at a location. Refuses outright unless safe mode is read-write.
 * @param {import('./config.mjs').ShopifyConfig} config
 */
export async function adjustInventory(config, inventoryItemId, locationId, adjustment) {
  assertWritable(config)
  const data = await request(config, '/inventory_levels/adjust.json', {
    method: 'POST',
    body: { inventory_item_id: inventoryItemId, location_id: locationId, available_adjustment: adjustment },
  })
  return data.inventory_level
}

export { ShopifyApiError }
