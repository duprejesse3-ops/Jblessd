// Edge function: Google tag gateway for advertisers (formerly "first-party mode").
//
// Google's tag libraries and measurement hits normally travel to
// www.googletagmanager.com. This function reserves a path on our own domain —
// /metrics — and forwards everything under it to Google's gateway endpoint, so
// the browser only ever talks to a first-party origin. Nothing about what is
// measured changes; only the hostname the requests are addressed to.
//
// Why an edge function and not a `[[redirects]]` proxy in netlify.toml:
// Google's setup guide for a generic CDN requires two things a static proxy rule
// cannot supply.
//   1. The Host header must equal the gateway host, not our own domain. `fetch`
//      to an absolute URL sets Host from that URL, so forwarding by hand gets
//      this right — provided the inbound Host header is dropped first.
//   2. Every forwarded request must carry the visitor's location in
//      X-Forwarded-CountryRegion (or X-Forwarded-Country / -Region). Google
//      derives geography from those headers instead of from a client IP, and a
//      request without them fails the setup's own geo validation. The values are
//      per-request, so they can only come from code — Netlify hands them to us
//      as context.geo.
//
// Declared at the very top of netlify.toml so it runs before csp.ts: this
// function returns a Response without calling context.next(), which ends the
// chain, so measurement traffic never reaches the HTML-rewriting middleware or
// the redirect engine. That is deliberate — these responses are Google's
// scripts and collect endpoints, not documents with <script> tags to nonce.
//
// The CSP in csp.ts already permits this without changes: the page requests
// /metrics/… from its own origin, which script-src-elem and connect-src cover
// with 'self'.
//
// Verifying a change here (from Google's setup guide, both must return "ok"):
//   https://jblessd.com/metrics/healthy                  — routing
//   https://jblessd.com/metrics/?validate_geo=healthy    — geo headers
// Then in Tag Assistant: Summary > Output > Hits Sent should show /metrics.

import type { Context } from '@netlify/edge-functions'

// The reserved serving path, configured to match on the Google side. Kept in the
// forwarded URL — Google routes on it, so /metrics/g/collect must arrive as
// /metrics/g/collect and not be stripped to /g/collect.
const SERVING_PATH = '/metrics'

// The gateway host is derived from the tagging ID that owns the gateway
// configuration: G-12345 -> g-12345.fps.goog. This is a placeholder default,
// carried over from the value the path was set up with; set the
// GOOGLE_TAG_GATEWAY_ID environment variable to the real measurement or
// container ID (G-…, GT-…, GTM-…, AW-…) to point the path at the live gateway
// without a code change or redeploy of this file.
const DEFAULT_TAG_ID = 'G-12345'

// An environment variable becomes part of an outbound hostname below, so it is
// validated rather than trusted: a typo — or an injected value — must not be
// able to redirect the site's measurement traffic to an arbitrary host. Only the
// shape Google issues is accepted, and anything else falls back to the default.
const TAG_ID_PATTERN = /^(g|gt|gtm|aw|dc)-[a-z0-9]+$/

// Headers that describe a single network hop and must not be relayed onto the
// next one, plus Netlify's own internal request annotations. `host` is dropped so
// that fetch sets it from the gateway URL, which is exactly the Host override
// Google's guide asks for.
const DROPPED_REQUEST_HEADERS = [
  'host',
  'connection',
  'keep-alive',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

function gatewayHost(): string {
  const configured = (Netlify.env.get('GOOGLE_TAG_GATEWAY_ID') || '').trim().toLowerCase()
  const tagId = TAG_ID_PATTERN.test(configured) ? configured : DEFAULT_TAG_ID.toLowerCase()
  return `${tagId}.fps.goog`
}

// Google accepts either a single ISO 3166-2 code (preferred, and the one it uses
// when both are present) or a country/region pair. Netlify resolves the
// subdivision only for some countries, so the pair is the fallback rather than
// emitting a malformed "US-" style value.
function applyGeoHeaders(headers: Headers, geo: Context['geo']): void {
  const country = geo.country?.code
  const region = geo.subdivision?.code
  if (!country) return
  headers.set('X-Forwarded-Country', country)
  if (!region) return
  headers.set('X-Forwarded-Region', region)
  headers.set('X-Forwarded-CountryRegion', `${country}-${region}`)
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)

  // Defensive: the declarations in netlify.toml already scope this function to
  // the serving path, so a request from anywhere else means the two have drifted
  // apart. Continue the chain rather than proxy a path Google is not expecting.
  if (url.pathname !== SERVING_PATH && !url.pathname.startsWith(`${SERVING_PATH}/`)) {
    return
  }

  const headers = new Headers(request.headers)
  for (const name of DROPPED_REQUEST_HEADERS) headers.delete(name)
  applyGeoHeaders(headers, context.geo)

  // gtag/gtm library fetches are GETs; GA4 and Ads hits are POSTs with a small
  // body, and sendBeacon payloads arrive the same way. The body is buffered
  // instead of streamed so fetch can set an accurate Content-Length — these
  // payloads are kilobytes at most.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const body = hasBody ? await request.arrayBuffer() : undefined

  const target = `https://${gatewayHost()}${url.pathname}${url.search}`

  try {
    // Returned as-is: Google's own Content-Type and caching headers have to
    // survive the hop — a script served without its content type is refused by
    // the browser, and rewriting Cache-Control here would either defeat
    // Google's caching of the library or let a measurement response be cached.
    return await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    })
  } catch (error) {
    context.log(`tag gateway: ${url.pathname} -> ${gatewayHost()} failed: ${error}`)
    // A failed hit is lost either way; answering promptly keeps a gateway
    // outage from stalling page loads waiting on the tag library.
    return new Response('tag gateway unavailable', {
      status: 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }
}
