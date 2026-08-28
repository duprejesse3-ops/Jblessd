// Scheduled function: benchmark scorecard runner.
//
// Re-runs each product's fixed, versioned benchmark scenario and appends the
// result to benchmark_runs. Results — including failures — accumulate into
// the public scorecard at /scorecard/:sku and /api/scorecard. This is what
// turns "Live Proof" (a one-off demo a shopper triggers) into a benchmark
// (a comparable, dated record over time).
//
// Picks the LEAST RECENTLY RUN products each call (never-run products first),
// not just the alphabetically-first ones — otherwise every run just re-scores
// the same early-sorting SKUs and the rest of the catalog never gets covered.
//
// Calls /api/demo the same way a shopper's browser does (POST + read the
// ndjson stream) rather than duplicating its prompt/streaming logic — so a
// benchmark run is always exactly what a shopper would see, never a
// second, unverified code path that can drift from the real one.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'

const ENABLED = process.env.SCORECARD_ENABLED !== 'false'
const BATCH_SIZE = Number(process.env.SCORECARD_BATCH_SIZE || 10)
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

export default async (req: Request) => {
  if (!ENABLED) {
    console.log('[scorecard-runner] disabled (SCORECARD_ENABLED=false)')
    return Response.json({ ran: 0, skipped: 'disabled' })
  }

  const db = getDatabase()
  // Least-recently-run first (never-run products surface via NULLS FIRST),
  // so repeated manual or scheduled calls sweep across the whole catalog
  // instead of re-scoring whatever sorts first alphabetically.
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
    return Response.json({ ran: 0 })
  }

  const { products } = await loadCatalog()
  const origin = new URL(req.url).origin
  let ran = 0

  for (const s of scenarios) {
    const product = products.find((p) => p.sku === s.sku)
    if (!product) {
      console.error(`[scorecard-runner] scenario ${s.id} references unknown sku ${s.sku} — skipping`)
      continue
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
