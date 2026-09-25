// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { readFileSync } from 'node:fs'

const DEFAULTS = {
  concurrency: 5,
  checkExternalLinks: false,
  externalLinkLimit: 20,
  requestTimeoutMs: 8000,
}

/**
 * Loads and validates config.json — the one site this product watches, and
 * how it should crawl it. Kept as plain JSON (not code) so a non-developer
 * on the team can maintain it, same as every other MultiNicheAI automation.
 *
 * @param {string} path
 * @returns {{sitemapUrl:string, toEmail:string, concurrency:number,
 *   checkExternalLinks:boolean, externalLinkLimit:number, requestTimeoutMs:number,
 *   siteName?:string}}
 */
export function loadConfig(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new Error(`Could not read config file at "${path}": ${err.message}`)
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`"${path}" is not valid JSON: ${err.message}`)
  }

  return validateConfig(parsed, path)
}

/**
 * @param {object} config
 * @param {string} [path]  only used to make error messages point somewhere
 * @returns {object} the config, merged with defaults
 */
export function validateConfig(config, path = 'config.json') {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`"${path}" must be a JSON object.`)
  }

  const merged = { ...DEFAULTS, ...config }

  if (typeof merged.sitemapUrl !== 'string' || !merged.sitemapUrl.trim()) {
    throw new Error(`"${path}": "sitemapUrl" is required and must be a string.`)
  }
  try {
    // eslint-disable-next-line no-new
    new URL(merged.sitemapUrl)
  } catch {
    throw new Error(`"${path}": "sitemapUrl" ("${merged.sitemapUrl}") is not a valid URL.`)
  }

  if (typeof merged.toEmail !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(merged.toEmail)) {
    throw new Error(`"${path}": "toEmail" must be a valid email address.`)
  }

  if (!Number.isInteger(merged.concurrency) || merged.concurrency <= 0) {
    throw new Error(`"${path}": "concurrency" must be a positive integer.`)
  }

  if (typeof merged.checkExternalLinks !== 'boolean') {
    throw new Error(`"${path}": "checkExternalLinks" must be true or false.`)
  }

  if (!Number.isInteger(merged.externalLinkLimit) || merged.externalLinkLimit < 0) {
    throw new Error(`"${path}": "externalLinkLimit" must be a non-negative integer.`)
  }

  if (!Number.isInteger(merged.requestTimeoutMs) || merged.requestTimeoutMs <= 0) {
    throw new Error(`"${path}": "requestTimeoutMs" must be a positive integer.`)
  }

  return merged
}
