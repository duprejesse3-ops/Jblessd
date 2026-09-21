// Netlify Function: /api/ads/network/campaigns
//
// A tenant's own ad running into the network — what shows in OTHER tenants'
// slots. GET lists their campaigns (with live impression/click counts),
// POST creates one. The creative (headline + body) is AI-written from a
// short brief, the same "grounded, not invented" approach as marketing-agent
// and google-ads-builder, but scoped to this network's own format instead of
// Google's character limits.
//
// CPC pricing: a campaign becomes a real paid campaign once it's funded via
// POST /api/ads/network/fund (Stripe Checkout) — budget_cents only ever
// increases there, after a webhook confirms payment (see
// netlify/functions/webhook.mts, kind === 'ads_network_topup'). A brand new
// campaign always starts at budget_cents = 0 (reciprocal/free), same as
// before the CPC conversion, so old and new campaigns compete in the same
// auction in ads-network-serve.mts until a tenant chooses to fund one.
// targetBudgetCents at creation is informational only — it tells Claude how
// much the tenant plans to spend so it can propose a sensible opening bid,
// it does NOT set real spending power. See ads-network-price.mts for how
// price_cpc_cents moves after launch.
//
// Auth: bearer key (Authorization: Bearer mnads_… or x-ads-key).
// Reachable at /api/ads/network/campaigns.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { readTenantKey, tenantForKey, touchTenant } from '../lib/ads-tenants.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const MODEL = 'claude-sonnet-4-5'

interface Creative {
  headline: string
  body: string
  suggestedCpcCents: number
}

const MIN_CPC_CENTS = 2
const MAX_CPC_CENTS = 500
const DEFAULT_CPC_CENTS = 5

function clampCpc(cents: number): number {
  return Math.min(MAX_CPC_CENTS, Math.max(MIN_CPC_CENTS, Math.round(cents)))
}

function fallbackCreative(productName: string, goal: string): Creative {
  return {
    headline: productName.slice(0, 60),
    body: (goal ? `${goal} — ` : '') + `See how ${productName} can help.`,
    suggestedCpcCents: DEFAULT_CPC_CENTS,
  }
}

async function aiCreative(productName: string, brief: string, goal: string, targetBudgetCents: number): Promise<Creative> {
  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 220,
    system:
      'You write short, honest ad creative for a native ad network (not Google/Meta — a cooperative ' +
      'network between independent online stores) and propose an opening CPC bid for it. ' +
      `Return ONLY a JSON object: {"headline": string, "body": string, "suggestedCpcCents": number}. ` +
      'headline: under 60 characters, no clickbait, no ALL CAPS, no exclamation-mark stacking. ' +
      'body: under 140 characters, one concrete, specific benefit — not generic hype. ' +
      'Ground everything in the product info given. Never invent features, stats, or claims not provided. ' +
      `suggestedCpcCents: a reasonable opening bid in US cents, between ${MIN_CPC_CENTS} and ${MAX_CPC_CENTS}, ` +
      'given the offer and the campaign budget — there is no traffic history yet, so treat this as a starting ' +
      'point, not a precise estimate. A larger budget can sustain a slightly higher opening bid.',
    messages: [
      {
        role: 'user',
        content:
          `Product: ${productName}\nWhat it does: ${brief || 'Not specified — write something honest and generic based on the name alone.'}\n` +
          `Campaign goal: ${goal || 'general awareness'}\nBudget: ${targetBudgetCents > 0 ? `$${(targetBudgetCents / 100).toFixed(2)} target` : 'unset (reciprocal/free campaign)'}`,
      },
    ],
  })
  const text = message.content.find((b) => b.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in model response')
  const parsed = JSON.parse(match[0]) as Partial<Creative>
  if (!parsed.headline || !parsed.body) throw new Error('Incomplete creative from model')
  return {
    headline: String(parsed.headline).slice(0, 60),
    body: String(parsed.body).slice(0, 140),
    suggestedCpcCents: clampCpc(Number(parsed.suggestedCpcCents) || DEFAULT_CPC_CENTS),
  }
}

export default async (req: Request, _context: Context) => {
  const key = readTenantKey(req)
  const tenant = await tenantForKey(key)
  if (!tenant) {
    return Response.json({ error: 'Not authorized. Missing or invalid access key.' }, { status: 401, headers: NO_STORE })
  }
  void touchTenant(tenant.id)

  const db = getDatabase()

  if (req.method === 'GET') {
    try {
      const rows = (await db.sql`
        SELECT id, headline, body, image_url, click_url, niche, status, impression_cap, click_cap,
               impressions, clicks, price_cpc_cents, budget_cents, spent_cents, created_at
        FROM ads_network_campaigns WHERE tenant_id = ${tenant.id} ORDER BY created_at DESC
      `) as any[]
      return Response.json({ campaigns: rows }, { headers: NO_STORE })
    } catch (err) {
      console.error('ads-network-campaigns GET error:', (err as Error).message)
      return Response.json({ campaigns: [] }, { headers: NO_STORE })
    }
  }

  if (req.method === 'PATCH') {
    let id = 0
    let status = ''
    try {
      const body = await req.json()
      id = Number(body?.id)
      status = String(body?.status ?? '').trim()
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
    }
    if (!['active', 'paused'].includes(status)) {
      return Response.json({ error: 'status must be "active" or "paused".' }, { status: 400, headers: NO_STORE })
    }
    try {
      // Deliberately does NOT accept a budget field here — that would let a
      // tenant credit their own campaign with their own bearer key, no
      // payment required. Budget only ever moves via POST /api/ads/network/fund
      // + a confirmed Stripe webhook. An 'exhausted' campaign can be reactivated
      // here (status: 'active'), but stays budget_cents-capped until funded again.
      const [row] = (await db.sql`
        UPDATE ads_network_campaigns SET status = ${status}
        WHERE id = ${id} AND tenant_id = ${tenant.id}
        RETURNING id, status, budget_cents, spent_cents
      `) as any[]
      if (!row) return Response.json({ error: 'No campaign with that id for this account.' }, { status: 404, headers: NO_STORE })
      return Response.json({ campaign: row }, { headers: NO_STORE })
    } catch (err) {
      console.error('ads-network-campaigns PATCH error:', (err as Error).message)
      return Response.json({ error: 'Could not update the campaign right now.' }, { status: 503, headers: NO_STORE })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST, PATCH' } })
  }

  let productName = ''
  let brief = ''
  let goal = ''
  let clickUrl = ''
  let niche = ''
  let imageUrl = ''
  let impressionCap = 0
  let targetBudgetCents = 0 // informational only — shapes Claude's suggested bid, never written as real budget_cents
  let priceCpcCents = 0 // 0 = "not specified", falls back to Claude's suggestion
  try {
    const body = await req.json()
    productName = String(body?.productName ?? '').trim().slice(0, 120)
    brief = String(body?.brief ?? '').trim().slice(0, 400)
    goal = String(body?.goal ?? '').trim().slice(0, 200)
    clickUrl = String(body?.clickUrl ?? '').trim().slice(0, 300)
    niche = String(body?.niche ?? '').trim().slice(0, 40)
    imageUrl = String(body?.imageUrl ?? '').trim().slice(0, 300)
    impressionCap = Number(body?.impressionCap) || 0
    targetBudgetCents = Math.max(0, Math.round(Number(body?.targetBudgetCents) || 0))
    priceCpcCents = Math.round(Number(body?.priceCpcCents) || 0)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  if (!productName) return Response.json({ error: 'productName is required.' }, { status: 400, headers: NO_STORE })
  if (!/^https?:\/\//i.test(clickUrl)) {
    return Response.json({ error: 'A valid clickUrl (http/https) is required.' }, { status: 400, headers: NO_STORE })
  }

  let creative: Creative
  let source: 'ai' | 'fallback' = 'ai'
  try {
    creative = await aiCreative(productName, brief, goal, targetBudgetCents)
  } catch (err) {
    console.error('ads-network-campaigns: AI creative failed, using fallback —', (err as Error).message)
    creative = fallbackCreative(productName, goal)
    source = 'fallback'
  }

  // Explicit priceCpcCents wins if given (and valid); otherwise Claude's
  // suggestion. This is stored even for an unfunded (budget_cents = 0)
  // campaign so it's ready the moment the tenant funds it — see
  // ads-network-fund.mts.
  const finalPriceCpcCents = priceCpcCents > 0 ? clampCpc(priceCpcCents) : creative.suggestedCpcCents

  try {
    // budget_cents is always 0 here, deliberately — see the header comment.
    // Real budget only ever comes from a confirmed Stripe payment.
    const [row] = (await db.sql`
      INSERT INTO ads_network_campaigns
        (tenant_id, headline, body, image_url, click_url, niche, impression_cap, price_cpc_cents, budget_cents)
      VALUES
        (${tenant.id}, ${creative.headline}, ${creative.body}, ${imageUrl || null}, ${clickUrl}, ${niche || null}, ${impressionCap}, ${finalPriceCpcCents}, 0)
      RETURNING id, headline, body, image_url, click_url, niche, status, impression_cap, click_cap,
                impressions, clicks, price_cpc_cents, budget_cents, spent_cents, created_at
    `) as any[]

    return Response.json(
      {
        campaign: row,
        source,
        note: targetBudgetCents > 0 ? 'Fund this campaign at POST /api/ads/network/fund to make it a real paid campaign.' : undefined,
      },
      { status: 201, headers: NO_STORE },
    )
  } catch (err) {
    console.error('ads-network-campaigns POST error:', (err as Error).message)
    return Response.json({ error: 'Could not create the campaign right now.' }, { status: 503, headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/ads/network/campaigns',
}
