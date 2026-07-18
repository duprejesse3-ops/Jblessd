// Netlify Function: POST /api/chat
//
// The storefront's live AI assistant — a real Claude *agent*, not a single
// prompt. Each turn Claude can call tools to search the live catalog and look
// up individual products, decide it needs another lookup, and only then answer.
// That agentic loop (model → tool → model → …) is what lets it ground every
// answer in real SKUs and prices instead of inventing them.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// The response is streamed back as newline-delimited JSON events so the widget
// can render text as it arrives and drop in product cards the moment the agent
// surfaces them. If the gateway isn't active yet (AI Gateway needs at least one
// production deploy) or the model errors before any text streams, it falls back
// to a keyword search so the assistant still returns something useful.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-sonnet-4-5'
const MAX_STEPS = 5 // safety cap on the agent's tool-use loop
const STORE_NAME = 'MULTIVICE AI'

interface ClientMessage {
  role: 'user' | 'assistant'
  content: string
}

// A trimmed product shape the model (and the client cards) can consume.
function forModel(p: Product) {
  return {
    sku: p.sku,
    name: p.name,
    price: p.price,
    format: p.format,
    category: CATEGORY_LABEL[p.category],
    audience: NICHE_LABEL[p.niche],
    blurb: p.blurb,
    spec: p.spec,
  }
}

// The client card shape — mirrors what the concierge already renders.
function forCard(p: Product) {
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
  }
}

// ---- keyword search: shared by the tool and the no-AI fallback ----
function searchCatalog(query: string, products: Product[], max = 4): Product[] {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const scored = products
    .map((p) => {
      const haystack = [p.name, p.blurb, p.spec, p.format, CATEGORY_LABEL[p.category], NICHE_LABEL[p.niche]]
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

  const top = scored.filter((s) => s.score > 0).slice(0, max)
  return (top.length > 0 ? top : scored.slice(0, max)).map((s) => s.p)
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_catalog',
    description:
      'Search the store catalog for products matching a shopper need, keyword, category, or audience. ' +
      'Returns the best-matching products with their SKU, name, price, and description. ' +
      'Use this before recommending anything so every suggestion is a real product.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the shopper needs, in plain language or keywords.' },
        max: { type: 'integer', description: 'Max products to return (1-6). Default 4.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Fetch full details (spec, format, price, description) for one product by its exact SKU.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'The exact SKU, e.g. AI-PP-001.' },
      },
      required: ['sku'],
    },
  },
]

const SYSTEM = (products: Product[]) =>
  `You are the AI shopping assistant for ${STORE_NAME}, a store of ready-to-use AI productivity ` +
  `tools: prompt packs, automation blueprints, doc templates, and agent configs.\n\n` +
  `You are an agent: use the search_catalog and get_product tools to ground every answer in the ` +
  `real catalog. Never invent SKUs, prices, or products. If nothing fits, say so honestly and ` +
  `suggest how the shopper could rephrase.\n\n` +
  `Be warm, concise, and practical — a few sentences, not an essay. When you recommend products, ` +
  `refer to them by name and briefly say why each fits. The shopper sees product cards with an ` +
  `"Add to cart" button rendered automatically from your tool results, so you don't need to repeat ` +
  `prices or SKUs in your prose. The catalog currently has ${products.length} products.`

// Run one tool call and return { result (for the model), cards (for the client) }.
function runTool(
  name: string,
  input: any,
  products: Product[],
  byId: Map<string, Product>,
): { result: unknown; cards: Product[] } {
  if (name === 'search_catalog') {
    const max = Math.min(Math.max(Number(input?.max) || 4, 1), 6)
    const found = searchCatalog(String(input?.query ?? ''), products, max)
    return { result: found.map(forModel), cards: found }
  }
  if (name === 'get_product') {
    const p = byId.get(String(input?.sku ?? ''))
    if (!p) return { result: { error: 'No product with that SKU.' }, cards: [] }
    return { result: forModel(p), cards: [p] }
  }
  return { result: { error: `Unknown tool ${name}` }, cards: [] }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let history: ClientMessage[] = []
  try {
    const body = await req.json()
    const raw = Array.isArray(body?.messages) ? body.messages : []
    history = raw
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      .slice(-12) // keep the last handful of turns
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return Response.json({ error: 'Send a message to start.' }, { status: 400 })
  }

  const { products } = await loadCatalog()
  const byId = new Map(products.map((p) => [p.sku, p]))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      const seenCards = new Set<string>()
      const emitCards = (cards: Product[]) => {
        const fresh = cards.filter((c) => !seenCards.has(c.sku))
        fresh.forEach((c) => seenCards.add(c.sku))
        if (fresh.length) send({ type: 'products', items: fresh.map(forCard) })
      }

      let anyText = false
      try {
        const anthropic = new Anthropic()
        const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }))

        for (let step = 0; step < MAX_STEPS; step++) {
          const modelStream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 1024,
            system: SYSTEM(products),
            tools: TOOLS,
            messages,
          })

          for await (const event of modelStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              anyText = true
              send({ type: 'text', text: event.delta.text })
            }
          }

          const final = await modelStream.finalMessage()
          messages.push({ role: 'assistant', content: final.content })

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )
          if (toolUses.length === 0) break // agent is done

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const tu of toolUses) {
            send({ type: 'status', tool: tu.name })
            const { result, cards } = runTool(tu.name, tu.input, products, byId)
            emitCards(cards)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result),
            })
          }
          messages.push({ role: 'user', content: toolResults })
        }
      } catch (err) {
        console.error('Chat agent failed:', (err as Error).message)
        // Only fall back if we never streamed any answer, so we don't tack a
        // second reply onto a partial one.
        if (!anyText) {
          const lastUser = [...history].reverse().find((m) => m.role === 'user')
          const found = searchCatalog(lastUser?.content ?? '', products, 3)
          send({
            type: 'text',
            text:
              "Here are a few tools from the catalog that look relevant. (My smart assistant is " +
              'warming up — it activates after the first production deploy.)',
          })
          emitCards(found)
        } else {
          send({ type: 'text', text: '\n\n(Sorry — I got cut off there. Could you ask that again?)' })
        }
      } finally {
        send({ type: 'done' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

export const config: Config = {
  path: '/api/chat',
}
