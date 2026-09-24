// Real-traffic aggregation for the SWARM app (swarm.multinicheai.com).
//
// SWARM tags every landing URL it builds with utm_source=swarm,
// utm_medium=<channel>, utm_campaign=<swarmId>, utm_content=<orgId> (see
// swarm/src/lib/genome.ts buildLanding()). Those links point at real pages on
// THIS site, so every landing and purchase they produce already lands in
// ad_events via /api/track-landing and the checkout webhooks — SWARM just
// never reads it back. This is the read side of that same first-party
// dataset, scoped to rows SWARM itself produced, grouped by organism
// (utm_content) so SWARM can replace its simulated fitness numbers with what
// actually happened.
//
// Deliberately public / anonymous, unlike /api/ad-performance:
//   - it only exposes the utm_source='swarm' slice, which SWARM chose to
//     publish the moment it put those tags in a public link;
//   - SWARM runs on a separate origin (Vercel / swarm.multinicheai.com) with
//     no shared session, so cookie auth doesn't cross that boundary;
//   - the same aggregate is the intended input for a future public proof
//     page (real win/loss record per organism), so there is no
//     confidentiality left to protect here — only the standard
//     no-PII guarantee ad_events already gives every row.

import { getDatabase } from '@netlify/database'

export interface SwarmOrganismPerformance {
  swarmId: string
  orgId: string
  landings: number
  purchases: number
  revenue: number
  firstSeen: string
  lastSeen: string
}

export interface SwarmPerformanceReport {
  windowDays: number
  asOf: string
  organisms: SwarmOrganismPerformance[]
}

const n = (v: unknown): number => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const rate = (num: number, den: number): number => (den > 0 ? Number((num / den).toFixed(4)) : 0)


/** Real landings/purchases/revenue per SWARM organism over the last `days` days. */
export async function getSwarmPerformance(days: number): Promise<SwarmPerformanceReport> {
  const windowDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365)
  const db = getDatabase()

  const rows = (await db.sql`
    SELECT
      utm_campaign                                                          AS swarm_id,
      utm_content                                                           AS org_id,
      count(*) FILTER (WHERE event_type = 'landing')                        AS landings,
      count(*) FILTER (WHERE event_type = 'purchase')                       AS purchases,
      COALESCE(sum(value) FILTER (WHERE event_type = 'purchase'), 0)        AS revenue,
      min(created_at)                                                       AS first_seen,
      max(created_at)                                                       AS last_seen
    FROM ad_events
    WHERE utm_source = 'swarm'
      AND utm_campaign IS NOT NULL AND utm_campaign <> ''
      AND utm_content IS NOT NULL AND utm_content <> ''
      AND created_at >= now() - make_interval(days => ${windowDays}::int)
    GROUP BY 1, 2
    ORDER BY revenue DESC, landings DESC
    LIMIT 500
  `) as any[]

  return {
    windowDays,
    asOf: new Date().toISOString(),
    organisms: rows.map((r) => ({
      swarmId: String(r.swarm_id),
      orgId: String(r.org_id),
      landings: n(r.landings),
      purchases: n(r.purchases),
      revenue: n(r.revenue),
      firstSeen: String(r.first_seen),
      lastSeen: String(r.last_seen),
    })),
  }
}

export interface SwarmScorecardRow {
  orgId: string
  swarmId: string
  sku: string
  channel: string
  headline: string
  body: string
  proofHook: string | null
  landingUrl: string
  liveAt: string
  landings: number
  purchases: number
  revenue: number
}

export interface SwarmScorecardReport {
  windowDays: number
  asOf: string
  totals: { landings: number; purchases: number; revenue: number; conversionRate: number }
  organisms: SwarmScorecardRow[]
}

/**
 * The public trust page's data: every registered organism (real copy, from
 * swarm_organisms) left-joined against its real performance (from
 * ad_events). LEFT JOIN, not INNER — an organism registered seconds ago with
 * no traffic yet still belongs on the page, at zero, rather than disappearing
 * until it earns a click. That absence is itself honest information.
 */
export async function getSwarmScorecard(days: number): Promise<SwarmScorecardReport> {
  const windowDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365)
  const db = getDatabase()

  const rows = (await db.sql`
    SELECT
      o.org_id                                                              AS org_id,
      o.swarm_id                                                            AS swarm_id,
      o.sku                                                                 AS sku,
      o.channel                                                             AS channel,
      o.headline                                                            AS headline,
      o.body                                                                AS body,
      o.proof_hook                                                          AS proof_hook,
      o.landing_url                                                         AS landing_url,
      o.live_at                                                             AS live_at,
      COALESCE(count(e.*) FILTER (WHERE e.event_type = 'landing'), 0)       AS landings,
      COALESCE(count(e.*) FILTER (WHERE e.event_type = 'purchase'), 0)      AS purchases,
      COALESCE(sum(e.value) FILTER (WHERE e.event_type = 'purchase'), 0)    AS revenue
    FROM swarm_organisms o
    LEFT JOIN ad_events e
      ON e.utm_source = 'swarm' AND e.utm_content = o.org_id
      AND e.created_at >= now() - make_interval(days => ${windowDays}::int)
    WHERE o.live_at >= now() - make_interval(days => ${windowDays}::int)
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9
    ORDER BY o.live_at DESC
    LIMIT 200
  `) as any[]

  const organisms: SwarmScorecardRow[] = rows.map((r) => ({
    orgId: String(r.org_id),
    swarmId: String(r.swarm_id),
    sku: String(r.sku),
    channel: String(r.channel),
    headline: String(r.headline),
    body: String(r.body),
    proofHook: r.proof_hook ? String(r.proof_hook) : null,
    landingUrl: String(r.landing_url),
    liveAt: String(r.live_at),
    landings: n(r.landings),
    purchases: n(r.purchases),
    revenue: n(r.revenue),
  }))

  const landings = organisms.reduce((a, o) => a + o.landings, 0)
  const purchases = organisms.reduce((a, o) => a + o.purchases, 0)
  const revenue = organisms.reduce((a, o) => a + o.revenue, 0)

  return {
    windowDays,
    asOf: new Date().toISOString(),
    totals: { landings, purchases, revenue, conversionRate: rate(purchases, landings) },
    organisms,
  }
}
