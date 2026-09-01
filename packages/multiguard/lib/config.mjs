// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The registry is deliberately generic: a "watched connector" is just a
// name, a base URL, and that connector's own dashboard token. MultiGuard
// doesn't hardcode which MultiConnect product is which — it works with any
// local tool that happens to expose a GET /api/config with a safeMode
// field and a GET /api/log or /api/entries with an { entries: [...] }
// shape, which is every MultiConnect connector by convention, and any
// future one built the same way.
//
// The tokens stored here are real credentials for other services — see
// the security note in README.md before you use this on anything you
// don't fully control.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8431

/** @typedef {{ id: string, name: string, baseUrl: string, token: string }} WatchedConnector */
/**
 * @typedef {{
 *   port: number,
 *   dashboardToken: string,
 *   connectors: WatchedConnector[],
 *   createdAt: string
 * }} GuardConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'guard.config.json')
}

/** @returns {GuardConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    dashboardToken: randomBytes(16).toString('hex'),
    connectors: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {GuardConfig}
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
  return { ...base, ...parsed, connectors: Array.isArray(parsed.connectors) ? parsed.connectors : base.connectors }
}

/**
 * @param {GuardConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

/** Strip the base URL of a trailing slash so URL joins never produce "//api". */
export function normalizeBaseUrl(input) {
  return String(input ?? '').trim().replace(/\/+$/, '')
}

export { defaultConfigPath, DEFAULT_PORT, randomUUID }
