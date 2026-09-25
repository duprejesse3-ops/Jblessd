-- Adds File Organizer Agent (AI-AG-120) to the catalog. The package
-- (packages/file-organizer-agent/) was already built and embedded
-- (netlify/lib/file-organizer-source.mts) in an earlier session but never
-- wired into the catalog or product-archive — this migration is that last
-- step. Uses the existing 'agents' category and 'office' niche — no new
-- enum values needed.
--
-- Note: while wiring this up, lib/organize.mjs on disk was found to have
-- been overwritten with the bin/organize.mjs CLI content at some point
-- (the actual planFolder/applyPlan engine was missing, breaking the test
-- suite and the generated embed). Restored from the previously-generated
-- netlify/lib/file-organizer-source.mts and re-verified: `npm test` in
-- packages/file-organizer-agent now passes all 13 tests, and the embed was
-- regenerated from the fixed source.
--
-- Ships the same way as the other real-code automation products: a
-- runnable Node package the buyer downloads as a .zip. See
-- packages/file-organizer-agent/ and netlify/lib/product-archive.mts.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, time_saved) VALUES
  (
    'AI-AG-120',
    'File Organizer Agent',
    'agents',
    'office',
    '.zip · Node script, zero dependencies · cron/launchd/Task Scheduler adapters included · one-time license',
    19,
    'Points at any messy folder — Downloads, Desktop, a shared drive — and sorts it into categorized subfolders: Invoices & Receipts, Screenshots, Statements, Contracts, and more, by filename keyword plus extension. Every run is a dry-run plan by default; nothing moves on disk until you pass --apply. No account, no API key, and nothing phoning home unless you opt into the AI fallback for files the rules can''t place. Runs once from the terminal or on a schedule via the included cron, launchd, and Windows Task Scheduler adapters.',
    'Rule-based classification (extension + filename keywords) · optional --ai fallback via your own ANTHROPIC_API_KEY, filenames only, never contents · Node 18+, zero dependencies, no build step · cron.sh, launchd.plist, windows-task.ps1 adapters included',
    '~15 min saved per organizing pass'
  )
ON CONFLICT (sku) DO NOTHING;
