// Copyright (c) 2026 [SELLER]. All rights reserved.
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
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
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
    assert.equal(mode, 0o600, `expected mode 600, got ${mode.toString(8)} — a refresh token should not be group/world readable`)
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
