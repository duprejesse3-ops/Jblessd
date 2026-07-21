// Single-owner admin authentication for the private AI workstation at /admin.
//
// There is no user database here — this gate is for exactly one person, the
// store owner. Access is proven by a single shared secret held in the
// ADMIN_PASSWORD environment variable (set in the Netlify site settings, never
// committed). On a correct password the owner is issued a short-lived,
// HMAC-signed session token stored in an httpOnly cookie; every protected
// endpoint re-verifies that signature server-side before doing any work.
//
// Design notes:
//   - The signing key is derived from ADMIN_PASSWORD, so rotating the password
//     instantly invalidates every outstanding session — no revocation list.
//   - The cookie is httpOnly + Secure + SameSite=Strict so it can't be read by
//     page scripts (XSS) or sent from another origin (CSRF).
//   - All comparisons (password and signature) are constant-time to avoid
//     leaking bytes through timing.
//   - If ADMIN_PASSWORD is unset the whole feature reports "not configured"
//     rather than defaulting to something guessable.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 8 // 8 hours

/** True when the owner has set an ADMIN_PASSWORD, i.e. the gate is armed. */
export function isConfigured(): boolean {
  return typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0
}

function secret(): string {
  // Callers must guard with isConfigured(); this is a defensive fallback that
  // can never validate a real session (empty password is rejected on login).
  return process.env.ADMIN_PASSWORD || ''
}

/** Constant-time string equality that never short-circuits on length. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  // timingSafeEqual requires equal-length buffers; hash both to a fixed width
  // first so a length mismatch doesn't itself become a timing signal.
  const ah = createHmac('sha256', 'len').update(ab).digest()
  const bh = createHmac('sha256', 'len').update(bb).digest()
  return timingSafeEqual(ah, bh)
}

/** Check a submitted password against ADMIN_PASSWORD in constant time. */
export function verifyPassword(candidate: string): boolean {
  if (!isConfigured() || !candidate) return false
  return safeEqual(candidate, secret())
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

/**
 * Mint a signed session token of the form `<expiryMs>.<nonce>.<sig>`.
 * `now` is injected so the caller controls the clock (functions get Date.now()).
 */
export function mintSession(now: number): string {
  const exp = now + SESSION_TTL_MS
  const nonce = createHmac('sha256', secret()).update(`${exp}:${now}`).digest('base64url').slice(0, 16)
  const payload = `${exp}.${nonce}`
  return `${payload}.${sign(payload)}`
}

/** Verify a token's signature and expiry. Returns true only for live sessions. */
export function verifySession(token: string | undefined, now: number): boolean {
  if (!isConfigured() || !token) return false
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return false
  const payload = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  if (!safeEqual(sig, sign(payload))) return false
  const exp = Number(payload.split('.')[0])
  return Number.isFinite(exp) && exp > now
}

/** Read a single cookie value from a request's Cookie header. */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

/** Convenience: is the request carrying a valid admin session cookie? */
export function isAuthed(req: Request, now: number): boolean {
  return verifySession(readCookie(req, SESSION_COOKIE), now)
}

/** Set-Cookie value that stores the session for its full lifetime. */
export function sessionCookie(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`
}

/** Set-Cookie value that immediately clears the session (logout). */
export function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
}
