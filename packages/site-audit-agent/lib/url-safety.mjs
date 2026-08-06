// Copyright (c) 2026 [SELLER]. All rights reserved.
// Licensed to a single purchaser under the terms in LICENSE.md.
// Redistribution or resale of this source, in whole or in part, is not permitted.

// URL safety for an auditor that fetches whatever address it is handed.
//
// The engine's whole job is "fetch this URL and report on it", which is exactly
// the shape of a Server-Side Request Forgery primitive. On a laptop that is
// harmless. The moment the same engine sits behind an HTTP endpoint — the
// storefront's own admin console, or a buyer who wraps it in an API — an
// unvalidated hostname lets a caller reach things only the server can see:
// 127.0.0.1, a private 10.x service, or a cloud instance-metadata endpoint that
// hands out credentials.
//
// So validation lives here, is applied by default, and has to be explicitly
// waived (allowPrivate) for the legitimate case of auditing a site on your own
// machine during development.
//
// Zero dependencies on purpose: this file, like the rest of the package, must run
// on any Node 18+ with nothing installed.

/** Hostnames that never refer to a customer's public website. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  // AWS/GCP/Azure/DigitalOcean instance metadata. Reaching this from a server is
  // the classic credential-theft SSRF payload.
  'metadata',
  'metadata.google.internal',
  'instance-data',
])

/** Suffixes that resolve only inside a private network. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain']

export class UnsafeUrlError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

/**
 * True when a bare IPv4 literal falls in a range that is not publicly routable.
 * Covers loopback, both RFC1918 blocks, link-local (which includes the
 * 169.254.169.254 metadata address), carrier-grade NAT, and 0.0.0.0/8.
 */
function isPrivateIPv4(host) {
  const parts = host.split('.')
  if (parts.length !== 4) return false

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return NaN
    return Number(part)
  })
  if (octets.some((n) => Number.isNaN(n) || n > 255)) return false

  const [a, b] = octets
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8 private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
  return false
}

/**
 * True for IPv6 literals that are loopback, unique-local or link-local. The
 * hostname arrives from `new URL()` wrapped in brackets and lowercased.
 */
function isPrivateIPv6(host) {
  const addr = host.replace(/^\[|\]$/g, '')
  if (addr === '::1' || addr === '::') return true
  if (/^f[cd][0-9a-f]{2}:/.test(addr)) return true // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]:/.test(addr)) return true // fe80::/10 link-local
  // IPv4-mapped (::ffff:127.0.0.1) — defer to the IPv4 rules.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

/**
 * Normalise and validate a target, returning a URL safe to fetch.
 *
 * Accepts a bare hostname ("example.com") for CLI convenience and defaults it to
 * https, since a site worth auditing should be reachable over TLS.
 *
 * @param {string} input       the address to audit
 * @param {object} [options]
 * @param {boolean} [options.allowPrivate=false]  permit localhost / private IPs,
 *   for auditing a dev server on your own machine
 * @returns {URL}
 * @throws {UnsafeUrlError}
 */
export function safeTargetUrl(input, { allowPrivate = false } = {}) {
  const raw = String(input ?? '').trim()
  if (!raw) throw new UnsafeUrlError('No URL was provided.')

  // A bare host or a "example.com/path" gets a scheme so the caller does not
  // have to type it. Anything with an explicit scheme is left alone, so a bad
  // scheme is reported rather than silently rewritten.
  //
  // https for a public site, because one worth auditing should have TLS; http
  // when private addresses are allowed, because that mode exists for a dev
  // server on your own machine and those almost never terminate TLS.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw)
  const withScheme = hasScheme ? raw : `${allowPrivate ? 'http' : 'https'}://${raw}`

  let url
  try {
    url = new URL(withScheme)
  } catch {
    throw new UnsafeUrlError(`"${raw}" is not a valid URL.`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError(`Only http and https are supported (got "${url.protocol}").`)
  }

  // Credentials in a URL are never needed for a public-site audit and would be
  // forwarded on every request, including through redirects.
  if (url.username || url.password) {
    throw new UnsafeUrlError('Remove the username/password from the URL before auditing it.')
  }

  if (allowPrivate) return url

  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UnsafeUrlError(
      `"${host}" is a local or internal address. Pass --allow-private to audit a site on this machine.`,
    )
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    throw new UnsafeUrlError(
      `"${host}" is a private or loopback address. Pass --allow-private to audit a site on this machine.`,
    )
  }
  // A hostname with no dot cannot be a public domain; it is an intranet name.
  if (!host.includes('.') && !host.startsWith('[')) {
    throw new UnsafeUrlError(`"${host}" is not a public hostname.`)
  }

  return url
}

/**
 * Guard applied to every URL the crawler discovers, not just the entry point.
 * A page on the audited site can link to 127.0.0.1, and following that link
 * would reintroduce exactly the hole safeTargetUrl closes.
 */
export function isSafeToFollow(url, { allowPrivate = false } = {}) {
  try {
    safeTargetUrl(url.href, { allowPrivate })
    return true
  } catch {
    return false
  }
}
