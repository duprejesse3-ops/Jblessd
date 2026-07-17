// Netlify Forms function trigger: fires on every *verified* form submission
// (the filename `submission-created` is the event binding — Netlify invokes it
// automatically; it is not reachable via a URL/path).
//
// For the storefront's "Contact us" form this persists the message to the
// `contact_messages` table, so the site owner has a durable, queryable record
// in addition to whatever Netlify Forms stores and emails. Submissions from any
// other form are acknowledged and ignored. Persistence failures are logged but
// never surfaced as an error, so a transient DB hiccup can't cause Netlify to
// retry or drop the (already-stored) submission.

import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

interface FormPayload {
  form_name: string
  data?: Record<string, string>
  created_at?: string
}

export default async (req: Request, _context: Context) => {
  let payload: FormPayload | undefined
  try {
    const body = (await req.json()) as { payload?: FormPayload }
    payload = body.payload
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Only the contact form is persisted here; acknowledge everything else so
  // Netlify marks the event handled.
  if (!payload || payload.form_name !== 'contact') {
    return new Response('OK')
  }

  const data = payload.data ?? {}
  const name = String(data.name ?? '').trim().slice(0, 200)
  const email = String(data.email ?? '').trim().slice(0, 254)
  const message = String(data.message ?? '').trim().slice(0, 5000)
  const subject = String(data.subject ?? '').trim().slice(0, 200) || null

  // Nothing worth storing (Netlify already filters spam/honeypot hits before
  // this trigger fires, but stay defensive). Acknowledge regardless.
  if (!email || !message) {
    return new Response('OK')
  }

  try {
    const db = getDatabase()
    await db.sql`
      INSERT INTO contact_messages (name, email, message, subject, source)
      VALUES (${name}, ${email}, ${message}, ${subject}, 'contact-form')
    `
  } catch (err) {
    console.error('submission-created: could not persist contact message —', (err as Error).message)
  }

  return new Response('OK')
}
