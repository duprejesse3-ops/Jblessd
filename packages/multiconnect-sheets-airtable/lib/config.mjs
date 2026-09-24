// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes bridge.config.json — which platform is active (Sheets,
// Airtable, or both), the credentials for each, the saved column mapping,
// and safe mode. No database, no account beyond the customer's own Google/
// Airtable accounts: the config file is the install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8423

/** @typedef {{ id: string, sourcePath: string, targetField: string }} MappingRule */
/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   safeMode: 'read-only' | 'read-write',
 *   sheets: {
 *     enabled: boolean,
 *     serviceAccountEmail: string | null,
 *     privateKey: string | null,
 *     spreadsheetId: string | null,
 *     sheetName: string
 *   },
 *   airtable: {
 *     enabled: boolean,
 *     apiKey: string | null,
 *     baseId: string | null,
 *     tableName: string | null
 *   },
 *   readMappings: MappingRule[],
 *   writeMappings: MappingRule[],
 *   createdAt: string
 * }} SheetsConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'bridge.config.json')
}

/** @returns {SheetsConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    // Read-only by default, same reasoning as every other connector in this
    // line: a fresh install should never be able to overwrite a customer's
    // real spreadsheet or base until they deliberately allow it.
    safeMode: 'read-only',
    sheets: { enabled: false, serviceAccountEmail: null, privateKey: null, spreadsheetId: null, sheetName: 'Sheet1' },
    airtable: { enabled: false, apiKey: null, baseId: null, tableName: null },
    readMappings: [],
    writeMappings: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {SheetsConfig}
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
    sheets: { ...base.sheets, ...(parsed.sheets ?? {}) },
    airtable: { ...base.airtable, ...(parsed.airtable ?? {}) },
  }
}

/**
 * @param {SheetsConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

export { defaultConfigPath, DEFAULT_PORT }
