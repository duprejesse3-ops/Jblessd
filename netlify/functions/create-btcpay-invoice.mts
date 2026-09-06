// Netlify Function: POST /api/create-btcpay-invoice
// Bitcoin Lightning equivalent of create-checkout-session.mts. Builds a
// BTCPay invoice from the cart and returns its hosted checkout URL — the
// browser redirects there the same way it redirects to Stripe's page.
//
// Reachable at /api/create-btcpay-invoice via the /api/* rewrite in
// netlify.toml.

import type { Context } from '@netlify/functions'
import { loadCatalog } from '../lib/db.mjs'
import { createInvoice, isConfigured } from '../lib/btcpay.mjs'
import { isEmail, normalizeEmail } from '../lib/credits.mjs'

interface CartItem {
  id?: string
  name?: string
  price?: string | number
}

const BUNDLE_MIN_ITEMS = 3
const BUNDLE_DISCOUNT_RATE = 0.15

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  if (!isConfigured()) {
    console.error('BTCPay invoice error: BTCPAY_URL / BTCPAY_API_KEY / BTCPAY_STORE_ID not configured')
    return Response.json(
      { error: 'Bitcoin payment is not configured. Please try another payment method.' },
      { status: 500 },
    )
  }

  let items: CartItem[] | undefined
  let digitalPolicyAccepted = false
  let email = ''
  try {
    const body = await req.json()
    items = body?.items
    digitalPolicyAccepted = body?.digitalPolicyAccepted === true
    email = normalizeEmail(body?.email)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'Cart is empty' }, { status: 400 })
  }
  if (!digitalPolicyAccepted) {
    return Response.json(
      { error: 'Please acknowledge the digital delivery and refund policy before checkout.' },
      { status: 400 },
    )
  }
  // Lightning checkout has no built-in email field the way Stripe's hosted
  // page does, so — unlike create-checkout-session.mts, which gets the email
  // from Stripe after payment — this path has to collect it up front. No
  // email, no invoice: there'd be nowhere to deliver a paid, non-refundable
  // digital order to.
  if (!isEmail(email)) {
    return Response.json({ error: 'A valid email is required for delivery.' }, { status: 400 })
  }

  try {
    // Same non-negotiable rule as Stripe checkout: price and identity come
    // from the server-side catalog by SKU, never from what the browser sent.
    const { products } = await loadCatalog()
    const catalog = new Map(products.map((p) => [p.sku, p]))

    const selectedProducts = items.map((item) => {
      const product = item.id ? catalog.get(String(item.id)) : undefined
      if (!product) throw new Error('Invalid item in cart')
      return product
    })
    const uniqueProductCount = new Set(selectedProducts.map((p) => p.sku)).size
    const bundleEligible = uniqueProductCount >= BUNDLE_MIN_ITEMS

    const invoiceItems = selectedProducts.map((product) => {
      const priceCents = Math.round(product.price * 100 * (bundleEligible ? 1 - BUNDLE_DISCOUNT_RATE : 1))
      if (!Number.isFinite(priceCents) || priceCents <= 0) throw new Error('Invalid item in cart')
      return { sku: product.sku, name: product.name, priceCents }
    })

    // A stable, human-traceable order id BTCPay stores as invoice metadata
    // and the webhook reads back — analogous to Stripe's session id, but we
    // mint it ourselves since BTCPay's invoice id isn't known until after
    // this call. Not a secret: it never carries pricing or personal data.
    const orderId = `btc_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`

    const invoice = await createInvoice(invoiceItems, { orderId, origin, buyerEmail: email })

    return Response.json({ url: invoice.checkoutLink, invoiceId: invoice.id })
  } catch (err) {
    const message = (err as Error).message
    console.error('BTCPay invoice error:', message)
    const clientError = message === 'Invalid item in cart' ? 'Invalid item in cart' : 'Unable to start Bitcoin checkout. Please try again.'
    return Response.json({ error: clientError }, { status: 400 })
  }
}
