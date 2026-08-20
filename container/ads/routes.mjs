// MultiAds routes — serves generated SEO pages and records simple attribution.
// Wire into the existing container router the same way other /api routes are mounted.

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /guides/:niche/:category — public landing page
export async function servePage(req, res) {
  const { niche, category } = req.params;
  const slug = `guides/${niche}/${category}`;

  const { rows } = await pool.query(
    `SELECT * FROM seo_pages WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
  if (!rows.length) return res.status(404).send("Not found");

  const page = rows[0];

  // Record the view for attribution (fire-and-forget)
  pool
    .query(
      `INSERT INTO content_conversions (slug, session_id, event_type) VALUES ($1, $2, 'view')`,
      [slug, req.query.sid || null]
    )
    .catch((err) => console.error("view tracking failed:", err.message));

  res.setHeader("Content-Type", "text/html");
  res.send(`<!doctype html>
<html><head>
  <title>${page.title}</title>
  <meta name="description" content="${page.meta_description}">
</head><body>
  ${page.body_html}
</body></html>`);
}

// POST /api/ads/pages/:slug/publish — flip a reviewed draft live
export async function publishPage(req, res) {
  const slug = req.params.slug;
  const { rows } = await pool.query(
    `UPDATE seo_pages SET status = 'published', published_at = now()
     WHERE slug = $1 RETURNING slug`,
    [slug]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  res.json({ published: rows[0].slug });
}

// GET /api/ads/pages — list all generated pages for review before publishing
export async function listPages(req, res) {
  const { rows } = await pool.query(
    `SELECT slug, niche, category, title, status, generated_at, published_at
     FROM seo_pages ORDER BY generated_at DESC`
  );
  res.json(rows);
}

// GET /api/ads/report — which pages are actually converting
export async function conversionReport(req, res) {
  const { rows } = await pool.query(`
    SELECT sp.slug, sp.title,
      count(*) FILTER (WHERE cc.event_type = 'view') AS views,
      count(*) FILTER (WHERE cc.event_type = 'free_pack_claim') AS free_pack_claims,
      count(*) FILTER (WHERE cc.event_type = 'order') AS orders
    FROM seo_pages sp
    LEFT JOIN content_conversions cc ON cc.slug = sp.slug
    GROUP BY sp.slug, sp.title
    ORDER BY orders DESC, views DESC
  `);
  res.json(rows);
}
