// Netlify Function: POST /api/btcpay-webhook
// BTCPay Server calls this when an invoice's status changes. We act only on
// InvoiceSettled — the point a Lightning payment is actually final, not
// InvoiceReceived (payment seen but not yet confirmed/settled).
//
// Register this endpoint in BTCPay: Store Settings -> Webhooks -> Create
// Webhook, URL = https://<your-site>/api/btcpay-webhook, and check at least
// "An invoice has been settled". BTCPay shows you a signing secret when you
// save it — set that as BTCPAY_WEBHOOK_SECRET in Netlify's environment
// variables. Without a matching secret this handler rejects every request,
// by design (see verifyWebhookSignature in lib/btcpay.mts) — a Bitcoin
// fulfilment path that skipped signature verification would let anyone who
// finds this URL fulfil themselves a free order by POSTing a fake payload.

import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { verifyWebhookSignature, getInvoice } from '../lib/btcpay.mjs'
import { fulfilSkus } from '../lib/fulfillment.mjs'
import { deliverOrderEmail } from '../lib/order-email.mjs'
import { isEmail, normalizeEmail } from '../lib/credits.mjs'

interface BTCPayWebhookPayload {
  type: string
  invoiceId: string
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('btcpay-sig')

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error('BTCPay webhook signature verification failed')
    return new Response('Webhook Error: invalid signature', { status: 400 })
  }

  let payload: BTCPayWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Webhook Error: invalid JSON', { status: 400 })
  }

  if (payload.type !== 'InvoiceSettled') {
    // Every other event (InvoiceReceived, InvoiceProcessing, InvoiceExpired,
    // InvoiceInvalid, …) is acknowledged but ignored — we only fulfil on
    // settlement, the same "only act on the terminal success event" stance
    // webhook.mts takes with checkout.session.completed.
    return Response.json({ received: true })
  }

  try {
    // The webhook payload only confirms an id changed state — refetch the
    // invoice from BTCPay's API rather than trusting anything about amount
    // or metadata in the webhook body itself, same reasoning as never
    // trusting a client-sent price in create-btcpay-invoice.mts. A webhook
    // payload is attacker-adjacent even when its signature checks out: the
    // signature proves BTCPay sent *a* request, not that this handler should
    // trust every field in it over the source of truth.
    const invoice = await getInvoice(payload.invoiceId)
    if (invoice.status !== 'Settled') {
      // Signature was valid and the event said Settled, but the invoice
      // itself disagrees by the time we asked — don't fulfil on a stale read.
      console.warn(`BTCPay webhook: invoice ${payload.invoiceId} reported Settled but status is now ${invoice.status}`)
      return Response.json({ received: true })
    }

    const skus = Array.isArray(invoice.metadata?.skus) ? invoice.metadata.skus : []
    const email = normalizeEmail(invoice.metadata?.buyerEmail)
    const orderId = invoice.metadata?.orderId || invoice.id

    if (!skus.length) {
      console.error(`BTCPay webhook: invoice ${invoice.id} settled with no skus in metadata — nothing to fulfil`)
      return Response.json({ received: true })
    }
    if (!isEmail(email)) {
      console.error(`BTCPay webhook: invoice ${invoice.id} settled with no usable buyer email — cannot deliver`)
      return Response.json({ received: true })
    }

    await Promise.all([
      recordPurchaseEvent({ orderId, valueUsd: Number(invoice.amount) || 0 }),
      (async () => {
        try {
          const items = await fulfilSkus(skus, { enrich: true })
          await deliverOrderEmail({ to: email, sessionId: orderId, items, origin: originFromRequest(req) })
        } catch (err) {
          console.error('BTCPay webhook: could not deliver order —', (err as Error).message)
        }
      })(),
    ])
  } catch (err) {
    console.error('BTCPay webhook: fulfilment error —', (err as Error).message)
    // Still 200 — BTCPay retries on non-2xx, and a fulfilment bug shouldn't
    // turn into an infinite retry storm. The error above is what you'd grep
    // Netlify's function logs for if an order goes unfulfilled.
  }

  return Response.json({ received: true })
}

function originFromRequest(req: Request): string {
  const origin = req.headers.get('origin')
  if (origin) return origin
  const host = req.headers.get('host')
  return host ? `https://${host}` : 'https://multinicheai.com'
}

// Persist a 'purchase' row in the same first-party ad_events dataset the
// Stripe webhook writes to (see recordPurchaseEvent in webhook.mts), so
// Bitcoin sales show up in the same revenue reporting rather than a second,
// invisible ledger. Click/UTM attribution isn't threaded through this path
// yet — a Lightning checkout has no equivalent of Stripe's session metadata
// carrying it — so those columns are left null here rather than guessed at.
async function recordPurchaseEvent(order: { orderId: string; valueUsd: number }): Promise<void> {
  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO ad_events (
        event_type, click_id, click_source,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        session_id, value, currency
      ) VALUES (
        'purchase', NULL, 'btcpay-lightning',
        NULL, NULL, NULL, NULL, NULL,
        ${order.orderId}, ${order.valueUsd}, 'USD'
      )
      ON CONFLICT (session_id) WHERE event_type = 'purchase' DO NOTHING
    `
  } catch (err) {
    console.error('BTCPay webhook: could not record purchase event —', (err as Error).message)
  }
}
