// Netlify Function: GET /api/order?session_id=cs_...
// Instant digital delivery. Given a *paid* Stripe Checkout session, returns the
// deliverables for everything the buyer purchased so the storefront can hand
// them over on the success page immediately — no waiting on email.
//
// This is the fix for "I paid but never received my download": the success page
// now renders the real content and a Markdown download for each item, and the
// buyer can return to this link any time (it's stateless — it re-verifies the
// session with Stripe on every call) to download again.
//
// Security: content is only ever returned for a session Stripe confirms is
// paid. An unpaid, unknown, or tampered session id yields { paid: false } and no
// content, so the endpoint can't be used to grab products for free.
//
// Reachable at /api/order via the /api/* rewrite in netlify.toml.

import Stripe from 'stripe'
import type { Context, Config } from '@netlify/functions'
import { fulfilOrder } from '../lib/fulfillment.mjs'
import { deliverableSlug } from '../lib/deliverables.mjs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Checkout is not configured.' }, { status: 500 })
  }

  const sessionId = new URL(req.url).searchParams.get('session_id')
  // Stripe Checkout session ids look like cs_test_… / cs_live_…. Reject anything
  // else before spending a Stripe API call on it.
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 })
  }

  try {
    const { paid, items } = await fulfilOrder(stripe, sessionId)
    if (!paid) {
      return Response.json({ paid: false }, { status: 200, headers: { 'Cache-Control': 'private, no-store' } })
    }

    return Response.json(
      {
        paid: true,
        items: items.map(({ deliverable, markdown }) => ({
          sku: deliverable.sku,
          name: deliverable.name,
          format: deliverable.format,
          spec: deliverable.spec,
          intro: deliverable.intro,
          sections: deliverable.sections,
          markdown,
          filename: `${deliverableSlug(deliverable)}.md`,
        })),
      },
      // Private: the response is tied to one buyer's session id.
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (err) {
    console.error('order delivery error:', (err as Error).message)
    return Response.json({ error: 'Unable to load your order right now.' }, { status: 400 })
  }
}

export const config: Config = {
  path: '/api/order',
}
