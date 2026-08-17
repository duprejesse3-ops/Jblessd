// Netlify Function: POST /api/inbound-email
// Resend calls this endpoint when an email arrives at any @jblessd.com
// address (via the inbound MX record). Verifies the request actually came
// from Resend using their svix-based webhook signature, then stores the
// message for later use.
//
// Set RESEND_WEBHOOK_SECRET in Netlify environment variables to the signing
// secret Resend gives you when you register this endpoint (starts with
// "whsec_").

import type { Context } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    })
  }

  const rawBody = await req.text()

  const verified = await verifyResendSignature(req, rawBody)
  if (!verified) {
    console.error('inbound-email: signature verification failed')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch (err) {
    console.error('inbound-email: could not parse payload —', (err as Error).message)
    return new Response('Bad request', { status: 400 })
  }

  // Only inbound mail events matter here; ignore anything else Resend might
  // send to the same endpoint in the future.
  if (payload.type !== 'email.received') {
    return Response.json({ received: true })
  }

  await storeInboundEmail(payload.data)

  return Response.json({ received: true })
}

// Persist the inbound message. Deduplicated on message_id so Resend's
// automatic webhook retries can't create duplicate rows. Never throws —
// a storage hiccup shouldn't turn into a failed webhook response, since
// Resend will just retry and hit the same dedupe path.
async function storeInboundEmail(email: any): Promise<void> {
  try {
    const attachments = (email.attachments || []).map((a: any) => ({
      filename: a.filename,
      content_type: a.content_type,
      size: a.content?.length ?? null,
    }))

    const db = getDatabase()
    await db.sql`
      INSERT INTO inbound_emails (
        message_id, from_address, to_address, subject, text_body, html_body, attachments
      ) VALUES (
        ${email.message_id}, ${email.from}, ${email.to}, ${email.subject},
        ${email.text ?? null}, ${email.html ?? null}, ${JSON.stringify(attachments)}
      )
      ON CONFLICT (message_id) DO NOTHING
    `
  } catch (err) {
    console.error('inbound-email: could not store message —', (err as Error).message)
  }
}

// Resend signs webhooks the same way Svix does: HMAC-SHA256 over
// "{id}.{timestamp}.{body}" using the base64 portion of the whsec_ secret.
async function verifyResendSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const secretBytes = base64ToBytes(secret.split('_')[1] ?? secret)

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expected = bytesToBase64(new Uint8Array(sigBytes))

  return svixSignature
    .split(' ')
    .map((s) => s.split(',')[1])
    .includes(expected)
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}
