// Scheduled function: MultiNiche Ads network CPC pricing.
//
// Daily. Reviews the last 7 days of impressions/clicks (ads_network_events)
// for every paid campaign (budget_cents > 0) with enough volume to price
// meaningfully, and asks Claude to propose a price_cpc_cents multiplier —
// raise it for campaigns converting well, lower it for ones that aren't.
// Reciprocal campaigns (budget_cents = 0) are left alone entirely: there's
// no charge to optimize.
//
// Never runs in the request path — ads-network-serve.mts and
// ads-network-click.mts only ever read/write price_cpc_cents that this job
// already decided, same offline-then-cache split as the rest of this system.
//
// Env vars (all optional):
//   ADS_PRICE_MIN_IMPRESSIONS  volume floor before pricing a campaign (default 30)

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5'
const MIN_IMPRESSIONS = Number(process.env.ADS_PRICE_MIN_IMPRESSIONS || 30)
const MIN_MULTIPLIER = 0.5
const MAX_MULTIPLIER = 1.5
const MIN_CPC_CENTS = 2
const MAX_CPC_CENTS = 500

interface Suggestion {
  campaignId: number
  multiplier: number
  reason: string
}

export default async () => {
  const db = getDatabase()

  const rows = (await db.sql`
    SELECT
      c.id, c.price_cpc_cents, c.budget_cents, c.spent_cents,
      COUNT(*) FILTER (WHERE e.type = 'impression') AS impressions,
      COUNT(*) FILTER (WHERE e.type = 'click') AS clicks
    FROM ads_network_campaigns c
    JOIN ads_network_events e ON e.campaign_id = c.id AND e.created_at > now() - interval '7 days'
    WHERE c.status = 'active' AND c.budget_cents > 0
    GROUP BY c.id, c.price_cpc_cents, c.budget_cents, c.spent_cents
    HAVING COUNT(*) FILTER (WHERE e.type = 'impression') >= ${MIN_IMPRESSIONS}
  `) as any[]

  if (!rows.length) {
    console.log(`[ads-network-price] no paid campaigns with ${MIN_IMPRESSIONS}+ impressions in the last 7 days`)
    return Response.json({ adjusted: 0, candidates: 0 })
  }

  let suggestions: Suggestion[]
  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system:
        'You adjust CPC pricing for ads in a first-party ad network based on 7-day click-through rate. ' +
        'Propose a multiplier per campaign: above 1.0 to raise price for campaigns converting well, below 1.0 ' +
        `to lower it for weak CTR, 1.0 for no real signal either way. Keep every multiplier between ${MIN_MULTIPLIER} and ${MAX_MULTIPLIER}. ` +
        'Return ONLY a JSON array of objects shaped {"campaignId": number, "multiplier": number, "reason": string}, one per campaign, reason under 15 words.',
      messages: [
        {
          role: 'user',
          content: rows
            .map((r) => `campaignId=${r.id}: current_price_cpc_cents=${r.price_cpc_cents}, impressions=${r.impressions}, clicks=${r.clicks}`)
            .join('\n'),
        },
      ],
    })
    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array in model response')
    suggestions = JSON.parse(match[0]) as Suggestion[]
  } catch (err) {
    console.error('[ads-network-price] Claude call failed, prices left unchanged —', (err as Error).message)
    return Response.json({ error: 'pricing run failed' }, { status: 503 })
  }

  let adjusted = 0
  for (const s of suggestions) {
    const row = rows.find((r) => r.id === s.campaignId)
    if (!row || !Number.isFinite(s.multiplier)) continue

    const clampedMultiplier = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, s.multiplier))
    const newPrice = Math.min(
      MAX_CPC_CENTS,
      Math.max(MIN_CPC_CENTS, Math.round(row.price_cpc_cents * clampedMultiplier)),
    )
    await db.sql`UPDATE ads_network_campaigns SET price_cpc_cents = ${newPrice} WHERE id = ${s.campaignId}`
    adjusted++
  }

  console.log(`[ads-network-price] adjusted ${adjusted}/${rows.length} paid campaign(s)`)
  return Response.json({ adjusted, candidates: rows.length })
}

export const config: Config = {
  schedule: '0 7 * * *',
}
