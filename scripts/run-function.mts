// Local runner for netlify/functions/*.mts — lets you invoke any scheduled or
// HTTP function directly from your own machine, without a Netlify deploy.
//
// Usage:
//   npm run fn <function-name> [-- --url "http://localhost/api/scorecard?sku=AI-AG-003"] [--method POST] [--body '{"key":"value"}']
//
// Examples:
//   npm run fn velocity-engine
//   npm run fn reddit-poster
//   npm run fn scorecard -- --url "http://localhost/api/scorecard?sku=AI-AG-003"
//
// Loads .env from the repo root first (see .env.example for the full list of
// variables these functions read), then dynamically imports the named
// function file and calls its default export with a minimal fake Request —
// good enough for every function in this repo, since none of them depend on
// anything Netlify-specific in the Request itself (headers, geo, etc.).
//
// What this does NOT replicate: Netlify's own routing/redirects (netlify.toml),
// scheduling (the `schedule` in each function's `config` is ignored — you're
// invoking it directly, once, right now), and edge functions (pages.ts) are
// out of scope for this runner entirely — those need `netlify dev` instead.

import 'dotenv/config'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function parseArgs(argv: string[]) {
  const out: { name?: string; url: string; method: string; body?: string } = {
    url: 'http://localhost/',
    method: 'GET',
  }
  const rest = [...argv]
  out.name = rest.shift()
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--url') out.url = rest[++i]
    else if (rest[i] === '--method') out.method = rest[++i]
    else if (rest[i] === '--body') out.body = rest[++i]
  }
  return out
}

async function main() {
  const { name, url, method, body } = parseArgs(process.argv.slice(2))
  if (!name) {
    console.error('Usage: npm run fn <function-name> [-- --url "..." --method POST --body \'{"a":1}\']')
    process.exit(1)
  }

  const fnPath = path.resolve(process.cwd(), 'netlify/functions', `${name}.mts`)
  const mod = await import(pathToFileURL(fnPath).href).catch((err) => {
    console.error(`Could not load netlify/functions/${name}.mts:`, err.message)
    process.exit(1)
  })
  const handler = mod.default
  if (typeof handler !== 'function') {
    console.error(`netlify/functions/${name}.mts has no default export function`)
    process.exit(1)
  }

  const init: RequestInit = { method }
  if (body) init.body = body
  const req = new Request(url, init)

  console.log(`--- running ${name} (${method} ${url}) ---`)
  const res = await handler(req, {} as any)
  const text = res instanceof Response ? await res.text() : String(res)
  console.log(`--- status: ${res instanceof Response ? res.status : 'n/a'} ---`)
  console.log(text)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
