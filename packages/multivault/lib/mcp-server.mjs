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
import { loadIndex } from './index-store.mjs'
import { logContextServed, witnessConfigured } from './witness-log.mjs'

export function createMultiVaultServer(dest) {
  const server = new McpServer({ name: 'multivault', version: '3.0.0' })

  server.registerTool(
    'get_context',
    {
      title: 'Get local context',
      description:
        'Returns local context from the watched folder and calendar file. Two modes: ' +
        'call with no arguments for a full brief (file names, sizes, short excerpts, calendar events) — ' +
        'suitable for small-to-medium folders. Call WITH a `query` for large or many-file folders: this ' +
        'searches an incrementally-maintained local index (BM25 ranking, same approach real search ' +
        'engines use) and returns only the most relevant chunks instead of everything, so it stays fast ' +
        'and useful even against thousands of files. Nothing is cached across calls in either mode — the ' +
        'index updates itself against current disk state on every query, so results always reflect what\'s ' +
        'actually there now.',
      inputSchema: {
        query: z.string().optional().describe('Search terms. Omit for a full whole-folder brief instead of a targeted search.'),
        topK: z.number().int().positive().max(50).optional().describe('Max results when using query. Defaults to 8.'),
        format: z.enum(['markdown', 'json']).optional().describe('Output format. Defaults to markdown.'),
      },
    },
    async ({ query, topK, format }) => {
      try {
        const { snapshot, text } = buildLiveContext(dest, { query, topK, format: format ?? 'markdown' })
        // Best-effort, non-blocking, content-free logging — see
        // lib/witness-log.mjs. Never awaited-and-branched-on beyond this:
        // a logging failure must never affect the response below. The two
        // modes have different snapshot shapes (a query returns { results,
        // events }, no query returns { files, events }), so the logged
        // detail branches on which one actually ran.
        const detail = snapshot.results
          ? `query "${snapshot.query}" -> ${snapshot.results.length} result(s), ${snapshot.events.length} event(s)`
          : `${snapshot.files.length} file(s), ${snapshot.events.length} event(s) from ${snapshot.folder ?? '(no folder)'}`
        logContextServed(detail)
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
      // Read-only: reports whatever index currently exists on disk without
      // triggering a build/update, so vault_status stays cheap regardless
      // of folder size — that cost only happens when get_context is
      // actually called with a query.
      const index = loadIndex(dest)
      const lines = [
        `Folder: ${meta.folder ?? '(none configured)'}`,
        `Calendar: ${meta.icsPath ?? '(none configured)'}`,
        `MultiWitness logging: ${witnessConfigured() ? 'active' : 'not configured (set MULTIWITNESS_INGEST_TOKEN to enable)'}`,
        index
          ? `Search index: ${Object.keys(index.files).length} file(s) tracked, ${index.docs.length} indexed chunk(s), last updated ${index.builtAt}`
          : 'Search index: not built yet (built automatically on first query, or run "vault index")',
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
