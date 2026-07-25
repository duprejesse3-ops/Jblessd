// Netlify Function: /api/credits — everything the Claude Agent Studio needs to
// sell, hold and report a prepaid credit balance.
//
//   GET  /api/credits                  → pack + mode pricing (public), and the
//                                        caller's balance/history when it sends
//                                        an access key.
//   GET  /api/credits?artifact=<id>    → one saved deliverable, owner only.
//   POST /api/credits {action:'checkout'} → a Stripe Checkout URL for a pack.
//   POST /api/credits {action:'claim'}    → credit a paid session and hand back
//                                          the access key (this is what makes
//                                          the purchase work even when no
//                                          Stripe webhook secret is configured).
//   POST /api/credits {action:'recover'}  → email the customer a fresh key.
//
// One function and one route on purpose: the storefront reaches functions through
// the /api/* rewrite in netlify.toml, so a sub-path like /api/credits/claim would
// resolve to a function named "credits/claim" that doesn't exist. Dispatching on
// an action in the body keeps the routing unambiguous.
//
// Authentication is a bearer access key (Authorization: Bearer … or x-agent-key),
// never a cookie: the studio has to work from a pasted key on any device, and a
// bearer header cannot be replayed cross-site the way a cookie can.

import Stripe from 'stripe'
import type { Config, Context } from '@netlify/functions'
import {
  CREDIT_PACKS,
  TRIAL_MODE_ID,
  accountForEmail,
  accountForKey,
  findPack,
  getArtifact,
  grantPurchase,
  isEmail,
  listArtifacts,
  maskEmail,
  modesForClient,
  normalizeEmail,
  packTotal,
  packsForClient,
  readAccessKey,
  recentLedger,
  reissueKey,
} from '../lib/credits.mjs'
import { sendAccessKeyEmail } from '../lib/credit-email.mjs'
import { isEmailConfigured } from '../lib/email.mjs'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''

function origin(req: Request): string {
  return req.headers.get('origin') || `https://${req.headers.get('host')}`
}

/** Public pricing — safe to serve to anyone, and the page renders from it so the
 * displayed cost of a run can never drift from what the server charges. */
function pricing() {
  return {
    packs: packsForClient(),
    modes: modesForClient(),
    trialMode: TRIAL_MODE_ID,
    checkoutConfigured: Boolean(STRIPE_KEY),
    emailConfigured: isEmailConfigured(),
  }
}

// ---- GET: pricing, balance, history, artifacts ------------------------------

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const key = readAccessKey(req)

  let account = null
  if (key) {
    try {
      account = await accountForKey(key)
    } catch (err) {
      console.error('credits: account lookup failed —', (err as Error).message)
      return Response.json(
        { ...pricing(), account: null, error: 'The credit ledger is temporarily unavailable.' },
        { status: 503, headers: NO_STORE },
      )
    }
  }

  // A single saved deliverable. Scoped to the owner's account id, so an artifact
  // id on its own is not a capability.
  const artifactId = url.searchParams.get('artifact')
  if (artifactId) {
    if (!account) return Response.json({ error: 'Add your access key first.' }, { status: 401, headers: NO_STORE })
    const artifact = await getArtifact(account.id, artifactId)
    if (!artifact) return Response.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE })
    return Response.json({ artifact }, { headers: NO_STORE })
  }

  if (!account) {
    return Response.json(
      { ...pricing(), account: null, keyStatus: key ? 'invalid' : 'none' },
      { headers: NO_STORE },
    )
  }

  const [ledger, artifacts] = await Promise.all([
    recentLedger(account.id).catch(() => []),
    listArtifacts(account.id).catch(() => []),
  ])

  return Response.json(
    {
      ...pricing(),
      keyStatus: 'ok',
      account: {
        email: maskEmail(account.email),
        balance: account.balance,
        lifetimeCredits: account.lifetimeCredits,
        since: account.createdAt,
        ledger,
        artifacts,
      },
    },
    { headers: NO_STORE },
  )
}

// ---- POST: checkout ---------------------------------------------------------

async function handleCheckout(req: Request, body: any): Promise<Response> {
  if (!STRIPE_KEY) {
    console.error('credits: STRIPE_SECRET_KEY is not configured')
    return Response.json({ error: 'Credit purchases are not configured yet.' }, { status: 503, headers: NO_STORE })
  }

  const pack = findPack(body?.pack)
  if (!pack) {
    return Response.json({ error: 'Pick one of the available credit packs.' }, { status: 400, headers: NO_STORE })
  }

  // The browser may pass an email to pre-fill Checkout, but the address that
  // actually owns the credits is the one Stripe confirms on the paid session —
  // never this one.
  const hinted = normalizeEmail(body?.email)
  const total = packTotal(pack)

  // Ad-click and campaign attribution captured on the /agent landing URL. Carried
  // onto the session so the webhook's purchase event can credit the ad or campaign
  // that produced this top-up — the same plumbing product orders already use, so
  // both revenue lines land in one ad-performance report.
  let clickId = ''
  let clickSource = ''
  const marketingConsent = body?.marketingConsent === 'granted' || body?.marketingConsent === 'denied'
    ? body.marketingConsent
    : 'unknown'
  const attribution: Record<string, string> = {}
  if (typeof body?.clickId === 'string') clickId = body.clickId.slice(0, 200)
  if (typeof body?.clickSource === 'string') clickSource = body.clickSource.slice(0, 20)
  for (const key of ['utmSource', 'utmMedium', 'utmCampaign', 'utmTerm', 'utmContent']) {
    const value = body?.attribution?.[key]
    if (typeof value === 'string' && value.trim()) attribution[key] = value.trim().slice(0, 200)
  }

  try {
    const stripe = new Stripe(STRIPE_KEY)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      ...(isEmail(hinted) ? { customer_email: hinted } : {}),
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Claude Agent Studio — ${total} credits (${pack.label})`,
              description: pack.bonus
                ? `${pack.credits} credits + ${pack.bonus} bonus. Credits never expire.`
                : `${pack.credits} credits. Credits never expire.`,
              metadata: { credit_pack: pack.id },
            },
            unit_amount: pack.priceCents,
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${origin(req)}/agent?credits=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin(req)}/agent?credits=cancelled`,
      custom_text: {
        submit: {
          message:
            'Credits are added to your balance immediately and never expire. Because they are usable at once, credit purchases are final — see the refund policy.',
        },
      },
      // `kind` is what the webhook and the claim endpoint switch on to tell a
      // credit top-up apart from a product order. The credit count is re-derived
      // from the pack id server-side; it is carried here only for reporting.
      metadata: {
        kind: 'credits',
        credit_pack: pack.id,
        credit_amount: String(total),
        digital_delivery_acknowledged: 'true',
        refund_policy_version: '2026-07-25',
        ...(clickId ? { ad_click_id: clickId, ad_click_source: clickSource || 'gclid' } : {}),
        ad_user_data_consent: marketingConsent,
        ...(attribution.utmSource ? { utm_source: attribution.utmSource } : {}),
        ...(attribution.utmMedium ? { utm_medium: attribution.utmMedium } : {}),
        ...(attribution.utmCampaign ? { utm_campaign: attribution.utmCampaign } : {}),
        ...(attribution.utmTerm ? { utm_term: attribution.utmTerm } : {}),
        ...(attribution.utmContent ? { utm_content: attribution.utmContent } : {}),
      },
    })
    return Response.json({ url: session.url }, { headers: NO_STORE })
  } catch (err) {
    console.error('credits: could not start checkout —', (err as Error).message)
    return Response.json({ error: 'Unable to start checkout. Please try again.' }, { status: 502, headers: NO_STORE })
  }
}

// ---- POST: claim a paid session --------------------------------------------

async function handleClaim(req: Request, body: any): Promise<Response> {
  if (!STRIPE_KEY) {
    return Response.json({ error: 'Credit purchases are not configured yet.' }, { status: 503, headers: NO_STORE })
  }
  const sessionId = String(body?.sessionId ?? '').trim()
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: 'That checkout session is not valid.' }, { status: 400, headers: NO_STORE })
  }

  try {
    const stripe = new Stripe(STRIPE_KEY)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return Response.json(
        { error: 'That payment has not completed yet. Give it a moment and reload.', pending: true },
        { status: 402, headers: NO_STORE },
      )
    }
    if (session.metadata?.kind !== 'credits') {
      return Response.json({ error: 'That order was not a credit purchase.' }, { status: 400, headers: NO_STORE })
    }

    const email = normalizeEmail(session.customer_details?.email ?? session.customer_email ?? '')
    if (!isEmail(email)) {
      return Response.json(
        { error: 'That purchase has no email on it, so we cannot attach the credits. Contact support.' },
        { status: 409, headers: NO_STORE },
      )
    }

    // Credits come from the pack definition, not from the session — so a tampered
    // metadata value can never mint credits that weren't paid for.
    const pack = findPack(session.metadata?.credit_pack)
    const credits = pack ? packTotal(pack) : Number(session.metadata?.credit_amount ?? 0)
    if (!credits || credits < 0) {
      return Response.json({ error: 'That purchase has no credits attached.' }, { status: 409, headers: NO_STORE })
    }

    const result = await grantPurchase({
      email,
      credits,
      amountCents: session.amount_total ?? pack?.priceCents ?? 0,
      detail: pack ? `${pack.label} pack — ${credits} credits` : `${credits} credits`,
      sessionId: session.id,
      presentedKey: readAccessKey(req),
      // The browser needs a usable key in its hands right now, so re-issue when
      // it can't present one. Possession of an unlisted, paid Stripe session id
      // is the proof of ownership here — the same proof the order-download flow
      // already relies on.
      reissueIfUnknown: true,
    })

    if (result.issuedKey) {
      // Best-effort durable copy. The key is in the response either way.
      sendAccessKeyEmail({
        to: email,
        key: result.issuedKey,
        creditsAdded: result.granted ? credits : 0,
        balance: result.balance,
        origin: origin(req),
        reason: 'purchase',
      }).catch((err) => console.error('credits: key email failed —', (err as Error).message))
    }

    return Response.json(
      {
        ok: true,
        granted: result.granted,
        credits: result.granted ? credits : 0,
        value: (session.amount_total ?? pack?.priceCents ?? 0) / 100,
        currency: (session.currency ?? 'usd').toUpperCase(),
        pack: pack?.id ?? null,
        balance: result.balance,
        email: maskEmail(email),
        key: result.issuedKey ?? null,
        emailed: Boolean(result.issuedKey) && isEmailConfigured(),
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('credits: claim failed —', (err as Error).message)
    return Response.json(
      { error: 'We could not confirm that purchase. Your credits are safe — try reloading in a minute.' },
      { status: 502, headers: NO_STORE },
    )
  }
}

// ---- POST: recover a lost key ----------------------------------------------

async function handleRecover(req: Request, body: any, ip: string | undefined): Promise<Response> {
  // Re-issuing mails a bearer token to an address, so it is both an email-sending
  // endpoint and a key-rotation endpoint: rate limit it hard.
  const limit = await checkRateLimit('credits-recover', ip, { limit: 4, windowMs: 60 * 60 * 1000 })
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSec, 'Too many key requests. Try again in a little while.')

  const email = normalizeEmail(body?.email)
  if (!isEmail(email)) {
    return Response.json({ error: 'Enter the email address you bought credits with.' }, { status: 400, headers: NO_STORE })
  }

  // Rotating a key when we have no way to deliver the new one would lock the
  // customer out of a balance they paid for. Refuse instead.
  if (!isEmailConfigured()) {
    return Response.json(
      { error: 'Key delivery by email is not available on this deploy. Contact support and we will restore your access.' },
      { status: 503, headers: NO_STORE },
    )
  }

  try {
    const account = await accountForEmail(email)
    if (account) {
      const key = await reissueKey(account.id)
      await sendAccessKeyEmail({
        to: account.email,
        key,
        balance: account.balance,
        origin: origin(req),
        reason: 'recovery',
      })
    }
  } catch (err) {
    console.error('credits: recovery failed —', (err as Error).message)
  }

  // Always the same answer, whether or not an account exists — otherwise this
  // endpoint becomes a way to test which of your customers' addresses we hold.
  return Response.json(
    { ok: true, message: 'If that address has a balance, a new access key is on its way. It replaces any earlier key.' },
    { headers: NO_STORE },
  )
}

// ---- handler ----------------------------------------------------------------

export default async (req: Request, context: Context) => {
  if (req.method === 'GET') return handleGet(req)

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined

  switch (String(body?.action ?? '')) {
    case 'checkout':
      return handleCheckout(req, body)
    case 'claim':
      return handleClaim(req, body)
    case 'recover':
      return handleRecover(req, body, ip)
    default:
      return Response.json(
        { error: 'Unknown action.', actions: ['checkout', 'claim', 'recover'], packs: CREDIT_PACKS.map((p) => p.id) },
        { status: 400, headers: NO_STORE },
      )
  }
}

export const config: Config = {
  path: '/api/credits',
}
