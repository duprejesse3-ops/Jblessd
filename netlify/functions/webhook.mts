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
import { findPack, grantPurchase, isEmail, normalizeEmail, packTotal } from '../lib/credits.mjs'
import { sendAccessKeyEmail } from '../lib/credit-email.mjs'

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

    // Credit top-ups for the Claude Agent Studio are a different kind of sale:
    // there are no catalog items to deliver, the "fulfilment" is a balance. This
    // path and the browser's own /api/credits claim both credit the same session
    // and are idempotent on its id, so whichever arrives first wins and the
    // second is a no-op — the buyer is credited exactly once whether or not they
    // ever came back to the site.
    if (session.metadata?.kind === 'credits') {
      await grantCreditPurchase(session)
      return Response.json({ received: true })
    }

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

// Credit a Claude Agent Studio top-up to the buyer's balance and mail them their
// access key. Idempotent on the Stripe session id (see lib/credits.mts), so
// Stripe's retries can't double-credit.
//
// Deliberately does NOT re-issue a key for a customer who already has an account:
// the webhook has no way to know whether they're still holding the key they have,
// and silently retiring a working key on every top-up would be worse than not
// sending one. The email in that case says the credits landed on the existing
// key, and /agent's "email me a new key" link covers the rest.
async function grantCreditPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const email = normalizeEmail(session.customer_details?.email ?? session.customer_email ?? '')
  if (!isEmail(email)) {
    console.error('webhook: credit purchase has no usable email —', session.id)
    return
  }

  // Credits come from the pack definition, never from session metadata alone, so
  // the amount granted always matches what the pack sells for.
  const pack = findPack(session.metadata?.credit_pack)
  const credits = pack ? packTotal(pack) : Number(session.metadata?.credit_amount ?? 0)
  if (!credits || credits < 0) {
    console.error('webhook: credit purchase has no credits attached —', session.id)
    return
  }

  try {
    const result = await grantPurchase({
      email,
      credits,
      amountCents: session.amount_total ?? pack?.priceCents ?? 0,
      detail: pack ? `${pack.label} pack — ${credits} credits` : `${credits} credits`,
      sessionId: session.id,
      reissueIfUnknown: false,
    })
    if (!result.granted) return // already credited by the buyer's own claim call

    await sendAccessKeyEmail({
      to: email,
      key: result.issuedKey,
      creditsAdded: credits,
      balance: result.balance,
      origin: getOrigin(session),
      reason: 'purchase',
    })
  } catch (err) {
    console.error('webhook: could not credit purchase —', (err as Error).message)
  }
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
