// Maps a SKU to a downloadable archive of real files.
//
// Most products in this store are documents, and the Markdown deliverable plus
// the self-contained HTML "app" file covers them completely. One product is
// software — the Site Audit Agent (AI-AG-065) — and for that the buyer needs a
// directory of files they can unzip and run, not a document they have to
// transcribe.
//
// This keeps the mapping in one place so the download endpoint stays a thin
// authorisation wrapper, and so adding a second source-code product later means
// adding one entry here rather than touching the endpoint.

import { SITE_AUDIT_SOURCE } from './site-audit-source.mjs'
import { MULTICONNECT_WEBHOOK_BRIDGE_SOURCE } from './multiconnect-webhook-bridge-source.mjs'
import { MULTICONNECT_SHOPIFY_SOURCE } from './multiconnect-shopify-source.mjs'
import { MULTICONNECT_SHEETS_AIRTABLE_SOURCE } from './multiconnect-sheets-airtable-source.mjs'
import { MULTICONNECT_EMAIL_CRM_SOURCE } from './multiconnect-email-crm-source.mjs'
import { MULTICONNECT_SLACK_DISCORD_SOURCE } from './multiconnect-slack-discord-source.mjs'
import { MULTIWITNESS_SOURCE } from './multiwitness-source.mjs'
import { buildZip, type ArchiveFile } from './zip.mjs'

export interface ProductArchive {
  filename: string
  bytes: Buffer
}

// Files that have to arrive with the executable bit set. Everything else in an
// archive unzips 0644. Paths are relative to the package root, before the
// top-level directory is prefixed on.
const EXECUTABLE = new Set(['bin/audit.mjs', 'adapters/cron.sh', 'install.sh'])
const BRIDGE_EXECUTABLE = new Set(['bin/bridge.mjs', 'install.sh'])
const SHOPIFY_EXECUTABLE = new Set(['bin/shopify-connect.mjs', 'install.sh'])
const SHEETS_EXECUTABLE = new Set(['bin/sheets-connect.mjs', 'install.sh'])
const EMAIL_EXECUTABLE = new Set(['bin/email-connect.mjs', 'install.sh'])
const MESSAGING_EXECUTABLE = new Set(['bin/messaging-connect.mjs', 'install.sh'])
const WITNESS_EXECUTABLE = new Set(['bin/witness.mjs', 'install.sh'])

// Unzipping into a single top-level directory rather than spraying thirteen
// files into whatever the buyer's cwd happens to be. Standard courtesy, and it
// means `unzip site-audit-agent.zip && cd site-audit-agent` just works.
const ROOT = 'site-audit-agent'
const BRIDGE_ROOT = 'multiconnect-webhook-bridge'
const SHOPIFY_ROOT = 'multiconnect-shopify'
const SHEETS_ROOT = 'multiconnect-sheets-airtable'
const EMAIL_ROOT = 'multiconnect-email-crm'
const MESSAGING_ROOT = 'multiconnect-slack-discord'
const WITNESS_ROOT = 'multiwitness'

function siteAuditFiles(): ArchiveFile[] {
  return SITE_AUDIT_SOURCE.map((file) => ({
    path: `${ROOT}/${file.path}`,
    contents: file.contents,
    executable: EXECUTABLE.has(file.path),
  }))
}

function webhookBridgeFiles(): ArchiveFile[] {
  return MULTICONNECT_WEBHOOK_BRIDGE_SOURCE.map((file) => ({
    path: `${BRIDGE_ROOT}/${file.path}`,
    contents: file.contents,
    executable: BRIDGE_EXECUTABLE.has(file.path),
  }))
}

function shopifyFiles(): ArchiveFile[] {
  return MULTICONNECT_SHOPIFY_SOURCE.map((file) => ({
    path: `${SHOPIFY_ROOT}/${file.path}`,
    contents: file.contents,
    executable: SHOPIFY_EXECUTABLE.has(file.path),
  }))
}

function sheetsFiles(): ArchiveFile[] {
  return MULTICONNECT_SHEETS_AIRTABLE_SOURCE.map((file) => ({
    path: `${SHEETS_ROOT}/${file.path}`,
    contents: file.contents,
    executable: SHEETS_EXECUTABLE.has(file.path),
  }))
}

function emailFiles(): ArchiveFile[] {
  return MULTICONNECT_EMAIL_CRM_SOURCE.map((file) => ({
    path: `${EMAIL_ROOT}/${file.path}`,
    contents: file.contents,
    executable: EMAIL_EXECUTABLE.has(file.path),
  }))
}

function messagingFiles(): ArchiveFile[] {
  return MULTICONNECT_SLACK_DISCORD_SOURCE.map((file) => ({
    path: `${MESSAGING_ROOT}/${file.path}`,
    contents: file.contents,
    executable: MESSAGING_EXECUTABLE.has(file.path),
  }))
}

function witnessFiles(): ArchiveFile[] {
  return MULTIWITNESS_SOURCE.map((file) => ({
    path: `${WITNESS_ROOT}/${file.path}`,
    contents: file.contents,
    executable: WITNESS_EXECUTABLE.has(file.path),
  }))
}

const ARCHIVES: Record<string, { filename: string; files: () => ArchiveFile[] }> = {
  'AI-AG-065': { filename: 'site-audit-agent.zip', files: siteAuditFiles },
  'AI-CN-001': { filename: 'multiconnect-webhook-bridge.zip', files: webhookBridgeFiles },
  'AI-CN-002': { filename: 'multiconnect-shopify.zip', files: shopifyFiles },
  'AI-CN-003': { filename: 'multiconnect-sheets-airtable.zip', files: sheetsFiles },
  'AI-CN-004': { filename: 'multiconnect-email-crm.zip', files: emailFiles },
  'AI-CN-005': { filename: 'multiconnect-slack-discord.zip', files: messagingFiles },
  'AI-CN-006': { filename: 'multiwitness.zip', files: witnessFiles },
}

/** Whether this SKU ships a downloadable archive in addition to its document. */
export function hasArchive(sku: string): boolean {
  return Object.prototype.hasOwnProperty.call(ARCHIVES, sku)
}

/** The download filename for a SKU's archive, or null if it has none. */
export function archiveFilename(sku: string): string | null {
  return ARCHIVES[sku]?.filename ?? null
}

/**
 * Build the archive for a SKU. Returns null for a SKU that has none, so the
 * caller can 404 rather than hand back an empty zip.
 *
 * Deterministic: the same SKU always produces byte-identical output, so the
 * response is safe to cache and the buyer can verify a checksum.
 */
export function buildProductArchive(sku: string): ProductArchive | null {
  const spec = ARCHIVES[sku]
  if (!spec) return null
  return { filename: spec.filename, bytes: buildZip(spec.files()) }
}
