// Netlify Function: GET /api/checkout-summary?session_id=cs_...
// Returns the *value* of a completed Stripe Checkout session so the storefront
// can report a value-based purchase conversion to Google Ads / GA4. Without a
// real value, Smart Bidding strategies like Target ROAS have nothing to
// optimize toward — every conversion would look identical.
//
// Deliberately returns only non-sensitive totals (amount, currency, item
// count, payment status). No customer email, address, or line-item detail is
// exposed, even though the session id travels through the browser URL.
//
// Reachable at /api/checkout-summary via the /api/* rewrite in netlify.toml.

import Stripe from 'stripe'
import type { Context } from '@netlify/functions'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Checkout is not configured.' }, { status: 500 })
  }

  const sessionId = new URL(req.url).searchParams.get('session_id')
  // Stripe Checkout Session ids look like cs_test_… / cs_live_…. Reject
  // anything else before spending a Stripe API call on it.
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Only treat genuinely-paid sessions as conversions. A tampered or
    // abandoned session id must never report a value.
    if (session.payment_status !== 'paid') {
      return Response.json({ paid: false }, { status: 200 })
    }

    return Response.json(
      {
        paid: true,
        // transaction_id lets Google Ads and GA4 de-duplicate if the buyer
        // reloads the success page — the same order is only ever counted once.
        transactionId: session.id,
        value: (session.amount_total ?? 0) / 100,
        currency: (session.currency ?? 'usd').toUpperCase(),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    console.error('checkout-summary error:', (err as Error).message)
    return Response.json({ error: 'Unable to load order summary' }, { status: 400 })
  }
}
