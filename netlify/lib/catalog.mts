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
  niche: 'founders' | 'sales' | 'marketers' | 'developers' | 'writers' | 'students' | 'architects' | 'engineers' | 'office'
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
  architects: 'Architects',
  engineers: 'Engineers',
  office: 'Office & Admin',
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
  { sku: 'AI-PP-021', name: 'Prompt Debugging Playbook', category: 'prompts', niche: 'developers', format: '40 prompts + failure taxonomy · PDF', price: 21, blurb: 'Diagnose and repair prompts that drift, hallucinate, or quietly ignore your instructions.', spec: 'Before/after templates for Claude & GPT' },
  { sku: 'AI-AG-022', name: 'Inbox Negotiator Agent', category: 'agents', niche: 'sales', format: 'Agent config + guardrails', price: 38, blurb: 'Handles the back-and-forth on pricing and scheduling, then hands off the moment a human is needed.', spec: 'Escalation rules + tone controls' },
  { sku: 'AI-TP-023', name: 'AI Product Spec Template', category: 'templates', niche: 'founders', format: 'Notion + Markdown template', price: 17, blurb: 'Turn a rough idea into a build-ready spec your team and your coding agents can both follow.', spec: 'Agent-readable, copy-paste ready' },
  { sku: 'AI-AB-024', name: 'Meeting-to-CRM Automation', category: 'automations', niche: 'sales', format: 'Make.com blueprint', price: 31, blurb: 'Pushes call notes, next steps, and the right deal stage into your CRM before you leave the call.', spec: 'HubSpot + Salesforce + Notion' },
  { sku: 'AI-PP-025', name: 'Viral Hook Prompt Pack', category: 'prompts', niche: 'marketers', format: '60 hook formulas · PDF + Notion', price: 23, blurb: 'Scroll-stopping opening lines, tuned to the rhythm of each platform.', spec: 'TikTok, Reels, X & LinkedIn presets' },
  { sku: 'AI-AG-026', name: 'Personal Research Analyst', category: 'agents', niche: 'students', format: 'Scheduled agent config', price: 29, blurb: 'A standing agent that tracks a topic and briefs you every week with sources, not guesses.', spec: 'Scheduled runs + citation checks' },
  { sku: 'AI-TP-027', name: 'Investor Update Template', category: 'templates', niche: 'founders', format: 'Notion + email template', price: 15, blurb: 'A monthly update that keeps investors warm, metrics honest, and your asks impossible to miss.', spec: 'Metrics block + clear ask section' },
  { sku: 'AI-AB-028', name: 'Release Notes Bot', category: 'automations', niche: 'developers', format: 'GitHub Actions blueprint', price: 27, blurb: 'Turns merged pull requests into human release notes and a customer-ready changelog.', spec: 'GitHub + Linear + Slack' },
  { sku: 'AI-PP-029', name: 'Voice & Tone Cloner', category: 'prompts', niche: 'writers', format: '25 prompts · interview-to-styleguide', price: 19, blurb: 'Capture any brand or personal voice into a reusable system prompt you can hand to any model.', spec: 'Outputs a drop-in style guide' },
  { sku: 'AI-AG-030', name: 'Customer Churn Sentinel', category: 'agents', niche: 'founders', format: 'Agent config + save-plays', price: 43, blurb: 'Watches usage and support signals and flags at-risk accounts while there is still time to save them.', spec: 'Signal scoring + outreach prompts' },
  { sku: 'AI-TP-031', name: 'Architecture Decision Record Kit', category: 'templates', niche: 'architects', format: 'Notion + Markdown template', price: 19, blurb: 'Capture the decision, the options you rejected, and why — so the next architect inherits reasoning, not folklore.', spec: 'ADR + RFC + trade-off matrix' },
  { sku: 'AI-PP-032', name: 'System Design Prompt Pack', category: 'prompts', niche: 'architects', format: '50 prompts · PDF + Notion', price: 24, blurb: 'Pressure-test a design across scale, failure modes, and cost before you commit a single line.', spec: 'C4 diagrams + capacity math' },
  { sku: 'AI-AG-033', name: 'Threat Modeling Agent', category: 'agents', niche: 'architects', format: 'Agent config + STRIDE library', price: 41, blurb: 'Walks a proposed design and surfaces the attack paths, trust boundaries, and mitigations you missed.', spec: 'STRIDE + data-flow analysis' },
  { sku: 'AI-AB-034', name: 'Architecture Diagram Sync', category: 'automations', niche: 'architects', format: 'GitHub Actions blueprint', price: 33, blurb: 'Keeps your diagrams honest by regenerating them from the code and infra on every merge.', spec: 'Mermaid + Structurizr export' },
  { sku: 'AI-TP-035', name: 'Tech Radar Template', category: 'templates', niche: 'architects', format: 'Notion + Sheets template', price: 16, blurb: 'Track what your org should adopt, trial, or retire — with the rationale attached to each ring.', spec: 'Adopt / Trial / Assess / Hold' },
  { sku: 'AI-AG-036', name: 'RFC Review Agent', category: 'agents', niche: 'architects', format: 'Agent config + review rubric', price: 37, blurb: 'Reads a design doc like a principal engineer would and returns sharp, specific questions before the meeting.', spec: 'Scored against a design rubric' },
  { sku: 'AI-AB-037', name: 'Incident Postmortem Automation', category: 'automations', niche: 'engineers', format: 'PagerDuty + Slack blueprint', price: 34, blurb: 'Turns an incident timeline into a blameless postmortem draft with action items already assigned.', spec: 'Timeline + root-cause + follow-ups' },
  { sku: 'AI-PP-038', name: 'Infrastructure-as-Code Prompt Pack', category: 'prompts', niche: 'engineers', format: '45 prompts · PDF', price: 22, blurb: 'Generate, review, and refactor Terraform and Kubernetes manifests without the copy-paste drift.', spec: 'Terraform + K8s + Helm' },
  { sku: 'AI-AG-039', name: 'On-Call Triage Agent', category: 'agents', niche: 'engineers', format: 'Agent config + runbook loader', price: 45, blurb: 'Reads the alert, pulls the runbook, and proposes the first three checks before you finish logging in.', spec: 'Alert-to-runbook mapping' },
  { sku: 'AI-AB-040', name: 'Data Pipeline Monitor', category: 'automations', niche: 'engineers', format: 'Airflow + Slack blueprint', price: 36, blurb: 'Catches silent pipeline failures and schema drift, then explains what broke in plain language.', spec: 'dbt + Airflow + Great Expectations' },
  { sku: 'AI-TP-041', name: 'Runbook Template Library', category: 'templates', niche: 'engineers', format: 'Notion + Markdown templates', price: 18, blurb: 'Operational runbooks your whole team can follow at 3am — deploys, rollbacks, and recovery.', spec: 'Deploy / rollback / restore plays' },
  { sku: 'AI-PP-042', name: 'Debugging Copilot Prompts', category: 'prompts', niche: 'engineers', format: '60 prompts · PDF + Notion', price: 20, blurb: 'Structured prompts that turn a stack trace and a hunch into a reproducible root cause.', spec: 'Repro → isolate → fix workflow' },
  { sku: 'AI-PP-043', name: 'Exam Study Prompt Pack', category: 'prompts', niche: 'students', format: '55 prompts · PDF + Notion', price: 14, blurb: 'Active-recall and spaced-repetition prompts that turn a dense syllabus into a study plan you can actually finish.', spec: 'Works with Claude, ChatGPT, Gemini' },
  { sku: 'AI-TP-044', name: 'Course Notes System', category: 'templates', niche: 'students', format: 'Notion template', price: 12, blurb: 'A Cornell-style notes workspace with summaries, cue columns, and one-click review pages for every class.', spec: 'Duplicate-and-go, one page per course' },
  { sku: 'AI-AG-045', name: 'Essay Feedback Agent', category: 'agents', niche: 'students', format: 'Agent config + rubric library', price: 24, blurb: 'Reads your draft like a TA would and returns line-level feedback on argument, structure, and clarity — never writes it for you.', spec: 'Rubric-scored, plagiarism-safe by design' },
  { sku: 'AI-PP-046', name: 'Lecture-to-Flashcards Prompts', category: 'prompts', niche: 'students', format: '30 prompts · Anki-ready', price: 13, blurb: 'Paste a lecture transcript or your notes and get clean question-and-answer cards ready to import.', spec: 'Anki + Quizlet CSV export' },
  { sku: 'AI-TP-047', name: 'Semester Planner Template', category: 'templates', niche: 'students', format: 'Notion + Sheets template', price: 15, blurb: 'Track every course, deadline, and grade in one place, with a running GPA that updates as you go.', spec: 'Assignment tracker + GPA calculator' },
  { sku: 'AI-AB-048', name: 'Citation Formatter Automation', category: 'automations', niche: 'students', format: 'Make.com blueprint', price: 19, blurb: 'Drop in a link or DOI and get a clean, correctly formatted reference added to your bibliography automatically.', spec: 'APA, MLA & Chicago · Zotero sync' },
  { sku: 'AI-AG-049', name: 'Study Buddy Tutor Agent', category: 'agents', niche: 'students', format: 'Agent config + subject presets', price: 22, blurb: 'A Socratic tutor that asks the next question instead of handing you the answer, so the concept actually sticks.', spec: 'Presets for STEM, humanities & languages' },
  { sku: 'AI-PP-050', name: 'Professional Email Prompt Pack', category: 'prompts', niche: 'office', format: '60 prompts · PDF + Notion', price: 16, blurb: 'Say the hard thing well — declines, follow-ups, and status updates that stay warm and get read.', spec: 'Tone controls for every workplace situation' },
  { sku: 'AI-TP-051', name: 'Meeting Agenda & Minutes Template', category: 'templates', niche: 'office', format: 'Notion + Docs template', price: 12, blurb: 'Walk in with a tight agenda and walk out with decisions, owners, and dates already written down.', spec: 'Agenda + action-item tracker in one' },
  { sku: 'AI-AB-052', name: 'Expense Report Automation', category: 'automations', niche: 'office', format: 'Zapier blueprint', price: 23, blurb: 'Turns a folder of receipts into a categorized, submission-ready expense report without the manual typing.', spec: 'Gmail + Drive + Sheets · OCR line items' },
  { sku: 'AI-AG-053', name: 'Calendar Scheduling Agent', category: 'agents', niche: 'office', format: 'Agent config + calendar hooks', price: 26, blurb: 'Handles the back-and-forth of finding a time, then books the meeting and sends the invite for you.', spec: 'Google + Outlook calendar aware' },
  { sku: 'AI-TP-054', name: 'Standard Operating Procedure Kit', category: 'templates', niche: 'office', format: 'Notion + Markdown template', price: 17, blurb: 'Capture how work actually gets done so a task survives vacations, handoffs, and new hires.', spec: 'Step-by-step SOP + onboarding checklist' },
]
