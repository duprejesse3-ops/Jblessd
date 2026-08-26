// Netlify Function: /api/scorecard
//
// Public read API for benchmark scorecards. Each product with an active
// benchmark_scenario gets a rolling record of runs on a FIXED, versioned
// prompt — so results are comparable week over week instead of drifting.
//
//   GET ?sku=AI-AG-003   — one product's scorecard: scenario + rolling stats
//                          + recent run history (including failures).
//   GET                  — summary list across all benchmarked products, for
//                          the /proof index table.
//
// Runs are written only by scorecard-runner.mts (the scheduled job). This
// endpoint is read-only.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

interface ScenarioRow {
  id: string
  sku: string
  prompt: string
  version: number
}
interface RunRow {
  id: string
  outcome: 'success' | 'partial' | 'failed'
  self_rated_quality: number | null
  duration_ms: number | null
  created_at: string
}

function rollingStats(runs: RunRow[]) {
  const total = runs.length
  const successes = runs.filter((r) => r.outcome === 'success').length
  const avgDuration = total
    ? Math.round(runs.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / total)
    : null
  return {
    total_runs: total,
    success_rate: total ? Math.round((successes / total) * 100) : null,
    avg_duration_ms: avgDuration,
    last_run_at: runs[0]?.created_at ?? null,
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  const sku = new URL(req.url).searchParams.get('sku')?.trim()

  try {
    const db = getDatabase()

    if (sku) {
      const [scenario] = (await db.sql`
        SELECT id, sku, prompt, version FROM benchmark_scenarios
        WHERE sku = ${sku} AND active = true ORDER BY version DESC LIMIT 1
      `) as ScenarioRow[]
      if (!scenario) {
        return Response.json({ scorecard: null }, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
        })
      }
      const runs = (await db.sql`
        SELECT id, outcome, self_rated_quality, duration_ms, created_at
        FROM benchmark_runs WHERE scenario_id = ${scenario.id}
        ORDER BY created_at DESC LIMIT 30
      `) as RunRow[]
      return Response.json(
        {
          scorecard: {
            sku: scenario.sku,
            scenarioPrompt: scenario.prompt,
            methodologyVersion: scenario.version,
            rollingStats: rollingStats(runs),
            runs,
          },
        },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
      )
    }

    // Summary list: latest scenario per SKU + its rolling stats.
    const scenarios = (await db.sql`
      SELECT id, sku, prompt, version FROM benchmark_scenarios WHERE active = true
    `) as ScenarioRow[]
    const summaries = await Promise.all(
      scenarios.map(async (s) => {
        const runs = (await db.sql`
          SELECT id, outcome, self_rated_quality, duration_ms, created_at
          FROM benchmark_runs WHERE scenario_id = ${s.id}
          ORDER BY created_at DESC LIMIT 30
        `) as RunRow[]
        return { sku: s.sku, methodologyVersion: s.version, rollingStats: rollingStats(runs) }
      }),
    )
    return Response.json(
      { scorecards: summaries },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
    )
  } catch (err) {
    console.error('scorecard GET error:', (err as Error).message)
    return Response.json(sku ? { scorecard: null } : { scorecards: [] })
  }
}

export const config: Config = {
  path: '/api/scorecard',
}
