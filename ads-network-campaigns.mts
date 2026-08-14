// Netlify Function: /api/ads/network/campaigns
//
// A tenant's own ad running into the network — what shows in OTHER tenants'
// slots. GET lists their campaigns (with live impression/click counts),
// POST creates one. The creative (headline + body) is AI-written from a
// short brief, the same "grounded, not invented" approach as marketing-agent
// and google-ads-builder, but scoped to this network's own format instead of
// Google's character limits.
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
}

function fallbackCreative(productName: string, goal: string): Creative {
  return {
    headline: productName.slice(0, 60),
    body: (goal ? `${goal} — ` : '') + `See how ${productName} can help.`,
  }
}

async function aiCreative(productName: string, brief: string, goal: string): Promise<Creative> {
  const anthropic = new Anthropic()
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system:
      'You write short, honest ad creative for a native ad network (not Google/Meta — a cooperative ' +
      'network between independent online stores). Return ONLY a JSON object: {"headline": string, "body": string}. ' +
      'headline: under 60 characters, no clickbait, no ALL CAPS, no exclamation-mark stacking. ' +
      'body: under 140 characters, one concrete, specific benefit — not generic hype. ' +
      'Ground everything in the product info given. Never invent features, stats, or claims not provided.',
    messages: [
      {
        role: 'user',
        content: `Product: ${productName}\nWhat it does: ${brief || 'Not specified — write something honest and generic based on the name alone.'}\nCampaign goal: ${goal || 'general awareness'}`,
      },
    ],
  })
  const text = message.content.find((b) => b.type === 'text')?.text ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in model response')
  const parsed = JSON.parse(match[0]) as Partial<Creative>
  if (!parsed.headline || !parsed.body) throw new Error('Incomplete creative from model')
  return { headline: String(parsed.headline).slice(0, 60), body: String(parsed.body).slice(0, 140) }
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
        SELECT id, headline, body, image_url, click_url, niche, status, impression_cap, click_cap, impressions, clicks, created_at
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
      const [row] = (await db.sql`
        UPDATE ads_network_campaigns SET status = ${status}
        WHERE id = ${id} AND tenant_id = ${tenant.id}
        RETURNING id, status
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
  try {
    const body = await req.json()
    productName = String(body?.productName ?? '').trim().slice(0, 120)
    brief = String(body?.brief ?? '').trim().slice(0, 400)
    goal = String(body?.goal ?? '').trim().slice(0, 200)
    clickUrl = String(body?.clickUrl ?? '').trim().slice(0, 300)
    niche = String(body?.niche ?? '').trim().slice(0, 40)
    imageUrl = String(body?.imageUrl ?? '').trim().slice(0, 300)
    impressionCap = Number(body?.impressionCap) || 0
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
    creative = await aiCreative(productName, brief, goal)
  } catch (err) {
    console.error('ads-network-campaigns: AI creative failed, using fallback —', (err as Error).message)
    creative = fallbackCreative(productName, goal)
    source = 'fallback'
  }

  try {
    const [row] = (await db.sql`
      INSERT INTO ads_network_campaigns
        (tenant_id, headline, body, image_url, click_url, niche, impression_cap)
      VALUES
        (${tenant.id}, ${creative.headline}, ${creative.body}, ${imageUrl || null}, ${clickUrl}, ${niche || null}, ${impressionCap})
      RETURNING id, headline, body, image_url, click_url, niche, status, impression_cap, click_cap, impressions, clicks, created_at
    `) as any[]

    return Response.json({ campaign: row, source }, { status: 201, headers: NO_STORE })
  } catch (err) {
    console.error('ads-network-campaigns POST error:', (err as Error).message)
    return Response.json({ error: 'Could not create the campaign right now.' }, { status: 503, headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/ads/network/campaigns',
}
