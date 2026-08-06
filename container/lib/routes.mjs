// Discovers the application's functions and edge functions and turns them into
// a routing table.
//
// Nothing here is generated or hand-maintained: the routes come from the same
// `export const config` declarations Netlify reads, so adding a function to the
// repo adds it to the container automatically.

import { readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * A module that throws while loading (webhook.mts constructs a Stripe client
 * from an environment variable that may be unset, for instance) must not take
 * the whole server down with it. The failure is recorded and turned into a 503
 * on that one route, so the rest of the site still serves.
 */
function brokenHandler(name, error) {
  return async () =>
    new Response(
      JSON.stringify({
        error: 'Function unavailable',
        detail: `${name} failed to load: ${error.message}`,
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
}

async function loadModule(file) {
  return import(pathToFileURL(file).href)
}

export async function loadFunctions(dir) {
  const root = resolve(dir)
  const entries = (await readdir(root)).filter((f) => /\.(mts|ts|mjs|js)$/.test(f)).sort()

  const functions = []
  for (const entry of entries) {
    const name = basename(entry).replace(/\.(mts|ts|mjs|js)$/, '')
    const file = join(root, entry)

    let mod = null
    let loadError = null
    try {
      mod = await loadModule(file)
    } catch (error) {
      loadError = error
      console.error(`function ${name}: failed to load — ${error.message}`)
    }

    const config = mod?.config ?? {}
    const handler = loadError
      ? brokenHandler(name, loadError)
      : mod?.default

    if (!handler) {
      console.warn(`function ${name}: no default export, skipping`)
      continue
    }

    // Declared paths win; every function is additionally reachable at
    // /api/<name> and /.netlify/functions/<name>, which is what the /api/*
    // rewrite in netlify.toml produces on the platform.
    const declared = config.path
      ? Array.isArray(config.path)
        ? config.path
        : [config.path]
      : []

    functions.push({
      name,
      handler,
      schedule: config.schedule ?? null,
      // A scheduled function has no public URL on Netlify. Keeping that true
      // here matters: subscriber-digest and the crawlers are expensive and must
      // not be triggerable by an anonymous GET.
      paths: config.schedule ? [] : [...new Set([...declared, `/api/${name}`, `/.netlify/functions/${name}`])],
      loadError,
    })
  }

  return functions
}

export async function loadEdgeFunctions(dir, tomlDeclarations) {
  const root = resolve(dir)
  let entries
  try {
    entries = (await readdir(root)).filter((f) => /\.(ts|mts|js|mjs)$/.test(f)).sort()
  } catch {
    return []
  }

  const loaded = new Map()
  for (const entry of entries) {
    const name = basename(entry).replace(/\.(ts|mts|js|mjs)$/, '')
    try {
      const mod = await loadModule(join(root, entry))
      if (mod?.default) loaded.set(name, { name, handler: mod.default, config: mod.config ?? {} })
    } catch (error) {
      console.error(`edge function ${name}: failed to load — ${error.message}`)
    }
  }

  // Order is behaviour, not cosmetics. Netlify runs netlify.toml declarations
  // before inline `export const config` ones, which is what puts csp.ts on the
  // outside of the chain so it sees the finished HTML from seo.ts and pages.ts
  // and can stamp its nonce onto every script tag.
  const chain = []

  for (const declaration of tomlDeclarations) {
    const target = loaded.get(declaration.function)
    if (!target) {
      console.warn(`netlify.toml declares edge function "${declaration.function}" which was not found`)
      continue
    }
    chain.push({
      name: target.name,
      handler: target.handler,
      path: declaration.path,
      excludedPath: declaration.excludedPath ?? [],
    })
  }

  const declaredNames = new Set(tomlDeclarations.map((d) => d.function))
  for (const [name, target] of loaded) {
    if (declaredNames.has(name)) continue
    if (!target.config.path) continue
    chain.push({
      name,
      handler: target.handler,
      path: target.config.path,
      excludedPath: target.config.excludedPath ?? [],
    })
  }

  return chain
}
