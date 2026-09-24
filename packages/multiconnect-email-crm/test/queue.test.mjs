// Copyright (c) 2026 [SELLER]. All rights reserved.
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
