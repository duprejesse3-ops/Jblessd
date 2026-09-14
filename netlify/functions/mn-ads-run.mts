// GET/POST /api/ads/run — bind (GET) or live-run (POST) the spec against this page.

import type { Config, Context } from '@netlify/functions'
import {
  adsOrigin,
  houseRun,
  json,
  parseHouseEvent,
  preflight,
  proxiedJson,
  PROXY_RUN_MS,
} from '../lib/mn-ads.mjs'

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const url = new URL(req.url)
    let eventId = url.searchParams.get('e') ?? ''
    if (req.method === 'POST') {
      const text = await req.text()
      try {
        const body = JSON.parse(text) as Record<string, unknown>
        eventId = String(body.e ?? body.eventId ?? eventId)
      } catch {
        /* fall through */
      }
      const replay = new Request(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      })
      if (parseHouseEvent(eventId) || !adsOrigin()) return await houseRun(replay)
      const proxied = await proxiedJson(replay, '/api/ads/run' + url.search, PROXY_RUN_MS)
      if (proxied && proxied.ok) return json(proxied)
      return json({ ok: false, error: 'Run failed' }, 502)
    }
    if (parseHouseEvent(eventId) || !adsOrigin()) return await houseRun(req)
    const proxied = await proxiedJson(req, '/api/ads/run' + url.search, PROXY_RUN_MS)
    if (proxied && proxied.ok) return json(proxied)
    return json({ ok: false, error: 'Run failed' }, 502)
  } catch (err) {
    console.error('mn-ads-run error:', (err as Error).message)
    return json({ ok: false, error: 'Ads unavailable' }, 500)
  }
}

export const config: Config = { path: '/api/ads/run' }
