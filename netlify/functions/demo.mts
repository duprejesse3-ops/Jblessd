// Netlify Function: POST /api/demo
//
// "Live Proof" — the storefront's signature move. Every other digital-goods
// store asks you to trust a description and read the reviews. This one lets you
// watch the product actually *work* before you spend a cent: pick any tool and
// Claude runs a faithful demonstration of it — the prompt pack answering a real
// task, the agent config handling a request in character, the automation
// walking its run, the template filled in with a realistic example — streamed
// token-by-token into a terminal panel. Optionally, the shopper drops in their
// own situation and the demo re-runs tailored to them.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// The default (no-scenario) demo per SKU is cached in Netlify Blobs so repeat
// views are instant and cheap; custom scenarios always run fresh. If the gateway
// isn't active yet (it needs at least one production deploy) or the model errors
// before any text streams, it falls back to a hand-built sample so the panel is
// never empty.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-opus-4-8' // the flagship — this is the store's showcase
const MAX_TOKENS = 900
const STORE_NAME = 'MULTI-VICE AI'
const CACHE_VERSION = 'v1' // bump to invalidate all cached demos at once

// Per-category direction so the demo reflects what the product actually *is*.
// Each entry frames the run and gives Claude a concrete opening move.
const PLAYBOOK: Record<Product['category'], { verb: string; brief: string }> = {
  prompts: {
    verb: 'Running a representative prompt from this pack',
    brief:
      'Show ONE representative prompt from this pack, then run it live on a realistic, specific scenario and show the finished output the buyer would get. Label the two parts clearly (the prompt, then the result).',
  },
  automations: {
    verb: 'Simulating one run of this automation',
    brief:
      'Walk through a single realistic run of this automation as an execution trace: the trigger that fired, each step it takes, and the concrete end result. Make it read like a real run log, not a feature list.',
  },
  templates: {
    verb: 'Filling this template with a real example',
    brief:
      'Fill this template in with a realistic, fully worked example so the buyer sees exactly what a completed one looks like. Keep the template’s structure visible.',
  },
  agents: {
    verb: 'Putting this agent to work on a real task',
    brief:
      'Role-play this agent handling one representative task end to end: show the incoming request, then the agent’s actual response/output in character. Demonstrate the behavior the config produces.',
  },
}

// ---- fallback: a serviceable, product-specific sample without the model ----
function fallbackDemo(p: Product, scenario: string): string {
  const audience = NICHE_LABEL[p.niche].toLowerCase()
  const ctx = scenario ? `\nScenario: ${scenario}\n` : ''
  const play = PLAYBOOK[p.category]
  return (
    `▸ ${play.verb} — ${p.name}\n` +
    `  ${p.format}${ctx}\n` +
    `This is a preview of how “${p.name}” works for ${audience}. ${p.blurb}\n\n` +
    `Once the storefront’s live engine is warmed up (it activates after the first ` +
    `production deploy), this panel runs the tool in full and streams the real ` +
    `output here. In the meantime: ${p.spec}.`
  )
}

// Build the system + user prompt that makes Claude *demonstrate* the product.
function buildPrompt(p: Product, scenario: string): { system: string; user: string } {
  const play = PLAYBOOK[p.category]
  const system =
    `You are the live demonstration engine for ${STORE_NAME}, a store of ready-to-use ` +
    `AI productivity tools. Your job is to PROVE a specific product works by showing it ` +
    `in action — a working demo, not a sales pitch and not a description of features.\n\n` +
    `Rules:\n` +
    `- ${play.brief}\n` +
    `- Be concrete and specific. Invent realistic details (names, numbers, content) so it ` +
    `feels like a real run, but never claim capabilities beyond what the product is.\n` +
    `- Keep it tight: roughly 150–260 words. This renders in a small terminal panel.\n` +
    `- Plain text only. No markdown headers or code fences. You may use simple line ` +
    `breaks, short labels ending in a colon, and "▸" or "—" as light structure.\n` +
    `- Do not greet the user, do not mention price, and do not tell them to buy. Let the ` +
    `quality of the output do the selling.`

  const user =
    `Demonstrate this product:\n` +
    `- Name: ${p.name}\n` +
    `- Type: ${CATEGORY_LABEL[p.category]}\n` +
    `- Built for: ${NICHE_LABEL[p.niche]}\n` +
    `- Format: ${p.format}\n` +
    `- Spec: ${p.spec}\n` +
    `- What it does: ${p.blurb}\n` +
    (scenario
      ? `\nTailor the demonstration to this shopper's own situation:\n"""${scenario}"""\n`
      : `\nUse a realistic scenario a typical ${NICHE_LABEL[p.niche]} shopper would relate to.\n`)

  return { system, user }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let sku = ''
  let scenario = ''
  try {
    const body = await req.json()
    sku = String(body?.sku ?? '').trim().slice(0, 32)
    scenario = String(body?.scenario ?? '').trim().slice(0, 600)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!sku) return Response.json({ error: 'A product SKU is required.' }, { status: 400 })

  const { products } = await loadCatalog()
  const product = products.find((p) => p.sku === sku)
  if (!product) return Response.json({ error: 'No product with that SKU.' }, { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      // Only the default (no-scenario) demo is cacheable — custom scenarios are
      // unique to the shopper and always run fresh.
      const cacheable = scenario.length === 0
      const cacheKey = `${CACHE_VERSION}/${sku}`
      let store: ReturnType<typeof getStore> | null = null
      if (cacheable) {
        try {
          store = getStore('product-demos')
          const cached = await store.get(cacheKey, { type: 'text' })
          if (cached) {
            send({ type: 'meta', verb: PLAYBOOK[product.category].verb, cached: true })
            // Replay the cached demo in small chunks so it still feels live.
            for (const piece of cached.match(/[\s\S]{1,24}/g) ?? [cached]) {
              send({ type: 'text', text: piece })
            }
            send({ type: 'done' })
            controller.close()
            return
          }
        } catch (err) {
          console.error('demo: blob read failed —', (err as Error).message)
        }
      }

      send({ type: 'meta', verb: PLAYBOOK[product.category].verb, cached: false })

      let full = ''
      try {
        const anthropic = new Anthropic()
        const { system, user } = buildPrompt(product, scenario)
        const modelStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: user }],
        })

        for await (const event of modelStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text
            send({ type: 'text', text: event.delta.text })
          }
        }

        // Persist the default demo so the next shopper gets it instantly.
        if (cacheable && store && full.trim()) {
          try {
            await store.set(cacheKey, full)
          } catch (err) {
            console.error('demo: blob write failed —', (err as Error).message)
          }
        }
      } catch (err) {
        console.error('Demo engine failed:', (err as Error).message)
        // Only fall back if nothing streamed, so we never double up on output.
        if (!full.trim()) {
          for (const piece of fallbackDemo(product, scenario).match(/[\s\S]{1,24}/g) ?? []) {
            send({ type: 'text', text: piece })
          }
        } else {
          send({ type: 'text', text: '\n\n(Cut off there — run it again for the full demo.)' })
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
  path: '/api/demo',
}
