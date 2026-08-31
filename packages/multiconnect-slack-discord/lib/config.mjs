// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — Slack/Discord credentials, the
// named routes (channels) the agent can post to, and safe mode. No
// database: this file is the whole install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8427

/**
 * @typedef {{ id: string, name: string, slackWebhookUrl: string | null, discordWebhookUrl: string | null }} Route
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   safeMode: 'read-only' | 'read-write',
 *   slack: { enabled: boolean, signingSecret: string | null },
 *   discord: { enabled: boolean, publicKey: string | null },
 *   routes: Route[],
 *   createdAt: string
 * }} MessagingConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {MessagingConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    // Read-only by default: the agent can always be *told about* inbound
    // slash commands/mentions (that's just reading), but posting to a real
    // channel is a write and stays off until deliberately enabled.
    safeMode: 'read-only',
    slack: { enabled: false, signingSecret: null },
    discord: { enabled: false, publicKey: null },
    routes: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {MessagingConfig}
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
  return {
    ...base,
    ...parsed,
    slack: { ...base.slack, ...(parsed.slack ?? {}) },
    discord: { ...base.discord, ...(parsed.discord ?? {}) },
    routes: Array.isArray(parsed.routes) ? parsed.routes : base.routes,
  }
}

/**
 * @param {MessagingConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
