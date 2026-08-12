// Netlify Function: /p/*  — serves the apps written in the browser workspace.
//
// This is the read half of the site hosting its own code. Source written at /code
// is served from here immediately, with no build, no deploy and no container in
// between: save on a phone, open /p/<slug> on a laptop, and the change is already
// there.
//
//   /p/<slug>             -> the app's index.html
//   /p/<slug>/            -> same
//   /p/<slug>/<file>      -> that file, with the right content type
//
// Three things are deliberate.
//
// **Origin isolation.** Every response carries SERVED_APP_CSP, whose `sandbox`
// directive omits `allow-same-origin`. App code therefore runs in an opaque
// origin: it cannot read the owner's admin session cookie, cannot reach this
// origin's storage, and cannot call the site's authenticated APIs as the owner.
// That is what makes it safe to run hand-written code on the same domain that
// takes card payments. /p/* is excluded from the site's CSP edge function in
// netlify.toml so this policy is the only one in force.
//
// **A <base> tag instead of a trailing-slash redirect.** An app written with
// `<link href="style.css">` would resolve that against /p/ if the document were
// served at /p/<slug> with no trailing slash. Redirecting to add the slash is the
// usual fix, but Netlify also normalises trailing slashes on its own, which is a
// redirect loop waiting to happen. Injecting `<base href="/p/<slug>/">` makes
// both URL forms work with no redirect at all.
//
// **Unpublished apps are private, and absent rather than forbidden.** A draft is
// served only to a caller holding the owner session, so it can be tested from a
// phone before anyone else can see it; to everybody else it is a 404, which
// leaks nothing about what is being worked on.

import type { Config, Context } from '@netlify/functions'
import { isAuthed } from '../lib/admin-auth.mjs'
import {
  SERVED_APP_CSP,
  appExists,
  assertSlug,
  contentTypeFor,
  getFile,
  withBaseHref,
} from '../lib/code-workspace.mjs'

/** Headers every response from this route carries, hit or miss. */
const BASE_HEADERS = {
  'Content-Security-Policy': SERVED_APP_CSP,
  // Workspace apps are the owner's own tools and drafts. Keeping them out of
  // search indexes stops them competing with the storefront for the domain's
  // ranking; robots.txt disallows the prefix as well.
  'X-Robots-Tag': 'noindex, nofollow',
}

function notFound(message: string) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title>` +
      `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080000;` +
      `color:#f5f0e8;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:2rem}` +
      `a{color:#f5b642}</style></head><body><div><h1>Not found</h1><p>${message}</p>` +
      `<p><a href="/code">Open the workspace</a></p></div></body></html>`,
    {
      status: 404,
      headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  )
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  const url = new URL(req.url)
  // "/p/<slug>/<maybe/nested/file>" -> ["<slug>", "<file>"]
  const rest = url.pathname.replace(/^\/p\/?/, '')
  const segments = rest.split('/').filter(Boolean)
  const slug = segments.shift() ?? ''
  const path = segments.length > 0 ? segments.join('/') : 'index.html'

  if (!slug) return notFound('No app was named in that URL.')
  try {
    assertSlug(slug)
  } catch {
    return notFound('That is not a valid app link.')
  }

  let file
  try {
    file = await getFile(slug, path)
  } catch (err) {
    console.error('code serve:', (err as Error)?.message)
    return new Response('This app is temporarily unavailable.', {
      status: 503,
      headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const authed = isAuthed(req, Date.now())

  if (!file) {
    // Distinguish "no such file in this app" from "no such app" — but only for
    // the owner. To anyone else both are simply missing.
    let exists = null
    try {
      exists = await appExists(slug)
    } catch {
      /* fall through to a plain 404 */
    }
    if (exists && (exists.published || authed)) {
      return notFound(`This app has no file called <code>${path.replace(/[<>&]/g, '')}</code>.`)
    }
    return notFound('There is no app at this address.')
  }

  if (!file.published && !authed) {
    return notFound('There is no app at this address.')
  }

  const isHtml = path.endsWith('.html')
  const body = isHtml ? withBaseHref(file.content, slug) : file.content

  return new Response(req.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      'Content-Type': contentTypeFor(path),
      // Never cached. The whole promise of the workspace is that a save is live
      // on the very next load, so a stored copy — in the browser or in a shared
      // cache — is always the wrong answer. netlify.toml repeats this for /p/*
      // because the site's "/*.js" rule matches an app's app.js too, and would
      // otherwise give it an hour-long cache while index.html revalidated.
      'Cache-Control': 'no-store',
      'Last-Modified': new Date(file.updatedAt).toUTCString(),
    },
  })
}

export const config: Config = {
  path: '/p/*',
}
