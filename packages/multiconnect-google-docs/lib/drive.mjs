// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Drive API v3, read-only, plain REST. Two calls, both documented Google
// endpoints:
//   - files.list — find Google Docs (optionally scoped to one folder)
//   - files.export — convert a Doc to plain markdown server-side (Google
//     does the conversion; this just requests it)
//
// Read-only by construction: nothing here can create, modify, or delete
// anything in Drive — see auth.mjs's SCOPE. This tool's only effect on the
// world is writing local files (see lib/sync.mjs).

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const EXPORT_MIME = 'text/markdown'

async function driveFetch(path, accessToken, params = {}) {
  const url = new URL(`${DRIVE_API}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Drive API ${path} failed: ${res.status} ${body.slice(0, 300)}`)
  }
  return res
}

/**
 * List every Google Doc visible to this account, optionally scoped to one
 * Drive folder. Paginates internally — callers get the complete list, not
 * one page of it.
 *
 * @returns {Promise<Array<{ id: string, name: string, modifiedTime: string }>>}
 */
export async function listGoogleDocs(accessToken, { folderId } = {}) {
  const q = [`mimeType='${GOOGLE_DOC_MIME}'`, 'trashed=false']
  if (folderId) q.push(`'${folderId}' in parents`)

  const files = []
  let pageToken
  do {
    const res = await driveFetch('/files', accessToken, {
      q: q.join(' and '),
      fields: 'nextPageToken, files(id, name, modifiedTime)',
      pageSize: 200,
      ...(pageToken ? { pageToken } : {}),
    })
    const data = await res.json()
    files.push(...(data.files ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return files
}

/**
 * Export one Google Doc as markdown text. Google does the actual
 * Doc-format-to-markdown conversion server-side — this just requests that
 * specific export format and returns the resulting text.
 */
export async function exportDocAsMarkdown(accessToken, fileId) {
  const res = await driveFetch(`/files/${fileId}/export`, accessToken, { mimeType: EXPORT_MIME })
  return res.text()
}
