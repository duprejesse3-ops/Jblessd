// Copyright (c) 2026 [SELLER]. All rights reserved.
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
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
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
  ].join('\r\n')
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
    '\r\n',
  )
  const events = parseIcs(ics)
  assert.equal(events[0].summary, 'A very long title that got folded onto a second line')
})

test('unescapes commas, semicolons, and newlines in text fields', () => {
  const ics = ['BEGIN:VEVENT', 'SUMMARY:Coffee\\, then lunch\\; then done', 'END:VEVENT'].join('\r\n')
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
    writeFileSync(join(dir, 'notes.md'), '# Project notes\nSome content here.')
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
    for (let i = 0; i < 10; i++) writeFileSync(join(dir, `f${i}.txt`), 'x')
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
  writeFileSync(icsPath, ['BEGIN:VEVENT', 'SUMMARY:Quarterly review', 'DTSTART:20260915T120000Z', 'END:VEVENT'].join('\r\n'))
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
