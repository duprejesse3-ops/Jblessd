// Maps a paid Stripe Checkout session back to the catalog products the buyer
// actually purchased, so both the instant-download endpoint (/api/order) and the
// order email (webhook) fulfil from one place and can never drift apart.
//
// Checkout stamps each line item's Stripe product with metadata.sku (see
// create-checkout-session), so the primary match is by SKU. If that's ever
// missing we fall back to matching the line-item description against the catalog
// by name, so an order still resolves.

import type Stripe from 'stripe'
import { loadCatalog } from './db.mjs'
import type { Product } from './catalog.mjs'
import { buildDeliverable, deliverableToMarkdown, type Deliverable } from './deliverables.mjs'

export interface FulfilledItem {
  product: Product
  deliverable: Deliverable
  markdown: string
}

export interface Fulfilment {
  paid: boolean
  email: string | null
  // Order financials, surfaced so the success page can both report a value-based
  // conversion and render the values as selectable elements for Google Ads'
  // "select website element" order-information setup.
  transactionId: string
  value: number
  currency: string
  items: FulfilledItem[]
}

/**
 * Resolve a Stripe Checkout session into its deliverables. Returns paid:false
 * (with no items) for any session that isn't genuinely paid, so callers never
 * hand over content for an unpaid or tampered session id.
 */
export async function fulfilOrder(stripe: Stripe, sessionId: string): Promise<Fulfilment> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product'],
  })

  if (session.payment_status !== 'paid') {
    return {
      paid: false,
      email: session.customer_details?.email ?? null,
      transactionId: session.id,
      value: (session.amount_total ?? 0) / 100,
      currency: (session.currency ?? 'usd').toUpperCase(),
      items: [],
    }
  }

  // Ensure we have line items even if the expand above didn't include them.
  let lineItems = session.line_items?.data
  if (!lineItems) {
    const fetched = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 50,
      expand: ['data.price.product'],
    })
    lineItems = fetched.data
  }

  const { products } = await loadCatalog()
  const bySku = new Map(products.map((p) => [p.sku, p]))
  const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]))

  const items: FulfilledItem[] = []
  for (const li of lineItems ?? []) {
    const stripeProduct = li.price?.product
    // stripeProduct is a string id, a full Product, or a DeletedProduct. Only a
    // live Product carries the sku metadata we stamped at checkout.
    const liveProduct =
      stripeProduct && typeof stripeProduct !== 'string' && !('deleted' in stripeProduct)
        ? stripeProduct
        : undefined
    const sku = liveProduct?.metadata?.sku ?? ''
    const product =
      (sku && bySku.get(sku)) ||
      (li.description ? byName.get(li.description.toLowerCase()) : undefined)
    if (!product) continue
    const deliverable = buildDeliverable(product)
    items.push({ product, deliverable, markdown: deliverableToMarkdown(deliverable) })
  }

  return {
    paid: true,
    email: session.customer_details?.email ?? null,
    // session.id is the stable transaction id; Google Ads and GA4 use it to
    // de-duplicate if the buyer reloads the success page.
    transactionId: session.id,
    value: (session.amount_total ?? 0) / 100,
    currency: (session.currency ?? 'usd').toUpperCase(),
    items,
  }
}
