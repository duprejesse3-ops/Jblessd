// Netlify Function: POST /api/agent — the metered Claude agent behind /agent.
//
// This is the product the credits buy. Unlike the storefront's shopping
// assistant (/api/chat), which exists to sell catalog items and is free, this
// agent works on the *customer's* job: brief it, and it researches, drafts and
// saves a finished deliverable. Every run is priced in credits before it starts.
//
// The metering rules are the part worth being careful about:
//
//   1. Credits are debited BEFORE the model is called. Charging afterwards would
//      let a client spend a balance it doesn't have by hanging up mid-stream.
//   2. If the run streams no text at all, the charge is refunded and the client
//      is told. Nobody pays for an empty answer.
//   3. Actual token usage is recorded per run (agent_runs) even though the price
//      is flat, so the owner can see the real margin on each tier and reprice.
//
// A visitor with no balance still gets one free Quick run per day (per IP) — the
// studio has to prove it's worth paying for before anyone will top up, and that
// trial run is the conversion mechanic. Trial runs cannot save deliverables.
//
// The response is newline-delimited JSON so the page can render text as it
// arrives, show which tool the agent reached for, and drop in product cards and
// saved-artifact confirmations the moment they happen.

import type { Config, Context } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'
import {
  AGENT_MODES,
  TRIAL_MODE_ID,
  accountForKey,
  chargeCredits,
  findMode,
  readAccessKey,
  recordRun,
  refundCredits,
  saveArtifact,
  touchAccount,
  type AgentMode,
  type CreditAccount,
} from '../lib/credits.mjs'
import { checkRateLimit } from '../lib/rate-limit.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const STORE_NAME = 'MULTINICHE AI'
const TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000
const TRIAL_RUNS_PER_WINDOW = 1

interface ClientMessage {
  role: 'user' | 'assistant'
  content: string
}

// ---- tools ------------------------------------------------------------------

function forModel(p: Product) {
  return {
    sku: p.sku,
    name: p.name,
    price: p.price,
    format: p.format,
    category: CATEGORY_LABEL[p.category],
    audience: NICHE_LABEL[p.niche],
    blurb: p.blurb,
    spec: p.spec,
  }
}

function forCard(p: Product) {
  return {
    sku: p.sku,
    name: p.name,
    price: p.price,
    format: p.format,
    blurb: p.blurb,
    catLabel: CATEGORY_LABEL[p.category],
    nicheLabel: NICHE_LABEL[p.niche],
  }
}

function searchCatalog(query: string, products: Product[], max = 4): Product[] {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const scored = products
    .map((p) => {
      const haystack = [p.name, p.blurb, p.spec, p.format, CATEGORY_LABEL[p.category], NICHE_LABEL[p.niche]]
        .join(' ')
        .toLowerCase()
      let score = 0
      for (const t of terms) {
        if (t.length < 3) continue
        if (haystack.includes(t)) score += 2
        if (p.name.toLowerCase().includes(t)) score += 2
      }
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored.filter((s) => s.score > 0).slice(0, max).map((s) => s.p)
}

function toolsFor(canSave: boolean): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
    {
      name: 'search_toolkit',
      description:
        `Search ${STORE_NAME}'s catalog of ready-made AI tools (prompt packs, automation blueprints, ` +
        'doc templates, agent configs). Use it when the customer would be better served by owning a ' +
        'reusable tool for a job they will repeat, or when you want a proven pattern to build on. ' +
        'Returns real products with SKU, price and spec — never invent one.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The job or need, in plain language.' },
          max: { type: 'integer', description: 'Max results, 1-5. Default 3.' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_toolkit_item',
      description: 'Full details (spec, format, price) for one catalog product by its exact SKU.',
      input_schema: {
        type: 'object',
        properties: { sku: { type: 'string', description: 'The exact SKU, e.g. AI-PP-001.' } },
        required: ['sku'],
      },
    },
  ]

  if (canSave) {
    tools.push({
      name: 'save_deliverable',
      description:
        "Save the finished work product to the customer's library so they can download it later. " +
        'Call this ONCE per run, at the end, when you have produced something worth keeping ' +
        '(a document, plan, script, analysis, checklist). Pass the complete final content as ' +
        'markdown — not a summary of it. Do not call it for short conversational replies.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title, e.g. "Q3 investor update draft".' },
          kind: {
            type: 'string',
            description: 'One of: document, plan, analysis, script, checklist, email.',
          },
          markdown: { type: 'string', description: 'The complete deliverable in markdown.' },
        },
        required: ['title', 'markdown'],
      },
    })
  }

  return tools
}

const SYSTEM = (mode: AgentMode, canSave: boolean, catalogSize: number) =>
  `You are the Claude Agent Studio operator at ${STORE_NAME} — a paid, general-purpose working agent. ` +
  `The person talking to you has spent credits on this run, so your job is to produce real, finished, ` +
  `usable work, not a summary of how you would approach it.\n\n` +
  `How to work:\n` +
  `- Do the task. If the brief is a document, write the document. If it's an analysis, do the analysis ` +
  `with concrete reasoning. If it's a plan, make it specific enough to act on today.\n` +
  `- Make one reasonable assumption rather than asking a clarifying question, and state the assumption ` +
  `briefly at the end. Only ask a question when the brief is genuinely unusable without an answer — a ` +
  `paid run that returns only questions is a wasted credit.\n` +
  `- Be concrete: real numbers, real names from the brief, real structure. No filler, no ` +
  `"here's a framework you could use" hedging.\n` +
  `- Format for reading: short paragraphs, headings and lists where they help. Markdown.\n` +
  (canSave
    ? `- When the run produces something worth keeping, call save_deliverable ONCE at the end with the ` +
      `complete final content so it lands in the customer's library.\n`
    : `- This is a free trial run, so nothing can be saved to a library. Deliver the work in full in your reply.\n`) +
  `- You have a catalog of ${catalogSize} ready-made AI tools available through search_toolkit. When the ` +
  `customer clearly has a job they will repeat, mention the one tool that fits and why — once, briefly, ` +
  `after the work is delivered. Never lead with a pitch and never recommend something you haven't looked up.\n\n` +
  `You are running in ${mode.label} mode. ${
    mode.id === 'quick'
      ? 'Be fast and tight — this tier is for short, direct work.'
      : mode.id === 'deep'
        ? 'This is the premium tier: think it through properly and go deep. Length is justified when it carries substance.'
        : 'Balance depth and speed — a complete deliverable without padding.'
  }`

// ---- handler ----------------------------------------------------------------

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let history: ClientMessage[] = []
  let requestedMode = 'standard'
  try {
    const body = await req.json()
    requestedMode = String(body?.mode ?? 'standard')
    const raw = Array.isArray(body?.messages) ? body.messages : []
    history = raw
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 12_000) }))
      .slice(-10)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return Response.json({ error: 'Describe the job you want done.' }, { status: 400, headers: NO_STORE })
  }
  const brief = history[history.length - 1].content
  if (brief.trim().length < 3) {
    return Response.json({ error: 'Describe the job you want done.' }, { status: 400, headers: NO_STORE })
  }

  const mode = findMode(requestedMode) ?? findMode('standard')!

  // ---- who is running this, and can they pay for it? ----
  const key = readAccessKey(req)
  let account: CreditAccount | null = null
  if (key) {
    try {
      account = await accountForKey(key)
    } catch (err) {
      console.error('agent: account lookup failed —', (err as Error).message)
      return Response.json(
        { error: 'The credit ledger is temporarily unavailable. Your balance is safe — try again shortly.' },
        { status: 503, headers: NO_STORE },
      )
    }
    if (!account) {
      return Response.json(
        { error: 'That access key is not valid. Paste the key from your purchase email, or request a new one.' },
        { status: 401, headers: NO_STORE },
      )
    }
  }

  const isTrial = !account
  let charged = 0
  let balance = account?.balance ?? 0

  if (isTrial) {
    // No balance: one free Quick run per day so the studio can prove itself.
    if (mode.id !== TRIAL_MODE_ID) {
      return Response.json(
        {
          error: `Free trial runs use ${TRIAL_MODE_ID} mode. Add credits to unlock ${mode.label}.`,
          needsCredits: true,
        },
        { status: 402, headers: NO_STORE },
      )
    }
    const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
    const limit = await checkRateLimit('agent-trial', ip, {
      limit: TRIAL_RUNS_PER_WINDOW,
      windowMs: TRIAL_WINDOW_MS,
    })
    if (!limit.allowed) {
      return Response.json(
        {
          error: 'That was your free run for today. Add credits to keep going — they never expire.',
          needsCredits: true,
        },
        { status: 402, headers: NO_STORE },
      )
    }
  } else if (account) {
    let charge
    try {
      charge = await chargeCredits(account.id, mode.credits, `${mode.label} run · ${mode.model}`)
    } catch (err) {
      console.error('agent: charge failed —', (err as Error).message)
      return Response.json(
        { error: 'The credit ledger is temporarily unavailable. Nothing was charged — try again shortly.' },
        { status: 503, headers: NO_STORE },
      )
    }
    if (!charge.ok) {
      return Response.json(
        {
          error: `${mode.label} mode costs ${mode.credits} credits and your balance is ${charge.balance}. Top up to keep going.`,
          needsCredits: true,
          balance: charge.balance,
          cost: mode.credits,
        },
        { status: 402, headers: NO_STORE },
      )
    }
    charged = mode.credits
    balance = charge.balance
    touchAccount(account.id).catch(() => {})
  }

  // ---- run the agent ----
  const { products } = await loadCatalog()
  const byId = new Map(products.map((p) => [p.sku, p]))
  const canSave = Boolean(account)
  const tools = toolsFor(canSave)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      send({
        type: 'meta',
        mode: mode.id,
        model: mode.model,
        charged,
        balance,
        trial: isTrial,
        modes: AGENT_MODES.map((m) => ({ id: m.id, credits: m.credits })),
      })

      const seenCards = new Set<string>()
      let anyText = false
      let steps = 0
      let inputTokens = 0
      let outputTokens = 0
      let savedOnce = false

      try {
        const anthropic = new Anthropic()
        const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }))

        for (let step = 0; step < mode.maxSteps; step++) {
          steps = step + 1
          const modelStream = anthropic.messages.stream({
            model: mode.model,
            max_tokens: mode.maxTokens,
            system: SYSTEM(mode, canSave, products.length),
            tools,
            messages,
          })

          for await (const event of modelStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              anyText = true
              send({ type: 'text', text: event.delta.text })
            }
          }

          const final = await modelStream.finalMessage()
          inputTokens += final.usage?.input_tokens ?? 0
          outputTokens += final.usage?.output_tokens ?? 0
          messages.push({ role: 'assistant', content: final.content })

          const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
          if (toolUses.length === 0) break

          const results: Anthropic.ToolResultBlockParam[] = []
          for (const tu of toolUses) {
            const input = tu.input as any
            let result: unknown

            if (tu.name === 'search_toolkit') {
              send({ type: 'status', tool: 'search_toolkit', label: 'searching the toolkit catalog' })
              const max = Math.min(Math.max(Number(input?.max) || 3, 1), 5)
              const found = searchCatalog(String(input?.query ?? ''), products, max)
              const fresh = found.filter((p) => !seenCards.has(p.sku))
              fresh.forEach((p) => seenCards.add(p.sku))
              if (fresh.length) send({ type: 'products', items: fresh.map(forCard) })
              result = found.length ? found.map(forModel) : { note: 'No catalog product matches that.' }
            } else if (tu.name === 'get_toolkit_item') {
              send({ type: 'status', tool: 'get_toolkit_item', label: 'reading a product spec' })
              const p = byId.get(String(input?.sku ?? ''))
              if (p && !seenCards.has(p.sku)) {
                seenCards.add(p.sku)
                send({ type: 'products', items: [forCard(p)] })
              }
              result = p ? forModel(p) : { error: 'No product with that SKU.' }
            } else if (tu.name === 'save_deliverable' && account) {
              const title = String(input?.title ?? 'Untitled deliverable').slice(0, 200)
              const markdown = String(input?.markdown ?? '')
              if (savedOnce) {
                result = { error: 'A deliverable was already saved for this run.' }
              } else if (markdown.trim().length < 40) {
                result = { error: 'Nothing substantial to save — deliver the work in the reply instead.' }
              } else {
                send({ type: 'status', tool: 'save_deliverable', label: `saving “${title}”` })
                try {
                  const artifact = await saveArtifact(
                    account.id,
                    title,
                    markdown,
                    String(input?.kind ?? 'document'),
                  )
                  savedOnce = true
                  send({ type: 'artifact', artifact })
                  result = { saved: true, id: artifact.id, chars: artifact.chars }
                } catch (err) {
                  console.error('agent: could not save artifact —', (err as Error).message)
                  result = { error: 'Could not save right now — include the content in your reply instead.' }
                }
              }
            } else {
              result = { error: `Tool ${tu.name} is not available in this run.` }
            }

            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
          }
          messages.push({ role: 'user', content: results })
        }

        // Nothing usable came back — hand the credits straight back. A paid run
        // that produces no output must never cost anything.
        if (!anyText && account && charged > 0) {
          const refunded = await refundCredits(account.id, charged, `Refund — empty ${mode.label} run`)
          if (refunded != null) balance = refunded
          send({
            type: 'refund',
            credits: charged,
            balance,
            message: 'That run produced nothing, so your credits were refunded.',
          })
        }

        send({ type: 'usage', inputTokens, outputTokens, steps, balance, charged: anyText ? charged : 0 })
        recordRun({
          accountId: account?.id ?? null,
          mode: mode.id,
          model: mode.model,
          credits: anyText ? charged : 0,
          inputTokens,
          outputTokens,
          steps,
          brief,
          status: isTrial ? 'trial' : anyText ? 'ok' : 'empty',
        }).catch(() => {})
      } catch (err) {
        console.error('agent run failed:', (err as Error).message)
        // Refund whenever the customer got nothing out of the run. If text had
        // already streamed they keep it, and the charge stands.
        if (!anyText && account && charged > 0) {
          const refunded = await refundCredits(account.id, charged, `Refund — failed ${mode.label} run`)
          if (refunded != null) balance = refunded
          send({
            type: 'refund',
            credits: charged,
            balance,
            message: 'The run failed before producing anything, so your credits were refunded.',
          })
        }
        send({
          type: 'error',
          message: anyText
            ? 'The run was cut off. What you have above is yours to keep.'
            : 'The agent could not be reached. If this is a brand-new deploy, the AI gateway activates after the first production deploy.',
        })
        recordRun({
          accountId: account?.id ?? null,
          mode: mode.id,
          model: mode.model,
          credits: anyText ? charged : 0,
          inputTokens,
          outputTokens,
          steps,
          brief,
          status: 'error',
        }).catch(() => {})
      } finally {
        send({ type: 'done', balance })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export const config: Config = {
  path: '/api/agent',
}
