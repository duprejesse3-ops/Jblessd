// Shared tenant auth for the MultiNiche Ads network. Used by the bearer-key
// endpoints (ads-network-slots.mts, ads-network-campaigns.mts) and, via
// tenantById, by ads-network-autopilot.mts which runs first-party on a
// schedule and doesn't have an HTTP Authorization header to read.
//
// Keys are never stored — only a sha256 hash, the same pattern used
// elsewhere in this codebase (see the credits-account key handling). A key
// looks like "mnads_<random>"; only its hash ever touches the database.

import { getDatabase } from '@netlify/database'
import { createHash } from 'node:crypto'

export interface Tenant {
  id: number
  name: string
  email: string
  siteUrl: string
  status: string
}

function hashKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}

// Reads a tenant key from either the standard Authorization: Bearer header
// or the x-ads-key header (some embed/webhook clients can't set a custom
// Authorization header easily, so x-ads-key is the fallback).
export function readTenantKey(req: Request): string {
  const auth = req.headers.get('authorization') ?? ''
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch) return bearerMatch[1].trim()
  return (req.headers.get('x-ads-key') ?? '').trim()
}

export async function tenantForKey(key: string): Promise<Tenant | null> {
  if (!key) return null
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, name, email, site_url, status FROM ads_tenants
    WHERE key_hash = ${hashKey(key)} AND status = 'active'
    LIMIT 1
  `) as any[]
  if (!rows.length) return null
  const t = rows[0]
  return { id: t.id, name: t.name, email: t.email, siteUrl: t.site_url, status: t.status }
}

// Used by ads-network-autopilot.mts, which already knows which tenant it's
// acting as (the seeded self-tenant) and doesn't need key verification for a
// first-party scheduled job.
export async function tenantById(id: number): Promise<Tenant | null> {
  const db = getDatabase()
  const rows = (await db.sql`
    SELECT id, name, email, site_url, status FROM ads_tenants WHERE id = ${id} LIMIT 1
  `) as any[]
  if (!rows.length) return null
  const t = rows[0]
  return { id: t.id, name: t.name, email: t.email, siteUrl: t.site_url, status: t.status }
}

// Fire-and-forget last-seen tracking — never blocks or fails the caller.
export function touchTenant(id: number): void {
  const db = getDatabase()
  db.sql`UPDATE ads_tenants SET last_seen_at = now() WHERE id = ${id}`.catch((err: Error) =>
    console.error('touchTenant failed:', err.message),
  )
}
