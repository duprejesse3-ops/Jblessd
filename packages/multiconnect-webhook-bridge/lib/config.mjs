// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — the one file that holds everything
// this bridge needs to run: the outbound webhook URL(s), the field mappings,
// the local auth token, and the port. No database, no account: the config
// file *is* the install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8420

/** @typedef {{ id: string, sourcePath: string, targetField: string }} MappingRule */
/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   outboundUrl: string | null,
 *   outboundMappings: MappingRule[],
 *   inboundMappings: MappingRule[],
 *   createdAt: string
 * }} BridgeConfig
 */

function defaultConfigPath() {
  // Alongside wherever the bridge is run from, matching the site-audit-agent
  // convention of "no hidden dotfiles in $HOME, config lives with the tool".
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {BridgeConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    outboundUrl: null,
    outboundMappings: [],
    inboundMappings: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * Load the config, creating a fresh one with sane defaults (and a random
 * local auth token) the first time the bridge is ever run.
 * @param {string} [configPath]
 * @returns {BridgeConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) {
    const fresh = defaults()
    saveConfig(fresh, configPath)
    return fresh
  }
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  // Merge over defaults so a config file from an older version of the bridge
  // (missing a newer field) doesn't crash the app — it just fills in.
  return { ...defaults(), ...parsed }
}

/**
 * @param {BridgeConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
