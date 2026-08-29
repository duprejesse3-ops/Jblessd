// Scheduled function: benchmark scorecard runner.
//
// Re-runs each product's FIXED, versioned benchmark scenario on a weekly
// cadence and appends the result to benchmark_runs. Results — including
// failures — accumulate into the public scorecard at /scorecard/:sku and
// /api/scorecard. This is what turns "Live Proof" (a one-off demo a shopper
// triggers) into a benchmark (a comparable, dated record over time).
//
// Calls /api/demo the same way a shopper's browser does (POST + read the
// ndjson stream) rather than duplicating its prompt/streaming logic — so a
// benchmark run is always exactly what a shopper would see, never a
// second, unverified code path that can drift from the real one.
//
// A product only gets scored once a benchmark_scenarios row exists for it —
// seeding those is a manual/admin step for phase 1.
//
// Picks the LEAST RECENTLY RUN products each call (never-run products first),
// not just alphabetically-first ones — otherwise every run just re-scores
// the same early-sorting SKUs and the rest of the catalog never gets covered.
//
// This is a Background Function (the -background suffix in the filename is
// what tells Netlify to treat it as one) rather than a regular one. A regular
// function is capped at roughly 10-26 seconds, and each scenario run here
// takes ~15-25s on its own — so a regular function could only ever finish
// 1-2 scenarios per invocation before being killed mid-batch, no matter how
// high BATCH_SIZE was set. A Background Function gets up to 15 minutes,
// which is what actually lets one call sweep a full batch (or the whole
// catalog) in one go. Scenarios also run with limited concurrency rather
// than strictly one-at-a-time, so a full catalog sweep fits comfortably
// inside that 15-minute budget instead of taking as long as BATCH_SIZE ×
// ~20s would sequentially.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'

const ENABLED = process.env.SCORECARD_ENABLED !== 'false'
// Default raised well above a typical catalog size so one call can, in
// practice, cover everything outstanding rather than needing repeated manual
// triggers. Still overridable via SCORECARD_BATCH_SIZE if the catalog grows
// past what fits in the 15-minute background budget at the concurrency below.
const BATCH_SIZE = Number(process.env.SCORECARD_BATCH_SIZE || 200)
// How many scenarios run at once. Keeps this well under any per-function
// outbound-connection ceiling while still cutting wall-clock time by roughly
// this factor versus running one at a time.
const CONCURRENCY = Number(process.env.SCORECARD_CONCURRENCY || 5)
const MIN_OUTPUT_LENGTH = 20 // mirrors /api/proof's own "nothing to save yet" floor

interface ScenarioRow {
  id: string
  sku: string
  prompt: string
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

// Runs the fixed scenario through /api/demo exactly as a shopper's browser
// would, and collects the full streamed text.
async function runScenario(origin: string, sku: string, prompt: string): Promise<{ text: string; outcome: 'success' | 'failed' }> {
  const res = await fetch(`${origin}/api/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku, scenario: prompt }),
  })
  if (!res.ok || !res.body) return { text: '', outcome: 'failed' }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const ev = JSON.parse(trimmed)
        if (ev.type === 'text') text += ev.text
      } catch {
        // malformed line — skip it, don't fail the whole run over one bad chunk
      }
    }
  }

  return { text, outcome: text.trim().length >= MIN_OUTPUT_LENGTH ? 'success' : 'failed' }
}

async function runOne(
  db: ReturnType<typeof getDatabase>,
  origin: string,
  s: ScenarioRow,
  productExists: boolean,
): Promise<void> {
  if (!productExists) {
    console.error(`[scorecard-runner] scenario ${s.id} references unknown sku ${s.sku} — skipping`)
    return
  }

  const start = Date.now()
  try {
    const result = await runScenario(origin, s.sku, s.prompt)
    const durationMs = Date.now() - start

    await db.sql`
      INSERT INTO benchmark_runs (id, scenario_id, sku, output, duration_ms, outcome)
      VALUES (${shortId()}, ${s.id}, ${s.sku}, ${result.text || '(no output)'}, ${durationMs}, ${result.outcome})
    `
    console.log(`[scorecard-runner] ${s.sku}: ${result.outcome} in ${durationMs}ms`)
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

// Simple fixed-concurrency pool: keeps up to CONCURRENCY scenarios in flight
// rather than either fully sequential (too slow to fit a full catalog in the
// 15-minute budget) or fully parallel (needlessly bursty against /api/demo).
async function runWithConcurrency(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let next = 0
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++
      await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
}

export default async (req: Request) => {
  if (!ENABLED) {
    console.log('[scorecard-runner] disabled (SCORECARD_ENABLED=false)')
    return
  }

  const db = getDatabase()
  // Least-recently-run first (never-run products surface via NULLS FIRST),
  // so repeated manual or scheduled calls sweep across the whole catalog
  // instead of re-scoring whatever sorts first alphabetically every time.
  const scenarios = (await db.sql`
    SELECT s.id, s.sku, s.prompt
    FROM benchmark_scenarios s
    WHERE s.active = true
    ORDER BY (
      SELECT MAX(r.created_at) FROM benchmark_runs r WHERE r.scenario_id = s.id
    ) ASC NULLS FIRST
    LIMIT ${BATCH_SIZE}
  `) as ScenarioRow[]

  if (!scenarios.length) {
    console.log('[scorecard-runner] no active benchmark scenarios — nothing to run')
    return
  }

  const { products } = await loadCatalog()
  const origin = new URL(req.url).origin
  const productSkus = new Set(products.map((p) => p.sku))

  console.log(`[scorecard-runner] running ${scenarios.length} scenario(s) at concurrency ${CONCURRENCY}`)

  await runWithConcurrency(
    scenarios.map((s) => () => runOne(db, origin, s, productSkus.has(s.sku))),
    CONCURRENCY,
  )

  console.log(`[scorecard-runner] batch complete — ${scenarios.length} scenario(s) attempted`)
}

export const config: Config = {
  // Weekly, off-peak Sunday — separate from multiads-scheduler's daily 13:00
  // slot so the two never contend for the same cold-start window.
  schedule: '0 11 * * 0',
}
