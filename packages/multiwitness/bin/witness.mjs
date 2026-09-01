#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Two commands. `start` runs the dashboard/ingest server, same as every
// other MultiConnect tool. `verify` is the one this product is built
// around: it reads the log file directly and recomputes the whole chain,
// with witness NOT running and no server, no token, nothing to trust but
// the file itself and this code. That's deliberate — a witness log an
// auditor can only check by trusting your running server isn't much of a
// witness log.

import process from 'node:process'
import { createServer } from '../lib/server.mjs'
import { defaultConfigPath } from '../lib/config.mjs'
import { verifyChain, defaultLogPath } from '../lib/chain.mjs'

const USAGE = `multiwitness — a tamper-evident, hash-chained action log

Usage
  multiwitness start [options]
  multiwitness verify [path]

Options (start)
  --port <n>       Port to listen on (default: 8429)
  --config <path>  Path to witness.config.json (default: ./witness.config.json)

verify reads the log directly and recomputes the whole hash chain — no
server, no token required. Point it at a log file (default:
./witness.log.jsonl) and it tells you whether every entry is intact.

  -h, --help       Show this message
  -v, --version    Show the version
`

function parseStartArgs(argv) {
  const args = { port: undefined, config: undefined }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') args.port = Number(argv[++i])
    else if (argv[i] === '--config') args.config = argv[++i]
  }
  return args
}

function runVerify(argv) {
  const logPath = argv[0] && !argv[0].startsWith('-') ? argv[0] : defaultLogPath()
  const result = verifyChain(logPath)
  console.log('')
  console.log(`  Checked: ${logPath}`)
  console.log(`  Entries: ${result.totalEntries}`)
  console.log('')
  if (result.valid) {
    console.log('  ✓ Chain is intact. Every entry\'s hash matches its contents, and every')
    console.log('    prevHash correctly links to the entry before it.')
    console.log('')
    process.exit(0)
  } else {
    console.log(`  ✗ Chain is BROKEN at entry ${result.brokenAtSeq}.`)
    console.log(`    ${result.reason}`)
    console.log('')
    process.exit(1)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]

  if (cmd === '-h' || cmd === '--help' || !cmd) {
    console.log(USAGE)
    process.exit(cmd ? 0 : 2)
  }
  if (cmd === '-v' || cmd === '--version') {
    console.log('1.0.0')
    process.exit(0)
  }
  if (cmd === 'verify') {
    runVerify(argv.slice(1))
    return
  }
  if (cmd !== 'start') {
    console.log(USAGE)
    process.exit(2)
  }

  const args = parseStartArgs(argv.slice(1))
  const { server, config } = createServer({ port: args.port, configPath: args.config ?? defaultConfigPath() })

  server.listen(config.port, () => {
    console.log('')
    console.log('  MultiWitness is running.')
    console.log('')
    console.log(`  Dashboard:      http://localhost:${config.port}`)
    console.log(`  Dashboard token: ${config.dashboardToken}`)
    console.log('')
    console.log(`  Ingest endpoint: http://localhost:${config.port}/api/events`)
    console.log(`  Ingest token:    ${config.ingestToken}`)
    console.log('')
    console.log('  Give the ingest token (not the dashboard token) to any other tool you')
    console.log('  want logging events here.')
    console.log('')
    console.log('  Press Ctrl+C to stop.')
    console.log('')
  })

  process.on('SIGINT', () => { server.close(() => process.exit(0)) })
}

main().catch((err) => {
  console.error('multiwitness: fatal —', err.message)
  process.exit(2)
})
