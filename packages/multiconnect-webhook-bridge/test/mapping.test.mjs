// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { applyMapping, getByPath } from '../lib/mapping.mjs'

test('getByPath resolves a simple dotted path', () => {
  assert.equal(getByPath({ order: { email: 'a@b.com' } }, 'order.email'), 'a@b.com')
})

test('getByPath resolves an array index', () => {
  assert.equal(getByPath({ items: [{ sku: 'X1' }] }, 'items[0].sku'), 'X1')
})

test('getByPath returns undefined for a missing path, never throws', () => {
  assert.equal(getByPath({ a: 1 }, 'a.b.c'), undefined)
  assert.equal(getByPath(null, 'a.b'), undefined)
  assert.equal(getByPath(undefined, 'a'), undefined)
})

test('applyMapping builds an object from mapped fields only', () => {
  const source = { order: { email: 'a@b.com', total: 42 }, ignored: 'x' }
  const rules = [
    { id: '1', sourcePath: 'order.email', targetField: 'customer_email' },
    { id: '2', sourcePath: 'order.total', targetField: 'amount' },
  ]
  const out = applyMapping(source, rules)
  assert.deepEqual(out, { customer_email: 'a@b.com', amount: 42 })
  assert.ok(!('ignored' in out), 'unmapped fields must not leak through')
})

test('applyMapping supports nested target fields', () => {
  const out = applyMapping({ email: 'a@b.com' }, [{ id: '1', sourcePath: 'email', targetField: 'customer.email' }])
  assert.deepEqual(out, { customer: { email: 'a@b.com' } })
})

test('applyMapping skips a rule whose source path is missing', () => {
  const out = applyMapping({ a: 1 }, [{ id: '1', sourcePath: 'b', targetField: 'x' }])
  assert.deepEqual(out, {})
})
