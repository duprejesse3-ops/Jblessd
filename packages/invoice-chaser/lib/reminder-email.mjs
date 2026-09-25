// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns an overdue invoice + the escalation threshold it crossed into an
// actual reminder email (subject, HTML body, plain-text body). No
// templating engine — a reminder is a handful of facts and a tone, and
// keeping this dependency-free means it has nothing to break on an update.

function formatMoney(amountInCents, currency = 'usd') {
  const amount = (Number(amountInCents) / 100).toFixed(2)
  return `${currency.toUpperCase()} ${amount}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const TONE_OPENERS = {
  friendly: "Just a friendly heads up — it looks like the invoice below hasn't been paid yet.",
  firm: 'This invoice is now significantly overdue and needs your attention.',
  final: 'This is a final notice: the invoice below remains unpaid well past its due date.',
  neutral: 'The invoice below is now overdue.',
}

/**
 * @param {object} args
 * @param {object} args.invoice  {id, number, customerName, customerEmail,
 *   amountDue, currency, dueDate, hostedInvoiceUrl, daysOverdue}
 * @param {{days:number,label:string,tone?:string}} args.threshold
 * @param {string} [args.storeName]
 * @returns {{subject:string, text:string, html:string}}
 */
export function buildReminderEmail({ invoice, threshold, storeName }) {
  if (!invoice) throw new Error('buildReminderEmail requires invoice.')
  if (!threshold) throw new Error('buildReminderEmail requires threshold.')

  const invoiceLabel = invoice.number ?? invoice.id
  const amount = formatMoney(invoice.amountDue, invoice.currency)
  const dayWord = invoice.daysOverdue === 1 ? 'day' : 'days'
  const subjectPrefix = storeName ? `${storeName}: ` : ''
  const subject = `${subjectPrefix}${threshold.label} — invoice ${invoiceLabel} is ${invoice.daysOverdue} ${dayWord} overdue`

  const greeting = invoice.customerName ? `Hi ${invoice.customerName},` : 'Hi,'
  const opener = TONE_OPENERS[threshold.tone] ?? TONE_OPENERS.neutral
  const dueDate = new Date(invoice.dueDate).toISOString().slice(0, 10)

  const textLines = [
    greeting,
    '',
    opener,
    '',
    `  Invoice: ${invoiceLabel}`,
    `  Amount due: ${amount}`,
    `  Due date: ${dueDate}`,
    `  Days overdue: ${invoice.daysOverdue}`,
  ]
  if (invoice.hostedInvoiceUrl) {
    textLines.push(`  Pay now: ${invoice.hostedInvoiceUrl}`)
  }
  textLines.push('', 'If you\'ve already paid, please disregard this reminder — it may just be crossing with your payment.')
  if (storeName) textLines.push('', storeName)
  const text = textLines.join('\n')

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(opener)}</p>`,
    '<table cellpadding="4" cellspacing="0">',
    `<tr><td><strong>Invoice</strong></td><td>${escapeHtml(invoiceLabel)}</td></tr>`,
    `<tr><td><strong>Amount due</strong></td><td>${escapeHtml(amount)}</td></tr>`,
    `<tr><td><strong>Due date</strong></td><td>${escapeHtml(dueDate)}</td></tr>`,
    `<tr><td><strong>Days overdue</strong></td><td>${escapeHtml(String(invoice.daysOverdue))}</td></tr>`,
    '</table>',
    invoice.hostedInvoiceUrl
      ? `<p><a href="${escapeHtml(invoice.hostedInvoiceUrl)}">Pay this invoice</a></p>`
      : '',
    "<p>If you've already paid, please disregard this reminder — it may just be crossing with your payment.</p>",
    storeName ? `<p>${escapeHtml(storeName)}</p>` : '',
  ].filter(Boolean).join('\n')

  return { subject, text, html }
}
