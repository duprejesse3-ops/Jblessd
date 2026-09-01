// One-off diagnostic: compares benchmark_scenarios.sku against the live
// products catalog to find out why scorecard-runner.mts only ever matches
// a handful of SKUs. Read-only — makes no changes. Safe to delete once the
// mismatch is understood and fixed.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { loadCatalog } from '../lib/db.mjs'

interface ScenarioRow {
  sku: string
}

export default async (_req: Request) => {
  const db = getDatabase()
  const { products } = await loadCatalog()

  const scenarioRows = (await db.sql`SELECT sku FROM benchmark_scenarios`) as ScenarioRow[]
  const scenarioSkus = scenarioRows.map((r) => r.sku)
  const productSkus = new Set(products.map((p) => p.sku))

  const matched = scenarioSkus.filter((sku) => productSkus.has(sku))
  const unmatched = scenarioSkus.filter((sku) => !productSkus.has(sku))

  console.log(`[scorecard-diag] total scenarios: ${scenarioSkus.length}`)
  console.log(`[scorecard-diag] total live products: ${products.length}`)
  console.log(`[scorecard-diag] matched: ${matched.length} → ${JSON.stringify(matched.slice(0, 20))}`)
  console.log(`[scorecard-diag] unmatched (first 20): ${JSON.stringify(unmatched.slice(0, 20))}`)
  console.log(`[scorecard-diag] sample live product SKUs: ${JSON.stringify(Array.from(productSkus).slice(0, 20))}`)

  return Response.json({
    totalScenarios: scenarioSkus.length,
    totalProducts: products.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    matched,
    unmatchedSample: unmatched.slice(0, 20),
    productSkuSample: Array.from(productSkus).slice(0, 20),
  })
}

export const config: Config = {
  path: '/api/scorecard-diag',
}
