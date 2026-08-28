// Netlify Function: POST /api/generate-custom-order
// Browser-triggered companion to the webhook's custom_order branch. Called
// from the /custom success page right after Stripe redirects back, so the
// buyer sees generation start immediately instead of waiting for the webhook
// (which is reliable but can lag by a few seconds). Verifies the session was
// actually paid via Stripe before doing anything — never trusts the browser's
// claim alone. Idempotent via fulfilCustomOrder's own status check, so
// whichever of this or the webhook gets there first does the work.
//
// Reachable at /api/generate-custom-order via the /api/* rewrite in
// netlify.toml, or directly at /.netlify/functions/generate-custom-order.

import Stripe from 'stripe'
import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { fulfilCustomOrder, attachOrderEmail } from '../lib/custom-orders.mjs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let sessionId = ''
  try {
    const body = await req.json()
    sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!sessionId) {
    return Response.json({ error: 'Missing session id' }, { status: 400 })
  }

  try {
    // Verify with Stripe directly — never trust that the browser reaching
    // this endpoint means the payment actually succeeded.
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.payment_status !== 'paid') {
      return Response.json({ error: 'Payment not completed' }, { status: 402 })
    }
    if (session.metadata?.kind !== 'custom_order' || !session.metadata?.order_id) {
      return Response.json({ error: 'Not a custom order session' }, { status: 400 })
    }

    const orderId = session.metadata.order_id
    const email = session.customer_details?.email
    if (email) {
      await attachOrderEmail(orderId, email)
    }

    // fulfilCustomOrder is idempotent (checks status before doing work), so
    // calling it here is safe even if the webhook already started or
    // finished it.
    await fulfilCustomOrder(orderId)

    const db = getDatabase()
    const [order] = await db.sql`SELECT status, output FROM custom_orders WHERE id = ${orderId}`

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.status === 'failed') {
      return Response.json({ error: 'Generation failed. Our team has been notified — you will still receive your order by email shortly.' }, { status: 500 })
    }

    return Response.json({ status: order.status, output: order.output ?? null })
  } catch (err) {
    console.error('generate-custom-order error:', (err as Error).message)
    return Response.json({ error: 'Something went wrong. Please check your email — your order may still arrive.' }, { status: 500 })
  }
}
