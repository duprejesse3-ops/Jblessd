-- Adds Hey Term (AI-AG-130) to the catalog.
--
-- A real, downloadable Python desktop app (not a system prompt or a
-- blueprint): a voice-activated terminal. Say the wake word, say what you
-- want done, hear it read back, say "confirm" (or its translated
-- equivalent), and it runs the real command through actual bash on
-- Linux/macOS/WSL or actual PowerShell on Windows -- not whatever
-- Python's shell default happens to be. Speech-to-text runs fully
-- offline (faster-whisper); planning goes to Claude's API. Ships with
-- one-command setup scripts (install.sh / install.ps1) that install
-- system audio deps, best-effort voice packs, Python deps, and
-- pre-download the local Whisper model. See packages/hey-term/ and
-- netlify/lib/product-archive.mts.
--
-- Uses the existing 'agents' category and 'developers' niche -- no new
-- enum values needed. llm_compatibility is set to plain "Claude" (bring
-- your own ANTHROPIC_API_KEY), matching AI-AG-120's precedent: the
-- shipped code only calls Anthropic's Messages API directly, so claiming
-- ChatGPT/Gemini compatibility here would be a claim the code doesn't
-- back up.
--
-- Roll-forward only, idempotent via ON CONFLICT (sku) DO NOTHING.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec, llm_compatibility, meta_description) VALUES
  (
    'AI-AG-130',
    'Hey Term',
    'agents',
    'developers',
    '.zip · Python desktop app (mic + speech) + Claude API · one-time license',
    69,
    'Say "Hey Term," then say what you want done. It transcribes you offline, asks Claude to turn that into exact shell command(s) plus a one-sentence summary spoken back to you, and only runs anything after you confirm out loud -- a short list of genuinely destructive commands (wiping a disk, force-pushing over a branch, dropping a database) requires typing CONFIRM instead of just saying it. Runs real bash on Linux/macOS/WSL and real PowerShell on Windows, not a generic shell default. Works in 6 languages out of the box, and every wake, request, plan, confirmation, and run is appended to a plain-text audit log.',
    'Offline speech-to-text (faster-whisper, multilingual) · Claude-powered command planning · explicit bash/PowerShell invocation, not shell=True · spoken confirm required, typed CONFIRM for a dangerous-command blocklist · JSONL audit log · one-command setup scripts (install.sh / install.ps1) for system audio deps, best-effort voice packs, Python deps, and the Whisper model · 73 automated tests',
    'Claude (bring your own ANTHROPIC_API_KEY)',
    'A voice-activated terminal: say what you want, hear it read back, say confirm, and it runs real bash or PowerShell -- offline transcription, 6 languages.'
  )
ON CONFLICT (sku) DO NOTHING;
