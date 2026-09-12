// Netlify Function: GET /api/swarm-performance?days=30
//
// Public, anonymous, rate-limited read of SWARM's real traffic — the
// utm_source='swarm' slice of the store's own first-party ad_events dataset.
// SWARM (a separate app/origin) polls this to replace its simulated
// impressions/clicks/conversions with what its posted organisms actually
// produced. See netlify/lib/swarm-performance.mts for why this one is public
// while /api/ad-performance is owner-only.
//
// Reachable at /api/swarm-performance via the /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { getSwarmPerformance } from '../lib/swarm-performance.mjs'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const NO_STORE = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }

export default async (req: Request, context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  // Anonymous and cross-origin by design (see lib comment), so the ceiling
  // here is abuse-prevention, not access control.
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
  const { allowed, retryAfterSec } = await checkRateLimit('swarm-performance', ip, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!allowed) return tooManyRequests(retryAfterSec)

  const days = Number(new URL(req.url).searchParams.get('days') ?? '30')

  try {
    const report = await getSwarmPerformance(days)
    return Response.json(report, { headers: NO_STORE })
  } catch (err) {
    console.error('swarm-performance error:', (err as Error).message)
    return Response.json(
      { error: 'Could not build the swarm-performance report. The data store may be unavailable.' },
      { status: 502, headers: NO_STORE },
    )
  }
}

export const config: Config = {
  path: '/api/swarm-performance',
}
