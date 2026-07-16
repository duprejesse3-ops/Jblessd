// Netlify Function: POST /api/create-checkout-session
// Builds a Stripe Checkout Session from the items in the cart and returns the
// hosted checkout URL. The frontend redirects the browser to that URL — card
// details are entered on Stripe's page, never on this site.
//
// Reachable at /api/create-checkout-session via the /api/* rewrite in
// netlify.toml, or directly at /.netlify/functions/create-checkout-session.

import Stripe from 'stripe'
import type { Context } from '@netlify/functions'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

interface CartItem {
  id?: string
  name?: string
  price?: string | number
}

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

  let items: CartItem[] | undefined
  let digitalPolicyAccepted = false
  try {
    const body = await req.json()
    items = body?.items
    digitalPolicyAccepted = body?.digitalPolicyAccepted === true
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

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
    // Basic server-side sanity checks — never trust price/name straight from
    // the client without at least bounding them.
    const line_items = items.map((item) => {
      const price = Math.round(parseFloat(String(item.price)) * 100)
      if (!item.name || !Number.isFinite(price) || price <= 0) {
        throw new Error('Invalid item in cart')
      }
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: String(item.name).slice(0, 200),
            ...(item.id ? { metadata: { sku: String(item.id).slice(0, 100) } } : {}),
          },
          unit_amount: price,
        },
        quantity: 1,
      }
    })

    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      custom_text: {
        submit: {
          message: 'You requested immediate digital delivery and acknowledged the refund policy before continuing to checkout.',
        },
      },
      metadata: {
        digital_delivery_acknowledged: 'true',
        refund_policy_version: '2026-07-16',
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
