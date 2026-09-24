// Netlify Function: POST /api/swarm-register
//
// Called once by SWARM's goLive() action (swarm/src/lib/store.ts), the
// moment an organism actually ships to X, Reddit, or Google Ads. Writes the
// organism's copy to swarm_organisms so the public scorecard can show real
// headlines next to the real performance /api/swarm-performance already
// aggregates from ad_events. Nothing written here is more sensitive than
// what's about to be public in a tweet or a Reddit post anyway — this
// endpoint just gives multinicheai.com its own first-party copy of it.
//
// Public and rate-limited rather than key-gated, same reasoning as
// /api/track-landing: SWARM runs on a separate, cookie-less origin.
// Upsert on org_id — a re-post (goLive called again to reshare) refreshes
// the row rather than erroring or duplicating.
//
// Reachable at /api/swarm-register via the /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const CHANNELS = new Set(['search', 'conversation', 'proof', 'shadow'])

function clean(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
  const { allowed, retryAfterSec } = await checkRateLimit('swarm-register', ip, {
    limit: 40,
    windowMs: 60_000,
  })
  if (!allowed) return tooManyRequests(retryAfterSec)

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const orgId = clean(body?.orgId, 64)
  const swarmId = clean(body?.swarmId, 64)
  const sku = clean(body?.sku, 32)
  const rawChannel = clean(body?.channel, 20)
  const channel = rawChannel && CHANNELS.has(rawChannel) ? rawChannel : null
  const headline = clean(body?.headline, 300)
  const bodyText = clean(body?.body, 1000)
  const proofHook = clean(body?.proofHook, 500)
  const landingUrl = clean(body?.landingUrl, 1000)

  if (!orgId || !swarmId || !sku || !channel || !headline || !bodyText || !landingUrl) {
    return Response.json({ error: 'Missing required organism fields' }, { status: 400 })
  }

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO swarm_organisms (org_id, swarm_id, sku, channel, headline, body, proof_hook, landing_url)
      VALUES (${orgId}, ${swarmId}, ${sku}, ${channel}, ${headline}, ${bodyText}, ${proofHook}, ${landingUrl})
      ON CONFLICT (org_id) DO UPDATE SET
        headline = EXCLUDED.headline,
        body = EXCLUDED.body,
        proof_hook = EXCLUDED.proof_hook,
        landing_url = EXCLUDED.landing_url,
        live_at = now()
    `
    return Response.json({ registered: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('swarm-register: could not register organism —', (err as Error).message)
    return Response.json({ registered: false }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const config: Config = {
  path: '/api/swarm-register',
}
