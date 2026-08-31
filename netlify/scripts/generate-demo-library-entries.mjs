// Optional helper for extending netlify/lib/demo-library.mts to cover more SKUs.
//
// The library is hand-curated, plain data — there's no requirement to run
// this script at all. It exists for one specific case: if you'd rather
// generate a first draft for a batch of new/uncovered SKUs with your own
// Anthropic API key (so the one-time generation cost is yours to control,
// not Netlify's), this does that and prints TypeScript entries ready to
// paste into demo-library.mts.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node netlify/scripts/generate-demo-library-entries.mjs AI-PP-006 AI-AB-010
//
// (List the SKUs you want drafts for. Leave the list empty to generate for
// every SKU in the fallback catalog that ISN'T already in DEMO_LIBRARY.)
//
// This talks directly to api.anthropic.com — never to Netlify's AI Gateway —
// so it never touches Netlify credits, by design.

import Anthropic from '@anthropic-ai/sdk'
import { FALLBACK_CATALOG, CATEGORY_LABEL, NICHE_LABEL } from '../lib/catalog.mjs'
import { DEMO_LIBRARY } from '../lib/demo-library.mjs'

const PLAYBOOK = {
  prompts: 'Show ONE representative prompt from this pack, then run it live on a realistic, specific scenario and show the finished output the buyer would get.',
  automations: 'Walk through a single realistic run of this automation as an execution trace: the trigger that fired, each step it takes, and the concrete end result.',
  templates: 'Fill this template in with a realistic, fully worked example so the buyer sees exactly what a completed one looks like.',
  agents: 'Role-play this agent handling one representative task end to end: show the incoming request, then the agent\'s actual response/output in character.',
  connectors: 'Show this connector app in action: a realistic trigger or sync event on one side and the concrete result it produces on the other. Make it read like a real connection firing.',
}

const VERB = {
  prompts: 'Running a representative prompt from this pack',
  automations: 'Simulating one run of this automation',
  templates: 'Filling this template with a real example',
  agents: 'Putting this agent to work on a real task',
  connectors: 'Running a live sync through this connector',
}

async function generateOne(product) {
  const anthropic = new Anthropic() // uses ANTHROPIC_API_KEY from env directly
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5', // cheap and plenty good for a short static preview
    max_tokens: 400,
    system:
      `You write short "watch it work" demo previews for MULTINICHE AI, a store of ready-to-use AI ` +
      `productivity tools. ${PLAYBOOK[product.category]} Be concrete and specific — invent realistic ` +
      `details so it reads like a real run. 70-150 words. Plain text only, no markdown headers or code ` +
      `fences. Never greet the shopper, mention price, or tell them to buy.`,
    messages: [
      {
        role: 'user',
        content:
          `Demonstrate this product:\n- Name: ${product.name}\n- Type: ${CATEGORY_LABEL[product.category]}\n` +
          `- Built for: ${NICHE_LABEL[product.niche]}\n- Format: ${product.format}\n- Spec: ${product.spec}\n` +
          `- What it does: ${product.blurb}`,
      },
    ],
  })
  const text = message.content.find((b) => b.type === 'text')?.text ?? ''
  return text.trim()
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY first — this script talks to Anthropic directly, not Netlify.')
    process.exit(1)
  }

  const requested = process.argv.slice(2)
  const targets =
    requested.length > 0
      ? FALLBACK_CATALOG.filter((p) => requested.includes(p.sku))
      : FALLBACK_CATALOG.filter((p) => !Object.hasOwn(DEMO_LIBRARY, p.sku))

  if (targets.length === 0) {
    console.log('Nothing to generate — every requested SKU is already in DEMO_LIBRARY.')
    return
  }

  console.log(`Generating ${targets.length} entr${targets.length === 1 ? 'y' : 'ies'}...\n`)

  for (const product of targets) {
    const text = await generateOne(product)
    console.log(`  '${product.sku}': {`)
    console.log(`    verb: '${VERB[product.category]}',`)
    console.log(`    text:`)
    // Print as a plain string literal, ready to paste — wrap manually if long.
    console.log(`      ${JSON.stringify(text)},`)
    console.log(`  },\n`)
  }

  console.log('Review each one, then paste the entries you like into DEMO_LIBRARY in demo-library.mts.')
}

main().catch((err) => {
  console.error('generate-demo-library-entries failed:', err.message)
  process.exit(1)
})
