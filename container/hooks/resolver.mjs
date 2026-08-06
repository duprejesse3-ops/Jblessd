// Module resolution hooks that let the unmodified application source run
// outside Netlify.
//
// Two rewrites happen here, and nothing else:
//
//   1. `@netlify/*` specifiers are redirected to the local adapters in
//      ../adapters. The application imports `getDatabase`, `getStore` and
//      `purgeCache` from Netlify packages; off-platform those names have to
//      resolve to something real. Doing it at resolution time means not one
//      line of netlify/functions or netlify/lib has to change, so the container
//      and the Netlify deploy stay byte-identical in application code.
//
//   2. `./foo.mjs` is retried as `./foo.mts` when the .mjs does not exist.
//      The codebase imports its TypeScript modules with a .mjs extension —
//      correct for a TypeScript build, and Netlify's bundler resolves it — but
//      Node's native type stripping does not do that rewrite. Node resolves the
//      literal specifier, finds no .mjs on disk, and throws. This retry is what
//      lets Node run the .mts sources directly with no build step.
//
// Registered from ./register.mjs, which is loaded via `node --import`.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ADAPTERS = {
  '@netlify/functions': '../adapters/netlify-functions.mjs',
  '@netlify/database': '../adapters/netlify-database.mjs',
  '@netlify/blobs': '../adapters/netlify-blobs.mjs',
  '@netlify/edge-functions': '../adapters/netlify-edge-functions.mjs',
}

const RESOLVED = Object.fromEntries(
  Object.entries(ADAPTERS).map(([specifier, path]) => [
    specifier,
    new URL(path, import.meta.url).href,
  ]),
)

export async function resolve(specifier, context, nextResolve) {
  const adapter = RESOLVED[specifier]
  if (adapter) return { url: adapter, shortCircuit: true }

  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    // Only .mjs specifiers get the .mts retry, and only when the sibling .mts
    // actually exists. Anything else keeps Node's original error, so a genuine
    // typo still reports as a missing module rather than as a confusing miss
    // against a file that was never there.
    if (!specifier.endsWith('.mjs') || !context.parentURL) throw error

    const candidate = new URL(specifier.replace(/\.mjs$/, '.mts'), context.parentURL)
    if (candidate.protocol !== 'file:' || !existsSync(fileURLToPath(candidate))) throw error

    return { url: candidate.href, shortCircuit: true }
  }
}
