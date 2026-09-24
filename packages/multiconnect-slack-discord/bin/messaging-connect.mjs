#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = `multiconnect-messaging — connect your AI agent to Slack and Discord

Usage
  multiconnect-messaging start [options]

Options
  --port <n>       Port to listen on (default: 8427)
  --config <path>  Path to bridge.config.json (default: ./bridge.config.json)
  -h, --help       Show this message
  -v, --version    Show the connector version
`

function parseArgs(argv) {
  const args = { port: undefined, config: undefined, help: false, version: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') args.help = true
    else if (a === '-v' || a === '--version') args.version = true
    else if (a === '--port') args.port = Number(argv[++i])
    else if (a === '--config') args.config = argv[++i]
  }
  return args
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'start'
  const rest = cmd === argv[0] ? argv.slice(1) : argv
  const args = parseArgs(rest)

  if (args.help) { console.log(USAGE); process.exit(0) }
  if (args.version) { console.log('1.0.0'); process.exit(0) }
  if (cmd !== 'start') { console.log(USAGE); process.exit(2) }

  const { server, config } = createServer({ port: args.port, configPath: args.config ?? defaultConfigPath() })

  server.listen(config.port, () => {
    console.log('')
    console.log('  MultiConnect: Slack/Discord is running.')
    console.log('')
    console.log(`  Dashboard:  http://localhost:${config.port}`)
    console.log(`  Token:      ${config.authToken}`)
    console.log('')
    console.log(`  Slack request URL:    http://localhost:${config.port}/webhook/slack`)
    console.log(`  Discord interactions: http://localhost:${config.port}/webhook/discord`)
    console.log('')
    console.log('  Safe mode starts as read-only. Posts are logged but not sent until you')
    console.log('  switch to read-write in the dashboard.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiconnect-messaging: fatal —', err.message)
  process.exit(2)
})
