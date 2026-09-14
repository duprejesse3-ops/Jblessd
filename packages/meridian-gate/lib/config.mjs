// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// The allowlist. Default is no: a host that has never been explicitly
// allowed is blocked, full stop. There is no "warn but permit" mode and no
// wildcard rule — every entry names one host and the human who added it,
// because "a receipt for what left" only means something if every line on
// the receipt was a decision someone actually made.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function defaultConfigPath() {
  return path.resolve(process.cwd(), 'gate.config.json')
}

/**
 * @typedef {{ host: string, addedBy: string, addedAt: string, note: string | null }} Rule
 * @typedef {{ port: number, rules: Rule[] }} GateConfig
 */

/** @returns {GateConfig} */
function emptyConfig() {
  return { port: 8899, rules: [] }
}

/**
 * @param {string} [configPath]
 * @returns {GateConfig}
 */
export function loadConfig(configPath = defaultConfigPath()) {
  if (!existsSync(configPath)) return emptyConfig()
  const raw = readFileSync(configPath, 'utf8')
  const parsed = JSON.parse(raw)
  return {
    port: typeof parsed.port === 'number' ? parsed.port : 8899,
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
  }
}

/**
 * @param {GateConfig} config
 * @param {string} [configPath]
 */
export function saveConfig(config, configPath = defaultConfigPath()) {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

/** Hostnames are matched case-insensitively, exact host only — no wildcards. */
function normalizeHost(host) {
  return String(host).trim().toLowerCase()
}

/**
 * @param {GateConfig} config
 * @param {string} host
 * @returns {Rule | null}
 */
export function findRule(config, host) {
  const target = normalizeHost(host)
  return config.rules.find((r) => r.host === target) ?? null
}

/**
 * @param {GateConfig} config
 * @param {{ host: string, addedBy: string, note?: string | null }} rule
 * @returns {GateConfig}
 */
export function addRule(config, rule) {
  if (!rule.host) throw new Error('A rule needs a host.')
  if (!rule.addedBy) throw new Error('A rule needs a named human (addedBy) — "default is no" applies to anonymous approvals too.')
  const host = normalizeHost(rule.host)
  const rules = config.rules.filter((r) => r.host !== host)
  rules.push({ host, addedBy: rule.addedBy, addedAt: new Date().toISOString(), note: rule.note ?? null })
  return { ...config, rules }
}

/**
 * @param {GateConfig} config
 * @param {string} host
 * @returns {GateConfig}
 */
export function removeRule(config, host) {
  const target = normalizeHost(host)
  return { ...config, rules: config.rules.filter((r) => r.host !== target) }
}

export { defaultConfigPath, normalizeHost }
