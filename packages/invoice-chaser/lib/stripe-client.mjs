// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads real open invoices from Stripe's REST API directly — no stripe-node
// dependency, same zero-dependency pattern as every other MultiNicheAI
// automation (see how supplier-po-sync's lib/shopify-client.mjs calls
// Shopify with plain fetch). A restricted API key with read access to
// Invoices is all this needs; it never creates, updates, or voids anything
// in Stripe.

const API_BASE = 'https://api.stripe.com/v1'

function authHeaders(secretKey) {
  const key = secretKey ?? process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.')
  // Stripe uses HTTP Basic auth with the secret key as the username and an
  // empty password — not a Bearer token.
  return { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` }
}

/**
 * Normalizes a raw Stripe invoice object into the flat shape the rest of
 * this product works with.
 *
 * @param {object} inv  raw Stripe invoice object
 * @returns {{id:string, number:string|null, customerName:string|null,
 *   customerEmail:string|null, amountDue:number, currency:string,
 *   dueDate:string, hostedInvoiceUrl:string|null}}
 */
export function normalizeInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number ?? null,
    customerName: inv.customer_name ?? null,
    customerEmail: inv.customer_email ?? null,
    amountDue: Number(inv.amount_due ?? 0),
    currency: inv.currency ?? 'usd',
    dueDate: new Date(inv.due_date * 1000).toISOString(),
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
  }
}

/**
 * Fetches every open Stripe invoice that has a due date set (an invoice
 * with no due date, e.g. one paid on receipt with no terms, has nothing
 * for this product to chase), paginating through Stripe's cursor API.
 *
 * @param {object} [options]
 * @param {string} [options.secretKey]  defaults to STRIPE_SECRET_KEY
 * @returns {Promise<Array<ReturnType<typeof normalizeInvoice>>>}
 */
export async function getOpenInvoices(options = {}) {
  const headers = authHeaders(options.secretKey)
  const invoices = []
  let startingAfter

  do {
    const params = new URLSearchParams({ status: 'open', limit: '100' })
    if (startingAfter) params.set('starting_after', startingAfter)

    const res = await fetch(`${API_BASE}/invoices?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Stripe API returned HTTP ${res.status}: ${detail.slice(0, 300)}`)
    }
    const data = await res.json()
    const page = data.data ?? []

    for (const inv of page) {
      if (!inv.due_date) continue // nothing to chase without a due date
      invoices.push(normalizeInvoice(inv))
    }

    startingAfter = data.has_more && page.length ? page[page.length - 1].id : null
  } while (startingAfter)

  return invoices
}
