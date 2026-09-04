// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// MultiVault's MCP (Model Context Protocol) server — the piece that closes
// the "manual paste" gap from v1. Instead of running `vault context` and
// pasting the output into a chat, an MCP-aware client (Claude Desktop,
// Claude Code, and other MCP clients) calls this tool directly and gets the
// current folder/calendar context on demand, live, automatically.
//
// Two things this deliberately does NOT do:
//   - It never touches vault.enc or asks for a passphrase. See
//     buildLiveContext() in lib/vault.mjs for why — this mode re-scans live
//     on every call instead of trusting a snapshot that might be stale.
//   - It never makes an outbound network call to serve context. The ONLY
//     network activity anywhere in this file is the optional, best-effort,
//     localhost-only POST to MultiWitness (see lib/witness-log.mjs) — and
//     that's for logging that context was served, never the content itself.
//
// Requires @modelcontextprotocol/sdk — the one real dependency in this
// product. Everything else (encryption, folder scanning, .ics parsing, the
// CLI) stays zero-dependency exactly as in v1; this is additive, not a
// change to that.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { resolve } from 'node:path'
import { buildLiveContext, statusVault } from './vault.mjs'
import { logContextServed, witnessConfigured } from './witness-log.mjs'

export function createMultiVaultServer(dest) {
  const server = new McpServer({ name: 'multivault', version: '2.0.0' })

  server.registerTool(
    'get_context',
    {
      title: 'Get local context',
      description:
        'Returns a live, current brief of the watched local folder and calendar file — file names, ' +
        'sizes, and (for a small set of plain-text formats) short excerpts, plus any calendar events. ' +
        'Nothing is cached: this re-scans the folder and re-reads the calendar file fresh on every ' +
        'call, so it always reflects the current state, not a snapshot from an earlier `vault sync`.',
      inputSchema: {
        format: z.enum(['markdown', 'json']).optional().describe('Output format. Defaults to markdown.'),
      },
    },
    async ({ format }) => {
      try {
        const { snapshot, text } = buildLiveContext(dest, { format: format ?? 'markdown' })
        // Best-effort, non-blocking, content-free logging — see
        // lib/witness-log.mjs. Never awaited-and-branched-on beyond this:
        // a logging failure must never affect the response below.
        logContextServed(
          `${snapshot.files.length} file(s), ${snapshot.events.length} event(s) from ${snapshot.folder ?? '(no folder)'}`,
        )
        return { content: [{ type: 'text', text }] }
      } catch (err) {
        return {
          content: [{ type: 'text', text: `MultiVault error: ${err.message}` }],
          isError: true,
        }
      }
    },
  )

  server.registerTool(
    'vault_status',
    {
      title: 'Vault status',
      description:
        'Reports what folder/calendar this vault is configured to watch and whether MultiWitness ' +
        'logging is active — without reading any file contents. Useful for confirming setup.',
      inputSchema: {},
    },
    async () => {
      const meta = statusVault(dest)
      if (!meta) {
        return {
          content: [{ type: 'text', text: `No vault found at ${dest}. Run "vault init" first.` }],
          isError: true,
        }
      }
      const lines = [
        `Folder: ${meta.folder ?? '(none configured)'}`,
        `Calendar: ${meta.icsPath ?? '(none configured)'}`,
        `MultiWitness logging: ${witnessConfigured() ? 'active' : 'not configured (set MULTIWITNESS_INGEST_TOKEN to enable)'}`,
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    },
  )

  return server
}

export async function startMultiVaultServer(dest) {
  const server = createMultiVaultServer(resolve(dest))
  const transport = new StdioServerTransport()
  await server.connect(transport)
  return server
}
