// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { appendEvent, recentEntries, verifyChain, GENESIS_HASH } from '../lib/chain.mjs'

function tempLogPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'mcw-chain-'))
  return { logPath: path.join(dir, 'witness.log.jsonl'), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

test('appendEvent requires a source and an action', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    assert.throws(() => appendEvent({ action: 'x' }, logPath))
    assert.throws(() => appendEvent({ source: 'x' }, logPath))
  } finally {
    cleanup()
  }
})

test('the first entry chains to the genesis hash', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const entry = appendEvent({ source: 'test', action: 'first' }, logPath)
    assert.equal(entry.seq, 1)
    assert.equal(entry.prevHash, GENESIS_HASH)
    assert.equal(entry.hash.length, 64)
  } finally {
    cleanup()
  }
})

test('each subsequent entry chains to the previous entry\'s hash', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const first = appendEvent({ source: 'test', action: 'one' }, logPath)
    const second = appendEvent({ source: 'test', action: 'two' }, logPath)
    const third = appendEvent({ source: 'test', action: 'three' }, logPath)
    assert.equal(second.prevHash, first.hash)
    assert.equal(third.prevHash, second.hash)
    assert.equal(third.seq, 3)
  } finally {
    cleanup()
  }
})

test('verifyChain reports valid on an untouched, freshly written chain', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)
    appendEvent({ source: 'c', action: 'three' }, logPath)
    const result = verifyChain(logPath)
    assert.equal(result.valid, true)
    assert.equal(result.totalEntries, 3)
    assert.equal(result.brokenAtSeq, null)
  } finally {
    cleanup()
  }
})

test('verifyChain reports valid on an empty (nonexistent) log', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const result = verifyChain(logPath)
    assert.equal(result.valid, true)
    assert.equal(result.totalEntries, 0)
  } finally {
    cleanup()
  }
})

test('verifyChain detects a directly edited field in an entry', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)
    appendEvent({ source: 'c', action: 'three' }, logPath)

    // Simulate tampering: rewrite entry 2's action without recomputing its hash.
    const lines = readFileSync(logPath, 'utf8').trim().split('\n')
    const tampered = JSON.parse(lines[1])
    tampered.action = 'something else entirely'
    lines[1] = JSON.stringify(tampered)
    writeFileSync(logPath, lines.join('\n') + '\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
    assert.equal(result.brokenAtSeq, 2)
    assert.match(result.reason, /own contents/)
  } finally {
    cleanup()
  }
})

test('verifyChain detects a deleted middle entry, breaking the chain link', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)
    appendEvent({ source: 'c', action: 'three' }, logPath)

    // Simulate tampering: remove entry 2 entirely, leaving 1 and 3.
    const lines = readFileSync(logPath, 'utf8').trim().split('\n')
    writeFileSync(logPath, [lines[0], lines[2]].join('\n') + '\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
    // Entry 3's prevHash still points at the (now-missing) entry 2's hash,
    // so the break surfaces at entry 3's seq, not entry 2's.
    assert.equal(result.brokenAtSeq, 3)
    assert.match(result.reason, /prevHash/)
  } finally {
    cleanup()
  }
})

test('verifyChain detects entries reordered out of sequence', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)

    const lines = readFileSync(logPath, 'utf8').trim().split('\n')
    writeFileSync(logPath, [lines[1], lines[0]].join('\n') + '\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
  } finally {
    cleanup()
  }
})

test('verifyChain catches tampering with the LAST entry too, not just middle ones', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    appendEvent({ source: 'a', action: 'one' }, logPath)
    appendEvent({ source: 'b', action: 'two' }, logPath)

    const lines = readFileSync(logPath, 'utf8').trim().split('\n')
    const tampered = JSON.parse(lines[1])
    tampered.detail = 'injected after the fact'
    lines[1] = JSON.stringify(tampered)
    writeFileSync(logPath, lines.join('\n') + '\n', 'utf8')

    const result = verifyChain(logPath)
    assert.equal(result.valid, false)
    assert.equal(result.brokenAtSeq, 2)
  } finally {
    cleanup()
  }
})

test('recentEntries returns most-recent-first, respecting the limit', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    for (let i = 1; i <= 5; i++) appendEvent({ source: 'test', action: `event-${i}` }, logPath)
    const entries = recentEntries(logPath, 3)
    assert.equal(entries.length, 3)
    assert.equal(entries[0].action, 'event-5')
    assert.equal(entries[2].action, 'event-3')
  } finally {
    cleanup()
  }
})

test('detail defaults to null when not provided, and is preserved when it is', () => {
  const { logPath, cleanup } = tempLogPath()
  try {
    const withDetail = appendEvent({ source: 'a', action: 'x', detail: 'some detail' }, logPath)
    const withoutDetail = appendEvent({ source: 'a', action: 'y' }, logPath)
    assert.equal(withDetail.detail, 'some detail')
    assert.equal(withoutDetail.detail, null)
  } finally {
    cleanup()
  }
})
