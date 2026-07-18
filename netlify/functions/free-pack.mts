// Netlify Function: /api/free-pack
//   POST { email } — the storefront's "Get a free prompt pack" lead magnet.
//
// This replaces the old Netlify Form flow. Netlify Forms only *stored* the
// email (and could notify the site owner) — it never delivered anything to the
// person who signed up, so subscribers were promised a pack and received
// nothing. This endpoint fixes that: it persists the signup to the database and
// returns the pack in the same response, so the storefront can hand it over
// instantly (rendered on the page plus a Markdown download). No email provider
// is required for the subscriber to actually receive the prompts.
//
// Reachable at /api/free-pack via the /api/* rewrite in netlify.toml.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { FREE_PACK, packToMarkdown } from '../lib/free-pack.mjs'
import { sendEmail } from '../lib/email.mjs'

// Pragmatic email check — good enough to reject typos and honeypot junk without
// bouncing valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  // Accept both JSON and form-encoded bodies so the endpoint is easy to call.
  let email = ''
  let botField = ''
  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as Record<string, unknown>
      email = String(body.email ?? '').trim()
      botField = String(body['bot-field'] ?? '').trim()
    } else {
      const form = new URLSearchParams(await req.text())
      email = (form.get('email') ?? '').trim()
      botField = (form.get('bot-field') ?? '').trim()
    }
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot: real users leave this empty. Pretend success so bots learn nothing.
  if (botField) {
    return Response.json({ ok: true, pack: FREE_PACK, markdown: packToMarkdown(FREE_PACK) })
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  // Persist the signup. Delivery does not depend on this succeeding — if the DB
  // is briefly unavailable we still hand over the pack rather than failing the
  // user, and just log the miss.
  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO subscribers (email, source)
      VALUES (${email}, 'free-pack')
      ON CONFLICT (lower(email)) DO UPDATE
        SET request_count = subscribers.request_count + 1,
            last_requested_at = now()
    `
  } catch (err) {
    console.error('free-pack: could not persist subscriber —', (err as Error).message)
  }

  // Also *email* the pack to the subscriber, so the promise ("we'll send you a
  // pack") is kept even after they close the tab — not just handed back in this
  // response. Fire-and-forget: the on-page delivery below never waits on it, and
  // if no email provider is configured the sender is a graceful no-op.
  const emailBody =
    `Here's your ${FREE_PACK.title} — five prompts to run your day like an operator.\n\n` +
    `${FREE_PACK.intro}\n\n` +
    `${packToMarkdown(FREE_PACK)}\n\n` +
    `Want the full 120-prompt set and the rest of the catalog? Browse it at https://multinicheai.com`
  context.waitUntil(
    sendEmail({
      to: email,
      subject: `Your ${FREE_PACK.title} from MULTINICHE AI`,
      text: emailBody,
    }),
  )

  return Response.json({
    ok: true,
    pack: FREE_PACK,
    markdown: packToMarkdown(FREE_PACK),
  })
}

export const config: Config = {
  path: '/api/free-pack',
}
