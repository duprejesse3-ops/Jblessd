// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { isLowStock } from '../lib/inventory-alerts.mjs'

test('flags stock at or below the threshold', () => {
  assert.equal(isLowStock(10, 10), true)
  assert.equal(isLowStock(3, 10), true)
  assert.equal(isLowStock(0, 10), true)
})

test('does not flag stock above the threshold', () => {
  assert.equal(isLowStock(11, 10), false)
  assert.equal(isLowStock(500, 10), false)
})

test('does not flag anything when threshold is unset or invalid', () => {
  assert.equal(isLowStock(1, 0), false)
  assert.equal(isLowStock(1, -5), false)
  assert.equal(isLowStock(1, NaN), false)
})

test('handles non-finite available gracefully', () => {
  assert.equal(isLowStock(NaN, 10), false)
  assert.equal(isLowStock(Infinity, 10), false)
})
