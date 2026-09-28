// Netlify Function: POST /api/fieldhand-draft
//
// Backend for the Fieldhand contractor-letter tool (packages/fieldhand/), so
// drafting works from the *downloaded* offline fieldhand.html too, not just
// the live claude.ai artifact. The artifact's window.claude.use('sample') API
// only exists inside the claude.ai viewer; a saved HTML file has nothing to
// call. This function is the substitute: the page fetches this endpoint
// directly (Claude API access lives here, server-side, same as /api/chat's
// Netlify AI Gateway setup — no key management), so drafting/extraction work
// from any browser with internet, artifact or not.
//
// Two modes, both POST JSON:
//   { mode: 'extract', prompt, images? } -> non-streaming: { json: {...} }
//   { mode: 'draft', prompt, images? }   -> streaming ndjson lines:
//       {type:'text', text: '<delta>'} ... {type:'error', message} ... {type:'done'}
// images: [{ mediaType, data }] where data is base64 (no "data:" prefix).
//
// Public and unauthenticated — Fieldhand is a downloadable, single-purchase
// product with no login system — so this is rate-limited per IP the same way
// /api/chat is. CORS is wide open (Access-Control-Allow-Origin: *) because the
// caller is often a file:// page (a downloaded copy of fieldhand.html), which
// sends Origin: null and can only be matched by a wildcard.

import type { Context, Config } from '@netlify/functions'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '../lib/rate-limit.mjs'

const MODEL = 'claude-sonnet-5'
const QUICK_MODEL = 'claude-haiku-4-5'
const MAX_PROMPT_CHARS = 20000
const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // Claude's per-image ceiling is ~5MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface ImageIn {
  mediaType?: string
  data?: string
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, ...extraHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function buildImageBlocks(images: unknown): Anthropic.ImageBlockParam[] {
  if (!Array.isArray(images)) return []
  return (images as ImageIn[])
    .filter(
      (img): img is Required<ImageIn> =>
        !!img &&
        typeof img.data === 'string' &&
        typeof img.mediaType === 'string' &&
        ALLOWED_IMAGE_TYPES.has(img.mediaType) &&
        img.data.length * 0.75 <= MAX_IMAGE_BYTES,
    )
    .slice(0, MAX_IMAGES)
    .map((img) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType as Anthropic.Base64ImageSource['media_type'], data: img.data },
    }))
}

export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
  }

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
  const limit = await checkRateLimit('fieldhand-draft', ip, { limit: 30, windowMs: 60 * 60 * 1000 })
  if (!limit.allowed) {
    return json(
      { error: 'Too many drafts this hour. Please try again shortly.' },
      429,
      { 'Retry-After': String(limit.retryAfterSec) },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const mode = body?.mode === 'extract' ? 'extract' : 'draft'
  const prompt = typeof body?.prompt === 'string' ? body.prompt.slice(0, MAX_PROMPT_CHARS) : ''
  if (!prompt) return json({ error: 'Missing prompt' }, 400)

  const imageBlocks = buildImageBlocks(body?.images)
  const content: Anthropic.MessageParam['content'] = imageBlocks.length
    ? [...imageBlocks, { type: 'text', text: prompt }]
    : prompt

  if (mode === 'extract') {
    try {
      const anthropic = new Anthropic()
      const msg = await anthropic.messages.create({
        model: QUICK_MODEL,
        max_tokens: 1024,
        system: 'Reply with ONLY a single valid JSON object. No markdown fences, no commentary before or after it.',
        messages: [{ role: 'user', content }],
      })
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      let parsed: unknown = null
      try {
        parsed = JSON.parse(text)
      } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          try {
            parsed = JSON.parse(match[0])
          } catch {
            parsed = null
          }
        }
      }
      if (!parsed || typeof parsed !== 'object') return json({ error: 'Could not parse extraction' }, 502)
      return json({ json: parsed }, 200)
    } catch (err) {
      console.error('fieldhand-draft extract failed:', (err as Error).message)
      return json({ error: 'Extraction failed' }, 502)
    }
  }

  // mode === 'draft': stream the letter back as ndjson text deltas.
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      try {
        const anthropic = new Anthropic()
        const modelStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system:
            'You are ghostwriting a piece of contractor business correspondence. Follow the instructions in the ' +
            'user message exactly, including its length and tone guidance. Output only the letter body text — no ' +
            'preamble, no commentary, no markdown formatting.',
          messages: [{ role: 'user', content }],
        })
        for await (const event of modelStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'text', text: event.delta.text })
          }
        }
        await modelStream.finalMessage()
      } catch (err) {
        console.error('fieldhand-draft failed:', (err as Error).message)
        send({ type: 'error', message: 'Drafting failed. Please try again.' })
      } finally {
        send({ type: 'done' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

export const config: Config = {
  path: '/api/fieldhand-draft',
}
