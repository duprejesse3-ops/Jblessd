// Netlify Function: GET /api/swarm-scorecard?days=30
//
// Public, anonymous, rate-limited. Real organisms (from swarm_organisms,
// written by /api/swarm-register the moment SWARM ships one) joined against
// their real performance (from ad_events, via /api/swarm-performance's same
// dataset). This is the one meant for a public page — swarm-performance
// alone is bare ids with no copy attached, useful to SWARM itself but not to
// a stranger deciding whether to trust it.
//
// Reachable at /api/swarm-scorecard via the /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { getSwarmScorecard } from '../lib/swarm-performance.mjs'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const NO_STORE = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }

export default async (req: Request, context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
  const { allowed, retryAfterSec } = await checkRateLimit('swarm-scorecard', ip, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!allowed) return tooManyRequests(retryAfterSec)

  const days = Number(new URL(req.url).searchParams.get('days') ?? '30')

  try {
    const report = await getSwarmScorecard(days)
    return Response.json(report, { headers: NO_STORE })
  } catch (err) {
    console.error('swarm-scorecard error:', (err as Error).message)
    return Response.json(
      { error: 'Could not build the swarm scorecard. The data store may be unavailable.' },
      { status: 502, headers: NO_STORE },
    )
  }
}

export const config: Config = {
  path: '/api/swarm-scorecard',
}
