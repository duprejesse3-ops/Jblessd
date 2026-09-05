// Netlify Function: /api/ads/network/slots
//
// A tenant's own ad space, offered to the network. GET lists their slots,
// POST creates one. Auth: bearer key (Authorization: Bearer mnads_… or
// x-ads-key) — the same MultiNiche Ads tenant key as ads-connect and
// ads/publish, not the admin cookie.
//
// Reachable at /api/ads/network/slots.

import type { Context, Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import { randomBytes } from 'node:crypto'
import { readTenantKey, tenantForKey, touchTenant } from '../lib/ads-tenants.mjs'

const NO_STORE = { 'Cache-Control': 'no-store' }

export default async (req: Request, _context: Context) => {
  const key = readTenantKey(req)
  const tenant = await tenantForKey(key)
  if (!tenant) {
    return Response.json({ error: 'Not authorized. Missing or invalid access key.' }, { status: 401, headers: NO_STORE })
  }
  void touchTenant(tenant.id)

  const db = getDatabase()

  if (req.method === 'GET') {
    try {
      const rows = (await db.sql`
        SELECT id, slot_key, site_url, label, niche, status, created_at
        FROM ads_network_slots WHERE tenant_id = ${tenant.id} ORDER BY created_at DESC
      `) as any[]
      return Response.json({ slots: rows }, { headers: NO_STORE })
    } catch (err) {
      console.error('ads-network-slots GET error:', (err as Error).message)
      return Response.json({ slots: [] }, { headers: NO_STORE })
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } })
  }

  let siteUrl = ''
  let label = ''
  let niche = ''
  try {
    const body = await req.json()
    siteUrl = String(body?.siteUrl ?? '').trim().slice(0, 300)
    label = String(body?.label ?? '').trim().slice(0, 120)
    niche = String(body?.niche ?? '').trim().slice(0, 40)
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: NO_STORE })
  }

  if (!siteUrl) return Response.json({ error: 'siteUrl is required.' }, { status: 400, headers: NO_STORE })

  const slotKey = 'slot_' + randomBytes(10).toString('base64url')

  try {
    const [row] = (await db.sql`
      INSERT INTO ads_network_slots (tenant_id, slot_key, site_url, label, niche)
      VALUES (${tenant.id}, ${slotKey}, ${siteUrl}, ${label || null}, ${niche || null})
      RETURNING id, slot_key, site_url, label, niche, status, created_at
    `) as any[]

    return Response.json(
      {
        slot: row,
        embedSnippet:
          `<script src="https://multinicheai.com/ads-network-embed.js" ` +
          `data-slot="${row.slot_key}" data-container-id="mnads-${row.slot_key}"></script>` +
          `<div id="mnads-${row.slot_key}"></div>`,
      },
      { status: 201, headers: NO_STORE },
    )
  } catch (err) {
    console.error('ads-network-slots POST error:', (err as Error).message)
    return Response.json({ error: 'Could not create the slot right now.' }, { status: 503, headers: NO_STORE })
  }
}

export const config: Config = {
  path: '/api/ads/network/slots',
}
