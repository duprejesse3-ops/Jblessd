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
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const MODEL = 'claude-opus-4-8' // the flagship — this is the store's showcase
const MAX_TOKENS_PREVIEW = 900 // the quick, cached, no-scenario demo
// A shopper's own submitted task gets real room to work through it. This
// matters most for genuinely hard scenarios (see "Stump the Agent" style
// challenges) — the old single 900-token cap cut off a real attempt at a hard
// task mid-thought, which reads as broken rather than as an honest limitation.
const MAX_TOKENS_SCENARIO = 1700

// Custom-scenario demos are the one path here that always pays for fresh
// flagship inference — the default per-SKU demo is served from the Blobs cache,
// so it is effectively free and stays unmetered so any shopper can watch it.
// A unique scenario string defeats the cache by design, which without a ceiling
// makes this endpoint an open, unauthenticated way to spend the store's
// inference budget. Ten tailored runs an hour per IP is far more than a real
// shopper needs and bounds what a script can cost.
const CUSTOM_DEMO_LIMIT = 10
const CUSTOM_DEMO_WINDOW_MS = 60 * 60 * 1000
const STORE_NAME = 'MULTINICHE AI'
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
  connectors: {
    verb: 'Running a live sync through this connector',
    brief:
      'Show this connector app in action: a realistic trigger or sync event on one side (the outside service — Zapier, Shopify, Sheets, email, Slack, etc.) and the concrete result it produces on the agent side, or vice versa. Make it read like a real connection firing, not a feature list.',
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
  const lengthRule = scenario
    ? 'Give this real, submitted task room to breathe: roughly 250–450 words — enough to actually work through it, not just gesture at it.'
    : 'Keep it tight: roughly 150–260 words. This renders in a small terminal panel.'
  const system =
    `You are the live demonstration engine for ${STORE_NAME}, a store of ready-to-use ` +
    `AI productivity tools. Your job is to PROVE a specific product works by showing it ` +
    `in action — a working demo, not a sales pitch and not a description of features.\n\n` +
    `Rules:\n` +
    `- ${play.brief}\n` +
    `- Be concrete and specific. Invent realistic details (names, numbers, content) so it ` +
    `feels like a real run, but never claim capabilities beyond what the product is.\n` +
    `- If the shopper's own task is genuinely a stretch for what this specific product format ` +
    `can do, say so plainly and specifically — name the exact limitation — rather than papering ` +
    `over the gap with generic filler. Give your best real attempt first, then the honest ` +
    `assessment. "Here's how far this gets, and here's what would close the rest" builds more ` +
    `trust than pretending a poor fit is a perfect one.\n` +
    `- ${lengthRule}\n` +
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
