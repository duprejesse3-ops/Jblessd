import type { Config } from '@netlify/functions'
import { loadCatalog } from '../lib/db.mjs'

const SITE = 'https://jblessd.com'

function xml(value: unknown): string {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character]!)
}

export default async () => {
  const { products } = await loadCatalog()
  const returnLabel = (process.env.GOOGLE_MERCHANT_RETURN_POLICY_LABEL || '').trim()
  const items = products.map((product) => `
    <item>
      <g:id>${xml(product.sku)}</g:id>
      <title>${xml(product.name)}</title>
      <description>${xml(product.blurb)}</description>
      <link>${SITE}/product/${encodeURIComponent(product.sku)}</link>
      <g:image_link>${SITE}/multiniche-ai-og.png</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:price>${Number(product.price).toFixed(2)} USD</g:price>
      <g:brand>MULTINICHE AI</g:brand>
      <g:mpn>${xml(product.sku)}</g:mpn>
      <g:google_product_category>Software</g:google_product_category>
      <g:product_type>${xml(`${product.niche} > ${product.category}`)}</g:product_type>
      <g:shipping><g:country>US</g:country><g:service>Digital delivery</g:service><g:price>0.00 USD</g:price></g:shipping>${returnLabel ? `
      <g:return_policy_label>${xml(returnLabel)}</g:return_policy_label>` : ''}
    </item>`).join('')

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>MULTINICHE AI product feed</title>
    <link>${SITE}</link>
    <description>Ready-to-use AI prompt packs, automations, templates, and agent configurations.</description>${items}
  </channel>
</rss>`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      // Google Merchant Center re-fetches the feed on a schedule; it is
      // catalog-derived, so it is served from the durable cache under the shared
      // 'catalog' purge tag.
      'Netlify-CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400, durable',
      'Cache-Tag': 'catalog',
    },
  })
}

export const config: Config = { path: '/merchant-center.xml' }
