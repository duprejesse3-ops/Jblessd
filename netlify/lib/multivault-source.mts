// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by packages/multivault/tools/embed-source.mjs from the real
// package source. Regenerate after changing the package:
//
//   node packages/multivault/tools/embed-source.mjs
//
// This is the payload for the MultiVault product (SKU AI-CN-008): the
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

export const MULTIVAULT_SOURCE: SourceFile[] = [
  {
    path: "README.md",
    contents: `# multivault

A local, encrypted context snapshot of one folder and one calendar file —
turned into a short brief you can paste into any AI chat, or pipe into your
own API calls, instead of re-explaining your situation every time.

No account. No OAuth. No cloud storage. The vault file lives on your machine,
and only your passphrase can open it.

## What this actually is (v1 scope)

This is a **local snapshot tool**, not a live tunnel into your files or
calendar. \`vault sync\` reads your folder and calendar file once, encrypts
what it found, and writes it to disk. \`vault context\` decrypts that snapshot
and formats it. Nothing runs continuously in the background unless you set up
one of the [adapters](#keeping-it-fresh) to sync on a schedule — and even
then, each sync is a single read-and-encrypt pass, not an open connection.

**What it watches:**
- **One local folder.** File names, sizes, and modified times are always
  included. For a small allowlist of plain-text formats (\`.md\`, \`.txt\`,
  \`.csv\`, \`.json\`) under 100KB, a short excerpt of the content is also
  included — capped at 2000 characters per file. Anything else (images,
  PDFs, spreadsheets, executables, anything with "key", "secret",
  "credential", or "password" in the filename) is listed by name only; its
  contents are never read.
- **One \`.ics\` calendar file**, if you point one at it. This is a *file*, not
  a live Google/Outlook/etc. connection — most calendar apps have an
  export-to-\`.ics\` or auto-sync-to-file option; point \`--ics\` at that file
  and each \`vault sync\` will pick up whatever's in it.

**What it explicitly does NOT do in v1:**
- No OAuth or live API connection to Google Calendar, Outlook, email, or
  anything else.
- No automatic injection into a third-party AI tool. \`vault context\` prints a
  snippet — you paste it in, or pipe it into your own script (see below).
- No recursive scan past 3 folder levels deep, and no more than 500 files per
  sync, so a huge folder can't turn a sync into a multi-minute disk read.

If you need more than this (live calendar API, deeper folder trees, more file
types), that's a real v2 conversation — this README describes what v1 ships,
not a roadmap promise.

## Quick start

\`\`\`
npm install    # nothing to install — zero dependencies, this just verifies your Node version
node bin/vault.mjs init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
\`\`\`

This prints a **passphrase — save it now.** There is no recovery if you lose
it; see LICENSE.md.

\`\`\`
node bin/vault.mjs sync
node bin/vault.mjs context
\`\`\`

\`vault context\` prints a markdown brief. Paste it at the top of a chat with
any AI, or:

\`\`\`
node bin/vault.mjs context --format json | your-script.js
\`\`\`

## Piping into the Claude API

\`vault context\` is deliberately just stdout, so it composes with anything.
For example, prepending it to a Claude API call:

\`\`\`js
import { execSync } from 'node:child_process'

const context = execSync('node bin/vault.mjs context', {
  env: { ...process.env, MULTIVAULT_PASSPHRASE: process.env.MULTIVAULT_PASSPHRASE },
}).toString()

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: \`\${context}\\n\\nGiven the above, ...\` }],
  }),
})
\`\`\`

## Keeping it fresh

A vault is only as useful as its last sync. Three scheduling adapters are
included in \`adapters/\` — pick whichever fits your machine:

- \`adapters/cron.sh\` — any Linux/macOS machine with cron
- \`adapters/launchd.plist\` — macOS, preferred over cron there (survives sleep/wake)
- \`adapters/windows-task.ps1\` — Windows Task Scheduler

Each reads \`MULTIVAULT_PASSPHRASE\` from the environment rather than needing
you to type it in on every run. See the header comment in each file for setup
steps.

## Commands

\`\`\`
vault init    [--folder <path>] [--ics <path>] [--dest <path>]
vault sync    [--dest <path>]
vault context [--dest <path>] [--format text|markdown|json]
vault status  [--dest <path>]
\`\`\`

\`vault status\` reads only the unencrypted metadata file (last sync time, file
count) — it never needs your passphrase, so you can check freshness from a
script without exposing the secret.

## Security model, plainly stated

- The vault file (\`vault.enc\`) is AES-256-GCM encrypted. The key is derived
  from your passphrase with scrypt (a slow, memory-hard KDF specifically to
  raise the cost of brute-forcing a stolen vault file).
- The passphrase is generated randomly at \`vault init\` and shown to you
  **exactly once**. This tool never stores it anywhere — not in a config
  file, not in an environment file it writes, nowhere. You are responsible
  for saving it (a password manager is recommended).
- \`vault.meta.json\` next to the vault is **not** encrypted — it only holds
  the folder path, calendar path, and sync timestamps, so \`vault status\` can
  work without the passphrase. If those paths themselves are sensitive on
  your machine, keep \`--dest\` somewhere access-controlled.
- Nothing in this package makes a network request. Read the source — it's
  plain, dependency-free JavaScript specifically so that claim is easy to
  verify yourself rather than something you have to take on faith.

## Standalone binaries (optional)

By default this runs as a Node script (\`node bin/vault.mjs ...\`), same as the
rest of this catalog — no separate install step beyond having Node 18+.

If you'd rather have a double-clickable executable that doesn't require Node
to be installed, run this once **on each OS you want a binary for** (it uses
Node's own built-in Single Executable Application support, injecting into a
copy of whatever Node binary is already on that machine — so it isn't a
cross-compile, but it also needs no download of a foreign platform's Node):

\`\`\`
npm install
npm run build:binary
\`\`\`

- Run on Windows → \`dist/vault-win-x64.exe\`
- Run on a Mac → \`dist/vault-macos-x64\` or \`dist/vault-macos-arm64\`
- Run on Linux → \`dist/vault-linux-x64\`

Verified working end-to-end (full init/sync/context cycle against the
compiled binary, not just \`--help\`).

**Important:** these binaries are not code-signed. Windows SmartScreen will
show an "Unknown Publisher" warning, and macOS Gatekeeper will refuse to open
an app from an "unidentified developer" until you right-click → Open once (or
run \`xattr -d com.apple.quarantine <path>\`). This is standard for any
unsigned binary, not a bug — code-signing certificates from Microsoft and
Apple are a separate purchase if you want that warning gone.

## Testing

\`\`\`
npm test
\`\`\`

Runs the adapter-free unit tests in \`test/run.mjs\` — encryption round-trip,
\`.ics\` parsing, and folder scanning against a throwaway temp directory.
`,
  },
  {
    path: "LICENSE.md",
    contents: `# License

**multivault — perpetual single-purchase license**

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

In particular: this software reads files from whatever folder you point it at,
and encrypts a snapshot of their names, sizes, and (for a small set of plain-text
formats) short excerpts of their contents, using a passphrase that only you hold.
**There is no password recovery.** If you lose your passphrase, the vault file
cannot be decrypted by [SELLER], by this software, or by anyone else — you are
responsible for storing it safely (a password manager is recommended). You are
also responsible for reviewing what folder you point the tool at and for keeping
your own backups of anything important. Nothing in this software transmits vault
contents, the passphrase, or any file it reads to [SELLER] or to any third party;
you are responsible for verifying this for your own compliance needs by reading
the source, which is provided precisely so that you can.

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
  "name": "multivault",
  "version": "1.0.0",
  "description": "A local, encrypted context snapshot of one folder and one calendar file. No account, no OAuth, no cloud storage — the vault lives on your machine and only your passphrase opens it.",
  "license": "SEE LICENSE IN LICENSE.md",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "bin": {
    "vault": "./bin/vault.mjs"
  },
  "main": "./lib/vault.mjs",
  "exports": {
    ".": "./lib/vault.mjs",
    "./crypto": "./lib/crypto.mjs",
    "./scan": "./lib/scan.mjs",
    "./calendar": "./lib/calendar.mjs"
  },
  "files": [
    "bin",
    "lib",
    "adapters",
    "README.md",
    "LICENSE.md"
  ],
  "scripts": {
    "vault": "node bin/vault.mjs",
    "test": "node test/run.mjs",
    "build:binary": "node scripts/build-sea.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.28.2",
    "postject": "^1.0.0-alpha.6"
  }
}
`,
  },
  {
    path: "lib/calendar.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A small, dependency-free .ics (iCalendar) parser — just enough of RFC 5545
// to pull events out of a calendar export. Not a full implementation (no
// recurrence-rule expansion, no timezone database) — v1 reads whatever
// concrete events are already in the file, which is what most calendar apps
// write when you export or auto-sync a .ics.
//
// Deliberately local-file only. This reads a file the user already has on
// disk (their calendar app's own export/auto-sync feature writes it) rather
// than talking to a Google/Outlook/etc. API — no OAuth app to register, no
// token to store, no third-party account access at all. See README for how
// to get your calendar app to keep that file updated.

import { readFileSync, existsSync } from 'node:fs'

function unfold(text) {
  // RFC 5545 line folding: a continuation line starts with a space or tab.
  return text.replace(/\\r\\n/g, '\\n').replace(/\\n[ \\t]/g, '')
}

function unescapeText(value) {
  return value.replace(/\\\\n/gi, '\\n').replace(/\\\\,/g, ',').replace(/\\\\;/g, ';').replace(/\\\\\\\\/g, '\\\\')
}

function parseDate(value) {
  // Handles the two common forms: YYYYMMDD (all-day) and
  // YYYYMMDDTHHMMSS[Z] (timed). Returns an ISO string, or the raw value if
  // it doesn't match either — better to pass through an odd value than drop
  // the event.
  const m = value.match(/^(\\d{4})(\\d{2})(\\d{2})(?:T(\\d{2})(\\d{2})(\\d{2})(Z)?)?$/)
  if (!m) return value
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m
  const iso = \`\${y}-\${mo}-\${d}T\${h}:\${mi}:\${s}\${z ? 'Z' : ''}\`
  return iso
}

/**
 * Parse .ics text into a flat array of events:
 *   { summary, start, end, location, description }
 * Any field not present in the source is omitted.
 */
export function parseIcs(icsText) {
  const lines = unfold(icsText).split('\\n')
  const events = []
  let current = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current && (current.summary || current.start)) events.push(current)
      current = null
      continue
    }
    if (!current) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1)
    const key = rawKey.split(';')[0].toUpperCase() // strip parameters like ;TZID=...

    if (key === 'SUMMARY') current.summary = unescapeText(value)
    else if (key === 'DTSTART') current.start = parseDate(value)
    else if (key === 'DTEND') current.end = parseDate(value)
    else if (key === 'LOCATION') current.location = unescapeText(value)
    else if (key === 'DESCRIPTION') current.description = unescapeText(value)
  }

  return events
}

/**
 * Read and parse a .ics file. Returns [] (not an error) if the path doesn't
 * exist — a calendar file is optional for MultiVault, and a missing one
 * should degrade the context, not fail the sync.
 */
export function readIcsFile(path) {
  if (!path || !existsSync(path)) return []
  try {
    return parseIcs(readFileSync(path, 'utf8'))
  } catch {
    return []
  }
}
`,
  },
  {
    path: "lib/crypto.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Encryption for the vault file itself. AES-256-GCM, key derived from the
// user's passphrase with scrypt (a fresh random salt per encrypt, stored
// alongside the ciphertext — the salt is not secret, only the passphrase is).
//
// Everything here is Node's own \`node:crypto\`. No third-party crypto library,
// so there is nothing to audit beyond what ships with Node itself, and
// nothing that can silently change behavior on an \`npm update\` you never ran
// (this package has no dependencies at all — see package.json).
//
// File layout written by encrypt(): [salt(16)][iv(12)][authTag(16)][ciphertext]
// All fixed-length except the ciphertext, so decrypt() can slice deterministically.

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32 // AES-256
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } // ~100ms on a modern laptop; deliberately slow to raise the cost of brute-forcing a stolen vault file

function deriveKey(passphrase, salt) {
  return scryptSync(passphrase, salt, KEY_LEN, SCRYPT_OPTS)
}

export function encrypt(plaintext, passphrase) {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(passphrase, salt)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([salt, iv, authTag, ciphertext])
}

export class DecryptError extends Error {}

export function decrypt(blob, passphrase) {
  if (blob.length < SALT_LEN + IV_LEN + TAG_LEN) {
    throw new DecryptError('Vault file is too short to be valid — it may be corrupt.')
  }
  const salt = blob.subarray(0, SALT_LEN)
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN)
  const authTag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN)
  const ciphertext = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN)
  const key = deriveKey(passphrase, salt)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    // GCM's auth tag check fails on any wrong passphrase or any tampering —
    // both collapse to the same message so nothing about the failure mode
    // leaks to an attacker guessing passphrases.
    throw new DecryptError('Could not open the vault. Wrong passphrase, or the file is corrupt/tampered.')
  }
}

// A random, readable-enough passphrase generated once at \`vault init\` and
// shown to the user exactly one time. Nothing about it is derived from the
// machine or the account — losing it means losing access to that vault's
// contents, by design (see README's "if you lose the passphrase" section).
export function generatePassphrase() {
  return randomBytes(24).toString('base64url') // 32 chars, URL-safe, no padding
}
`,
  },
  {
    path: "lib/scan.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Turns a watched folder into a compact snapshot: what's there, and — for a
// small set of plain-text formats under a size cap — a short excerpt of each.
//
// Deliberately conservative about what it reads. This is the one piece of
// MultiVault that touches file *contents* rather than just structure, so the
// defaults are narrow on purpose:
//   - Only a fixed allowlist of plain-text extensions are ever excerpted.
//     Anything else (images, PDFs, spreadsheets, executables, .env files,
//     anything with "key", "secret", or "credential" in the name) is listed
//     by name and metadata only — never opened.
//   - Each excerpt is capped at EXCERPT_CHAR_LIMIT characters.
//   - The whole scan stops at MAX_FILES so a huge folder can't turn a sync
//     into a multi-minute read of the entire disk.
//   - Hidden files/folders (dotfiles) and common noise directories
//     (node_modules, .git) are skipped outright.

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

export const DEFAULTS = {
  maxFiles: 500,
  maxDepth: 3,
  excerptCharLimit: 2000,
  excerptMaxFileBytes: 100_000, // don't even attempt to read a text file bigger than this
}

const EXCERPT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json'])
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '.cache'])

// Filenames that look like they hold secrets are skipped even if their
// extension is otherwise excerptable (e.g. a stray "notes.txt" is fine;
// "api-keys.txt" is not).
const SENSITIVE_NAME_PATTERN = /(secret|password|credential|\\bkeys?\\b|\\.env)/i

function isHidden(name) {
  return name.startsWith('.')
}

function shouldExcerpt(name, ext, sizeBytes) {
  if (isHidden(name)) return false
  if (!EXCERPT_EXTENSIONS.has(ext)) return false
  if (sizeBytes > DEFAULTS.excerptMaxFileBytes) return false
  if (SENSITIVE_NAME_PATTERN.test(name)) return false
  return true
}

function readExcerpt(fullPath) {
  try {
    const text = readFileSync(fullPath, 'utf8')
    return text.length > DEFAULTS.excerptCharLimit
      ? text.slice(0, DEFAULTS.excerptCharLimit) + '\\n… (truncated)'
      : text
  } catch {
    return null // unreadable (binary despite the extension, permissions, etc.) — skip silently
  }
}

/**
 * Walk \`folder\` up to \`maxDepth\` levels and return a flat list of entries:
 *   { relPath, sizeBytes, mtimeMs, ext, excerpt: string | null }
 * Stops early once \`maxFiles\` entries have been collected.
 */
export function scanFolder(folder, opts = {}) {
  const { maxFiles, maxDepth } = { ...DEFAULTS, ...opts }
  const entries = []

  function walk(dir, depth) {
    if (entries.length >= maxFiles || depth > maxDepth) return
    let names
    try {
      names = readdirSync(dir)
    } catch {
      return // unreadable directory — skip rather than fail the whole sync
    }
    for (const name of names) {
      if (entries.length >= maxFiles) return
      if (isHidden(name) || SKIP_DIR_NAMES.has(name)) continue
      const fullPath = join(dir, name)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
        continue
      }
      if (!stat.isFile()) continue
      const ext = extname(name).toLowerCase()
      const excerpt = shouldExcerpt(name, ext, stat.size) ? readExcerpt(fullPath) : null
      entries.push({
        relPath: relative(folder, fullPath),
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        ext,
        excerpt,
      })
    }
  }

  walk(folder, 0)
  return entries
}
`,
  },
  {
    path: "lib/vault.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Vault lifecycle: init (create), sync (snapshot the folder + calendar into
// an encrypted file), context (decrypt + format for pasting into an AI), and
// status (check freshness without needing the passphrase).
//
// Everything lives on disk, next to wherever the user points --dest. Nothing
// in this file makes a network request. That's the whole trust story: a
// vault is a local, encrypted snapshot of a folder and a calendar file — not
// a live tunnel into either.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { encrypt, decrypt, generatePassphrase, DecryptError } from './crypto.mjs'
import { scanFolder } from './scan.mjs'
import { readIcsFile } from './calendar.mjs'

export { DecryptError }

const VAULT_FILE = 'vault.enc'
const META_FILE = 'vault.meta.json'
const FORMAT_VERSION = 1

function vaultPaths(dest) {
  return { vaultPath: join(dest, VAULT_FILE), metaPath: join(dest, META_FILE) }
}

function readMeta(dest) {
  const { metaPath } = vaultPaths(dest)
  if (!existsSync(metaPath)) return null
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    return null
  }
}

function writeMeta(dest, meta) {
  const { metaPath } = vaultPaths(dest)
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\\n', 'utf8')
}

/**
 * Create a new, empty vault at \`dest\`. Returns the generated passphrase —
 * the ONLY time it is ever available in plaintext from this library. The
 * caller (bin/vault.mjs) is responsible for showing it to the user once and
 * telling them to save it; nothing here persists it anywhere.
 */
export function initVault(dest, { folder, icsPath } = {}) {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true })
  const { vaultPath } = vaultPaths(dest)
  if (existsSync(vaultPath)) {
    throw new Error(\`A vault already exists at \${dest}. Delete \${VAULT_FILE} first if you want to start over.\`)
  }
  const passphrase = generatePassphrase()
  const emptySnapshot = { folder: folder ?? null, icsPath: icsPath ?? null, files: [], events: [], syncedAt: null }
  writeFileSync(vaultPath, encrypt(Buffer.from(JSON.stringify(emptySnapshot)), passphrase))
  writeMeta(dest, {
    version: FORMAT_VERSION,
    folder: folder ?? null,
    icsPath: icsPath ?? null,
    createdAt: new Date().toISOString(),
    lastSyncAt: null,
    fileCount: 0,
    eventCount: 0,
  })
  return passphrase
}

/**
 * Re-scan the watched folder (and calendar file, if configured) and write a
 * fresh encrypted snapshot. Requires the passphrase to decrypt-then-overwrite
 * cleanly, even though a sync could technically just overwrite blind — this
 * way a wrong passphrase fails loudly at sync time, not silently at the next
 * \`context\` call.
 */
export function syncVault(dest, passphrase, opts = {}) {
  const meta = readMeta(dest)
  if (!meta) throw new Error(\`No vault found at \${dest}. Run "vault init" first.\`)

  // Confirm the passphrase is correct before doing any scanning work.
  const { vaultPath } = vaultPaths(dest)
  decrypt(readFileSync(vaultPath), passphrase)

  const folder = opts.folder ?? meta.folder
  const icsPath = opts.icsPath ?? meta.icsPath
  if (!folder && !icsPath) {
    throw new Error('Nothing configured to sync. Pass --folder and/or --ics, or set one at "vault init" time.')
  }

  const files = folder ? scanFolder(folder, opts.scan) : []
  const events = readIcsFile(icsPath)
  const syncedAt = new Date().toISOString()
  const snapshot = { folder, icsPath, files, events, syncedAt }

  writeFileSync(vaultPath, encrypt(Buffer.from(JSON.stringify(snapshot)), passphrase))
  writeMeta(dest, { ...meta, folder, icsPath, lastSyncAt: syncedAt, fileCount: files.length, eventCount: events.length })
  return { fileCount: files.length, eventCount: events.length, syncedAt }
}

/**
 * Decrypt the vault and return the raw snapshot object. Most callers want
 * buildContext() instead, which formats this for pasting into an AI — this
 * is exposed mainly for tests and for --format json.
 */
export function readSnapshot(dest, passphrase) {
  const { vaultPath } = vaultPaths(dest)
  if (!existsSync(vaultPath)) throw new Error(\`No vault found at \${dest}. Run "vault init" first.\`)
  const plaintext = decrypt(readFileSync(vaultPath), passphrase)
  return JSON.parse(plaintext.toString('utf8'))
}

/**
 * Build the pasteable context snippet described in the product blurb: a
 * compact brief of what's in the watched folder and what's on the calendar,
 * meant to be dropped at the top of a chat with an AI agent (or piped into a
 * Claude API call — see README "Piping into the Claude API").
 */
export function buildContext(dest, passphrase, { format = 'markdown' } = {}) {
  const snapshot = readSnapshot(dest, passphrase)

  if (format === 'json') return JSON.stringify(snapshot, null, 2)

  const lines = []
  lines.push(\`# Context — synced \${snapshot.syncedAt ?? 'never'}\`)
  lines.push('')
  if (snapshot.folder) {
    lines.push(\`## Folder: \${snapshot.folder}\`)
    if (!snapshot.files.length) {
      lines.push('(empty, or nothing matched — run \`vault sync\`)')
    } else {
      for (const f of snapshot.files) {
        lines.push(\`- \${f.relPath} (\${f.sizeBytes} bytes)\`)
        if (f.excerpt) {
          const indented = f.excerpt
            .split('\\n')
            .map((l) => \`  > \${l}\`)
            .join('\\n')
          lines.push(indented)
        }
      }
    }
    lines.push('')
  }
  if (snapshot.icsPath) {
    lines.push(\`## Calendar: \${snapshot.icsPath}\`)
    if (!snapshot.events.length) {
      lines.push('(no events found, or file missing — run \`vault sync\`)')
    } else {
      for (const e of snapshot.events) {
        const when = [e.start, e.end].filter(Boolean).join(' – ')
        const where = e.location ? \` @ \${e.location}\` : ''
        lines.push(\`- \${e.summary ?? '(untitled)'}\${when ? \` — \${when}\` : ''}\${where}\`)
        if (e.description) lines.push(\`  > \${e.description}\`)
      }
    }
  }
  return lines.join('\\n') + '\\n'
}

/**
 * Cheap status check that never needs the passphrase — reads only the
 * unencrypted metadata file, so \`vault status\` works as a quick freshness
 * check without unlocking anything.
 */
export function statusVault(dest) {
  const meta = readMeta(dest)
  if (!meta) return null
  return meta
}
`,
  },
  {
    path: "bin/vault.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Command-line runner for MultiVault.
//
// A local, encrypted snapshot of one folder (and, optionally, one .ics
// calendar file) that you can turn into a short context brief — paste it
// into any AI chat, or pipe it into an API call — instead of re-explaining
// your situation every time. No account, no OAuth, no cloud storage, nothing
// phoning home: the vault file lives on your machine and only your
// passphrase can open it.
//
// Subcommands:
//   vault init    [--folder <path>] [--ics <path>] [--dest <path>]
//   vault sync    [--dest <path>]
//   vault context [--dest <path>] [--format text|markdown|json]
//   vault status  [--dest <path>]
//
// Exit codes:
//   0  ran successfully
//   1  ran, but the passphrase was wrong or the vault could not be decrypted
//   2  could not run at all (bad usage, no vault found, folder not found)

import process from 'node:process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initVault, syncVault, buildContext, statusVault, DecryptError } from '../lib/vault.mjs'

const USAGE = \`multivault — a local, encrypted context snapshot of a folder and calendar

Usage
  vault <command> [options]

Commands
  init      Create a new vault (generates and prints your passphrase — save it!)
  sync      Re-scan the folder/calendar and refresh the encrypted snapshot
  context   Decrypt the vault and print a pasteable context brief
  status    Show last-sync time and counts, without needing the passphrase

Options
  --folder <path>    Folder to watch (init: required unless already set; sync: overrides)
  --ics <path>       Path to a .ics calendar file to include (optional)
  --dest <path>      Where the vault lives (default: ./.multivault)
  --format <fmt>     context: text|markdown (default) or json
  --passphrase <p>   Passphrase (or set MULTIVAULT_PASSPHRASE — preferred, keeps it
                      out of your shell history)
  -h, --help          Show this message
  -v, --version       Show the version

Examples
  vault init --folder ~/Documents/ClientNotes --ics ~/Calendar.ics
  vault sync
  vault context                              # paste this into a chat
  vault context --format json | your-script  # pipe into your own tooling
  MULTIVAULT_PASSPHRASE=xxxx vault sync      # for cron/launchd/Task Scheduler
\`

class UsageError extends Error {}

function defaultDest() {
  return join(process.cwd(), '.multivault')
}

function parseArgs(argv) {
  const command = argv[0]
  const opts = { folder: null, ics: null, dest: null, format: 'markdown', passphrase: null }
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') { process.stdout.write(USAGE); process.exit(0) }
    if (arg === '-v' || arg === '--version') { process.stdout.write('multivault 1.0.0\\n'); process.exit(0) }
    if (arg === '--folder') { opts.folder = argv[++i]; continue }
    if (arg === '--ics') { opts.ics = argv[++i]; continue }
    if (arg === '--dest') { opts.dest = argv[++i]; continue }
    if (arg === '--format') { opts.format = argv[++i]; continue }
    if (arg === '--passphrase') { opts.passphrase = argv[++i]; continue }
    throw new UsageError(\`Unknown option: \${arg}\`)
  }
  return { command, opts }
}

function resolvePassphrase(opts) {
  const passphrase = opts.passphrase ?? process.env.MULTIVAULT_PASSPHRASE
  if (!passphrase) {
    throw new UsageError(
      'No passphrase given. Pass --passphrase, or set MULTIVAULT_PASSPHRASE (recommended for scheduled runs).',
    )
  }
  return passphrase
}

async function main() {
  const argv = process.argv.slice(2)
  if (!argv.length || argv[0] === '-h' || argv[0] === '--help') {
    process.stdout.write(USAGE)
    process.exit(0)
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    process.stdout.write('multivault 1.0.0\\n')
    process.exit(0)
  }
  const { command, opts } = parseArgs(argv)
  const dest = resolve(opts.dest ?? defaultDest())

  if (command === 'init') {
    const folder = opts.folder ? resolve(opts.folder) : null
    if (folder && (!existsSync(folder) || !statSync(folder).isDirectory())) {
      process.stderr.write(\`Folder not found: \${folder}\\n\`)
      process.exit(2)
    }
    const ics = opts.ics ? resolve(opts.ics) : null
    const passphrase = initVault(dest, { folder, icsPath: ics })
    process.stdout.write(\`Vault created at \${dest}\\n\\n\`)
    process.stdout.write(\`Your passphrase (shown once — save it now, e.g. in a password manager):\\n\\n\`)
    process.stdout.write(\`  \${passphrase}\\n\\n\`)
    process.stdout.write(
      \`There is no recovery if you lose this. It is never stored anywhere by this tool.\\n\` +
        \`Run "vault sync" next to take your first snapshot.\\n\`,
    )
    return
  }

  if (command === 'sync') {
    const passphrase = resolvePassphrase(opts)
    const result = syncVault(dest, passphrase, {
      folder: opts.folder ? resolve(opts.folder) : undefined,
      icsPath: opts.ics ? resolve(opts.ics) : undefined,
    })
    process.stdout.write(
      \`Synced: \${result.fileCount} file(s), \${result.eventCount} calendar event(s) at \${result.syncedAt}\\n\`,
    )
    return
  }

  if (command === 'context') {
    const passphrase = resolvePassphrase(opts)
    const format = opts.format === 'json' ? 'json' : 'markdown'
    process.stdout.write(buildContext(dest, passphrase, { format }))
    return
  }

  if (command === 'status') {
    const meta = statusVault(dest)
    if (!meta) {
      process.stdout.write(\`No vault found at \${dest}.\\n\`)
      process.exit(2)
    }
    process.stdout.write(JSON.stringify(meta, null, 2) + '\\n')
    return
  }

  throw new UsageError(\`Unknown command: \${command}\`)
}

main().catch((err) => {
  if (err instanceof UsageError) {
    process.stderr.write(\`\${err.message}\\n\\n\${USAGE}\`)
    process.exit(2)
  }
  if (err instanceof DecryptError) {
    process.stderr.write(\`\${err.message}\\n\`)
    process.exit(1)
  }
  process.stderr.write(\`\${err.message}\\n\`)
  process.exit(2)
})
`,
  },
  {
    path: "adapters/cron.sh",
    contents: `#!/bin/sh
# Copyright (c) 2026 [SELLER]. All rights reserved.
# Licensed to a single purchaser under the terms in LICENSE.md.
# Redistribution or resale of this source, in whole or in part, is not permitted.

# Adapter: plain cron, on any machine that has Node 18+.
#
# Runs "vault sync" on a schedule so your context brief never goes stale.
# Works anywhere: a spare laptop left on, a $4 VPS, a Raspberry Pi.
#
# Install:
#   1. chmod +x adapters/cron.sh
#   2. crontab -e
#   3. Add (runs every hour, at :22 — off the hour, since cron everywhere
#      stacks up at :00):
#
#        22 * * * * MULTIVAULT_PASSPHRASE=xxxx MULTIVAULT_DEST=/home/you/.multivault /path/to/adapters/cron.sh
#
# Environment:
#   MULTIVAULT_PASSPHRASE  required — the passphrase shown at "vault init"
#   MULTIVAULT_DEST        where the vault lives (default: ./.multivault next to this package)
#   MULTIVAULT_LOG         where run logs are appended (default: ./multivault.log)
#
# Your passphrase lives only in the crontab line above (or better: a
# separate 0600-permissioned file you source before calling this script). It
# is never written by this adapter to the log or anywhere else.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(dirname -- "$SCRIPT_DIR")

DEST=\${MULTIVAULT_DEST:-"$PACKAGE_DIR/.multivault"}
LOG=\${MULTIVAULT_LOG:-"$PACKAGE_DIR/multivault.log"}

if [ -z "\${MULTIVAULT_PASSPHRASE:-}" ]; then
  echo "MULTIVAULT_PASSPHRASE is not set — see the header of this script." >&2
  exit 2
fi

STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "--- $STAMP ---"
  node "$PACKAGE_DIR/bin/vault.mjs" sync --dest "$DEST"
} >> "$LOG" 2>&1

echo "$STAMP $DEST -> see $LOG"
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

  Install:
    1. Copy this file to ~/Library/LaunchAgents/com.multivault.sync.plist
    2. Edit the placeholders below: YOUR_USERNAME (three times), the package
       path (twice), and YOUR_PASSPHRASE_HERE (once) to match your setup.
       Prefer a wrapper script that reads the passphrase from a
       0600-permissioned file over pasting it into this plist directly, if
       other users can read your LaunchAgents folder.
    3. Load it:
         launchctl load ~/Library/LaunchAgents/com.multivault.sync.plist
    4. Check it's running:
         launchctl list | grep multivault

  Runs once an hour by default (StartInterval, in seconds — 3600 = 1 hour).

  To stop it:
    launchctl unload ~/Library/LaunchAgents/com.multivault.sync.plist
-->
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.multivault.sync</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/multivault/bin/vault.mjs</string>
    <string>sync</string>
    <string>--dest</string>
    <string>/Users/YOUR_USERNAME/.multivault</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>MULTIVAULT_PASSPHRASE</key>
    <string>YOUR_PASSPHRASE_HERE</string>
  </dict>

  <key>StartInterval</key>
  <integer>3600</integer>

  <key>RunAtLoad</key>
  <false/>

  <key>StandardOutPath</key>
  <string>/Users/YOUR_USERNAME/multivault/multivault.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/YOUR_USERNAME/multivault/multivault.log</string>
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
# Registers a scheduled task that runs "vault sync" hourly. Run this script
# ONCE to set it up; Windows takes it from there.
#
# Install:
#   1. Open PowerShell (does not need to be Administrator)
#   2. Run, replacing the passphrase with the one "vault init" printed:
#        powershell -ExecutionPolicy Bypass -File adapters\\windows-task.ps1 -Passphrase "xxxx"
#
# To remove the scheduled task later:
#   Unregister-ScheduledTask -TaskName "MultiVaultSync" -Confirm:$false
#
# The passphrase is stored as a per-user environment variable
# (MULTIVAULT_PASSPHRASE), not embedded in the task definition itself, so it
# does not show up in Task Scheduler's UI or export.

param(
  [Parameter(Mandatory = $true)]
  [string]$Passphrase,
  [string]$Dest = "$env:USERPROFILE\\.multivault"
)

$PackageDir = Split-Path -Parent $PSScriptRoot
$BinPath = Join-Path $PackageDir "bin\\vault.mjs"
$LogPath = Join-Path $PackageDir "multivault.log"

$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
  Write-Error "Node.js was not found on PATH. Install Node 18+ from https://nodejs.org first."
  exit 2
}

[System.Environment]::SetEnvironmentVariable('MULTIVAULT_PASSPHRASE', $Passphrase, 'User')

$Arguments = "\`"$BinPath\`" sync --dest \`"$Dest\`""
$FullArguments = "/c \`"$NodePath\`" $Arguments >> \`"$LogPath\`" 2>&1"

$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $FullArguments
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName "MultiVaultSync" \`
  -Action $Action -Trigger $Trigger -Settings $Settings \`
  -Description "Refreshes the MultiVault encrypted context snapshot hourly." \`
  -Force

Write-Host "Scheduled task 'MultiVaultSync' registered — syncing hourly."
Write-Host "Logs will be written to $LogPath"
Write-Host "Note: MULTIVAULT_PASSPHRASE was saved as a per-user environment variable."
`,
  },
  {
    path: "test/run.mjs",
    contents: `// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Test suite. Run with: npm test   (or: node test/run.mjs)
//
// Uses node:test and node:assert — both built in, so the package still
// installs nothing. Every test that touches the filesystem creates a real
// temporary directory and cleans up after itself — no mocked filesystem, so
// what passes here is what will actually happen on a buyer's machine.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encrypt, decrypt, generatePassphrase, DecryptError } from '../lib/crypto.mjs'
import { parseIcs } from '../lib/calendar.mjs'
import { scanFolder } from '../lib/scan.mjs'
import { initVault, syncVault, buildContext, statusVault, readSnapshot } from '../lib/vault.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), \`\${prefix}-\`))
}

// ---------------------------------------------------------------------------
// crypto
// ---------------------------------------------------------------------------

test('encrypt/decrypt round-trips exactly', () => {
  const passphrase = generatePassphrase()
  const plaintext = Buffer.from(JSON.stringify({ hello: 'world', n: 42 }))
  const blob = encrypt(plaintext, passphrase)
  const out = decrypt(blob, passphrase)
  assert.equal(out.toString('utf8'), plaintext.toString('utf8'))
})

test('wrong passphrase fails to decrypt', () => {
  const blob = encrypt(Buffer.from('secret data'), 'correct-horse-battery-staple')
  assert.throws(() => decrypt(blob, 'wrong-passphrase'), DecryptError)
})

test('tampered ciphertext fails to decrypt (auth tag catches it)', () => {
  const blob = encrypt(Buffer.from('secret data'), 'a-passphrase')
  const tampered = Buffer.from(blob)
  tampered[tampered.length - 1] ^= 0xff // flip a bit in the ciphertext
  assert.throws(() => decrypt(tampered, 'a-passphrase'), DecryptError)
})

test('generatePassphrase produces distinct, reasonably long values', () => {
  const a = generatePassphrase()
  const b = generatePassphrase()
  assert.notEqual(a, b)
  assert.ok(a.length >= 32)
})

// ---------------------------------------------------------------------------
// calendar
// ---------------------------------------------------------------------------

test('parses a basic VEVENT', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'SUMMARY:Team sync',
    'DTSTART:20260910T150000Z',
    'DTEND:20260910T153000Z',
    'LOCATION:Zoom',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\\r\\n')
  const events = parseIcs(ics)
  assert.equal(events.length, 1)
  assert.equal(events[0].summary, 'Team sync')
  assert.equal(events[0].start, '2026-09-10T15:00:00Z')
  assert.equal(events[0].location, 'Zoom')
})

test('unfolds continuation lines per RFC 5545', () => {
  // The single leading space on the continuation line is the RFC 5545
  // folding whitespace and is removed during unfolding (not converted to a
  // space) — so a real word-boundary space in the folded content needs an
  // explicit second leading space, as below.
  const ics = ['BEGIN:VEVENT', 'SUMMARY:A very long title that got', '  folded onto a second line', 'END:VEVENT'].join(
    '\\r\\n',
  )
  const events = parseIcs(ics)
  assert.equal(events[0].summary, 'A very long title that got folded onto a second line')
})

test('unescapes commas, semicolons, and newlines in text fields', () => {
  const ics = ['BEGIN:VEVENT', 'SUMMARY:Coffee\\\\, then lunch\\\\; then done', 'END:VEVENT'].join('\\r\\n')
  const events = parseIcs(ics)
  assert.equal(events[0].summary, 'Coffee, then lunch; then done')
})

test('ignores malformed input gracefully (no crash, no partial event)', () => {
  assert.deepEqual(parseIcs('not an ics file at all'), [])
})

// ---------------------------------------------------------------------------
// folder scanning
// ---------------------------------------------------------------------------

test('lists files and excerpts allowlisted text formats', () => {
  const dir = tempDir('scan-test')
  try {
    writeFileSync(join(dir, 'notes.md'), '# Project notes\\nSome content here.')
    writeFileSync(join(dir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47])) // fake binary
    const entries = scanFolder(dir)
    const notes = entries.find((e) => e.relPath === 'notes.md')
    const photo = entries.find((e) => e.relPath === 'photo.png')
    assert.ok(notes.excerpt.includes('Project notes'))
    assert.equal(photo.excerpt, null) // never reads non-allowlisted extensions
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('never excerpts filenames that look like secrets, even with an allowlisted extension', () => {
  const dir = tempDir('scan-test')
  try {
    writeFileSync(join(dir, 'api-keys.txt'), 'sk-super-secret-value')
    const entries = scanFolder(dir)
    const keys = entries.find((e) => e.relPath === 'api-keys.txt')
    assert.equal(keys.excerpt, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('skips hidden files and node_modules', () => {
  const dir = tempDir('scan-test')
  try {
    writeFileSync(join(dir, '.hidden'), 'x')
    const entries = scanFolder(dir)
    assert.equal(entries.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('caps total files at maxFiles', () => {
  const dir = tempDir('scan-test')
  try {
    for (let i = 0; i < 10; i++) writeFileSync(join(dir, \`f\${i}.txt\`), 'x')
    const entries = scanFolder(dir, { maxFiles: 3 })
    assert.equal(entries.length, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// full vault lifecycle
// ---------------------------------------------------------------------------

test('init -> sync -> context end-to-end', () => {
  const watchedDir = tempDir('vault-watch')
  const vaultDest = tempDir('vault-dest')
  try {
    writeFileSync(join(watchedDir, 'brief.md'), 'Client prefers async updates over calls.')
    const passphrase = initVault(vaultDest, { folder: watchedDir })
    const result = syncVault(vaultDest, passphrase)
    assert.equal(result.fileCount, 1)

    const markdown = buildContext(vaultDest, passphrase)
    assert.ok(markdown.includes('brief.md'))
    assert.ok(markdown.includes('async updates'))

    const status = statusVault(vaultDest)
    assert.equal(status.fileCount, 1)
    assert.ok(status.lastSyncAt)
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('sync rejects a wrong passphrase instead of silently corrupting the vault', () => {
  const watchedDir = tempDir('vault-watch')
  const vaultDest = tempDir('vault-dest')
  try {
    initVault(vaultDest, { folder: watchedDir })
    assert.throws(() => syncVault(vaultDest, 'definitely-the-wrong-passphrase'), DecryptError)
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('status works without the passphrase', () => {
  const vaultDest = tempDir('vault-dest')
  try {
    initVault(vaultDest, { folder: null })
    const status = statusVault(vaultDest)
    assert.equal(status.fileCount, 0)
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('init refuses to overwrite an existing vault', () => {
  const vaultDest = tempDir('vault-dest')
  try {
    initVault(vaultDest, { folder: null })
    assert.throws(() => initVault(vaultDest, { folder: null }), /already exists/)
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('readSnapshot reflects calendar events after sync', () => {
  const vaultDest = tempDir('vault-dest')
  const icsPath = join(tempDir('vault-ics'), 'cal.ics')
  writeFileSync(icsPath, ['BEGIN:VEVENT', 'SUMMARY:Quarterly review', 'DTSTART:20260915T120000Z', 'END:VEVENT'].join('\\r\\n'))
  try {
    const passphrase = initVault(vaultDest, { folder: null, icsPath })
    syncVault(vaultDest, passphrase)
    const snapshot = readSnapshot(vaultDest, passphrase)
    assert.equal(snapshot.events.length, 1)
    assert.equal(snapshot.events[0].summary, 'Quarterly review')
  } finally {
    rmSync(vaultDest, { recursive: true, force: true })
  }
})
`,
  },
  {
    path: "scripts/build-sea.mjs",
    contents: `#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Builds a standalone, double-clickable executable using Node's own built-in
// Single Executable Application (SEA) support — no third-party binary
// download, no cross-compilation. This is deliberately NOT a cross-platform
// build: SEA works by injecting a JS blob into a COPY of the Node binary
// that's already on the machine running this script, so it produces a
// binary for whatever OS/architecture you run it on.
//
// To get all of Windows, macOS, and Linux binaries, run this once on each:
//   - On Windows:      node scripts/build-sea.mjs   -> dist/vault-win-x64.exe
//   - On a Mac:        node scripts/build-sea.mjs   -> dist/vault-macos-<arch>
//   - On Linux:        node scripts/build-sea.mjs   -> dist/vault-linux-x64
//
// Requires Node 20+ and normal internet access (esbuild/postject need to
// install from npm the first time). Verified working end-to-end on Linux —
// see README's "Standalone binaries" section for the unsigned-binary
// warnings you'll want to know about before shipping these to buyers.

import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { platform, arch } from 'node:process'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST = join(ROOT, 'dist')
const TMP = join(ROOT, 'dist-tmp')

const PLATFORM_NAMES = { win32: 'win', darwin: 'macos', linux: 'linux' }
const outName = \`vault-\${PLATFORM_NAMES[platform] ?? platform}-\${arch}\${platform === 'win32' ? '.exe' : ''}\`

function run(cmd, args) {
  console.log(\`> \${cmd} \${args.join(' ')}\`)
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT })
}

mkdirSync(DIST, { recursive: true })
mkdirSync(TMP, { recursive: true })

console.log('1/4 Bundling ESM source into a single CommonJS file (esbuild)...')
run('npx', [
  'esbuild',
  join(ROOT, 'bin/vault.mjs'),
  '--bundle',
  '--platform=node',
  '--format=cjs',
  \`--outfile=\${join(TMP, 'vault-bundle.cjs')}\`,
  '--external:node:*',
])

console.log('2/4 Generating the SEA preparation blob...')
const seaConfigPath = join(TMP, 'sea-config.json')
run('node', ['-e', \`require('fs').writeFileSync(\${JSON.stringify(seaConfigPath)}, JSON.stringify({ main: \${JSON.stringify(join(TMP, 'vault-bundle.cjs'))}, output: \${JSON.stringify(join(TMP, 'sea-prep.blob'))}, disableExperimentalSEAWarning: true }))\`])
run('node', ['--experimental-sea-config', seaConfigPath])

console.log('3/4 Copying the local Node binary as the base...')
const outPath = join(DIST, outName)
copyFileSync(process.execPath, outPath)
if (platform !== 'win32') chmodSync(outPath, 0o755)

console.log('4/4 Injecting the blob (postject)...')
const sentinel = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
const postjectArgs = [outPath, 'NODE_SEA_BLOB', join(TMP, 'sea-prep.blob'), '--sentinel-fuse', sentinel]
if (platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA')
run('npx', ['postject', ...postjectArgs])

console.log(\`\\nDone: \${outPath}\`)
if (platform === 'darwin') {
  console.log('macOS note: this binary is not notarized/signed. Buyers will need to')
  console.log('right-click -> Open the first time, or run: xattr -d com.apple.quarantine <path>')
} else if (platform === 'win32') {
  console.log('Windows note: this binary is not code-signed. SmartScreen will warn on first run.')
}
`,
  },
]
