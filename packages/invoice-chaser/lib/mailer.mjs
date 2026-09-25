// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Sends the reminder email via Resend's HTTP API (https://resend.com) —
// chosen over SMTP specifically so this stays a plain `fetch` call with
// zero npm dependencies, same as every other MultiNicheAI automation (see
// supplier-po-sync's lib/mailer.mjs for the exact pattern this mirrors).

const API_URL = 'https://api.resend.com/emails'

/**
 * @param {object} email
 * @param {string} email.to
 * @param {string} email.subject
 * @param {string} email.text
 * @param {string} [email.html]
 * @param {string} [email.fromName]
 * @param {string} [email.fromEmail]
 * @param {string} [apiKey]  defaults to RESEND_API_KEY
 * @returns {Promise<boolean>} true if sent, false if no key configured (a
 *   deliberate no-op, same pattern as the Slack webhook helper, so a dry
 *   run/test doesn't need a real account)
 */
export async function sendReminderEmail(email, apiKey = process.env.RESEND_API_KEY) {
  if (!apiKey) {
    console.warn('RESEND_API_KEY is not set — skipping send (dry run).')
    return false
  }
  if (!email.to) throw new Error('sendReminderEmail requires email.to (the customer\'s address).')

  const fromName = email.fromName ?? 'Billing'
  const fromEmail = email.fromEmail ?? process.env.CHASER_FROM_EMAIL
  if (!fromEmail) throw new Error('Set email.fromEmail or CHASER_FROM_EMAIL — Resend requires a verified sending domain.')

  const body = {
    from: `${fromName} <${fromEmail}>`,
    to: [email.to],
    subject: email.subject,
    text: email.text,
  }
  if (email.html) body.html = email.html

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend API returned HTTP ${res.status}: ${detail.slice(0, 300)}`)
  }
  return true
}
