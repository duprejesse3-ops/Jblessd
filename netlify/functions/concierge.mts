// Netlify Function: POST /api/concierge
//
// The AI shopping concierge. A visitor describes what they're working on in
// plain language ("I run a 3-person agency and drown in client email") and this
// returns a hand-picked bundle of catalog products with a reason for each pick.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// If the gateway isn't active yet (AI Gateway needs at least one production
// deploy) or the model errors, it transparently falls back to a keyword-based
// recommender so the feature always returns something useful.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-sonnet-4-5'
const MAX_PICKS = 4

interface Pick {
  sku: string
  reason: string
}

// ---- keyword fallback: score every product against the query ----
function heuristicPicks(query: string, products: Product[]): { summary: string; picks: Pick[] } {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const scored = products
    .map((p) => {
      const haystack = [
        p.name,
        p.blurb,
        p.spec,
        p.format,
        CATEGORY_LABEL[p.category],
        NICHE_LABEL[p.niche],
      ]
        .join(' ')
        .toLowerCase()
      let score = 0
      for (const t of terms) {
        if (t.length < 3) continue
        if (haystack.includes(t)) score += 2
        if (p.name.toLowerCase().includes(t)) score += 2
      }
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)

  const top = scored.filter((s) => s.score > 0).slice(0, MAX_PICKS)
  const chosen = top.length > 0 ? top : scored.slice(0, MAX_PICKS)

  return {
    summary:
      top.length > 0
        ? 'Here are the tools that best match what you described.'
        : 'A solid starter set for getting more out of AI day to day.',
    picks: chosen.map(({ p }) => ({
      sku: p.sku,
      reason: `${p.blurb} A strong fit for ${NICHE_LABEL[p.niche].toLowerCase()}.`,
    })),
  }
}

// ---- AI path: ask Claude to curate a bundle ----
async function aiPicks(query: string, products: Product[]): Promise<{ summary: string; picks: Pick[] }> {
  const anthropic = new Anthropic()

  const catalogForModel = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: CATEGORY_LABEL[p.category],
    audience: NICHE_LABEL[p.niche],
    price: p.price,
    description: p.blurb,
  }))

  const tool: Anthropic.Tool = {
    name: 'recommend_bundle',
    description: 'Recommend the best-fitting products from the catalog for the shopper.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'One or two friendly sentences summarizing the recommended bundle and why it fits.',
        },
        picks: {
          type: 'array',
          description: `Between 2 and ${MAX_PICKS} products, best fit first.`,
          items: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The exact sku from the catalog.' },
              reason: {
                type: 'string',
                description: 'One sentence, addressed to the shopper, on why this specific product helps them.',
              },
            },
            required: ['sku', 'reason'],
          },
        },
      },
      required: ['summary', 'picks'],
    },
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'recommend_bundle' },
    messages: [
      {
        role: 'user',
        content:
          `You are the shopping concierge for THE CONSTRUCT AI, a store of ready-to-use AI ` +
          `productivity tools (prompt packs, automation blueprints, doc templates, and agent configs).\n\n` +
          `A shopper says:\n"""${query}"""\n\n` +
          `Pick the ${MAX_PICKS} or fewer products from this catalog that would help them most. ` +
          `Only use SKUs that appear in the catalog. Prefer a complementary bundle over near-duplicates.\n\n` +
          `Catalog:\n${JSON.stringify(catalogForModel)}`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined
  if (!block) throw new Error('Model did not return a recommendation')

  const out = block.input as { summary?: string; picks?: Pick[] }
  const valid = new Set(products.map((p) => p.sku))
  const picks = (out.picks ?? [])
    .filter((pk) => pk && valid.has(pk.sku))
    .slice(0, MAX_PICKS)

  if (picks.length === 0) throw new Error('Model returned no valid picks')

  return {
    summary: out.summary?.trim() || 'A tailored set of tools for what you described.',
    picks,
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let query = ''
  try {
    const body = await req.json()
    query = String(body?.query ?? '').trim().slice(0, 1000)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (query.length < 3) {
    return Response.json({ error: 'Tell me a little about what you are working on.' }, { status: 400 })
  }

  const { products } = await loadCatalog()
  const byId = new Map(products.map((p) => [p.sku, p]))

  let result: { summary: string; picks: Pick[] }
  let source: 'ai' | 'heuristic' = 'ai'
  try {
    result = await aiPicks(query, products)
  } catch (err) {
    console.error('Concierge AI path failed, using heuristic:', (err as Error).message)
    result = heuristicPicks(query, products)
    source = 'heuristic'
  }

  // Hydrate picks with full product data for the client.
  const recommendations = result.picks
    .map((pk) => {
      const p = byId.get(pk.sku)
      if (!p) return null
      return {
        sku: p.sku,
        name: p.name,
        price: p.price,
        format: p.format,
        blurb: p.blurb,
        category: p.category,
        niche: p.niche,
        catLabel: CATEGORY_LABEL[p.category],
        nicheLabel: NICHE_LABEL[p.niche],
        reason: pk.reason,
      }
    })
    .filter(Boolean)

  const bundleTotal = recommendations.reduce((sum, r) => sum + (r ? r.price : 0), 0)

  return Response.json({ summary: result.summary, recommendations, bundleTotal, source })
}

export const config: Config = {
  path: '/api/concierge',
}
