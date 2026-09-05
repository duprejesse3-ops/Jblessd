// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createLog, defaultLogPath } from '../lib/log.mjs'
import { createServer } from '../lib/server.mjs'

function tempLogPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcg-log-'))
  return { logPath: path.join(dir, 'guard.log.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

// ---------------------------------------------------------------------------
// createLog — unit level
// ---------------------------------------------------------------------------

test('record() writes an entry to disk immediately, in the same shape recent() returns', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const log = createLog(logPath)
    const entry = log.record({ kind: 'registered', summary: 'Registered "Shopify"', detail: 'http://localhost:8421' })
    assert.equal(entry.kind, 'registered')
    assert.ok(entry.id)
    assert.ok(entry.at)

    const onDisk = JSON.parse(readFileSync(logPath, 'utf8'))
    assert.equal(onDisk.length, 1)
    assert.deepEqual(onDisk[0], entry)
  } finally {
    cleanup()
  }
})

test('a fresh createLog() against an existing file loads its entries (this is the actual persistence guarantee)', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const first = createLog(logPath)
    first.record({ kind: 'registered', summary: 'a', detail: null })
    first.record({ kind: 'removed', summary: 'b', detail: null })

    const second = createLog(logPath) // simulates a fresh process reading the same file after a restart
    const entries = second.recent()
    assert.equal(entries.length, 2)
    assert.equal(entries[0].summary, 'b') // most recent first
    assert.equal(entries[1].summary, 'a')
  } finally {
    cleanup()
  }
})

test('ids keep incrementing across a reload instead of restarting from 1 and colliding', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const first = createLog(logPath)
    first.record({ kind: 'registered', summary: 'a', detail: null })
    first.record({ kind: 'registered', summary: 'b', detail: null })

    const second = createLog(logPath)
    const entry = second.record({ kind: 'registered', summary: 'c', detail: null })
    assert.equal(entry.id, '3')
  } finally {
    cleanup()
  }
})

test('recent() respects the caller-supplied limit and returns newest first', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const log = createLog(logPath)
    for (let i = 0; i < 5; i++) log.record({ kind: 'registered', summary: `entry ${i}`, detail: null })
    const top2 = log.recent(2)
    assert.equal(top2.length, 2)
    assert.equal(top2[0].summary, 'entry 4')
    assert.equal(top2[1].summary, 'entry 3')
  } finally {
    cleanup()
  }
})

test('entries beyond the 200-entry cap are dropped, oldest first, both in memory and on disk', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const log = createLog(logPath)
    for (let i = 0; i < 205; i++) log.record({ kind: 'registered', summary: `entry ${i}`, detail: null })
    assert.equal(log.recent(1000).length, 200)
    assert.equal(log.recent(1)[0].summary, 'entry 204') // newest survives
    const onDisk = JSON.parse(readFileSync(logPath, 'utf8'))
    assert.equal(onDisk.length, 200)
  } finally {
    cleanup()
  }
})

test('clear() empties both memory and the on-disk file', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const log = createLog(logPath)
    log.record({ kind: 'registered', summary: 'a', detail: null })
    log.clear()
    assert.equal(log.recent().length, 0)
    assert.deepEqual(JSON.parse(readFileSync(logPath, 'utf8')), [])
  } finally {
    cleanup()
  }
})

test('a missing log file starts empty rather than throwing', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const log = createLog(logPath) // tempLogPath() only creates the directory, never the file itself
    assert.deepEqual(log.recent(), [])
  } finally {
    cleanup()
  }
})

test('a corrupt log file is treated as empty rather than crashing the process', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    writeFileSync(logPath, '{not valid json')
    const log = createLog(logPath)
    assert.deepEqual(log.recent(), [])
  } finally {
    cleanup()
  }
})

test('defaultLogPath() places guard.log.json next to the given config path', () => {
  const configPath = path.join('some', 'dir', 'guard.config.json')
  assert.equal(defaultLogPath(configPath), path.join('some', 'dir', 'guard.log.json'))
})

// ---------------------------------------------------------------------------
// End-to-end: the actual point of this feature — survives a real restart
// ---------------------------------------------------------------------------

test('activity log survives a MultiGuard restart (new createServer() call against the same config dir)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcg-log-restart-'))
  const configPath = path.join(dir, 'guard.config.json')
  try {
    const first = createServer({ port: 0, configPath })
    await new Promise((resolve) => first.server.listen(0, resolve))
    const port1 = first.server.address().port

    await fetch(`http://localhost:${port1}/api/connectors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${first.config.dashboardToken}` },
      body: JSON.stringify({ name: 'Shopify', baseUrl: 'http://localhost:8421', token: 't' }),
    })
    await new Promise((resolve) => first.server.close(resolve)) // simulates Ctrl+C / a restart

    // A brand-new server instance, same --config, standing in for the process restarting.
    const second = createServer({ port: 0, configPath })
    await new Promise((resolve) => second.server.listen(0, resolve))
    const port2 = second.server.address().port
    try {
      const logRes = await fetch(`http://localhost:${port2}/api/log`, { headers: { authorization: `Bearer ${second.config.dashboardToken}` } })
      const { entries } = await logRes.json()
      assert.ok(entries.some((e) => e.kind === 'registered' && e.summary.includes('Shopify')), 'the entry recorded before restart should still be there after it')
    } finally {
      second.server.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
