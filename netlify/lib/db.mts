// Loads the catalog from Netlify Database, falling back to the bundled
// canonical catalog when the DB is unreachable or not yet seeded (e.g. a fresh
// preview branch, or local dev before migrations have been applied). Keeping
// this in one place means both /api/products and /api/concierge behave the same.

import { getDatabase } from '@netlify/database'
import { FALLBACK_CATALOG, type Product } from './catalog.mjs'

export async function loadCatalog(): Promise<{ products: Product[]; source: 'db' | 'fallback' }> {
  try {
    const db = getDatabase()
    const rows = await db.sql`
      SELECT sku, name, category, niche, format, price, blurb, spec
      FROM products
      ORDER BY id
    `
    if (Array.isArray(rows) && rows.length > 0) {
      const products = rows.map((r: any) => ({
        sku: r.sku,
        name: r.name,
        category: r.category,
        niche: r.niche,
        format: r.format,
        price: Number(r.price),
        blurb: r.blurb,
        spec: r.spec,
      })) as Product[]
      return { products, source: 'db' }
    }
  } catch (err) {
    console.error('loadCatalog: falling back to bundled catalog —', (err as Error).message)
  }
  return { products: FALLBACK_CATALOG, source: 'fallback' }
}
