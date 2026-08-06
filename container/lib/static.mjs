// Static file serving for the publish directory, with the header rules from
// netlify.toml applied.
//
// This is the terminal handler in the request pipeline: whatever the edge chain
// and the API router do not claim ends up here.

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { join, normalize, resolve, sep, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { matchesPath } from './match.mjs'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

function contentType(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream'
}

/**
 * Applies every matching [[headers]] rule from netlify.toml, in declaration
 * order, so later and more specific rules win — the same precedence Netlify
 * uses. Without this the container would serve the site with none of its
 * security headers, since on Netlify those come from the CDN rather than from
 * any application code.
 */
export function headersFor(pathname, rules) {
  const result = {}
  for (const rule of rules) {
    if (!rule?.for || !rule.values) continue
    if (!matchesPath(pathname, rule.for)) continue
    for (const [key, value] of Object.entries(rule.values)) result[key] = value
  }
  return result
}

export function createStaticHandler({ root, headerRules }) {
  const publishRoot = resolve(root)

  /** Maps a URL path to a file on disk, or null if it escapes the root. */
  function candidatesFor(pathname) {
    let decoded
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      return []
    }
    // Reject encoded NULs and any traversal before touching the filesystem.
    if (decoded.includes('\0')) return []

    const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
    const target = resolve(publishRoot, relative)
    if (target !== publishRoot && !target.startsWith(publishRoot + sep)) return []

    if (decoded.endsWith('/')) return [join(target, 'index.html')]
    // A bare path may be a file, or a directory with an index.html inside it
    // (this is how /privacy-policy, /terms and /refund-policy resolve).
    return [target, join(target, 'index.html')]
  }

  return async function serveStatic(request) {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return null

    for (const candidate of candidatesFor(url.pathname)) {
      let info
      try {
        info = await stat(candidate)
      } catch {
        continue
      }
      if (!info.isFile()) continue

      // Weak validator built from size and mtime — enough for conditional
      // requests, and cheap, since hashing every asset on every request is not.
      const etag = `W/"${createHash('sha1')
        .update(`${info.size}-${info.mtimeMs}`)
        .digest('hex')
        .slice(0, 20)}"`

      // A Headers instance rather than a plain object: several netlify.toml
      // rules set Content-Type themselves (favicon.ico, manifest.webmanifest,
      // assetlinks.json, BingSiteAuth.xml), and merging those into an object
      // keyed by a differently-cased name emitted the header twice. Headers
      // matches case-insensitively, so the declared rule cleanly overrides the
      // extension-derived guess — which is the precedence Netlify applies.
      const headers = new Headers({
        'content-type': contentType(candidate),
        'last-modified': info.mtime.toUTCString(),
        etag,
      })
      for (const [key, value] of Object.entries(headersFor(url.pathname, headerRules))) {
        headers.set(key, value)
      }

      const inm = request.headers.get('if-none-match')
      if (inm && inm.split(',').some((tag) => tag.trim() === etag)) {
        return new Response(null, { status: 304, headers })
      }

      headers.set('content-length', String(info.size))

      if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers })
      }

      return new Response(Readable.toWeb(createReadStream(candidate)), {
        status: 200,
        headers,
      })
    }

    return null
  }
}
