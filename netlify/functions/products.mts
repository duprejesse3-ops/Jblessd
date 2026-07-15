// Netlify Function: /api/products
//   GET  — returns the live catalog (from Netlify Database, with a bundled
//          fallback so the storefront always renders).
//   POST — lists a new product. Persists it to the database so user-listed
//          products survive reloads and are visible to the AI concierge.
//
// Reachable at /api/products via the /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const SKU_PREFIX: Record<Product['category'], string> = {
  prompts: 'PP',
  automations: 'AB',
  templates: 'TP',
  agents: 'AG',
}

function decorate(p: Product) {
  return {
    ...p,
    catLabel: CATEGORY_LABEL[p.category] ?? p.category,
    nicheLabel: NICHE_LABEL[p.niche] ?? p.niche,
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'GET') {
    const { products, source } = await loadCatalog()
    return Response.json(
      { products: products.map(decorate), source },
      { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate' } },
    )
  }

  if (req.method === 'POST') {
    let body: Partial<Product>
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const name = String(body.name ?? '').trim().slice(0, 120)
    const price = Number(body.price)
    const category = (body.category ?? 'prompts') as Product['category']
    const niche = (body.niche ?? 'founders') as Product['niche']

    if (!name) return Response.json({ error: 'A product name is required' }, { status: 400 })
    if (!Number.isFinite(price) || price <= 0 || price > 100000) {
      return Response.json({ error: 'A valid price is required' }, { status: 400 })
    }
    if (!(category in SKU_PREFIX)) return Response.json({ error: 'Unknown category' }, { status: 400 })
    if (!(niche in NICHE_LABEL)) return Response.json({ error: 'Unknown niche' }, { status: 400 })

    const record = {
      name,
      category,
      niche,
      price,
      format: String(body.format ?? '').trim().slice(0, 120) || 'Digital download',
      blurb: String(body.blurb ?? '').trim().slice(0, 400) || 'No description yet.',
      spec: String(body.spec ?? '').trim().slice(0, 200) || '—',
    }

    try {
      const db = getDatabase()
      // Derive a unique SKU from the category prefix and the current max number.
      const [{ next }] = (await db.sql`
        SELECT COALESCE(MAX(NULLIF(regexp_replace(sku, '\\D', '', 'g'), '')::int), 0) + 1 AS next
        FROM products
      `) as Array<{ next: number }>
      const sku = `AI-${SKU_PREFIX[category]}-${String(next).padStart(3, '0')}`

      const [row] = (await db.sql`
        INSERT INTO products (sku, name, category, niche, format, price, blurb, spec)
        VALUES (${sku}, ${record.name}, ${record.category}, ${record.niche}, ${record.format}, ${record.price}, ${record.blurb}, ${record.spec})
        RETURNING sku, name, category, niche, format, price, blurb, spec
      `) as Array<any>

      return Response.json(
        { product: decorate({ ...(row as Product), price: Number(row.price) }) },
        { status: 201 },
      )
    } catch (err) {
      console.error('Create product error:', (err as Error).message)
      return Response.json(
        { error: 'Could not save the product right now. Please try again.' },
        { status: 503 },
      )
    }
  }

  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
}

export const config: Config = {
  path: '/api/products',
}
