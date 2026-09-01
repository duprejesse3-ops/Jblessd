// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import { saveConfig, normalizeBaseUrl, randomUUID } from './config.mjs'

export class RegistryError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RegistryError'
  }
}

/**
 * @param {import('./config.mjs').GuardConfig} config
 * @param {{ name: string, baseUrl: string, token: string }} input
 * @param {string} [configPath]
 * @returns {import('./config.mjs').WatchedConnector}
 */
export function addConnector(config, input, configPath) {
  if (!input.name) throw new RegistryError('A connector needs a name.')
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!baseUrl) throw new RegistryError('A connector needs a base URL (e.g. http://localhost:8421).')
  if (!input.token) throw new RegistryError('A connector needs its own dashboard token, so MultiGuard can talk to it.')

  /** @type {import('./config.mjs').WatchedConnector} */
  const connector = { id: randomUUID(), name: input.name, baseUrl, token: input.token }
  config.connectors.push(connector)
  saveConfig(config, configPath)
  return connector
}

/** @param {import('./config.mjs').GuardConfig} config */
export function listConnectors(config) {
  return config.connectors
}

/**
 * @param {import('./config.mjs').GuardConfig} config
 * @param {string} connectorId
 * @param {string} [configPath]
 */
export function removeConnector(config, connectorId, configPath) {
  const before = config.connectors.length
  config.connectors = config.connectors.filter((c) => c.id !== connectorId)
  if (config.connectors.length === before) throw new RegistryError('No such connector.')
  saveConfig(config, configPath)
}
