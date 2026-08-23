// Shared tenant auth for the MultiNiche Ads network. Used by the bearer-key
// endpoints (ads-network-slots.mts, ads-network-campaigns.mts) and, via
// tenantById, by ads-network-autopilot.mts which runs first-party on a
// schedule and doesn't have an HTTP Authorization header to read.
//
// Keys are never stored — only a sha256 hash, the same pattern used
// elsewhere in this codebase (see the credits-account key handling). A key
// looks like "mnads_<random>"; only its hash ever touches the database.
//
// Plain JavaScript (no TypeScript syntax) — this file is .mjs, and esbuild
// parses .mjs as plain JS, so any TS-only syntax (interfaces, type
// annotations) fails to bundle. Shapes are documented below with JSDoc
// instead, which .mts consumers can still see in editor tooltips without
// needing real TS syntax in this file.

import { getDatabase } from '@netlify/database'
import { createHash } from 'node:crypto'

/**
 * @typedef {Object} Tenant
 * @property {number} id
 * @property {string} name
 * @property {string} email
 * @property {string} siteUrl
 * @property {string} status
 */

function hashKey(key) {
  return createHash('sha256').update(key.trim()).digest('hex')
}

// Reads a tenant key from either the standard Authorization: Bearer header
// or the x-ads-key header (some embed/webhook clients can't set a custom
// Authorization header easily, so x-ads-key is the fallback).
export function readTenantKey(req) {
  const auth = req.headers.get('authorization') ?? ''
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch) return bearerMatch[1].trim()
  return (req.headers.get('x-ads-key') ?? '').trim()
}

/** @returns {Promise<Tenant|null>} */
export async function tenantForKey(key) {
  if (!key) return null
  const db = getDatabase()
  const rows = await db.sql`
    SELECT id, name, email, site_url, status FROM ads_tenants
    WHERE key_hash = ${hashKey(key)} AND status = 'active'
    LIMIT 1
  `
  if (!rows.length) return null
  const t = rows[0]
  return { id: t.id, name: t.name, email: t.email, siteUrl: t.site_url, status: t.status }
}

// Used by ads-network-autopilot.mts, which already knows which tenant it's
// acting as (the seeded self-tenant) and doesn't need key verification for a
// first-party scheduled job.
/** @returns {Promise<Tenant|null>} */
export async function tenantById(id) {
  const db = getDatabase()
  const rows = await db.sql`
    SELECT id, name, email, site_url, status FROM ads_tenants WHERE id = ${id} LIMIT 1
  `
  if (!rows.length) return null
  const t = rows[0]
  return { id: t.id, name: t.name, email: t.email, siteUrl: t.site_url, status: t.status }
}

// Fire-and-forget last-seen tracking — never blocks or fails the caller.
export function touchTenant(id) {
  const db = getDatabase()
  db.sql`UPDATE ads_tenants SET last_seen_at = now() WHERE id = ${id}`.catch((err) =>
    console.error('touchTenant failed:', err.message),
  )
}
