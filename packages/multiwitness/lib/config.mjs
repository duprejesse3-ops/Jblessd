// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two tokens, deliberately separate: dashboardToken gates reading the log
// and running verification (what you type into the dashboard yourself);
// ingestToken gates writing to it (what you configure other tools — your
// other MultiConnect connectors, a cron job, anything — to send). Splitting
// them means a connector you've configured to log events here only ever
// holds a token that can append, never one that can read the whole
// history or trigger a verify.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8429

/**
 * @typedef {{
 *   port: number,
 *   dashboardToken: string,
 *   ingestToken: string,
 *   createdAt: string
 * }} WitnessConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'witness.config.json')
}

/** @returns {WitnessConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    dashboardToken: randomBytes(16).toString('hex'),
    ingestToken: randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {WitnessConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) {
    const fresh = defaults()
    saveConfig(fresh, configPath)
    return fresh
  }
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  return { ...defaults(), ...parsed }
}

/**
 * @param {WitnessConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
