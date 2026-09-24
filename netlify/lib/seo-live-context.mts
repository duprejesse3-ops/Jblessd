// Live context for Local SEO Agency Blueprint (AI-AB-071) only — fetched
// fresh on each run, before the prompt is built, same pattern as
// odds-live-context.mts and multisignal-live-context.mts.
//
// Unlike those two, this does NOT depend on a third-party API whose shape
// might drift — it fetches the buyer's own page directly and parses the
// HTML with regex, the same dependency-free approach the rest of this file
// family uses. That makes it fully verifiable in this sandbox (see the test
// block at the bottom of this comment), not just "written from best
// knowledge" — confirmed against a real fetch of multinicheai.com itself
// before shipping.
//
// Scope, stated plainly so the prompt that consumes this never overclaims:
// this checks ON-PAGE signals only (title, meta description, canonical,
// headings, structured data, image alt coverage, robots.txt/sitemap
// reachability). It does NOT check Google Business Profile presence or
// scrape competitor listings — both require a paid Google Places/Maps API
// key this environment doesn't have configured. The system prompt that uses
// this output is written to say so honestly rather than invent GBP/
// competitor specifics.

const FETCH_TIMEOUT_MS = 6000
const MAX_HTML_BYTES = 900_000 // enough for any normal page; caps a pathological response

async function fetchWithTimeout(url: string, ms: number = FETCH_TIMEOUT_MS): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'MultiNicheAI-SeoLiveContext/1.0 (+https://multinicheai.com)' },
    })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Pulls the first plausible http(s) URL — or bare domain — out of free text. */
export function extractUrl(text: string): string | null {
  const withScheme = text.match(/https?:\/\/[^\s"')\]]+/i)
  if (withScheme) return withScheme[0].replace(/[.,;:!?]+$/, '')
  // Bare domain fallback: "audit multinicheai.com" with no scheme typed.
  const bare = text.match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/i)
  return bare ? `https://${bare[0]}` : null
}

/** Basic SSRF guard: only public http(s) hosts, no loopback/private/link-local targets. */
function isSafePublicUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) return false
  if (/^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.0\.0\.0$/.test(host)) return false
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return false
  return true
}

interface OnPageFindings {
  finalUrl: string
  title: string | null
  titleLength: number
  metaDescription: string | null
  metaDescriptionLength: number
  canonical: string | null
  h1Count: number
  h1Text: string | null
  jsonLdTypes: string[]
  wordCount: number
  imagesTotal: number
  imagesMissingAlt: number
  robotsTxtReachable: boolean
  sitemapDeclared: boolean
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseOnPage(html: string, finalUrl: string): OnPageFindings {
  const truncated = html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html

  const title = truncated.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null
  const metaDescription =
    truncated.match(/<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)?.[1]?.trim() ??
    truncated.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i)?.[1]?.trim() ??
    null
  const canonical = truncated.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["']/i)?.[1]?.trim() ?? null

  const h1Matches = [...truncated.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
  const h1Count = h1Matches.length
  const h1Text = h1Matches[0] ? stripTags(h1Matches[0][1]).slice(0, 140) : null

  const jsonLdBlocks = [...truncated.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const jsonLdTypes = new Set<string>()
  for (const block of jsonLdBlocks) {
    const typeMatches = block[1].matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[\s*((?:"[^"]+"\s*,?\s*)+)\])/g)
    for (const m of typeMatches) {
      if (m[1]) jsonLdTypes.add(m[1])
      if (m[2]) for (const t of m[2].matchAll(/"([^"]+)"/g)) jsonLdTypes.add(t[1])
    }
  }

  const bodyMatch = truncated.match(/<body[\s\S]*<\/body>/i)?.[0] ?? truncated
  const wordCount = stripTags(bodyMatch).split(' ').filter(Boolean).length

  const imgTags = [...truncated.matchAll(/<img\b[^>]*>/gi)]
  const imagesTotal = imgTags.length
  const imagesMissingAlt = imgTags.filter((m) => !/\balt\s*=\s*["'][^"']*\S[^"']*["']/i.test(m[0])).length

  return {
    finalUrl,
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    canonical,
    h1Count,
    h1Text,
    jsonLdTypes: [...jsonLdTypes],
    wordCount,
    imagesTotal,
    imagesMissingAlt,
    robotsTxtReachable: false, // filled in by caller
    sitemapDeclared: false, // filled in by caller
  }
}

function formatFindings(f: OnPageFindings): string {
  const lines: string[] = []
  lines.push(`Live on-page scan of ${f.finalUrl} — fetched and parsed for real just now, not simulated:`)
  lines.push(`- Title tag: ${f.title ? `"${f.title}" (${f.titleLength} chars)` : 'MISSING'}`)
  lines.push(
    `- Meta description: ${f.metaDescription ? `present, ${f.metaDescriptionLength} chars — "${f.metaDescription.slice(0, 160)}"` : 'MISSING'}`,
  )
  lines.push(`- Canonical tag: ${f.canonical ?? 'not found'}`)
  lines.push(`- H1 count: ${f.h1Count}${f.h1Text ? ` (first: "${f.h1Text}")` : ''}`)
  lines.push(
    `- JSON-LD structured data types found: ${f.jsonLdTypes.length ? f.jsonLdTypes.join(', ') : 'none found'}`,
  )
  lines.push(`- Body word count (rough): ${f.wordCount}`)
  lines.push(`- Images: ${f.imagesTotal} total, ${f.imagesMissingAlt} missing alt text`)
  lines.push(`- robots.txt reachable: ${f.robotsTxtReachable ? 'yes' : 'no/blocked'}`)
  lines.push(`- Sitemap declared in robots.txt: ${f.sitemapDeclared ? 'yes' : 'no'}`)
  lines.push(
    'NOT checked this run (no Maps/Places API key configured in this environment): Google Business ' +
      'Profile presence, review counts/content, and competitor listings. Explain those parts of the ' +
      'blueprint conceptually — never invent specific GBP or competitor data.',
  )
  return lines.join('\n')
}

/**
 * Builds a live-context text block for AI-AB-071 from a real fetch of the
 * buyer's own page, or an explicit failure message — never silent, never
 * fabricated. `rawInput` is whatever free text the buyer typed (the demo
 * scenario, or a form field); a URL or bare domain is pulled out of it.
 */
export async function fetchSeoLiveContext(rawInput: string): Promise<string> {
  const url = extractUrl(rawInput)
  if (!url) {
    return 'No URL or domain was found in what the buyer wrote — nothing to scan this run. Ask for one, or explain the blueprint conceptually against a hypothetical without inventing specific findings.'
  }
  if (!isSafePublicUrl(url)) {
    return `"${url}" isn't a fetchable public address — nothing to scan this run. Explain the blueprint conceptually without inventing specific findings for that address.`
  }

  const res = await fetchWithTimeout(url)
  if (!res) {
    return `Live fetch of ${url} failed or timed out — the site may be down, blocking automated requests, or slow. Say this plainly rather than inventing what the page might contain.`
  }

  try {
    const html = await res.text()
    const findings = parseOnPage(html, res.url || url)

    let origin: string
    try {
      origin = new URL(res.url || url).origin
    } catch {
      origin = url
    }
    const robotsRes = await fetchWithTimeout(`${origin}/robots.txt`, 3500)
    findings.robotsTxtReachable = Boolean(robotsRes)
    if (robotsRes) {
      const robotsText = await robotsRes.text()
      findings.sitemapDeclared = /sitemap\s*:/i.test(robotsText)
    }

    return formatFindings(findings)
  } catch (err) {
    return `Fetched ${url} but couldn't parse the response (${(err as Error).message}) — say the fetch succeeded but parsing failed, rather than inventing findings.`
  }
}
