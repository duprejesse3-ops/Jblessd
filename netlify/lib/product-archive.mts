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
import { INCIDENT_POSTMORTEM_SOURCE } from './incident-postmortem-source.mjs'
import { CODE_REVIEW_DIGEST_SOURCE } from './code-review-digest-source.mjs'
import { RELEASE_NOTES_BOT_SOURCE } from './release-notes-bot-source.mjs'
import { ARCHITECTURE_DIAGRAM_SYNC_SOURCE } from './architecture-diagram-sync-source.mjs'
import { MERIDIAN_HOST_SOURCE } from './meridian-host-source.mjs'
import { MERIDIAN_GATE_SOURCE } from './meridian-gate-source.mjs'
import { MULTICONNECT_WEBHOOK_BRIDGE_SOURCE } from './multiconnect-webhook-bridge-source.mjs'
import { MULTICONNECT_SHOPIFY_SOURCE } from './multiconnect-shopify-source.mjs'
import { MULTICONNECT_SHEETS_AIRTABLE_SOURCE } from './multiconnect-sheets-airtable-source.mjs'
import { MULTICONNECT_EMAIL_CRM_SOURCE } from './multiconnect-email-crm-source.mjs'
import { MULTICONNECT_SLACK_DISCORD_SOURCE } from './multiconnect-slack-discord-source.mjs'
import { MULTIWITNESS_SOURCE } from './multiwitness-source.mjs'
import { MULTIGUARD_SOURCE } from './multiguard-source.mjs'
import { MULTIBOT_SOURCE } from './multibot-source.mjs'
import { FIELDHAND_SOURCE } from './fieldhand-source.mjs'
import { buildZip, type ArchiveFile } from './zip.mjs'

export interface ProductArchive {
  filename: string
  bytes: Buffer
}

// Files that have to arrive with the executable bit set. Everything else in an
// archive unzips 0644. Paths are relative to the package root, before the
// top-level directory is prefixed on.
const EXECUTABLE = new Set(['bin/audit.mjs', 'adapters/cron.sh', 'install.sh'])
const POSTMORTEM_EXECUTABLE = new Set(['bin/postmortem.mjs', 'adapters/pagerduty-webhook.mjs', 'install.sh'])
const DIGEST_EXECUTABLE = new Set(['bin/digest.mjs'])
const RELEASE_NOTES_EXECUTABLE = new Set(['bin/release-notes.mjs'])
const DIAGRAM_SYNC_EXECUTABLE = new Set(['bin/diagram-sync.mjs'])
const MERIDIAN_HOST_EXECUTABLE = new Set([
  'multinicheai',
  '_lib.sh',
  'from-github.sh',
  'firewall.sh',
  'laptop.sh',
  'bootstrap.sh',
  'forward.sh',
  'share.sh',
  'install.sh',
  'uninstall.sh',
  'run.sh',
])
const MERIDIAN_GATE_EXECUTABLE = new Set(['bin/gate.mjs', 'install.sh'])
const BRIDGE_EXECUTABLE = new Set(['bin/bridge.mjs', 'install.sh'])
const SHOPIFY_EXECUTABLE = new Set(['bin/shopify-connect.mjs', 'install.sh'])
const SHEETS_EXECUTABLE = new Set(['bin/sheets-connect.mjs', 'install.sh'])
const EMAIL_EXECUTABLE = new Set(['bin/email-connect.mjs', 'install.sh'])
const MESSAGING_EXECUTABLE = new Set(['bin/messaging-connect.mjs', 'install.sh'])
const WITNESS_EXECUTABLE = new Set(['bin/witness.mjs', 'install.sh'])
const GUARD_EXECUTABLE = new Set(['bin/guard.mjs', 'install.sh'])
// MultiBøT ships as plain Python for the CLI, invoked as `python3
// multibot.py`, plus a gui.py desktop app and platform build scripts. Only
// the shell/batch build scripts need the executable bit — the .py files
// are run via `python3 file.py`, never executed directly.
const MULTIBOT_EXECUTABLE = new Set(['build_linux.sh', 'build_mac.sh', 'build_windows.bat'])

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
const GUARD_ROOT = 'multiguard'
const MULTIBOT_ROOT = 'multibot'
const POSTMORTEM_ROOT = 'incident-postmortem-automation'
const DIGEST_ROOT = 'code-review-digest'
const RELEASE_NOTES_ROOT = 'release-notes-bot'
const DIAGRAM_SYNC_ROOT = 'architecture-diagram-sync'
const MERIDIAN_HOST_ROOT = 'meridian-host'
const MERIDIAN_GATE_ROOT = 'meridian-gate'
// Fieldhand ships as a single self-contained HTML file plus a README — no
// scripts to mark executable.
const FIELDHAND_ROOT = 'fieldhand'

function siteAuditFiles(): ArchiveFile[] {
  return SITE_AUDIT_SOURCE.map((file) => ({
    path: `${ROOT}/${file.path}`,
    contents: file.contents,
    executable: EXECUTABLE.has(file.path),
  }))
}

function postmortemFiles(): ArchiveFile[] {
  return INCIDENT_POSTMORTEM_SOURCE.map((file) => ({
    path: `${POSTMORTEM_ROOT}/${file.path}`,
    contents: file.contents,
    executable: POSTMORTEM_EXECUTABLE.has(file.path),
  }))
}

function digestFiles(): ArchiveFile[] {
  return CODE_REVIEW_DIGEST_SOURCE.map((file) => ({
    path: `${DIGEST_ROOT}/${file.path}`,
    contents: file.contents,
    executable: DIGEST_EXECUTABLE.has(file.path),
  }))
}

function releaseNotesFiles(): ArchiveFile[] {
  return RELEASE_NOTES_BOT_SOURCE.map((file) => ({
    path: `${RELEASE_NOTES_ROOT}/${file.path}`,
    contents: file.contents,
    executable: RELEASE_NOTES_EXECUTABLE.has(file.path),
  }))
}

function diagramSyncFiles(): ArchiveFile[] {
  return ARCHITECTURE_DIAGRAM_SYNC_SOURCE.map((file) => ({
    path: `${DIAGRAM_SYNC_ROOT}/${file.path}`,
    contents: file.contents,
    executable: DIAGRAM_SYNC_EXECUTABLE.has(file.path),
  }))
}

function meridianHostFiles(): ArchiveFile[] {
  return MERIDIAN_HOST_SOURCE.map((file) => ({
    path: `${MERIDIAN_HOST_ROOT}/${file.path}`,
    contents: file.contents,
    executable: MERIDIAN_HOST_EXECUTABLE.has(file.path),
  }))
}

function meridianGateFiles(): ArchiveFile[] {
  return MERIDIAN_GATE_SOURCE.map((file) => ({
    path: `${MERIDIAN_GATE_ROOT}/${file.path}`,
    contents: file.contents,
    executable: MERIDIAN_GATE_EXECUTABLE.has(file.path),
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

function guardFiles(): ArchiveFile[] {
  return MULTIGUARD_SOURCE.map((file) => ({
    path: `${GUARD_ROOT}/${file.path}`,
    contents: file.contents,
    executable: GUARD_EXECUTABLE.has(file.path),
  }))
}

function multibotFiles(): ArchiveFile[] {
  return MULTIBOT_SOURCE.map((file) => ({
    path: `${MULTIBOT_ROOT}/${file.path}`,
    contents: file.contents,
    executable: MULTIBOT_EXECUTABLE.has(file.path),
  }))
}

function fieldhandFiles(): ArchiveFile[] {
  return FIELDHAND_SOURCE.map((file) => ({
    path: `${FIELDHAND_ROOT}/${file.path}`,
    contents: file.contents,
    executable: false,
  }))
}

const ARCHIVES: Record<string, { filename: string; files: () => ArchiveFile[] }> = {
  'AI-AG-065': { filename: 'site-audit-agent.zip', files: siteAuditFiles },
  'AI-AB-037': { filename: 'incident-postmortem-automation.zip', files: postmortemFiles },
  'AI-AB-013': { filename: 'code-review-digest.zip', files: digestFiles },
  'AI-AB-028': { filename: 'release-notes-bot.zip', files: releaseNotesFiles },
  'AI-AB-034': { filename: 'architecture-diagram-sync.zip', files: diagramSyncFiles },
  'AI-HOST-001': { filename: 'meridian-host.zip', files: meridianHostFiles },
  'AI-HOST-002': { filename: 'meridian-gate.zip', files: meridianGateFiles },
  'AI-CN-001': { filename: 'multiconnect-webhook-bridge.zip', files: webhookBridgeFiles },
  'AI-CN-002': { filename: 'multiconnect-shopify.zip', files: shopifyFiles },
  'AI-CN-003': { filename: 'multiconnect-sheets-airtable.zip', files: sheetsFiles },
  'AI-CN-004': { filename: 'multiconnect-email-crm.zip', files: emailFiles },
  'AI-CN-005': { filename: 'multiconnect-slack-discord.zip', files: messagingFiles },
  'AI-CN-006': { filename: 'multiwitness.zip', files: witnessFiles },
  'AI-CN-007': { filename: 'multiguard.zip', files: guardFiles },
  'AI-AG-067': { filename: 'multibot.zip', files: multibotFiles },
  'AI-AG-118': { filename: 'fieldhand.zip', files: fieldhandFiles },
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
