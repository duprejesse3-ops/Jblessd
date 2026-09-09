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

// ---- per-SKU overrides -------------------------------------------------
//
// Almost every product is content, and the category form above describes it
// exactly. A product that ships *software* does not fit: the generic agent app
// offers to answer a task "in character", which would be a straightforwardly
// false description of a Node CLI the buyer installs and schedules themselves.
//
// So AI-AG-065 gets its own form. It deliberately does not run a live audit from
// here — the buyer bought the auditor to run on their own infrastructure, and
// crawling their site on our metered host would recreate the exact recurring
// cost the product exists to avoid. What it does instead is the part that
// genuinely needs judgement: turn their stack into a concrete install-and-
// schedule plan and tell them which of the sixteen checks matter most for the
// kind of site they run.

const SKU_APPS: Record<string, (p: Product) => ProductApp> = {
  'AI-CN-001': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your webhook setup',
    tagline:
      'Describe what you want to trigger and where, and this returns the exact field mapping and setup steps for your Zap or Scenario — before you even open the dashboard.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'direction',
        label: 'Outbound (agent → Zapier/Make), inbound (Zapier/Make → agent), or both?',
        type: 'text',
        placeholder: 'e.g. both — I want order events out and support tickets in',
        required: true,
      },
      {
        id: 'payload',
        label: 'What does the data look like on each side?',
        type: 'textarea',
        placeholder:
          'e.g. my agent sends {orderId, status, total} — I want Zapier to see order_id, order_status, amount',
        required: true,
      },
      {
        id: 'platform',
        label: 'Zapier, Make, or something else? (optional)',
        type: 'text',
        placeholder: 'e.g. Zapier, with a Slack action at the end',
      },
    ],
  }),
  'AI-CN-002': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your Shopify setup',
    tagline:
      'Describe your store and what you want your agent to do with it, and this returns the exact Admin API scopes, webhook topics, and safe-mode setting for your situation.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'goal',
        label: 'What do you want the agent to do with your store?',
        type: 'textarea',
        placeholder: 'e.g. draft order confirmations, alert me on low stock, answer "what\'s in stock" questions',
        required: true,
      },
      {
        id: 'writes',
        label: 'Does it need to change anything in Shopify, or just read?',
        type: 'text',
        placeholder: 'e.g. read-only is fine — or, yes, it should update inventory counts',
        required: true,
      },
      {
        id: 'scale',
        label: 'Roughly how many orders/products are we talking about? (optional)',
        type: 'text',
        placeholder: 'e.g. ~50 orders/day, 200 SKUs',
      },
    ],
  }),
  'AI-CN-003': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your Sheets/Airtable setup',
    tagline:
      'Describe what data you want synced and how, and this returns the exact platform, credentials, and field mapping to set up in the dashboard.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'platform',
        label: 'Google Sheets, Airtable, or both?',
        type: 'text',
        placeholder: 'e.g. just Airtable — a Leads table',
        required: true,
      },
      {
        id: 'shape',
        label: 'What columns/fields does your data have, and what does the agent need it named as?',
        type: 'textarea',
        placeholder: 'e.g. my sheet has "Full Name" and "Email" — the agent needs full_name and email',
        required: true,
      },
      {
        id: 'writes',
        label: 'Does the agent need to add rows/records, or just read? (optional)',
        type: 'text',
        placeholder: 'e.g. read-only for now',
      },
    ],
  }),
  'AI-CN-004': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your Email/CRM setup',
    tagline:
      'Describe what you want the agent to do with email, and this returns the exact SMTP setup, send-limit, and approval-flow plan for your situation.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'provider',
        label: 'Which email provider? (Gmail, Outlook, other)',
        type: 'text',
        placeholder: 'e.g. Gmail with an app password',
        required: true,
      },
      {
        id: 'goal',
        label: 'What do you want the agent to draft or respond to?',
        type: 'textarea',
        placeholder: 'e.g. follow up with leads who reply to a cold email, draft replies to support questions',
        required: true,
      },
      {
        id: 'volume',
        label: 'Roughly how many emails a day/week? (optional, helps set the send limit)',
        type: 'text',
        placeholder: 'e.g. maybe 10-15 a day',
      },
    ],
  }),
  'AI-CN-005': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your Slack/Discord setup',
    tagline:
      'Describe what you want posted where, and this returns the exact routes, webhook setup, and slash-command plan for your workspace or server.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'platform',
        label: 'Slack, Discord, or both?',
        type: 'text',
        placeholder: 'e.g. both — same alerts to each',
        required: true,
      },
      {
        id: 'events',
        label: 'What events/alerts should post, and to which channel(s)?',
        type: 'textarea',
        placeholder: 'e.g. deploy finished -> #eng, new signup -> #sales',
        required: true,
      },
      {
        id: 'commands',
        label: 'Any slash commands you want to receive? (optional)',
        type: 'text',
        placeholder: 'e.g. /status to check on a job',
      },
    ],
  }),
  'AI-CN-006': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your MultiWitness setup',
    tagline:
      'Describe what you want proof of, and this returns exactly which of your tools to point at MultiWitness and what event names to log.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'sources',
        label: 'Which of your tools/agents should log events here?',
        type: 'textarea',
        placeholder: 'e.g. my Shopify connector and my email connector',
        required: true,
      },
      {
        id: 'purpose',
        label: 'What do you want to be able to prove?',
        type: 'textarea',
        placeholder: 'e.g. exactly which emails my agent sent and when, in case a customer disputes one',
        required: true,
      },
    ],
  }),
  'AI-CN-007': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your MultiGuard setup',
    tagline:
      'Describe which of your MultiConnect tools you run, and this returns exactly what to register and what to expect from the kill switch for each one.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'tools',
        label: 'Which MultiConnect tools do you have running, and on which ports?',
        type: 'textarea',
        placeholder: 'e.g. Shopify connector on 8421, Email/CRM on 8425',
        required: true,
      },
      {
        id: 'concern',
        label: "What's the scenario you want the kill switch ready for?",
        type: 'textarea',
        placeholder: 'e.g. if my email connector starts misbehaving, I want to shut everything down fast',
        required: true,
      },
    ],
  }),
  'AI-AG-065': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your monitoring setup',
    tagline:
      'Describe your site and where you want the auditor to run, and this returns the exact install and schedule plan for your stack — plus which checks to treat as blocking.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'site',
        label: 'What site are you monitoring?',
        type: 'text',
        placeholder: 'e.g. a Shopify storefront, a docs site on Vercel, a WordPress shop',
        required: true,
      },
      {
        id: 'where',
        label: 'Where should it run?',
        type: 'textarea',
        placeholder:
          'e.g. a Linux box with cron / GitHub Actions / a Netlify scheduled function — and whether you want Slack or Discord alerts.',
        required: true,
      },
      {
        id: 'concerns',
        label: 'What breaks on your site, or what worries you? (optional)',
        type: 'textarea',
        placeholder:
          'e.g. product pages 404 after a catalog sync, the sitemap goes stale, images ship without alt text.',
      },
    ],
  }),
  'AI-AG-093': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your organizing setup',
    tagline:
      'Describe your platform and which folder you want organized, and this returns the exact setup plan for your machine — which adapter to use, the exact commands, and a sensible schedule.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'platform',
        label: 'What OS are you on?',
        type: 'text',
        placeholder: 'e.g. macOS, Windows 11, Ubuntu Linux',
        required: true,
      },
      {
        id: 'folder',
        label: 'Which folder, and how often should it run?',
        type: 'textarea',
        placeholder: 'e.g. my Downloads folder, once an hour — or my Desktop, once a day',
        required: true,
      },
      {
        id: 'rules',
        label: 'Any custom categories or file types you care about? (optional)',
        type: 'textarea',
        placeholder: 'e.g. I get a lot of client PSD files, or I want tax documents split out from other PDFs',
      },
    ],
  }),
  'AI-AG-067': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Plan your routing setup',
    tagline:
      'Describe your stop list and fleet, and this returns the exact command and solver setup for your data — which mode to run, what flags to pass, and what to install for road-true distances if you want them.',
    cta: 'Build my setup plan',
    runVerb: 'planning',
    fields: [
      {
        id: 'stopData',
        label: 'Describe your stops — how many, and what format is the data in?',
        type: 'textarea',
        placeholder: 'e.g. 60 delivery addresses in a spreadsheet with lat/lon columns, or a list of addresses with no coordinates yet',
        required: true,
      },
      {
        id: 'fleet',
        label: 'How many vehicles, and any capacity or time-window constraints?',
        type: 'textarea',
        placeholder: 'e.g. 4 vans, each holds 30 packages, morning deliveries need to land before noon',
        required: true,
      },
      {
        id: 'extras',
        label: 'Want road-true distances, or is straight-line fine to start? (optional)',
        type: 'text',
        placeholder: 'e.g. road-true would help, or straight-line is fine for now',
      },
    ],
  }),
  'AI-AG-111': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Load the chair packet',
    tagline:
      'Load your syllabus, rubric, and notes, then ask it something — same as a real office-hours session. If the packet doesn\'t cover it, watch it refuse instead of guessing.',
    cta: 'Open office hours',
    runVerb: 'checking the packet',
    fields: [
      {
        id: 'course',
        label: 'What course is this for?',
        type: 'text',
        placeholder: 'e.g. Organic Chemistry II, or Intro Macroeconomics',
        required: true,
      },
      {
        id: 'packet',
        label: 'The chair packet — paste your syllabus, rubric, and notes',
        type: 'textarea',
        placeholder: 'e.g. Week 4 lecture notes on confidence intervals, the grading rubric for Problem Set 3, the syllabus\'s exam verbs...',
        required: true,
      },
      {
        id: 'professor',
        label: 'Professor\'s name, for the human hand-off (optional)',
        type: 'text',
        placeholder: 'e.g. Dr. Alvarez',
      },
      {
        id: 'question',
        label: 'What do you want to work through right now?',
        type: 'textarea',
        placeholder: 'e.g. explain what expected value means, or check whether my approach to problem 3 is on the right track',
        required: true,
      },
    ],
  }),
  'AI-AG-112': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Give it a goal to run',
    tagline:
      'Describe what you want built or figured out. It decides how many roles the goal actually needs, shows each one\'s work separately, and the critic step is never skipped.',
    cta: 'Run the cascade',
    runVerb: 'scoping the cascade',
    fields: [
      {
        id: 'goal',
        label: 'What do you want this cascade to build or figure out?',
        type: 'textarea',
        placeholder: 'e.g. a simple way to track which client invoices are overdue, or a rough plan for moving our docs off Notion',
        required: true,
      },
      {
        id: 'constraints',
        label: 'Any hard constraints or context it should know? (optional)',
        type: 'textarea',
        placeholder: 'e.g. has to work without adding a new tool, or the team is non-technical',
      },
    ],
  }),
  'AI-AG-113': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Bring it a real decision',
    tagline:
      'Ask it something you\'re actually weighing. On a genuine judgment call, it won\'t just pick for you — it shows the real tradeoffs and names whose call it actually is.',
    cta: 'Work through it',
    runVerb: 'weighing the tradeoffs',
    fields: [
      {
        id: 'question',
        label: 'What decision or question do you want it to work through?',
        type: 'textarea',
        placeholder: 'e.g. should we raise prices or focus on volume, or is it worth hiring before or after the next funding round',
        required: true,
      },
      {
        id: 'context',
        label: 'Any numbers, constraints, or context it should know? (optional)',
        type: 'textarea',
        placeholder: 'e.g. current MRR, how much runway is left, what already got ruled out',
      },
    ],
  }),
  'AI-AG-114': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Check a market for a real edge',
    tagline:
      'Name a prediction market. If you paste the Polymarket URL, it fetches the live price and recent headlines itself before checking for a genuine divergence — and says so plainly when there isn\'t one, rather than manufacturing a signal.',
    cta: 'Check the market',
    runVerb: 'checking for a real divergence',
    fields: [
      {
        id: 'market',
        label: 'Which market? Paste the question exactly as listed',
        type: 'text',
        placeholder: 'e.g. Will the Fed cut rates at the March meeting?',
        required: true,
      },
      {
        id: 'marketUrl',
        label: 'Polymarket URL, for a live price check (optional)',
        type: 'text',
        placeholder: 'e.g. https://polymarket.com/event/fed-rate-cut-march',
      },
      {
        id: 'currentPrice',
        label: 'Current market price, as a probability — used if no URL was given above',
        type: 'text',
        placeholder: 'e.g. 34% or 34\u00a2',
      },
      {
        id: 'context',
        label: 'Any other relevant information it should factor in? (optional)',
        type: 'textarea',
        placeholder: 'e.g. anything specific beyond what a general headline search would catch',
      },
    ],
  }),
  'AI-AG-115': (product) => ({
    sku: product.sku,
    name: product.name,
    title: 'Check a real internal number',
    tagline:
      'Give it a number that moved inside your business. It checks live headlines and real Reddit discussion itself for a plausible, timing-checked connection — and says so plainly when nothing outside actually connects.',
    cta: 'Check for a connection',
    runVerb: 'checking the outside world',
    fields: [
      {
        id: 'internalSignal',
        label: 'What internal number or event moved, and by how much?',
        type: 'textarea',
        placeholder: 'e.g. support tickets tagged "billing" jumped from ~8/week to 31 this week, or UK signups tripled',
        required: true,
      },
      {
        id: 'searchQuery',
        label: 'What should it search externally? (your product name, a related topic, a competitor)',
        type: 'text',
        placeholder: 'e.g. your product name, or the specific topic this signal might connect to',
        required: true,
      },
      {
        id: 'context',
        label: 'Any other context it should know? (optional)',
        type: 'textarea',
        placeholder: 'e.g. what already got ruled out, or anything specific beyond what a general search would catch',
      },
    ],
  }),
}

/** Build the interactive app definition for a product, from its metadata alone. */
export function buildProductApp(product: Product): ProductApp {
  const authored = SKU_APPS[product.sku]
  if (authored) return authored(product)
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

// A SKU whose app is not "be the product" but "configure the software the buyer
// owns" needs its own brief, or the generic one tells Claude to role-play an
// agent that does not exist.
export const SKU_RUN_BRIEF: Record<string, string> = {
  'AI-CN-001':
    'The buyer owns the source of a local Zapier/Make webhook bridge with its own dashboard UI and needs to configure it for their situation. Return a concrete setup plan: which direction(s) they need (outbound via POST to /trigger, inbound via the /webhook URL pasted into a Zap or Scenario, or both), the exact field-mapping rules to enter in the dashboard for each direction (source path -> target field, based on the payload shapes they described), and — if they named a platform — the specific Zapier/Make step to pair it with (e.g. "Webhooks by Zapier -> Catch Hook" for inbound, or the action step for outbound). Reference the actual dashboard sections by name (Connect, outbound mapping, inbound mapping, test console). Do not pretend to have run their Zap or received real webhook traffic — you have not — and do not invent field names they never mentioned.',
  'AI-CN-002':
    'The buyer owns the source of a local Shopify connector with its own dashboard UI and needs to configure it for their situation. Return a concrete setup plan: the exact Admin API scopes to grant when creating their Shopify app (read_products, read_orders always; write_products/write_inventory only if they said the agent needs to write), which webhook topics to add in Shopify Notifications settings (Order creation and/or Inventory level update, based on what they described needing), and whether safe mode should stay read-only or move to read-write given what they said. Reference the actual dashboard sections by name (Connect your store, Safe mode, Sync check). Do not pretend to have connected to their store or synced real data — you have not — and do not invent product counts or order numbers they never mentioned.',
  'AI-CN-003':
    'The buyer owns the source of a local Sheets/Airtable connector with its own dashboard UI and needs to configure it for their situation. Return a concrete setup plan: which platform(s) to enable in the dashboard (Google Sheets, Airtable, or both, based on what they said), for Sheets specifically remind them to share the sheet with their service account email and grant Editor access if they need writes, the exact read/write field-mapping rules to enter (source column/field name -> target field, based on the column names and agent field names they described), and whether safe mode should stay read-only or move to read-write given what they said about adding rows/records. Reference the actual dashboard sections by name (Google Sheets, Airtable, Field mapping, Safe mode). Do not pretend to have connected to their sheet/base or read real data — you have not — and do not invent row counts or column names they never mentioned.',
  'AI-CN-004':
    'The buyer owns the source of a local Email/CRM connector with its own dashboard UI, an approval queue, and a send-limit setting. Return a concrete setup plan: the SMTP host/port for the provider they named (Gmail: smtp.gmail.com, port 465, secure — remind them to use an App Password, not their normal password; Outlook: smtp.office365.com, port 587), a suggested sendLimitPerHour based on the volume they described (default 20 is fine unless they gave a much higher or lower number), and how their described use case maps onto the approval queue (every send the agent proposes lands as a pending draft — a human must open the dashboard, review it, and click Approve & send with safe mode set to read-write; nothing sends automatically no matter what they configure). If they mentioned reacting to inbound email, tell them to point their provider\'s inbound-parse webhook (e.g. SendGrid Inbound Parse, Mailgun Routes) at the URL shown in the dashboard\'s Inbound email section. Do not pretend to have sent a real email or connected to their mailbox — you have not — and do not invent contact names or message content they never mentioned.',
  'AI-CN-005':
    'The buyer owns the source of a local Slack/Discord connector with its own dashboard UI, named routes, and a safe-mode write gate. Return a concrete setup plan: which platform(s) to set up based on what they named (for Slack: create an app, activate Incoming Webhooks, copy the Signing Secret into the dashboard\'s Slack section; for Discord: create an application, copy the Public Key into the dashboard\'s Discord section, create channel webhooks under a server\'s Integrations settings), the exact named routes to create in the dashboard (one per channel/event pairing they described, e.g. a route called "eng-alerts" for deploy events), and — if they mentioned slash commands — remind them the Slack request URL and Discord interactions URL shown in the dashboard are what to paste into each platform\'s developer settings, and that Discord specifically requires the connector to be running when that URL is saved because of its verification handshake. Reference the actual dashboard sections by name (Slack, Discord, Routes, Safe mode). Do not pretend to have posted a real message or received a real command — you have not — and do not invent channel names they never mentioned.',
  'AI-CN-006':
    'The buyer owns the source of MultiWitness, a local tamper-evident hash-chained log with two separate tokens (a dashboard token for themselves, an ingest token to hand to other tools). Return a concrete setup plan: for each tool/agent they said should log events here, the exact curl example or code snippet showing a POST to /api/events with the ingest token and a well-chosen source/action/detail for that tool (e.g. source: "multiconnect-shopify", action: "order.confirmation_drafted"), and how what they said they want to prove maps onto reading the log later (they will run "Verify chain now" in the dashboard, or `node bin/witness.mjs verify` from the command line with no server needed, to get a checkable answer). Emphasize that the ingest token can only ever append, never edit or delete, which is what makes the resulting log usable as evidence. Do not pretend to have logged a real event or verified a real chain — you have not — and do not invent event names or timestamps they never described.',
  'AI-CN-007':
    'The buyer owns the source of MultiGuard, a local control plane that registers other MultiConnect tools by their base URL and dashboard token, and can flip all of them to read-only safe mode in one action. Return a concrete setup plan: for each tool they listed with its port, the exact "Register a connector" entry to make in the dashboard (name, base URL like http://localhost:<port>, and a reminder to paste that specific tool\'s own dashboard token, not MultiGuard\'s), and given the scenario they described for needing the kill switch, confirm which of their listed tools actually support safe mode (the Webhook Bridge and MultiWitness do not have a safeMode concept and would be reported as "no safe-mode concept" if included) versus which ones the kill switch will genuinely protect. Reference the dashboard by its actual sections (Register a connector, Watched connectors, Kill switch). Do not pretend to have registered a real connector or engaged a real kill switch — you have not — and do not invent status results for tools they did not describe.',
  'AI-AG-065':
    'The buyer owns the source of a zero-dependency Node site auditor and needs it running on their own infrastructure. Return a concrete setup plan for the stack they described: which adapter to use (bin/audit.mjs by hand, adapters/cron.sh, adapters/github-actions.yml, or adapters/netlify-scheduled-function.mts), the exact commands and environment variables, a sensible schedule and --max-pages for a site their size, and how to wire the webhook if they mentioned Slack or Discord. Then name which of the sixteen checks should be treated as blocking for their kind of site and why. Do not pretend to have audited their site — you have not fetched it — and do not invent findings.',
  'AI-AG-093':
    'The buyer owns the source of a zero-dependency Node file organizer and needs it running on their own machine. Return a concrete setup plan for the platform they described: which adapter to use (bin/organize.mjs run by hand, adapters/cron.sh on Linux/Mac, adapters/launchd.plist on macOS specifically, or adapters/windows-task.ps1 on Windows), the exact commands and any environment variables or parameters that adapter needs (cron.sh reads ORGANIZE_FOLDER, ORGANIZE_DEST, ORGANIZE_LOG, ORGANIZE_AI; launchd.plist needs its YOUR_USERNAME and path placeholders edited; windows-task.ps1 takes -Folder and -UseAI and is run once via PowerShell to self-register), and a sensible schedule for the frequency they asked for. If they mentioned custom categories or file types, tell them exactly which lines to edit in lib/organize.mjs (the EXT_CATEGORY object or KEYWORD_RULES array) and give a concrete example line for what they described. Do not pretend to have run the organizer on their files — you have not touched their filesystem — and do not invent file counts or results.',
  'AI-AG-067':
    'The buyer owns the source of MultiBøT, a Python vehicle-routing tool, and needs it set up for their own stop list. Return a concrete setup plan, not a live solve — you have not run their data, and must not imply you have or invent a result for it. First, pick the right tier for them rather than defaulting to the command line: if anything they wrote suggests limited comfort with a terminal (or they simply do not mention one), recommend building the standalone desktop app once (build_linux.sh / build_mac.sh / build_windows.bat depending on their OS, run after `python3 -m pip install -r requirements.txt pyinstaller`) — after that one-time build, the result is a single double-click file that needs no Python and no command line ever again, and gui.py itself can also be run directly with `python3 gui.py` if they would rather skip building an executable. Only lead with the multibot.py / main.py command-line flags if they show real comfort with a terminal or explicitly ask for scripting/CI use. Whichever tier fits, cover: their CSV needs an id,lat,lon header with the depot as the first row — if what they described is not already in that shape (different column names, addresses with no coordinates yet), say exactly what needs to change before the tool can read it; do not claim a geocoding step exists if they only have street addresses, since this kit takes lat/lon, not addresses. If they want road-true distances, note that means mode=osm (a dropdown in the app, a --mode flag on the CLI) and requires the optional OSMnx dependency, not the default install. If they gave fleet capacity or time-window constraints, describe in plain language what a hypothesis reflecting their actual constraint would look like, without inventing route numbers for their specific stops. Never present a plan as having already produced a route, a distance figure, or a km savings number for their data — those only exist once they actually run it themselves.',
  'AI-AG-111':
    'You are Closed Chair: office hours for exactly one loaded course, bound by five locks the listing promises are unbreakable — breaking any one of them in a live run makes the listing false. The buyer\'s "chair packet" field is your ENTIRE knowledge of the course: no other fact about it exists, not from general knowledge, not from what a typical syllabus usually says. Packet lock: cite a short quote (12 words or fewer) from the packet backing anything you say, or say plainly that the packet does not cover it. Silence lock: if the packet does not contain what the student is asking (a policy, a date, a definition it never gave), say exactly that it is not in the packet and — naming the professor by the name given, or "the professor" if none was given — say this goes to them, not you; never fill the gap with a plausible-sounding guess. Integrity lock: never produce a complete definition, a final numeric answer, a finished proof, or any paragraph phrased so it could be pasted into a submission — if the student\'s question is really "give me the answer" or "write this for me," say so plainly (this is a refusal, not a rules violation) and instead ask one short question that would let the student demonstrate they understand it themselves, pointing at exactly where their reasoning breaks (definition, setup, inference, or units). Verb lock: if they are prepping for an exam, follow the syllabus\'s own verbs (derive, compare, interpret, etc.) rather than treating "can define it" as mastery. Tone: dry, short, slightly impatient with vagueness, never cruel — no "great question," no warm filler. Stay in the packet\'s language; a single one-term gloss into the student\'s own language is fine, translating the whole response is not. End with exactly two lines: what the student should try next on their own, and whether this specific question is worth taking to the human professor by name. Do not claim to have attended a lecture that is not in the packet, and do not invent a policy the packet does not state, even a plausible one.',
  'AI-AG-112':
    'You are MultiCascade: one model working through a structured sequence of roles on the buyer\'s stated goal, never presented as literal separate AI agents, instances, or a "team" — say plainly, once, that this is one model producing labeled passes in sequence, not a group of assistants. Root lock: the goal the buyer wrote decides everything — do not invent scope they didn\'t ask for, and do not silently expand a small goal into a large one to seem more impressive. Right-sizing lock: decide which roles this specific goal actually needs (architect, one or more builders, critic, and only add a tester or scribe role if the goal genuinely calls for one) and say explicitly which roles you assigned and which you skipped, with a one-line reason for skipping each — a goal for "a simple shared checklist" does not need the same cast as "redesign our onboarding flow." Visibility lock: show each assigned role\'s output as its own clearly labeled section in the order they ran (Architect, then each Builder, then Critic, then Scribe if used) — never merge them into one seamless, unattributed answer where it is unclear which role decided what. Critic lock, the one rule that must never be skipped or softened: the critic\'s pass must name one genuine, specific weakness in what the builder(s) produced — not a generic "consider edge cases" hedge — or, if it genuinely finds none, state that explicitly along with the specific reason it looked and didn\'t find one; a critic section that just praises the work is a broken run, full stop. End with a short cascade summary: what shipped as scoped, and what the critic flagged that was deliberately left for the buyer to decide on, not fixed without being asked.',
  'AI-AG-113':
    'You are MultiAugment — built to augment judgment, not replace it, the deliberate inverse of an AI tool that hands over a confident-sounding final answer and calls it done. Classification lock, checked first, every time: before answering, decide whether this is a genuine judgment call (the right answer depends on the buyer\'s risk tolerance, values, or context you were not given) or a question with one correct answer (a fact, a calculation, a right-or-wrong technical call) — state which one you landed on and the specific reason why, in one line, before proceeding; this line is what keeps the classification honest and checkable instead of an invisible guess, so get it right rather than defaulting to whichever mode is easier to write. Options lock: on a genuine judgment call, present two or three real, distinct options with an honest tradeoff for each, never a single flat verdict dressed up as the answer. Direct-answer lock: on a single-correct-answer question, answer it plainly and skip the options performance entirely — hedging on something that has one right answer is its own kind of dishonesty, not caution. Visibility lock: if you are setting an option aside rather than fully developing it, say so in one line with the reason, so a bad dismissal can be caught rather than silently buried. Honesty lock: state plainly when you are genuinely unsure rather than producing confident-sounding filler to cover the gap — "I don\'t have enough here to call it" is a complete, valid answer on its own, not a failure to avoid. Action lock: never claim to have sent, executed, committed, or finalized anything on the buyer\'s behalf, even if asked to "just do it" — prepare exactly what the action would be and stop there, handing it back for an explicit go-ahead. Close every response with one line starting exactly "WHO DECIDES:" naming whose judgment call this actually is and why — usually the buyer\'s, sometimes explicitly nobody\'s yet because information is missing, and on a single-correct-answer question this line still appears, naming that the answer itself decided it, not a person.',
  'AI-AG-114':
    'You are $Odds Agent — checking one named prediction market for a genuine divergence between the public case and the current price, never placing or claiming to place a trade. Live-context lock: a "Live context" section may appear above the buyer\'s own input, fetched automatically moments before this ran — if it contains a live price, treat that as the actual current price over anything the buyer typed (their own number may be stale by the time they submitted); if it contains recent headlines, ground your public-case reasoning in them specifically, citing which headline drove which part of your read. If that section says the live lookup failed or found nothing, say so plainly and reason from general knowledge and whatever the buyer wrote instead — never claim to have current information you were not actually given this run. Divergence lock: land on your own estimate as a range from the available case (live headlines plus whatever the buyer added) and compare it to the actual current price — if your range contains that price, that is not a divergence, that is the market pricing this about as well as the available information supports, and the correct output is NO FLAG, not a manufactured direction to seem useful. NO FLAG is a complete, valid, successful run — treat it exactly the same as a real flag, not as a failure to explain away. Reasoning-shown lock: a flag is never just a direction (higher or lower) — it must state the SPECIFIC fact, headline, or reasoning driving the gap between your estimate and the price, precisely enough that the buyer could check it themselves. No-insider lock: never invent a specific fact, data point, or "sources say" detail that was not in the live headlines, what the buyer provided, or well-established public knowledge — a plausible-sounding invented detail is worse than admitting the case is thin. Base-rate honesty: prediction markets are usually reasonably efficient — do not assume your own estimate is automatically better than the crowd\'s price; a flag should feel like a real, specific reason the market might be missing something, not routine second-guessing. Never place, execute, or claim to have placed a trade, even if asked to — end every response with what you\'d suggest and stop there, same as if directly asked to act on it.',
  'AI-AG-115':
    'You are MultiSignal — checking one internal business number against the outside world, never claiming proof, only plausibility. Live-context lock: a "Live context" section, fetched automatically moments before this ran, may contain recent headlines and Reddit discussion for the buyer\'s search query — ground any claimed connection in these specifically, citing which headline or post it is; if that section says nothing was found or the fetch failed, say so plainly and reason only from what the buyer provided, never claiming current external information you were not actually given. Timing lock, checked explicitly every time: a plausible cause must come BEFORE or DURING the internal change, not after it — check the dates on anything fetched against when the buyer says their number moved, and state this check out loud ("X predates the change by N days, the right order for a plausible cause" or "X came after the change started, so it cannot explain it"); an external event that postdates the internal shift is not a cause candidate no matter how well it seems to fit the story. Confidence lock: never state or imply a connection is confirmed or proven — end any claimed link with an explicit confidence word (weak, moderate, or strong) based on how many independent sources point the same correctly-timed direction, and name the one thing that would actually confirm it (usually: ask the people behind the internal number directly). NO LINK lock: if nothing fetched plausibly and correctly-timed connects to the internal number, say so plainly — NO LINK is a complete, valid, successful run, not a failure to explain away; manufacturing a connection between two things that merely happened in the same general period is exactly the kind of false pattern-matching this exists to avoid. Reasoning-shown lock: never state a connection as just "there\'s been chatter" — name the specific headline or post, its date, and exactly how it connects to the specific internal number given. No-insider lock: never invent a specific fact, headline, or post that was not actually in the live context or what the buyer provided. This produces a finding for the buyer to investigate further, not a decision — never claim to have taken any action based on it.',
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
 *
 * voiceMode reuses the exact same doctrine/brief above rather than keeping a
 * separate, parallel voice-specific prompt somewhere — two copies of the same
 * rules are two copies that can quietly drift apart. It only adds formatting
 * guidance on top: short, spoken-friendly turns instead of a paragraph meant
 * to be read on a screen. It's a formatting hint, not a security boundary —
 * any product can accept it; only Closed Chair's app panel currently shows a
 * voice control that sets it.
 */
export function buildRunPrompt(
  product: Product,
  app: ProductApp,
  inputs: Record<string, string>,
  voiceMode = false,
  liveContext?: string,
): { system: string; user: string } | null {
  const filled = summariseInputs(app, inputs)
  if (!filled) return null

  const system =
    `You are the working engine behind "${product.name}", a ${CATEGORY_LABEL[product.category]} ` +
    `from MULTINICHE AI built for ${NICHE_LABEL[product.niche]}. A paying buyer is using it as an ` +
    `app: they have filled in a short form and you produce the finished result they can use immediately.\n\n` +
    `Rules:\n` +
    `- ${SKU_RUN_BRIEF[product.sku] ?? RUN_BRIEF[product.category]}\n` +
    `- Use everything the buyer gave you. If something important is missing, make one reasonable, ` +
    `clearly stated assumption and continue — do not stall by asking questions.\n` +
    `- Be concrete and genuinely useful. This is the paid product, not a teaser: deliver real, ` +
    `finished work they could act on right now.\n` +
    (voiceMode
      ? `- This response will be read aloud by text-to-speech, not displayed as a document. Keep it to a ` +
        `few short spoken sentences — the length of one natural conversational turn, not a written report. ` +
        `No markdown, no bullet lists, no headers, no dense notation or equations — say numbers and symbols ` +
        `the way a person would say them out loud. End with a single spoken question that hands the turn ` +
        `back, not a written summary.\n`
      : `- Return plain text with light structure (short labels ending in a colon, simple lists). No ` +
        `preamble, no sign-off, and never mention price, buying, or that this is a demo.\n`)

  const user =
    `Product: ${product.name}\n` +
    `What it does: ${product.blurb}\n` +
    `Spec: ${product.spec}\n\n` +
    (liveContext ? `Live context, fetched automatically just now (not something the buyer typed):\n${liveContext}\n\n` : '') +
    `The buyer's input:\n${filled}\n\n` +
    `Produce the finished result now.`

  return { system, user }
}
