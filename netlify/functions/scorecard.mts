// Netlify Function: /api/scorecard
//
// Read-only GET endpoint for a single product's benchmark scorecard, used by
// the /scorecard/:sku edge page (netlify/edge-functions/pages.ts).
//
//   GET ?sku=ABC123 — returns { scorecard } built from the accumulated
//                      benchmark_runs history for that SKU's active scenario,
//                      or { scorecard: null } if no active scenario exists
//                      for it yet.
//
// This is intentionally just a fast DB read. The actual benchmark runs (which
// call /api/demo and can take real time) happen on a weekly schedule in
// scorecard-runner.mts — this endpoint never triggers new runs, it only
// reports on ones already recorded, so a page view stays cheap and fast.
//
// Reachable at /api/scorecard via the /api/* rewrite in netlify.toml.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

const RUN_HISTORY_LIMIT = 20

interface ScenarioRow {
  id: string
  prompt: string
  version: number
}
interface RunRow {
  id: string
  outcome: 'success' | 'partial' | 'failed'
  duration_ms: number | null
  created_at: string | Date
}
interface StatsRow {
  total_runs: number
  success_runs: number
  avg_duration_ms: number | null
  last_run_at: string | Date | null
}

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  const sku = new URL(req.url).searchParams.get('sku')?.trim()
  if (!sku) return Response.json({ scorecard: null }, { status: 400 })

  try {
    const db = getDatabase()

    // The active scenario for this SKU is what defines the scorecard at all —
    // no active scenario means this product isn't benchmarked yet.
    const [scenario] = (await db.sql`
      SELECT id, prompt, version FROM benchmark_scenarios
      WHERE sku = ${sku} AND active = true
      ORDER BY created_at DESC LIMIT 1
    `) as ScenarioRow[]

    if (!scenario) {
      return Response.json(
        { scorecard: null },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
      )
    }

    const [stats] = (await db.sql`
      SELECT
        COUNT(*)::int AS total_runs,
        COUNT(*) FILTER (WHERE outcome = 'success')::int AS success_runs,
        AVG(duration_ms)::int AS avg_duration_ms,
        MAX(created_at) AS last_run_at
      FROM benchmark_runs
      WHERE scenario_id = ${scenario.id}
    `) as StatsRow[]

    const runs = (await db.sql`
      SELECT id, outcome, duration_ms, created_at
      FROM benchmark_runs
      WHERE scenario_id = ${scenario.id}
      ORDER BY created_at DESC
      LIMIT ${RUN_HISTORY_LIMIT}
    `) as RunRow[]

    const totalRuns = stats?.total_runs ?? 0
    const successRuns = stats?.success_runs ?? 0

    const scorecard = {
      sku,
      scenarioPrompt: scenario.prompt,
      methodologyVersion: scenario.version,
      rollingStats: {
        total_runs: totalRuns,
        success_rate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 1000) / 10 : null,
        avg_duration_ms: stats?.avg_duration_ms ?? null,
        last_run_at: stats?.last_run_at ? new Date(stats.last_run_at).toISOString() : null,
      },
      runs: (runs ?? []).map((r) => ({
        id: r.id,
        outcome: r.outcome,
        duration_ms: r.duration_ms,
        created_at: new Date(r.created_at).toISOString(),
      })),
    }

    return Response.json(
      { scorecard },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
    )
  } catch (err) {
    console.error('scorecard GET error:', (err as Error).message)
    return Response.json({ scorecard: null }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/scorecard',
}
