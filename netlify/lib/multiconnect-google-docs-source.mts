// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiconnect-google-docs/tools/embed-source.mjs from
// the real package source. Regenerate after changing the package:
//
//   node packages/multiconnect-google-docs/tools/embed-source.mjs
//
// This is the payload for the MultiConnect: Google Docs product: the
// complete, runnable source the buyer receives at checkout. It is
// embedded rather than read from disk so fulfilment cannot fail on a
// missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTICONNECT_GOOGLE_DOCS_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# multivault-docs-bridge

Exports Google Docs to local markdown files, one-way, on a schedule — so
tools that only read local files (like [MultiVault], sold separately) can
see content that otherwise only exists in a Google Doc.

[MultiVault]: https://jblessd.com/product/AI-CN-008

## Why this exists

Drive for Desktop syncs *real files* to your machine just fine. It does
**not** turn a native Google Doc into a readable local file — a synced
\`.gdoc\` is a tiny pointer file containing a link back to Google's servers,
not the document's actual content. If your context lives in Google Docs (not
uploaded files), Drive sync alone doesn't close that gap. This tool does:
it asks Google to convert each Doc to plain markdown server-side (the same
conversion "File → Download → Markdown" does by hand) and writes the result
to a local folder, automatically, on whatever schedule you set.

## What this actually does

- Reads Google Docs you authorize (read-only Drive scope — this tool cannot
  create, modify, or delete anything in your Drive, by construction, not
  just by promise: see \`lib/auth.mjs\`'s \`SCOPE\`).
- Exports each one as a \`.md\` file in a destination folder you choose.
- Only re-exports a Doc when it's actually changed since the last run
  (tracked by Google's own \`modifiedTime\` for that file) — an unchanged
  folder costs one list call, not N re-exports.
- Cleans up after itself: a Doc renamed in Drive gets its old local filename
  removed, not duplicated; a Doc deleted (or moved out of the folder you
  scoped to) has its local copy removed too.

## What this explicitly does NOT do

- No Sheets, Slides, or any file type besides native Google Docs.
- No write-back to Drive, ever. One-way: Drive → local files.
- No AI, no content interpretation — Google's own export does the
  Doc-to-markdown conversion; this tool just requests it and writes the
  result to disk.
- No bundling with MultiVault's own dependency-free core — this is a
  separate, optional tool with its own (minimal) setup, precisely so
  MultiVault itself never needs an OAuth dependency just because *you*
  happen to use Google Docs.

## One-time setup

This needs a Google Cloud OAuth client — unavoidable for any real Drive
integration, not a design choice made here. Ten minutes, done once:

1. Go to [console.cloud.google.com](https://console.cloud.google.com/),
   create a project (or use an existing one).
2. **APIs & Services → Library** → search "Google Drive API" → Enable.
3. **APIs & Services → OAuth consent screen** → set it up as "External" if
   you don't have a Google Workspace, add your own email as a test user.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type: **Desktop app** → name it anything → Create. Copy
   the **Client ID** and **Client Secret** it shows you.
5. Run:
   \`\`\`
   node bin/docs-bridge.mjs auth --client-id <id> --client-secret <secret>
   \`\`\`
   This prints a URL. Open it, sign in, approve. You're done — the refresh
   token is saved locally (see "Security model" below).

## Quick start

\`\`\`
node bin/docs-bridge.mjs auth --client-id <id> --client-secret <secret>
node bin/docs-bridge.mjs sync --dest ~/Documents/ClientVault
\`\`\`

Point MultiVault's watched folder at \`~/Documents/ClientVault\` (or a
subfolder of it) and its own watcher picks up the exported \`.md\` files from
there — this tool's job ends at "write accurate files locally."

Run it again anytime — \`--dest\` and any \`--folder-id\` you set are
remembered, so a scheduled run doesn't need every flag repeated:

\`\`\`
node bin/docs-bridge.mjs sync
\`\`\`

## Scoping to one Drive folder (recommended)

By default this exports every Google Doc your account can see. For most
people that's more than intended — scope it to one folder instead:

\`\`\`
node bin/docs-bridge.mjs sync --dest ~/Documents/ClientVault --folder-id <drive-folder-id>
\`\`\`

The folder ID is the long string in that folder's Drive URL:
\`https://drive.google.com/drive/folders/\`**\`1a2B3cD4eFgH...\`**

## Keeping it fresh

Three scheduling adapters are included in \`adapters/\` — same pattern as
MultiVault's own:

- \`adapters/cron.sh\` — any Linux/macOS machine with cron
- \`adapters/launchd.plist\` — macOS, preferred over cron there (survives sleep/wake)
- \`adapters/windows-task.ps1\` — Windows Task Scheduler

Each just runs \`docs-bridge sync\` on a timer — see the header comment in
each file for install steps. You must run \`docs-bridge auth\` interactively
once, by hand, before setting up scheduling — the saved refresh token is
what lets scheduled runs proceed unattended after that.

## Security model, plainly stated

- **Read-only, by construction.** The OAuth scope requested
  (\`drive.readonly\`) cannot create, modify, or delete anything in Drive —
  this isn't a policy this tool follows, it's what Google's API will and
  won't allow with that scope, enforced on Google's side.
- **The refresh token is a real, long-lived credential.** It's saved to
  \`~/.multivault-docs-bridge/config.json\` (or \`--config\` if you chose a
  different path) in plain JSON — not encrypted, same trade MultiVault's
  own \`vault.meta.json\` makes: encrypting it would mean typing a passphrase
  before every unattended scheduled run, defeating the point. On Unix-like
  systems (Linux, macOS) the file is written with \`0600\` permissions (owner
  read/write only) automatically. Windows doesn't have a direct equivalent
  to Unix permission bits — keep the config folder itself access-controlled
  via normal NTFS permissions.
- **Revoke anytime** at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  — this immediately invalidates the saved refresh token; the next sync
  attempt fails clearly rather than silently.
- **No network calls except to Google.** Nothing here talks to [SELLER]'s
  servers, to MultiVault, or to any third party — only Google's own OAuth
  and Drive endpoints. Read the source; it's plain, dependency-free
  JavaScript specifically so that's easy to verify yourself.
- **Zero npm dependencies.** OAuth token exchange and the Drive API calls
  are both plain \`fetch\` against documented REST endpoints — no
  \`googleapis\` SDK (a genuinely large dependency for what two endpoints
  actually need).

## Commands

\`\`\`
docs-bridge auth   --client-id <id> --client-secret <secret>   [--config <path>]
docs-bridge sync   [--dest <path>] [--folder-id <id>] [--config <path>]
docs-bridge status [--config <path>]
\`\`\`

\`docs-bridge status\` never prints the refresh token itself — only whether
one is present — so you can safely check configuration state without
exposing the credential.

## Testing

\`\`\`
npm test
\`\`\`

Runs all three suites (20 tests). Only Google's own HTTP endpoints are
mocked — the one thing genuinely untestable without live credentials.
Everything downstream of that (file writes, incremental skip/rename/delete
logic, state persistence, the local OAuth callback server) runs for real
against a real temp directory and, for the callback server test, a real
running HTTP server receiving a real request. One of the bugs this caught
during development: an early version of the file-permission logic compared
\`os.platform\` (a function) directly to \`'win32'\`, which is always true
regardless of actual OS — the restrictive-permissions code path was never
actually being applied correctly. Fixed and covered by a test that checks
the actual mode bits on the saved file, not just that the function runs
without throwing.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multivault-docs-bridge — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines as you like. Do not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines that you own or operate.
- Modify the source freely. It is plain JavaScript with no build step precisely so
  that you can — point it at different folders, change what gets excerpted,
  add your own output format, anything.
- Keep using it indefinitely. There is no license key, no activation, no expiry,
  no phone-home, and nothing that stops working if [SELLER] does.
- Keep and use any version you have received, forever, regardless of what happens
  to later versions or to [SELLER].

## What you may not do

- Resell, relicense, sublicense or redistribute the software itself, in whole or
  in substantial part, as a product or as part of a product whose value is
  substantially this software.
- Publish the source publicly, or include it in a public repository, package
  registry, or template that others can obtain without buying it.
- Remove or alter this license file or the attribution in the source headers.

## Updates

Any updates published within twelve months of your purchase are included at no
extra cost. After that, your existing copy keeps working forever; new versions may
require a new purchase. There is no subscription and no recurring charge of any
kind.

## Refunds

Because this is source code and delivery is immediate, a refund is available
within 14 days of purchase if the software does not work as described. Run
\`npm test\` before you ask — it takes a second and tells you whether the software
is at fault.

## Warranty and liability

The software is provided "as is", without warranty of any kind, express or
implied, including but not limited to the warranties of merchantability, fitness
for a particular purpose and non-infringement.

In no event shall [SELLER] be liable for any claim, damages or other liability,
whether in an action of contract, tort or otherwise, arising from, out of or in
connection with the software or its use.

In particular: this software reads Google Docs from whatever Drive account or
folder you authorize, using a refresh token that only you generate and control,
and writes their content as local markdown files in a destination folder you
choose. It never writes to, modifies, or deletes anything in Google Drive —
see README's "What this actually does" for the exact read-only scope
requested. **There is no password recovery for your Google account itself** —
that is between you and Google, not [SELLER]. The refresh token this tool
saves locally is a real credential: anyone with access to the file it's saved
in has the same read-only Drive access you authorized, until you revoke it at
https://myaccount.google.com/permissions. You are responsible for keeping
that file's location access-controlled, and for reviewing what folder you
export into and what you do with the resulting files. Nothing in this
software transmits your Drive contents, your refresh token, or any exported
file to [SELLER] or to any third party other than Google itself (required for
the export to work at all); you are responsible for verifying this for your
own compliance needs by reading the source, which is provided precisely so
that you can.

## Governing law

This license is governed by the laws of [JURISDICTION].

---

Copyright © 2026 [SELLER]. All rights reserved.

The source files each carry the same notice. Copyright in this software arises
automatically on creation and is not conditional on registration, on this notice,
or on any filing — the notice exists to make ownership unambiguous and to travel
with a file that gets separated from this license.
`,
  },
  {
    path: "package.json",
    contents: `{
  "name": "multiconnect-google-docs",
  "version": "1.0.0",
  "description": "Exports Google Docs to local markdown files, one-way, on a schedule — so local-file tools (like MultiVault, sold separately) can see content that otherwise only exists in Google Docs. Zero npm dependencies.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "docs-bridge": "./bin/docs-bridge.mjs"
  },
  "main": "./lib/sync.mjs",
  "exports": {
    ".": "./lib/sync.mjs",
    "./auth": "./lib/auth.mjs",
    "./drive": "./lib/drive.mjs",
    "./config": "./lib/config.mjs"
  },
  "files": [
    "bin",
    "lib",
    "adapters",
    "README.md",
    "LICENSE.md"
  ],
  "scripts": {
    "docs-bridge": "node bin/docs-bridge.mjs",
    "test": "node test/sync.test.mjs && node test/auth.test.mjs && node test/config.test.mjs"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
  },
  {
    path: "lib/auth.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Google OAuth2, plain REST — no \`googleapis\` SDK (a genuinely large
// dependency for what two endpoints actually need). Two things happen here:
//
//   1. ONE-TIME setup (\`docs-bridge auth\`): the standard "installed
//      application" OAuth flow — open a consent URL, Google redirects back
//      to a short-lived local HTTP server with an authorization code, that
//      code is exchanged for a refresh token. You do this exactly once, by
//      hand, in a browser. The refresh token is what you save and reuse.
//   2. EVERY SYNC RUN: exchange the saved refresh token for a short-lived
//      access token. No browser, no human, safe to run from cron/launchd/
//      Task Scheduler — this is what makes ongoing syncs unattended.
//
// A Google Cloud OAuth client (Client ID + Secret) is unavoidable for any
// real Drive integration — that's Google's requirement, not a design choice
// made here. README's "One-time setup" section walks through creating one.

import { createServer } from 'node:http'
import { URL } from 'node:url'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly' // read-only — this tool only ever exports, never modifies or deletes anything in Drive

/**
 * Run the one-time interactive authorization flow. Opens (prints) a consent
 * URL, starts a short-lived local server on \`port\` to catch Google's
 * redirect, and exchanges the resulting code for tokens.
 *
 * @returns {Promise<{ refreshToken: string, accessToken: string, expiresAt: number }>}
 */
export async function runAuthFlow({ clientId, clientSecret, port = 53682, onReady }) {
  const redirectUri = \`http://127.0.0.1:\${port}/oauth/callback\`
  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline') // required to get a refresh_token, not just a short-lived access token
  authUrl.searchParams.set('prompt', 'consent') // forces a refresh_token even on a re-auth, where Google otherwise sometimes omits it

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, redirectUri)
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404)
        return res.end()
      }
      const err = url.searchParams.get('error')
      const authCode = url.searchParams.get('code')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        err
          ? \`<html><body style="font-family:sans-serif">Authorization failed: \${err}. Close this tab and try again.</body></html>\`
          : \`<html><body style="font-family:sans-serif">Authorized — you can close this tab and return to your terminal.</body></html>\`,
      )
      server.close()
      if (err) reject(new Error(\`Google denied authorization: \${err}\`))
      else if (!authCode) reject(new Error('No authorization code returned.'))
      else resolve(authCode)
    })
    server.on('error', reject)
    // Only announce the URL once the redirect target actually exists —
    // opening it a moment too early (before listen()'s callback fires) would
    // race a fast browser against a server that isn't accepting connections
    // yet.
    server.listen(port, () => onReady?.(authUrl.toString()))
  })

  return exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri })
}

async function exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(\`Token exchange failed: \${data.error_description ?? data.error ?? res.status}\`)
  if (!data.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. This usually means you already authorized this app before — ' +
        'revoke access at https://myaccount.google.com/permissions and run "docs-bridge auth" again.',
    )
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
}

/**
 * Exchange a saved refresh token for a fresh access token. Called at the
 * start of every sync run — access tokens are short-lived (~1hr) by design,
 * refresh tokens are the long-lived credential actually saved to disk.
 */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      \`Access token refresh failed: \${data.error_description ?? data.error ?? res.status}. \` +
        \`If this persists, the refresh token may have been revoked — run "docs-bridge auth" again.\`,
    )
  }
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
}

export function authUrlForDisplay({ clientId, port = 53682 }) {
  const redirectUri = \`http://127.0.0.1:\${port}/oauth/callback\`
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Local storage for the refresh token and Drive scope config, so scheduled
// runs (cron/launchd/Task Scheduler) don't need a human present to
// re-authorize each time.
//
// Stored as plain JSON, not encrypted — the same trade this whole product
// line makes elsewhere (see MultiVault's vault.meta.json): encrypting it
// would mean a human has to type a passphrase before every unattended
// scheduled run, which defeats the point of "unattended." Instead: the file
// is written with 0600 permissions (owner read/write only) on Unix-like
// systems, and — like every other "this file is sensitive, protect the
// folder it's in" note in this product line — that's the honest mitigation,
// not encryption theater. Windows doesn't have a direct equivalent to Unix
// file-mode bits; NTFS permissions are the real control there, inherited
// from the folder — keep the config folder itself access-controlled.
//
// The refresh token is a real bearer credential: anyone who reads this file
// gets read-only access to the Drive account it was issued for, until it's
// revoked at https://myaccount.google.com/permissions.

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import process from 'node:process'

export function defaultConfigPath() {
  return join(homedir(), '.multivault-docs-bridge', 'config.json')
}

export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    throw new Error(\`Config file at \${configPath} exists but is not valid JSON. Delete it and run "docs-bridge auth" again.\`)
  }
}

export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\\n', 'utf8')
  if (process.platform !== 'win32') {
    try {
      chmodSync(configPath, 0o600)
    } catch {
      // Best-effort — a filesystem that doesn't support Unix permission bits
      // (some network mounts) shouldn't fail the whole save.
    }
  }
}
`,
  },
  {
    path: "lib/drive.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
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
  const url = new URL(\`\${DRIVE_API}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: \`Bearer \${accessToken}\` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Drive API \${path} failed: \${res.status} \${body.slice(0, 300)}\`)
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
  const q = [\`mimeType='\${GOOGLE_DOC_MIME}'\`, 'trashed=false']
  if (folderId) q.push(\`'\${folderId}' in parents\`)

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
  const res = await driveFetch(\`/files/\${fileId}/export\`, accessToken, { mimeType: EXPORT_MIME })
  return res.text()
}
`,
  },
  {
    path: "lib/sync.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Orchestrates one sync run: refresh the access token, list Google Docs,
// export only the ones that actually changed since last run (by
// modifiedTime — same incremental philosophy as MultiVault's own indexer:
// don't pay for work that's already done), write them as .md files into the
// destination folder, and record state for next time.
//
// One-way, by design: this reads from Drive and writes local files. It
// never writes back to Drive, and once a file is on disk, MultiVault's own
// watcher (a separate, already-owned product) picks it up from there —
// this tool's job ends at "write accurate .md files locally."

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { refreshAccessToken } from './auth.mjs'
import { listGoogleDocs, exportDocAsMarkdown } from './drive.mjs'

const STATE_FILE = 'docs-bridge-state.json'

function sanitizeFilename(name) {
  // Strip characters that are unsafe/awkward across Windows, macOS, and
  // Linux filesystems alike, collapse whitespace, and cap length — a very
  // long Doc title shouldn't produce a filename some filesystems choke on.
  const cleaned = name
    .replace(/[/\\\\:*?"<>|]/g, '-')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 150)
  return cleaned || 'untitled'
}

function loadState(dest) {
  const path = join(dest, STATE_FILE)
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {} // corrupt state file — treat as empty rather than crash; worst case, everything re-exports once
  }
}

function saveState(dest, state) {
  writeFileSync(join(dest, STATE_FILE), JSON.stringify(state, null, 2), 'utf8')
}

/**
 * Run one sync pass. Returns { exported, unchanged, removed, errors } so
 * callers (the CLI, a scheduler) can report what actually happened.
 */
export async function syncDocs({ clientId, clientSecret, refreshToken, dest, folderId }) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })

  const { accessToken } = await refreshAccessToken({ clientId, clientSecret, refreshToken })
  const docs = await listGoogleDocs(accessToken, { folderId })
  const state = loadState(dest)
  const seenIds = new Set()
  const result = { exported: 0, unchanged: 0, removed: 0, errors: [] }

  for (const doc of docs) {
    seenIds.add(doc.id)
    const prior = state[doc.id]
    if (prior && prior.modifiedTime === doc.modifiedTime) {
      result.unchanged += 1
      continue
    }

    try {
      const markdown = await exportDocAsMarkdown(accessToken, doc.id)
      const filename = \`\${sanitizeFilename(doc.name)}.md\`

      // A rename in Drive shouldn't leave the old filename behind as an
      // orphaned duplicate — remove it before writing the new one.
      if (prior && prior.filename && prior.filename !== filename) {
        const oldPath = join(dest, prior.filename)
        if (existsSync(oldPath)) unlinkSync(oldPath)
      }

      writeFileSync(join(dest, filename), markdown, 'utf8')
      state[doc.id] = { name: doc.name, filename, modifiedTime: doc.modifiedTime }
      result.exported += 1
    } catch (err) {
      result.errors.push({ id: doc.id, name: doc.name, message: err.message })
    }
  }

  // A Doc deleted (or moved out of scope) in Drive since last run — remove
  // its exported file rather than leaving a stale copy on disk forever.
  for (const [id, entry] of Object.entries(state)) {
    if (!seenIds.has(id)) {
      const path = join(dest, entry.filename)
      if (existsSync(path)) unlinkSync(path)
      delete state[id]
      result.removed += 1
    }
  }

  saveState(dest, state)
  return result
}
`,
  },
  {
    path: "bin/docs-bridge.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A local, one-way bridge: exports Google Docs as real .md files on disk, so
// tools that only read local files (like MultiVault, sold separately) can
// see content that otherwise only exists in Google Docs.
//
// Deliberately narrow: this reads Docs from Drive and writes local files.
// It never writes back to Drive, never touches Sheets/Slides/other file
// types, and never talks to any AI model. What happens to the exported
// files afterward — indexing, watching, anything else — is a different
// tool's job.
//
// Subcommands:
//   docs-bridge auth                          One-time interactive OAuth setup
//   docs-bridge sync   [--dest <path>] [--folder-id <id>] [--config <path>]
//   docs-bridge status [--config <path>]

import process from 'node:process'
import { resolve } from 'node:path'
import { runAuthFlow } from '../lib/auth.mjs'
import { syncDocs } from '../lib/sync.mjs'
import { saveConfig, loadConfig, defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`docs-bridge — export Google Docs to local markdown files

Usage
  docs-bridge <command> [options]

Commands
  auth      One-time interactive setup: authorize with Google, save a refresh token
  sync      Export changed/new Docs to local .md files
  status    Show what's configured, without printing the refresh token

Options
  --dest <path>       Where to write exported .md files (sync: required unless saved during auth)
  --folder-id <id>    Only export Docs inside this one Drive folder (optional — omit for the whole Drive)
  --config <path>     Where credentials are stored (default: ~/.multivault-docs-bridge/config.json)
  --client-id <id>    Google OAuth Client ID (auth: required unless already saved)
  --client-secret <s> Google OAuth Client Secret (auth: required unless already saved)
  -h, --help          Show this message
  -v, --version       Show the version

Setup (one-time, see README for the full walkthrough):
  1. Create a Google Cloud project, enable the Drive API, create an OAuth
     Client ID (type: Desktop app).
  2. docs-bridge auth --client-id <id> --client-secret <secret>
  3. docs-bridge sync --dest ~/Documents/ClientVault

Then schedule step 3 with one of the adapters in adapters/ (cron, launchd,
Windows Task Scheduler) — same pattern as MultiVault's own scheduling.
\`

class UsageError extends Error {}

function parseArgs(argv) {
  const command = argv[0]
  const opts = { dest: null, folderId: null, config: null, clientId: null, clientSecret: null }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      process.stdout.write(USAGE)
      process.exit(0)
    }
    if (arg === '-v' || arg === '--version') {
      process.stdout.write('multivault-docs-bridge 1.0.0\\n')
      process.exit(0)
    }
    if (arg === '--dest') { opts.dest = argv[++i]; continue }
    if (arg === '--folder-id') { opts.folderId = argv[++i]; continue }
    if (arg === '--config') { opts.config = argv[++i]; continue }
    if (arg === '--client-id') { opts.clientId = argv[++i]; continue }
    if (arg === '--client-secret') { opts.clientSecret = argv[++i]; continue }
    throw new UsageError(\`Unknown option: \${arg}\`)
  }
  return { command, opts }
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE)
    process.exit(0)
  }
  const { command, opts } = parseArgs(argv)
  const configPath = opts.config ? resolve(opts.config) : defaultConfigPath()

  if (command === 'auth') {
    const existing = loadConfig(configPath) ?? {}
    const clientId = opts.clientId ?? existing.clientId
    const clientSecret = opts.clientSecret ?? existing.clientSecret
    if (!clientId || !clientSecret) {
      throw new UsageError('--client-id and --client-secret are required the first time you run "docs-bridge auth". See README for how to create them.')
    }
    process.stdout.write('Starting Google authorization...\\n\\n')
    const { refreshToken } = await runAuthFlow({
      clientId,
      clientSecret,
      onReady: (url) => {
        process.stdout.write(\`Open this URL in a browser and sign in:\\n\\n  \${url}\\n\\n\`)
        process.stdout.write('Waiting for you to finish in the browser...\\n')
      },
    })
    saveConfig({ ...existing, clientId, clientSecret, refreshToken }, configPath)
    process.stdout.write(\`\\nAuthorized. Saved to \${configPath}.\\n\`)
    process.stdout.write('Run "docs-bridge sync --dest <folder>" next.\\n')
    return
  }

  if (command === 'sync') {
    const config = loadConfig(configPath)
    if (!config) {
      throw new UsageError('Not authorized yet. Run "docs-bridge auth" first.')
    }
    const dest = opts.dest ? resolve(opts.dest) : config.dest
    if (!dest) {
      throw new UsageError('No destination folder. Pass --dest, or it will be remembered after your first sync with --dest.')
    }
    const folderId = opts.folderId ?? config.folderId
    const result = await syncDocs({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      dest,
      folderId,
    })
    // Remember dest/folderId for next time, so a scheduled run doesn't need
    // the flags repeated in every cron/launchd/Task Scheduler entry.
    saveConfig({ ...config, dest, folderId: folderId ?? null }, configPath)

    process.stdout.write(
      \`Synced: \${result.exported} exported, \${result.unchanged} unchanged, \${result.removed} removed.\\n\`,
    )
    if (result.errors.length) {
      process.stdout.write(\`\${result.errors.length} doc(s) failed to export:\\n\`)
      for (const e of result.errors) process.stdout.write(\`  - \${e.name}: \${e.message}\\n\`)
      process.exitCode = 1
    }
    return
  }

  if (command === 'status') {
    const config = loadConfig(configPath)
    if (!config) {
      process.stdout.write(\`Not configured yet (\${configPath} does not exist). Run "docs-bridge auth" first.\\n\`)
      return
    }
    process.stdout.write(
      [
        \`Config: \${configPath}\`,
        \`Client ID: \${config.clientId}\`,
        \`Destination: \${config.dest ?? '(not set — will be required on first sync)'}\`,
        \`Drive folder scope: \${config.folderId ?? '(none — exports from the whole Drive)'}\`,
        \`Refresh token: \${config.refreshToken ? 'present' : 'MISSING — run "docs-bridge auth"'}\`,
      ].join('\\n') + '\\n',
    )
    return
  }

  throw new UsageError(\`Unknown command: \${command}\`)
}

main().catch((err) => {
  if (err instanceof UsageError) {
    process.stderr.write(\`\${err.message}\\n\\n\${USAGE}\`)
    process.exit(2)
  }
  process.stderr.write(\`\${err.message}\\n\`)
  process.exit(1)
})
`,
  },
  {
    path: "adapters/cron.sh",
    contents: `#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+ and has already run
# "docs-bridge auth" once interactively (the refresh token it saves is what
# lets this run unattended from here on).
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (runs every hour, at :17 — off the hour, since cron everywhere
#      stacks up at :00):
#
#        17 * * * * /path/to/adapters/cron.sh
#
# Environment:
#   MULTIVAULT_DOCS_BRIDGE_CONFIG  where credentials live (default: ~/.multivault-docs-bridge/config.json)
#   MULTIVAULT_DOCS_BRIDGE_LOG     where run logs are appended (default: ./docs-bridge.log next to this script)

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")
LOG=\${MULTIVAULT_DOCS_BRIDGE_LOG:-"$PACKAGE_DIR/docs-bridge.log"}

CONFIG_ARGS=""
if [ -n "\${MULTIVAULT_DOCS_BRIDGE_CONFIG:-}" ]; then
  CONFIG_ARGS="--config $MULTIVAULT_DOCS_BRIDGE_CONFIG"
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "--- $STAMP ---"
  # shellcheck disable=SC2086
  node "$PACKAGE_DIR/bin/docs-bridge.mjs" sync $CONFIG_ARGS
} >> "$LOG" 2>&1

echo "$STAMP -> see $LOG"
`,
  },
  {
    path: "adapters/launchd.plist",
    contents: `<!-- Copyright (c) 2026 [SELLER]. All rights reserved. -->
<!-- Licensed to a single purchaser under the terms in LICENSE.md. -->
<!-- Redistribution or resale of this source, in whole or in part, is not permitted. -->

<!--
  Adapter: launchd, the native scheduler on macOS. Preferred over cron there —
  launchd runs your jobs even after the machine sleeps and wakes.

  Requires you've already run "docs-bridge auth" once interactively before
  installing this — the saved refresh token is what lets it run unattended.

  Install:
    1. Copy this file to ~/Library/LaunchAgents/com.multivault.docs-bridge.plist
    2. Edit YOUR_USERNAME (three times) below to match your setup.
    3. Load it:
         launchctl load ~/Library/LaunchAgents/com.multivault.docs-bridge.plist

  Runs once an hour by default (StartInterval, in seconds — 3600 = 1 hour).

  To stop it:
    launchctl unload ~/Library/LaunchAgents/com.multivault.docs-bridge.plist
-->
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.multivault.docs-bridge</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/multivault-docs-bridge/bin/docs-bridge.mjs</string>
    <string>sync</string>
  </array>

  <key>StartInterval</key>
  <integer>3600</integer>

  <key>RunAtLoad</key>
  <false/>

  <key>StandardOutPath</key>
  <string>/Users/YOUR_USERNAME/multivault-docs-bridge/docs-bridge.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/YOUR_USERNAME/multivault-docs-bridge/docs-bridge.log</string>
</dict>
</plist>
`,
  },
  {
    path: "adapters/windows-task.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: Windows Task Scheduler.
#
# Registers a scheduled task that runs "docs-bridge sync" hourly. Requires
# you've already run "docs-bridge auth" once interactively before this — the
# saved refresh token is what lets it run unattended from here on.
#
# Install:
#   1. Open PowerShell (does not need to be Administrator)
#   2. Run:
#        powershell -ExecutionPolicy Bypass -File adapters\\windows-task.ps1
#
# To remove the scheduled task later:
#   Unregister-ScheduledTask -TaskName "MultiVaultDocsBridgeSync" -Confirm:$false

$PackageDir = Split-Path -Parent $PSScriptRoot
$BinPath = Join-Path $PackageDir "bin\\docs-bridge.mjs"
$LogPath = Join-Path $PackageDir "docs-bridge.log"

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org first."
  exit 2
}

$Arguments = "\`"$BinPath\`" sync"
$FullArguments = "/c \`"$NodePath\`" $Arguments >> \`"$LogPath\`" 2>&1"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $FullArguments
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "MultiVaultDocsBridgeSync" \`
  -Action $Action -Trigger $Trigger -Settings $Settings \`
  -Description "Exports changed Google Docs to local markdown files hourly." \`
  -Force

Write-Host "Scheduled task 'MultiVaultDocsBridgeSync' registered — syncing hourly."
Write-Host "Logs will be written to $LogPath"
`,
  },
  {
    path: "test/auth.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests the local OAuth callback server for real — it's our own code, not
// Google's, so there's no reason to mock it. A real HTTP request is sent to
// the real running server to simulate what Google's browser redirect would
// do. Only the actual token-exchange call TO Google is mocked, since that's
// the one genuinely external dependency.

import assert from 'node:assert/strict'
import test from 'node:test'
import { runAuthFlow } from '../lib/auth.mjs'

const realFetch = globalThis.fetch

function installFetchMock(handler) {
  globalThis.fetch = async (url, opts) => handler(String(url), opts)
  return () => {
    globalThis.fetch = realFetch
  }
}

test('runAuthFlow: a real request to the callback URL with a code resolves with tokens', async () => {
  const restore = installFetchMock(async () => ({
    ok: true,
    json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }),
  }))
  const port = 53701
  try {
    const flowPromise = runAuthFlow({
      clientId: 'client',
      clientSecret: 'secret',
      port,
      onReady: async (url) => {
        assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth'))
        // Simulate Google's browser redirect: a real HTTP GET to our real running server.
        await realFetch(\`http://127.0.0.1:\${port}/oauth/callback?code=real-auth-code\`)
      },
    })
    const result = await flowPromise
    assert.equal(result.refreshToken, 'r')
    assert.equal(result.accessToken, 'a')
  } finally {
    restore()
  }
})

test('runAuthFlow: a real request carrying an error param rejects with a clear message', async () => {
  const port = 53702
  const flowPromise = runAuthFlow({
    clientId: 'client',
    clientSecret: 'secret',
    port,
    onReady: async (url) => {
      await realFetch(\`http://127.0.0.1:\${port}/oauth/callback?error=access_denied\`)
    },
  })
  await assert.rejects(flowPromise, /access_denied/)
})

test('runAuthFlow: a request to an unrelated path on the callback server 404s without affecting the flow', async () => {
  const port = 53703
  const restore = installFetchMock(async () => ({
    ok: true,
    json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }),
  }))
  try {
    const flowPromise = runAuthFlow({
      clientId: 'client',
      clientSecret: 'secret',
      port,
      onReady: async () => {
        const res = await realFetch(\`http://127.0.0.1:\${port}/some/other/path\`)
        assert.equal(res.status, 404)
        // The real callback still needs to arrive for the flow to resolve.
        await realFetch(\`http://127.0.0.1:\${port}/oauth/callback?code=xyz\`)
      },
    })
    const result = await flowPromise
    assert.equal(result.refreshToken, 'r')
  } finally {
    restore()
  }
})
`,
  },
  {
    path: "test/config.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { saveConfig, loadConfig } from '../lib/config.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

test('saveConfig then loadConfig round-trips the data exactly', () => {
  const dir = tempDir('cfg')
  const path = join(dir, 'sub', 'config.json') // nested — also exercises mkdir -p of the parent
  try {
    saveConfig({ clientId: 'abc', refreshToken: 'xyz' }, path)
    const loaded = loadConfig(path)
    assert.deepEqual(loaded, { clientId: 'abc', refreshToken: 'xyz' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('loadConfig returns null when nothing has been saved yet, not an error', () => {
  const dir = tempDir('cfg')
  try {
    assert.equal(loadConfig(join(dir, 'nope.json')), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('saveConfig sets restrictive (owner-only) file permissions on Unix-like systems', { skip: process.platform === 'win32' }, () => {
  const dir = tempDir('cfg')
  const path = join(dir, 'config.json')
  try {
    saveConfig({ refreshToken: 'secret-value' }, path)
    const mode = statSync(path).mode & 0o777
    assert.equal(mode, 0o600, \`expected mode 600, got \${mode.toString(8)} — a refresh token should not be group/world readable\`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('loadConfig throws a clear, actionable error on corrupt JSON rather than an opaque parse error', () => {
  const dir = tempDir('cfg')
  const path = join(dir, 'config.json')
  writeFileSync(path, '{not valid json')
  try {
    assert.throws(() => loadConfig(path), /not valid JSON/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "test/sync.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Tests mock only Google's HTTP endpoints — the one thing genuinely
// untestable without live credentials. Everything downstream of that (file
// writes, incremental skip logic, rename/delete cleanup, state persistence)
// runs against a real temp directory with real file I/O, so those parts are
// tested for real, not simulated.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listGoogleDocs, exportDocAsMarkdown } from '../lib/drive.mjs'
import { syncDocs } from '../lib/sync.mjs'
import { refreshAccessToken } from '../lib/auth.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

function installFetchMock(handler) {
  const original = globalThis.fetch
  globalThis.fetch = async (url, opts) => handler(String(url), opts)
  return () => {
    globalThis.fetch = original
  }
}

// ---------------------------------------------------------------------------
// drive.mjs — request construction and response parsing, against a mock
// ---------------------------------------------------------------------------

test('listGoogleDocs sends the correct query and parses the response', async () => {
  let capturedUrl
  const restore = installFetchMock(async (url) => {
    capturedUrl = url
    return {
      ok: true,
      json: async () => ({ files: [{ id: 'abc123', name: 'Northwind MSA', modifiedTime: '2026-03-01T00:00:00Z' }] }),
    }
  })
  try {
    const docs = await listGoogleDocs('fake-token', { folderId: 'folder-xyz' })
    assert.equal(docs.length, 1)
    assert.equal(docs[0].name, 'Northwind MSA')
    const decoded = decodeURIComponent(capturedUrl.replace(/\\+/g, ' '))
    assert.ok(decoded.includes("mimeType='application/vnd.google-apps.document'"))
    assert.ok(decoded.includes("'folder-xyz' in parents"))
    assert.ok(decoded.includes('trashed=false'))
  } finally {
    restore()
  }
})

test('listGoogleDocs follows pagination and returns the complete list', async () => {
  let callCount = 0
  const restore = installFetchMock(async () => {
    callCount += 1
    if (callCount === 1) {
      return { ok: true, json: async () => ({ nextPageToken: 'page2', files: [{ id: '1', name: 'Doc One', modifiedTime: 't1' }] }) }
    }
    return { ok: true, json: async () => ({ files: [{ id: '2', name: 'Doc Two', modifiedTime: 't2' }] }) }
  })
  try {
    const docs = await listGoogleDocs('fake-token', {})
    assert.equal(docs.length, 2)
    assert.equal(callCount, 2)
  } finally {
    restore()
  }
})

test('listGoogleDocs surfaces a clear error on a non-OK response, not a silent empty list', async () => {
  const restore = installFetchMock(async () => ({ ok: false, status: 401, text: async () => 'Invalid Credentials' }))
  try {
    await assert.rejects(() => listGoogleDocs('bad-token', {}), /401/)
  } finally {
    restore()
  }
})

test('exportDocAsMarkdown requests the markdown mimeType and returns the body text', async () => {
  let capturedUrl
  const restore = installFetchMock(async (url) => {
    capturedUrl = url
    return { ok: true, text: async () => '# Northwind MSA\\n\\nAuto-renews 12 months...' }
  })
  try {
    const text = await exportDocAsMarkdown('fake-token', 'abc123')
    assert.ok(text.includes('Auto-renews'))
    assert.ok(capturedUrl.includes('/files/abc123/export'))
    assert.ok(capturedUrl.includes('mimeType=text%2Fmarkdown'))
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// auth.mjs — token refresh against a mock
// ---------------------------------------------------------------------------

test('refreshAccessToken exchanges a refresh token for an access token', async () => {
  const restore = installFetchMock(async () => ({ ok: true, json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }) }))
  try {
    const { accessToken, expiresAt } = await refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' })
    assert.equal(accessToken, 'fresh-token')
    assert.ok(expiresAt > Date.now())
  } finally {
    restore()
  }
})

test('refreshAccessToken gives an actionable error message on failure, not a raw fetch error', async () => {
  const restore = installFetchMock(async () => ({ ok: false, json: async () => ({ error: 'invalid_grant', error_description: 'Token has been revoked' }) }))
  try {
    await assert.rejects(() => refreshAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'revoked' }), /revoked/)
  } finally {
    restore()
  }
})

// ---------------------------------------------------------------------------
// sync.mjs — real file I/O and real incremental/state logic, mocked network
// ---------------------------------------------------------------------------

function mockGoogleApi({ docs, exports }) {
  return installFetchMock(async (url) => {
    if (url.includes('oauth2.googleapis.com/token')) {
      return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    }
    if (url.includes('/export')) {
      const id = url.match(/\\/files\\/([^/]+)\\/export/)[1]
      return { ok: true, text: async () => exports[id] }
    }
    if (url.includes('/files')) {
      return { ok: true, json: async () => ({ files: docs }) }
    }
    throw new Error(\`Unexpected mock fetch: \${url}\`)
  })
}

test('syncDocs writes new docs as real .md files on disk', async () => {
  const dest = tempDir('sync-dest')
  const restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Client Notes', modifiedTime: '2026-03-01T00:00:00Z' }],
    exports: { d1: '# Client Notes\\n\\nPrefers async updates.' },
  })
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.exported, 1)
    const written = readFileSync(join(dest, 'Client Notes.md'), 'utf8')
    assert.ok(written.includes('Prefers async updates'))
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs skips re-exporting a doc whose modifiedTime has not changed', async () => {
  const dest = tempDir('sync-dest')
  const restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Stable Doc', modifiedTime: '2026-03-01T00:00:00Z' }],
    exports: { d1: 'version A' },
  })
  try {
    await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    const secondRun = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(secondRun.exported, 0)
    assert.equal(secondRun.unchanged, 1)
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs re-exports when modifiedTime changes, and the new content lands on disk', async () => {
  const dest = tempDir('sync-dest')
  let restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Changing Doc', modifiedTime: '2026-03-01T00:00:00Z' }],
    exports: { d1: 'old content' },
  })
  await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
  restore()

  restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Changing Doc', modifiedTime: '2026-03-02T00:00:00Z' }],
    exports: { d1: 'new content' },
  })
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.exported, 1)
    assert.equal(readFileSync(join(dest, 'Changing Doc.md'), 'utf8'), 'new content')
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs cleans up the old filename when a doc is renamed in Drive', async () => {
  const dest = tempDir('sync-dest')
  let restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Old Name', modifiedTime: 't1' }],
    exports: { d1: 'content' },
  })
  await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
  restore()
  assert.ok(existsSync(join(dest, 'Old Name.md')))

  restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'New Name', modifiedTime: 't2' }],
    exports: { d1: 'content' },
  })
  try {
    await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(existsSync(join(dest, 'Old Name.md')), false, 'the stale filename should be removed, not left as a duplicate')
    assert.ok(existsSync(join(dest, 'New Name.md')))
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs removes the local file for a doc that no longer appears in Drive (deleted or moved out of scope)', async () => {
  const dest = tempDir('sync-dest')
  let restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Will Be Deleted', modifiedTime: 't1' }],
    exports: { d1: 'content' },
  })
  await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
  restore()
  assert.ok(existsSync(join(dest, 'Will Be Deleted.md')))

  restore = mockGoogleApi({ docs: [], exports: {} }) // doc no longer returned by Drive
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.removed, 1)
    assert.equal(existsSync(join(dest, 'Will Be Deleted.md')), false)
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs sanitizes unsafe filename characters from doc titles', async () => {
  const dest = tempDir('sync-dest')
  const restore = mockGoogleApi({
    docs: [{ id: 'd1', name: 'Q3 Report: Revenue / Costs?', modifiedTime: 't1' }],
    exports: { d1: 'content' },
  })
  try {
    await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    const files = existsSync(join(dest, 'Q3 Report- Revenue - Costs-.md'))
    assert.ok(files, 'unsafe characters (: / ?) should be replaced, not cause a write failure')
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})

test('syncDocs continues past a single export failure and reports it, rather than aborting the whole run', async () => {
  const dest = tempDir('sync-dest')
  const restore = installFetchMock(async (url) => {
    if (url.includes('oauth2.googleapis.com/token')) return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) }
    if (url.includes('/files/bad-doc/export')) return { ok: false, status: 403, text: async () => 'Export failed' }
    if (url.includes('/export')) return { ok: true, text: async () => 'fine content' }
    if (url.includes('/files')) {
      return {
        ok: true,
        json: async () => ({
          files: [
            { id: 'bad-doc', name: 'Broken Doc', modifiedTime: 't1' },
            { id: 'good-doc', name: 'Working Doc', modifiedTime: 't1' },
          ],
        }),
      }
    }
    throw new Error('unexpected')
  })
  try {
    const result = await syncDocs({ clientId: 'c', clientSecret: 's', refreshToken: 'r', dest })
    assert.equal(result.exported, 1, 'the working doc should still export despite the other one failing')
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0].name, 'Broken Doc')
    assert.ok(existsSync(join(dest, 'Working Doc.md')))
  } finally {
    restore()
    rmSync(dest, { recursive: true, force: true })
  }
})
`,
  },
]
