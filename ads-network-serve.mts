// Netlify Function: GET /api/ads/network/serve?slotKey=...
//
// The engine of the owned ad network: given a slot another tenant (or this
// store) registered on their own site, picks one eligible campaign from a
// DIFFERENT tenant to show there, logs the impression, and returns the
// creative. No Google, no Meta, no ad exchange, no money — just reciprocal
// exposure between tenants, tracked first-party.
//
// Public by design (the embed snippet calls this from any visitor's browser,
// so it can't carry a secret bearer key) — the slot_key itself is the only
// credential, and it identifies WHERE an ad renders, never who can publish
// one (that still requires a tenant's own bearer key, see ads-network-campaigns).
//
// Selection is weighted by remaining budget (impression_cap - impressions),
// not pure random, so a campaign that's about to hit its cap naturally shows
// less — no per-request AI call needed to keep this endpoint fast.
//
// Reachable at /api/ads/network/serve.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

const NO_STORE = { 'Cache-Control': 'no-store' }

interface Campaign {
  id: number
  tenant_id: number
  headline: string
  body: string
  image_url: string | null
  click_url: string
  niche: string | null
  impression_cap: number
  impressions: number
}

function pickWeighted(campaigns: Campaign[]): Campaign {
  // Remaining room under the cap, or a flat weight of 50 for uncapped
  // campaigns, so capped-but-fresh campaigns aren't drowned out by unlimited
  // ones and a campaign near its cap tapers off instead of stopping dead.
  const weights = campaigns.map((c) => (c.impression_cap > 0 ? Math.max(1, c.impression_cap - c.impressions) : 50))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < campaigns.length; i++) {
    r -= weights[i]
    if (r <= 0) return campaigns[i]
  }
  return campaigns[campaigns.length - 1]
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  const slotKey = new URL(req.url).searchParams.get('slotKey')?.trim().slice(0, 100) ?? ''
  if (!slotKey) return Response.json({ error: 'slotKey is required.' }, { status: 400, headers: NO_STORE })

  try {
    const db = getDatabase()
    const [slot] = (await db.sql`
      SELECT id, tenant_id, niche, status
      FROM ads_network_slots
      WHERE slot_key = ${slotKey}
    `) as any[]

    if (!slot || slot.status !== 'active') {
      return Response.json({ error: 'No active slot with that key.' }, { status: 404, headers: NO_STORE })
    }

    // Eligible: active, not the slot's own tenant (no self-serving into your
    // own slot — that would let a tenant farm impressions for free), under
    // its impression cap (0 = unlimited), and niche-matched when the slot
    // declares one (untargeted campaigns are always eligible).
    const campaigns = (await db.sql`
      SELECT id, tenant_id, headline, body, image_url, click_url, niche, impression_cap, impressions
      FROM ads_network_campaigns
      WHERE status = 'active'
        AND tenant_id != ${slot.tenant_id}
        AND (impression_cap = 0 OR impressions < impression_cap)
        AND (${slot.niche}::text IS NULL OR niche IS NULL OR niche = ${slot.niche})
      LIMIT 200
    `) as Campaign[]

    if (!campaigns.length) {
      // An honest empty response, not an error — a brand-new network with
      // few tenants will hit this a lot. The embed script hides the slot.
      return Response.json({ ad: null }, { headers: NO_STORE })
    }

    const chosen = pickWeighted(campaigns)

    await db.sql`
      UPDATE ads_network_campaigns SET impressions = impressions + 1 WHERE id = ${chosen.id}
    `
    await db.sql`
      INSERT INTO ads_network_events (slot_id, campaign_id, type) VALUES (${slot.id}, ${chosen.id}, 'impression')
    `

    return Response.json(
      {
        ad: {
          campaignId: chosen.id,
          slotId: slot.id,
          headline: chosen.headline,
          body: chosen.body,
          imageUrl: chosen.image_url,
          clickUrl: `/api/ads/network/click?campaignId=${chosen.id}&slotId=${slot.id}`,
        },
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('ads-network-serve error:', (err as Error).message)
    // Fail quiet, not loud — a broken ad slot should never break the host page.
    return Response.json({ ad: null }, { headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/ads/network/serve',
}
