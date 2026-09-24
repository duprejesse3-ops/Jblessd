// Live context for Local SEO Agency Blueprint (AI-AB-071) only — fetched
// fresh on each run, before the prompt is built, same pattern as
// odds-live-context.mts and multisignal-live-context.mts.
//
// Unlike those two, this does NOT depend on a third-party API whose shape
// might drift — it fetches the buyer's own page directly and parses the
// HTML with regex, the same dependency-free approach the rest of this file
// family uses. That makes it fully verifiable in this sandbox, not just
// "written from best knowledge" — confirmed against real live fetches
// before shipping (see the module's own test notes in the PR/patch that
// introduced it).
//
// Two things live here:
//   1. runSeoAudit() — fetches and parses the page, with retries and honest,
//      specific failure reasons (blocked vs down vs not-found vs timeout),
//      not a single generic "failed" message.
//   2. buildFixPack() — takes the real findings from #1 and DETERMINISTICALLY
//      generates ready-to-paste fixes (title, meta description, canonical
//      tag, LocalBusiness JSON-LD). No model call, no invention: every value
//      either comes from what was actually fetched, from a fact the buyer
//      typed into the form, or is an explicitly bracketed placeholder. This
//      is what turns the product from "here's what's wrong" into "here's
//      the fix, ready to paste" — the fix is code this function wrote, not
//      a plausible-sounding paragraph Claude improvised.
//
// Scope, stated plainly so the prompt that consumes this never overclaims:
// on-page signals only (title, meta description, canonical, headings,
// structured data, image alt coverage, robots.txt/sitemap reachability).
// Does NOT check Google Business Profile presence or scrape competitor
// listings — both require a paid Google Places/Maps API key this
// environment doesn't have configured.

const FETCH_TIMEOUT_MS = 6000
const RETRY_TIMEOUT_MS = 5000
const MAX_HTML_BYTES = 900_000 // enough for any normal page; caps a pathological response
const USER_AGENT = 'MultiNicheAI-SeoLiveContext/1.0 (+https://multinicheai.com)'

// ---- fetch layer: retries + honest, specific failure classification ----

type FetchOutcome =
  | { kind: 'ok'; res: Response }
  | { kind: 'blocked'; status: number } // 401/403/429/999 — reachable, refusing automated requests
  | { kind: 'not_found'; status: number } // 404/410
  | { kind: 'server_error'; status: number } // 5xx
  | { kind: 'other_status'; status: number }
  | { kind: 'network_error'; message: string } // DNS, connection refused, TLS, timeout

async function fetchOnce(url: string, ms: number): Promise<FetchOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    })
    if (res.ok) return { kind: 'ok', res }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999) {
      return { kind: 'blocked', status: res.status }
    }
    if (res.status === 404 || res.status === 410) return { kind: 'not_found', status: res.status }
    if (res.status >= 500) return { kind: 'server_error', status: res.status }
    return { kind: 'other_status', status: res.status }
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError' ? 'timed out' : (err as Error).message
    return { kind: 'network_error', message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetches with one retry, but ONLY on network_error (timeout, DNS, connection
 * reset) — a real HTTP response (even an error one) means the site is
 * reachable and answered, so retrying it changes nothing and just costs
 * time; only a genuinely transient failure is worth a second attempt.
 */
async function fetchWithRetry(url: string): Promise<FetchOutcome> {
  const first = await fetchOnce(url, FETCH_TIMEOUT_MS)
  if (first.kind !== 'network_error') return first
  return fetchOnce(url, RETRY_TIMEOUT_MS)
}

function describeFetchFailure(url: string, outcome: FetchOutcome): string {
  switch (outcome.kind) {
    case 'blocked':
      return `Live fetch of ${url} was refused (HTTP ${outcome.status}) — the site is up but is blocking automated requests. Say plainly that the scan was blocked, not that the page is broken or missing.`
    case 'not_found':
      return `Live fetch of ${url} returned HTTP ${outcome.status} (not found) — say plainly that this address doesn't resolve to a live page, and ask to confirm the URL rather than guessing at content.`
    case 'server_error':
      return `Live fetch of ${url} returned a server error (HTTP ${outcome.status}) — the site itself is failing to respond right now. Say that plainly rather than describing page content.`
    case 'other_status':
      return `Live fetch of ${url} returned HTTP ${outcome.status}, not a normal page load — say the scan couldn't complete rather than inventing what the page might contain.`
    case 'network_error':
      return `Live fetch of ${url} failed after a retry (${outcome.message}) — the site may be down, unreachable, or very slow. Say this plainly rather than inventing what the page might contain.`
    default:
      return `Live fetch of ${url} failed for an unrecognized reason — say the scan couldn't complete rather than inventing findings.`
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

export interface OnPageFindings {
  finalUrl: string
  origin: string
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

function parseOnPage(html: string, finalUrl: string, origin: string): OnPageFindings {
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
    origin,
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

export interface SeoAuditResult {
  ok: boolean
  findings?: OnPageFindings
  message: string // always present: formatted findings on success, an honest failure reason on failure
}

/**
 * Fetches and parses a real page for AI-AB-071. Returns the structured
 * findings (for buildFixPack to consume) alongside the same formatted text
 * block the prompt has always used. `rawInput` is whatever free text the
 * buyer typed (the demo scenario, or a form field) — a URL or bare domain
 * is pulled out of it.
 */
export async function runSeoAudit(rawInput: string): Promise<SeoAuditResult> {
  const url = extractUrl(rawInput)
  if (!url) {
    return {
      ok: false,
      message:
        'No URL or domain was found in what the buyer wrote — nothing to scan this run. Ask for one, or explain the blueprint conceptually against a hypothetical without inventing specific findings.',
    }
  }
  if (!isSafePublicUrl(url)) {
    return {
      ok: false,
      message: `"${url}" isn't a fetchable public address — nothing to scan this run. Explain the blueprint conceptually without inventing specific findings for that address.`,
    }
  }

  const outcome = await fetchWithRetry(url)
  if (outcome.kind !== 'ok') {
    return { ok: false, message: describeFetchFailure(url, outcome) }
  }

  try {
    const contentType = outcome.res.headers.get('content-type') ?? ''
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return {
        ok: false,
        message: `Fetched ${url} but it returned ${contentType || 'a non-HTML response'}, not a web page — say the address didn't resolve to a page rather than inventing on-page findings.`,
      }
    }

    const html = await outcome.res.text()
    const finalUrl = outcome.res.url || url
    let origin: string
    try {
      origin = new URL(finalUrl).origin
    } catch {
      origin = url
    }
    const findings = parseOnPage(html, finalUrl, origin)

    const robotsOutcome = await fetchWithRetry(`${origin}/robots.txt`)
    findings.robotsTxtReachable = robotsOutcome.kind === 'ok'
    if (robotsOutcome.kind === 'ok') {
      const robotsText = await robotsOutcome.res.text()
      findings.sitemapDeclared = /sitemap\s*:/i.test(robotsText)
    }

    return { ok: true, findings, message: formatFindings(findings) }
  } catch (err) {
    return {
      ok: false,
      message: `Fetched ${url} but couldn't parse the response (${(err as Error).message}) — say the fetch succeeded but parsing failed, rather than inventing findings.`,
    }
  }
}

/**
 * Back-compat wrapper: demo.mts and run-product.mts both just want the
 * formatted text block for the prompt's "Live scan" section. Kept as its
 * own export so neither caller needs to change when they don't also need
 * the fix pack.
 */
export async function fetchSeoLiveContext(rawInput: string): Promise<string> {
  const result = await runSeoAudit(rawInput)
  return result.message
}

// ---- deterministic fix generation: code, not commentary ----
//
// Every value below either (a) comes straight from what runSeoAudit actually
// fetched, (b) comes from a fact the buyer typed into the form, or (c) is an
// explicitly bracketed [ADD: ...] placeholder. Nothing here is a model
// guess — buildFixPack never calls Claude, so its output can't hallucinate.
// Claude's only job with this text is to present it and explain it, per the
// SKU_RUN_BRIEF rule added alongside this.

export interface FixPackInputs {
  businessName?: string
  targetCity?: string
  category?: string // e.g. "Plumbing", "Dental practice" — optional, sharpens title/meta/schema when given
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** True local-service identity: both a business name AND a city were given. Anything less and a LocalBusiness block would be fabricating identity, the exact mistake the earlier honest audit of multinicheai.com itself called out. */
function hasLocalIdentity(inputs: FixPackInputs): boolean {
  return Boolean(inputs.businessName?.trim() && inputs.targetCity?.trim())
}

function buildTitleFix(f: OnPageFindings, inputs: FixPackInputs): { needed: boolean; block: string } {
  const bad = !f.title || f.titleLength < 30 || f.titleLength > 60
  if (!bad) return { needed: false, block: '' }

  let suggested: string
  if (inputs.businessName) {
    const parts = [inputs.businessName, inputs.category, inputs.targetCity].filter(Boolean) as string[]
    suggested = parts.join(' | ')
    if (suggested.length > 60) suggested = truncateAtWord(suggested, 60)
  } else {
    suggested = '[ADD: Business Name] | [ADD: what you do] | [ADD: city]'
  }

  return {
    needed: true,
    block:
      `<title>${escapeHtmlAttr(suggested)}</title>\n` +
      `  (replaces: ${f.title ? `"${f.title}" — ${f.titleLength} chars, ${f.titleLength < 30 ? 'too short' : 'too long'} for a good search snippet` : 'no title tag at all'})`,
  }
}

function buildMetaDescriptionFix(f: OnPageFindings, inputs: FixPackInputs): { needed: boolean; block: string } {
  const bad = !f.metaDescription || f.metaDescriptionLength < 70 || f.metaDescriptionLength > 160
  if (!bad) return { needed: false, block: '' }

  let suggested: string
  if (inputs.businessName) {
    const where = inputs.targetCity ? ` in ${inputs.targetCity}` : ''
    const what = inputs.category ? inputs.category.toLowerCase() : 'services'
    suggested = `${inputs.businessName} provides ${what}${where}. Get in touch today to see how we can help.`
  } else {
    suggested = '[ADD: one or two sentences on what this business does, who it serves, and a light call to action — aim for 140–160 characters]'
  }
  suggested = truncateAtWord(suggested, 160)

  return {
    needed: true,
    block:
      `<meta name="description" content="${escapeHtmlAttr(suggested)}">\n` +
      `  (replaces: ${f.metaDescription ? `present but ${f.metaDescriptionLength} chars — ${f.metaDescriptionLength < 70 ? 'too short to be useful in search results' : 'too long, Google will truncate it'}` : 'no meta description at all'})`,
  }
}

function buildCanonicalFix(f: OnPageFindings): { needed: boolean; block: string } {
  if (f.canonical) return { needed: false, block: '' }
  return { needed: true, block: `<link rel="canonical" href="${escapeHtmlAttr(f.finalUrl)}">` }
}

function buildLocalBusinessSchemaFix(f: OnPageFindings, inputs: FixPackInputs): { needed: boolean; skippedReason?: string; block: string } {
  const alreadyLocal = f.jsonLdTypes.some((t) => /LocalBusiness|^(Plumber|Dentist|Restaurant|Store|.*Business)$/i.test(t))
  if (alreadyLocal) {
    return { needed: false, block: '', skippedReason: `LocalBusiness-type schema already present (${f.jsonLdTypes.filter((t) => /LocalBusiness|Business/i.test(t)).join(', ')}) — no fix needed here.` }
  }
  if (!hasLocalIdentity(inputs)) {
    return {
      needed: false,
      block: '',
      skippedReason:
        'No LocalBusiness schema suggested this run: doing that honestly requires a real business name and city, and neither (or only one) was given. Generating one anyway would mean inventing a business identity — exactly the mistake this tool is built to avoid. Fill in both fields and re-run to get a real one.',
    }
  }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: inputs.businessName,
    url: f.finalUrl,
    address: {
      '@type': 'PostalAddress',
      addressLocality: inputs.targetCity,
      streetAddress: '[ADD: street address]',
      postalCode: '[ADD: postal code]',
      addressCountry: '[ADD: 2-letter country code, e.g. US]',
    },
  }
  if (inputs.category) schema.description = `${inputs.businessName} — ${inputs.category} in ${inputs.targetCity}.`

  return {
    needed: true,
    block:
      `<script type="application/ld+json">\n` +
      JSON.stringify(schema, null, 2) +
      `\n</script>\n` +
      `  (name, url, and city are real — from what you entered and what was fetched; street address, postal code, and country are placeholders because this scan has no way to know them — fill those in before publishing)`,
  }
}

function buildSitemapFix(f: OnPageFindings): { needed: boolean; block: string } {
  if (f.sitemapDeclared) return { needed: false, block: '' }
  if (!f.robotsTxtReachable) {
    return { needed: false, block: '' } // can't suggest a robots.txt edit for a robots.txt that wasn't reachable to begin with
  }
  return {
    needed: true,
    block: `Sitemap: ${f.origin}/sitemap.xml\n  (add this line to robots.txt — confirm the path actually matches where your sitemap lives; this is the standard location, not a guess it was found at)`,
  }
}

/**
 * Builds the ready-to-paste fix pack from real findings + whatever the buyer
 * told the form. Every section says explicitly whether it's needed, and
 * every generated value is either real or a bracketed placeholder — never a
 * plausible invention. Returns '' (nothing to show) only when every check
 * already passed, which itself is a useful, honest result.
 */
export function buildFixPack(findings: OnPageFindings, inputs: FixPackInputs = {}): string {
  const title = buildTitleFix(findings, inputs)
  const meta = buildMetaDescriptionFix(findings, inputs)
  const canonical = buildCanonicalFix(findings)
  const schema = buildLocalBusinessSchemaFix(findings, inputs)
  const sitemap = buildSitemapFix(findings)

  const sections: string[] = []
  if (title.needed) sections.push(`TITLE TAG (paste in <head>, replacing the existing one):\n${title.block}`)
  if (meta.needed) sections.push(`META DESCRIPTION (paste in <head>, replacing the existing one if any):\n${meta.block}`)
  if (canonical.needed) sections.push(`CANONICAL TAG (paste in <head>):\n${canonical.block}`)
  if (schema.needed) sections.push(`LOCALBUSINESS STRUCTURED DATA (paste in <head>):\n${schema.block}`)
  if (sitemap.needed) sections.push(`ROBOTS.TXT ADDITION:\n${sitemap.block}`)

  const skippedNotes: string[] = []
  if (schema.skippedReason) skippedNotes.push(schema.skippedReason)
  if (findings.imagesMissingAlt > 0) {
    skippedNotes.push(
      `${findings.imagesMissingAlt} of ${findings.imagesTotal} images are missing alt text — not auto-fixed, because writing real alt text requires actually seeing each image, which this scan doesn't do. Describe the images and a person (or a vision-capable pass) can write these; a generic placeholder alt text would be worse than none.`,
    )
  }

  if (!sections.length) {
    return (
      'FIX PACK: every on-page check above already passes — title, meta description, and canonical tag are all in good shape, so there is nothing to generate here this run.' +
      (skippedNotes.length ? '\n\n' + skippedNotes.join('\n') : '')
    )
  }

  return (
    `FIX PACK — generated deterministically from the live scan above, not written by a model. Every value is either real (fetched, or what you entered) or an explicit [ADD: ...] placeholder; nothing here is invented:\n\n` +
    sections.join('\n\n') +
    (skippedNotes.length ? '\n\n' + skippedNotes.join('\n') : '')
  )
}
