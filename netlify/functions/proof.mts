// Netlify Function: /api/proof
//
// Save + read shareable "Live Proof" runs. The demo stream (/api/demo) shows a
// product actually working; this lets a shopper turn a run they just watched
// into a public permalink (/proof/:id) that anyone — or a crawler, or an AI
// answer engine — can see. That makes the store's best feature shareable
// instead of ephemeral: every saved proof is a landing page with a CTA back in.
//
//   POST { sku, scenario?, output } — persist a run, returns { id, url }.
//   GET  ?id=abc123                 — fetch one saved proof (used by the
//                                     /proof/:id edge page).
//   GET                             — list recent proofs (used by the sitemap
//                                     and the /proof index), newest first.
//
// Reachable at /api/proof via the /api/* rewrite in netlify.toml. On any DB
// error it degrades to an empty/failed result rather than throwing.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const SITE = 'https://jblessd.com'
const MAX_OUTPUT = 8000
const MAX_SCENARIO = 600
const LIST_LIMIT = 60

interface ProofRow {
  id: string
  sku: string
  product_name: string
  scenario: string
  output: string
  created_at: string | Date
}

function toProof(r: ProofRow) {
  return {
    id: r.id,
    sku: r.sku,
    productName: r.product_name,
    scenario: r.scenario ?? '',
    output: r.output,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
    url: `${SITE}/proof/${r.id}`,
  }
}

// Short, URL-safe public id. Derived from a UUID so it needs no external state
// and won't collide in practice; the PK still guards against the rare clash.
function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

export default async (req: Request, context: Context) => {
  // ---- GET: read one proof, or list recent ----
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id')?.trim()
    try {
      const db = getDatabase()
      if (id) {
        const [row] = (await db.sql`
          SELECT id, sku, product_name, scenario, output, created_at
          FROM proofs WHERE id = ${id}
        `) as ProofRow[]
        return Response.json(
          { proof: row ? toProof(row) : null },
          { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' } },
        )
      }
      const rows = (await db.sql`
        SELECT id, sku, product_name, scenario, output, created_at
        FROM proofs ORDER BY created_at DESC, id DESC LIMIT ${LIST_LIMIT}
      `) as ProofRow[]
      return Response.json(
        { proofs: (rows ?? []).map(toProof) },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
      )
    } catch (err) {
      console.error('proof GET error:', (err as Error).message)
      return Response.json(id ? { proof: null } : { proofs: [] })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  }

  // Anonymous, unauthenticated write that publishes a crawlable page — cap it
  // per IP so it can't be scripted into a spam firehose. Fail-open (see lib).
  const rl = await checkRateLimit('proof', context.ip, { limit: 12, windowMs: 60 * 60 * 1000 })
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec)

  // ---- POST: save a run ----
  let sku = ''
  let scenario = ''
  let output = ''
  try {
    const body = await req.json()
    sku = String(body?.sku ?? '').trim().slice(0, 32)
    scenario = String(body?.scenario ?? '').trim().slice(0, MAX_SCENARIO)
    output = String(body?.output ?? '').trim().slice(0, MAX_OUTPUT)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!sku) return Response.json({ error: 'A product SKU is required.' }, { status: 400 })
  if (output.length < 20) return Response.json({ error: 'Nothing to save yet — run the demo first.' }, { status: 400 })

  // Validate the SKU against the live catalog and pull the authoritative name,
  // so a saved proof always names a real product.
  const { products } = await loadCatalog()
  const product = products.find((p) => p.sku === sku)
  if (!product) return Response.json({ error: 'No product with that SKU.' }, { status: 404 })

  try {
    const db = getDatabase()
    // Insert with one retry on the (astronomically unlikely) id collision.
    let id = shortId()
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await db.sql`
          INSERT INTO proofs (id, sku, product_name, scenario, output)
          VALUES (${id}, ${sku}, ${product.name}, ${scenario}, ${output})
        `
        break
      } catch (err) {
        if (attempt === 0) {
          id = shortId()
          continue
        }
        throw err
      }
    }
    return Response.json({ id, url: `${SITE}/proof/${id}` }, { status: 201 })
  } catch (err) {
    console.error('proof save error:', (err as Error).message)
    return Response.json({ error: 'Could not save this proof right now.' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/proof',
}
