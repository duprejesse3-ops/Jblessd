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
import { sendEmail } from '../lib/email.mjs'

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

    // Fulfillment: email the buyer a receipt + delivery note and invite a
    // review. Line items aren't on the base session object, so fetch them.
    const email = session.customer_details?.email
    if (email) {
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 50 })
        const names = lineItems.data.map((li) => li.description).filter(Boolean) as string[]
        const itemList = names.length ? names.map((n) => `  • ${n}`).join('\n') : '  • Your order'

        const body = `Thanks for your order — here's what you picked up:\n\n${itemList}\n\n` +
          `Everything is delivered digitally and is ready to use right away. If you didn't get a download link ` +
          `for any item, reply to this email and we'll sort it out immediately.\n\n` +
          `Put it to work, and when you've had a chance to use it we'd love a quick review — it helps other ` +
          `buyers and it helps us build the right things next: https://jblessd.com`

        await sendEmail({
          to: email,
          subject: 'Your MULTINICHE AI order',
          text: body,
        })
      } catch (err) {
        console.error('webhook: could not send order email —', (err as Error).message)
      }
    }
  }

  return Response.json({ received: true })
}
