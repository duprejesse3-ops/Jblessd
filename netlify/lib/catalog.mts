// Shared catalog types + a canonical fallback catalog.
//
// The database is the source of truth (see netlify/database/migrations). This
// constant is only used when the DB is unreachable or has not been seeded yet
// (e.g. a brand-new preview branch), so the storefront and the AI concierge
// still have something meaningful to work with instead of an empty page.

export interface Product {
  sku: string
  name: string
  category: 'prompts' | 'automations' | 'templates' | 'agents'
  niche: 'founders' | 'sales' | 'marketers' | 'developers' | 'writers' | 'students'
  format: string
  price: number
  blurb: string
  spec: string
}

export const CATEGORY_LABEL: Record<Product['category'], string> = {
  prompts: 'Prompt Packs',
  automations: 'Automation Blueprints',
  templates: 'Doc Templates',
  agents: 'Agent Configs',
}

export const NICHE_LABEL: Record<Product['niche'], string> = {
  founders: 'Founders & Ops',
  sales: 'Sales & CS',
  marketers: 'Marketers',
  developers: 'Developers',
  writers: 'Writers',
  students: 'Students & Researchers',
}

export const FALLBACK_CATALOG: Product[] = [
  { sku: 'AI-PP-001', name: 'Deep Work Prompt Pack', category: 'prompts', niche: 'founders', format: '120 prompts · PDF + Notion', price: 19, blurb: 'Prompts for prioritization, focus blocks, and end-of-day resets.', spec: 'Works with Claude, ChatGPT, Gemini' },
  { sku: 'AI-AB-002', name: 'Inbox Zero Automation', category: 'automations', niche: 'sales', format: 'Make.com blueprint', price: 29, blurb: 'Auto-sorts, drafts replies, and flags what needs a human.', spec: 'Gmail + Outlook compatible' },
  { sku: 'AI-AG-003', name: 'Meeting Notes Agent', category: 'agents', niche: 'founders', format: 'System prompt + template', price: 15, blurb: 'Turns raw transcripts into decisions, owners, and deadlines.', spec: 'Tuned for Claude Projects' },
  { sku: 'AI-TP-004', name: 'Weekly Planning Template', category: 'templates', niche: 'students', format: 'Notion template', price: 12, blurb: 'A weekly operating rhythm: plan Monday, review Friday.', spec: 'Duplicate-and-go setup' },
  { sku: 'AI-AB-005', name: 'Content Calendar Autopilot', category: 'automations', niche: 'marketers', format: 'Zapier blueprint', price: 24, blurb: 'Drafts posts from your notes and queues them by channel.', spec: 'Buffer + Notion + Sheets' },
  { sku: 'AI-PP-006', name: 'Research Assistant Prompts', category: 'prompts', niche: 'students', format: '45 prompts · PDF', price: 22, blurb: 'Structured prompts for literature scans and source comparison.', spec: 'Citation-aware formatting' },
  { sku: 'AI-TP-007', name: 'Client Onboarding Kit', category: 'templates', niche: 'sales', format: 'Notion + email templates', price: 34, blurb: 'Intake form, welcome sequence, and kickoff checklist in one kit.', spec: 'Editable branding block' },
  { sku: 'AI-AG-008', name: 'Daily Standup Bot', category: 'agents', niche: 'developers', format: 'Slack agent config', price: 18, blurb: 'Collects async updates and posts a one-line team digest.', spec: 'Slack + Claude API' },
  { sku: 'AI-TP-009', name: 'OKR Tracker Template', category: 'templates', niche: 'founders', format: 'Sheets template', price: 14, blurb: 'Quarterly objectives with auto-calculated confidence scores.', spec: 'Google Sheets, no add-ons' },
  { sku: 'AI-AB-010', name: 'Personal CRM Automation', category: 'automations', niche: 'sales', format: 'Make.com blueprint', price: 25, blurb: 'Reminds you to follow up before a relationship goes cold.', spec: 'Contacts + Calendar sync' },
  { sku: 'AI-PP-011', name: 'Writing Style Prompt Kit', category: 'prompts', niche: 'writers', format: '30 prompts · PDF', price: 16, blurb: 'Locks tone and voice so drafts sound like you, not a template.', spec: 'Includes 3 worked examples' },
  { sku: 'AI-AG-012', name: 'Financial Categorizer Agent', category: 'agents', niche: 'founders', format: 'Sheets + agent config', price: 27, blurb: 'Reads bank exports and sorts spend into categories you define.', spec: 'CSV in, clean ledger out' },
  { sku: 'AI-AB-013', name: 'Code Review Digest', category: 'automations', niche: 'developers', format: 'GitHub Actions blueprint', price: 26, blurb: 'Summarizes open PRs into a daily digest with risk flags.', spec: 'GitHub + Slack webhook' },
  { sku: 'AI-PP-014', name: 'Landing Page Copy Prompts', category: 'prompts', niche: 'marketers', format: '35 prompts · PDF', price: 18, blurb: 'Headline, hero, and CTA variants tuned for conversion testing.', spec: 'A/B-ready output format' },
  { sku: 'AI-AG-015', name: 'Realtime Voice Agent Blueprint', category: 'agents', niche: 'founders', format: 'Twilio + Realtime API config', price: 49, blurb: 'A production-ready voice agent that answers calls, books meetings, and hands off to a human.', spec: 'Low-latency streaming, barge-in handling' },
  { sku: 'AI-AG-016', name: 'RAG Knowledge Base Agent', category: 'agents', niche: 'developers', format: 'Vector store + retrieval config', price: 44, blurb: 'Turns your docs into a grounded assistant that answers with citations, not guesses.', spec: 'Chunking, embeddings, and reranking presets' },
  { sku: 'AI-AG-017', name: 'Multi-Agent Research Swarm', category: 'agents', niche: 'students', format: 'Orchestrator + sub-agent prompts', price: 39, blurb: 'Dispatches parallel research agents, then merges their findings into one sourced brief.', spec: 'Fan-out / synthesize / verify pattern' },
  { sku: 'AI-AB-018', name: 'Support Triage Copilot', category: 'automations', niche: 'sales', format: 'Zendesk + Intercom blueprint', price: 42, blurb: 'Reads every inbound ticket, drafts a reply, and routes the hard ones to a human.', spec: 'Sentiment + priority scoring built in' },
  { sku: 'AI-PP-019', name: 'Image Prompt Studio', category: 'prompts', niche: 'marketers', format: '80 prompts · gpt-image-1 + Gemini', price: 28, blurb: 'Art-directed prompts for on-brand product shots, ads, and social visuals.', spec: 'Style, lighting, and aspect-ratio recipes' },
  { sku: 'AI-AG-020', name: 'Autonomous SEO Content Agent', category: 'agents', niche: 'marketers', format: 'Brief-to-draft agent config', price: 46, blurb: 'Researches keywords, drafts, and internally links a full article on a topic you name.', spec: 'Outline, draft, and on-page SEO passes' },
]
