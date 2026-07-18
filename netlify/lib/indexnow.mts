// IndexNow — push our URLs straight to Bing (and other IndexNow engines) instead
// of waiting for them to be discovered by crawling.
//
// A recurring complaint has been "Bing can't index" the storefront. All of the
// on-page signals are already correct — robots.txt allows Bingbot, /sitemap.xml
// lists every page, the verification file is served, and each page ships a
// title, canonical, and `index, follow`. What was missing is the active step:
// telling Bing which URLs exist so it crawls them promptly. IndexNow is Bing's
// official protocol for exactly that.
//
// Ownership is proven by hosting a key file at the site root. The key below MUST
// stay identical to the filename served at /<key>.txt — if they drift, Bing
// rejects every submission.

const INDEXNOW_KEY = 'b7e14a9c8f2d40559a1e6c3b0d84f7a2'

// The canonical host every submitted URL must belong to. IndexNow refuses a
// batch that mixes hosts or whose host doesn't match the key file's location.
const SITE_HOST = 'jblessd.com'
const KEY_LOCATION = `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`

// api.indexnow.org fans a single submission out to every participating engine
// (Bing, Yandex, Seznam…), so we don't have to ping each one.
const ENDPOINT = 'https://api.indexnow.org/indexnow'

const FETCH_TIMEOUT_MS = 5000
const SUBMIT_TIMEOUT_MS = 8000

export interface SubmitResult {
  submitted: number
  status: number
}

// Read every <loc> out of the live sitemap, keeping only URLs on our canonical
// host (the sitemap always emits jblessd.com URLs, so this holds regardless of
// which origin the function itself runs on).
export async function sitemapUrls(origin: string): Promise<string[]> {
  const res = await fetch(new URL('/sitemap.xml', origin), {
    headers: { accept: 'application/xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`sitemap fetch failed: HTTP ${res.status}`)
  const xml = await res.text()

  const urls = new Set<string>()
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) {
    try {
      const u = new URL(match[1])
      if (u.host === SITE_HOST) urls.add(u.href)
    } catch {
      /* ignore malformed <loc> */
    }
  }
  return [...urls]
}

// Submit a batch of URLs in one request. IndexNow accepts up to 10,000 per call;
// our sitemap is far smaller, so a single call always suffices. A 200/202 means
// the batch was accepted (engines crawl on their own schedule afterwards).
export async function submitUrls(urlList: string[]): Promise<SubmitResult> {
  if (!urlList.length) return { submitted: 0, status: 0 }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: SITE_HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList }),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  })
  // Drain the body so the connection can be reused; the response text is empty
  // on success and only carries a reason on 4xx.
  await res.text().catch(() => '')
  return { submitted: urlList.length, status: res.status }
}
