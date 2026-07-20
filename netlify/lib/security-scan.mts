// Inspects the live security posture of the deployed site: response security
// headers, HTTPS enforcement, and accidental exposure of sensitive files. This
// mirrors site-health.mts but focuses on hardening rather than availability, so
// the scheduled security bot and the /api/security-status endpoint share one
// source of truth for what "secure" means.

export type CheckStatus = 'passed' | 'warning' | 'failed'
export type SecurityStatus = 'secure' | 'warning' | 'critical'

export interface SecurityCheck {
  name: string
  status: CheckStatus
  detail: string
}

export interface SecurityReport {
  status: SecurityStatus
  summary: string
  checks: SecurityCheck[]
  durationMs: number
}

const REQUEST_TIMEOUT_MS = 5000

// Headers the site should return on every response. Each carries a short,
// owner-facing explanation of the risk it mitigates.
const REQUIRED_HEADERS: Array<{ header: string; name: string; missing: string }> = [
  {
    header: 'strict-transport-security',
    name: 'HSTS',
    missing: 'Strict-Transport-Security is missing; browsers may allow insecure HTTP downgrades',
  },
  {
    header: 'x-content-type-options',
    name: 'MIME sniffing protection',
    missing: 'X-Content-Type-Options is missing; browsers may misinterpret file types',
  },
  {
    header: 'x-frame-options',
    name: 'Clickjacking protection',
    missing: 'X-Frame-Options is missing; the site could be embedded in a malicious frame',
  },
  {
    header: 'referrer-policy',
    name: 'Referrer policy',
    missing: 'Referrer-Policy is missing; full URLs may leak to third-party sites',
  },
  {
    header: 'permissions-policy',
    name: 'Permissions policy',
    missing: 'Permissions-Policy is missing; powerful browser features are not restricted',
  },
]

// Paths that must never be publicly served. With publish = "." the whole repo
// root is deployed, so a stray env or config file could otherwise be readable.
const SENSITIVE_PATHS = ['/.env', '/.env.local', '/.git/config', '/package-lock.json']

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

async function fetchWithTimeout(url: URL, accept: string): Promise<Response> {
  return fetch(url, {
    headers: { accept, 'user-agent': 'MULTINICHE-security-bot/1.0' },
    redirect: 'manual',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

function checkTransport(origin: string): SecurityCheck {
  const name = 'HTTPS transport'
  const isHttps = origin.startsWith('https://')
  return isHttps
    ? { name, status: 'passed', detail: 'Site is served over HTTPS' }
    : { name, status: 'failed', detail: 'Site origin is not HTTPS; traffic can be intercepted' }
}

function checkHeaders(response: Response): SecurityCheck[] {
  return REQUIRED_HEADERS.map(({ header, name, missing }) => {
    const value = response.headers.get(header)
    return value
      ? { name, status: 'passed' as CheckStatus, detail: `Present: ${value.slice(0, 120)}` }
      : { name, status: 'warning' as CheckStatus, detail: missing }
  })
}

function checkDisclosure(response: Response): SecurityCheck {
  const name = 'Server disclosure'
  const powered = response.headers.get('x-powered-by')
  const server = response.headers.get('server')
  const leaks = [powered && `X-Powered-By: ${powered}`, server && `Server: ${server}`].filter(Boolean)
  return leaks.length
    ? { name, status: 'warning', detail: `Reveals stack details — ${leaks.join('; ')}` }
    : { name, status: 'passed', detail: 'No stack-identifying headers are exposed' }
}

async function checkSensitivePaths(origin: string): Promise<SecurityCheck> {
  const name = 'Sensitive file exposure'
  const exposed: string[] = []
  await Promise.all(
    SENSITIVE_PATHS.map(async (path) => {
      try {
        const response = await fetchWithTimeout(new URL(path, origin), '*/*')
        if (response.ok) exposed.push(path)
      } catch {
        // Network failures here are not evidence of exposure; ignore them.
      }
    }),
  )
  return exposed.length
    ? { name, status: 'failed', detail: `Publicly readable: ${exposed.join(', ')}` }
    : { name, status: 'passed', detail: 'No sensitive files are publicly readable' }
}

export async function scanSite(origin: string): Promise<SecurityReport> {
  const startedAt = performance.now()
  const checks: SecurityCheck[] = [checkTransport(origin)]

  try {
    const response = await fetchWithTimeout(new URL('/', origin), 'text/html')
    checks.push(...checkHeaders(response), checkDisclosure(response))
  } catch (error) {
    checks.push({
      name: 'Header scan',
      status: 'failed',
      detail: error instanceof Error ? error.message : 'Could not fetch the site to inspect headers',
    })
  }

  checks.push(await checkSensitivePaths(origin))

  const failures = checks.filter((check) => check.status === 'failed').length
  const warnings = checks.filter((check) => check.status === 'warning').length
  const status: SecurityStatus = failures ? 'critical' : warnings ? 'warning' : 'secure'
  const summary = failures
    ? `${failures} critical security issue${failures === 1 ? '' : 's'} found`
    : warnings
      ? `${warnings} security recommendation${warnings === 1 ? '' : 's'} to address`
      : `All ${checks.length} security checks passed`

  return { status, summary, checks, durationMs: elapsed(startedAt) }
}
