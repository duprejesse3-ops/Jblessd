-- Updates MultiVault (AI-CN-008) from v2 to v3.
--
-- v3 adds a local BM25-ranked search index (lib/bm25.mjs, lib/indexer.mjs)
-- and a background file watcher (lib/watcher.mjs), so large folders return
-- only relevant content instead of everything — v1/v2's live re-scan-on-
-- every-call approach didn't scale past a few dozen files. Everything from
-- v2 (MCP server, MultiWitness tie-in, encrypted CLI mode) still works
-- unchanged; v3 is additive, not a rewrite.
--
-- Price raised from $69 to $79, matching the store's existing top tier
-- (MultiConnect: Email/CRM). This reflects the real jump in engineering —
-- a working local search/ranking engine with incremental indexing, not a
-- config change — not an arbitrary increase. Worth a second look if you
-- want it priced differently; this is a reasonable default, not a fixed
-- number.
--
-- Uses UPDATE, not INSERT ... ON CONFLICT DO NOTHING, since the row already
-- exists live — see the v1->v2 migration for the same reasoning.
UPDATE products
SET
  price = 79,
  blurb = 'A local, encrypted context snapshot of a folder and calendar file — with a BM25-ranked search index (the same ranking approach real search engines use) so large folders return only what''s relevant instead of everything. Served automatically to Claude Desktop, Claude Code, and other MCP-aware AI tools, or pasted manually anywhere else. No account, no OAuth, no cloud storage, no embeddings, no AI model involved in ranking — it all runs locally, in this process. Optional tie-in with MultiWitness logs every context-serving event to a tamper-evident hash chain — provably local, provably logged.',
  format = '.zip download · MCP server + CLI + search index · zero-dependency core · perpetual license · optional standalone binary',
  spec = 'AES-256-GCM · BM25 ranking · incremental index · background watcher · MCP server (get_context, vault_status) · optional MultiWitness audit log'
WHERE sku = 'AI-CN-008';
