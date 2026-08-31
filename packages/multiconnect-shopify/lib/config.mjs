// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Reads and writes shopify.config.json — store domain, the Admin API access
// token, the webhook secret Shopify signs requests with, and safe mode. No
// database, no account: the config file is the install.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = 8421
const API_VERSION = '2024-10'

/**
 * @typedef {{
 *   port: number,
 *   authToken: string,
 *   shopDomain: string | null,
 *   accessToken: string | null,
 *   webhookSecret: string | null,
 *   safeMode: 'read-only' | 'read-write',
 *   createdAt: string
 * }} ShopifyConfig
 */

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'shopify.config.json')
}

/** @returns {ShopifyConfig} */
function defaults() {
  return {
    port: DEFAULT_PORT,
    authToken: randomBytes(16).toString('hex'),
    shopDomain: null,
    accessToken: null,
    webhookSecret: null,
    // Read-only by default — a fresh install should never be able to write to
    // a customer's live store until they deliberately flip this.
    safeMode: 'read-only',
    createdAt: new Date().toISOString(),
  }
}

/**
 * @param {string} [configPath]
 * @returns {ShopifyConfig}
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
 * @param {ShopifyConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

/** Normalize whatever the customer typed into a clean *.myshopify.com host. */
export function normalizeShopDomain(input) {
  const trimmed = String(input ?? '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!trimmed) return null
  return trimmed.includes('.') ? trimmed : `${trimmed}.myshopify.com`
}

export { defaultConfigPath, DEFAULT_PORT, API_VERSION }
