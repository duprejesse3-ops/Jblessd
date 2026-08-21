// Netlify Function: GET /api/unsubscribe?email=<base64>
//
// Linked from the footer of every nurture email. Sets the subscriber's
// unsubscribed flag so nurture-send.mts stops sending to them, regardless of
// where they are in the sequence. Base64 is obfuscation, not security — this
// endpoint only ever turns emails OFF, so there's nothing sensitive to protect.

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'

function confirmationPage(message: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>` +
      `<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333">` +
      `<h1>${message}</h1><p><a href="https://jblessd.com">Back to the store</a></p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export default async (req: Request) => {
  const encoded = new URL(req.url).searchParams.get('email') ?? ''
  let email = ''
  try {
    email = Buffer.from(encoded, 'base64').toString('utf-8').trim()
  } catch {
    return confirmationPage("That link doesn't look right.")
  }
  if (!email || !email.includes('@')) {
    return confirmationPage("That link doesn't look right.")
  }

  try {
    const db = getDatabase()
    await db.sql`UPDATE subscribers SET unsubscribed = true, next_email_at = NULL WHERE lower(email) = lower(${email})`
  } catch (err) {
    console.error('unsubscribe: update failed —', (err as Error).message)
    return confirmationPage("Something went wrong — try again in a moment.")
  }

  return confirmationPage("You're unsubscribed.")
}

export const config: Config = {
  path: '/api/unsubscribe',
}
