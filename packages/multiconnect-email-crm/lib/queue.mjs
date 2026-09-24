// Copyright (c) 2026 [SELLER]. All rights reserved.
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
  writeFileSync(queuePath, JSON.stringify(drafts, null, 2) + '\n', 'utf8')
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
  if (draft.status !== 'pending') throw new QueueError(`Draft is already ${draft.status}.`)

  const limit = config.sendLimitPerHour ?? 20
  if (sentInLastHour(drafts) >= limit) {
    throw new QueueError(`Send limit reached (${limit}/hour). Try again later, or raise the limit in settings.`)
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
  if (draft.status !== 'pending') throw new QueueError(`Draft is already ${draft.status}.`)
  draft.status = 'rejected'
  writeQueue(drafts, queuePath)
  return draft
}

export { defaultQueuePath }
