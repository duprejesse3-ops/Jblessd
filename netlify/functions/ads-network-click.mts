// Netlify Function: GET /api/ads/network/click?campaignId=&slotId=
//
// Click-through for the owned ad network: logs the click first-party, charges
// the click against the campaign's budget if it's a paid (budget_cents > 0)
// campaign, then redirects to the advertiser's real URL. A campaign whose
// spend reaches its budget flips to 'exhausted' so it stops winning auctions
// in ads-network-serve.mts — top it up via PATCH /api/ads/network/campaigns
// (addBudgetCents) to resume. Reciprocal campaigns (budget_cents = 0) are
// never charged — same free behavior as before the CPC conversion.
//
// Public — this is the link a visitor's browser follows directly, so it
// can't require a bearer key.
//
// Reachable at /api/ads/network/click.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url)
  const campaignId = Number(url.searchParams.get('campaignId'))
  const slotId = Number(url.searchParams.get('slotId'))

  // Malformed or missing ids: send the visitor home rather than erroring on
  // what is, from their side, just a link they clicked.
  if (!Number.isFinite(campaignId) || campaignId <= 0 || !Number.isFinite(slotId) || slotId <= 0) {
    return Response.redirect('https://multinicheai.com', 302)
  }

  try {
    const db = getDatabase()
    const [campaign] = (await db.sql`
      SELECT id, click_url, price_cpc_cents, budget_cents, spent_cents
      FROM ads_network_campaigns WHERE id = ${campaignId} AND status = 'active'
    `) as any[]

    if (!campaign?.click_url) {
      return Response.redirect('https://multinicheai.com', 302)
    }

    if (campaign.budget_cents > 0) {
      const newSpent = campaign.spent_cents + campaign.price_cpc_cents
      const exhausted = newSpent >= campaign.budget_cents
      await db.sql`
        UPDATE ads_network_campaigns
        SET clicks = clicks + 1, spent_cents = ${newSpent}, status = ${exhausted ? 'exhausted' : 'active'}
        WHERE id = ${campaignId}
      `
    } else {
      await db.sql`UPDATE ads_network_campaigns SET clicks = clicks + 1 WHERE id = ${campaignId}`
    }
    await db.sql`INSERT INTO ads_network_events (slot_id, campaign_id, type) VALUES (${slotId}, ${campaignId}, 'click')`

    return Response.redirect(campaign.click_url, 302)
  } catch (err) {
    console.error('ads-network-click error:', (err as Error).message)
    return Response.redirect('https://multinicheai.com', 302)
  }
}

export const config: Config = {
  path: '/api/ads/network/click',
}
