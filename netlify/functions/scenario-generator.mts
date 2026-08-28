// Scheduled function: writes a real, product-specific benchmark scenario for
// every product that only has the generic per-category default.
//
// The seed migrations gave every product in a category the exact same bland
// prompt (e.g. every "agents" product got "Handle one representative task
// end to end in character..."). That's why scorecards and the velocity
// engine's posts about them read as generic — the underlying test was never
// about that specific product. This writes a concrete, product-specific
// scenario instead: a realistic worked example that actually exercises what
// that product does.
//
// A product is "generic" if its only active scenario's prompt matches one of
// the four category templates verbatim. Once rewritten, its prompt is
// specific enough that it will never match a template again, so this is
// naturally idempotent — safe to run repeatedly (e.g. picking up new
// products) without regenerating scenarios that are already good.
//
// Runs weekly, well before scorecard-runner.mts's Sunday run, so newly
// specific scenarios get benchmarked on their first real pass rather than
// waiting a full extra week.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-8'
const BATCH_SIZE = 5 // keep each run's Anthropic + DB cost bounded

// The exact bland strings from the seed migration — a product whose active
// scenario prompt matches one of these verbatim has never been rewritten.
const GENERIC_TEMPLATES = new Set([
  'Run the primary prompt in this pack on a realistic, specific task for its target audience, and show the finished output.',
  'Walk through a single realistic run of this automation: the trigger, each step, and the concrete end result.',
  'Fill this template in with a realistic, fully worked example so the result is production-ready.',
  'Handle one representative task end to end in character, from an incoming request to a finished response.',
  'Demonstrate this product on a realistic task for its target audience.',
])

interface ProductRow {
  sku: string
  name: string
  category: string
  blurb: string
  spec: string
}
interface ScenarioRow {
  id: string
  sku: string
  prompt: string
  version: number
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

async function writeSpecificPrompt(p: ProductRow): Promise<string | null> {
  const anthropic = new Anthropic()
  const system =
    `You write ONE benchmark test scenario for an AI product sold on an AI-tools store. This scenario ` +
    `becomes the fixed, repeated test that product is benchmarked against every week — its whole job is to ` +
    `actually exercise what THIS SPECIFIC product does, with concrete, realistic, made-up specifics (names, ` +
    `numbers, dates, amounts) — never a generic instruction like "handle a representative task."\n\n` +
    `Bad (too generic, could apply to any product in the category): "Handle one representative task end to ` +
    `end in character, from an incoming request to a finished response."\n` +
    `Good (specific to a financial categorization product): "Categorize this list of 12 bank transactions ` +
    `into budget categories: '$47.32 STARBUCKS #4521', '$1,200.00 RENT PAYMENT', '$89.99 NETFLIX.COM', ... ` +
    `— assign each a category and flag anything that looks like a duplicate or an unusually large charge."\n\n` +
    `Write ONE scenario as a single paragraph, second person imperative ("Categorize this list...", "Draft a ` +
    `reply to this ticket..."), under 500 characters, with real invented specifics baked directly into the ` +
    `instruction so the exact same test runs identically every time. Return ONLY the scenario text — no ` +
    `preamble, no quotes, no markdown.`

  const userMsg =
    `Product: ${p.name}\n` +
    `Category: ${p.category}\n` +
    `Description: ${p.blurb}\n` +
    `Spec: ${p.spec}`

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: userMsg }],
    })
    const text = res.content.find((b) => b.type === 'text')?.text?.trim()
    if (!text || text.length < 20) return null
    return text.slice(0, 500)
  } catch (err) {
    console.error(`[scenario-generator] generation failed for ${p.sku}:`, (err as Error).message)
    return null
  }
}

export default async (_req: Request) => {
  const db = getDatabase()

  // Every product with an active scenario, so we can test each prompt
  // against GENERIC_TEMPLATES in JS rather than a fragile SQL IN-list.
  const rows = (await db.sql`
    SELECT p.sku, p.name, p.category, p.blurb, p.spec, s.id AS scenario_id, s.prompt, s.version
    FROM products p
    JOIN benchmark_scenarios s ON s.sku = p.sku AND s.active = true
  `) as (ProductRow & { scenario_id: string; prompt: string; version: number })[]

  const genericOnes = rows.filter((r) => GENERIC_TEMPLATES.has(r.prompt)).slice(0, BATCH_SIZE)

  if (!genericOnes.length) {
    console.log('[scenario-generator] no generic scenarios left to rewrite')
    return Response.json({ rewritten: 0 })
  }

  let rewritten = 0
  for (const r of genericOnes) {
    const newPrompt = await writeSpecificPrompt(r)
    if (!newPrompt) continue

    try {
      // Deactivate the generic v1 and insert a specific v2 — mirrors how a
      // real scenario edit is meant to be versioned (scorecard-runner.mts's
      // "changing the scenario bumps a version number" contract), so a v1
      // run and a v2 run are never blended in the same rolling stats.
      await db.sql`UPDATE benchmark_scenarios SET active = false WHERE id = ${r.scenario_id}`
      await db.sql`
        INSERT INTO benchmark_scenarios (id, sku, prompt, version, active)
        VALUES (${shortId()}, ${r.sku}, ${newPrompt}, ${r.version + 1}, true)
      `
      rewritten++
      console.log(`[scenario-generator] rewrote scenario for ${r.sku}`)
    } catch (err) {
      console.error(`[scenario-generator] failed to save scenario for ${r.sku}:`, (err as Error).message)
    }
  }

  return Response.json({ rewritten, attempted: genericOnes.length })
}

export const config: Config = {
  // Weekly, ahead of scorecard-runner.mts's Sunday 11:00 UTC run, so freshly
  // specific scenarios get benchmarked on their very first pass.
  schedule: '0 6 * * 0',
}
