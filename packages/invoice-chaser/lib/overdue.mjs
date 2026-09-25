// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The two decisions this whole product makes: how overdue is this invoice,
// and — given the escalation ladder and what's already been sent for it —
// which threshold (if any) needs a reminder right now. Kept as their own
// tiny, pure module so both have a test independent of the Stripe/email
// plumbing around them.

/**
 * @param {string|Date} dueDate  an ISO date/datetime string, or a Date
 * @param {Date} [now]
 * @returns {number} whole days past due; 0 or negative means not overdue
 */
export function daysOverdue(dueDate, now = new Date()) {
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(due.getTime())) throw new Error(`Invalid due date: ${dueDate}`)
  const diffMs = now.getTime() - due.getTime()
  return Math.floor(diffMs / 86_400_000)
}

/**
 * Picks the escalation threshold to send a reminder at, given how many days
 * an invoice is overdue and which threshold-days have already had a
 * reminder sent for this invoice. Always returns the HIGHEST crossed
 * threshold that hasn't been sent yet — so an invoice that goes unchecked
 * for a while (crossing two thresholds between runs) gets one reminder at
 * the more urgent tone, not a flood of catch-up emails.
 *
 * @param {number} daysPastDue
 * @param {Array<{days:number,label:string,tone?:string}>} thresholds
 * @param {number[]} [alreadySentDays]
 * @returns {{days:number,label:string,tone?:string}|null}
 */
export function selectThresholdToSend(daysPastDue, thresholds, alreadySentDays = []) {
  if (!Number.isFinite(daysPastDue) || daysPastDue < 0) return null
  const sent = new Set(alreadySentDays)
  let best = null
  for (const threshold of thresholds) {
    if (threshold.days > daysPastDue) continue
    if (sent.has(threshold.days)) continue
    if (!best || threshold.days > best.days) best = threshold
  }
  return best
}
