// Netlify Function: /api/admin-clear-demo-cache
//
// Clears ONE product's cached "Live Proof" demo (see /api/demo) so the next
// shopper who views it gets a freshly-generated run instead of a stale cached
// one — without touching every other product's cache the way bumping
// CACHE_VERSION in demo.mts would.
//
// Why this needed to exist: demo.mts caches the default (no-scenario) demo
// in Netlify Blobs, keyed only by `${CACHE_VERSION}/${sku}` — there is no
// content hash and no expiry, so updating a product's blurb/price/name does
// NOT invalidate its cached demo. A product can go on being demoed with
// outdated copy indefinitely after a real update, until someone clears it.
//
// Owner-only, same gate as the rest of the admin workstation (admin-console,
// product-builder): a valid admin session cookie is required. This is a
// mutation (deletes a cache entry), so — unlike admin-console, which is
// strictly read-only by design — it lives in its own endpoint rather than
// being added as a tool the console's model could call.
//
//   GET  /api/admin-clear-demo-cache?sku=AI-CN-008 — bookmarkable: visit the
//        URL while logged into /admin and it clears that SKU's cache,
//        returning a plain HTML confirmation page.
//   POST { sku: string } — same effect, JSON in/out, for scripting.

import type { Config } from '@netlify/functions'
import { getStore } from '@netlify/blobs'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const CACHE_VERSION = 'v1' // must match demo.mts's own constant — see that file if you ever bump it

export default async (req: Request) => {
  if (!isConfigured()) {
    return Response.json({ error: 'Admin tools are not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
  }
  if (!isAuthed(req, Date.now())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  let sku: string
  if (req.method === 'GET') {
    // Convenience path: visiting a URL (e.g. a bookmark) is much easier than
    // opening dev tools to run a fetch() call — this is what makes that
    // possible. Safe to expose as a plain GET despite mutating a cache entry
    // because it's owner-only (same cookie gate as everything else here),
    // idempotent (clearing an already-clear entry is a no-op), and low-stakes
    // (worst case, one product's demo regenerates once more than needed).
    sku = (new URL(req.url).searchParams.get('sku') ?? '').trim()
  } else if (req.method === 'POST') {
    let body: { sku?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: NO_STORE })
    }
    sku = typeof body.sku === 'string' ? body.sku.trim() : ''
  } else {
    return new Response('Method not allowed', { status: 405, headers: { ...NO_STORE, Allow: 'GET, POST' } })
  }

  if (!sku) {
    const message = 'Missing required field: sku'
    return req.method === 'GET'
      ? new Response(htmlPage(message, false), { status: 400, headers: { ...NO_STORE, 'Content-Type': 'text/html' } })
      : Response.json({ error: message }, { status: 400, headers: NO_STORE })
  }

  const cacheKey = `${CACHE_VERSION}/${sku}`
  try {
    const store = getStore('product-demos')
    // Confirm there was actually something to clear, so the response is
    // honest about whether this did anything — a SKU with no cached demo
    // yet isn't an error, but it's worth telling the caller.
    const existed = (await store.get(cacheKey, { type: 'text' })) !== null
    await store.delete(cacheKey)
    if (req.method === 'GET') {
      const message = existed
        ? `Cleared the cached demo for ${sku}. The next shopper to view its product page will trigger a fresh one.`
        : `${sku} had no cached demo to clear (nothing to do — it'll generate fresh on next view anyway).`
      return new Response(htmlPage(message, true), { headers: { ...NO_STORE, 'Content-Type': 'text/html' } })
    }
    return Response.json({ sku, cacheKey, cleared: existed }, { headers: NO_STORE })
  } catch (err) {
    const message = `Blob store error: ${(err as Error).message}`
    return req.method === 'GET'
      ? new Response(htmlPage(message, false), { status: 502, headers: { ...NO_STORE, 'Content-Type': 'text/html' } })
      : Response.json({ error: message }, { status: 502, headers: NO_STORE })
  }
}

function htmlPage(message: string, ok: boolean): string {
  const color = ok ? '#22C55E' : '#FF4D4D'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Demo cache</title>
<style>body{background:#0A0E16;color:#EEF1F7;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
p{max-width:480px;border-left:3px solid ${color};padding-left:16px;text-align:left}</style>
</head><body><p>${escapeHtml(message)}</p></body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export const config: Config = {
  path: '/api/admin-clear-demo-cache',
}
