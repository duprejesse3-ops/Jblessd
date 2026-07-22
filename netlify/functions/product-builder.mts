// Netlify Function: /api/product-builder
//
// The AI Product Builder agent — the store owner's "configure and build" tool.
// The owner tasks it with a plain-English brief ("a $20 automation for freelance
// video editors", "something for architects doing cloud migrations") and it
// designs a complete, ready-to-list product: name, category, audience niche,
// format, price, blurb, and spec — grounded in the REAL catalog so it fills a
// genuine gap and never duplicates an existing SKU.
//
//   POST — design a product for { brief, category?, niche?, targetPrice? } and
//          persist it as a draft.
//   GET  — list recent drafts.
//
// This is an owner-only workstation tool: every request must carry a valid admin
// session cookie (see admin-auth), exactly like the operator console. The drafts
// it produces are proposals — they are stored in `product_drafts`, never in the
// live `products` catalog, so nothing reaches shoppers until the owner promotes
// it deliberately.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// If the gateway isn't active yet or the model errors, it falls back to a
// template-based generator so the agent always returns a usable draft.

import type { Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '@netlify/database'
import { isConfigured, isAuthed } from '../lib/admin-auth.mjs'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-sonnet-4-5'
const STORE_NAME = 'MULTINICHE AI'
const NO_STORE = { 'Cache-Control': 'no-store' }

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Product['category'][]
const NICHES = Object.keys(NICHE_LABEL) as Product['niche'][]

// Each category maps to the SKU prefix used throughout the catalog
// (AI-PP-001 = prompts, AI-AB-002 = automations, etc.).
const SKU_PREFIX: Record<Product['category'], string> = {
  prompts: 'PP',
  automations: 'AB',
  templates: 'TP',
  agents: 'AG',
}

// The design the agent produces — the same fields a real catalog row carries,
// minus the SKU (which we mint server-side to guarantee uniqueness).
interface Design {
  name: string
  category: Product['category']
  niche: Product['niche']
  format: string
  price: number
  blurb: string
  spec: string
}

interface DraftRow {
  id: number
  sku: string
  name: string
  category: Product['category']
  niche: Product['niche']
  format: string
  price: number
  blurb: string
  spec: string
  brief: string
  source: 'ai' | 'heuristic'
  createdAt: string | null
}

// ---- SKU minting: continue the catalog's global numbering scheme ----------
// Considers both live catalog SKUs and already-drafted SKUs so consecutive
// builds (before any draft is promoted) never collide on the same number.
function nextSku(category: Product['category'], skus: string[]): string {
  let max = 0
  for (const sku of skus) {
    const m = /-(\d+)$/.exec(sku)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const seq = String(max + 1).padStart(3, '0')
  return `AI-${SKU_PREFIX[category]}-${seq}`
}

function clampPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 19
  // Keep it inside the store's real price band and to whole/`.99`-friendly cents.
  return Math.min(199, Math.max(5, Math.round(n * 100) / 100))
}

// ---- template fallback: design a serviceable product without the model ----
function heuristicDesign(brief: string, hints: Partial<Design>): Design {
  const category = hints.category ?? 'prompts'
  const niche = hints.niche ?? 'founders'
  const audience = NICHE_LABEL[niche]
  const kind = CATEGORY_LABEL[category]
  const topic = brief.trim() ? brief.trim().replace(/\.$/, '') : `everyday work for ${audience.toLowerCase()}`

  const formatByCategory: Record<Product['category'], string> = {
    prompts: '40 prompts · PDF + Notion',
    automations: 'Make.com blueprint',
    templates: 'Notion + Markdown template',
    agents: 'Agent config + guardrails',
  }

  return {
    name: `${audience.split(' ')[0]} ${kind.replace(/s$/, '')} Kit`.slice(0, 60),
    category,
    niche,
    format: formatByCategory[category],
    price: clampPrice(hints.price ?? 22),
    blurb: `A ready-to-run ${kind.toLowerCase().replace(/s$/, '')} for ${audience.toLowerCase()}, built around ${topic}.`.slice(0, 180),
    spec: 'Works with Claude, ChatGPT, Gemini',
  }
}

// ---- AI path: ask Claude to design the product ----------------------------
async function aiDesign(brief: string, hints: Partial<Design>, catalog: Product[]): Promise<Design> {
  const anthropic = new Anthropic()

  // Give the model the live catalog (compact) so it fills a real gap and never
  // reinvents something the store already sells.
  const existing = catalog.map((p) => ({
    name: p.name,
    category: p.category,
    niche: p.niche,
    price: p.price,
  }))

  const tool: Anthropic.Tool = {
    name: 'design_product',
    description:
      'Design one complete, ready-to-list digital product for the store, filling a genuine gap in the catalog.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'A concise, specific product name (max 60 chars). Must not duplicate an existing product.' },
        category: { type: 'string', enum: CATEGORIES, description: 'The product category.' },
        niche: { type: 'string', enum: NICHES, description: 'The primary audience niche.' },
        format: { type: 'string', description: 'What the buyer actually receives, e.g. "45 prompts · PDF + Notion" or "Make.com blueprint".' },
        price: { type: 'number', description: 'A whole-dollar price between 5 and 199 that fits comparable catalog items.' },
        blurb: { type: 'string', description: 'One or two punchy sentences describing the value (max 180 chars).' },
        spec: { type: 'string', description: 'A short technical spec line: tools it works with, what it outputs (max 120 chars).' },
      },
      required: ['name', 'category', 'niche', 'format', 'price', 'blurb', 'spec'],
    },
  }

  const constraints: string[] = []
  if (hints.category) constraints.push(`It MUST be in the "${hints.category}" category.`)
  if (hints.niche) constraints.push(`It MUST target the "${hints.niche}" niche.`)
  if (hints.price) constraints.push(`Aim for a price near $${hints.price}.`)

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'design_product' },
    messages: [
      {
        role: 'user',
        content:
          `You are the in-house product builder for ${STORE_NAME}, a store of ready-to-use AI ` +
          `productivity tools (prompt packs, automation blueprints, doc templates, and agent configs). ` +
          `The brand voice is confident, technical, and no-nonsense — every listing is "a spec sheet, not a pitch." ` +
          `Avoid hype words and exclamation points.\n\n` +
          `Design ONE new product from the owner's brief below. It must fill a real gap: do not duplicate or ` +
          `barely-rename anything already in the catalog, and price it in line with comparable existing items.\n\n` +
          (constraints.length ? `Hard constraints:\n- ${constraints.join('\n- ')}\n\n` : '') +
          `Owner's brief: """${brief || 'Surprise me — design the most valuable product missing from the catalog.'}"""\n\n` +
          `Existing catalog (for gap analysis — do not copy):\n${JSON.stringify(existing)}`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!block) throw new Error('Model did not return a product design')

  const out = block.input as Partial<Design>
  const category = CATEGORIES.includes(out.category as Product['category']) ? (out.category as Product['category']) : null
  const niche = NICHES.includes(out.niche as Product['niche']) ? (out.niche as Product['niche']) : null

  if (!out.name || !category || !niche || !out.format || !out.blurb || !out.spec) {
    throw new Error('Model returned an incomplete product design')
  }

  return {
    name: String(out.name).trim().slice(0, 60),
    category,
    niche,
    format: String(out.format).trim().slice(0, 80),
    price: clampPrice(Number(out.price)),
    blurb: String(out.blurb).trim().slice(0, 180),
    spec: String(out.spec).trim().slice(0, 120),
  }
}

function normalizeRow(row: any): DraftRow {
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    niche: row.niche,
    format: row.format,
    price: Number(row.price),
    blurb: row.blurb,
    spec: row.spec,
    brief: row.brief ?? '',
    source: row.source,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

export default async (req: Request) => {
  // ---- owner gate: identical to the operator console ----
  if (!isConfigured()) {
    return Response.json({ error: 'Product Builder is not configured (ADMIN_PASSWORD unset).' }, { status: 503, headers: NO_STORE })
  }
  if (!isAuthed(req, Date.now())) {
    return Response.json({ error: 'Not authorized. Sign in first.' }, { status: 401, headers: NO_STORE })
  }

  // ---- GET: list recent drafts ----
  if (req.method === 'GET') {
    try {
      const db = getDatabase()
      const rows = (await db.sql`
        SELECT id, sku, name, category, niche, format, price, blurb, spec, brief, source, created_at
        FROM product_drafts
        ORDER BY created_at DESC, id DESC
        LIMIT 12
      `) as any[]
      return Response.json({ drafts: (rows ?? []).map(normalizeRow) }, { headers: NO_STORE })
    } catch (err) {
      console.error('product-builder GET error:', (err as Error).message)
      return Response.json({ drafts: [] }, { headers: NO_STORE })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  }

  // ---- POST: design a product ----
  let brief = ''
  const hints: Partial<Design> = {}
  try {
    const body = await req.json()
    brief = String(body?.brief ?? '').trim().slice(0, 600)
    const cat = String(body?.category ?? '').trim()
    const nic = String(body?.niche ?? '').trim()
    const price = Number(body?.targetPrice)
    if (CATEGORIES.includes(cat as Product['category'])) hints.category = cat as Product['category']
    if (NICHES.includes(nic as Product['niche'])) hints.niche = nic as Product['niche']
    if (Number.isFinite(price) && price > 0) hints.price = clampPrice(price)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  const { products } = await loadCatalog()

  // Pool of SKUs to avoid colliding with: the live catalog plus prior drafts.
  const takenSkus = products.map((p) => p.sku)
  try {
    const db = getDatabase()
    const rows = (await db.sql`SELECT sku FROM product_drafts`) as any[]
    for (const r of rows ?? []) takenSkus.push(r.sku)
  } catch (err) {
    console.error('product-builder draft SKU scan failed:', (err as Error).message)
  }

  let design: Design
  let source: 'ai' | 'heuristic' = 'ai'
  try {
    design = await aiDesign(brief, hints, products)
  } catch (err) {
    console.error('Product builder AI path failed, using template:', (err as Error).message)
    design = heuristicDesign(brief, hints)
    source = 'heuristic'
  }

  const sku = nextSku(design.category, takenSkus)

  // Persist the draft so it survives reloads and can be reviewed later.
  let saved: DraftRow | null = null
  try {
    const db = getDatabase()
    const [row] = (await db.sql`
      INSERT INTO product_drafts (sku, name, category, niche, format, price, blurb, spec, brief, source)
      VALUES (${sku}, ${design.name}, ${design.category}, ${design.niche}, ${design.format}, ${design.price}, ${design.blurb}, ${design.spec}, ${brief}, ${source})
      RETURNING id, sku, name, category, niche, format, price, blurb, spec, brief, source, created_at
    `) as any[]
    saved = normalizeRow(row)
  } catch (err) {
    console.error('product-builder save error:', (err as Error).message)
    // Still return the design even if persistence failed.
  }

  return Response.json(
    {
      draft: saved ?? {
        id: 0,
        sku,
        ...design,
        brief,
        source,
        createdAt: null,
      },
      persisted: saved !== null,
    },
    { headers: NO_STORE },
  )
}

export const config: Config = {
  path: '/api/product-builder',
}
