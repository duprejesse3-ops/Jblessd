#!/usr/bin/env node
// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// Entry point for MCP mode. This is what an MCP client (Claude Desktop,
// Claude Code, etc.) actually launches — see README's "MCP mode" section for
// the exact client config. Not meant to be run by hand in a normal terminal:
// it speaks JSON-RPC over stdio and expects a client on the other end.
//
// Usage (in an MCP client's config, not typed directly):
//   node bin/vault-mcp.mjs [--dest <path>]
//
// --dest defaults to ./.multivault, same default as the main CLI.

import process from 'node:process'
import { join } from 'node:path'
import { startMultiVaultServer } from '../lib/mcp-server.mjs'

function parseDest(argv) {
  const i = argv.indexOf('--dest')
  if (i !== -1 && argv[i + 1]) return argv[i + 1]
  return join(process.cwd(), '.multivault')
}

const dest = parseDest(process.argv.slice(2))

startMultiVaultServer(dest).catch((err) => {
  // MCP clients read stderr for diagnostics, not a JSON-RPC-shaped error —
  // this only fires on a startup failure (e.g. bad --dest), since ordinary
  // per-call errors are already handled inside the tool and returned as a
  // normal (isError: true) tool result instead of a process crash.
  process.stderr.write(`multivault-mcp failed to start: ${err.message}\n`)
  process.exit(1)
})
