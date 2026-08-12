// The container's front door.
//
// Runs the storefront — static assets, 35 serverless functions, 4 edge
// functions, the forms handler and the scheduled jobs — as a single Node
// process, using the application source unmodified. The Netlify-shaped pieces
// it stands in for are: the CDN (static serving, headers, redirects), the
// function router, the edge middleware chain, Netlify Forms, and cron.
//
// Start it with:
//   node --import ./container/hooks/register.mjs container/server.mjs

import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { installNetlifyGlobal } from './lib/netlify-global.mjs'
import { loadNetlifyConfig } from './lib/config.mjs'
import { loadEdgeFunctions, loadFunctions } from './lib/routes.mjs'
import { createStaticHandler, headersFor } from './lib/static.mjs'
import { createFormHandler, isFormSubmission } from './lib/forms.mjs'
import { startScheduler } from './lib/scheduler.mjs'
import { matchesPath, splat } from './lib/match.mjs'
import { sendWebResponse, textResponse, toWebRequest } from './lib/http.mjs'
import { closeDatabase } from './adapters/netlify-database.mjs'

installNetlifyGlobal()

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = resolve(process.env.APP_ROOT || join(HERE, '..'))

const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '')
const TRUST_PROXY = process.env.TRUST_PROXY === 'true'
const SCHEDULER_ENABLED = process.env.ENABLE_SCHEDULER !== 'false'

/** Client IP, honouring X-Forwarded-For only when explicitly told to. */
function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded) return String(forwarded).split(',')[0].trim()
  }
  return req.socket.remoteAddress || ''
}

/**
 * The context object the platform passes as the second argument. Only the
 * fields the application actually reads are populated — ip, geo, log,
 * waitUntil and next — with the rest present as inert placeholders so a
 * property access cannot throw.
 */
function makeContext({ ip, next }) {
  return {
    ip,
    // No geolocation source in a self-hosted container. tag-gateway.ts reads
    // geo.country?.code and returns early when it is absent, so an empty object
    // degrades cleanly to "no geo headers forwarded" rather than breaking.
    geo: {},
    cookies: { get: () => undefined, set: () => {}, delete: () => {} },
    params: {},
    site: { url: SITE_URL, id: process.env.SITE_ID || '' },
    account: {},
    deploy: { id: process.env.DEPLOY_ID || 'container' },
    requestId: globalThis.crypto?.randomUUID?.() ?? '',
    log: (...args) => console.log(...args),
    // Handlers use this for work that should outlive the response. There is no
    // platform to hand it to here, so run it and swallow failures — the
    // alternative is an unhandled rejection taking the process down.
    waitUntil: (promise) => {
      Promise.resolve(promise).catch((err) =>
        console.error('waitUntil: background task failed —', err?.message ?? err),
      )
    },
    next,
  }
}

async function main() {
  const config = loadNetlifyConfig(join(APP_ROOT, 'netlify.toml'))
  const publishRoot = resolve(APP_ROOT, config.publish)

  const functions = await loadFunctions(join(APP_ROOT, config.functionsDir))
  const edgeChain = await loadEdgeFunctions(join(APP_ROOT, 'netlify/edge-functions'), config.edgeFunctions)

  // Exact-path lookup table. Every function contributes its declared paths plus
  // /api/<name> and /.netlify/functions/<name>; scheduled functions contribute
  // nothing, keeping them unreachable over HTTP exactly as on the platform.
  const routes = new Map()
  for (const fn of functions) {
    for (const path of fn.paths) {
      if (routes.has(path)) {
        console.warn(`route conflict on ${path}: ${routes.get(path).name} keeps it, ${fn.name} ignored`)
        continue
      }
      routes.set(path, fn)
    }
  }

  const serveStatic = createStaticHandler({ root: publishRoot, headerRules: config.headers })
  const submissionFn = functions.find((f) => f.name === 'submission-created')
  const handleForm = createFormHandler(submissionFn?.handler)

  const loadFailures = functions.filter((f) => f.loadError)
  console.log(
    `loaded ${functions.length} functions (${routes.size} routes), ${edgeChain.length} edge functions` +
      (loadFailures.length ? `, ${loadFailures.length} failed to load` : ''),
  )

  /**
   * Serves a file's bytes under an error status. Netlify's `status = 404` +
   * `force = true` rules do exactly this: the visitor gets the 404 page's HTML,
   * and crawlers get the 404 status that keeps the URL out of the index. Serving
   * it as a rewrite instead would return 200 and invite indexing.
   *
   * Validators are dropped because they describe the file, not this response —
   * a cached 404.html must not be replayed as a 200 for some other URL.
   */
  async function errorPage(status, target, url, method) {
    const page = await serveStatic(new Request(new URL(target, url), { method }))
    if (!page) {
      return textResponse(status, 'Not found', headersFor(url.pathname, config.headers))
    }
    const headers = new Headers(page.headers)
    headers.delete('etag')
    headers.delete('last-modified')
    const type = headers.get('content-type')
    for (const [key, value] of Object.entries(headersFor(url.pathname, config.headers))) {
      headers.set(key, value)
    }
    if (type) headers.set('content-type', type)
    return new Response(method === 'HEAD' ? null : page.body, { status, headers })
  }

  /** Terminal handler: redirects, functions, forms, then static files. */
  async function origin(request, ip) {
    const url = new URL(request.url)

    const direct = routes.get(url.pathname)
    if (direct) return invoke(direct, request, ip)

    let servePath = url.pathname

    for (const rule of config.redirects) {
      if (!rule.from || !matchesPath(servePath, rule.from)) continue

      const target = String(rule.to).replace(':splat', splat(servePath, rule.from))
      const status = Number(rule.status || 301)

      if (status >= 300 && status < 400) {
        return new Response(null, { status, headers: { location: target } })
      }

      // A 4xx/5xx rule points at a page to render *under that status* — the
      // shape netlify.toml uses to refuse the source paths. Handled before the
      // rewrite branch below, which would otherwise serve the page as a 200.
      if (status >= 400) {
        return errorPage(status, target, url, request.method)
      }

      // A 200 redirect is a rewrite: the URL the visitor sees does not change,
      // but a different resource is served.
      const rewritten = routes.get(target)
      if (rewritten) return invoke(rewritten, request, ip)
      servePath = target
      break
    }

    const contentType = request.headers.get('content-type') || ''
    if (isFormSubmission(request, contentType)) {
      const handled = await handleForm(request.clone())
      if (handled) return handled
    }

    const staticRequest =
      servePath === url.pathname
        ? request
        : new Request(new URL(servePath + url.search, url), request)

    const file = await serveStatic(staticRequest)
    if (file) {
      if (servePath === url.pathname) return file
      // A rewrite serves another file's bytes under the original URL, so the
      // header rules that apply are the ones for the URL the visitor asked for.
      const headers = new Headers(file.headers)
      for (const [key, value] of Object.entries(headersFor(url.pathname, config.headers))) {
        headers.set(key, value)
      }
      return new Response(file.body, { status: file.status, headers })
    }

    return errorPage(404, '/404.html', url, request.method)
  }

  async function invoke(fn, request, ip) {
    try {
      const response = await fn.handler(request, makeContext({ ip, next: async () => undefined }))
      if (response instanceof Response) return response
      return textResponse(204, '')
    } catch (error) {
      console.error(`function ${fn.name}: ${error.stack || error.message}`)
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  /** Runs the edge functions that match, innermost call landing on origin(). */
  function runChain(request, ip, index) {
    const layers = chainFor(new URL(request.url).pathname)

    const step = async (i) => {
      if (i >= layers.length) return origin(request, ip)

      const layer = layers[i]
      const context = makeContext({ ip, next: () => step(i + 1) })

      const result = await layer.handler(request, context)
      // Returning nothing means "not mine, carry on" — tag-gateway.ts relies on
      // this when a request reaches it on a path it does not serve.
      return result instanceof Response ? result : step(i + 1)
    }

    return step(index)
  }

  function chainFor(pathname) {
    return edgeChain.filter(
      (layer) =>
        matchesPath(pathname, layer.path) &&
        !(layer.excludedPath?.length && matchesPath(pathname, layer.excludedPath)),
    )
  }

  const server = createServer((req, res) => {
    const ip = clientIp(req)

    ;(async () => {
      // Liveness probe for the container runtime. Deliberately outside the
      // pipeline so it answers even when the database is down.
      if (req.url === '/healthz') {
        await sendWebResponse(res, textResponse(200, 'ok', { 'cache-control': 'no-store' }))
        return
      }

      const request = toWebRequest(req, { trustProxy: TRUST_PROXY })
      const response = await runChain(request, ip, 0)
      await sendWebResponse(res, response)
    })().catch(async (error) => {
      console.error(`unhandled request error: ${error.stack || error.message}`)
      if (!res.headersSent) await sendWebResponse(res, textResponse(500, 'Internal error'))
      else res.end()
    })
  })

  const scheduler = startScheduler({ functions, siteUrl: SITE_URL, enabled: SCHEDULER_ENABLED })

  server.listen(PORT, HOST, () => {
    console.log(`storefront listening on http://${HOST}:${PORT} (public URL ${SITE_URL})`)
  })

  let shuttingDown = false
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      if (shuttingDown) return
      shuttingDown = true
      console.log(`${signal} received, shutting down`)
      scheduler.stop()
      server.close(async () => {
        await closeDatabase()
        process.exit(0)
      })
      // Do not let a hung keep-alive connection block the shutdown forever.
      setTimeout(() => process.exit(0), 10_000).unref()
    })
  }
}

main().catch((error) => {
  console.error('failed to start:', error.stack || error.message)
  process.exit(1)
})
