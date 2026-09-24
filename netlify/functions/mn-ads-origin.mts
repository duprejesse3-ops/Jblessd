// GET /api/ads/origin — public, no secret.
// The MultiNicheADS icon on the store asks this before opening the desk.
// If MN_ADS_ORIGIN is set (the published exchange), the icon goes there.
// Otherwise it stays on /ads, the store-hosted app.

import type { Config, Context } from '@netlify/functions'
import { adsOrigin, json, preflight } from '../lib/mn-ads.mjs'

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  return json({ origin: adsOrigin() })
}

export const config: Config = {
  path: '/api/ads/origin',
}
