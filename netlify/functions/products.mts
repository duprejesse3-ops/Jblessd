// Netlify Function: /api/products
//   GET   — returns the live catalog (from Netlify Database, with a bundled
//           fallback so the storefront always renders).
//   POST  — lists a new product. Persists it to the database so user-listed
//           products survive reloads and are visible to the AI concierge.
//   PATCH — owner-only. Edits an existing product (price, blurb, spec, format,
//           name) and stamps updated_at, which is what Product.dateModified in
//           the storefront's structured data and the sitemap's <lastmod> are
//           sourced from. Without this endpoint that field never changes after
//           a product is first listed — see netlify/lib/db.mts.
//
// Reachable at /api/products via the /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { purgeCache } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }

// Cache tag for the catalog response, purged whenever a product is listed so a
// new product is visible immediately rather than after the TTL expires.
const CATALOG_CACHE_TAG = 'catalog'

const SKU_PREFIX: Record<Product['category'], string> = {
  prompts: 'PP',
  automations: 'AB',
  templates: 'TP',
  agents: 'AG',
  connectors: 'CN',
  host: 'HOST',
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

    // The catalog is the most-requested endpoint on the site: the storefront,
    // every product page, the sitemap and the scheduled agents all read it. It
    // previously carried `max-age=0, must-revalidate`, so every one of those
    // reads ran this function and queried the database. Serving it from
    // Netlify's CDN instead collapses that to roughly one function invocation
    // per five minutes, per region, with no change in what a visitor sees:
    // browsers are still told to revalidate every time, and the CDN copy is
    // purged the moment a product is listed.
    //
    // Only a response actually sourced from the database is cached. A fallback
    // response means the DB was unreachable, and caching a degraded catalog
    // would keep serving it long after the database recovered.
    const headers: Record<string, string> =
      source === 'db'
        ? {
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400, durable',
            'Cache-Tag': CATALOG_CACHE_TAG,
          }
        : { 'Cache-Control': 'public, max-age=0, must-revalidate' }

    return Response.json({ products: products.map(decorate), source }, { headers })
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
      timeSaved: String(body.timeSaved ?? '').trim().slice(0, 80) || null,
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
        INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved)
        VALUES (${sku}, ${record.name}, ${record.category}, ${record.niche}, ${record.format}, ${record.price}, ${record.blurb}, ${record.spec}, ${record.timeSaved})
        RETURNING sku, name, category, niche, format, price, blurb, spec, time_saved
      `) as Array<any>

      // Drop the cached catalog so the new product shows up on the next read
      // instead of waiting out the CDN TTL. A purge failure must not fail the
      // listing — the product is already saved, and the TTL bounds the staleness.
      try {
        await purgeCache({ tags: [CATALOG_CACHE_TAG] })
      } catch (err) {
        console.error('Catalog cache purge failed:', (err as Error).message)
      }

      return Response.json(
        {
          product: decorate({
            ...(row as Product),
            price: Number(row.price),
            ...(row.time_saved ? { timeSaved: row.time_saved } : {}),
          }),
        },
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

  if (req.method === 'PATCH') {
    if (!isConfigured()) {
      return Response.json({ error: 'Editing is not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
    }
    if (!isAuthed(req, Date.now())) {
      return Response.json({ error: 'Not authorized. Sign in first.' }, { status: 401, headers: NO_STORE })
    }

    let body: Partial<Product> & { sku?: string }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
    }

    const sku = String(body.sku ?? '').trim().toUpperCase()
    if (!sku) return Response.json({ error: 'A sku is required' }, { status: 400, headers: NO_STORE })

    // Only touch fields the caller actually sent, so a single-field edit
    // (e.g. just a price change) can't accidentally blank out the rest.
    const fields: Partial<Record<'name' | 'price' | 'format' | 'blurb' | 'spec' | 'category' | 'niche' | 'timeSaved', unknown>> = {}
    if (body.name !== undefined) fields.name = String(body.name).trim().slice(0, 120)
    if (body.format !== undefined) fields.format = String(body.format).trim().slice(0, 120)
    if (body.blurb !== undefined) fields.blurb = String(body.blurb).trim().slice(0, 400)
    if (body.spec !== undefined) fields.spec = String(body.spec).trim().slice(0, 200)
    if (body.timeSaved !== undefined) fields.timeSaved = String(body.timeSaved).trim().slice(0, 80)
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price <= 0 || price > 100000) {
        return Response.json({ error: 'A valid price is required' }, { status: 400, headers: NO_STORE })
      }
      fields.price = price
    }
    if (body.category !== undefined) {
      if (!(body.category in SKU_PREFIX)) return Response.json({ error: 'Unknown category' }, { status: 400, headers: NO_STORE })
      fields.category = body.category
    }
    if (body.niche !== undefined) {
      if (!(body.niche in NICHE_LABEL)) return Response.json({ error: 'Unknown niche' }, { status: 400, headers: NO_STORE })
      fields.niche = body.niche
    }

    if (!Object.keys(fields).length) {
      return Response.json({ error: 'Nothing to update' }, { status: 400, headers: NO_STORE })
    }

    try {
      const db = getDatabase()
      // Netlify's tagged-template db.sql doesn't build a dynamic SET list, so
      // each possible column is a separate, always-safe COALESCE-style branch:
      // an unset field is passed back as its own current value via the
      // fields object above rather than left out of the statement.
      const [row] = (await db.sql`
        UPDATE products SET
          name = COALESCE(${(fields.name as string) ?? null}, name),
          price = COALESCE(${(fields.price as number) ?? null}, price),
          format = COALESCE(${(fields.format as string) ?? null}, format),
          blurb = COALESCE(${(fields.blurb as string) ?? null}, blurb),
          spec = COALESCE(${(fields.spec as string) ?? null}, spec),
          category = COALESCE(${(fields.category as string) ?? null}, category),
          niche = COALESCE(${(fields.niche as string) ?? null}, niche),
          time_saved = COALESCE(${(fields.timeSaved as string) ?? null}, time_saved),
          updated_at = now()
        WHERE sku = ${sku}
        RETURNING sku, name, category, niche, format, price, blurb, spec, time_saved, updated_at
      `) as Array<any>

      if (!row) return Response.json({ error: `No product with sku ${sku}` }, { status: 404, headers: NO_STORE })

      try {
        await purgeCache({ tags: [CATALOG_CACHE_TAG] })
      } catch (err) {
        console.error('Catalog cache purge failed:', (err as Error).message)
      }

      return Response.json(
        {
          product: decorate({
            ...(row as Product),
            price: Number(row.price),
            ...(row.time_saved ? { timeSaved: row.time_saved } : {}),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : undefined,
          }),
        },
        { headers: NO_STORE },
      )
    } catch (err) {
      console.error('Edit product error:', (err as Error).message)
      return Response.json({ error: 'Could not save the edit right now. Please try again.' }, { status: 503, headers: NO_STORE })
    }
  }

  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST, PATCH' } })
}

export const config: Config = {
  path: '/api/products',
}
