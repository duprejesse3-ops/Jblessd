// Netlify Function: POST /api/create-custom-checkout-session
// Builds a Stripe Checkout Session for a single custom-generated product.
// Unlike the catalog checkout, there's no existing product to look up — the
// customer's need description is saved to custom_orders FIRST (Stripe
// metadata has a 500-char limit, too small for a real description), and only
// that row's id travels in the session metadata. The webhook and the
// success-page trigger both use that id to find the order and generate it.
//
// Reachable at /api/create-custom-checkout-session via the /api/* rewrite in
// netlify.toml, or directly at /.netlify/functions/create-custom-checkout-session.

import Stripe from 'stripe'
import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const stripe = new Stripe(STRIPE_KEY)

// Flat price for any custom order, regardless of category — server-side
// authority, never trust a price the browser sends.
const CUSTOM_ORDER_PRICE_CENTS = 4900 // $49.00
const VALID_CATEGORIES = ['prompts', 'automations', 'templates', 'agents', 'connectors']
const MAX_DESCRIPTION_LENGTH = 4000

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function stripeMode(key: string): 'live' | 'test' | 'malformed' | 'missing' {
  if (!key) return 'missing'
  if (/^(sk|rk)_live_/.test(key)) return 'live'
  if (/^(sk|rk)_test_/.test(key)) return 'test'
  return 'malformed'
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Custom checkout error: STRIPE_SECRET_KEY is not configured')
    return Response.json({ error: 'Checkout is not configured. Please try again later.' }, { status: 500 })
  }

  const mode = stripeMode(STRIPE_KEY)
  if (mode === 'test') {
    console.warn('Custom checkout: STRIPE_SECRET_KEY is a TEST key — no real cards will be charged.')
  }

  let category = ''
  let needDescription = ''
  let digitalPolicyAccepted = false
  try {
    const body = await req.json()
    category = typeof body?.category === 'string' ? body.category.trim() : ''
    needDescription = typeof body?.needDescription === 'string' ? body.needDescription.trim() : ''
    digitalPolicyAccepted = body?.digitalPolicyAccepted === true
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

  if (!VALID_CATEGORIES.includes(category)) {
    return Response.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (!needDescription || needDescription.length < 20) {
    return Response.json({ error: 'Please describe your need in more detail.' }, { status: 400 })
  }
  if (needDescription.length > MAX_DESCRIPTION_LENGTH) {
    return Response.json({ error: 'Description is too long.' }, { status: 400 })
  }
  if (!digitalPolicyAccepted) {
    return Response.json(
      { error: 'Please acknowledge the digital delivery and refund policy before checkout.' },
      { status: 400 },
    )
  }

  try {
    const orderId = shortId()
    const db = getDatabase()
    await db.sql`
      INSERT INTO custom_orders (id, session_id, category, need_description, status)
      VALUES (${orderId}, ${'pending-' + orderId}, ${category}, ${needDescription}, 'pending')
    `

    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Custom ${categoryLabel}`,
              description: 'Generated specifically for your described need.',
            },
            unit_amount: CUSTOM_ORDER_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/custom?checkout=success&session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${origin}/custom?checkout=cancelled`,
      custom_text: {
        submit: {
          message: 'You requested immediate digital delivery and acknowledged the refund policy before continuing to checkout.',
        },
      },
      metadata: {
        kind: 'custom_order',
        order_id: orderId,
        digital_delivery_acknowledged: 'true',
      },
    })

    await db.sql`UPDATE custom_orders SET session_id = ${session.id} WHERE id = ${orderId}`

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Custom checkout session error:', (err as Error).message)
    return Response.json({ error: 'Unable to start checkout. Please try again.' }, { status: 400 })
  }
}
