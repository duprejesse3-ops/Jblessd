// Netlify Function: GET /api/admin-download?sku=AI-HOST-001
//
// The owner's own copy of download.mts, minus Stripe. /api/download exists to
// prove a REAL buyer paid for ONE specific product before handing over the
// archive — exactly the check that makes "download it myself to verify it"
// painful, since it means either a real charge or wiring up Stripe test-mode
// cards and webhooks just to see a zip.
//
// The owner doesn't need that proof — they own the whole catalog by
// definition. This swaps Stripe's paid-session check for the same admin
// session cookie /admin already uses, and calls the identical
// buildProductArchive() the real flow uses, so what you download here is
// byte-for-byte what a paying customer gets — no separate "test build".
//
// Reachable at /api/admin-download via the /api/* rewrite in netlify.toml.

import type { Config } from '@netlify/functions'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { buildProductArchive, hasArchive } from '../lib/product-archive.mjs'

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

  const sku = (new URL(req.url).searchParams.get('sku') ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}-[A-Z]{2,4}-\d{3}$/.test(sku)) {
    return Response.json({ error: 'Invalid sku' }, { status: 400, headers: NO_STORE })
  }
  if (!hasArchive(sku)) {
    return Response.json({ error: 'That product has no downloadable archive.' }, { status: 404, headers: NO_STORE })
  }

  try {
    const archive = buildProductArchive(sku)
    if (!archive) {
      return Response.json({ error: 'That product has no downloadable archive.' }, { status: 404, headers: NO_STORE })
    }
    return new Response(new Uint8Array(archive.bytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archive.filename}"`,
        'Content-Length': String(archive.bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('admin-download error:', (err as Error).message)
    return Response.json({ error: 'Unable to build that archive right now.' }, { status: 400, headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/admin-download',
}
