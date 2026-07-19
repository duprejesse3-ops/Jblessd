// Turns any catalog product into the *actual* thing the buyer paid for.
//
// Until now the catalog only described products (name, blurb, spec) — there was
// no real file behind a purchase, so the Stripe webhook promised "instant
// digital delivery" and delivered nothing. This module fixes that at the
// source: given a product record it produces a genuinely useful, ready-to-use
// deliverable (real prompts / a real blueprint / a real template / a real agent
// config) plus a self-contained Markdown document, exactly the way
// `free-pack.mts` backs the free lead magnet. Both the instant on-page download
// (/api/order) and the order email are built from this one function, so a buyer
// always receives the same real content on every channel.
//
// It works from product *metadata* alone, so it covers the seeded catalog and
// any product a user lists later — nothing has to be hand-authored per SKU.

import type { Product } from './catalog.mjs'

export interface DeliverableSection {
  title: string
  body: string
}

export interface Deliverable {
  sku: string
  name: string
  format: string
  spec: string
  intro: string
  sections: DeliverableSection[]
}

// A short, human topic for the product, derived from its name. Used to make the
// generated content specific to what the buyer actually bought instead of
// generic filler.
function topicOf(product: Product): string {
  return product.name
    .replace(/\b(pack|packs|kit|kits|template|templates|blueprint|blueprints|config|configs|agent|agents|bot|automation|autopilot|studio|library|playbook)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || product.name
}

// ---- category-specific generators --------------------------------------

// Prompt packs: real, reusable meta-prompts framed around the pack's topic.
// Each is a genuinely usable template with brackets to fill in — the same shape
// as the free Deep Work pack, but pointed at whatever this pack is about.
function promptSections(product: Product, topic: string): DeliverableSection[] {
  return [
    {
      title: 'Draft it from scratch',
      body:
        `Act as a world-class specialist in ${topic}. I need to produce:\n` +
        `[describe the exact output you want]\n\n` +
        `Here is my raw input and any constraints:\n[paste context, audience, tone, deadline]\n\n` +
        `Produce a strong first draft, then list the 3 highest-leverage changes that would make it noticeably better and why.`,
    },
    {
      title: 'Critique and upgrade what I have',
      body:
        `Here is my current work on ${topic}:\n[paste your draft]\n\n` +
        `Review it like a demanding expert who wants me to win. Score it 1–5 on clarity, completeness, and impact with one line each, name the single biggest weakness, then return a tightened, ready-to-use revision.`,
    },
    {
      title: 'Pressure-test for edge cases',
      body:
        `I am about to ship this ${topic} decision/output:\n[describe it]\n\n` +
        `Play devil's advocate. List the top 5 ways this fails, breaks, or gets misread in the real world — ordered by likelihood — and give me a one-line safeguard for each.`,
    },
    {
      title: 'Turn it into a repeatable checklist',
      body:
        `Based on everything about ${topic} above, distill a reusable checklist I can run every time without thinking. ` +
        `Keep it to 7 steps max, each a single imperative line, ordered so skipping one is obvious.`,
    },
    {
      title: 'Adapt it for a specific audience',
      body:
        `Take this ${topic} content:\n[paste it]\n\n` +
        `Rewrite it for [audience — e.g. a skeptical exec / a new hire / a customer]. Match their vocabulary and what they care about, cut anything they won't act on, and keep it under [word count].`,
    },
    {
      title: 'Explain it so I actually understand it',
      body:
        `Teach me ${topic} the way a great mentor would. Start with the one idea that unlocks everything else, give me a concrete worked example, then quiz me with 3 questions that reveal whether I really get it.`,
    },
  ]
}

// Automation blueprints: a real, buildable flow — overview, trigger, numbered
// steps, the concrete tools (pulled from the product's spec), and a test pass.
function automationSections(product: Product, topic: string): DeliverableSection[] {
  const tools = product.spec && product.spec !== '—' ? product.spec : product.format
  return [
    {
      title: 'What this automation does',
      body:
        `${product.blurb}\n\n` +
        `Goal: remove the manual work in ${topic} so it runs on its own and only asks for a human when it genuinely needs one.`,
    },
    {
      title: 'Before you build (prerequisites)',
      body:
        `Tools / accounts: ${tools}.\n` +
        `Have ready: access to each account above, and one real example of the input this should react to (an email, a row, a message) so you can test against something true.`,
    },
    {
      title: 'The flow, step by step',
      body:
        `1. Trigger — start the scenario when [the event happens: new email / new row / new message].\n` +
        `2. Filter — only continue if [condition that matters], so you don't act on noise.\n` +
        `3. Enrich — pull in the extra context you need (look up the record, fetch the thread).\n` +
        `4. Decide — branch on [the key signal] into the handful of cases you actually have.\n` +
        `5. Act — do the useful thing (draft, sort, notify, update the system of record).\n` +
        `6. Escalate — if confidence is low or the case is unusual, route it to a human with a one-line summary instead of guessing.`,
    },
    {
      title: 'Copy-paste logic prompt',
      body:
        `Use this inside the "Decide" step (any LLM):\n\n` +
        `You are the routing brain for a ${topic} automation. Given this input:\n[[input]]\n\n` +
        `Return JSON: { "category": one of [list yours], "confidence": 0-1, "action": what to do, "needs_human": true/false, "reason": one line }.`,
    },
    {
      title: 'Test and go live',
      body:
        `Run it once against your real example and confirm every branch does what you expect. ` +
        `Then let it run in "notify only" mode for a day (it proposes actions but a human confirms), and only after it's right two days running should you let it act automatically.`,
    },
  ]
}

// Doc templates: an actual fill-in-the-blanks document with real sections.
function templateSections(product: Product, topic: string): DeliverableSection[] {
  return [
    {
      title: 'How to use this template',
      body:
        `${product.blurb}\n\n` +
        `Duplicate the sections below, fill every [bracket], and delete any guidance in italics. Keep it living — update it whenever reality changes.`,
    },
    {
      title: 'Header',
      body:
        `Title: [${topic} — name it]\n` +
        `Owner: [who is accountable]\n` +
        `Date / version: [today · v1]\n` +
        `Status: [draft / in review / final]`,
    },
    {
      title: 'Context',
      body:
        `Why this exists: [the problem or decision in 1–2 sentences]\n` +
        `Who it's for: [the reader and what they need from it]\n` +
        `What "done" looks like: [the outcome you're driving toward]`,
    },
    {
      title: 'Body',
      body:
        `The core content of your ${topic}. Break it into 3–5 short sections, each with a bold one-line takeaway on top so a busy reader gets the point without reading the detail. Use lists over paragraphs wherever you can.`,
    },
    {
      title: 'Decisions and next steps',
      body:
        `Decisions made: [what was decided and by whom]\n` +
        `Open questions: [what's still unresolved]\n` +
        `Next actions: [owner — action — due date], one line each.`,
    },
  ]
}

// Agent configs: a real, drop-in system prompt plus the operating config.
function agentSections(product: Product, topic: string): DeliverableSection[] {
  return [
    {
      title: 'What this agent is for',
      body:
        `${product.blurb}\n\n` +
        `Runs with: ${product.spec && product.spec !== '—' ? product.spec : product.format}.`,
    },
    {
      title: 'System prompt (paste this in)',
      body:
        `You are a focused ${topic} agent. Your job is to [the one outcome you own].\n\n` +
        `Operating rules:\n` +
        `- Work from what you're given; if a critical detail is missing, ask one sharp question instead of guessing.\n` +
        `- Be specific and concrete. No hedging, no filler, no restating the task back to me.\n` +
        `- Prefer the smallest correct action over the most impressive one.\n` +
        `- When you're unsure or the stakes are high, say so and hand off to a human with a one-line summary.\n\n` +
        `Always respond in this shape:\n` +
        `1. One-line read of the situation.\n` +
        `2. The action or answer.\n` +
        `3. What you'd check next (or what you need from me).`,
    },
    {
      title: 'Inputs and outputs',
      body:
        `Give it: [the input — a transcript / ticket / alert / dataset].\n` +
        `Expect back: [the output — decisions, a draft reply, a triage, a summary].\n` +
        `Keep a real example of each on hand so you can tell instantly when it drifts.`,
    },
    {
      title: 'Guardrails',
      body:
        `- Never [the thing it must not do — send externally without review / delete data / promise pricing].\n` +
        `- Escalate to a human when [the condition — low confidence / sensitive account / repeated failure].\n` +
        `- Log every action so you can audit and improve it.`,
    },
    {
      title: 'Tune it in a week',
      body:
        `Run it on 10 real cases, note every miss, and fold each miss into the system prompt as a new rule or example. ` +
        `Two rounds of that is usually the difference between a demo and something you trust.`,
    },
  ]
}

const GENERATORS: Record<Product['category'], (p: Product, topic: string) => DeliverableSection[]> = {
  prompts: promptSections,
  automations: automationSections,
  templates: templateSections,
  agents: agentSections,
}

const INTRO: Record<Product['category'], (topic: string) => string> = {
  prompts: (t) => `Ready-to-run prompts for ${t}. Paste any one into Claude, ChatGPT, or Gemini and fill in the brackets.`,
  automations: (t) => `A build-ready blueprint for automating ${t}. Follow the steps in your automation tool of choice.`,
  templates: (t) => `A fill-in-the-blanks template for ${t}. Copy it, replace every bracket, and you're done.`,
  agents: (t) => `A drop-in agent configuration for ${t}. Paste the system prompt into your model and wire up the inputs.`,
}

/**
 * Build the real deliverable for a product — the actual content the buyer paid
 * for, generated from the product's own metadata so it's specific to what they
 * bought and works for any SKU, seeded or user-listed.
 */
export function buildDeliverable(product: Product): Deliverable {
  const topic = topicOf(product)
  const generate = GENERATORS[product.category] ?? templateSections
  const intro = (INTRO[product.category] ?? INTRO.templates)(topic)
  return {
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro,
    sections: generate(product, topic),
  }
}

/** Render one deliverable as a self-contained Markdown document for download. */
export function deliverableToMarkdown(d: Deliverable): string {
  const lines: string[] = [`# ${d.name}`, '']
  if (d.format) lines.push(`*${d.format}*`, '')
  lines.push(d.intro, '')
  d.sections.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.title}`, '', s.body, '')
  })
  lines.push('---', '', `SKU ${d.sku} · From MULTINICHE AI — jblessd.com`)
  return lines.join('\n')
}

/** Slug used for the downloaded filename. */
export function deliverableSlug(d: Deliverable): string {
  return (d.sku || d.name || 'deliverable').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
