// Netlify Function: POST /api/describe
//
// The AI product-description generator. The store owner fills in the basics of a
// new listing (name, category, audience, format, price) and this writes the
// customer-facing copy for them: a short blurb, a one-line spec, and a few
// benefit highlights — in the store's voice and grounded in the details given.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// If the gateway isn't active yet (AI Gateway needs at least one production
// deploy) or the model errors, it falls back to a template-based writer so the
// owner always gets usable copy.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const MODEL = 'claude-sonnet-4-5'
const STORE_NAME = 'MULTINICHE AI'

interface Draft {
  name: string
  category: Product['category']
  niche: Product['niche']
  format: string
  price: number
  keywords: string
}

interface Description {
  blurb: string
  spec: string
  highlights: string[]
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Product['category'][]
const NICHES = Object.keys(NICHE_LABEL) as Product['niche'][]

// ---- template fallback: serviceable copy without the model ----
function heuristicDescription(d: Draft): Description {
  const audience = NICHE_LABEL[d.niche].toLowerCase()
  const cat = CATEGORY_LABEL[d.category].toLowerCase()
  return {
    blurb: `A ready-to-use ${cat.replace(/s$/, '')} built for ${audience}. ${
      d.keywords ? `Focused on ${d.keywords}. ` : ''
    }Set it up in minutes and start getting more done with AI.`,
    spec: d.format ? `${d.format} · works with Claude, ChatGPT & Gemini` : 'Works with Claude, ChatGPT & Gemini',
    highlights: [
      `Made for ${audience}`,
      'Instant digital delivery',
      d.keywords ? `Covers ${d.keywords}` : 'Practical, no-fluff setup',
    ],
  }
}

// ---- AI path: ask Claude to write the copy ----
async function aiDescription(d: Draft): Promise<Description> {
  const anthropic = new Anthropic()

  const tool: Anthropic.Tool = {
    name: 'write_description',
    description: 'Write the customer-facing listing copy for a new product.',
    input_schema: {
      type: 'object',
      properties: {
        blurb: {
          type: 'string',
          description: 'One or two punchy sentences (max ~200 chars) selling the product to the shopper.',
        },
        spec: {
          type: 'string',
          description: 'A single short spec line, e.g. "120 prompts · PDF + Notion" or "Works with Claude".',
        },
        highlights: {
          type: 'array',
          description: 'Exactly 3 short benefit bullets, 2-5 words each.',
          items: { type: 'string' },
        },
      },
      required: ['blurb', 'spec', 'highlights'],
    },
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'write_description' },
    messages: [
      {
        role: 'user',
        content:
          `You are the copywriter for ${STORE_NAME}, a store of ready-to-use AI productivity tools. ` +
          `The brand voice is confident, concrete, and free of hype or clichés. Write listing copy for ` +
          `this new product. Ground everything in the details provided — do not invent specific numbers ` +
          `or features that aren't implied.\n\n` +
          `Product details:\n` +
          `- Name: ${d.name}\n` +
          `- Category: ${CATEGORY_LABEL[d.category]}\n` +
          `- Audience: ${NICHE_LABEL[d.niche]}\n` +
          (d.format ? `- Format: ${d.format}\n` : '') +
          (d.price ? `- Price: $${d.price}\n` : '') +
          (d.keywords ? `- Keywords / notes: ${d.keywords}\n` : ''),
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!block) throw new Error('Model did not return a description')

  const out = block.input as Partial<Description>
  const blurb = String(out.blurb ?? '').trim()
  if (!blurb) throw new Error('Model returned an empty blurb')

  return {
    blurb: blurb.slice(0, 300),
    spec: String(out.spec ?? '').trim().slice(0, 120) || 'Works with Claude, ChatGPT & Gemini',
    highlights: (Array.isArray(out.highlights) ? out.highlights : [])
      .map((h) => String(h).trim())
      .filter(Boolean)
      .slice(0, 3),
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let draft: Draft
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim().slice(0, 120)
    if (name.length < 2) {
      return Response.json({ error: 'Add a product name first.' }, { status: 400 })
    }
    draft = {
      name,
      category: CATEGORIES.includes(body?.category) ? body.category : 'prompts',
      niche: NICHES.includes(body?.niche) ? body.niche : 'founders',
      format: String(body?.format ?? '').trim().slice(0, 120),
      price: Number(body?.price) || 0,
      keywords: String(body?.keywords ?? '').trim().slice(0, 300),
    }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  let description: Description
  let source: 'ai' | 'heuristic' = 'ai'
  try {
    description = await aiDescription(draft)
  } catch (err) {
    console.error('Describe AI path failed, using template:', (err as Error).message)
    description = heuristicDescription(draft)
    source = 'heuristic'
  }

  return Response.json({ ...description, source })
}

export const config: Config = {
  path: '/api/describe',
}
