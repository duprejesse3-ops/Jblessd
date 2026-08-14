// Netlify Function: GET /api/ads/network/click?campaignId=&slotId=
//
// Click-through for the owned ad network: logs the click first-party, then
// redirects to the advertiser's real URL. Public — this is the link a
// visitor's browser follows directly, so it can't require a bearer key.
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
    return Response.redirect('https://jblessd.com', 302)
  }

  try {
    const db = getDatabase()
    const [campaign] = (await db.sql`
      SELECT id, click_url FROM ads_network_campaigns WHERE id = ${campaignId} AND status = 'active'
    `) as any[]

    if (!campaign?.click_url) {
      return Response.redirect('https://jblessd.com', 302)
    }

    await db.sql`UPDATE ads_network_campaigns SET clicks = clicks + 1 WHERE id = ${campaignId}`
    await db.sql`INSERT INTO ads_network_events (slot_id, campaign_id, type) VALUES (${slotId}, ${campaignId}, 'click')`

    return Response.redirect(campaign.click_url, 302)
  } catch (err) {
    console.error('ads-network-click error:', (err as Error).message)
    return Response.redirect('https://jblessd.com', 302)
  }
}

export const config: Config = {
  path: '/api/ads/network/click',
}
