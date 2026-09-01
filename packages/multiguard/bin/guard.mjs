#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'

const USAGE = `multiguard — one dashboard and kill switch for every MultiConnect tool

Usage
  multiguard start [options]

Options
  --port <n>       Port to listen on (default: 8431)
  --config <path>  Path to guard.config.json (default: ./guard.config.json)
  -h, --help       Show this message
  -v, --version    Show the version
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
    console.log('  MultiGuard is running.')
    console.log('')
    console.log(`  Dashboard:  http://localhost:${config.port}`)
    console.log(`  Token:      ${config.dashboardToken}`)
    console.log('')
    console.log('  Register your other MultiConnect tools in the dashboard by their own')
    console.log('  base URL and dashboard token to start watching them.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiguard: fatal —', err.message)
  process.exit(2)
})
