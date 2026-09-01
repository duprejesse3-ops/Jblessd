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
import { SITE_AUDIT_SOURCE } from './site-audit-source.mjs'
import { MULTICONNECT_WEBHOOK_BRIDGE_SOURCE } from './multiconnect-webhook-bridge-source.mjs'
import { MULTICONNECT_SHOPIFY_SOURCE } from './multiconnect-shopify-source.mjs'
import { MULTICONNECT_SHEETS_AIRTABLE_SOURCE } from './multiconnect-sheets-airtable-source.mjs'
import { MULTICONNECT_EMAIL_CRM_SOURCE } from './multiconnect-email-crm-source.mjs'
import { MULTICONNECT_SLACK_DISCORD_SOURCE } from './multiconnect-slack-discord-source.mjs'
import { MULTIWITNESS_SOURCE } from './multiwitness-source.mjs'

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

// ---- per-SKU deliverables ------------------------------------------------
//
// The generators above work from metadata alone, which is right for a document
// product: the buyer wants prompts or a template, and those can be composed from
// what the listing already says.
//
// A source-code product cannot work that way. Nothing derivable from a name and
// a blurb is runnable software, so these SKUs ship their real files instead.
// Anything listed here bypasses both the category generator and the AI rewrite
// (see ai-deliverable.mts) — a model must never paraphrase code a customer paid
// for.

/** The language tag for a fenced block, by file extension. */
function fenceLanguage(path: string): string {
  if (path.endsWith('.mjs') || path.endsWith('.js')) return 'js'
  if (path.endsWith('.mts') || path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml'
  if (path.endsWith('.sh')) return 'sh'
  if (path.endsWith('.md')) return 'markdown'
  return ''
}

/**
 * A fence long enough to survive the file's own contents. The README contains
 * triple-backtick blocks, so wrapping it in three backticks would terminate the
 * block early and shred the rest of the document.
 */
function fenceFor(contents: string): string {
  let longest = 0
  for (const run of contents.match(/`+/g) ?? []) longest = Math.max(longest, run.length)
  return '`'.repeat(Math.max(3, longest + 1))
}

function siteAuditSections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip site-audit-agent.zip\n` +
        `    cd site-audit-agent\n` +
        `    ./install.sh\n\n` +
        `That puts a \`site-audit\` command on your PATH and runs it once to prove the ` +
        `install worked. Nothing is downloaded, compiled, or fetched from a registry — the ` +
        `whole tool is the files in the archive. Uninstalling is \`rm -rf\` on two paths, ` +
        `printed at the end of the install.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`site-audit-agent\` and save each block to the path in its heading, ` +
        `keeping the folder structure. Nothing is missing and nothing is minified.\n\n` +
        `Either way there is no npm install, no build step, no API key, and no account. The ` +
        `only requirement is Node 18 or newer (\`node --version\` to check). Skipping the ` +
        `installer is fine too:\n\n` +
        `    node bin/audit.mjs yoursite.com\n\n` +
        `Verify it works on your machine before you trust it with your site:\n\n` +
        `    npm test\n\n` +
        `Start with README.md — it covers every option, all sixteen checks, and how to put ` +
        `it on a schedule with GitHub Actions, cron, systemd, or a serverless function.`,
    },
    {
      title: 'Files in this package',
      body: SITE_AUDIT_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of SITE_AUDIT_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

function webhookBridgeSections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip multiconnect-webhook-bridge.zip\n` +
        `    cd multiconnect-webhook-bridge\n` +
        `    ./install.sh\n\n` +
        `(On Windows, run \`install.ps1\` in PowerShell instead.) That starts the bridge and ` +
        `prints a dashboard URL and a local auth token — open the URL, paste the token, and ` +
        `you're in. Nothing is downloaded, compiled, or fetched from a registry — the whole ` +
        `tool is the files in the archive.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`multiconnect-webhook-bridge\` and save each block to the path in ` +
        `its heading, keeping the folder structure. Nothing is missing and nothing is minified.\n\n` +
        `Either way there is no npm install, no build step, and no account — just Node 18 or ` +
        `newer (\`node --version\` to check). Skipping the installer is fine too:\n\n` +
        `    node bin/bridge.mjs start\n\n` +
        `Verify it works on your machine before you connect it to anything real:\n\n` +
        `    npm test\n\n` +
        `Start with README.md — it covers connecting Zapier or Make, mapping fields both ` +
        `directions, and running it in the background with \`adapters/windows-task.ps1\` or ` +
        `\`adapters/systemd.service\` instead of a foreground terminal.`,
    },
    {
      title: 'Files in this package',
      body: MULTICONNECT_WEBHOOK_BRIDGE_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of MULTICONNECT_WEBHOOK_BRIDGE_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

function shopifySections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip multiconnect-shopify.zip\n` +
        `    cd multiconnect-shopify\n` +
        `    ./install.sh\n\n` +
        `(On Windows, run \`install.ps1\` in PowerShell instead.) That starts the connector ` +
        `and prints a dashboard URL and a local auth token — open the URL, paste the token, ` +
        `and connect your store. It starts in read-only safe mode by default; nothing can ` +
        `write to your store until you deliberately switch that in the dashboard.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`multiconnect-shopify\` and save each block to the path in its ` +
        `heading, keeping the folder structure. Nothing is missing and nothing is minified.\n\n` +
        `Either way there is no npm install, no build step, and no account beyond your own ` +
        `Shopify store — just Node 18 or newer (\`node --version\` to check). Skipping the ` +
        `installer is fine too:\n\n` +
        `    node bin/shopify-connect.mjs start\n\n` +
        `Verify it works on your machine before you connect it to anything real:\n\n` +
        `    npm test\n\n` +
        `Start with README.md — it walks through creating your Shopify Admin API app, the ` +
        `exact scopes to grant, and wiring up the order/inventory webhooks.`,
    },
    {
      title: 'Files in this package',
      body: MULTICONNECT_SHOPIFY_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of MULTICONNECT_SHOPIFY_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

function sheetsAirtableSections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip multiconnect-sheets-airtable.zip\n` +
        `    cd multiconnect-sheets-airtable\n` +
        `    ./install.sh\n\n` +
        `(On Windows, run \`install.ps1\` in PowerShell instead.) That starts the connector ` +
        `and prints a dashboard URL and a local auth token — open the URL, paste the token, ` +
        `and connect Google Sheets and/or Airtable. It starts in read-only safe mode by ` +
        `default; nothing can write to your sheet or base until you deliberately switch ` +
        `that in the dashboard.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`multiconnect-sheets-airtable\` and save each block to the path in ` +
        `its heading, keeping the folder structure. Nothing is missing and nothing is ` +
        `minified.\n\n` +
        `Either way there is no npm install, no build step — just Node 18 or newer ` +
        `(\`node --version\` to check). Skipping the installer is fine too:\n\n` +
        `    node bin/sheets-connect.mjs start\n\n` +
        `Verify it works on your machine before you connect it to anything real:\n\n` +
        `    npm test\n\n` +
        `Start with README.md — it walks through creating a Google service account and ` +
        `sharing your sheet with it, and generating an Airtable personal access token.`,
    },
    {
      title: 'Files in this package',
      body: MULTICONNECT_SHEETS_AIRTABLE_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of MULTICONNECT_SHEETS_AIRTABLE_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

function emailCrmSections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip multiconnect-email-crm.zip\n` +
        `    cd multiconnect-email-crm\n` +
        `    ./install.sh\n\n` +
        `(On Windows, run \`install.ps1\` in PowerShell instead.) That starts the connector ` +
        `and prints a dashboard URL, a local auth token, and your inbound webhook URL. It ` +
        `starts in read-only safe mode by default: your agent can draft emails, but nothing ` +
        `sends until you personally click "Approve & send" in the dashboard with safe mode ` +
        `switched to read/write.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`multiconnect-email-crm\` and save each block to the path in its ` +
        `heading, keeping the folder structure. Nothing is missing and nothing is minified.\n\n` +
        `Either way there is no npm install, no build step — just Node 18 or newer ` +
        `(\`node --version\` to check). Skipping the installer is fine too:\n\n` +
        `    node bin/email-connect.mjs start\n\n` +
        `Verify it works on your machine before you connect it to a real mailbox:\n\n` +
        `    npm test\n\n` +
        `Start with README.md — it walks through getting an SMTP app password from Gmail ` +
        `or your provider, and how the approval queue and send limit work.`,
    },
    {
      title: 'Files in this package',
      body: MULTICONNECT_EMAIL_CRM_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of MULTICONNECT_EMAIL_CRM_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

function slackDiscordSections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip multiconnect-slack-discord.zip\n` +
        `    cd multiconnect-slack-discord\n` +
        `    ./install.sh\n\n` +
        `(On Windows, run \`install.ps1\` in PowerShell instead.) That starts the connector ` +
        `and prints a dashboard URL, a local auth token, and both the Slack request URL and ` +
        `the Discord interactions URL. It starts in read-only safe mode by default: slash ` +
        `commands are received and logged, but nothing posts to a real channel until you ` +
        `switch to read/write in the dashboard.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`multiconnect-slack-discord\` and save each block to the path in ` +
        `its heading, keeping the folder structure. Nothing is missing and nothing is ` +
        `minified.\n\n` +
        `Either way there is no npm install, no build step — just Node 18 or newer ` +
        `(\`node --version\` to check). Skipping the installer is fine too:\n\n` +
        `    node bin/messaging-connect.mjs start\n\n` +
        `Verify it works on your machine before you connect it to a real workspace or ` +
        `server:\n\n` +
        `    npm test\n\n` +
        `Start with README.md — it walks through creating a Slack app and a Discord ` +
        `application, and wiring up your first route.`,
    },
    {
      title: 'Files in this package',
      body: MULTICONNECT_SLACK_DISCORD_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of MULTICONNECT_SLACK_DISCORD_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

function witnessSections(product: Product): DeliverableSection[] {
  const sections: DeliverableSection[] = [
    {
      title: 'What you bought, and how to install it',
      body:
        `${product.blurb}\n\n` +
        `The fastest way in is the .zip on your order page — download it, then:\n\n` +
        `    unzip multiwitness.zip\n` +
        `    cd multiwitness\n` +
        `    ./install.sh\n\n` +
        `(On Windows, run \`install.ps1\` in PowerShell instead.) That starts MultiWitness ` +
        `and prints a dashboard token (for you) and a separate ingest token (to give to any ` +
        `other tool you want logging events here). The ingest token can only ever append a ` +
        `new event — there is no update or delete route for it to misuse even if it leaks.\n\n` +
        `This document is your permanent fallback copy. Every file is reproduced in full ` +
        `below, so if you ever lose the archive you can rebuild the package by hand: create ` +
        `a folder called \`multiwitness\` and save each block to the path in its heading, ` +
        `keeping the folder structure. Nothing is missing and nothing is minified.\n\n` +
        `Either way there is no npm install, no build step, no database — the log is a ` +
        `plain JSON Lines file. Just Node 18 or newer (\`node --version\` to check). ` +
        `Skipping the installer is fine too:\n\n` +
        `    node bin/witness.mjs start\n\n` +
        `Verify it works on your machine, including the standalone verify command that ` +
        `needs no server running:\n\n` +
        `    npm test\n` +
        `    node bin/witness.mjs verify\n\n` +
        `Start with README.md — it covers logging your first event and what the hash chain ` +
        `actually protects against.`,
    },
    {
      title: 'Files in this package',
      body: MULTIWITNESS_SOURCE.map((file) => `- \`${file.path}\``).join('\n'),
    },
  ]

  for (const file of MULTIWITNESS_SOURCE) {
    const fence = fenceFor(file.contents)
    sections.push({
      title: file.path,
      body: `${fence}${fenceLanguage(file.path)}\n${file.contents}\n${fence}`,
    })
  }

  return sections
}

const SKU_DELIVERABLES: Record<string, (p: Product) => Deliverable> = {
  'AI-AG-065': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a portable website audit agent — sixteen checks, three ' +
      'schedulers, zero dependencies. Yours to run on unlimited sites you own, forever. ' +
      'See LICENSE.md at the end for the terms.',
    sections: siteAuditSections(product),
  }),
  'AI-CN-001': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a local Zapier/Make webhook bridge — a dashboard for ' +
      'connecting, mapping fields, and watching traffic live, zero dependencies. Yours to ' +
      'run on unlimited machines and agents you own, forever. See LICENSE.md at the end for ' +
      'the terms.',
    sections: webhookBridgeSections(product),
  }),
  'AI-CN-002': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a local Shopify connector — a dashboard for connecting your ' +
      'store, watching orders and inventory live, and a safe-mode switch that keeps writes ' +
      'off until you turn them on, zero dependencies. Yours to run on unlimited stores you ' +
      'own, forever. See LICENSE.md at the end for the terms.',
    sections: shopifySections(product),
  }),
  'AI-CN-003': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a local Sheets/Airtable connector — a dashboard for ' +
      'connecting both platforms, mapping fields both directions, and a safe-mode switch ' +
      'that keeps writes off until you turn them on, zero dependencies. Yours to run on ' +
      'unlimited sheets and bases you own, forever. See LICENSE.md at the end for the terms.',
    sections: sheetsAirtableSections(product),
  }),
  'AI-CN-004': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a local Email/CRM connector — an approval queue so nothing ' +
      'sends without you, SMTP implemented directly with zero dependencies, and a built-in ' +
      'contact list. Yours to run on unlimited mailboxes you own, forever. See LICENSE.md ' +
      'at the end for the terms.',
    sections: emailCrmSections(product),
  }),
  'AI-CN-005': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a local Slack/Discord connector — named routes to any ' +
      'channel, HMAC and Ed25519 signature verification implemented directly, and a ' +
      'safe-mode switch that keeps posts off until you turn them on, zero dependencies. ' +
      'Yours to run on unlimited workspaces and servers you own, forever. See LICENSE.md ' +
      'at the end for the terms.',
    sections: slackDiscordSections(product),
  }),
  'AI-CN-006': (product) => ({
    sku: product.sku,
    name: product.name,
    format: product.format,
    spec: product.spec,
    intro:
      'The complete source for a tamper-evident, hash-chained action log — a SHA-256 ' +
      'chain any of your tools can log into, verifiable offline with no server required, ' +
      'zero dependencies. Yours to run on unlimited machines, forever. See LICENSE.md at ' +
      'the end for the terms.',
    sections: witnessSections(product),
  }),
}

/** True when a SKU ships hand-authored content that must not be regenerated. */
export function hasAuthoredDeliverable(sku: string): boolean {
  return Object.hasOwn(SKU_DELIVERABLES, sku)
}

/**
 * Build the real deliverable for a product — the actual content the buyer paid
 * for, generated from the product's own metadata so it's specific to what they
 * bought and works for any SKU, seeded or user-listed.
 */
export function buildDeliverable(product: Product): Deliverable {
  // A SKU with hand-authored content (source code, for instance) ships that
  // content verbatim rather than anything generated from its metadata.
  const authored = SKU_DELIVERABLES[product.sku]
  if (authored) return authored(product)

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
