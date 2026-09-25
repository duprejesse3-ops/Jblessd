// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Optional run digest, so you don't have to check your inbox/logs to know
// the job ran: how many invoices are overdue, how many reminders actually
// went out, and how much money is outstanding. A no-op if
// SLACK_WEBHOOK_URL isn't set.

/**
 * @param {object} summary
 * @param {number} summary.overdueCount
 * @param {Array<{invoiceLabel:string, thresholdLabel:string, sent:boolean}>} summary.reminders
 * @param {number} summary.totalOutstandingCents
 * @param {string} [summary.currency]
 * @param {string|undefined} webhookUrl
 * @returns {Promise<boolean>}
 */
export async function postSummary(summary, webhookUrl) {
  if (!webhookUrl) return false

  const currency = (summary.currency ?? 'usd').toUpperCase()
  const totalOutstanding = (summary.totalOutstandingCents / 100).toFixed(2)

  const lines = [
    `Invoice chaser ran — ${summary.overdueCount} overdue invoice(s), ${currency} ${totalOutstanding} outstanding.`,
  ]
  if (summary.reminders.length) {
    lines.push(`Reminders (${summary.reminders.length}):`)
    for (const r of summary.reminders) {
      lines.push(`• ${r.invoiceLabel} — ${r.thresholdLabel}${r.sent ? '' : ' — NOT sent (dry run / no email key)'}`)
    }
  } else {
    lines.push('No new thresholds crossed — nothing to remind.')
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`Slack webhook returned HTTP ${res.status}`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`Slack webhook failed: ${error?.message ?? error}`)
    return false
  }
}
