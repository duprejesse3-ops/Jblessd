// Netlify Function: GET /api/ads/network/serve?slotKey=...
//
// The engine of the owned ad network: given a slot another tenant (or this
// store) registered on their own site, picks one eligible campaign from a
// DIFFERENT tenant to show there, logs the impression, and returns the
// creative. No Google, no Meta, no external ad exchange — a first-party
// network where reciprocal (free) and CPC-priced campaigns compete side by
// side, tracked first-party.
//
// Public by design (the embed snippet calls this from any visitor's browser,
// so it can't carry a secret bearer key) — the slot_key itself is the only
// credential, and it identifies WHERE an ad renders, never who can publish
// one (that still requires a tenant's own bearer key, see ads-network-campaigns).
//
// Selection is a simple weighted auction, not pure random and no per-request
// AI call (keeps this endpoint fast): weight = price_cpc_cents, so a higher
// bid shows more often, tempered by remaining room under impression_cap for
// campaigns that set one. Money changes hands on CLICK, not on winning the
// auction — see ads-network-click.mts, which is also where spend against
// budget_cents is charged and a campaign that hits its budget is exhausted.
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
  price_cpc_cents: number
}

function pickWeighted(campaigns: Campaign[]): Campaign {
  // Weight = bid (price_cpc_cents), so a higher-priced campaign wins the
  // auction more often — the whole point of converting this to CPC. That's
  // tempered by remaining room under impression_cap for campaigns that set
  // one, same taper-instead-of-stopping-dead behavior as before: a capped
  // campaign near its cap contributes less regardless of its bid.
  const weights = campaigns.map((c) => {
    const bid = Math.max(1, c.price_cpc_cents || 1)
    const room = c.impression_cap > 0 ? Math.max(0.05, (c.impression_cap - c.impressions) / c.impression_cap) : 1
    return bid * room
  })
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
      SELECT id, tenant_id, headline, body, image_url, click_url, niche, impression_cap, impressions, price_cpc_cents
      FROM ads_network_campaigns
      WHERE status = 'active'
        AND tenant_id != ${slot.tenant_id}
        AND (impression_cap = 0 OR impressions < impression_cap)
        AND (budget_cents = 0 OR spent_cents < budget_cents)
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
