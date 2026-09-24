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
import { DEMO_LIBRARY } from '../lib/demo-library.mjs'
import { SKU_RUN_BRIEF } from '../lib/product-app.mjs'

const MODEL = 'claude-opus-5' // the flagship — this is the store's showcase
const MAX_TOKENS_PREVIEW = 900 // the quick, cached, no-scenario demo
// A shopper's own submitted task gets real room to work through it. This
// matters most for genuinely hard scenarios (see "Stump the Agent" style
// challenges) — the old single 900-token cap cut off a real attempt at a hard
// task mid-thought, which reads as broken rather than as an honest limitation.
const MAX_TOKENS_SCENARIO_DEFAULT = 1700

// A few products' doctrines genuinely produce a longer response than most —
// $Odds Agent and MultiSignal both reason through multiple candidate
// explanations with citations, timing checks, and confidence levels before
// concluding, not a single short verdict; MultiCascade can run through an
// Architect, one or more Builders, a Critic, and a closing summary for a
// single goal. The flat 1700-token default was cutting these off mid-stream
// in the free demo (reported directly on both: "streamed but cut off," and
// a MultiCascade run ending right at "Cascade summary —" with nothing after
// it), not because anything was broken, just because the doctrine had more
// to honestly say than the ceiling allowed. Scoped to just these SKUs
// rather than raised for everyone, so the free demo's cost doesn't go up
// for the many simpler products that never needed the room.
const SKU_MAX_TOKENS_SCENARIO: Record<string, number> = {
  'AI-AG-112': 3000, // MultiCascade — can run Architect + multiple Builders + Critic + summary for a bigger goal
  'AI-AG-114': 2600, // $Odds Agent
  'AI-AG-115': 2600, // MultiSignal
}

// Custom-scenario demos are the one path here that always pays for fresh
// flagship inference — the default per-SKU demo is served from the Blobs cache,
// so it is effectively free and stays unmetered so any shopper can watch it.
// A unique scenario string defeats the cache by design, which without a ceiling
// makes this endpoint an open, unauthenticated way to spend the store's
// inference budget.
//
// Raised from 10 to 30/hour on 2026-09-23: real internal callers (the weekly
// scorecard sweep, the admin console's run_scorecard action) are supposed to
// bypass this entirely via INTERNAL_API_SECRET, but if that check ever
// doesn't match — wrong/missing header, secret unset — every such caller
// falls back to sharing ONE bucket keyed "unknown" (see checkRateLimit: no
// real IP on a server-to-server call), because they're all the same
// unidentifiable caller as far as this limiter can tell. That single shared
// bucket hitting 10/hour was trivial to exhaust from normal admin-console
// testing alone, well before any real shopper traffic. 30 is still a real
// ceiling against a scripted abuse loop, just not one a few minutes of
// legitimate testing trips by accident. If INTERNAL_API_SECRET is verified
// working, this limit only ever applies to genuine shopper/anonymous usage
// (including the product page's own "Run on my own situation"), where 30/hour
// per real IP is still generous, not permissive.
const CUSTOM_DEMO_LIMIT = 30
const CUSTOM_DEMO_WINDOW_MS = 60 * 60 * 1000
const STORE_NAME = 'MULTINICHE AI'
const CACHE_VERSION = 'v2' // bumped 2026-09-24: fixes the demo prompt inventing specific business names/reviewer names/ratings for AI-AB-071's GBP review-response section (and the same generic-vs-SKU-brief conflict for every other strict SKU_RUN_BRIEF product) — old cached demos must not keep serving the fabricated output

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
// liveContext, when present, is real fetched-and-parsed data (currently only
// for AI-AB-071 — see runSeoAudit) that grounds the demo in an actual scan
// instead of an invented one. When present, the system prompt gets an extra
// rule forbidding invented specifics about the scanned page. fixPack, when
// present, is the deterministic (no model involved) set of ready-to-paste
// fixes generated straight from that same real scan — see buildFixPack.
function buildPrompt(
  p: Product,
  scenario: string,
  liveContext?: string,
  fixPack?: string,
): { system: string; user: string } {
  const play = PLAYBOOK[p.category]
  const lengthRule = scenario
    ? 'Give this real, submitted task room to breathe: roughly 250–450 words — enough to actually work through it, not just gesture at it.'
    : 'Keep it tight: roughly 150–260 words. This renders in a small terminal panel.'
  const liveContextRule = liveContext
    ? `- A "Live scan" section is provided below, fetched and parsed from a real page moments before this ran. Treat it as ground truth for anything about that specific page — title, meta description, schema, headings, images, etc. Never invent, guess, or contradict a specific fact about that page beyond what the live scan states; if the live scan says something is missing, say it's missing, and if it says something is present, quote or describe what was actually found. For anything the live scan explicitly says was NOT checked (e.g. Google Business Profile, competitor listings), explain that part of the product conceptually without inventing specific numbers or findings for it.\n`
    : ''
  const fixPackRule = fixPack
    ? `- A "Fix pack" section is provided below — ready-to-paste code generated deterministically by code, not by you, straight from the live scan's real findings. Reproduce its content faithfully (the tags, the JSON-LD, the exact suggested copy) rather than paraphrasing or rewriting it into your own version, then explain in your own words what each fix does and why it matters. If a section says a fix isn't needed, or explains why one was skipped (e.g. no business name/city given), say that plainly rather than inventing a fix anyway.\n`
    : ''
  const system =
    `You are the live demonstration engine for ${STORE_NAME}, a store of ready-to-use ` +
    `AI productivity tools. Your job is to PROVE a specific product works by showing it ` +
    `in action — a working demo, not a sales pitch and not a description of features.\n\n` +
    `Rules:\n` +
    `- ${SKU_RUN_BRIEF[p.sku] ?? play.brief}\n` +
    liveContextRule +
    fixPackRule +
    (SKU_RUN_BRIEF[p.sku]
      ? `- The rule above is this product's own brief and already states exactly what may and ` +
        `may not be invented for it (a live scan's real page facts, specific business names, ` +
        `review counts, ratings, quoted reviewer text, etc.). That governs completely — where it ` +
        `restricts or forbids inventing a specific detail, that restriction wins over any general ` +
        `instinct to "make it feel real." Never claim capabilities beyond what the product is.\n`
      : `- Be concrete and specific. Invent realistic details (names, numbers, content) so it ` +
        `feels like a real run, but never claim capabilities beyond what the product is` +
        (liveContext ? ', and never invent details about a real page covered by the Live scan section below — use what it actually found' : '') +
        `.\n`) +
    `- If the shopper's own task is genuinely a stretch for what this specific product format ` +
    `can do, say so plainly and specifically — name the exact limitation — rather than papering ` +
    `over the gap with generic filler. Give your best real attempt first, then the honest ` +
    `assessment. "Here's how far this gets, and here's what would close the rest" builds more ` +
    `trust than pretending a poor fit is a perfect one.\n` +
    `- When you name a limitation, do not also invent a specific technical workaround for it ` +
    `unless you are certain it actually works as described. A plausible-sounding but wrong claim ` +
    `about how a third-party service behaves (what a sync tool actually writes to disk, what an ` +
    `export produces, etc.) is worse than naming the limitation and stopping there — confidently ` +
    `wrong is a bigger trust problem than incomplete. If you don't know a workaround holds up, ` +
    `just state the limitation.\n` +
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
    (liveContext ? `\nLive scan (real, fetched just now):\n"""${liveContext}"""\n` : '') +
    (fixPack ? `\nFix pack (generated deterministically, not by you):\n"""${fixPack}"""\n` : '') +
    (scenario
      ? `\nTailor the demonstration to this shopper's own situation:\n"""${scenario}"""\n`
      : liveContext
        ? `\nNo scenario was given, so this is the default demo: it just scanned ${STORE_NAME}'s own homepage for real (see the Live scan section above) — walk through what that scan actually found as the worked example, exactly as you would for a shopper's own page.\n`
        : `\nUse a realistic scenario a typical ${NICHE_LABEL[p.niche]} shopper would relate to.\n`)

  return { system, user }
}

export default async (req: Request, context: Context) => {
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

  // Only the uncacheable, always-fresh path is metered — see CUSTOM_DEMO_LIMIT.
  const internalSecret = process.env.INTERNAL_API_SECRET
  const isInternalCaller = Boolean(internalSecret) && req.headers.get('x-internal-secret') === internalSecret

  // The shopper-abuse limiter below exists to stop a script from scripting
  // unlimited custom demos through a real browser/IP. It was never meant to
  // apply to our own scorecard-runner, which legitimately needs to run many
  // more than 10 fixed, versioned scenarios per hour — trusted internal
  // callers (verified via a shared secret only they know) skip it entirely.
  if (scenario && !isInternalCaller) {
    const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
    const limit = await checkRateLimit('demo-custom', ip, {
      limit: CUSTOM_DEMO_LIMIT,
      windowMs: CUSTOM_DEMO_WINDOW_MS,
    })
    if (!limit.allowed) {
      return tooManyRequests(
        limit.retryAfterSec,
        'You have run a lot of tailored demos in the last hour. The standard demo for any product is still available — or try a tailored run again shortly.',
      )
    }
  }

  const { products } = await loadCatalog()
  const product = products.find((p) => p.sku === sku)
  if (!product) return Response.json({ error: 'No product with that SKU.' }, { status: 404 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      // Free tier, checked first: a hand-written demo costs nothing to serve,
      // no matter how much traffic it gets — no Blobs read, no model call.
      // Only the default (no-scenario) view can use it; a shopper's own
      // scenario is inherently something no static text can answer.
      const libraryEntry = scenario.length === 0 ? DEMO_LIBRARY[product.sku] : undefined
      if (libraryEntry) {
        send({ type: 'meta', verb: libraryEntry.verb, cached: true })
        for (const piece of libraryEntry.text.match(/[\s\S]{1,24}/g) ?? [libraryEntry.text]) {
          send({ type: 'text', text: piece })
        }
        send({ type: 'done' })
        controller.close()
        return
      }

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

      // Local SEO Agency Blueprint only: run a real live scan every time — of
      // the shopper's own page when they gave one, or of MULTINICHE AI's own
      // homepage for the default (no-scenario) demo, so even the free,
      // cached default view is grounded in an actual scan instead of an
      // invented one. From the same real findings, also generate a
      // deterministic (no model call — see buildFixPack) fix pack, so the
      // demo can show the product actually fixing what it finds, not just
      // diagnosing it. See seo-live-context.mts for what's checked, its
      // stated scope, and how the fix pack is built.
      let liveContext: string | undefined
      let fixPack: string | undefined
      if (product.sku === 'AI-AB-071') {
        try {
          const { runSeoAudit, buildFixPack } = await import('../lib/seo-live-context.mjs')
          const audit = await runSeoAudit(scenario || 'https://multinicheai.com')
          liveContext = audit.message
          if (audit.ok && audit.findings) {
            fixPack = buildFixPack(audit.findings, {})
          }
        } catch (err) {
          console.error('seo live context fetch failed:', (err as Error).message)
          liveContext = 'Live page scan failed to run this time — explain the blueprint conceptually without inventing specific findings for the buyer\'s page.'
        }
      }

      let full = ''
      try {
        const anthropic = new Anthropic()
        const { system, user } = buildPrompt(product, scenario, liveContext, fixPack)
        const modelStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: scenario ? (SKU_MAX_TOKENS_SCENARIO[product.sku] ?? MAX_TOKENS_SCENARIO_DEFAULT) : MAX_TOKENS_PREVIEW,
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
