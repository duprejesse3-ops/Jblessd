// GET /api/ads/offer — SpecOffer for agents. Same proxy/house split as serve.

import type { Config, Context } from '@netlify/functions'
import { houseOffer, json, preflight, proxiedJson, PROXY_SERVE_MS } from '../lib/mn-ads.mjs'

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const url = new URL(req.url)
    const proxied = await proxiedJson(req, '/api/ads/offer' + url.search, PROXY_SERVE_MS)
    if (proxied && proxied.fill) return json(proxied)
    return await houseOffer(req)
  } catch (err) {
    console.error('mn-ads-offer error:', (err as Error).message)
    return json({ ok: false, error: 'Ads unavailable' }, 500)
  }
}

export const config: Config = { path: '/api/ads/offer' }
