// GET /api/ads/click — 302 through to the product (house) or the exchange dest.

import type { Config, Context } from '@netlify/functions'
import {
  adsOrigin,
  houseClick,
  parseHouseEvent,
  proxyToOrigin,
  requestOrigin,
  PROXY_SERVE_MS,
} from '../lib/mn-ads.mjs'

export default async (req: Request, _context: Context) => {
  const home = () =>
    new Response(null, {
      status: 302,
      headers: {
        Location: requestOrigin(req) + '/',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    })
  if (req.method !== 'GET') return home()
  try {
    const url = new URL(req.url)
    const eventId = url.searchParams.get('e') ?? ''
    if (parseHouseEvent(eventId) || !adsOrigin()) return await houseClick(req)
    const res = await proxyToOrigin(req, '/api/ads/click' + url.search, PROXY_SERVE_MS)
    const location = res?.headers.get('Location')
    if (location) {
      return new Response(null, {
        status: 302,
        headers: { Location: location, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      })
    }
    return home()
  } catch (err) {
    console.error('mn-ads-click error:', (err as Error).message)
    return home()
  }
}

export const config: Config = { path: '/api/ads/click' }
