// Netlify Function: GET /api/checkout-summary?session_id=cs_...
// Returns the *value* of a completed Stripe Checkout session so the storefront
// can report a value-based purchase conversion to Google Ads / GA4. Without a
// real value, Smart Bidding strategies like Target ROAS have nothing to
// optimize toward — every conversion would look identical.
//
// Returns order totals (amount, currency, payment status) plus the buyer's own
// contact details. These power Google Ads enhanced conversions: the storefront
// hands them to the Google tag, which normalizes and SHA-256 hashes them in the
// browser before sending, so raw values never reach Google. More matchable
// fields means a higher match rate, so email, phone and billing name/address are
// all included when Stripe collected them. Everything here is the buyer's own
// data, returned only for a genuinely paid session, only to that buyer's own
// success-page browser, and marked private/no-store — exactly as /api/order
// already does. No line-item detail is exposed here.
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

    const details = session.customer_details
    // Stripe gives one "name" string; Ads wants first/last separately. Split on
    // the last space so multi-word first names stay intact.
    const fullName = (details?.name ?? '').trim()
    const splitAt = fullName.lastIndexOf(' ')
    const firstName = splitAt > 0 ? fullName.slice(0, splitAt) : fullName
    const lastName = splitAt > 0 ? fullName.slice(splitAt + 1) : ''
    const address = details?.address

    return Response.json(
      {
        paid: true,
        // transaction_id lets Google Ads and GA4 de-duplicate if the buyer
        // reloads the success page — the same order is only ever counted once.
        transactionId: session.id,
        value: (session.amount_total ?? 0) / 100,
        currency: (session.currency ?? 'usd').toUpperCase(),
        // Buyer's own details for enhanced conversions. Normalized/hashed by the
        // Google tag in the browser; each may be absent if Stripe collected none,
        // and the storefront skips any field that comes back empty.
        email: details?.email ?? session.customer_email ?? null,
        phone: details?.phone ?? null,
        firstName: firstName || null,
        lastName: lastName || null,
        address: address
          ? {
              line1: address.line1 ?? null,
              line2: address.line2 ?? null,
              city: address.city ?? null,
              state: address.state ?? null,
              postalCode: address.postal_code ?? null,
              country: address.country ?? null,
            }
          : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    console.error('checkout-summary error:', (err as Error).message)
    return Response.json({ error: 'Unable to load order summary' }, { status: 400 })
  }
}
