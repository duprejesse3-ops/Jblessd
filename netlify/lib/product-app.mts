// Turns any catalog product into a runnable *web app* — an interactive form the
// buyer fills in, plus the prompt that makes the product actually do its job on
// what they typed.
//
// The store already ships two things per product: a static Markdown deliverable
// (deliverables.mts) and a free "watch it work" demo (demo.mts). This module is
// the third and most important: it lets the buyer *use* the product directly in
// the browser — no copy-pasting a prompt into another tool, no wiring up an
// automation, no filling a template by hand. They describe their situation in a
// short form and the product runs on it and hands back the finished result.
//
// Like deliverables.mts, everything is derived from product *metadata* alone, so
// a single implementation covers every seeded SKU and any product a user lists
// later — nothing has to be hand-authored per product.

import { CATEGORY_LABEL, NICHE_LABEL, type Product } from './catalog.mjs'

export interface AppField {
  id: string
  label: string
  type: 'text' | 'textarea'
  placeholder: string
  help?: string
  required?: boolean
}

export interface ProductApp {
  sku: string
  name: string
  /** Headline for the app panel, e.g. "Run the Deep Work prompt". */
  title: string
  /** One line explaining what the app produces for the buyer. */
  tagline: string
  /** Label for the run button, e.g. "Generate", "Ask the agent". */
  cta: string
  /** Short present-tense status shown while it runs, e.g. "generating". */
  runVerb: string
  fields: AppField[]
}

// A short, human topic for the product, derived from its name — same idea as
// deliverables.topicOf, kept local so the two modules stay independent.
function topicOf(product: Product): string {
  return (
    product.name
      .replace(
        /\b(pack|packs|kit|kits|template|templates|blueprint|blueprints|config|configs|agent|agents|bot|automation|autopilot|studio|library|playbook)\b/gi,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim() || product.name
  )
}

// ---- per-category form definitions -------------------------------------
//
// Each returns the interactive fields plus the framing copy. The fields are the
// smallest set that lets the product do something genuinely useful on the
// buyer's real input.

function promptApp(product: Product, topic: string): ProductApp {
  return {
    sku: product.sku,
    name: product.name,
    title: `Run the ${topic} prompt`,
    tagline: `Describe what you need and this runs the best prompt from the pack on it — you get the finished ${topic.toLowerCase()} output, not a prompt to paste elsewhere.`,
    cta: 'Generate',
    runVerb: 'generating',
    fields: [
      {
        id: 'goal',
        label: 'What do you want to produce?',
        type: 'textarea',
        placeholder: 'e.g. A tight weekly plan that protects two deep-work blocks a day',
        required: true,
      },
      {
        id: 'context',
        label: 'Your raw material and constraints',
        type: 'textarea',
        placeholder: 'Paste your notes, the current draft, the situation, deadlines — anything the output should be built from.',
        help: 'The more real detail you give, the more it feels made for you.',
      },
      {
        id: 'audience',
        label: 'Who is it for? (optional)',
        type: 'text',
        placeholder: 'e.g. my future self / a skeptical exec / a new teammate',
      },
    ],
  }
}

function automationApp(product: Product, topic: string): ProductApp {
  return {
    sku: product.sku,
    name: product.name,
    title: `Run the ${topic} automation`,
    tagline: `Paste one real input and this runs a single pass of the automation on it — the decision it would make and the action it would take, exactly as the live flow would.`,
    cta: 'Run one pass',
    runVerb: 'running',
    fields: [
      {
        id: 'input',
        label: 'One real input to react to',
        type: 'textarea',
        placeholder: 'Paste one email, row, message, or ticket the automation should handle.',
        required: true,
      },
      {
        id: 'rules',
        label: 'What should happen with it?',
        type: 'textarea',
        placeholder: 'List the categories or the decision you want — e.g. "sort into: urgent, FYI, later; draft a reply to urgent ones".',
        help: `Runs with ${product.spec && product.spec !== '—' ? product.spec : product.format}.`,
      },
    ],
  }
}

function templateApp(product: Product, topic: string): ProductApp {
  return {
    sku: product.sku,
    name: product.name,
    title: `Fill the ${topic} template`,
    tagline: `Give it the facts and this returns the template already filled in — a finished, ready-to-send document, not a blank to complete yourself.`,
    cta: 'Fill it in',
    runVerb: 'filling in',
    fields: [
      {
        id: 'subject',
        label: 'What is this document about?',
        type: 'text',
        placeholder: `e.g. Our Q3 ${topic.toLowerCase()}`,
        required: true,
      },
      {
        id: 'points',
        label: 'Key facts and points to include',
        type: 'textarea',
        placeholder: 'One per line — the numbers, decisions, names, and details it must contain.',
        required: true,
      },
      {
        id: 'audience',
        label: 'Who will read it? (optional)',
        type: 'text',
        placeholder: 'e.g. investors / the whole team / a new client',
      },
    ],
  }
}

function agentApp(product: Product, topic: string): ProductApp {
  return {
    sku: product.sku,
    name: product.name,
    title: `Put the ${topic} agent to work`,
    tagline: `Hand it a real task and the agent handles it in character — you get its actual response, produced by the configuration you bought.`,
    cta: 'Ask the agent',
    runVerb: 'working',
    fields: [
      {
        id: 'task',
        label: 'What do you need the agent to do?',
        type: 'textarea',
        placeholder: 'Give it the request in plain language — the thing you would hand a capable assistant.',
        required: true,
      },
      {
        id: 'context',
        label: 'Context it needs',
        type: 'textarea',
        placeholder: 'Paste the transcript, ticket, dataset, or background it should work from.',
        help: `Runs with ${product.spec && product.spec !== '—' ? product.spec : product.format}.`,
      },
    ],
  }
}

const APPS: Record<Product['category'], (p: Product, topic: string) => ProductApp> = {
  prompts: promptApp,
  automations: automationApp,
  templates: templateApp,
  agents: agentApp,
}

/** Build the interactive app definition for a product, from its metadata alone. */
export function buildProductApp(product: Product): ProductApp {
  const topic = topicOf(product)
  const make = APPS[product.category] ?? templateApp
  return make(product, topic)
}

// ---- the run prompt ----------------------------------------------------
//
// Given the app definition and the buyer's filled-in values, build the prompt
// that makes Claude *be* the product and produce the finished result. This is
// deliberately not a demo and not a pitch: the buyer paid for this, so the
// output is the real thing they can use as-is.

const RUN_BRIEF: Record<Product['category'], string> = {
  prompts:
    'Run the single most relevant prompt from this pack on the buyer\'s request and return the finished output they asked for — the actual draft/plan/answer, ready to use. Do not just show them a prompt to run elsewhere.',
  automations:
    'Execute one realistic pass of this automation on the input the buyer pasted: state the decision it reaches (category, confidence, whether a human is needed) and produce the concrete action — the drafted reply, the routing, the updated record — as the live flow would.',
  templates:
    'Return the template fully filled in with the buyer\'s facts — a finished, ready-to-send document. Keep the template\'s structure, but every section should contain real content, not brackets or guidance.',
  agents:
    'Act as this agent and handle the buyer\'s task end to end, in character, following the configuration\'s operating rules. Return the agent\'s actual response — the work product, not a description of what it would do.',
}

function summariseInputs(app: ProductApp, inputs: Record<string, string>): string {
  const lines: string[] = []
  for (const f of app.fields) {
    const v = (inputs?.[f.id] ?? '').trim()
    if (v) lines.push(`${f.label}\n${v}`)
  }
  return lines.join('\n\n')
}

/**
 * Build the system + user prompt for a real run of the product on the buyer's
 * inputs. Returns null if the buyer left every field blank so the caller can ask
 * for input instead of running an empty prompt.
 */
export function buildRunPrompt(
  product: Product,
  app: ProductApp,
  inputs: Record<string, string>,
): { system: string; user: string } | null {
  const filled = summariseInputs(app, inputs)
  if (!filled) return null

  const system =
    `You are the working engine behind "${product.name}", a ${CATEGORY_LABEL[product.category]} ` +
    `from MULTINICHE AI built for ${NICHE_LABEL[product.niche]}. A paying buyer is using it as an ` +
    `app: they have filled in a short form and you produce the finished result they can use immediately.\n\n` +
    `Rules:\n` +
    `- ${RUN_BRIEF[product.category]}\n` +
    `- Use everything the buyer gave you. If something important is missing, make one reasonable, ` +
    `clearly stated assumption and continue — do not stall by asking questions.\n` +
    `- Be concrete and genuinely useful. This is the paid product, not a teaser: deliver real, ` +
    `finished work they could act on right now.\n` +
    `- Return plain text with light structure (short labels ending in a colon, simple lists). No ` +
    `preamble, no sign-off, and never mention price, buying, or that this is a demo.`

  const user =
    `Product: ${product.name}\n` +
    `What it does: ${product.blurb}\n` +
    `Spec: ${product.spec}\n\n` +
    `The buyer's input:\n${filled}\n\n` +
    `Produce the finished result now.`

  return { system, user }
}
