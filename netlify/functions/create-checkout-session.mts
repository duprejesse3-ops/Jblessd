// Netlify Function: POST /api/create-checkout-session
// Builds a Stripe Checkout Session from the items in the cart and returns the
// hosted checkout URL. The frontend redirects the browser to that URL — card
// details are entered on Stripe's page, never on this site.
//
// Reachable at /api/create-checkout-session via the /api/* rewrite in
// netlify.toml, or directly at /.netlify/functions/create-checkout-session.

import Stripe from 'stripe'
import type { Context } from '@netlify/functions'
import { loadCatalog } from '../lib/db.mjs'

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const stripe = new Stripe(STRIPE_KEY)

// Report which Stripe mode the configured key runs in — without ever logging
// the key itself. Handy when "checkout still charges in test mode" turns out to
// be an env-var problem: the function logs make the active mode obvious.
function stripeMode(key: string): 'live' | 'test' | 'malformed' | 'missing' {
  if (!key) return 'missing'
  if (/^(sk|rk)_live_/.test(key)) return 'live'
  if (/^(sk|rk)_test_/.test(key)) return 'test'
  return 'malformed'
}

interface CartItem {
  id?: string
  name?: string
  price?: string | number
}

const BUNDLE_MIN_ITEMS = 3
const BUNDLE_DISCOUNT_RATE = 0.15

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Checkout session error: STRIPE_SECRET_KEY is not configured')
    return Response.json(
      { error: 'Checkout is not configured. Please try again later.' },
      { status: 500 },
    )
  }

  // Surface the active mode in the function logs. If this says "test" when you
  // expect real charges, the STRIPE_SECRET_KEY env var is still a test key —
  // update its value to your sk_live_… key and redeploy.
  const mode = stripeMode(STRIPE_KEY)
  if (mode === 'test') {
    console.warn('Checkout: STRIPE_SECRET_KEY is a TEST key — no real cards will be charged.')
  } else if (mode === 'malformed') {
    console.error('Checkout: STRIPE_SECRET_KEY does not look like a Stripe secret key (expected sk_live_… / sk_test_…).')
  }

  let items: CartItem[] | undefined
  let digitalPolicyAccepted = false
  let clickId = ''
  let clickSource = ''
  try {
    const body = await req.json()
    items = body?.items
    digitalPolicyAccepted = body?.digitalPolicyAccepted === true
    // Google Ads click identifier captured from the landing URL (gclid / gbraid
    // / wbraid). Stored on the session so the paid order can be attributed back
    // to the exact ad click for enhanced / offline conversion import. Purely
    // informational — never trusted for pricing — so we just sanitise it.
    if (typeof body?.clickId === 'string') clickId = body.clickId.slice(0, 200)
    if (typeof body?.clickSource === 'string') clickSource = body.clickSource.slice(0, 20)
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

  try {
    // Never trust the price (or name) the browser sends — with a live key this
    // is real money, and a tampered request could otherwise buy a $49 product
    // for a penny. Look every item up by its SKU in the server-side catalog
    // (the database, with the bundled fallback) and charge the authoritative
    // price from there.
    const { products } = await loadCatalog()
    const catalog = new Map(products.map((p) => [p.sku, p]))

    const selectedProducts = items.map((item) => {
      const product = item.id ? catalog.get(String(item.id)) : undefined
      if (!product) {
        throw new Error('Invalid item in cart')
      }
      return product
    })
    const uniqueProductCount = new Set(selectedProducts.map((product) => product.sku)).size
    const bundleEligible = uniqueProductCount >= BUNDLE_MIN_ITEMS

    const line_items = selectedProducts.map((product) => {
      const price = Math.round(product.price * 100 * (bundleEligible ? 1 - BUNDLE_DISCOUNT_RATE : 1))
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Invalid item in cart')
      }
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: String(product.name).slice(0, 200),
            metadata: { sku: String(product.sku).slice(0, 100) },
          },
          unit_amount: price,
        },
        quantity: 1,
      }
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      custom_text: {
        submit: {
          message: 'You requested immediate digital delivery and acknowledged the refund policy before continuing to checkout.',
        },
      },
      metadata: {
        bundle_discount_percent: bundleEligible ? '15' : '0',
        digital_delivery_acknowledged: 'true',
        refund_policy_version: '2026-07-16',
        // Ad-click attribution for Google Ads conversion import (empty when the
        // buyer didn't arrive from an ad). Kept alongside the order so a later
        // offline/enhanced conversion upload can tie this purchase to the click.
        ...(clickId ? { ad_click_id: clickId, ad_click_source: clickSource || 'gclid' } : {}),
      },
      // Automatically collect and calculate tax if you've set up Stripe Tax.
      // automatic_tax: { enabled: true },
    })

    return Response.json({ url: session.url })
  } catch (err) {
    const message = (err as Error).message
    console.error('Checkout session error:', message)
    // Surface the validation error to the client, but keep Stripe/internal
    // failures generic.
    const clientError =
      message === 'Invalid item in cart'
        ? 'Invalid item in cart'
        : 'Unable to start checkout. Please try again.'
    return Response.json({ error: clientError }, { status: 400 })
  }
}
