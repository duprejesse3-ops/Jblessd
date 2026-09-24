// Netlify Function: /api/admin-run-scorecard
//
// Runs ONE product's benchmark scenario right now, through the exact same
// path scorecard-runner-background.mts uses on its weekly schedule (calls
// /api/demo like a shopper's browser would, records success or failure to
// benchmark_runs) — so a fresh scorecard doesn't mean waiting for Sunday.
// Useful right after fixing something about a product, or before pointing
// traffic at a specific /scorecard/:sku page and wanting it current first.
//
// Owner-only, same gate as the rest of the admin workstation (admin-console,
// admin-clear-demo-cache). GET is bookmarkable — visit the URL while logged
// into /admin and it runs that SKU, returning a plain HTML result page once
// the run finishes (a real run takes ~15-25s, so this deliberately waits for
// it rather than firing-and-forgetting, unlike the weekly background sweep).
//
//   GET  /api/admin-run-scorecard?sku=AI-PP-032
//   POST { sku: string } — same effect, JSON in/out, for scripting.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { runOne, type ScenarioRow } from './scorecard-runner-background.mts'

const NO_STORE = { 'Cache-Control': 'no-store' }

export default async (req: Request) => {
  if (!isConfigured()) {
    return Response.json({ error: 'Admin tools are not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
  }
  if (!isAuthed(req, Date.now())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  let sku: string
  if (req.method === 'GET') {
    sku = (new URL(req.url).searchParams.get('sku') ?? '').trim()
  } else if (req.method === 'POST') {
    let body: { sku?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: NO_STORE })
    }
    sku = typeof body.sku === 'string' ? body.sku.trim() : ''
  } else {
    return new Response('Method not allowed', { status: 405, headers: { ...NO_STORE, Allow: 'GET, POST' } })
  }

  if (!sku) {
    return respond(req.method, 400, { error: 'Missing required field: sku' }, 'Missing required field: sku')
  }

  const db = getDatabase()
  const [scenario] = (await db.sql`
    SELECT id, sku, prompt FROM benchmark_scenarios WHERE sku = ${sku} AND active = true
  `) as ScenarioRow[]

  if (!scenario) {
    // Matches scorecard.mts's own "no active scenario" case — same reason a
    // SKU could 404 on /scorecard/:sku (see scenario-generator.mts and the
    // repair migration this system already has for that failure mode).
    const message = `${sku} has no active benchmark scenario — nothing to run. If this SKU should have one, check scorecard-diag.`
    return respond(req.method, 404, { error: message }, message)
  }

  const { products } = await loadCatalog()
  const productExists = products.some((p) => p.sku === sku)
  const origin = new URL(req.url).origin

  const before = Date.now()
  await runOne(db, origin, scenario, productExists)
  const durationMs = Date.now() - before

  // runOne records the outcome itself and never throws — read back what it
  // just wrote so the response can honestly report success vs. failure
  // rather than just confirming the attempt happened.
  const [latest] = (await db.sql`
    SELECT outcome, duration_ms FROM benchmark_runs
    WHERE scenario_id = ${scenario.id} ORDER BY created_at DESC LIMIT 1
  `) as { outcome: string; duration_ms: number }[]

  if (!latest) {
    // runOne's own too-fast-to-be-real guard skipped recording entirely
    // (see INFRA_FAILURE_MS in scorecard-runner-background.mts) — genuinely
    // not an error on the caller's part, just nothing to show yet.
    const message = `Ran ${sku} in ${durationMs}ms, but it looked like infra pressure rather than a real attempt (too fast) and was not recorded. Try again in a moment.`
    return respond(req.method, 200, { sku, recorded: false }, message)
  }

  const message =
    latest.outcome === 'success'
      ? `${sku} ran successfully in ${latest.duration_ms}ms. Live at /scorecard/${encodeURIComponent(sku)}`
      : `${sku} ran and failed in ${latest.duration_ms}ms — recorded as a real failure on the public scorecard, same as any other run. Live at /scorecard/${encodeURIComponent(sku)}`
  return respond(req.method, 200, { sku, recorded: true, outcome: latest.outcome, durationMs: latest.duration_ms }, message)
}

function respond(method: string, status: number, json: Record<string, unknown>, message: string): Response {
  if (method === 'GET') {
    return new Response(htmlPage(message, status < 400), { status, headers: { ...NO_STORE, 'Content-Type': 'text/html' } })
  }
  return Response.json(json, { status, headers: NO_STORE })
}

function htmlPage(message: string, ok: boolean): string {
  const color = ok ? '#22C55E' : '#FF4D4D'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Run scorecard</title>
<style>body{background:#0A0E16;color:#EEF1F7;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
p{max-width:480px;border-left:3px solid ${color};padding-left:16px;text-align:left}</style>
</head><body><p>${escapeHtml(message)}</p></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export const config: Config = {
  path: '/api/admin-run-scorecard',
}
