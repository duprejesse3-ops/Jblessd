// Netlify Function: POST /api/track-landing
//
// The "clicks" half of the store's first-party Google Ads dataset. The browser
// calls this once on landing whenever the URL carries a Google Ads click id
// (gclid / gbraid / wbraid) or utm_* campaign params — i.e. the visit came from
// an ad. It records a single 'landing' row in `ad_events` so the ad-performance
// report can later divide real order revenue by the traffic each campaign,
// keyword, and landing page brought in.
//
// This is deliberately first-party and server-side: unlike the gtag pixel it
// isn't blocked by ad blockers, and the data lives in the owner's own database
// where it can be sliced any way, not just inside the Google Ads UI.
//
// Privacy: only ad-attribution signals are stored — no email, name, IP, or
// address. Every field is length-capped and the endpoint is per-IP rate limited
// so it can't be scripted into a flood. Reachable at /api/track-landing via the
// /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

// Trim to a sane length and collapse empties to null so the columns stay clean.
function clean(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

// Only these click sources are meaningful to Google Ads attribution.
const CLICK_SOURCES = new Set(['gclid', 'gbraid', 'wbraid'])
const DEVICES = new Set(['mobile', 'tablet', 'desktop'])

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  // Cheap abuse ceiling — a real visitor lands a handful of times, not hundreds.
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
  const { allowed, retryAfterSec } = await checkRateLimit('track-landing', ip, {
    limit: 60,
    windowMs: 60_000,
  })
  if (!allowed) return tooManyRequests(retryAfterSec)

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const clickId = clean(body?.clickId)
  const rawSource = clean(body?.clickSource, 20)
  const clickSource = rawSource && CLICK_SOURCES.has(rawSource) ? rawSource : clickId ? 'gclid' : null
  const utmSource = clean(body?.utmSource)
  const utmMedium = clean(body?.utmMedium)
  const utmCampaign = clean(body?.utmCampaign)
  const utmTerm = clean(body?.utmTerm)
  const utmContent = clean(body?.utmContent)
  const landingPath = clean(body?.landingPath, 512)
  const referrerHost = clean(body?.referrerHost, 253)
  const rawDevice = clean(body?.device, 20)
  const device = rawDevice && DEVICES.has(rawDevice) ? rawDevice : null

  // Ignore beacons with no attribution signal at all — nothing to learn from a
  // landing that didn't come from an ad or a tagged link.
  if (!clickId && !utmSource && !utmMedium && !utmCampaign) {
    return Response.json({ recorded: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO ad_events (
        event_type, click_id, click_source,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        landing_path, referrer_host, device
      ) VALUES (
        'landing', ${clickId}, ${clickSource},
        ${utmSource}, ${utmMedium}, ${utmCampaign}, ${utmTerm}, ${utmContent},
        ${landingPath}, ${referrerHost}, ${device}
      )
    `
    return Response.json({ recorded: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    // Analytics must never break the page — swallow and report a soft failure.
    console.error('track-landing: could not record landing —', (err as Error).message)
    return Response.json({ recorded: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export const config: Config = {
  path: '/api/track-landing',
}
