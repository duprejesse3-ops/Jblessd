-- Updates MultiVault (AI-CN-008) from its v1 listing to v2.
--
-- v1 shipped as a manual CLI: sync, then context, then paste. v2 adds an
-- MCP server (get_context / vault_status) so Claude Desktop, Claude Code,
-- and other MCP-aware clients pull in current folder/calendar context on
-- their own — no copy-paste — plus an optional tie-in with MultiWitness
-- (AI-CN-007) that logs every context-serving event to its tamper-evident
-- hash chain, content-free (counts only, never file/calendar contents).
--
-- The listing is updated in place (not a new SKU) since it's the same
-- product, same price point, same underlying vault — v2 is additive
-- (CLI mode still works exactly as before), not a breaking change.
--
-- Price unchanged at $69 — same tier as MultiWitness, still fair for what's
-- now meaningfully more capability than the v1 listing described.
--
-- Uses UPDATE, not INSERT ... ON CONFLICT DO NOTHING, because the v1 row
-- already exists live — an ON CONFLICT insert would silently no-op here.
UPDATE products
SET
  blurb = 'A local, encrypted context snapshot of one folder and one calendar file — served automatically to Claude Desktop, Claude Code, and other MCP-aware AI tools via a built-in MCP server, or pasted manually anywhere else. No account, no OAuth, no cloud storage: only your passphrase opens the vault, and MCP mode never makes a network call to serve context. Optional tie-in with MultiWitness logs every context-serving event to a tamper-evident hash chain — provably local, provably logged.',
  format = '.zip download · MCP server + CLI · zero-dependency core · perpetual license · optional standalone binary',
  spec = 'AES-256-GCM · scrypt-derived key · MCP server (get_context, vault_status) · optional MultiWitness audit log'
WHERE sku = 'AI-CN-008';
