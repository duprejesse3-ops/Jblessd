// Upgrades the thing a buyer actually downloads and keeps — the deliverable
// document — from a generic, template-filled boilerplate into a bespoke, fully
// written piece of work authored by Claude specifically for that product.
//
// deliverables.mts already turns any SKU into a usable Markdown document from
// its metadata alone, and that stays as the always-available baseline. This
// module is the premium layer on top: it asks Claude (via Netlify AI Gateway)
// to write the *real* content for a product — actual, ready-to-run prompts, a
// concretely detailed automation blueprint, a genuinely filled-out template, a
// production-grade agent config — with no "[fill this in]" brackets left for
// the buyer to complete. That is the difference between "here is a template"
// and "here is the finished tool," and it's what sets the store apart.
//
// The result is expensive to produce, so it's cached per product in Netlify
// Blobs: generated once on first fulfilment of a SKU, then served instantly and
// identically to every subsequent buyer. The cache key folds in a hash of the
// product's own fields, so editing a product's copy transparently regenerates
// its deliverable without any manual cache-busting.
//
// Every failure path — AI Gateway not yet active (it needs one production
// deploy), a model error, a malformed response, Blobs unavailable in local dev
// — falls back to the template deliverable, so a buyer is never left empty
// handed. The AI layer only ever *upgrades* the download; it can never break it.

import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from './catalog.mjs'
import {
  buildDeliverable,
  deliverableToMarkdown,
  type Deliverable,
  type DeliverableSection,
} from './deliverables.mjs'

// The flagship model: this is the paid artifact the buyer keeps forever, and it
// is written once per SKU and cached, so it's worth the best output available.
const MODEL = 'claude-opus-4-8'
const MAX_TOKENS = 4000

// Bump when the generation prompt or stored shape changes so old cached copies
// are ignored and rewritten on next fulfilment.
const CACHE_VERSION = 'v1'
const STORE_NAME = 'ai-deliverables'

const STORE_NAME_LABEL = 'MULTINICHE AI'

// What the store holds per product — the deliverable plus enough provenance to
// know how and from what it was generated.
interface CachedDeliverable {
  version: string
  model: string
  fingerprint: string
  deliverable: Deliverable
  markdown: string
}

export interface AiDeliverable {
  deliverable: Deliverable
  markdown: string
}

// A tiny, stable string hash (FNV-1a, base36). No crypto needed — this only has
// to change when the product's copy changes, and it must be deterministic
// (Date.now / Math.random are unavailable here anyway).
function fingerprintOf(product: Product): string {
  const basis = [
    CACHE_VERSION,
    product.name,
    product.category,
    product.niche,
    product.format,
    product.spec,
    product.blurb,
  ].join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function cacheKey(product: Product): string {
  return `${product.sku}-${CACHE_VERSION}`
}

// ---- the authoring brief -------------------------------------------------
//
// One instruction per category describing what "finished, ready-to-use" means
// for that kind of product, mirroring the shape the template deliverable uses
// (deliverables.mts) so the AI version is a drop-in, higher-quality replacement.

const AUTHOR_BRIEF: Record<Product['category'], string> = {
  prompts:
    'Write a pack of genuinely reusable, copy-paste prompts. Each section is ONE complete prompt the buyer can paste into Claude, ChatGPT, or Gemini and run immediately. Make them specific to this exact topic and audience, not generic. A small number of clearly-labelled [placeholders] for the buyer\'s own input is fine, but the prompt engineering itself must be fully written — never leave the actual instructions as a blank to complete.',
  automations:
    'Write a concrete, buildable automation blueprint: what triggers it, the exact step-by-step flow, the specific tools/services involved, the real decision logic (including a ready-to-paste LLM routing prompt), and how to test it before going live. Be specific enough that a competent person could build it today without guessing.',
  templates:
    'Write a finished, worked template — not a blank one. Every section must contain real, well-written model content for this exact use case that the buyer can lightly adapt, plus a short italic note on what to change. The buyer should feel they received a strong first draft, not an empty form.',
  agents:
    'Write a production-grade agent configuration: a complete, paste-ready system prompt (fully specified, no blanks), its operating rules and guardrails, the exact inputs it expects and outputs it returns, and a short plan for tuning it on real cases. The system prompt must be genuinely usable as written.',
}

function buildAuthorPrompt(product: Product): { system: string; user: string } {
  const kind = CATEGORY_LABEL[product.category]
  const audience = NICHE_LABEL[product.niche]
  const system =
    `You are the lead author for ${STORE_NAME_LABEL}, a store of ready-to-use AI productivity tools. ` +
    `You write the actual deliverable a paying buyer downloads and keeps — the finished tool itself, ` +
    `not a description of it and not a template full of blanks.\n\n` +
    `Voice: confident, technical, no-nonsense. No hype, no exclamation points, no filler, no restating ` +
    `the task. Every word earns its place.\n\n` +
    `This product is a ${kind} for ${audience}.\n` +
    `${AUTHOR_BRIEF[product.category]}\n\n` +
    `Produce 5 to 6 sections. Each section has a short imperative title and a body of real, finished ` +
    `content (the body may use line breaks and simple lists). Also write a one- to two-sentence intro ` +
    `that tells the buyer exactly what they're holding and how to use it. Never mention price, buying, ` +
    `demos, or that you are an AI.`
  const user =
    `Write the complete deliverable for this product.\n\n` +
    `Name: ${product.name}\n` +
    `Category: ${kind}\n` +
    `Audience: ${audience}\n` +
    `What it does: ${product.blurb}\n` +
    `Format: ${product.format}\n` +
    `Spec: ${product.spec}\n\n` +
    `Return it through the write_deliverable tool.`
  return { system, user }
}

const DELIVERABLE_TOOL: Anthropic.Tool = {
  name: 'write_deliverable',
  description: 'Return the finished, ready-to-use deliverable document for the product.',
  input_schema: {
    type: 'object',
    properties: {
      intro: {
        type: 'string',
        description: 'One to two sentences telling the buyer what they have and how to use it.',
      },
      sections: {
        type: 'array',
        description: 'The 5-6 sections that make up the finished deliverable.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A short, imperative section title.' },
            body: {
              type: 'string',
              description:
                'The real, finished content of this section — usable as-is, not a blank to complete.',
            },
          },
          required: ['title', 'body'],
        },
      },
    },
    required: ['intro', 'sections'],
  },
}

// ---- generation ----------------------------------------------------------

async function authorDeliverable(product: Product): Promise<AiDeliverable> {
  const anthropic = new Anthropic()
  const { system, user } = buildAuthorPrompt(product)

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    tools: [DELIVERABLE_TOOL],
    tool_choice: { type: 'tool', name: 'write_deliverable' },
    messages: [{ role: 'user', content: user }],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined
  if (!block) throw new Error('model returned no deliverable')

  const out = block.input as { intro?: unknown; sections?: unknown }
  const rawSections = Array.isArray(out.sections) ? out.sections : []
  const sections: DeliverableSection[] = []
  for (const s of rawSections) {
    const title = String((s as any)?.title ?? '').trim()
    const body = String((s as any)?.body ?? '').trim()
    if (title && body) sections.push({ title, body })
  }
  const intro = String(out.intro ?? '').trim()

  // Guard against a thin or empty response — anything short of a real document
  // should fall back to the dependable template rather than ship as the paid item.
  if (sections.length < 3 || !intro) {
    throw new Error('model returned an incomplete deliverable')
  }

  const deliverable: Deliverable = {
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro,
    sections,
  }
  return { deliverable, markdown: deliverableToMarkdown(deliverable) }
}

// ---- blob cache ----------------------------------------------------------

function openStore(): ReturnType<typeof getStore> | null {
  try {
    return getStore({ name: STORE_NAME, consistency: 'strong' })
  } catch (err) {
    console.warn('ai-deliverable: blob store unavailable —', (err as Error).message)
    return null
  }
}

async function readCache(
  store: ReturnType<typeof getStore>,
  product: Product,
  fingerprint: string,
): Promise<AiDeliverable | null> {
  try {
    const cached = (await store.get(cacheKey(product), { type: 'json' })) as CachedDeliverable | null
    if (
      cached &&
      cached.version === CACHE_VERSION &&
      cached.fingerprint === fingerprint &&
      cached.deliverable &&
      Array.isArray(cached.deliverable.sections) &&
      cached.deliverable.sections.length >= 3 &&
      cached.markdown
    ) {
      return { deliverable: cached.deliverable, markdown: cached.markdown }
    }
  } catch (err) {
    console.warn('ai-deliverable: cache read failed —', (err as Error).message)
  }
  return null
}

/**
 * Return the AI-authored deliverable for a product, generating and caching it on
 * first request and serving the cached copy thereafter. Returns null on any
 * failure so the caller can fall back to the template deliverable — this layer
 * only ever upgrades the download, it never blocks it.
 */
export async function getAiDeliverable(product: Product): Promise<AiDeliverable | null> {
  const fingerprint = fingerprintOf(product)
  const store = openStore()

  if (store) {
    const hit = await readCache(store, product, fingerprint)
    if (hit) return hit
  }

  let generated: AiDeliverable
  try {
    generated = await authorDeliverable(product)
  } catch (err) {
    // Most commonly: AI Gateway isn't active yet (needs one production deploy).
    console.warn('ai-deliverable: generation failed, using template —', (err as Error).message)
    return null
  }

  if (store) {
    try {
      const record: CachedDeliverable = {
        version: CACHE_VERSION,
        model: MODEL,
        fingerprint,
        deliverable: generated.deliverable,
        markdown: generated.markdown,
      }
      await store.setJSON(cacheKey(product), record)
    } catch (err) {
      // A write miss just means the next buyer regenerates — the current buyer
      // still gets their AI deliverable now.
      console.warn('ai-deliverable: cache write failed —', (err as Error).message)
    }
  }

  return generated
}

/**
 * Best-effort upgrade of a template deliverable to its AI-authored version.
 * Always resolves; returns the AI deliverable when available, otherwise the
 * provided template fallback so the caller can use one code path.
 */
export async function upgradeDeliverable(
  product: Product,
  fallback: { deliverable: Deliverable; markdown: string },
): Promise<{ deliverable: Deliverable; markdown: string; aiCrafted: boolean }> {
  try {
    const ai = await getAiDeliverable(product)
    if (ai) return { ...ai, aiCrafted: true }
  } catch (err) {
    console.warn('ai-deliverable: upgrade failed —', (err as Error).message)
  }
  return { ...fallback, aiCrafted: false }
}

// Re-exported so callers that only have a Product can build the baseline in one
// import alongside the upgrade helper.
export { buildDeliverable, deliverableToMarkdown }
