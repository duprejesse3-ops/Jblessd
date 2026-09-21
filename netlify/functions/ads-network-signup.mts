// Netlify Function: POST /api/ads/network/signup
//
// The only way to become a NicheAds tenant. Before this, ads_tenants had
// exactly one row — the seeded self-tenant — and no public path to add a
// second one, despite ads-network-slots.mts/campaigns.mts already assuming
// bearer-key tenants could sign themselves up. This is that missing piece.
//
// Same "the key IS the account, no password" pattern as the Claude Agent
// Studio credits system (see credits.mts/agent.html): the raw key is
// returned exactly once, in this response. Only its sha256 hash is ever
// stored — losing the key means generating a new tenant, there is no
// recovery (same tradeoff the credits system makes, documented there too).
//
// Public and unauthenticated by design — signing up is how you get
// credentials in the first place.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { randomBytes, createHash } from 'node:crypto'

const NO_STORE = { 'Cache-Control': 'no-store' }

function hashKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
  }

  let name = ''
  let email = ''
  let siteUrl = ''
  try {
    const body = await req.json()
    name = String(body?.name ?? '').trim().slice(0, 120)
    email = String(body?.email ?? '').trim().toLowerCase().slice(0, 200)
    siteUrl = String(body?.siteUrl ?? '').trim().slice(0, 300)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  if (!name) return Response.json({ error: 'name is required.' }, { status: 400, headers: NO_STORE })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400, headers: NO_STORE })
  }
  if (!/^https?:\/\//i.test(siteUrl)) {
    return Response.json({ error: 'A valid siteUrl (http/https) is required.' }, { status: 400, headers: NO_STORE })
  }

  const key = 'mnads_' + randomBytes(24).toString('base64url')

  try {
    const db = getDatabase()
    const [row] = (await db.sql`
      INSERT INTO ads_tenants (name, email, key_hash, site_url, status)
      VALUES (${name}, ${email}, ${hashKey(key)}, ${siteUrl}, 'active')
      RETURNING id, name, email, site_url, created_at
    `) as any[]

    return Response.json(
      {
        tenant: row,
        key,
        warning: 'Save this key now — it will never be shown again, and it is the only way to authenticate as this tenant.',
      },
      { status: 201, headers: NO_STORE },
    )
  } catch (err) {
    const message = (err as Error).message
    // ads_tenants.email has a UNIQUE constraint (see the base migration).
    if (/unique/i.test(message) || /duplicate/i.test(message)) {
      return Response.json({ error: 'An account with that email already exists.' }, { status: 409, headers: NO_STORE })
    }
    console.error('ads-network-signup error:', message)
    return Response.json({ error: 'Could not create an account right now.' }, { status: 503, headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/ads/network/signup',
}
