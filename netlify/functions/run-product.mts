// Netlify Function: POST /api/run-product
//
// The engine behind "use it as an app". Every product on the store can be run
// like a small web app: the buyer fills in a short form and this streams back
// the finished, ready-to-use result — the prompt pack's actual output, the
// automation's real decision and drafted action, the template filled in, the
// agent's response in character. It's the payoff of the whole store: you don't
// just receive a document, you use the product right here.
//
// It is gated to buyers. The request carries the Stripe Checkout session_id the
// buyer already holds (the success page and the re-openable order link both have
// it); we re-verify with Stripe on every call that the session is paid AND that
// it actually contains the SKU being run, so the endpoint can never be used to
// run a product for free. This mirrors how /api/order hands over deliverables.
//
// It uses Anthropic (Claude) through Netlify AI Gateway — no API key management.
// The output streams as newline-delimited JSON so the app renders it live. If
// the gateway isn't active yet (it needs one production deploy) or the model
// errors before any text streams, it returns a clear, honest message and points
// the buyer at the Markdown download they also received.
//
// Reachable at /api/run-product via the /api/* rewrite in netlify.toml.

import Stripe from 'stripe'
import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { fulfilOrder } from '../lib/fulfillment.mjs'
import { buildProductApp, buildRunPrompt } from '../lib/product-app.mjs'
import type { Product } from '../lib/catalog.mjs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

const MODEL = 'claude-opus-4-8' // the flagship — the app is the paid experience
const MAX_TOKENS = 1400

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'This feature is not configured.' }, { status: 500 })
  }

  let sessionId = ''
  let sku = ''
  let inputs: Record<string, string> = {}
  try {
    const body = await req.json()
    sessionId = String(body?.session_id ?? '').trim()
    sku = String(body?.sku ?? '').trim().slice(0, 32)
    const raw = body?.inputs
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        inputs[String(k).slice(0, 40)] = String(v ?? '').slice(0, 4000)
      }
    }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: 'Invalid session id' }, { status: 400 })
  }
  if (!sku) return Response.json({ error: 'A product SKU is required.' }, { status: 400 })

  // Verify the buyer actually owns this product before running it.
  let product: Product | undefined
  try {
    const { paid, items } = await fulfilOrder(stripe, sessionId)
    if (!paid) {
      return Response.json({ error: 'This order is not paid.' }, { status: 402 })
    }
    product = items.find((it) => it.product.sku === sku)?.product
    if (!product) {
      return Response.json({ error: 'That product is not part of this order.' }, { status: 403 })
    }
  } catch (err) {
    console.error('run-product ownership check failed:', (err as Error).message)
    return Response.json({ error: 'Unable to verify your order right now.' }, { status: 400 })
  }

  const app = buildProductApp(product)
  const prompt = buildRunPrompt(product, app, inputs)
  if (!prompt) {
    return Response.json({ error: 'Fill in at least one field so it has something to work with.' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      send({ type: 'meta', verb: app.runVerb })

      let full = ''
      try {
        const anthropic = new Anthropic()
        const modelStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        })

        for await (const event of modelStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text
            send({ type: 'text', text: event.delta.text })
          }
        }
      } catch (err) {
        console.error('run-product engine failed:', (err as Error).message)
        if (!full.trim()) {
          send({
            type: 'error',
            text:
              'The live engine is warming up (it activates after the first production deploy). ' +
              'In the meantime, your full item is in the Markdown download below.',
          })
        } else {
          send({ type: 'text', text: '\n\n(Cut off there — run it again for the full result.)' })
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
      // Tied to one buyer's session and their own input — never cache.
      'Cache-Control': 'private, no-store',
    },
  })
}

export const config: Config = {
  path: '/api/run-product',
}
