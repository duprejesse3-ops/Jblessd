// Inspects the live storefront's HTTP response headers and reports on its
// security posture — the browser-facing hardening that protects visitors from
// clickjacking, protocol downgrade, MIME sniffing, and referrer/permission leaks.
// Mirrors the shape of site-health.mts and crawler.mts so the security-agent,
// the security-status endpoint, and the DB row all speak the same language.

export type CheckStatus = 'passed' | 'warning' | 'failed'
export type SecurityStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface SecurityCheck {
  name: string
  status: CheckStatus
  detail: string
  // How much weight a failure carries. Missing a critical defense (CSP, HSTS,
  // framing, MIME) fails the whole run; a missing recommended header only
  // downgrades it to a warning.
  severity: 'critical' | 'recommended'
}

export interface SecurityReport {
  status: SecurityStatus
  summary: string
  checks: SecurityCheck[]
  issues: string[]
  metrics: {
    grade: string
    passed: number
    warnings: number
    failures: number
    checked: number
    finalUrl: string
    https: boolean
  }
  durationMs: number
}

const REQUEST_TIMEOUT_MS = 5000

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

// Header names arrive lower-cased from fetch(); normalise lookups so callers can
// write them naturally.
function header(headers: Headers, name: string): string {
  return (headers.get(name) ?? '').trim()
}

function passed(name: string, severity: SecurityCheck['severity'], detail: string): SecurityCheck {
  return { name, status: 'passed', detail, severity }
}

function warning(name: string, severity: SecurityCheck['severity'], detail: string): SecurityCheck {
  return { name, status: 'warning', detail, severity }
}

function failed(name: string, severity: SecurityCheck['severity'], detail: string): SecurityCheck {
  return { name, status: 'failed', detail, severity }
}

function checkTransport(headers: Headers, https: boolean): SecurityCheck {
  const name = 'HTTPS / HSTS'
  if (!https) return failed(name, 'critical', 'Site did not resolve over HTTPS')
  const hsts = header(headers, 'strict-transport-security')
  if (!hsts) return failed(name, 'critical', 'Strict-Transport-Security header is missing')
  const maxAge = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? '0')
  if (maxAge < 15552000) {
    return warning(name, 'recommended', `HSTS max-age is only ${maxAge}s; use at least 15552000 (180 days)`)
  }
  return passed(name, 'critical', `HTTPS enforced with HSTS max-age=${maxAge}`)
}

function checkContentType(headers: Headers): SecurityCheck {
  const name = 'MIME sniffing'
  const value = header(headers, 'x-content-type-options').toLowerCase()
  if (value !== 'nosniff') return failed(name, 'critical', 'X-Content-Type-Options: nosniff is missing')
  return passed(name, 'critical', 'X-Content-Type-Options: nosniff is set')
}

function checkFraming(headers: Headers): SecurityCheck {
  const name = 'Clickjacking protection'
  const xfo = header(headers, 'x-frame-options').toLowerCase()
  const csp = header(headers, 'content-security-policy').toLowerCase()
  const frameAncestors = /frame-ancestors\s+([^;]+)/.exec(csp)?.[1]?.trim()
  const cspBlocks = frameAncestors === "'none'" || frameAncestors === "'self'"
  if (xfo === 'deny' || xfo === 'sameorigin' || cspBlocks) {
    return passed(name, 'critical', `Framing restricted (${xfo || `frame-ancestors ${frameAncestors}`})`)
  }
  return failed(name, 'critical', 'No X-Frame-Options or CSP frame-ancestors restriction found')
}

function checkCsp(headers: Headers): SecurityCheck {
  const name = 'Content-Security-Policy'
  const csp = header(headers, 'content-security-policy')
  if (!csp) return failed(name, 'critical', 'Content-Security-Policy header is missing')
  if (/default-src[^;]*\*/i.test(csp) && !/default-src[^;]*'self'/i.test(csp)) {
    return warning(name, 'recommended', 'CSP default-src uses a bare wildcard; tighten it to trusted origins')
  }
  if (!/object-src\s+'none'/i.test(csp)) {
    return warning(name, 'recommended', "CSP present but does not set object-src 'none'")
  }
  return passed(name, 'critical', 'Content-Security-Policy restricts content sources')
}

function checkReferrerPolicy(headers: Headers): SecurityCheck {
  const name = 'Referrer-Policy'
  const value = header(headers, 'referrer-policy').toLowerCase()
  if (!value) return warning(name, 'recommended', 'Referrer-Policy header is missing')
  const leaky = value === 'unsafe-url' || value === ''
  if (leaky) return warning(name, 'recommended', `Referrer-Policy "${value}" leaks full URLs cross-origin`)
  return passed(name, 'recommended', `Referrer-Policy: ${value}`)
}

function checkPermissionsPolicy(headers: Headers): SecurityCheck {
  const name = 'Permissions-Policy'
  const value = header(headers, 'permissions-policy')
  if (!value) return warning(name, 'recommended', 'Permissions-Policy header is missing')
  return passed(name, 'recommended', 'Permissions-Policy restricts powerful browser features')
}

function checkInfoLeak(headers: Headers): SecurityCheck {
  const name = 'Stack disclosure'
  const poweredBy = header(headers, 'x-powered-by')
  const server = header(headers, 'server')
  const leaks: string[] = []
  if (poweredBy) leaks.push(`X-Powered-By: ${poweredBy}`)
  // A version string in Server (e.g. "nginx/1.25.3") tells attackers exactly
  // what to target; a bare product name is fine.
  if (/\d+\.\d+/.test(server)) leaks.push(`Server: ${server}`)
  if (leaks.length) return warning(name, 'recommended', `Response leaks stack details — ${leaks.join('; ')}`)
  return passed(name, 'recommended', 'No stack or version details leaked in headers')
}

function gradeFor(failures: number, warnings: number): string {
  if (failures > 0) return failures >= 3 ? 'F' : 'D'
  if (warnings === 0) return 'A'
  return warnings <= 2 ? 'B' : 'C'
}

export async function scanSite(origin: string): Promise<SecurityReport> {
  const startedAt = performance.now()
  let headers = new Headers()
  let finalUrl = origin
  let https = origin.startsWith('https://')
  let reachable = true

  try {
    const response = await fetch(new URL('/', origin), {
      headers: { accept: 'text/html', 'user-agent': 'MULTINICHE-security-bot/1.0' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'follow',
    })
    headers = response.headers
    finalUrl = response.url || origin
    https = finalUrl.startsWith('https://')
    reachable = response.ok
  } catch (error) {
    console.error('security scan fetch failed:', error instanceof Error ? error.message : 'unknown error')
    reachable = false
  }

  const checks: SecurityCheck[] = reachable
    ? [
        checkTransport(headers, https),
        checkContentType(headers),
        checkFraming(headers),
        checkCsp(headers),
        checkReferrerPolicy(headers),
        checkPermissionsPolicy(headers),
        checkInfoLeak(headers),
      ]
    : [failed('Reachability', 'critical', 'Storefront did not return a successful response for the security scan')]

  const failures = checks.filter((check) => check.status === 'failed').length
  const warnings = checks.filter((check) => check.status === 'warning').length
  const passedCount = checks.filter((check) => check.status === 'passed').length
  const status: SecurityStatus = failures ? 'unhealthy' : warnings ? 'degraded' : 'healthy'
  const grade = gradeFor(failures, warnings)
  const issues = checks
    .filter((check) => check.status !== 'passed')
    .map((check) => `${check.name}: ${check.detail}`)
  const summary = failures
    ? `Security grade ${grade} — ${failures} critical gap${failures === 1 ? '' : 's'}`
    : warnings
      ? `Security grade ${grade} — ${warnings} hardening recommendation${warnings === 1 ? '' : 's'}`
      : `Security grade ${grade} — all ${checks.length} header checks passed`

  return {
    status,
    summary,
    checks,
    issues,
    metrics: { grade, passed: passedCount, warnings, failures, checked: checks.length, finalUrl, https },
    durationMs: elapsed(startedAt),
  }
}
