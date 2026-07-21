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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

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

    // Fulfilment: deliver the actual purchased content by email — not just a
    // receipt. Stripe calls this reliably even when the buyer closes the tab
    // before the success page loads. Delivery is deduplicated per session, so
    // this and the success-page path (/api/order) together send exactly one
    // confirmation whichever fires first.
    const email = session.customer_details?.email
    if (email) {
      try {
        const origin = getOrigin(session)
        const { items } = await fulfilOrder(stripe, session.id)
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
