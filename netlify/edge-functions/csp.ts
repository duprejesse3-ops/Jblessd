// Edge function: per-request nonce + Content-Security-Policy.
//
// A nonce has to be unpredictable and different on every response, so it cannot
// come from a static header rule in netlify.toml — the value would be baked into
// the build and an attacker could simply read it out of any page. This function
// is therefore the single source of truth for the site's CSP: it mints a fresh
// nonce per request, stamps it onto every <script> element in the HTML on the way
// out, and emits the matching Content-Security-Policy header.
//
// It runs first in the edge chain for every page path (declared at the top of
// netlify.toml, ahead of everything except the /metrics tag gateway, and
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
//     access, and it must be allowed to EMBED the page — see FRAME_ANCESTOR_HOSTS,
//     which covers the whole tagassistant -> tagmanager -> googletagmanager frame
//     chain. Without every origin in that chain Tag Assistant cannot reach the page
//     and reports "unable to connect", or "Google Tag: GTM-… not found" even though
//     the tag is installed.
//   - GTM Preview & Debug -> tagmanager.google.com plus ssl./www.gstatic.com for
//     the overlay's script, stylesheet and icon font.
//   - Google Ads remarketing -> the visitor's regional google.<cctld> host, which
//     needs naming one domain at a time (see GOOGLE_COUNTRY_HOSTS below).
//   - Taboola pixel -> cdn.taboola.com for the library and trc.taboola.com for its
//     event and cookie-sync endpoints (see TABOOLA_HOSTS below).
// See netlify.toml for why X-Frame-Options and COOP are deliberately left unset.
//
// One deliberate omission: 'unsafe-eval' is NOT granted. GTM needs it only for
// Custom JavaScript variables, which resolve to undefined without it; nothing in
// this container uses one, and granting it would undo most of the protection the
// nonce buys. Add it to script-src only if such a variable is ever introduced.

import type { Context } from '@netlify/edge-functions'

// Google Tag Manager / gtag.js, Google Analytics 4, Google Ads conversion and
// remarketing, GTM Preview mode and Google Tag Assistant. gtm.js and gtag.js are
// loaded from googletagmanager and pull the rest in at runtime — and they pull it
// from a different host per feature: the conversion linker fetches from google.com,
// remarketing from googleadservices and googlesyndication, the preview overlay from
// tagmanager.google.com and gstatic. Every host Google's own CSP guide lists is
// named here, because a missing one does not fail loudly: the container loads, the
// tag that needed the blocked host quietly never fires, and Ads/GA report no data.
const GOOGLE_SCRIPT_HOSTS = [
  'https://www.googletagmanager.com',
  'https://*.googletagmanager.com',
  'https://tagmanager.google.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://www.googleadservices.com',
  'https://*.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://td.doubleclick.net',
  'https://static.doubleclick.net',
  'https://pagead2.googlesyndication.com',
  'https://*.googlesyndication.com',
  'https://adservice.google.com',
  'https://www.google.com',
  'https://google.com',
  'https://www.gstatic.com',
  'https://ssl.gstatic.com',
  'https://tagassistant.google.com',
].join(' ')

// Google Ads remarketing and the GA4 <-> Ads link post their audience and
// conversion hits to the visitor's *own* regional Google domain — e.g.
// https://www.google.co.uk/pagead/1p-user-list/… for a shopper in Britain — not to
// google.com. CSP permits no wildcard in the suffix position ("https://www.google.*"
// is simply an invalid source expression), so each market has to be named. A market
// that is absent fails closed and silently: the tag fires, the browser refuses the
// request, and the Ads audience stays empty for everyone in that country. To support
// another market, append its domain here; nothing else needs to change.
const GOOGLE_COUNTRY_HOSTS = [
  'co.uk', 'ie', 'ca', 'com.au', 'co.nz', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch',
  'at', 'pt', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'hu', 'ro', 'gr', 'com.tr',
  'co.in', 'co.jp', 'co.kr', 'com.sg', 'com.hk', 'com.tw', 'co.id', 'com.ph',
  'com.my', 'com.br', 'com.mx', 'com.ar', 'cl', 'co', 'com.pe', 'co.za', 'ae',
  'com.sa', 'co.il', 'com.ng', 'co.ke',
]
  .map((tld) => `https://www.google.${tld}`)
  .join(' ')

// Taboola pixel (see taboola-pixel.js). tfa.js is served from cdn.taboola.com and
// then reports its page_view and conversion events to trc.taboola.com, which also
// hosts the audience cookie-sync frame. Taboola serves parts of the library and
// some regional endpoints from further subdomains that are not documented as a
// fixed list, so the wildcard is kept alongside the two exact hosts — the same
// failure mode as the Google hosts above applies here: a blocked request does not
// surface as an error on the page, the pixel simply reports nothing and the
// Taboola dashboard shows no traffic.
const TABOOLA_HOSTS = [
  'https://cdn.taboola.com',
  'https://trc.taboola.com',
  'https://*.taboola.com',
].join(' ')

const CONNECT_HOSTS = [
  'https://www.googletagmanager.com',
  'https://*.googletagmanager.com',
  'https://tagmanager.google.com',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://analytics.google.com',
  'https://*.analytics.google.com',
  'https://stats.g.doubleclick.net',
  'https://www.googleadservices.com',
  'https://*.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://ad.doubleclick.net',
  'https://td.doubleclick.net',
  'https://*.g.doubleclick.net',
  'https://*.doubleclick.net',
  'https://pagead2.googlesyndication.com',
  'https://ade.googlesyndication.com',
  'https://*.googlesyndication.com',
  'https://adservice.google.com',
  // Bare google.com as well as www: the Google Ads enhanced-conversions / user-data
  // beacon posts to the apex host, which "https://*.google.com" does not match.
  'https://google.com',
  'https://www.google.com',
  'https://*.google.com',
  'https://tagassistant.google.com',
  GOOGLE_COUNTRY_HOSTS,
].join(' ')

// Origins allowed to EMBED this page (frame-ancestors), as opposed to FRAME_HOSTS
// below, which is what this page may embed. These are opposite directions and a host
// being in one says nothing about the other — the reason Tag Assistant kept failing
// to connect while every other Google host was already allowlisted.
//
// A Tag Assistant / GTM Preview session does not frame the page from a single
// origin: the debug UI lives on tagassistant.google.com, but the "Preview" button in
// the Tag Manager UI drives the session from tagmanager.google.com, and the chain
// runs through a googletagmanager.com container frame in between. frame-ancestors is
// evaluated against EVERY ancestor in that chain, not just the immediate parent, so
// one missing origin cancels the whole load — the iframe stays blank and Tag
// Assistant reports "unable to connect" / "refused to connect" no matter how
// complete script-src and frame-src are. Every origin in the chain is therefore
// named here.
//
// This stays a bounded allowlist of named Google origins, so clickjacking from an
// arbitrary site is still refused. Do NOT collapse it to '*' or 'https:'.
const FRAME_ANCESTOR_HOSTS = [
  "'self'",
  'https://tagassistant.google.com',
  'https://tagmanager.google.com',
  'https://www.googletagmanager.com',
  'https://*.googletagmanager.com',
].join(' ')

const FRAME_HOSTS = [
  "'self'",
  'https://js.stripe.com',
  'https://checkout.stripe.com',
  'https://www.googletagmanager.com',
  'https://*.googletagmanager.com',
  'https://tagmanager.google.com',
  'https://td.doubleclick.net',
  'https://bid.g.doubleclick.net',
  'https://*.g.doubleclick.net',
  // Floodlight and Ads conversion iframes use per-advertiser subdomains
  // (<config-id>.fls.doubleclick.net), so the host cannot be pinned exactly.
  'https://*.doubleclick.net',
  'https://*.googlesyndication.com',
  'https://www.google.com',
  'https://*.google.com',
  'https://tagassistant.google.com',
].join(' ')

function policy(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${FRAME_ANCESTOR_HOSTS}`,
    // GTM serves measurement pixels from googletagmanager.com, Ads conversion and
    // remarketing pixels from google.com / googleadservices / doubleclick, and the
    // preview overlay's chrome from gstatic. The broad https: source already covers
    // every one of them; they are listed explicitly so the policy still documents
    // what the site depends on if https: is ever tightened.
    "img-src 'self' data: https: https://www.googletagmanager.com " +
      'https://ssl.gstatic.com https://www.gstatic.com https://trc.taboola.com',
    // Inline <script> blocks must carry the nonce. Kept in sync with script-src
    // below for browsers that don't implement this directive.
    `script-src-elem 'nonce-${nonce}' 'self' ${GOOGLE_SCRIPT_HOSTS} ${TABOOLA_HOSTS}`,
    // Fallback for script-src-elem, and the directive that governs inline event
    // handler attributes — hence 'unsafe-inline' stays here.
    `script-src 'self' 'unsafe-inline' ${GOOGLE_SCRIPT_HOSTS} ${TABOOLA_HOSTS}`,
    // tagmanager.google.com / googletagmanager.com serve the stylesheet for GTM's
    // Preview & Debug overlay; without them the debugger renders unstyled and
    // unusable even though the container itself is working.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com " +
      'https://www.googletagmanager.com https://tagmanager.google.com',
    // data: is required by the Preview & Debug overlay, which inlines its icon font.
    "font-src 'self' data: https://fonts.gstatic.com https://*.gstatic.com",
    `connect-src 'self' ${CONNECT_HOSTS} ${TABOOLA_HOSTS}`,
    "form-action 'self'",
    `frame-src ${FRAME_HOSTS} ${TABOOLA_HOSTS}`,
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
