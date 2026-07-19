// Netlify Function: GET /api/analytics-config
// Returns the *public* Google tag identifiers the storefront needs to load
// gtag.js and report conversions. These IDs are not secrets — they are meant
// to ship in the page's HTML — but keeping them in environment variables means
// the same code deploys against test and live Google Ads accounts without an
// edit, and the storefront degrades to a no-op when they aren't set.
//
// Configure these in the Netlify UI (Site settings → Environment variables):
//   GA4_MEASUREMENT_ID        e.g. G-XXXXXXXXXX  (Google Analytics 4)
//   GOOGLE_ADS_ID             e.g. AW-123456789  (Google Ads account tag)
//   GOOGLE_ADS_PURCHASE_LABEL e.g. AbC-D1efGhIj  (the "Purchase" conversion action label)
//
// Reachable at /api/analytics-config via the /api/* rewrite in netlify.toml.

import type { Context } from '@netlify/functions'

export default async (_req: Request, _context: Context) => {
  const ga4Id = (process.env.GA4_MEASUREMENT_ID ?? '').trim()
  const adsId = (process.env.GOOGLE_ADS_ID ?? '').trim()
  const purchaseLabel = (process.env.GOOGLE_ADS_PURCHASE_LABEL ?? '').trim()

  return Response.json(
    {
      ga4Id,
      adsId,
      // The full send_to value Google Ads expects: "AW-123456789/abcdEF12".
      // Empty when either half is missing so the client can skip conversion
      // reporting cleanly.
      purchaseSendTo: adsId && purchaseLabel ? `${adsId}/${purchaseLabel}` : '',
      configured: Boolean(ga4Id || adsId),
    },
    {
      headers: {
        // Public, rarely-changing config. Cache at the edge but let a redeploy
        // (which flushes function output) pick up new env values quickly.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    },
  )
}
