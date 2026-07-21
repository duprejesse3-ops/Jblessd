// Netlify Function: /api/admin-auth
//
// The gatekeeper for the private admin workstation. It is the only endpoint
// that touches the ADMIN_PASSWORD directly; everything else trusts the signed
// session cookie it issues.
//
//   GET    — report whether the gate is configured and whether this caller is
//            already signed in. Used by /admin on load to decide login vs. app.
//   POST   — { password } → verify and, on success, set the session cookie.
//   DELETE — sign out by clearing the cookie.
//
// Brute-force is blunted with a per-IP rate limit on login attempts, reusing
// the same Blobs-backed limiter the public write endpoints use.

import type { Config, Context } from '@netlify/functions'
import {
  isConfigured,
  isAuthed,
  verifyPassword,
  mintSession,
  sessionCookie,
  clearCookie,
} from '../lib/admin-auth.mjs'
import { checkRateLimit, tooManyRequests } from '../lib/rate-limit.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }

export default async (req: Request, context: Context) => {
  const configured = isConfigured()

  if (req.method === 'GET') {
    return Response.json(
      { configured, authed: configured && isAuthed(req, Date.now()) },
      { headers: NO_STORE },
    )
  }

  if (req.method === 'DELETE') {
    return new Response(null, {
      status: 204,
      headers: { ...NO_STORE, 'Set-Cookie': clearCookie() },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST, DELETE' } })
  }

  if (!configured) {
    return Response.json(
      {
        error:
          'Admin console is not configured. Set the ADMIN_PASSWORD environment variable in your ' +
          'Netlify site settings, then redeploy.',
      },
      { status: 503, headers: NO_STORE },
    )
  }

  // Throttle guesses per IP: 8 attempts per 5 minutes.
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || undefined
  const limit = await checkRateLimit('admin-login', ip, { limit: 8, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSec, 'Too many sign-in attempts. Try again shortly.')

  let password = ''
  try {
    const body = await req.json()
    password = String(body?.password ?? '')
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  if (!verifyPassword(password)) {
    return Response.json({ error: 'Incorrect password.' }, { status: 401, headers: NO_STORE })
  }

  const token = mintSession(Date.now())
  return Response.json(
    { ok: true },
    { headers: { ...NO_STORE, 'Set-Cookie': sessionCookie(token) } },
  )
}

export const config: Config = {
  path: '/api/admin-auth',
}
