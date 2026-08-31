// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// A "route" is a named channel destination — the "route different events
// to different channels" feature. Each route can have a Slack webhook, a
// Discord webhook, or both; posting to a route posts to every webhook it
// has configured. This is the one module that actually gates writes behind
// safe mode, matching every other connector in this line.

import { randomUUID } from 'node:crypto'
import { postToSlack } from './slack-client.mjs'
import { postToDiscord } from './discord-client.mjs'
import { saveConfig } from './config.mjs'
import { record } from './log.mjs'

export class RouteError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RouteError'
  }
}

/**
 * @param {import('./config.mjs').MessagingConfig} config
 * @param {{ name: string, slackWebhookUrl?: string, discordWebhookUrl?: string }} input
 * @param {string} [configPath]
 * @returns {import('./config.mjs').Route}
 */
export function addRoute(config, input, configPath) {
  if (!input.name) throw new RouteError('A route needs a name.')
  if (!input.slackWebhookUrl && !input.discordWebhookUrl) {
    throw new RouteError('A route needs at least one webhook URL (Slack or Discord).')
  }
  /** @type {import('./config.mjs').Route} */
  const route = {
    id: randomUUID(),
    name: input.name,
    slackWebhookUrl: input.slackWebhookUrl || null,
    discordWebhookUrl: input.discordWebhookUrl || null,
  }
  config.routes.push(route)
  saveConfig(config, configPath)
  return route
}

/** @param {import('./config.mjs').MessagingConfig} config */
export function listRoutes(config) {
  return config.routes
}

/**
 * @param {import('./config.mjs').MessagingConfig} config
 * @param {string} routeId
 * @param {string} [configPath]
 */
export function removeRoute(config, routeId, configPath) {
  const before = config.routes.length
  config.routes = config.routes.filter((r) => r.id !== routeId)
  if (config.routes.length === before) throw new RouteError('No such route.')
  saveConfig(config, configPath)
}

/**
 * Post a message to a named route's configured webhook(s). Refuses outright
 * unless safe mode is read-write — this is the only place in the package
 * that sends a real message to a real channel.
 * @param {import('./config.mjs').MessagingConfig} config
 * @param {string} routeId
 * @param {string} message
 * @param {{ slackPost?: typeof postToSlack, discordPost?: typeof postToDiscord }} [opts]
 */
export async function postToRoute(config, routeId, message, opts = {}) {
  if (config.safeMode !== 'read-write') {
    throw new RouteError('Refused: safe mode is read-only. Switch to read-write in the dashboard to post messages.')
  }
  const route = config.routes.find((r) => r.id === routeId)
  if (!route) throw new RouteError('No such route.')

  const slackPost = opts.slackPost ?? postToSlack
  const discordPost = opts.discordPost ?? postToDiscord
  const results = { slack: null, discord: null }

  if (route.slackWebhookUrl) {
    results.slack = await slackPost(route.slackWebhookUrl, message)
    record({ platform: 'slack', kind: 'posted', summary: `Posted to "${route.name}"`, detail: message.slice(0, 200) })
  }
  if (route.discordWebhookUrl) {
    results.discord = await discordPost(route.discordWebhookUrl, message)
    record({ platform: 'discord', kind: 'posted', summary: `Posted to "${route.name}"`, detail: message.slice(0, 200) })
  }
  return results
}
