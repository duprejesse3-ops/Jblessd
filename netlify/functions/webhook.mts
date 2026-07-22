// Netlify Function: POST /api/webhook
// Optional but recommended once you're live: Stripe calls this endpoint
// directly when a payment succeeds, which is more reliable than trusting the
// browser to reach the success page (people close tabs, lose wifi, etc).
// This is where you'd trigger delivery of the actual files/download links.
//
// Set STRIPE_WEBHOOK_SECRET in your Netlify environment variables to the
// signing secret Stripe gives you when you register this endpoint.

import Stripe from 'stripe'
import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { fulfilOrder } from '../lib/fulfillment.mjs'
import { deliverOrderEmail } from '../lib/order-email.mjs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  const signature = req.headers.get('stripe-signature')
  // Accept the common misspelling STRIPE_WEBHOOKS_SECRET as well, so a near-miss
  // in the env config doesn't silently break signature verification.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOKS_SECRET

  // Stripe needs the raw, unparsed request body to verify the signature.
  // req.text() gives us exactly that.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    if (!signature || !webhookSecret) {
      throw new Error('Missing Stripe signature or webhook secret')
    }
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', (err as Error).message)
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    console.log('Payment completed for session:', session.id, session.customer_details?.email)

    // Record the sale in the store's own first-party ad dataset — server-side,
    // so it survives closed tabs and blocked pixels that lose the browser
    // conversion. This is the "revenue" half the ad-performance report divides
    // by each campaign's traffic. Best-effort: never let it block fulfilment.
    await recordPurchaseEvent(session)

    // Fulfilment: deliver the actual purchased content by email — not just a
    // receipt. Stripe calls this reliably even when the buyer closes the tab
    // before the success page loads. Delivery is deduplicated per session, so
    // this and the success-page path (/api/order) together send exactly one
    // confirmation whichever fires first.
    const email = session.customer_details?.email
    if (email) {
      try {
        const origin = getOrigin(session)
        const { items } = await fulfilOrder(stripe, session.id, { enrich: true })
        await deliverOrderEmail({ to: email, sessionId: session.id, items, origin })
      } catch (err) {
        console.error('webhook: could not send order email —', (err as Error).message)
      }
    }
  }

  return Response.json({ received: true })
}

// The buyer's success/recovery link needs an absolute origin. Prefer the origin
// Checkout was created from (stored as the success_url), falling back to the
// production site so the link is always valid.
function getOrigin(session: Stripe.Checkout.Session): string {
  try {
    if (session.success_url) return new URL(session.success_url).origin
  } catch {
    /* malformed success_url — fall through */
  }
  return 'https://jblessd.com'
}

// Persist a 'purchase' row in the first-party ad_events dataset. Reads the real
// order value from the paid session and the ad attribution the checkout stored
// on its metadata (ad_click_id + utm_*). The unique partial index on
// session_id makes this idempotent, so Stripe's automatic webhook retries can't
// double-count an order. Never throws — attribution is best-effort.
async function recordPurchaseEvent(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const m = session.metadata ?? {}
    const clickId = m.ad_click_id ? String(m.ad_click_id).slice(0, 200) : null
    const clickSource = clickId ? String(m.ad_click_source || 'gclid').slice(0, 20) : null
    const utmSource = m.utm_source ? String(m.utm_source).slice(0, 200) : null
    const utmMedium = m.utm_medium ? String(m.utm_medium).slice(0, 200) : null
    const utmCampaign = m.utm_campaign ? String(m.utm_campaign).slice(0, 200) : null
    const utmTerm = m.utm_term ? String(m.utm_term).slice(0, 200) : null
    const utmContent = m.utm_content ? String(m.utm_content).slice(0, 200) : null
    const value = (session.amount_total ?? 0) / 100
    const currency = (session.currency ?? 'usd').toUpperCase()

    const db = getDatabase()
    await db.sql`
      INSERT INTO ad_events (
        event_type, click_id, click_source,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        session_id, value, currency
      ) VALUES (
        'purchase', ${clickId}, ${clickSource},
        ${utmSource}, ${utmMedium}, ${utmCampaign}, ${utmTerm}, ${utmContent},
        ${session.id}, ${value}, ${currency}
      )
      ON CONFLICT (session_id) WHERE event_type = 'purchase' DO NOTHING
    `
  } catch (err) {
    console.error('webhook: could not record purchase event —', (err as Error).message)
  }
}
