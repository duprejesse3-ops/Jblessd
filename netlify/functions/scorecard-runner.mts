// Scheduled function: benchmark scorecard runner.
//
// Re-runs each product's FIXED, versioned benchmark scenario on a weekly
// cadence and appends the result to benchmark_runs. Results — including
// failures — accumulate into the public scorecard at /scorecard/:sku and
// /api/scorecard. This is what turns "Live Proof" (a one-off demo a shopper
// triggers) into a benchmark (a comparable, dated record over time).
//
// A product only gets scored once a benchmark_scenarios row exists for it —
// seeding those is a manual/admin step for phase 1, not automatic, so a
// fixed scenario is deliberately chosen rather than auto-generated.
//
// Reuses the same run engine as /api/demo (via runProductDemo), so a
// benchmark run is executed exactly the way a shopper's live demo is —
// no separate, unverified code path.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { runProductDemo } from './demo.mts'
import { loadCatalog } from '../lib/db.mjs'

const ENABLED = process.env.SCORECARD_ENABLED !== 'false'
const BATCH_SIZE = Number(process.env.SCORECARD_BATCH_SIZE || 10)

interface ScenarioRow {
  id: string
  sku: string
  prompt: string
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export default async (req: Request) => {
  if (!ENABLED) {
    console.log('[scorecard-runner] disabled (SCORECARD_ENABLED=false)')
    return Response.json({ ran: 0, skipped: 'disabled' })
  }

  const db = getDatabase()
  const scenarios = (await db.sql`
    SELECT id, sku, prompt FROM benchmark_scenarios
    WHERE active = true ORDER BY sku LIMIT ${BATCH_SIZE}
  `) as ScenarioRow[]

  if (!scenarios.length) {
    console.log('[scorecard-runner] no active benchmark scenarios — nothing to run')
    return Response.json({ ran: 0 })
  }

  const { products } = await loadCatalog()
  let ran = 0

  for (const s of scenarios) {
    const product = products.find((p) => p.sku === s.sku)
    if (!product) {
      console.error(`[scorecard-runner] scenario ${s.id} references unknown sku ${s.sku} — skipping`)
      continue
    }

    const start = Date.now()
    try {
      // Same engine /api/demo uses for a shopper's live run — see demo.mts.
      const result = await runProductDemo({ sku: s.sku, scenario: s.prompt })
      const durationMs = Date.now() - start
      const outcome = result.text && result.text.length >= 20 ? 'success' : 'failed'

      await db.sql`
        INSERT INTO benchmark_runs (id, scenario_id, sku, output, duration_ms, outcome, self_rated_quality)
        VALUES (${shortId()}, ${s.id}, ${s.sku}, ${result.text ?? ''}, ${durationMs}, ${outcome}, ${result.selfRatedQuality ?? null})
      `
      console.log(`[scorecard-runner] ${s.sku}: ${outcome} in ${durationMs}ms`)
      ran++
    } catch (err) {
      const durationMs = Date.now() - start
      console.error(`[scorecard-runner] ${s.sku} failed:`, (err as Error).message)
      // A run that errors is itself a data point — a benchmark that hides its
      // own failures isn't credible. Recorded as 'failed', not skipped.
      try {
        await db.sql`
          INSERT INTO benchmark_runs (id, scenario_id, sku, output, duration_ms, outcome)
          VALUES (${shortId()}, ${s.id}, ${s.sku}, ${'Run failed: ' + (err as Error).message}, ${durationMs}, 'failed')
        `
      } catch (writeErr) {
        console.error(`[scorecard-runner] could not even record the failure for ${s.sku}:`, (writeErr as Error).message)
      }
    }
  }

  return Response.json({ ran, attempted: scenarios.length })
}

export const config: Config = {
  // Weekly, off-peak Sunday — separate from multiads-scheduler's daily 13:00
  // slot so the two never contend for the same cold-start window.
  schedule: '0 11 * * 0',
}
