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
    // TODO: this is where real fulfillment happens, e.g.:
    //  - look up session.customer_details.email
    //  - email the buyer their download links (Resend, Postmark, SendGrid, etc.)
    //  - or log the order to a database
    console.log('Payment completed for session:', session.id, session.customer_details?.email)
  }

  return Response.json({ received: true })
}
