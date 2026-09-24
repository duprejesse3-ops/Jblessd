// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { startWatcher } from '../lib/watcher.mjs'
import { rank } from '../lib/bm25.mjs'
import { tokenize } from '../lib/tokenize.mjs'

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

test('startWatcher builds an initial index immediately', async () => {
  const watchedDir = tempDir('watch-watch')
  const vaultDest = tempDir('watch-dest')
  const controller = startWatcher(vaultDest, watchedDir)
  try {
    writeFileSync(join(watchedDir, 'a.md'), 'initial content')
    // The initial index was built before this file existed, so it should
    // not be in it yet — this just confirms startWatcher() itself doesn't
    // throw and produces a usable index synchronously.
    assert.ok(controller.getIndex())
  } finally {
    controller.stop()
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('startWatcher picks up a new file reactively, without a manual query triggering it', async () => {
  const watchedDir = tempDir('watch-watch')
  const vaultDest = tempDir('watch-dest')
  let updateFired = false
  const controller = startWatcher(vaultDest, watchedDir, { onUpdate: () => { updateFired = true } })
  try {
    writeFileSync(join(watchedDir, 'zeppelin.md'), 'This document is about zeppelins specifically.')

    // Debounce is 800ms — poll for a bit past that rather than a single fixed sleep,
    // so this isn't flaky under slow CI/sandbox scheduling.
    const deadline = Date.now() + 4000
    while (!updateFired && Date.now() < deadline) {
      await sleep(150)
    }
    assert.ok(updateFired, 'onUpdate callback should have fired after the debounce window')

    const results = rank(tokenize('zeppelins'), controller.getIndex())
    assert.ok(results.length > 0, 'the reactively-indexed file should be findable')
    assert.equal(results[0].doc.relPath, 'zeppelin.md')
  } finally {
    controller.stop()
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})

test('stop() actually tears down watching — a later file change is not picked up', async () => {
  const watchedDir = tempDir('watch-watch')
  const vaultDest = tempDir('watch-dest')
  let updateCount = 0
  const controller = startWatcher(vaultDest, watchedDir, { onUpdate: () => { updateCount++ } })
  controller.stop()

  writeFileSync(join(watchedDir, 'after-stop.md'), 'This should not trigger an update.')
  await sleep(1200) // well past the debounce window

  try {
    assert.equal(updateCount, 0, 'no update should fire after stop() was called')
  } finally {
    rmSync(watchedDir, { recursive: true, force: true })
    rmSync(vaultDest, { recursive: true, force: true })
  }
})
