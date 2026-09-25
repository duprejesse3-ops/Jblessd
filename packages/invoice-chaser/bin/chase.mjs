#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point: reads config.json (the escalation ladder), pulls every real
// open Stripe invoice with a due date, works out which ones are overdue and
// which escalation threshold (if any) each one has newly crossed, sends a
// reminder email per invoice that needs one, and records what was sent in
// state.json so the same threshold never re-fires. Safe to run as often as
// you like — an invoice that hasn't crossed a new threshold isn't touched.

import { loadConfig } from '../lib/config.mjs'
import { getOpenInvoices } from '../lib/stripe-client.mjs'
import { daysOverdue, selectThresholdToSend } from '../lib/overdue.mjs'
import { buildReminderEmail } from '../lib/reminder-email.mjs'
import { sendReminderEmail } from '../lib/mailer.mjs'
import { postSummary } from '../lib/slack.mjs'
import { loadState, saveState, getSentThresholds, recordReminderSent, pruneState } from '../lib/state.mjs'

async function main() {
  const configPath = process.env.CHASER_CONFIG_PATH ?? new URL('../config.json', import.meta.url).pathname
  const statePath = process.env.CHASER_STATE_PATH ?? new URL('../state.json', import.meta.url).pathname

  const thresholds = loadConfig(configPath)
  let state = loadState(statePath)

  const invoices = await getOpenInvoices()
  const now = new Date()

  const reminders = []
  let totalOutstandingCents = 0
  let currency = 'usd'

  for (const invoice of invoices) {
    totalOutstandingCents += invoice.amountDue
    currency = invoice.currency ?? currency

    const overdueBy = daysOverdue(invoice.dueDate, now)
    if (overdueBy <= 0) continue // not overdue yet

    const alreadySent = getSentThresholds(state, invoice.id)
    const threshold = selectThresholdToSend(overdueBy, thresholds, alreadySent)
    if (!threshold) continue // nothing new crossed for this invoice

    const withDays = { ...invoice, daysOverdue: overdueBy }
    const email = buildReminderEmail({ invoice: withDays, threshold, storeName: process.env.STORE_NAME })

    let sent = false
    if (invoice.customerEmail) {
      sent = await sendReminderEmail({
        to: invoice.customerEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
        fromName: process.env.STORE_NAME,
      })
    } else {
      console.warn(`Invoice ${invoice.number ?? invoice.id} has no customer email — skipping send.`)
    }

    if (sent) {
      state = recordReminderSent(state, invoice.id, threshold.days, now.toISOString())
    }

    const invoiceLabel = invoice.number ?? invoice.id
    console.log(`${sent ? 'Sent' : 'Built (not sent)'} "${threshold.label}" reminder for ${invoiceLabel} (${overdueBy} days overdue)`)
    reminders.push({ invoiceLabel, thresholdLabel: threshold.label, sent })
  }

  if (reminders.length === 0) {
    console.log('No invoice crossed a new escalation threshold this run.')
  }

  state = pruneState(state, invoices.map((i) => i.id))
  saveState(statePath, state)

  await postSummary(
    {
      overdueCount: invoices.filter((i) => daysOverdue(i.dueDate, now) > 0).length,
      reminders,
      totalOutstandingCents,
      currency,
    },
    process.env.SLACK_WEBHOOK_URL,
  )
}

main().catch((err) => {
  console.error(`invoice-chaser failed: ${err.message}`)
  process.exitCode = 1
})
