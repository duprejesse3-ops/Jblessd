// Netlify Function: GET /api/download?session_id=cs_...&sku=AI-AG-065
//
// Serves the .zip for a purchased source-code product. This is the "install it"
// half of delivery: /api/order hands back the readable document, and this hands
// back a directory of real files the buyer can unzip and run.
//
// Security: the archive is only ever built for a session Stripe confirms is
// paid *and* which actually contains the requested SKU. Owning one product does
// not unlock another, and an unpaid, unknown, or tampered session id gets a 404
// with no content. That mirrors /api/order, which is the existing precedent for
// handing over paid goods, so there is one authorisation model rather than two.
//
// Cost: enrichment is explicitly off. The AI upgrade pass is irrelevant here —
// the archive is the checked-in source, not generated prose — and skipping it
// keeps a download from ever triggering inference. The zip itself is built in
// memory from an already-bundled module, so the whole request is one Stripe
// lookup plus a few milliseconds of DEFLATE.
//
// Reachable at /api/download via the /api/* rewrite in netlify.toml.

import Stripe from 'stripe'
import type { Config, Context } from '@netlify/functions'
import { fulfilOrder } from '../lib/fulfillment.mjs'
import { buildProductArchive, hasArchive } from '../lib/product-archive.mjs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Checkout is not configured.' }, { status: 500 })
  }

  const params = new URL(req.url).searchParams
  const sessionId = params.get('session_id')
  const sku = (params.get('sku') ?? '').trim().toUpperCase()

  // Reject anything that cannot be a Stripe Checkout session id before spending
  // an API call on it.
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 })
  }
  if (!/^[A-Z]{2}-[A-Z]{2}-\d{3}$/.test(sku)) {
    return Response.json({ error: 'Invalid sku' }, { status: 400 })
  }
  // Cheap rejection for a SKU that has no archive, before touching Stripe.
  if (!hasArchive(sku)) {
    return Response.json({ error: 'That product has no downloadable archive.' }, { status: 404 })
  }

  try {
    const { paid, items } = await fulfilOrder(stripe, sessionId, { enrich: false })
    if (!paid || !items.some((item) => item.product.sku === sku)) {
      // One response for "not paid" and "paid but you don't own this", so the
      // endpoint cannot be used to probe which SKUs an order contains.
      return Response.json({ error: 'No such download for this order.' }, { status: 404 })
    }

    const archive = buildProductArchive(sku)
    if (!archive) {
      return Response.json({ error: 'That product has no downloadable archive.' }, { status: 404 })
    }

    return new Response(new Uint8Array(archive.bytes), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archive.filename}"`,
        'Content-Length': String(archive.bytes.length),
        // Tied to one buyer's session id, so it must never be cached by the CDN
        // or a shared proxy.
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('download error:', (err as Error).message)
    return Response.json({ error: 'Unable to prepare your download right now.' }, { status: 400 })
  }
}

export const config: Config = {
  path: '/api/download',
}
