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
import { buildZip, type ArchiveFile } from './zip.mjs'

export interface ProductArchive {
  filename: string
  bytes: Buffer
}

// Files that have to arrive with the executable bit set. Everything else in an
// archive unzips 0644. Paths are relative to the package root, before the
// top-level directory is prefixed on.
const EXECUTABLE = new Set(['bin/audit.mjs', 'adapters/cron.sh', 'install.sh'])

// Unzipping into a single top-level directory rather than spraying thirteen
// files into whatever the buyer's cwd happens to be. Standard courtesy, and it
// means `unzip site-audit-agent.zip && cd site-audit-agent` just works.
const ROOT = 'site-audit-agent'

function siteAuditFiles(): ArchiveFile[] {
  return SITE_AUDIT_SOURCE.map((file) => ({
    path: `${ROOT}/${file.path}`,
    contents: file.contents,
    executable: EXECUTABLE.has(file.path),
  }))
}

const ARCHIVES: Record<string, { filename: string; files: () => ArchiveFile[] }> = {
  'AI-AG-065': { filename: 'site-audit-agent.zip', files: siteAuditFiles },
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
