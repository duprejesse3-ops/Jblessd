// Scheduled function: MultiAds guides generator.
//
// Netlify-native replacement for container/ads/content-generator.mjs +
// routes.mjs, which required the container to be running and a manual
// draft-review-publish workflow through /admin. This version runs on
// Netlify's own schedule, writes straight to `status = 'published'`, and is
// served by the pages edge function at /guides/:niche/:category — no admin
// step anywhere in the loop.
//
// Groups the live catalog by niche x category and asks Claude to write a
// real landing page (title, meta description, body) for each combination
// that has at least one product, grounded in the actual catalog entries so
// nothing is invented. Only regenerates a combo once it's stale, so this is
// safe and cheap to run weekly indefinitely.
//
// Env vars (all optional):
//   GUIDES_ENABLED     'false' to disable entirely (default: on)
//   GUIDES_STALE_DAYS  regenerate a guide after this many days (default: 30)
//   GUIDES_BATCH_SIZE  max guides generated per run, to bound API spend (default: 4)

import type { Config } from '@netlify/functions'
import { getDatabase } from '@netlify/database'
import Anthropic from '@anthropic-ai/sdk'
import { loadCatalog } from '../lib/db.mjs'
import { CATEGORY_LABEL, NICHE_LABEL, type Product } from '../lib/catalog.mjs'
import { submitUrls } from '../lib/indexnow.mjs'

const ENABLED = process.env.GUIDES_ENABLED !== 'false'
const STALE_DAYS = Number(process.env.GUIDES_STALE_DAYS || 30)
const BATCH_SIZE = Number(process.env.GUIDES_BATCH_SIZE || 4)
const MODEL = 'claude-sonnet-4-5'
const STORE_NAME = 'MULTINICHE AI'

interface Group {
  niche: string
  category: string
  slug: string
  products: Product[]
}

function groupCatalog(products: Product[]): Group[] {
  const map = new Map<string, Group>()
  for (const p of products) {
    const key = `${p.niche}/${p.category}`
    if (!map.has(key)) {
      map.set(key, { niche: p.niche, category: p.category, slug: key, products: [] })
    }
    map.get(key)!.products.push(p)
  }
  return [...map.values()]
}

async function getLastGeneratedDates(): Promise<Map<string, Date | null>> {
  const db = getDatabase()
  const rows = (await db.sql`SELECT slug, generated_at FROM seo_pages`) as any[]
  const map = new Map<string, Date | null>()
  for (const row of rows) {
    map.set(row.slug, row.generated_at ? new Date(row.generated_at) : null)
  }
  return map
}

function isStale(lastGenerated: Date | null | undefined): boolean {
  if (!lastGenerated) return true
  const ageDays = (Date.now() - lastGenerated.getTime()) / 86_400_000
  return ageDays >= STALE_DAYS
}

interface GuideContent {
  title: string
  metaDescription: string
  bodyHtml: string
}

async function generateGuideContent(group: Group): Promise<GuideContent> {
  const anthropic = new Anthropic()
  const nicheLabel = NICHE_LABEL[group.niche as Product['niche']] ?? group.niche
  const categoryLabel = CATEGORY_LABEL[group.category as Product['category']] ?? group.category

  const productList = group.products
    .map((p) => `- ${p.name} (${p.sku}, $${p.price}): ${p.blurb}`)
    .join('\n')

  const tool: Anthropic.Tool = {
    name: 'compose_guide',
    description: 'Compose an SEO landing page for a niche x category combination in an AI tools store.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: `SEO title, under 60 characters, naturally includes "${nicheLabel}" and "${categoryLabel}".` },
        metaDescription: { type: 'string', description: 'Under 155 characters, compelling, includes a concrete benefit.' },
        bodyHtml: {
          type: 'string',
          description:
            '350-550 words of HTML using only <h1>, <p>, and <ul>/<li> tags (no head/body wrapper, no inline styles, no classes). ' +
            `Speak directly to a ${nicheLabel} reader's real pain points, explain why ${categoryLabel} solves them, ` +
            'naturally reference the specific products by name, and end with a clear call to action linking to "/free-pack" ' +
            '(a free sample) using an <a href="/free-pack"> tag.',
        },
      },
      required: ['title', 'metaDescription', 'bodyHtml'],
    },
  }

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'compose_guide' },
    messages: [
      {
        role: 'user',
        content:
          `You are writing an SEO landing page for ${STORE_NAME}, a store selling AI tools organized by niche ` +
          `and category. Ground every claim in the real products listed below — do not invent features, prices, ` +
          `or capabilities. Confident and credible tone, written to convert, not to hype; avoid clichés like ` +
          `"game-changer", "unlock", "supercharge", "seamless", "revolutionize".\n\n` +
          `Niche: ${nicheLabel}\nCategory: ${categoryLabel}\n\nProducts in this combination:\n${productList}`,
      },
    ],
  })

  const block = message.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
  if (!block) throw new Error('Model did not return guide content')
  const out = block.input as Partial<GuideContent>
  if (!out.title || !out.metaDescription || !out.bodyHtml) {
    throw new Error('Model returned incomplete guide content')
  }
  return { title: out.title.trim(), metaDescription: out.metaDescription.trim(), bodyHtml: out.bodyHtml.trim() }
}

async function upsertGuide(group: Group, content: GuideContent): Promise<void> {
  const db = getDatabase()
  const skus = group.products.map((p) => p.sku)
  await db.sql`
    INSERT INTO seo_pages (slug, niche, category, title, meta_description, body_html, product_skus, status, generated_at, published_at)
    VALUES (${group.slug}, ${group.niche}, ${group.category}, ${content.title}, ${content.metaDescription}, ${content.bodyHtml}, ${skus}, 'published', now(), now())
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      meta_description = EXCLUDED.meta_description,
      body_html = EXCLUDED.body_html,
      product_skus = EXCLUDED.product_skus,
      generated_at = now(),
      published_at = COALESCE(seo_pages.published_at, now())
  `
}

export default async (req: Request) => {
  if (!ENABLED) {
    console.log('[guides-generator] disabled (GUIDES_ENABLED=false)')
    return Response.json({ generated: 0, attempted: 0, skipped: 'disabled' })
  }

  const { products } = await loadCatalog()
  const groups = groupCatalog(products)
  const lastGenerated = await getLastGeneratedDates()

  const due = groups.filter((g) => isStale(lastGenerated.get(g.slug))).slice(0, BATCH_SIZE)

  if (!due.length) {
    console.log('[guides-generator] no guides due — everything within the staleness window')
    return Response.json({ generated: 0, attempted: 0 })
  }

  console.log(`[guides-generator] generating ${due.length} guide(s): ${due.map((g) => g.slug).join(', ')}`)

  const origin = new URL(req.url).origin
  let generated = 0
  for (const group of due) {
    try {
      const content = await generateGuideContent(group)
      await upsertGuide(group, content)
      generated++
      console.log(`[guides-generator] published /guides/${group.slug} — "${content.title}"`)
      const guideUrl = `${origin}/guides/${group.slug}`
      try {
        const idxResult = await submitUrls([guideUrl])
        console.log(`[guides-generator] IndexNow submitted ${guideUrl} — HTTP ${idxResult.status}`)
      } catch (err) {
        // Non-fatal: the twice-daily indexnow-submit.mts sweep will pick this
        // URL up from the sitemap regardless, just up to 12h later.
        console.error(`[guides-generator] IndexNow submission failed for ${guideUrl}:`, (err as Error).message)
      }
    } catch (err) {
      console.error(`[guides-generator] failed to generate ${group.slug}:`, (err as Error).message)
    }
  }

  return Response.json({ generated, attempted: due.length })
}

export const config: Config = {
  // Weekly — the catalog changes slowly, and this is the most expensive job
  // in the growth stack (BATCH_SIZE x a model call each), so there's no
  // reason to run it more often than the container README always suggested.
  schedule: '@weekly',
}
