// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync } from 'node:fs'
import { daysOverdue, selectThresholdToSend } from '../lib/overdue.mjs'
import {
  loadState,
  saveState,
  hasReminderBeenSent,
  recordReminderSent,
  getSentThresholds,
  pruneState,
} from '../lib/state.mjs'
import { buildReminderEmail } from '../lib/reminder-email.mjs'
import { sendReminderEmail } from '../lib/mailer.mjs'
import { loadConfig } from '../lib/config.mjs'
import { normalizeInvoice } from '../lib/stripe-client.mjs'

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

const THRESHOLDS = [
  { days: 3, label: 'Friendly reminder', tone: 'friendly' },
  { days: 7, label: 'Firmer reminder', tone: 'firm' },
  { days: 14, label: 'Final notice', tone: 'final' },
]

// ---- daysOverdue -----------------------------------------------------------

await test('daysOverdue: counts whole days past a due date', () => {
  const due = new Date('2026-01-01T00:00:00Z')
  const now = new Date('2026-01-06T00:00:00Z')
  assert.equal(daysOverdue(due, now), 5)
})

await test('daysOverdue: zero on the due date itself, negative before it', () => {
  const due = new Date('2026-01-01T00:00:00Z')
  assert.equal(daysOverdue(due, new Date('2026-01-01T00:00:00Z')), 0)
  assert.equal(daysOverdue(due, new Date('2025-12-30T00:00:00Z')), -2)
})

await test('daysOverdue: accepts an ISO string, not just a Date', () => {
  assert.equal(daysOverdue('2026-01-01T00:00:00Z', new Date('2026-01-04T00:00:00Z')), 3)
})

await test('daysOverdue: rejects an invalid date', () => {
  assert.throws(() => daysOverdue('not-a-date'), /Invalid due date/)
})

// ---- selectThresholdToSend --------------------------------------------------

await test('selectThresholdToSend: not overdue yet -> nothing to send', () => {
  assert.equal(selectThresholdToSend(-1, THRESHOLDS, []), null)
  assert.equal(selectThresholdToSend(0, THRESHOLDS, []), null)
})

await test('selectThresholdToSend: below the first threshold -> nothing to send', () => {
  assert.equal(selectThresholdToSend(2, THRESHOLDS, []), null)
})

await test('selectThresholdToSend: crosses first threshold, none sent yet', () => {
  const t = selectThresholdToSend(5, THRESHOLDS, [])
  assert.equal(t.days, 3)
})

await test('selectThresholdToSend: already sent the only crossed threshold -> nothing new', () => {
  assert.equal(selectThresholdToSend(5, THRESHOLDS, [3]), null)
})

await test('selectThresholdToSend: catches up to the highest crossed-but-unsent threshold, not a flood', () => {
  // Gone unchecked long enough to cross both day-3 and day-7; day-3 already
  // sent. Should escalate straight to day-7, not re-send day-3.
  const t = selectThresholdToSend(10, THRESHOLDS, [3])
  assert.equal(t.days, 7)
})

await test('selectThresholdToSend: all thresholds already sent -> nothing to send', () => {
  assert.equal(selectThresholdToSend(30, THRESHOLDS, [3, 7, 14]), null)
})

await test('selectThresholdToSend: exactly at a threshold day counts as crossed', () => {
  const t = selectThresholdToSend(7, THRESHOLDS, [])
  assert.equal(t.days, 7)
})

// ---- state (dedupe tracking) ------------------------------------------------

await test('state: hasReminderBeenSent/recordReminderSent round-trip', () => {
  let state = {}
  assert.equal(hasReminderBeenSent(state, 'in_123', 3), false)
  state = recordReminderSent(state, 'in_123', 3, '2026-01-05T00:00:00Z')
  assert.equal(hasReminderBeenSent(state, 'in_123', 3), true)
  assert.equal(hasReminderBeenSent(state, 'in_123', 7), false)
  assert.deepEqual(getSentThresholds(state, 'in_123'), [3])
})

await test('state: recording the same threshold twice does not duplicate it', () => {
  let state = {}
  state = recordReminderSent(state, 'in_1', 3)
  state = recordReminderSent(state, 'in_1', 3)
  assert.deepEqual(getSentThresholds(state, 'in_1'), [3])
})

await test('state: tracks multiple invoices independently', () => {
  let state = {}
  state = recordReminderSent(state, 'in_a', 3)
  state = recordReminderSent(state, 'in_b', 7)
  assert.deepEqual(getSentThresholds(state, 'in_a'), [3])
  assert.deepEqual(getSentThresholds(state, 'in_b'), [7])
})

await test('state: pruneState drops invoices no longer present', () => {
  let state = {}
  state = recordReminderSent(state, 'in_stale', 3)
  state = recordReminderSent(state, 'in_current', 3)
  const pruned = pruneState(state, ['in_current'])
  assert.deepEqual(Object.keys(pruned), ['in_current'])
})

await test('state: loadState returns {} for a missing file', () => {
  const path = new URL('./tmp-missing-state.json', import.meta.url).pathname
  assert.deepEqual(loadState(path), {})
})

await test('state: saveState/loadState round-trip through disk', () => {
  const path = new URL('./tmp-state.json', import.meta.url).pathname
  let state = recordReminderSent({}, 'in_9', 14, '2026-02-01T00:00:00Z')
  saveState(path, state)
  try {
    const reloaded = loadState(path)
    assert.equal(hasReminderBeenSent(reloaded, 'in_9', 14), true)
  } finally {
    unlinkSync(path)
  }
})

// ---- buildReminderEmail ------------------------------------------------------

await test('buildReminderEmail: names the customer, amount, and days overdue', () => {
  const invoice = {
    id: 'in_1',
    number: 'INV-001',
    customerName: 'Dana Ortiz',
    customerEmail: 'dana@example.com',
    amountDue: 45000,
    currency: 'usd',
    dueDate: '2026-01-01T00:00:00Z',
    hostedInvoiceUrl: 'https://pay.stripe.com/invoice/xyz',
    daysOverdue: 5,
  }
  const email = buildReminderEmail({ invoice, threshold: THRESHOLDS[0], storeName: 'Acme Studio' })
  assert.match(email.subject, /INV-001/)
  assert.match(email.subject, /5 days overdue/)
  assert.match(email.text, /Dana Ortiz/)
  assert.match(email.text, /USD 450\.00/)
  assert.match(email.text, /pay\.stripe\.com/)
  assert.match(email.html, /Dana Ortiz/)
  assert.match(email.html, /pay\.stripe\.com/)
})

await test('buildReminderEmail: falls back to a generic greeting with no customer name', () => {
  const invoice = {
    id: 'in_2', number: null, customerName: null, customerEmail: 'x@example.com',
    amountDue: 1000, currency: 'usd', dueDate: '2026-01-01T00:00:00Z',
    hostedInvoiceUrl: null, daysOverdue: 1,
  }
  const email = buildReminderEmail({ invoice, threshold: THRESHOLDS[0] })
  assert.match(email.text, /^Hi,/)
  assert.match(email.subject, /1 day overdue/) // singular, not "1 days"
})

await test('buildReminderEmail: escapes HTML in the customer name', () => {
  const invoice = {
    id: 'in_3', number: 'INV-3', customerName: '<script>alert(1)</script>', customerEmail: 'x@example.com',
    amountDue: 500, currency: 'usd', dueDate: '2026-01-01T00:00:00Z',
    hostedInvoiceUrl: null, daysOverdue: 4,
  }
  const email = buildReminderEmail({ invoice, threshold: THRESHOLDS[0] })
  assert.ok(!email.html.includes('<script>'))
  assert.match(email.html, /&lt;script&gt;/)
})

await test('buildReminderEmail: requires invoice and threshold', () => {
  assert.throws(() => buildReminderEmail({ threshold: THRESHOLDS[0] }), /invoice/)
  assert.throws(() => buildReminderEmail({ invoice: {} }), /threshold/)
})

// ---- mailer -------------------------------------------------------------------

await test('sendReminderEmail: is a no-op (dry run) with no API key configured', async () => {
  const sent = await sendReminderEmail({ to: 'a@b.example', subject: 'x', text: 'x' }, '')
  assert.equal(sent, false)
})

await test('sendReminderEmail: rejects a missing recipient even with a key present', async () => {
  await assert.rejects(() => sendReminderEmail({ subject: 'x', text: 'x' }, 'fake-key'), /email\.to/)
})

// ---- config -------------------------------------------------------------------

await test('loadConfig: rejects a config entry missing a required field', () => {
  const path = new URL('./tmp-bad-config.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify([{ days: 3 }]))
  try {
    assert.throws(() => loadConfig(path), /missing required field/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: rejects a non-positive threshold', () => {
  const path = new URL('./tmp-bad-days.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify([{ days: 0, label: 'x' }]))
  try {
    assert.throws(() => loadConfig(path), /positive integer/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: rejects a duplicate threshold day', () => {
  const path = new URL('./tmp-dup-days.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify([{ days: 3, label: 'a' }, { days: 3, label: 'b' }]))
  try {
    assert.throws(() => loadConfig(path), /more than one threshold/)
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: sorts thresholds ascending by day regardless of input order', () => {
  const path = new URL('./tmp-unsorted.json', import.meta.url).pathname
  writeFileSync(path, JSON.stringify([{ days: 14, label: 'c' }, { days: 3, label: 'a' }, { days: 7, label: 'b' }]))
  try {
    const config = loadConfig(path)
    assert.deepEqual(config.map((c) => c.days), [3, 7, 14])
  } finally {
    unlinkSync(path)
  }
})

await test('loadConfig: accepts the shipped config.example.json as-is', () => {
  const path = new URL('../config.example.json', import.meta.url).pathname
  const config = loadConfig(path)
  assert.ok(config.length >= 1)
})

// ---- stripe-client normalization ------------------------------------------

await test('normalizeInvoice: maps Stripe fields into the flat internal shape', () => {
  const raw = {
    id: 'in_abc',
    number: 'INV-42',
    customer_name: 'Jordan Lee',
    customer_email: 'jordan@example.com',
    amount_due: 12345,
    currency: 'usd',
    due_date: Math.floor(new Date('2026-03-01T00:00:00Z').getTime() / 1000),
    hosted_invoice_url: 'https://pay.stripe.com/invoice/abc',
  }
  const normalized = normalizeInvoice(raw)
  assert.equal(normalized.id, 'in_abc')
  assert.equal(normalized.number, 'INV-42')
  assert.equal(normalized.amountDue, 12345)
  assert.equal(normalized.dueDate, '2026-03-01T00:00:00.000Z')
  assert.equal(normalized.hostedInvoiceUrl, 'https://pay.stripe.com/invoice/abc')
})

await test('normalizeInvoice: tolerates missing optional fields', () => {
  const raw = { id: 'in_min', amount_due: 0, due_date: 1700000000 }
  const normalized = normalizeInvoice(raw)
  assert.equal(normalized.number, null)
  assert.equal(normalized.customerName, null)
  assert.equal(normalized.currency, 'usd')
})

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exitCode = failures === 0 ? 0 : 1
