// A small, dependency-free per-IP rate limiter backed by Netlify Blobs.
//
// The store has two anonymous, unauthenticated write endpoints that publish
// crawlable content on the store's own domain: /api/proof (mints a public
// /proof/:id page, also listed in the sitemap) and /api/reviews (feeds the
// public AggregateRating). Without a limiter either could be scripted to flood
// the site with spam. This gives both a cheap ceiling without introducing auth
// or a database table.
//
// Design notes:
// - State lives in a Blobs store keyed by `${bucket}:${ip}`, holding a count and
//   the window start. A fixed window is plenty for abuse mitigation; we don't
//   need the precision (or cost) of a sliding log.
// - FAIL-OPEN: any Blobs error (store unavailable, cold start, race) allows the
//   request. A rate limiter must never take the feature down — it only sheds
//   obvious abuse. Concurrent requests can slip a few extra through for the same
//   reason; that's an acceptable trade for not serializing on Blobs.

import { getStore } from '@netlify/blobs'

export interface RateLimitOptions {
  limit: number // max requests allowed per window
  windowMs: number // window length in milliseconds
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number // seconds until the window resets (0 when allowed)
}

interface Bucket {
  count: number
  windowStart: number
}

/**
 * Record a hit for (bucket, ip) and report whether it's within the limit.
 * Never throws — on any storage error it returns `allowed: true` (fail-open).
 */
export async function checkRateLimit(
  bucket: string,
  ip: string | undefined,
  { limit, windowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  const id = `${bucket}:${ip || 'unknown'}`
  const now = Date.now()

  try {
    const store = getStore('rate-limits')
    const existing = (await store.get(id, { type: 'json' })) as Bucket | null

    let count: number
    let windowStart: number
    if (!existing || now - existing.windowStart >= windowMs) {
      // Fresh window.
      count = 1
      windowStart = now
    } else {
      count = existing.count + 1
      windowStart = existing.windowStart
    }

    await store.setJSON(id, { count, windowStart } satisfies Bucket)

    const allowed = count <= limit
    const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000))
    return { allowed, remaining: Math.max(0, limit - count), retryAfterSec }
  } catch (err) {
    console.error(`rate-limit: storage error for ${bucket}, allowing —`, (err as Error).message)
    return { allowed: true, remaining: limit, retryAfterSec: 0 }
  }
}

/** A ready-made 429 Response with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number, message = 'Too many requests. Please slow down and try again shortly.'): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec), 'Cache-Control': 'no-store' } },
  )
}
