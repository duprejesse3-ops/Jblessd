// MultiAds content generator
//
// Pulls real products from the catalog Postgres DB (same DB the storefront
// uses), groups them by niche x category, and generates an SEO landing page
// per combo via Claude. Pages are written to seo_pages so a route (see
// routes.mjs) can serve them and content_conversions can attribute sales
// back to a specific page later.
//
// Run manually:
//   node container/ads/content-generator.mjs
// Or wire into the existing scheduler (same pattern as ENABLE_SCHEDULER
// elsewhere in container/) to refresh weekly as the catalog changes.

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NICHE_LABELS = {
  founders: "Founders",
  sales: "Sales Teams",
  marketers: "Marketers",
  developers: "Developers",
  writers: "Writers",
  students: "Students",
  office: "Office Teams",
  finance: "Finance Teams",
  architects: "Architects",
  engineers: "Engineers",
  stores: "Store Owners",
};

const CATEGORY_LABELS = {
  prompts: "Prompt Packs",
  automations: "Automation Blueprints",
  templates: "Doc Templates",
  agents: "Agent Configs",
};

async function getNicheCategoryGroups() {
  const { rows } = await pool.query(`
    SELECT niche, category, json_agg(json_build_object(
      'sku', sku, 'name', name, 'format', format,
      'spec', spec, 'price', price, 'blurb', blurb
    )) AS products
    FROM products
    WHERE niche IS NOT NULL AND category IS NOT NULL
    GROUP BY niche, category
    HAVING count(*) >= 1
  `);
  return rows;
}

function buildPrompt({ niche, category, products }) {
  const nicheLabel = NICHE_LABELS[niche] || niche;
  const categoryLabel = CATEGORY_LABELS[category] || category;

  const productList = products
    .map((p) => `- ${p.name} (${p.sku}, $${p.price}): ${p.blurb}`)
    .join("\n");

  return `You are writing an SEO landing page for jblessd.com, a store selling AI tools organized by niche and category.

Niche: ${nicheLabel}
Category: ${categoryLabel}

Products in this combination:
${productList}

Write landing page content as JSON with exactly these fields:
{
  "title": "SEO title, under 60 chars, includes '${nicheLabel}' and '${categoryLabel}' naturally",
  "meta_description": "under 155 chars, compelling, includes a concrete benefit",
  "body_html": "300-500 words of HTML (h1, p, ul tags only, no head/body wrapper). Speak directly to a ${nicheLabel} reader's real pain points, explain why ${categoryLabel} solves them, naturally reference the specific products above by name, and end with a clear call to action pointing to '/free-pack' for a free sample before buying."
}

Return ONLY the JSON object, no markdown fences, no preamble.`;
}

async function generatePageContent(group) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: buildPrompt(group) }],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Failed to parse content for ${group.niche}/${group.category}: ${err.message}\nRaw: ${text.slice(0, 200)}`
    );
  }
}

async function upsertPage(group, content) {
  const slug = `guides/${group.niche}/${group.category}`;
  const skus = group.products.map((p) => p.sku);

  await pool.query(
    `INSERT INTO seo_pages (slug, niche, category, title, meta_description, body_html, product_skus, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       meta_description = EXCLUDED.meta_description,
       body_html = EXCLUDED.body_html,
       product_skus = EXCLUDED.product_skus,
       generated_at = now()`,
    [slug, group.niche, group.category, content.title, content.meta_description, content.body_html, skus]
  );

  return slug;
}

export async function generateAllPages({ dryRun = false } = {}) {
  const groups = await getNicheCategoryGroups();
  console.log(`Found ${groups.length} niche x category combinations.`);

  const results = [];
  for (const group of groups) {
    try {
      const content = await generatePageContent(group);
      if (dryRun) {
        console.log(`[dry-run] ${group.niche}/${group.category}:`, content.title);
        results.push({ slug: `guides/${group.niche}/${group.category}`, status: "dry-run" });
        continue;
      }
      const slug = await upsertPage(group, content);
      console.log(`Generated: /${slug} — "${content.title}"`);
      results.push({ slug, status: "ok" });
    } catch (err) {
      console.error(`Skipped ${group.niche}/${group.category}:`, err.message);
      results.push({ slug: `${group.niche}/${group.category}`, status: "error", error: err.message });
    }
  }
  return results;
}

// Allow running directly: node container/ads/content-generator.mjs [--dry-run]
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  generateAllPages({ dryRun })
    .then((results) => {
      const ok = results.filter((r) => r.status === "ok").length;
      console.log(`\nDone. ${ok}/${results.length} pages generated.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    });
}
