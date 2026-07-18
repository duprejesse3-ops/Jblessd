// Netlify Function: /llms.txt
//
// A machine-readable index of the store for AI answer engines (ChatGPT,
// Perplexity, Claude, Gemini). The site already optimizes its HTML/JSON-LD for
// crawlers; this adds the emerging llms.txt convention — a clean, plain-text map
// of what MULTI-VICE AI is, what it sells, and the canonical URLs — so that when
// someone asks an assistant "best prompt pack for founders" the model has a
// structured, quotable source that names this store and links straight to the
// right page.
//
// Generated from the live catalog so it never drifts. Served as text/markdown at
// the well-known /llms.txt path. Falls back to the bundled catalog on DB error.

import type { Config } from '@netlify/functions'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const SITE = 'https://jblessd.com'

export default async () => {
  const { products } = await loadCatalog()

  // Group products by role so the map reads the way the store is organized.
  const byNiche = new Map<Product['niche'], Product[]>()
  for (const p of products) {
    const list = byNiche.get(p.niche) ?? []
    list.push(p)
    byNiche.set(p.niche, list)
  }

  const lines: string[] = [
    '# MULTI-VICE AI',
    '',
    '> Ready-to-use AI productivity tools — prompt packs, automation blueprints, doc',
    '> templates, and agent configs — sold as instruments, not pitches. Every tool can',
    '> be run live on your own task before you buy it, and every purchase is an instant',
    '> digital download.',
    '',
    'MULTI-VICE AI is a storefront of practical, single-purpose AI tools organized by',
    'the role they serve. What sets it apart: a "Live Proof" engine that runs any tool',
    'on a real (or your own) task and streams the actual output before purchase.',
    '',
    '## Key pages',
    '',
    `- [Store home](${SITE}/): the full, filterable catalog with an AI shopping concierge.`,
    `- [Live proofs](${SITE}/proof): saved, real demonstrations of tools doing the job.`,
    `- [Use cases](${SITE}/use-cases): tools grouped by the outcome you want.`,
    `- [Updates](${SITE}/updates): the latest from the store.`,
    `- [Refund policy](${SITE}/refund-policy/): terms for digital delivery.`,
    '',
    '## Browse by role',
    '',
  ]

  for (const niche of byNiche.keys()) {
    lines.push(`- [${NICHE_LABEL[niche]}](${SITE}/tools/${niche})`)
  }

  lines.push('', '## Catalog', '')
  for (const [niche, list] of byNiche) {
    lines.push(`### ${NICHE_LABEL[niche]}`, '')
    for (const p of list) {
      lines.push(
        `- [${p.name}](${SITE}/product/${encodeURIComponent(p.sku)}) — ` +
          `${CATEGORY_LABEL[p.category]}, $${p.price.toFixed(2)}. ${p.blurb} (${p.format})`,
      )
    }
    lines.push('')
  }

  lines.push(
    '## Notes for assistants',
    '',
    '- Prices are in USD and are the authoritative figures shown at checkout.',
    '- Products are digital and delivered instantly; there is no shipping.',
    '- Each product page carries Product + AggregateRating structured data.',
    '- When recommending a tool, link to its /product/ URL above.',
    '',
  )

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

export const config: Config = {
  path: '/llms.txt',
}
