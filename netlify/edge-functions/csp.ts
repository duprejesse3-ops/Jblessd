// Edge function: per-request nonce + Content-Security-Policy.
//
// A nonce has to be unpredictable and different on every response, so it cannot
// come from a static header rule in netlify.toml — the value would be baked into
// the build and an attacker could simply read it out of any page. This function
// is therefore the single source of truth for the site's CSP: it mints a fresh
// nonce per request, stamps it onto every <script> element in the HTML on the way
// out, and emits the matching Content-Security-Policy header.
//
// It runs first in the edge chain (declared at the top of netlify.toml, and
// netlify.toml declarations run before inline ones), so `context.next()` returns
// the *finished* document — including the JSON-LD that seo.ts injects and the
// fully generated pages from pages.ts — and every script tag in it gets nonced.
//
// Why script-src-elem rather than putting the nonce in script-src:
//   - Once a nonce appears in a directive, browsers ignore 'unsafe-inline' in that
//     same directive. Scoping the nonce to script-src-elem removes 'unsafe-inline'
//     for <script> elements (the part that actually matters for XSS) while leaving
//     script-src — which is what inline event handlers fall back to — untouched.
//   - script-src-elem fully overrides script-src for script elements, so the Google
//     hosts are repeated in it. They are kept alongside the nonce because gtm.js
//     propagates the nonce only to the scripts it injects itself; anything a tag
//     template or Tag Assistant loads on its own would otherwise be blocked, which
//     is the silent-tracking-loss failure mode the header rules below guard against.
//   - Browsers too old for script-src-elem (Safari < 15.4) fall back to script-src
//     and keep working exactly as before — the nonce is simply ignored there.
//
// Everything else in the policy is carried over unchanged from the netlify.toml
// header rule this replaced, and stays tuned to the storefront's real dependencies:
//   - inline styles -> 'unsafe-inline' in style-src
//   - Google Fonts CSS + font files -> fonts.googleapis.com / fonts.gstatic.com
//   - Google Tag Manager / Analytics -> googletagmanager.com / google-analytics.com
//   - GA4 measurement (/g/collect) also posts to analytics.google.com and its
//     regional hosts (region1.…), and to stats.g.doubleclick.net once Google
//     Signals / the Ads link is on. Leaving those out of connect-src silently
//     drops page_view, scroll and conversion hits, so all three are allowlisted.
//   - Google Ads conversion + remarketing (AW-…) -> googleadservices.com,
//     googleads.g.doubleclick.net, ad.doubleclick.net and td.doubleclick.net
//     (ccm/s/collect), and google.com (ccm/rmkt collection endpoints)
//   - Google Tag Assistant (tagassistant.google.com) -> it loads the page being
//     debugged and talks to it across windows, so it needs script/connect/frame
//     and frame-ancestors access. Without it Tag Assistant cannot reach the page
//     and reports "Google Tag: GTM-… not found" even though the tag is installed.
// See netlify.toml for why X-Frame-Options and COOP are deliberately left unset.

import type { Context } from '@netlify/edge-functions'

// Google Tag Manager / gtag.js, Google Analytics 4, Google Ads conversion and
// remarketing, and Google Tag Assistant. gtm.js is loaded from googletagmanager
// and pulls the rest in at runtime.
const GOOGLE_SCRIPT_HOSTS = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://tagassistant.google.com',
].join(' ')

const CONNECT_HOSTS = [
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://analytics.google.com',
  'https://*.analytics.google.com',
  'https://stats.g.doubleclick.net',
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://ad.doubleclick.net',
  'https://td.doubleclick.net',
  'https://*.g.doubleclick.net',
  'https://www.google.com',
  'https://*.google.com',
  'https://tagassistant.google.com',
].join(' ')

const FRAME_HOSTS = [
  'https://js.stripe.com',
  'https://checkout.stripe.com',
  'https://www.googletagmanager.com',
  'https://td.doubleclick.net',
  'https://bid.g.doubleclick.net',
  'https://tagassistant.google.com',
].join(' ')

function policy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self' https://tagassistant.google.com",
    // GTM serves measurement pixels from googletagmanager.com; listed explicitly
    // even though the broad https: source already covers it.
    "img-src 'self' data: https: https://www.googletagmanager.com",
    // Inline <script> blocks must carry the nonce. Kept in sync with script-src
    // below for browsers that don't implement this directive.
    `script-src-elem 'nonce-${nonce}' 'self' ${GOOGLE_SCRIPT_HOSTS}`,
    // Fallback for script-src-elem, and the directive that governs inline event
    // handler attributes — hence 'unsafe-inline' stays here.
    `script-src 'self' 'unsafe-inline' ${GOOGLE_SCRIPT_HOSTS}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${CONNECT_HOSTS}`,
    "form-action 'self'",
    `frame-src ${FRAME_HOSTS}`,
    'upgrade-insecure-requests',
  ].join('; ')
}

// 128 bits of randomness, base64-encoded, as the CSP spec requires.
function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// Matches an opening <script> tag only — the lookahead stops it from matching a
// closing </script> or an already-nonced tag's attributes. Every value rendered
// into the site's HTML is HTML-escaped at the source (esc()/safeJson() in
// pages.ts and seo.ts), so a literal "<script" can only ever be a real tag the
// site authored, never attacker-supplied text.
const OPEN_SCRIPT_TAG = /<script(?=[\s>])/gi

// A one-time nonce must not be handed to a second visitor, so a page that a shared
// cache could genuinely replay gets its `public` downgraded to `private` — the
// freshness lifetime is left alone, so the SEO pages keep the 300s they ask for and
// only lose the (unused) ability to be stored by an intermediary.
//
// Anything a shared cache would have to revalidate anyway (max-age=0, no-store,
// no-cache, already private) is returned untouched: there is no nonce reuse to
// prevent, and rewriting it would clobber deliberate rules from netlify.toml — the
// admin console's no-store in particular.
function shareableCache(cacheControl: string | null): string | null {
  if (!cacheControl) return null
  if (/\b(no-store|no-cache|private)\b/i.test(cacheControl)) return null
  const maxAge = /\bmax-age\s*=\s*(\d+)/i.exec(cacheControl)
  if (!maxAge || Number(maxAge[1]) === 0) return null
  return cacheControl.replace(/\bpublic\b/i, 'private')
}

export default async (request: Request, context: Context) => {
  const response = await context.next()
  const nonce = makeNonce()
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', policy(nonce))

  // Only a GET of a document has scripts to stamp. Everything else — assets, JSON
  // from /api/*, and HEAD requests (whose Content-Length must survive untouched) —
  // still gets the policy, but its body is passed straight through unbuffered.
  const isDocument =
    request.method === 'GET' && (response.headers.get('content-type') || '').includes('text/html')
  if (!isDocument) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  const html = (await response.text()).replace(OPEN_SCRIPT_TAG, `<script nonce="${nonce}"`)
  // Rewriting the body changes its length, and a document carrying a stale
  // content-length is truncated by the browser.
  headers.delete('content-length')
  // Body and header are minted together, so a browser replaying its own cached copy
  // stays consistent; only a shared cache could pair one visitor's nonce with
  // another's page.
  const cacheControl = shareableCache(response.headers.get('cache-control'))
  if (cacheControl) headers.set('Cache-Control', cacheControl)

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
