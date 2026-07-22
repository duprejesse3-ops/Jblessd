// Netlify Function: GET /api/ad-performance?days=30
//
// The owner-facing read side of the first-party Google Ads dataset. Returns the
// aggregated ad-performance report — traffic, conversions, revenue, conversion
// rate and AOV, broken down by campaign, source, and landing page — computed
// from the store's own ad_events table (not Google's UI). This is the data used
// to decide where to push or pull ad spend.
//
// Owner-only: gated behind the same admin session cookie as the /admin
// workstation. There is no anonymous access to operational store data.
// Reachable at /api/ad-performance via the /api/* rewrite in netlify.toml.

import type { Config } from '@netlify/functions'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { getAdPerformance } from '../lib/ad-performance.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }
  if (!isConfigured()) {
    return Response.json({ error: 'Admin is not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
  }
  if (!isAuthed(req, Date.now())) {
    return Response.json({ error: 'Not authorized. Sign in at /admin first.' }, { status: 401, headers: NO_STORE })
  }

  const days = Number(new URL(req.url).searchParams.get('days') ?? '30')

  try {
    const report = await getAdPerformance(days)
    return Response.json(report, { headers: NO_STORE })
  } catch (err) {
    console.error('ad-performance error:', (err as Error).message)
    return Response.json(
      { error: 'Could not build the ad-performance report. The data store may be unavailable.' },
      { status: 502, headers: NO_STORE },
    )
  }
}

export const config: Config = {
  path: '/api/ad-performance',
}
