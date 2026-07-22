// Aggregates the first-party ad_events dataset into the numbers a store owner
// needs to optimise Google Ads spend: how much traffic each campaign / source /
// landing page brings in, how much of it converts, and how much revenue it
// produces. Kept in one place so the admin HTTP endpoint (/api/ad-performance)
// and the admin console's read-only tool return exactly the same figures.
//
// Attribution model (honest about Google Ads auto-tagging):
//   * A landing or purchase with utm_campaign is grouped under that campaign.
//   * A paid click carrying only a gclid/gbraid/wbraid (Google's auto-tagging
//     strips the campaign from the URL) is grouped as a paid Google Ads click;
//     its campaign/keyword breakdown lives in Google Ads itself, reached via the
//     stored click id. Everything else is '(unattributed)' organic/direct.

import { getDatabase } from '@netlify/database'

export interface AdPerformanceReport {
  windowDays: number
  summary: {
    landings: number
    purchases: number
    revenue: number
    conversionRate: number // purchases / landings, 0..1
    avgOrderValue: number
  }
  byCampaign: Array<{ campaign: string; landings: number; purchases: number; revenue: number; conversionRate: number }>
  bySource: Array<{ source: string; landings: number; purchases: number; revenue: number }>
  topLandingPages: Array<{ landingPath: string; landings: number }>
  daily: Array<{ day: string; landings: number; purchases: number; revenue: number }>
}

const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const rate = (num: number, den: number): number => (den > 0 ? Number((num / den).toFixed(4)) : 0)

/** Build the ad-performance report over the last `days` days (clamped 1..365). */
export async function getAdPerformance(days: number): Promise<AdPerformanceReport> {
  const windowDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365)
  const db = getDatabase()

  const [summaryRow] = (await db.sql`
    SELECT
      count(*) FILTER (WHERE event_type = 'landing')                       AS landings,
      count(*) FILTER (WHERE event_type = 'purchase')                      AS purchases,
      COALESCE(sum(value) FILTER (WHERE event_type = 'purchase'), 0)       AS revenue
    FROM ad_events
    WHERE created_at >= now() - make_interval(days => ${windowDays}::int)
  `) as any[]

  const campaignRows = (await db.sql`
    SELECT
      COALESCE(NULLIF(utm_campaign, ''), '(no utm_campaign)')              AS campaign,
      count(*) FILTER (WHERE event_type = 'landing')                       AS landings,
      count(*) FILTER (WHERE event_type = 'purchase')                      AS purchases,
      COALESCE(sum(value) FILTER (WHERE event_type = 'purchase'), 0)       AS revenue
    FROM ad_events
    WHERE created_at >= now() - make_interval(days => ${windowDays}::int)
    GROUP BY 1
    ORDER BY revenue DESC, landings DESC
    LIMIT 50
  `) as any[]

  const sourceRows = (await db.sql`
    SELECT
      CASE
        WHEN click_id IS NOT NULL THEN 'google-ads (paid click)'
        WHEN COALESCE(NULLIF(utm_source, ''), '') <> ''
          THEN utm_source || COALESCE(' / ' || NULLIF(utm_medium, ''), '')
        ELSE '(unattributed)'
      END                                                                  AS source,
      count(*) FILTER (WHERE event_type = 'landing')                       AS landings,
      count(*) FILTER (WHERE event_type = 'purchase')                      AS purchases,
      COALESCE(sum(value) FILTER (WHERE event_type = 'purchase'), 0)       AS revenue
    FROM ad_events
    WHERE created_at >= now() - make_interval(days => ${windowDays}::int)
    GROUP BY 1
    ORDER BY revenue DESC, landings DESC
    LIMIT 50
  `) as any[]

  const landingRows = (await db.sql`
    SELECT landing_path AS path, count(*) AS landings
    FROM ad_events
    WHERE event_type = 'landing' AND landing_path IS NOT NULL
      AND created_at >= now() - make_interval(days => ${windowDays}::int)
    GROUP BY 1
    ORDER BY landings DESC
    LIMIT 15
  `) as any[]

  const dailyRows = (await db.sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD')                 AS day,
      count(*) FILTER (WHERE event_type = 'landing')                       AS landings,
      count(*) FILTER (WHERE event_type = 'purchase')                      AS purchases,
      COALESCE(sum(value) FILTER (WHERE event_type = 'purchase'), 0)       AS revenue
    FROM ad_events
    WHERE created_at >= now() - make_interval(days => ${windowDays}::int)
    GROUP BY 1
    ORDER BY day DESC
    LIMIT ${windowDays}
  `) as any[]

  const landings = n(summaryRow?.landings)
  const purchases = n(summaryRow?.purchases)
  const revenue = Number(n(summaryRow?.revenue).toFixed(2))

  return {
    windowDays,
    summary: {
      landings,
      purchases,
      revenue,
      conversionRate: rate(purchases, landings),
      avgOrderValue: purchases > 0 ? Number((revenue / purchases).toFixed(2)) : 0,
    },
    byCampaign: (campaignRows ?? []).map((r) => ({
      campaign: r.campaign,
      landings: n(r.landings),
      purchases: n(r.purchases),
      revenue: Number(n(r.revenue).toFixed(2)),
      conversionRate: rate(n(r.purchases), n(r.landings)),
    })),
    bySource: (sourceRows ?? []).map((r) => ({
      source: r.source,
      landings: n(r.landings),
      purchases: n(r.purchases),
      revenue: Number(n(r.revenue).toFixed(2)),
    })),
    topLandingPages: (landingRows ?? []).map((r) => ({ landingPath: r.path, landings: n(r.landings) })),
    daily: (dailyRows ?? []).map((r) => ({
      day: r.day,
      landings: n(r.landings),
      purchases: n(r.purchases),
      revenue: Number(n(r.revenue).toFixed(2)),
    })),
  }
}
