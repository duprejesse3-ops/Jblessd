// Turns a purchased digital product into a downloadable .zip archive when the
// product ships as real source code rather than a generated document (see
// netlify/lib/deliverables.mts for the Markdown-document path most SKUs use).
//
// AI-AG-065 (Site Audit Agent) and AI-CN-001 (MultiConnect: Zapier/Webhook
// Bridge) are the current cases: each has its embedded source module
// (site-audit-source.mts / multiconnect-webhook-bridge-source.mts) baked in
// at build time via each package's tools/embed-source.mjs script, so
// fulfilment never depends on reading the filesystem at request time.

import { SITE_AUDIT_SOURCE } from './site-audit-source.mjs'
import { MULTICONNECT_WEBHOOK_BRIDGE_SOURCE } from './multiconnect-webhook-bridge-source.mjs'
import { buildZip, type ArchiveFile } from './zip.mjs'

export interface ProductArchive {
  filename: string
  bytes: Uint8Array
}

const EXECUTABLE = new Set(['bin/audit.mjs', 'adapters/cron.sh', 'install.sh'])
const BRIDGE_EXECUTABLE = new Set(['bin/bridge.mjs', 'install.sh'])

// Unzipping into a single top-level directory rather than spraying thirteen
// files into whatever the buyer's cwd happens to be. Standard courtesy, and it
// means `unzip site-audit-agent.zip && cd site-audit-agent` just works.
const ROOT = 'site-audit-agent'
const BRIDGE_ROOT = 'multiconnect-webhook-bridge'

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

const ARCHIVES: Record<string, { filename: string; files: () => ArchiveFile[] }> = {
  'AI-AG-065': { filename: 'site-audit-agent.zip', files: siteAuditFiles },
  'AI-CN-001': { filename: 'multiconnect-webhook-bridge.zip', files: webhookBridgeFiles },
}

export function buildProductArchive(sku: string): ProductArchive | null {
  const spec = ARCHIVES[sku]
  if (!spec) return null
  return { filename: spec.filename, bytes: buildZip(spec.files()) }
}
