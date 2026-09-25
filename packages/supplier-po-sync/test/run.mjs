// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync } from 'node:fs'
import { needsReorder, groupReorderBySupplier } from '../lib/threshold.mjs'
import { buildPoCsv, buildPoEmailBody, generatePoNumber } from '../lib/po-builder.mjs'
import { sendPoEmail } from '../lib/mailer.mjs'
import { loadConfig } from '../lib/config.mjs'

let failures = 0
async function test(name, fn) {
  try {
    await fn()
    console.log(`ok - ${name}`)
  } catch (err) {
    failures++
    console.error(`not ok - ${name}`)
    console.error(`  ${err.message}`)
  }
}

await test('needsReorder: below threshold triggers, above does not', () => {
  assert.equal(needsReorder(5, 20), true)
  assert.equal(needsReorder(20, 20), true) // at threshold counts as needing reorder
  assert.equal(needsReorder(21, 20), false)
})

await test('needsReorder: ignores a zero/unset threshold rather than always firing', () => {
  assert.equal(needsReorder(0, 0), false)
  assert.equal(needsReorder(0, undefined), false)
})

await test('groupReorderBySupplier: combines multiple low SKUs for the same supplier into one PO', () => {
  const lines = [
    { sku: 'A', name: 'A', available: 1, threshold: 10, reorderQty: 50, supplierName: 'Acme', supplierEmail: 'a@acme.example' },
    { sku: 'B', name: 'B', available: 2, threshold: 10, reorderQty: 20, supplierName: 'Acme', supplierEmail: 'a@acme.example' },
    { sku: 'C', name: 'C', available: 999, threshold: 10, reorderQty: 5, supplierName: 'Acme', supplierEmail: 'a@acme.example' },
    { sku: 'D', name: 'D', available: 1, threshold: 10, reorderQty: 5, supplierName: 'Other', supplierEmail: 'x@other.example' },
  ]
  const grouped = groupReorderBySupplier(lines)
  assert.equal(grouped.size, 2)
  assert.equal(grouped.get('a@acme.example').items.length, 2) // C is fine, excluded
  assert.equal(grouped.get('x@other.example').items.length, 1)
})

await test('buildPoCsv: produces a header row, one row per item, and totals when cost is known', () => {
  const csv = buildPoCsv('PO-TEST-001', [
    { sku: 'A', name: 'Widget', available: 3, reorderQty: 10, unitCost: 2 },
  ])
  const rows = csv.trim().split('\n')
  assert.equal(rows.length, 3) // header + item + total
  assert.match(rows[1], /PO-TEST-001,A,Widget,3,10,2\.00,20\.00/)
  assert.match(rows[2], /Total,20\.00/)
})

await test('buildPoCsv: skips the total row when no item has a cost', () => {
  const csv = buildPoCsv('PO-TEST-002', [{ sku: 'A', name: 'Widget', available: 3, reorderQty: 10 }])
  assert.equal(csv.trim().split('\n').length, 2) // header + item, no total row
})

await test('buildPoCsv: quotes a field containing a comma', () => {
  const csv = buildPoCsv('PO-TEST-003', [{ sku: 'A', name: 'Widget, Blue', available: 1, reorderQty: 1 }])
  assert.match(csv, /"Widget, Blue"/)
})

await test('buildPoEmailBody: names every item and the supplier', () => {
  const body = buildPoEmailBody('PO-TEST-004', 'Acme Supply', [
    { sku: 'A', name: 'Widget', available: 3, reorderQty: 10 },
  ], 'My Store')
  assert.match(body, /Acme Supply/)
  assert.match(body, /Widget \(A\): 10 units/)
  assert.match(body, /My Store/)
})

await test('generatePoNumber: date-stamped and zero-padded', () => {
  const n = generatePoNumber(3, new Date(Date.UTC(2026, 0, 5)))
  assert.equal(n, 'PO-20260105-003')
})

await test('sendPoEmail: is a no-op (dry run) with no API key configured', async () => {
  const sent = await sendPoEmail({ to: 'a@b.example', subject: 'x', text: 'x' }, '')
  assert.equal(sent, false)
})

await test('sendPoEmail: rejects a missing recipient even with a key present', async () => {
  await assert.rejects(() => sendPoEmail({ subject: 'x', text: 'x' }, 'fake-key'), /email\.to/)
})

await test('loadConfig: rejects a config entry missing a required field', () => {
  const path = new URL('./tmp-bad-config.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify([{ sku: 'A', name: 'A' }]))
  try {
    assert.throws(() => loadConfig(path), /missing required field/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: rejects an invalid supplier email', () => {
  const path = new URL('./tmp-bad-email.json', import.meta.url).pathname
  writeFileSync(
    path,
    JSON.stringify([{ sku: 'A', name: 'A', threshold: 1, reorderQty: 1, supplierName: 'X', supplierEmail: 'not-an-email' }]),
  )
  try {
    assert.throws(() => loadConfig(path), /valid email/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: accepts the shipped config.example.json as-is', () => {
  const path = new URL('../config.example.json', import.meta.url).pathname
  const config = loadConfig(path)
  assert.ok(config.length >= 1)
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
