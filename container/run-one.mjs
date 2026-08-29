// Container-side single-function runner.
//
// Loads the same function set server.mjs loads (via lib/routes.mjs, with the
// same netlify-global + config setup), finds one function by name, and
// invokes its handler directly — this is how a scheduled function (which has
// no HTTP route, by design, same as on the platform) gets triggered on
// demand from the MultiContainer app's "Functions" tab, using the real
// adapters (Postgres via the container's own DB, etc.) instead of a second,
// disconnected local run.
//
// Usage (inside the app container):
//   node container/run-one.mjs <function-name> [--url "http://localhost/api/x"] [--method POST] [--body '{"a":1}']
//
// Prints a single line "RUN_RESULT <json>" at the end so the Electron main
// process can parse the outcome out of an otherwise free-form log stream;
// everything the handler itself logs via console.log/console.error passes
// through untouched above that line.

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { installNetlifyGlobal } from './lib/netlify-global.mjs'
import { loadNetlifyConfig } from './lib/config.mjs'
import { loadFunctions } from './lib/routes.mjs'
import { closeDatabase } from './adapters/netlify-database.mjs'

installNetlifyGlobal()

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(process.env.APP_ROOT || join(HERE, '..'))
const SITE_URL = (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '')

function parseArgs(argv) {
  const out = { name: argv[0], url: 'http://localhost/', method: 'GET', body: undefined }
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i]
    else if (argv[i] === '--method') out.method = argv[++i]
    else if (argv[i] === '--body') out.body = argv[++i]
  }
  return out
}

function makeContext() {
  return {
    ip: '',
    geo: {},
    cookies: { get: () => undefined, set: () => {}, delete: () => {} },
    params: {},
    site: { url: SITE_URL, id: process.env.SITE_ID || '' },
    account: {},
    deploy: { id: process.env.DEPLOY_ID || 'container' },
    requestId: globalThis.crypto?.randomUUID?.() ?? '',
    log: (...args) => console.log(...args),
    waitUntil: (promise) => {
      Promise.resolve(promise).catch((err) =>
        console.error('waitUntil: background task failed —', err?.message ?? err),
      )
    },
    next: async () => undefined,
  }
}

async function main() {
  const { name, url, method, body } = parseArgs(process.argv.slice(2))
  if (!name) {
    console.error('Usage: node run-one.mjs <function-name> [--url ...] [--method ...] [--body ...]')
    process.exitCode = 1
    return
  }

  const config = loadNetlifyConfig(join(APP_ROOT, 'netlify.toml'))
  const functions = await loadFunctions(join(APP_ROOT, config.functionsDir))
  const fn = functions.find((f) => f.name === name)

  if (!fn) {
    const known = functions.map((f) => f.name).sort().join(', ')
    console.error(`No function named "${name}". Known functions: ${known}`)
    console.log(`RUN_RESULT ${JSON.stringify({ ok: false, error: 'not found' })}`)
    process.exitCode = 1
    return
  }
  if (fn.loadError) {
    console.error(`Function "${name}" failed to load: ${fn.loadError.message || fn.loadError}`)
    console.log(`RUN_RESULT ${JSON.stringify({ ok: false, error: 'load error' })}`)
    process.exitCode = 1
    return
  }

  const init = { method }
  if (body) init.body = body
  const request = new Request(url, init)

  console.log(`--- running ${name} (${method} ${url}) ---`)
  try {
    const response = await fn.handler(request, makeContext())
    if (response instanceof Response) {
      const status = response.status
      const text = await response.text().catch(() => '')
      console.log(`--- status: ${status} ---`)
      if (text) console.log(text)
      console.log(`RUN_RESULT ${JSON.stringify({ ok: status < 400, status })}`)
    } else {
      console.log('--- (no Response returned) ---')
      console.log(`RUN_RESULT ${JSON.stringify({ ok: true })}`)
    }
  } catch (error) {
    console.error(`function ${name} threw: ${error.stack || error.message}`)
    console.log(`RUN_RESULT ${JSON.stringify({ ok: false, error: error.message })}`)
    process.exitCode = 1
  } finally {
    await closeDatabase().catch(() => {})
  }
}

main()
