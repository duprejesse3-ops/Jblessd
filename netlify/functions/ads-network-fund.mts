// Netlify Function: POST /api/ads/network/fund
//
// The only way a campaign's real budget_cents grows. A tenant picks one of
// their own campaigns and an amount; this creates a Stripe Checkout Session
// for it (same pattern as create-checkout-session.mts). The browser (or
// whatever's calling with the tenant's bearer key) redirects to the returned
// url; Stripe collects the card. The actual crediting happens in
// webhook.mts once Stripe confirms payment — never here, and never from
// anything the client sends after the fact, so a dropped connection or a
// closed tab can't be mistaken for a paid top-up.
//
// Auth: bearer key (Authorization: Bearer mnads_… or x-ads-key) — same as
// ads-network-campaigns.mts. Ownership of the campaign is checked before a
// session is ever created.

import Stripe from 'stripe'
import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { readTenantKey, tenantForKey, touchTenant } from '../lib/ads-tenants.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const stripe = new Stripe(STRIPE_KEY)
const MIN_TOPUP_CENTS = 500 // $5 — below this a Stripe card transaction isn't worth the fees

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  if (!STRIPE_KEY) {
    console.error('ads-network-fund: STRIPE_SECRET_KEY is not configured')
    return Response.json({ error: 'Funding is not configured. Please try again later.' }, { status: 500, headers: NO_STORE })
  }

  const key = readTenantKey(req)
  const tenant = await tenantForKey(key)
  if (!tenant) {
    return Response.json({ error: 'Not authorized. Missing or invalid access key.' }, { status: 401, headers: NO_STORE })
  }
  void touchTenant(tenant.id)

  let campaignId = 0
  let amountCents = 0
  let returnUrl = ''
  try {
    const body = await req.json()
    campaignId = Number(body?.campaignId)
    amountCents = Math.round(Number(body?.amountCents) || 0)
    returnUrl = String(body?.returnUrl ?? '').trim().slice(0, 300)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return Response.json({ error: 'campaignId is required.' }, { status: 400, headers: NO_STORE })
  }
  if (amountCents < MIN_TOPUP_CENTS) {
    return Response.json({ error: `amountCents must be at least ${MIN_TOPUP_CENTS} ($${(MIN_TOPUP_CENTS / 100).toFixed(2)}).` }, { status: 400, headers: NO_STORE })
  }
  const origin = returnUrl && /^https?:\/\//i.test(returnUrl) ? new URL(returnUrl).origin : (req.headers.get('origin') || 'https://multinicheai.com')

  const db = getDatabase()
  // Ownership check — never let a tenant fund a campaign that isn't theirs.
  const [campaign] = (await db.sql`
    SELECT id, headline, price_cpc_cents FROM ads_network_campaigns WHERE id = ${campaignId} AND tenant_id = ${tenant.id}
  `) as any[]
  if (!campaign) {
    return Response.json({ error: 'No campaign with that id for this account.' }, { status: 404, headers: NO_STORE })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `MultiNiche Ads budget — ${campaign.headline}`.slice(0, 200),
              metadata: { campaign_id: String(campaign.id) },
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: returnUrl || `${origin}/?ads_funded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        kind: 'ads_network_topup',
        campaign_id: String(campaign.id),
        tenant_id: String(tenant.id),
      },
    })

    return Response.json({ url: session.url }, { headers: NO_STORE })
  } catch (err) {
    console.error('ads-network-fund: Stripe session creation failed —', (err as Error).message)
    return Response.json({ error: 'Unable to start funding checkout. Please try again.' }, { status: 503, headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/ads/network/fund',
}
