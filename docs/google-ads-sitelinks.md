# Google Ads — Sitelinks & Description Assets

A ready-to-paste library of **sitelink assets** for the MULTINICHE AI storefront,
plus **callout** and **structured snippet** copy to round out the ad extensions.

Like bid strategies, sitelinks are configured in the Google Ads UI (Assets →
Sitelinks) — they can't be set from code. What *can* live in code, and does here,
is the canonical copy and the exact **final URLs**. Every URL below is a real,
server-rendered, indexable page on the site (see `netlify/edge-functions/pages.ts`
and `netlify/functions/sitemap.mts`), so ads never point at a dead or client-only
route. This doc is the companion to [`google-ads-strategy.md`](./google-ads-strategy.md).

Base domain: `https://jblessd.com`

## Character limits (enforce these when editing)

| Field | Limit | Notes |
| --- | --- | --- |
| Sitelink text | **25** | The blue link line. Every entry below is ≤ 25. |
| Description line 1 | **35** | Optional but recommended — descriptions lift CTR. |
| Description line 2 | **35** | Use both lines; a single line often won't show. |
| Final URL | — | Must resolve to a real page. All URLs here do. |

Google shows **2–6** sitelinks per impression and picks the best performers, so
supplying more good ones than will ever show at once is the point — the extra
inventory lets the auction choose. Aim for **at least 8–10 active** per campaign.

---

## 1. Brand & general campaign

Broadest links — safe on any campaign, ideal for the brand campaign.

| Sitelink text | Description line 1 | Description line 2 | Final URL |
| --- | --- | --- | --- |
| Browse the Full Catalog | 40+ AI tools, prompts & agents | One-time price, instant access | `/` |
| Watch AI Do Your Task | Free live demo, no signup | See the real output first | `/free-tool` |
| See Live Proofs | Real runs shoppers have saved | Watch each tool actually work | `/proof` |
| Shop by Use Case | Pick the outcome you want | We match the right tools | `/use-cases` |
| Build a Custom Bundle | Any 3+ tools, auto 15% off | AI assembles your toolkit | `/#concierge` |
| Refund Policy | 14-day resolution on issues | Clear terms for digital goods | `/refund-policy/` |

---

## 2. By role / audience

Use on audience-targeted or generic campaigns. Final URLs are the crawlable role
landing pages (`/tools/:niche`), each listing that audience's tools.

| Sitelink text | Description line 1 | Description line 2 | Final URL |
| --- | --- | --- | --- |
| Tools for Founders | Plan, meet, and follow up fast | Give a small team its time back | `/tools/founders` |
| Tools for Developers | PRs, standups & knowledge bases | Agents that fit your workflow | `/tools/developers` |
| Tools for Marketers | Copy, calendars & creative | On-brand output, less fiddling | `/tools/marketers` |
| Tools for Sales Teams | Triage inbound, stay warm | Turn chats into next steps | `/tools/sales` |
| Tools for Students | Study & research, organized | Lit scans and a weekly rhythm | `/tools/students` |
| Tools for Writers | Keep your voice, lose the page | Tuned for tone and structure | `/tools/writers` |
| Tools for Engineers | Infra, incidents & pipelines | The runbooks that hold it up | `/tools/engineers` |
| Tools for Architects | Decision records & reviews | Trade-off analysis that lasts | `/tools/architects` |
| Office & Admin Tools | Email, meetings & expenses | Clear the recurring admin | `/tools/office` |

---

## 3. By use case / outcome

Highest-intent links — pair these with keyword themes that match the outcome.
Final URLs are the outcome landing pages (`/use-cases/:slug`).

| Sitelink text | Description line 1 | Description line 2 | Final URL |
| --- | --- | --- | --- |
| Hit Inbox Zero | Auto-sort and draft replies | Flag only what needs you | `/use-cases/hit-inbox-zero` |
| Triage Support Tickets | Read and draft every reply | Route the hard ones to a human | `/use-cases/triage-support-tickets` |
| Ship Content Faster | Hooks, headlines & calendars | Draft, tune, and queue it | `/use-cases/ship-content-faster` |
| Draft Investor Updates | Metrics, narrative, and ask | Keep investors warm, fast | `/use-cases/draft-investor-updates` |
| Run Better Standups | Turn transcripts into actions | Owners and deadlines, sorted | `/use-cases/run-better-standups` |
| Research w/ Citations | Sourced answers, not guesses | Compare and cite as you go | `/use-cases/research-with-citations` |

---

## 4. Flagship products

Deep links to individual product pages (`/product/:sku`) for high-value SKUs —
useful on campaigns targeting a specific tool. Prices shown for reference only;
don't put prices in sitelink text (use price assets for that).

| Sitelink text | Description line 1 | Description line 2 | Final URL | Ref |
| --- | --- | --- | --- | --- |
| Realtime Voice Agent | Answers calls, books meetings | Low-latency, human handoff | `/product/AI-AG-015` | $49 |
| RAG Knowledge Base | Grounded answers from your docs | Cites sources, doesn't guess | `/product/AI-AG-016` | $44 |
| SEO Content Agent | Research, draft & internal-link | A full article on your topic | `/product/AI-AG-020` | $46 |
| Support Triage Copilot | Drafts a reply to every ticket | Priority & sentiment scoring | `/product/AI-AB-018` | $42 |
| Inbox Zero Automation | Sorts, drafts, and flags mail | Gmail + Outlook compatible | `/product/AI-AB-002` | $29 |
| Image Prompt Studio | On-brand shots, ads & social | Style and lighting recipes | `/product/AI-PP-019` | $28 |

> SKUs come from the live catalog (`netlify/lib/catalog.mts` / the seeded
> database). If you retire a flagship SKU, drop or swap its row here so no ad
> points at a removed product.

---

## 5. Callout assets (no links)

Short, non-clickable trust boosters. Limit **25 characters** each; add 6–10 and
let Google rotate them.

- Instant digital delivery
- One-time price, no sub
- Works with Claude & GPT
- Free live demo first
- 15% off 3+ tool bundles
- 40+ tools across 9 roles
- No signup to try a tool
- Built for real workflows

## 6. Structured snippet assets

Pick a header, then list values (each value ≤ 25 characters).

- **Header: Types** — Prompt Packs, Automation Blueprints, Doc Templates, Agent Configs
- **Header: Styles** — For Founders, Developers, Marketers, Sales, Students, Writers, Engineers

---

## How to add these in Google Ads

1. **Assets → Sitelinks → +**. Choose the level (account, campaign, or ad group).
   Prefer **campaign-level** so each campaign's sitelinks match its theme.
2. Paste the **sitelink text**, both **description** lines, and the **final URL**.
3. Repeat for at least 8–10 sitelinks per campaign so the auction has choice.
4. Add the **callouts** (§5) and **structured snippets** (§6) as separate assets.
5. Review **Assets** monthly: pause low-CTR sitelinks and promote the winners.
</content>
</invoke>
