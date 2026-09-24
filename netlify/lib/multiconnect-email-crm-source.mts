// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multiconnect-email-crm/tools/embed-source.mjs from
// the real package source. Regenerate after changing the package:
//
//   node packages/multiconnect-email-crm/tools/embed-source.mjs
//
// This is the payload for the MultiConnect: Email/CRM product (SKU
// AI-CN-004): the complete, runnable source the buyer receives at
// checkout. It is embedded rather than read from disk so fulfilment cannot
// fail on a missing file.
//
// contents fields are template literals (not JSON strings) so each file
// keeps its natural line breaks here.

export interface SourceFile {
  path: string
  contents: string
}

export const MULTICONNECT_EMAIL_CRM_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# MultiConnect: Email/CRM

Let your agent handle email and contacts — safely.

Runs entirely on your own machine: a local dashboard for connecting SMTP,
an approval queue so nothing sends without you clicking approve, a simple
built-in contact list, and an inbound-email webhook so a provider like
SendGrid or Mailgun can hand parsed messages straight to your agent.

## Install

Windows: \`.\\install.ps1\`
macOS / Linux: \`./install.sh\`

Either way, this starts the connector in the foreground and prints a
dashboard URL, a local auth token, and your inbound webhook URL.

## Setting up SMTP

Most providers give you an app-specific password for this:

- **Gmail** — enable 2-Step Verification, then create an [App
  Password](https://myaccount.google.com/apppasswords). Host
  \`smtp.gmail.com\`, port \`465\`, secure on.
- **Outlook/Microsoft 365** — host \`smtp.office365.com\`, port \`587\`,
  secure off (STARTTLS is negotiated separately; if your account requires
  it, use an app password there too).
- **Any other provider** — check their SMTP settings page for host/port.

Enter these in the dashboard's SMTP connection section.

## The approval queue

This is the whole safety model: your agent can always create a draft (via
\`POST /api/drafts\`), but a draft only ever actually sends after a human
clicks **Approve & send** in the dashboard — and only if safe mode is set
to read/write. A per-hour send limit (default 20) caps how many can go out
even once approved, so a runaway agent can't blast a list.

## Inbound email

Point your provider's inbound-parse webhook at the URL the dashboard shows
you (it includes a secret token in the query string — no separate auth
header needed, since the provider calls this route directly). Every
inbound message is logged in the activity feed so your agent has something
to react to.

## Contacts

A simple built-in list (\`GET /api/contacts\`, \`POST /api/contacts\`) for when
you don't have a real CRM connected — not a replacement for one, just
somewhere the agent can read and log people.

## Development

\`\`\`
npm test
\`\`\`

Zero dependencies — plain Node.js (18+), no build step. SMTP is
implemented directly over \`node:net\`/\`node:tls\` rather than pulling in
nodemailer.

## License

See [LICENSE.md](./LICENSE.md) — a perpetual, single-purchase license.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multiconnect-email-crm — perpetual single-purchase license**

> This is a plain-language commercial license template. It has not been reviewed
> by a lawyer. Have one look at it before you sell against it, and replace
> \`[SELLER]\` and \`[JURISDICTION]\` with your details.

## The short version

You bought it once. You own your copy forever. Run it on as many of **your own**
machines and mailboxes as you like. Do not resell it as a product of its own.

## What you may do

- Use the software for any purpose, commercial or personal, forever.
- Run it on unlimited machines and connect it to unlimited email accounts you own.
- Modify the source freely. It is plain JavaScript with no build step precisely so
  that you can.
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

In particular: this software sends email using SMTP credentials you provide, and
receives inbound mail via a webhook secret you control. You are responsible for
keeping your SMTP password, inbound webhook secret, and local dashboard auth
token private, and for reviewing every draft before approving it — approving a
send is an action taken by you, not automatically by the agent.

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
  "name": "multiconnect-email-crm",
  "version": "1.0.0",
  "description": "Let your agent handle email and contacts — safely. Draft, send, and follow up on leads with full approval control.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "multiconnect-email": "./bin/email-connect.mjs"
  },
  "main": "./lib/server.mjs",
  "exports": {
    ".": "./lib/server.mjs",
    "./config": "./lib/config.mjs"
  },
  "files": [
    "bin",
    "lib",
    "adapters",
    "install.sh",
    "install.ps1",
    "README.md",
    "LICENSE.md"
  ],
  "scripts": {
    "start": "node bin/email-connect.mjs start",
    "test": "node test/run.mjs"
  },
  "dependencies": {},
  "devDependencies": {}
}
`,
  },
  {
    path: "install.sh",
    contents: `#!/usr/bin/env bash
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install it from https://nodejs.org and re-run this script." >&2
  exit 1
fi

NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node $(node --version) found, but 18+ is required." >&2
  exit 1
fi

DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
echo "Starting MultiConnect: Email/CRM..."
echo ""
node "$DIR/bin/email-connect.mjs" start
`,
  },
  {
    path: "install.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Error "Node.js 18+ is required. Install it from https://nodejs.org and re-run this script."
    exit 1
}

$version = (& node --version) -replace 'v', ''
$major = [int]($version.Split('.')[0])
if ($major -lt 18) {
    Write-Error "Node $version found, but 18+ is required."
    exit 1
}

Write-Host "Starting MultiConnect: Email/CRM..."
Write-Host ""
node "$PSScriptRoot\\bin\\email-connect.mjs" start
`,
  },
  {
    path: "lib/config.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — SMTP credentials, the sender
// address, safe mode, and the inbound-webhook shared secret. No database:
// contacts and the send queue live in their own small JSON files alongside
// this one (see contacts.mjs and queue.mjs).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8425

/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   inboundSecret: string,
 *   safeMode: 'read-only' | 'read-write',
 *   smtp: {
 *     host: string | null,
 *     port: number,
 *     secure: boolean,
 *     user: string | null,
 *     pass: string | null,
 *     fromAddress: string | null,
 *     fromName: string
 *   },
 *   sendLimitPerHour: number,
 *   createdAt: string
 * }} EmailConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {EmailConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    // A separate secret from the dashboard token, because the inbound
    // webhook route is called by an outside email-parsing provider, not by
    // the dashboard — it can't send an Authorization header the way the
    // agent-facing routes can, so it's checked via a shared secret in the URL.
    inboundSecret: randomBytes(16).toString('hex'),
    // Read-only by default. In this connector "write" means "allowed to
    // approve a queued draft and actually send it", and "allowed to edit
    // the contact list" — nothing sends or changes contacts until the
    // owner deliberately turns this on.
    safeMode: 'read-only',
    smtp: {
      host: null,
      port: 465,
      secure: true,
      user: null,
      pass: null,
      fromAddress: null,
      fromName: '',
    },
    sendLimitPerHour: 20,
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {EmailConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) {
    const fresh = defaults()
    saveConfig(fresh, configPath)
    return fresh
  }
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  const base = defaults()
  return { ...base, ...parsed, smtp: { ...base.smtp, ...(parsed.smtp ?? {}) } }
}

/**
 * @param {EmailConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
`,
  },
  {
    path: "lib/contacts.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A simple JSON-file-backed contact list — the "maintains its own simple
// contact list if none is connected" half of the product listing. Not a
// real CRM integration; a lightweight fallback so the agent always has
// somewhere to read and log contacts, with the same safe-mode write gate
// as everything else in this line.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

function defaultContactsPath() {
  return path.resolve(process.cwd(), 'contacts.json')
}

/** @typedef {{ id: string, name: string, email: string, notes: string, createdAt: string }} Contact */

/** @param {string} [contactsPath] @returns {Contact[]} */
export function listContacts(contactsPath = defaultContactsPath()) {
  if (!existsSync(contactsPath)) return []
  try {
    return JSON.parse(readFileSync(contactsPath, 'utf8'))
  } catch {
    return []
  }
}

export class ContactsError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ContactsError'
  }
}

/**
 * Add a contact. Refuses outright unless safe mode is read-write, same as
 * every other write path in this product line.
 * @param {import('./config.mjs').EmailConfig} config
 * @param {{ name: string, email: string, notes?: string }} input
 * @param {string} [contactsPath]
 * @returns {Contact}
 */
export function addContact(config, input, contactsPath = defaultContactsPath()) {
  if (config.safeMode !== 'read-write') {
    throw new ContactsError('Refused: safe mode is read-only. Switch to read-write in the dashboard to add contacts.')
  }
  if (!input.email) throw new ContactsError('A contact needs an email address.')

  const contacts = listContacts(contactsPath)
  /** @type {Contact} */
  const contact = {
    id: randomUUID(),
    name: input.name ?? '',
    email: input.email,
    notes: input.notes ?? '',
    createdAt: new Date().toISOString(),
  }
  contacts.unshift(contact)
  mkdirSync(path.dirname(contactsPath), { recursive: true })
  writeFileSync(contactsPath, JSON.stringify(contacts, null, 2) + '\\n', 'utf8')
  return contact
}

export { defaultContactsPath }
`,
  },
  {
    path: "lib/log.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

const MAX_ENTRIES = 200

/**
 * @typedef {{
 *   id: string,
 *   kind: 'inbound' | 'drafted' | 'sent' | 'rejected' | 'error',
 *   summary: string,
 *   detail: string | null,
 *   at: string
 * }} LogEntry
 */

/** @type {LogEntry[]} */
const entries = []
let seq = 0

/**
 * @param {Omit<LogEntry, 'id' | 'at'>} entry
 * @returns {LogEntry}
 */
export function record(entry) {
  seq += 1
  /** @type {LogEntry} */
  const full = { id: String(seq), at: new Date().toISOString(), ...entry }
  entries.unshift(full)
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES
  return full
}

/** @returns {LogEntry[]} */
export function recent(limit = 50) {
  return entries.slice(0, limit)
}

export function clear() {
  entries.length = 0
}
`,
  },
  {
    path: "lib/queue.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The "approval queue & send limits" feature — the whole reason this
// connector is safe to hand an agent. An agent can always draft an email
// (queue it), but nothing ever leaves this machine until a human approves
// it here, and approving is itself gated behind safe mode = read-write plus
// a per-hour send cap so a bad loop can't blast a mailing list.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { sendMail } from './smtp-client.mjs'

function defaultQueuePath() {
  return path.resolve(process.cwd(), 'email-queue.json')
}

/**
 * @typedef {{
 *   id: string,
 *   to: string,
 *   subject: string,
 *   text: string,
 *   html: string | null,
 *   status: 'pending' | 'sent' | 'rejected',
 *   createdAt: string,
 *   sentAt: string | null
 * }} QueuedDraft
 */

/** @returns {QueuedDraft[]} */
function readQueue(queuePath = defaultQueuePath()) {
  if (!existsSync(queuePath)) return []
  try {
    return JSON.parse(readFileSync(queuePath, 'utf8'))
  } catch {
    return []
  }
}

/** @param {QueuedDraft[]} drafts */
function writeQueue(drafts, queuePath = defaultQueuePath()) {
  mkdirSync(path.dirname(queuePath), { recursive: true })
  writeFileSync(queuePath, JSON.stringify(drafts, null, 2) + '\\n', 'utf8')
}

/**
 * Add a new draft to the queue. Always allowed — proposing a send is not
 * itself an action that touches anything outside this file.
 * @param {{ to: string, subject: string, text: string, html?: string }} draft
 * @param {string} [queuePath]
 * @returns {QueuedDraft}
 */
export function enqueueDraft(draft, queuePath = defaultQueuePath()) {
  const drafts = readQueue(queuePath)
  /** @type {QueuedDraft} */
  const entry = {
    id: randomUUID(),
    to: draft.to,
    subject: draft.subject,
    text: draft.text,
    html: draft.html ?? null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    sentAt: null,
  }
  drafts.unshift(entry)
  writeQueue(drafts, queuePath)
  return entry
}

/** @param {string} [queuePath] */
export function listDrafts(queuePath = defaultQueuePath()) {
  return readQueue(queuePath)
}

/** How many drafts this queue has sent in the last hour. */
function sentInLastHour(drafts) {
  const cutoff = Date.now() - 60 * 60 * 1000
  return drafts.filter((d) => d.status === 'sent' && d.sentAt && new Date(d.sentAt).getTime() >= cutoff).length
}

export class QueueError extends Error {
  constructor(message) {
    super(message)
    this.name = 'QueueError'
  }
}

/**
 * Approve a pending draft and actually send it. This is the one function in
 * the whole package that both requires safe mode = read-write AND performs
 * a real external action — everything else either only reads, or only
 * writes to this local queue file.
 * @param {import('./config.mjs').EmailConfig} config
 * @param {string} draftId
 * @param {{ queuePath?: string, sendFn?: typeof sendMail }} [opts]
 */
export async function approveDraft(config, draftId, opts = {}) {
  if (config.safeMode !== 'read-write') {
    throw new QueueError('Refused: safe mode is read-only. Switch to read-write in the dashboard to approve sends.')
  }
  const queuePath = opts.queuePath ?? defaultQueuePath()
  const drafts = readQueue(queuePath)
  const draft = drafts.find((d) => d.id === draftId)
  if (!draft) throw new QueueError('No such draft.')
  if (draft.status !== 'pending') throw new QueueError(\`Draft is already \${draft.status}.\`)

  const limit = config.sendLimitPerHour ?? 20
  if (sentInLastHour(drafts) >= limit) {
    throw new QueueError(\`Send limit reached (\${limit}/hour). Try again later, or raise the limit in settings.\`)
  }

  const send = opts.sendFn ?? sendMail
  await send(config, { to: draft.to, subject: draft.subject, text: draft.text, html: draft.html ?? undefined })

  draft.status = 'sent'
  draft.sentAt = new Date().toISOString()
  writeQueue(drafts, queuePath)
  return draft
}

/**
 * Reject a pending draft — always allowed regardless of safe mode, since
 * saying no to a send is strictly safer than the default.
 * @param {string} draftId
 * @param {string} [queuePath]
 */
export function rejectDraft(draftId, queuePath = defaultQueuePath()) {
  const drafts = readQueue(queuePath)
  const draft = drafts.find((d) => d.id === draftId)
  if (!draft) throw new QueueError('No such draft.')
  if (draft.status !== 'pending') throw new QueueError(\`Draft is already \${draft.status}.\`)
  draft.status = 'rejected'
  writeQueue(drafts, queuePath)
  return draft
}

export { defaultQueuePath }
`,
  },
  {
    path: "lib/server.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The whole connector in one process: dashboard UI, a JSON API for config/
// contacts/queue/log, and an inbound-email webhook route for a provider
// like SendGrid Inbound Parse or Mailgun Routes to call with a parsed
// message. Runs on localhost — a tool that lives on the customer's own
// machine.

import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { loadConfig, saveConfig } from './config.mjs'
import { enqueueDraft, listDrafts, approveDraft, rejectDraft, QueueError } from './queue.mjs'
import { listContacts, addContact, ContactsError } from './contacts.mjs'
import { record, recent, clear as clearLog } from './log.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.join(__dirname, 'ui')

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

function isAuthorized(req, expectedToken) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return token === expectedToken
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 1_000_000) { reject(new Error('Payload too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

function serveStatic(res, file) {
  try {
    const full = path.join(UI_DIR, file)
    if (!full.startsWith(UI_DIR)) throw new Error('bad path')
    const body = readFileSync(full)
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

/**
 * @param {{ configPath?: string, queuePath?: string, contactsPath?: string, port?: number }} [opts]
 */
export function createServer(opts = {}) {
  let config = loadConfig(opts.configPath)
  if (opts.port) config.port = opts.port

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveStatic(res, 'index.html')
    if (req.method === 'GET' && url.pathname === '/app.js') return serveStatic(res, 'app.js')
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true })

    // ---- inbound email webhook: called by an email-parsing provider, not
    // the dashboard, so it's gated by a shared secret in the URL rather
    // than the dashboard's bearer token. ----
    if (req.method === 'POST' && url.pathname === '/webhook/inbound-email') {
      if (url.searchParams.get('secret') !== config.inboundSecret) {
        return json(res, 401, { error: 'Invalid or missing secret.' })
      }
      const body = await readJsonBody(req).catch(() => null)
      if (!body) return json(res, 400, { error: 'Invalid JSON body.' })
      record({
        kind: 'inbound',
        summary: \`Inbound email from \${body.from ?? 'unknown'}: "\${(body.subject ?? '').slice(0, 60)}"\`,
        detail: JSON.stringify(body).slice(0, 1000),
      })
      return json(res, 200, { received: true })
    }

    if (!url.pathname.startsWith('/api/')) {
      res.writeHead(404)
      return res.end('Not found')
    }

    if (!isAuthorized(req, config.authToken)) {
      return json(res, 401, { error: 'Unauthorized. Use the token shown when the connector started.' })
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { authToken, smtp, ...safe } = config
      return json(res, 200, {
        ...safe,
        smtp: {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user,
          fromAddress: smtp.fromAddress,
          fromName: smtp.fromName,
          hasPassword: Boolean(smtp.pass),
        },
      })
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      const body = await readJsonBody(req)
      if (body.safeMode === 'read-only' || body.safeMode === 'read-write') config.safeMode = body.safeMode
      if (Number.isFinite(Number(body.sendLimitPerHour))) config.sendLimitPerHour = Number(body.sendLimitPerHour)
      if (body.smtp) {
        config.smtp = {
          ...config.smtp,
          host: body.smtp.host || config.smtp.host,
          port: Number.isFinite(Number(body.smtp.port)) ? Number(body.smtp.port) : config.smtp.port,
          secure: typeof body.smtp.secure === 'boolean' ? body.smtp.secure : config.smtp.secure,
          user: body.smtp.user || config.smtp.user,
          pass: body.smtp.pass || config.smtp.pass,
          fromAddress: body.smtp.fromAddress || config.smtp.fromAddress,
          fromName: body.smtp.fromName ?? config.smtp.fromName,
        }
      }
      saveConfig(config, opts.configPath)
      return json(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/contacts') {
      return json(res, 200, { contacts: listContacts(opts.contactsPath) })
    }
    if (req.method === 'POST' && url.pathname === '/api/contacts') {
      try {
        const body = await readJsonBody(req)
        const contact = addContact(config, body, opts.contactsPath)
        record({ kind: 'drafted', summary: \`Added contact \${contact.email}\`, detail: null })
        return json(res, 201, { contact })
      } catch (err) {
        return json(res, err instanceof ContactsError ? 400 : 500, { error: err.message })
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/drafts') {
      return json(res, 200, { drafts: listDrafts(opts.queuePath) })
    }
    if (req.method === 'POST' && url.pathname === '/api/drafts') {
      const body = await readJsonBody(req)
      if (!body.to || !body.subject) return json(res, 400, { error: 'A draft needs "to" and "subject" at minimum.' })
      const draft = enqueueDraft(body, opts.queuePath)
      record({ kind: 'drafted', summary: \`Drafted email to \${draft.to}: "\${draft.subject}"\`, detail: null })
      return json(res, 201, { draft })
    }
    const approveMatch = url.pathname.match(/^\\/api\\/drafts\\/([^/]+)\\/approve$/)
    if (req.method === 'POST' && approveMatch) {
      try {
        const draft = await approveDraft(config, approveMatch[1], { queuePath: opts.queuePath })
        record({ kind: 'sent', summary: \`Sent email to \${draft.to}: "\${draft.subject}"\`, detail: null })
        return json(res, 200, { draft })
      } catch (err) {
        record({ kind: 'error', summary: err.message, detail: null })
        return json(res, err instanceof QueueError ? 400 : 502, { error: err.message })
      }
    }
    const rejectMatch = url.pathname.match(/^\\/api\\/drafts\\/([^/]+)\\/reject$/)
    if (req.method === 'POST' && rejectMatch) {
      try {
        const draft = rejectDraft(rejectMatch[1], opts.queuePath)
        record({ kind: 'rejected', summary: \`Rejected draft to \${draft.to}\`, detail: null })
        return json(res, 200, { draft })
      } catch (err) {
        return json(res, 400, { error: err.message })
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/log') {
      return json(res, 200, { entries: recent(Number(url.searchParams.get('limit') ?? 50)) })
    }
    if (req.method === 'POST' && url.pathname === '/api/log/clear') {
      clearLog()
      return json(res, 200, { ok: true })
    }

    res.writeHead(404)
    res.end()
  })

  return { server, config }
}
`,
  },
  {
    path: "lib/smtp-client.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A minimal SMTP client speaking just enough of RFC 5321 to authenticate
// and send one message: connect, EHLO, AUTH LOGIN, MAIL FROM, RCPT TO,
// DATA, QUIT. No dependency on nodemailer or anything else — plain
// node:net/node:tls, because the whole package stays at zero dependencies.
//
// Connection is injectable (see \`connectFn\` below) specifically so the test
// suite can point this at a local plaintext fixture server instead of a
// real mail server — the protocol logic is what's under test, not TLS.

import net from 'node:net'
import tls from 'node:tls'

const RESPONSE_TIMEOUT_MS = 10_000

export class SmtpError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'SmtpError'
    this.code = code
  }
}

/** Reads one SMTP response (possibly multi-line, "250-..." then "250 ..."). */
function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buf = ''
    const timer = setTimeout(() => {
      socket.removeListener('data', onData)
      reject(new SmtpError('Timed out waiting for SMTP server response', null))
    }, RESPONSE_TIMEOUT_MS)

    function onData(chunk) {
      buf += chunk.toString('utf8')
      const lines = buf.split('\\r\\n').filter(Boolean)
      const last = lines[lines.length - 1]
      // A final line has a space after the 3-digit code; "-" means more lines follow.
      if (last && /^\\d{3} /.test(last)) {
        clearTimeout(timer)
        socket.removeListener('data', onData)
        const code = Number(last.slice(0, 3))
        resolve({ code, text: buf })
      }
    }
    socket.on('data', onData)
  })
}

function writeLine(socket, line) {
  socket.write(line + '\\r\\n')
}

async function expect(socket, expectedCode, label) {
  const res = await readResponse(socket)
  if (res.code !== expectedCode) {
    throw new SmtpError(\`SMTP \${label} failed: expected \${expectedCode}, got \${res.code} (\${res.text.trim()})\`, res.code)
  }
  return res
}

function buildMessage({ from, fromName, to, subject, text, html }) {
  const fromHeader = fromName ? \`"\${fromName}" <\${from}>\` : from
  const date = new Date().toUTCString()
  const boundary = \`----mc-email-\${Date.now()}\`
  const headers = [
    \`From: \${fromHeader}\`,
    \`To: \${to}\`,
    \`Subject: \${subject}\`,
    \`Date: \${date}\`,
    'MIME-Version: 1.0',
  ]

  let body
  if (html) {
    headers.push(\`Content-Type: multipart/alternative; boundary="\${boundary}"\`)
    body =
      \`--\${boundary}\\r\\nContent-Type: text/plain; charset=utf-8\\r\\n\\r\\n\${text ?? ''}\\r\\n\` +
      \`--\${boundary}\\r\\nContent-Type: text/html; charset=utf-8\\r\\n\\r\\n\${html}\\r\\n--\${boundary}--\`
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8')
    body = text ?? ''
  }

  // Per RFC 5321, a line consisting of a single "." must be escaped by
  // doubling it, since a lone "." on its own line terminates the DATA block.
  const escaped = body.replace(/^\\./gm, '..')
  return \`\${headers.join('\\r\\n')}\\r\\n\\r\\n\${escaped}\`
}

/**
 * Send one email over SMTP. Does not check safe mode itself — the caller
 * (the approval queue) is where that gate belongs, since this function's
 * whole job is "actually send", which by definition only ever runs after
 * a human has approved a queued draft.
 *
 * @param {import('./config.mjs').EmailConfig} config
 * @param {{ to: string, subject: string, text?: string, html?: string }} message
 * @param {{ connectFn?: (opts: object) => import('node:net').Socket }} [opts]
 */
export async function sendMail(config, message, opts = {}) {
  const { smtp } = config
  if (!smtp.host || !smtp.user || !smtp.pass || !smtp.fromAddress) {
    throw new SmtpError('SMTP is not configured yet — set host, user, password, and a from address first.', null)
  }

  const connect = opts.connectFn ?? ((connectOpts) =>
    smtp.secure
      ? tls.connect({ host: smtp.host, port: smtp.port, servername: smtp.host, ...connectOpts })
      : net.connect({ host: smtp.host, port: smtp.port, ...connectOpts }))

  const socket = connect({})

  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('secureConnect', resolve)
      socket.once('error', reject)
    })

    await expect(socket, 220, 'greeting')
    writeLine(socket, \`EHLO \${smtp.host}\`)
    await expect(socket, 250, 'EHLO')

    writeLine(socket, 'AUTH LOGIN')
    await expect(socket, 334, 'AUTH LOGIN prompt')
    writeLine(socket, Buffer.from(smtp.user, 'utf8').toString('base64'))
    await expect(socket, 334, 'username')
    writeLine(socket, Buffer.from(smtp.pass, 'utf8').toString('base64'))
    await expect(socket, 235, 'authentication')

    writeLine(socket, \`MAIL FROM:<\${smtp.fromAddress}>\`)
    await expect(socket, 250, 'MAIL FROM')
    writeLine(socket, \`RCPT TO:<\${message.to}>\`)
    await expect(socket, 250, 'RCPT TO')

    writeLine(socket, 'DATA')
    await expect(socket, 354, 'DATA')
    const raw = buildMessage({
      from: smtp.fromAddress,
      fromName: smtp.fromName,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })
    writeLine(socket, \`\${raw}\\r\\n.\`)
    await expect(socket, 250, 'message body')

    writeLine(socket, 'QUIT')
    // Best-effort — a slow/missing QUIT response shouldn't fail a send
    // that has already been accepted by the server.
    await readResponse(socket).catch(() => {})

    return { ok: true }
  } finally {
    socket.destroy()
  }
}
`,
  },
  {
    path: "lib/ui/app.js",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

let token = sessionStorage.getItem('mce-token') || ''

const gate = document.getElementById('token-gate')
const app = document.getElementById('app')

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: \`Bearer \${token}\`, ...(opts.headers || {}) },
  })
  if (res.status === 401) {
    sessionStorage.removeItem('mce-token')
    location.reload()
    throw new Error('unauthorized')
  }
  return res.json()
}

function unlock() {
  token = document.getElementById('token-input').value.trim()
  if (!token) return
  sessionStorage.setItem('mce-token', token)
  init()
}
document.getElementById('token-submit').addEventListener('click', unlock)
document.getElementById('token-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock() })

document.getElementById('save-safe').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({ safeMode: document.getElementById('safe-mode').value, sendLimitPerHour: Number(document.getElementById('send-limit').value) }),
  })
  await refreshConfig()
})

document.getElementById('save-smtp').addEventListener('click', async () => {
  await api('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      smtp: {
        host: document.getElementById('smtp-host').value.trim(),
        port: Number(document.getElementById('smtp-port').value),
        user: document.getElementById('smtp-user').value.trim(),
        pass: document.getElementById('smtp-pass').value.trim(),
        fromAddress: document.getElementById('from-address').value.trim(),
        fromName: document.getElementById('from-name').value.trim(),
      },
    }),
  })
  document.getElementById('smtp-pass').value = ''
  await refreshConfig()
})

document.getElementById('add-contact').addEventListener('click', async () => {
  const name = document.getElementById('contact-name').value.trim()
  const email = document.getElementById('contact-email').value.trim()
  if (!email) return
  const data = await api('/api/contacts', { method: 'POST', body: JSON.stringify({ name, email }) })
  if (!data.error) {
    document.getElementById('contact-name').value = ''
    document.getElementById('contact-email').value = ''
  }
  await refreshContacts()
  await refreshLog()
})

async function refreshContacts() {
  const { contacts } = await api('/api/contacts')
  const el = document.getElementById('contacts')
  el.innerHTML = contacts.length
    ? contacts.map((c) => \`<div class="contact">\${c.name ? c.name + ' — ' : ''}\${c.email}</div>\`).join('')
    : '<p class="sub">No contacts yet.</p>'
}

async function refreshDrafts() {
  const { drafts } = await api('/api/drafts')
  const el = document.getElementById('drafts')
  el.innerHTML = drafts.length
    ? drafts.map((d) => \`
      <div class="draft">
        <div class="meta">To: \${d.to} · <span class="status \${d.status}">\${d.status}</span></div>
        <strong>\${d.subject}</strong>
        <p class="sub">\${(d.text || '').slice(0, 140)}</p>
        \${d.status === 'pending' ? \`
          <button data-approve="\${d.id}">Approve &amp; send</button>
          <button class="danger" data-reject="\${d.id}">Reject</button>
        \` : ''}
      </div>
    \`).join('')
    : '<p class="sub">No drafts yet.</p>'

  el.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const data = await api(\`/api/drafts/\${btn.dataset.approve}/approve\`, { method: 'POST' })
      if (data.error) alert(data.error)
      await refreshDrafts()
      await refreshLog()
    })
  })
  el.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(\`/api/drafts/\${btn.dataset.reject}/reject\`, { method: 'POST' })
      await refreshDrafts()
      await refreshLog()
    })
  })
}

document.getElementById('clear-log').addEventListener('click', async () => {
  await api('/api/log/clear', { method: 'POST' })
  await refreshLog()
})
async function refreshLog() {
  const { entries } = await api('/api/log?limit=50')
  const el = document.getElementById('log')
  el.innerHTML = entries.length
    ? entries.map((e) => \`<div class="log-entry \${e.kind === 'error' ? 'error' : ''}"><span class="tag">\${e.kind} · \${e.at}</span><br/>\${e.summary}</div>\`).join('')
    : '<p class="sub">No activity yet.</p>'
}

async function refreshConfig() {
  const config = await api('/api/config')
  document.getElementById('safe-mode').value = config.safeMode
  document.getElementById('send-limit').value = config.sendLimitPerHour
  const badge = document.getElementById('safe-badge')
  badge.textContent = config.safeMode
  badge.className = \`safe-badge \${config.safeMode === 'read-write' ? 'rw' : 'ro'}\`

  document.getElementById('smtp-host').value = config.smtp.host || ''
  document.getElementById('smtp-port').value = config.smtp.port || 465
  document.getElementById('smtp-user').value = config.smtp.user || ''
  document.getElementById('from-address').value = config.smtp.fromAddress || ''
  document.getElementById('from-name').value = config.smtp.fromName || ''

  document.getElementById('inbound-url').value = \`\${location.origin}/webhook/inbound-email?secret=\${config.inboundSecret}\`
}

async function init() {
  gate.hidden = true
  app.hidden = false
  await refreshConfig()
  await refreshDrafts()
  await refreshContacts()
  await refreshLog()
  setInterval(() => { refreshDrafts(); refreshLog() }, 5000)
}

if (token) init()
`,
  },
  {
    path: "lib/ui/index.html",
    contents: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MultiConnect: Email/CRM</title>
<style>
  :root{--ink:#080000;--panel:#150808;--line:#4A1212;--paper:#FFD4D4;--muted:#E86A6A;--brass:#FF2A2A;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--paper);font-family:system-ui,-apple-system,sans-serif;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 60px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:var(--muted);font-size:13px;margin:0 0 28px}
  section{border:1px solid var(--line);border-radius:6px;padding:18px;margin-bottom:18px;background:var(--panel)}
  h2{font-size:15px;margin:0 0 12px}
  label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
  input,select,textarea{width:100%;background:#0c0404;color:var(--paper);border:1px solid var(--line);border-radius:4px;padding:8px 10px;font-family:inherit;font-size:14px;margin-bottom:10px}
  button{background:var(--brass);color:var(--ink);font-weight:600;font-size:13px;padding:8px 14px;border:none;border-radius:4px;cursor:pointer}
  button.ghost{background:transparent;color:var(--brass);border:1px solid var(--line)}
  button.danger{background:transparent;color:#ff786e;border:1px solid #5a2020}
  .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .safe-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
  .safe-badge.ro{background:#1a3d1a;color:#7cd67c}
  .safe-badge.rw{background:#3d1a1a;color:#ff9c9c}
  .draft{border:1px solid var(--line);border-radius:4px;padding:12px;margin-bottom:10px}
  .draft .meta{font-size:12px;color:var(--muted);margin-bottom:6px}
  .draft .status{font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:10px}
  .status.pending{background:#3d3510;color:#e8c96a}
  .status.sent{background:#1a3d1a;color:#7cd67c}
  .status.rejected{background:#3d1a1a;color:#ff9c9c}
  .log-entry{border-top:1px solid var(--line);padding:8px 0;font-size:12.5px;font-family:monospace}
  .log-entry.error{color:#ff786e}
  .tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
  #token-gate{text-align:center;padding-top:60px}
  .contact{border-top:1px solid var(--line);padding:8px 0;font-size:13px}
</style>
</head>
<body>
<div id="token-gate">
  <div class="wrap">
    <h1>MultiConnect: Email/CRM</h1>
    <p class="sub">Paste the token shown in your terminal when the connector started.</p>
    <input id="token-input" placeholder="local auth token" style="max-width:340px;margin:0 auto 10px"/>
    <div><button id="token-submit">Unlock dashboard</button></div>
  </div>
</div>

<div id="app" class="wrap" hidden>
  <h1>MultiConnect: Email/CRM</h1>
  <p class="sub">Running locally · nothing sends without your approval here.</p>

  <section>
    <h2>Safe mode <span id="safe-badge" class="safe-badge ro">read-only</span></h2>
    <label for="safe-mode">Access level</label>
    <select id="safe-mode">
      <option value="read-only">Read-only — agent can draft and read contacts, nothing sends</option>
      <option value="read-write">Read/write — you can approve drafts to send, and add contacts</option>
    </select>
    <label for="send-limit">Send limit per hour</label>
    <input id="send-limit" type="number" value="20" min="1"/>
    <button id="save-safe">Save</button>
  </section>

  <section>
    <h2>SMTP connection</h2>
    <label for="smtp-host">SMTP host</label>
    <input id="smtp-host" placeholder="smtp.gmail.com"/>
    <label for="smtp-port">Port</label>
    <input id="smtp-port" type="number" value="465"/>
    <label for="smtp-user">Username</label>
    <input id="smtp-user" placeholder="you@yourdomain.com"/>
    <label for="smtp-pass">Password / app password</label>
    <input id="smtp-pass" type="password"/>
    <label for="from-address">From address</label>
    <input id="from-address" placeholder="you@yourdomain.com"/>
    <label for="from-name">From name (optional)</label>
    <input id="from-name" placeholder="Your Company"/>
    <button id="save-smtp">Save SMTP connection</button>
  </section>

  <section>
    <h2>Inbound email</h2>
    <p class="sub">Point your email provider's inbound-parse webhook (e.g. SendGrid Inbound Parse, Mailgun Routes) at this URL:</p>
    <input id="inbound-url" readonly/>
  </section>

  <section>
    <h2>Approval queue</h2>
    <div id="drafts"></div>
  </section>

  <section>
    <h2>Contacts</h2>
    <div class="row">
      <input id="contact-name" placeholder="Name"/>
      <input id="contact-email" placeholder="Email"/>
      <button id="add-contact">Add</button>
    </div>
    <div id="contacts"></div>
  </section>

  <section>
    <h2>Activity log</h2>
    <button class="ghost" id="clear-log">Clear</button>
    <div id="log"></div>
  </section>
</div>

<script src="/app.js"></script>
</body>
</html>
`,
  },
  {
    path: "bin/email-connect.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = \`multiconnect-email — connect your AI agent to email, safely

Usage
  multiconnect-email start [options]

Options
  --port <n>       Port to listen on (default: 8425)
  --config <path>  Path to bridge.config.json (default: ./bridge.config.json)
  -h, --help       Show this message
  -v, --version    Show the connector version
\`

function parseArgs(argv) {
  const args = { port: undefined, config: undefined, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') args.help = true
    else if (a === '-v' || a === '--version') args.version = true
    else if (a === '--port') args.port = Number(argv[++i])
    else if (a === '--config') args.config = argv[++i]
  }
  return args
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'start'
  const rest = cmd === argv[0] ? argv.slice(1) : argv
  const args = parseArgs(rest)

  if (args.help) { console.log(USAGE); process.exit(0) }
  if (args.version) { console.log('1.0.0'); process.exit(0) }
  if (cmd !== 'start') { console.log(USAGE); process.exit(2) }

  const { server, config } = createServer({ port: args.port, configPath: args.config ?? defaultConfigPath() })

  server.listen(config.port, () => {
    console.log('')
    console.log('  MultiConnect: Email/CRM is running.')
    console.log('')
    console.log(\`  Dashboard:  http://localhost:\${config.port}\`)
    console.log(\`  Token:      \${config.authToken}\`)
    console.log('')
    console.log(\`  Inbound webhook URL: http://localhost:\${config.port}/webhook/inbound-email?secret=\${config.inboundSecret}\`)
    console.log('')
    console.log('  Safe mode starts as read-only. Nothing sends until you approve a draft in')
    console.log('  read-write mode.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiconnect-email: fatal —', err.message)
  process.exit(2)
})
`,
  },
  {
    path: "adapters/systemd.service",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Linux equivalent of adapters/windows-task.ps1.
#
# Install:
#   sed -i "s|REPLACE_WITH_PACKAGE_PATH|$(pwd)|g" adapters/systemd.service
#   mkdir -p ~/.config/systemd/user
#   cp adapters/systemd.service ~/.config/systemd/user/multiconnect-email.service
#   systemctl --user enable --now multiconnect-email

[Unit]
Description=MultiConnect Email/CRM
After=network.target

[Service]
Type=simple
WorkingDirectory=REPLACE_WITH_PACKAGE_PATH
ExecStart=/usr/bin/env node REPLACE_WITH_PACKAGE_PATH/bin/email-connect.mjs start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`,
  },
  {
    path: "adapters/windows-task.ps1",
    contents: `# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.
#
# Registers the connector as a Windows Scheduled Task that starts silently at
# logon and keeps running in the background.
#
# Usage (from an elevated PowerShell prompt, run from the package root):
#   .\\adapters\\windows-task.ps1

$ErrorActionPreference = 'Stop'

$packageRoot = Split-Path -Parent $PSScriptRoot
$binPath = Join-Path $packageRoot 'bin\\email-connect.mjs'
$nodePath = (Get-Command node).Source

if (-not $nodePath) {
    Write-Error "Node.js was not found on PATH. Install Node 18+ first."
    exit 1
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "\`"$binPath\`" start" -WorkingDirectory $packageRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName "MultiConnect Email CRM" \`
    -Action $action -Trigger $trigger -Settings $settings -Force

Write-Host "Registered. The connector will start automatically at your next login."
Write-Host "To start it right now: Start-ScheduledTask -TaskName 'MultiConnect Email CRM'"
Write-Host "To remove it later:    Unregister-ScheduledTask -TaskName 'MultiConnect Email CRM'"
`,
  },
  {
    path: "test/contacts.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { listContacts, addContact, ContactsError } from '../lib/contacts.mjs'

function tempContactsPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mce-contacts-'))
  return { contactsPath: path.join(dir, 'contacts.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('listContacts returns an empty array when no file exists yet', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    assert.deepEqual(listContacts(contactsPath), [])
  } finally {
    cleanup()
  }
})

test('addContact refuses in read-only mode', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    assert.throws(
      () => addContact({ safeMode: 'read-only' }, { name: 'Ada', email: 'ada@example.com' }, contactsPath),
      (err) => err instanceof ContactsError && /read-only/.test(err.message),
    )
    assert.deepEqual(listContacts(contactsPath), [])
  } finally {
    cleanup()
  }
})

test('addContact succeeds in read-write mode and persists', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    const contact = addContact({ safeMode: 'read-write' }, { name: 'Ada', email: 'ada@example.com' }, contactsPath)
    assert.equal(contact.email, 'ada@example.com')
    assert.equal(listContacts(contactsPath).length, 1)
  } finally {
    cleanup()
  }
})

test('addContact requires an email', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    assert.throws(
      () => addContact({ safeMode: 'read-write' }, { name: 'No Email' }, contactsPath),
      (err) => err instanceof ContactsError && /email/.test(err.message),
    )
  } finally {
    cleanup()
  }
})

test('addContact prepends new contacts, most recent first', () => {
  const { contactsPath, cleanup } = tempContactsPath()
  try {
    addContact({ safeMode: 'read-write' }, { name: 'First', email: 'first@example.com' }, contactsPath)
    addContact({ safeMode: 'read-write' }, { name: 'Second', email: 'second@example.com' }, contactsPath)
    const contacts = listContacts(contactsPath)
    assert.equal(contacts[0].email, 'second@example.com')
    assert.equal(contacts[1].email, 'first@example.com')
  } finally {
    cleanup()
  }
})
`,
  },
  {
    path: "test/queue.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { enqueueDraft, listDrafts, approveDraft, rejectDraft, QueueError } from '../lib/queue.mjs'

function tempQueuePath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mce-queue-'))
  return { queuePath: path.join(dir, 'email-queue.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

const FAKE_SEND_OK = async () => ({ ok: true })

test('enqueueDraft always succeeds regardless of safe mode', () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const draft = enqueueDraft({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, queuePath)
    assert.equal(draft.status, 'pending')
    assert.equal(listDrafts(queuePath).length, 1)
  } finally {
    cleanup()
  }
})

test('approveDraft refuses in read-only mode without calling sendFn', async () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const draft = enqueueDraft({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, queuePath)
    let called = false
    const sendFn = async () => { called = true; return { ok: true } }
    await assert.rejects(
      () => approveDraft({ safeMode: 'read-only' }, draft.id, { queuePath, sendFn }),
      (err) => err instanceof QueueError && /read-only/.test(err.message),
    )
    assert.equal(called, false)
    assert.equal(listDrafts(queuePath)[0].status, 'pending')
  } finally {
    cleanup()
  }
})

test('approveDraft sends and marks the draft sent in read-write mode', async () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const draft = enqueueDraft({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, queuePath)
    const result = await approveDraft({ safeMode: 'read-write', sendLimitPerHour: 20 }, draft.id, { queuePath, sendFn: FAKE_SEND_OK })
    assert.equal(result.status, 'sent')
    assert.ok(result.sentAt)
    assert.equal(listDrafts(queuePath)[0].status, 'sent')
  } finally {
    cleanup()
  }
})

test('approveDraft refuses to approve an already-sent draft twice', async () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const draft = enqueueDraft({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, queuePath)
    await approveDraft({ safeMode: 'read-write', sendLimitPerHour: 20 }, draft.id, { queuePath, sendFn: FAKE_SEND_OK })
    await assert.rejects(
      () => approveDraft({ safeMode: 'read-write', sendLimitPerHour: 20 }, draft.id, { queuePath, sendFn: FAKE_SEND_OK }),
      (err) => err instanceof QueueError && /already sent/.test(err.message),
    )
  } finally {
    cleanup()
  }
})

test('approveDraft enforces the per-hour send limit', async () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const d1 = enqueueDraft({ to: 'a@example.com', subject: '1', text: 'x' }, queuePath)
    const d2 = enqueueDraft({ to: 'b@example.com', subject: '2', text: 'x' }, queuePath)
    const config = { safeMode: 'read-write', sendLimitPerHour: 1 }
    await approveDraft(config, d1.id, { queuePath, sendFn: FAKE_SEND_OK })
    await assert.rejects(
      () => approveDraft(config, d2.id, { queuePath, sendFn: FAKE_SEND_OK }),
      (err) => err instanceof QueueError && /limit/.test(err.message),
    )
  } finally {
    cleanup()
  }
})

test('approveDraft surfaces a failure from sendFn without marking the draft sent', async () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const draft = enqueueDraft({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, queuePath)
    const failingSend = async () => { throw new Error('SMTP down') }
    await assert.rejects(() => approveDraft({ safeMode: 'read-write', sendLimitPerHour: 20 }, draft.id, { queuePath, sendFn: failingSend }))
    assert.equal(listDrafts(queuePath)[0].status, 'pending')
  } finally {
    cleanup()
  }
})

test('rejectDraft works regardless of safe mode', () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    const draft = enqueueDraft({ to: 'a@example.com', subject: 'Hi', text: 'Hello' }, queuePath)
    const rejected = rejectDraft(draft.id, queuePath)
    assert.equal(rejected.status, 'rejected')
  } finally {
    cleanup()
  }
})

test('rejectDraft on an unknown id throws', () => {
  const { queuePath, cleanup } = tempQueuePath()
  try {
    assert.throws(() => rejectDraft('nonexistent', queuePath), QueueError)
  } finally {
    cleanup()
  }
})
`,
  },
  {
    path: "test/run.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import './smtp-client.test.mjs'
import './queue.test.mjs'
import './contacts.test.mjs'
import './server.test.mjs'
`,
  },
  {
    path: "test/server.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from '../lib/server.mjs'

async function boot() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mce-test-'))
  const configPath = path.join(dir, 'bridge.config.json')
  const queuePath = path.join(dir, 'email-queue.json')
  const contactsPath = path.join(dir, 'contacts.json')
  const { server, config } = createServer({ port: 0, configPath, queuePath, contactsPath })
  await new Promise((resolve) => server.listen(0, resolve))
  const port = server.address().port
  return {
    port,
    token: config.authToken,
    inboundSecret: config.inboundSecret,
    close: () => {
      server.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

test('healthz responds without auth', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/healthz\`)
    assert.equal(res.status, 200)
  } finally {
    ctx.close()
  }
})

test('api routes reject requests without a valid token', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`)
    assert.equal(res.status, 401)
  } finally {
    ctx.close()
  }
})

test('new installs default to read-only safe mode', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.safeMode, 'read-only')
    assert.equal(body.sendLimitPerHour, 20)
  } finally {
    ctx.close()
  }
})

test('config API never echoes the SMTP password, only presence flag', async () => {
  const ctx = await boot()
  try {
    await fetch(\`http://localhost:\${ctx.port}/api/config\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ smtp: { host: 'smtp.example.com', user: 'me', pass: 'SUPER_SECRET', fromAddress: 'me@example.com' } }),
    })
    const res = await fetch(\`http://localhost:\${ctx.port}/api/config\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const body = await res.json()
    assert.equal(body.smtp.hasPassword, true)
    assert.ok(!JSON.stringify(body).includes('SUPER_SECRET'))
    assert.ok(!('authToken' in body))
  } finally {
    ctx.close()
  }
})

test('drafting an email works via the API and appears in the queue', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/drafts\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ to: 'lead@example.com', subject: 'Following up', text: 'Hi there' }),
    })
    assert.equal(res.status, 201)
    const { draft } = await res.json()
    assert.equal(draft.status, 'pending')

    const listRes = await fetch(\`http://localhost:\${ctx.port}/api/drafts\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { drafts } = await listRes.json()
    assert.equal(drafts.length, 1)
  } finally {
    ctx.close()
  }
})

test('approving a draft in read-only mode is rejected', async () => {
  const ctx = await boot()
  try {
    const draftRes = await fetch(\`http://localhost:\${ctx.port}/api/drafts\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ to: 'lead@example.com', subject: 'Hi', text: 'Hi' }),
    })
    const { draft } = await draftRes.json()

    const approveRes = await fetch(\`http://localhost:\${ctx.port}/api/drafts/\${draft.id}/approve\`, {
      method: 'POST',
      headers: { authorization: \`Bearer \${ctx.token}\` },
    })
    assert.equal(approveRes.status, 400)
    const body = await approveRes.json()
    assert.match(body.error, /read-only/)
  } finally {
    ctx.close()
  }
})

test('adding a contact requires read-write mode', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/api/contacts\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: \`Bearer \${ctx.token}\` },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    })
    assert.equal(res.status, 400)
  } finally {
    ctx.close()
  }
})

test('inbound webhook requires the correct secret', async () => {
  const ctx = await boot()
  try {
    const badRes = await fetch(\`http://localhost:\${ctx.port}/webhook/inbound-email?secret=wrong\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'x@example.com', subject: 'Hi' }),
    })
    assert.equal(badRes.status, 401)

    const goodRes = await fetch(\`http://localhost:\${ctx.port}/webhook/inbound-email?secret=\${ctx.inboundSecret}\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'x@example.com', subject: 'Question about pricing' }),
    })
    assert.equal(goodRes.status, 200)

    const logRes = await fetch(\`http://localhost:\${ctx.port}/api/log\`, { headers: { authorization: \`Bearer \${ctx.token}\` } })
    const { entries } = await logRes.json()
    assert.ok(entries.some((e) => e.kind === 'inbound' && e.summary.includes('pricing')))
  } finally {
    ctx.close()
  }
})

test('dashboard root serves HTML', async () => {
  const ctx = await boot()
  try {
    const res = await fetch(\`http://localhost:\${ctx.port}/\`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\\/html/)
  } finally {
    ctx.close()
  }
})
`,
  },
  {
    path: "test/smtp-client.test.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.
//
// Runs the real SMTP client against a small fake SMTP server (plain
// node:net, no TLS) that speaks enough of RFC 5321 to exercise the actual
// EHLO/AUTH/MAIL FROM/RCPT TO/DATA sequence. This tests protocol
// correctness, not encryption — connectFn injection is what lets the test
// point at a plaintext fixture instead of a real mail server.

import assert from 'node:assert/strict'
import test from 'node:test'
import net from 'node:net'
import { sendMail, SmtpError } from '../lib/smtp-client.mjs'

/**
 * A minimal fake SMTP server. \`behavior\` can override how it responds to
 * specific commands, to test failure paths (bad auth, rejected recipient).
 */
function startFakeSmtp(behavior = {}) {
  const received = { commands: [], dataBody: '' }
  const server = net.createServer((socket) => {
    let stage = 'greeting'
    let dataBuf = ''
    socket.write('220 fake.smtp.test ESMTP\\r\\n')

    socket.on('data', (chunk) => {
      const text = chunk.toString('utf8')

      if (stage === 'data') {
        dataBuf += text
        if (dataBuf.endsWith('\\r\\n.\\r\\n')) {
          received.dataBody = dataBuf.slice(0, -5)
          stage = 'ready'
          socket.write(behavior.dataResponse ?? '250 OK message accepted\\r\\n')
        }
        return
      }

      const line = text.trim()
      received.commands.push(line)

      if (/^EHLO/i.test(line)) {
        socket.write('250-fake.smtp.test\\r\\n250 AUTH LOGIN\\r\\n')
      } else if (/^AUTH LOGIN/i.test(line)) {
        stage = 'auth-user'
        socket.write('334 VXNlcm5hbWU6\\r\\n')
      } else if (stage === 'auth-user') {
        stage = 'auth-pass'
        socket.write('334 UGFzc3dvcmQ6\\r\\n')
      } else if (stage === 'auth-pass') {
        stage = 'ready'
        socket.write(behavior.authResponse ?? '235 Authentication successful\\r\\n')
      } else if (/^MAIL FROM/i.test(line)) {
        socket.write(behavior.mailFromResponse ?? '250 OK\\r\\n')
      } else if (/^RCPT TO/i.test(line)) {
        socket.write(behavior.rcptResponse ?? '250 OK\\r\\n')
      } else if (/^DATA/i.test(line)) {
        stage = 'data'
        socket.write('354 Start mail input\\r\\n')
      } else if (/^QUIT/i.test(line)) {
        socket.write('221 Bye\\r\\n')
        socket.end()
      }
    })
  })
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port, received }))
  })
}

function testConfig(port, overrides = {}) {
  return {
    smtp: {
      host: '127.0.0.1',
      port,
      secure: false,
      user: 'testuser',
      pass: 'testpass',
      fromAddress: 'me@example.com',
      fromName: 'Test Sender',
      ...overrides,
    },
  }
}

test('sendMail completes a full send against a well-behaved server', async () => {
  const { server, port, received } = await startFakeSmtp()
  try {
    const result = await sendMail(testConfig(port), { to: 'you@example.com', subject: 'Hello', text: 'Hi there' })
    assert.equal(result.ok, true)
    assert.ok(received.commands.some((c) => /^MAIL FROM:<me@example.com>/i.test(c)))
    assert.ok(received.commands.some((c) => /^RCPT TO:<you@example.com>/i.test(c)))
    assert.match(received.dataBody, /Subject: Hello/)
    assert.match(received.dataBody, /Hi there/)
  } finally {
    server.close()
  }
})

test('sendMail throws when SMTP is not configured', async () => {
  await assert.rejects(
    () => sendMail({ smtp: { host: null, user: null, pass: null, fromAddress: null } }, { to: 'x@example.com', subject: 'x', text: 'x' }),
    (err) => err instanceof SmtpError && /not configured/.test(err.message),
  )
})

test('sendMail throws a clear error when authentication fails', async () => {
  const { server, port } = await startFakeSmtp({ authResponse: '535 Authentication failed\\r\\n' })
  try {
    await assert.rejects(
      () => sendMail(testConfig(port), { to: 'you@example.com', subject: 'Hi', text: 'x' }),
      (err) => err instanceof SmtpError && err.code === 535,
    )
  } finally {
    server.close()
  }
})

test('sendMail throws a clear error when the recipient is rejected', async () => {
  const { server, port } = await startFakeSmtp({ rcptResponse: '550 No such user\\r\\n' })
  try {
    await assert.rejects(
      () => sendMail(testConfig(port), { to: 'nobody@example.com', subject: 'Hi', text: 'x' }),
      (err) => err instanceof SmtpError && err.code === 550,
    )
  } finally {
    server.close()
  }
})

test('sendMail escapes a lone-dot line in the message body', async () => {
  const { server, port, received } = await startFakeSmtp()
  try {
    await sendMail(testConfig(port), { to: 'you@example.com', subject: 'Dots', text: 'Line one\\n.\\nLine three' })
    // The escaped ".." should appear where the lone "." was, and the raw
    // terminator sequence should never appear inside the transmitted body.
    assert.match(received.dataBody, /Line one\\n\\.\\.\\nLine three/)
    assert.doesNotMatch(received.dataBody.replace(/\\.\\.\\r?\\n/g, ''), /^\\.\\r?\\n/m)
  } finally {
    server.close()
  }
})

test('sendMail includes both text and html parts when html is given', async () => {
  const { server, port, received } = await startFakeSmtp()
  try {
    await sendMail(testConfig(port), { to: 'you@example.com', subject: 'Rich', text: 'plain', html: '<b>bold</b>' })
    assert.match(received.dataBody, /multipart\\/alternative/)
    assert.match(received.dataBody, /<b>bold<\\/b>/)
  } finally {
    server.close()
  }
})
`,
  },
]
