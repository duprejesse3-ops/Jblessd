// Netlify Function: POST /api/inbound-email
// Resend calls this endpoint when an email arrives at any @multinicheai.com
// address (via the inbound MX record). The webhook payload is metadata
// only — sender, recipients, subject, attachment filenames — so the full
// body is fetched separately via resend.emails.receiving.get().
//
// Set RESEND_WEBHOOK_SECRET in Netlify environment variables to the signing
// secret Resend gives you when you register this endpoint (starts with
// "whsec_"). Uses the same RESEND_API_KEY already configured for sending.

import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY as string)

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  const rawBody = await req.text()

  let event: any
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET as string,
    })
  } catch (err) {
    console.error('inbound-email: signature verification failed —', (err as Error).message)
    return new Response('Invalid signature', { status: 401 })
  }

  if (event.type !== 'email.received') {
    return Response.json({ received: true })
  }

  await storeInboundEmail(event.data)

  return Response.json({ received: true })
}

// Fetches the full body/attachments (not included in the webhook payload)
// and persists the message. Deduplicated on email_id so Resend's automatic
// webhook retries can't create duplicate rows. Never throws — a storage
// hiccup shouldn't fail the webhook response, since Resend will just retry.
async function storeInboundEmail(data: any): Promise<void> {
  try {
    const { data: full, error } = await resend.emails.receiving.get(data.email_id)
    if (error) {
      console.error('inbound-email: could not fetch full email —', error.message)
    }

    const attachments = (data.attachments || []).map((a: any) => ({
      filename: a.filename,
      content_type: a.content_type,
    }))

    const db = getDatabase()
    await db.sql`
      INSERT INTO inbound_emails (
        message_id, from_address, to_address, subject, text_body, html_body, attachments
      ) VALUES (
        ${data.email_id}, ${data.from}, ${(data.to ?? []).join(', ')}, ${data.subject},
        ${full?.text ?? null}, ${full?.html ?? null}, ${JSON.stringify(attachments)}
      )
      ON CONFLICT (message_id) DO NOTHING
    `
  } catch (err) {
    console.error('inbound-email: could not store message —', (err as Error).message)
  }
}
