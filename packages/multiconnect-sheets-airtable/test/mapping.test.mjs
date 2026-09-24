// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { applyMapping } from '../lib/mapping.mjs'

test('applyMapping renames fields per the rules', () => {
  const out = applyMapping({ Name: 'Ada', Email: 'ada@example.com' }, [
    { id: '1', sourcePath: 'Name', targetField: 'full_name' },
    { id: '2', sourcePath: 'Email', targetField: 'email' },
  ])
  assert.deepEqual(out, { full_name: 'Ada', email: 'ada@example.com' })
})

test('applyMapping drops unmapped fields', () => {
  const out = applyMapping({ Name: 'Ada', Secret: 'x' }, [{ id: '1', sourcePath: 'Name', targetField: 'full_name' }])
  assert.deepEqual(out, { full_name: 'Ada' })
})

test('applyMapping skips a rule whose source field is missing', () => {
  const out = applyMapping({ a: 1 }, [{ id: '1', sourcePath: 'b', targetField: 'x' }])
  assert.deepEqual(out, {})
})

test('applyMapping with no rules returns an empty object', () => {
  const out = applyMapping({ a: 1, b: 2 }, [])
  assert.deepEqual(out, {})
})
