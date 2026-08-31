// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { createHmac } from 'node:crypto'
import { verifyShopifyWebhook } from '../lib/webhook-verify.mjs'

function sign(body, secret) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64')
}

test('accepts a correctly signed payload', () => {
  const body = JSON.stringify({ id: 123, total_price: '42.00' })
  const secret = 'test-secret'
  const signature = sign(body, secret)
  assert.equal(verifyShopifyWebhook(body, signature, secret), true)
})

test('rejects a payload signed with the wrong secret', () => {
  const body = JSON.stringify({ id: 123 })
  const signature = sign(body, 'wrong-secret')
  assert.equal(verifyShopifyWebhook(body, signature, 'real-secret'), false)
})

test('rejects a tampered body even with a valid-looking signature', () => {
  const secret = 'test-secret'
  const originalBody = JSON.stringify({ id: 123, total_price: '42.00' })
  const signature = sign(originalBody, secret)
  const tamperedBody = JSON.stringify({ id: 123, total_price: '999999.00' })
  assert.equal(verifyShopifyWebhook(tamperedBody, signature, secret), false)
})

test('rejects when secret is not configured', () => {
  const body = JSON.stringify({ id: 1 })
  const signature = sign(body, 'anything')
  assert.equal(verifyShopifyWebhook(body, signature, ''), false)
  assert.equal(verifyShopifyWebhook(body, signature, null), false)
})

test('rejects when signature header is missing', () => {
  const body = JSON.stringify({ id: 1 })
  assert.equal(verifyShopifyWebhook(body, '', 'a-secret'), false)
})

test('rejects a signature of different length without throwing', () => {
  const body = JSON.stringify({ id: 1 })
  assert.equal(verifyShopifyWebhook(body, 'short', 'a-secret'), false)
})
