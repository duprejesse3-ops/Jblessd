// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.
//
// Runs the real client against a local fixture HTTP server standing in for
// Shopify's API — same approach as the webhook bridge's outbound tests. No
// network access, no real store required to verify the request/response
// handling and the safe-mode write guard.

import assert from 'node:assert/strict'
import test from 'node:test'
import http from 'node:http'
import { listProducts, listOrders, updateVariantPrice, ShopifyApiError } from '../lib/shopify-client.mjs'

/** Starts a fixture server standing in for a Shopify shop domain. */
function startFixture(handler) {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, shopDomain: `localhost:${server.address().port}` }))
  })
}

test('listProducts returns the products array', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    assert.equal(req.headers['x-shopify-access-token'], 'test-token')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ products: [{ id: 1, title: 'Mug' }] }))
  })
  try {
    const config = { shopDomain, accessToken: 'test-token', safeMode: 'read-only' }
    const products = await listProducts(config)
    assert.deepEqual(products, [{ id: 1, title: 'Mug' }])
  } finally {
    server.close()
  }
})

test('listOrders returns the orders array', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ orders: [{ id: 99, total_price: '42.00' }] }))
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-only' }
    const orders = await listOrders(config)
    assert.equal(orders[0].id, 99)
  } finally {
    server.close()
  }
})

test('throws a clear error when the store is not connected', async () => {
  await assert.rejects(
    () => listProducts({ shopDomain: null, accessToken: null, safeMode: 'read-only' }),
    (err) => err instanceof ShopifyApiError && /not connected/.test(err.message),
  )
})

test('updateVariantPrice refuses when safe mode is read-only, without making a request', async () => {
  let called = false
  const { server, shopDomain } = await startFixture((req, res) => {
    called = true
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ variant: {} }))
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-only' }
    await assert.rejects(
      () => updateVariantPrice(config, 1, '19.99'),
      (err) => err instanceof ShopifyApiError && /read-only/.test(err.message),
    )
    assert.equal(called, false, 'no HTTP request should have been made')
  } finally {
    server.close()
  }
})

test('updateVariantPrice succeeds when safe mode is read-write', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    assert.equal(req.method, 'PUT')
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ variant: { id: 1, price: '19.99' } }))
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-write' }
    const variant = await updateVariantPrice(config, 1, '19.99')
    assert.equal(variant.price, '19.99')
  } finally {
    server.close()
  }
})

test('surfaces a Shopify API error with the status code attached', async () => {
  const { server, shopDomain } = await startFixture((req, res) => {
    res.writeHead(429, { 'content-type': 'text/plain' })
    res.end('Too many requests')
  })
  try {
    const config = { shopDomain, accessToken: 'tok', safeMode: 'read-only' }
    await assert.rejects(
      () => listProducts(config),
      (err) => err instanceof ShopifyApiError && err.status === 429,
    )
  } finally {
    server.close()
  }
})
