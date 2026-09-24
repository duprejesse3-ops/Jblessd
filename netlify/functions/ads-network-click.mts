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

    // The charge used to be read spent_cents in JS, add price_cpc_cents, then
    // write the sum back in a separate UPDATE. Two clicks arriving close
    // together (normal under real traffic) could both read the same starting
    // spent_cents and both write the same sum — one click's charge silently
    // vanished, and a budget-capped campaign could serve more clicks than it
    // paid for before ever flipping to 'exhausted'.
    //
    // Doing the increment as SQL-side arithmetic in a single UPDATE makes it
    // atomic at the row level — Postgres serializes concurrent UPDATEs to the
    // same row, so there is no window where two requests can both read the
    // pre-charge value. spent_cents only moves for a paid (budget_cents > 0)
    // campaign, matching the existing "reciprocal campaigns are never
    // charged" behavior. RETURNING gets the post-charge state back from the
    // same statement instead of a separate read.
    const [campaign] = (await db.sql`
      UPDATE ads_network_campaigns
      SET
        clicks = clicks + 1,
        spent_cents = CASE WHEN budget_cents > 0 THEN spent_cents + price_cpc_cents ELSE spent_cents END,
        status = CASE
          WHEN budget_cents > 0 AND spent_cents + price_cpc_cents >= budget_cents THEN 'exhausted'
          ELSE status
        END
      WHERE id = ${campaignId} AND status = 'active'
      RETURNING click_url
    `) as any[]

    if (!campaign?.click_url) {
      return Response.redirect('https://multinicheai.com', 302)
    }

    // The charge has already landed. Losing the event log entry is a real
    // but much smaller problem than losing the advertiser's click after
    // they've already paid for it — so a logging failure must not fall
    // through to the outer catch and redirect the visitor home instead of
    // to the advertiser's page.
    try {
      await db.sql`INSERT INTO ads_network_events (slot_id, campaign_id, type) VALUES (${slotId}, ${campaignId}, 'click')`
    } catch (logErr) {
      console.error('ads-network-click event log error:', (logErr as Error).message)
    }

    return Response.redirect(campaign.click_url, 302)
  } catch (err) {
    console.error('ads-network-click error:', (err as Error).message)
    return Response.redirect('https://multinicheai.com', 302)
  }
}

export const config: Config = {
  path: '/api/ads/network/click',
}
