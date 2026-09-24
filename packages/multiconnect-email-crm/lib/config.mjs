// Copyright (c) 2026 [SELLER]. All rights reserved.
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
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
