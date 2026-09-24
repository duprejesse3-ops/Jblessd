-- Updates MultiVault (AI-CN-008) from v3 to v3.1.
--
-- v3.1 adds optional hybrid semantic search (--semantic flag / semantic:
-- true over MCP): local BM25 keyword ranking PLUS a local embedding model
-- (Xenova/all-MiniLM-L6-v2, via @xenova/transformers), combined via
-- Reciprocal Rank Fusion. Still fully local — the model runs on-device,
-- nothing is sent anywhere — but this makes the v3 blurb's literal
-- "no embeddings" claim inaccurate, which is the main thing this migration
-- fixes. Everything from v3 (BM25 index, background watcher, MCP server,
-- MultiWitness tie-in) still works unchanged and remains the default;
-- semantic mode is additive and opt-in, with automatic fallback to
-- keyword-only ranking if the local model can't load.
--
-- Price left unchanged at $79 pending a pricing decision — this migration
-- only corrects the description for accuracy. Revisit price separately if
-- warranted.
UPDATE products
SET
  blurb = 'A local, encrypted context snapshot of a folder and calendar file — with a BM25-ranked search index (the same ranking approach real search engines use), and an optional local semantic-search mode for catching relevant content that shares no exact words with your query. Served automatically to Claude Desktop, Claude Code, and other MCP-aware AI tools, or pasted manually anywhere else. No account, no OAuth, no cloud storage — ranking runs entirely on-device, including the optional semantic model, so nothing is ever sent anywhere. Optional tie-in with MultiWitness logs every context-serving event to a tamper-evident hash chain — provably local, provably logged.',
  format = '.zip download · MCP server + CLI + hybrid search index · zero-dependency core (one optional local-model dependency for semantic mode) · perpetual license · optional standalone binary',
  spec = 'AES-256-GCM · BM25 + optional local semantic ranking (Reciprocal Rank Fusion) · incremental index · background watcher · MCP server (get_context, vault_status) · optional MultiWitness audit log'
WHERE sku = 'AI-CN-008';
