// Netlify Function: /api/mcp
//
// An MCP (Model Context Protocol) server exposing the real, live MultiNiche AI
// catalog to any MCP-compatible client — Claude, ChatGPT, or any agent that
// speaks MCP — not just human browsers. Four tools:
//   - search_catalog    find products by text/category/niche
//   - get_product       full listing for one SKU
//   - run_live_demo     the same "Live Proof" a human shopper gets — the
//                        product actually runs, before anything is recommended
//   - get_purchase_link a link to check out (no autonomous agent payment yet;
//                        a human still has to complete checkout)
//
// Stateless Streamable HTTP transport: a fresh McpServer + transport per
// request, because that's what a serverless function actually is — there's
// no persistent process to hold session state across invocations. Verified
// directly (not from memory of the spec) that the SDK's stateless mode
// tolerates a bare tools/call or tools/list with no prior initialize on that
// same transport instance, which is exactly what happens across real,
// independent requests to a stateless remote server.

import type { Context, Config } from '@netlify/functions'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'

const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL) as [Product['category'], ...Product['category'][]]
const NICHE_KEYS = Object.keys(NICHE_LABEL) as [Product['niche'], ...Product['niche'][]]

function decorate(p: Product) {
  return {
    ...p,
    catLabel: CATEGORY_LABEL[p.category] ?? p.category,
    nicheLabel: NICHE_LABEL[p.niche] ?? p.niche,
  }
}

function buildServer() {
  const server = new McpServer({ name: 'multinicheai-catalog', version: '1.0.0' })

  server.registerTool(
    'search_catalog',
    {
      title: 'Search the MultiNiche AI catalog',
      description:
        "Search MultiNiche AI's real, live catalog of AI productivity tools — " +
        'prompt packs, automation blueprints, doc templates, agent configs, ' +
        'connectors, and host packs. Every result is a real product with a live ' +
        "price. Use run_live_demo to actually see one work before recommending it.",
      inputSchema: {
        query: z.string().optional().describe('Free-text search across product name and description'),
        category: z.enum(CATEGORY_KEYS).optional().describe('Filter by category'),
        niche: z.enum(NICHE_KEYS).optional().describe('Filter by target audience/niche'),
        limit: z.number().int().min(1).max(50).optional().describe('Max results to return, default 10'),
      },
    },
    async ({ query, category, niche, limit }) => {
      const { products } = await loadCatalog()
      const q = (query ?? '').trim().toLowerCase()
      const matches = products
        .filter((p) => !category || p.category === category)
        .filter((p) => !niche || p.niche === niche)
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q))
        .slice(0, limit ?? 10)
        .map(decorate)
      return {
        content: [
          { type: 'text', text: JSON.stringify({ count: matches.length, products: matches }, null, 2) },
        ],
      }
    },
  )

  server.registerTool(
    'get_product',
    {
      title: 'Get full product details',
      description:
        'Get the full listing for one SKU from the MultiNiche AI catalog: price, format, spec, and description.',
      inputSchema: { sku: z.string().describe('The product SKU, e.g. AI-PP-001') },
    },
    async ({ sku }) => {
      const { products } = await loadCatalog()
      const product = products.find((p) => p.sku === sku)
      if (!product) {
        return { content: [{ type: 'text', text: `No product found for SKU "${sku}".` }], isError: true }
      }
      return { content: [{ type: 'text', text: JSON.stringify(decorate(product), null, 2) }] }
    },
  )

  server.registerTool(
    'run_live_demo',
    {
      title: 'Run the product live, before recommending it',
      description:
        "Actually run the product on a real (or your own) task and get the real " +
        "output back — the same 'Live Proof' a human shopper sees before buying. " +
        'Use this before recommending a product so the recommendation is grounded ' +
        'in what it actually produces, not just its description.',
      inputSchema: {
        sku: z.string().describe('The product SKU to run'),
        scenario: z
          .string()
          .max(600)
          .optional()
          .describe('A specific task/situation to tailor the demo to. Omit for a representative default demo.'),
      },
    },
    async ({ sku, scenario }) => {
      const res = await fetch('https://multinicheai.com/api/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku, scenario: scenario ?? '' }),
      })
      const text = await res.text()
      if (!res.ok) {
        return {
          content: [{ type: 'text', text: `Demo run failed (${res.status}): ${text.slice(0, 300)}` }],
          isError: true,
        }
      }
      return { content: [{ type: 'text', text }] }
    },
  )

  server.registerTool(
    'get_purchase_link',
    {
      title: 'Get a link to buy the product',
      description:
        'Get a direct link to the product on multinicheai.com, ready to check ' +
        'out. There is no autonomous agent-payment flow yet — a human needs to ' +
        'open this link and complete checkout themselves.',
      inputSchema: { sku: z.string().describe('The product SKU') },
    },
    async ({ sku }) => {
      return {
        content: [{ type: 'text', text: `https://multinicheai.com/?product=${encodeURIComponent(sku)}` }],
      }
    },
  )

  return server
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, mcp-protocol-version',
      },
    })
  }

  const server = buildServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless: no session ID, no in-memory state carried across invocations
    // — matches a Netlify Function's actual lifecycle (fresh process per call).
    sessionIdGenerator: undefined,
    // Plain JSON response instead of an SSE stream — simplest and most
    // reliable shape for a single request/response serverless function.
    enableJsonResponse: true,
  })
  await server.connect(transport)
  const res = await transport.handleRequest(req)
  res.headers.set('Access-Control-Allow-Origin', '*')
  return res
}

export const config: Config = {
  path: '/api/mcp',
}
