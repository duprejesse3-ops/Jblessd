-- Rewrites generic, terse product titles into long-tail, high-intent phrases
-- that name the specific problem/output instead of a vague category label —
-- e.g. "Deep Work Prompt Pack" -> "Focus Block & Daily Reset Prompt Pack".
--
-- Scope: only the original wave-1 catalog's generic names (SKUs AI-*-001
-- through AI-*-065-ish). Branded product names (MultiVault, MultiBøT,
-- Fieldhand, $Token Agent, Meridian Host, etc.) and names that already carry
-- specific long-tail phrasing (Local SEO Agency Blueprint, Broken Link &
-- Uptime Watchdog, Overdue Invoice Chaser, Investor-Ready Financials
-- Template, ...) are left untouched — a rename there would replace a
-- distinctive name with a more generic one.
--
-- Safe to run: `name` is a display string only. Product URLs are keyed by
-- `sku` (/product/AI-PP-001), never by name, so this cannot break a link,
-- bookmark, or existing backlink.

UPDATE products SET name = 'Focus Block & Daily Reset Prompt Pack' WHERE sku = 'AI-PP-001';
UPDATE products SET name = 'Gmail Inbox Auto-Sort & Reply-Draft Automation' WHERE sku = 'AI-AB-002';
UPDATE products SET name = 'Transcript-to-Decisions Meeting Notes Agent' WHERE sku = 'AI-AG-003';
UPDATE products SET name = 'Monday-to-Friday Weekly Planning Template' WHERE sku = 'AI-TP-004';
UPDATE products SET name = 'AI Content Calendar Auto-Scheduler' WHERE sku = 'AI-AB-005';
UPDATE products SET name = 'Literature Review & Source-Comparison Prompt Pack' WHERE sku = 'AI-PP-006';
UPDATE products SET name = 'Client Intake & Onboarding Kit' WHERE sku = 'AI-TP-007';
UPDATE products SET name = 'Async Daily Standup Slack Bot' WHERE sku = 'AI-AG-008';
UPDATE products SET name = 'Quarterly OKR Tracker with Confidence Scoring' WHERE sku = 'AI-TP-009';
UPDATE products SET name = 'Contact Follow-Up Reminder Automation' WHERE sku = 'AI-AB-010';
UPDATE products SET name = 'Brand Voice Consistency Prompt Kit' WHERE sku = 'AI-PP-011';
UPDATE products SET name = 'Bank Transaction-to-Ledger Categorizer Agent' WHERE sku = 'AI-AG-012';
UPDATE products SET name = 'Daily GitHub PR Review Digest for Slack' WHERE sku = 'AI-AB-013';
UPDATE products SET name = 'Landing Page Headline & CTA Prompt Pack' WHERE sku = 'AI-PP-014';
UPDATE products SET name = 'Short-Form Video Hook Prompt Pack' WHERE sku = 'AI-PP-025';
UPDATE products SET name = 'Weekly Topic-Tracking Research Agent' WHERE sku = 'AI-AG-026';
UPDATE products SET name = 'Monthly Investor Update Template' WHERE sku = 'AI-TP-027';
UPDATE products SET name = 'GitHub Release Notes Automation' WHERE sku = 'AI-AB-028';
UPDATE products SET name = 'Brand Voice Cloning Prompt Kit' WHERE sku = 'AI-PP-029';
UPDATE products SET name = 'At-Risk Account Churn Detection Agent' WHERE sku = 'AI-AG-030';
UPDATE products SET name = 'Architecture Decision Record (ADR) Kit' WHERE sku = 'AI-TP-031';
UPDATE products SET name = 'System Design Interview Prompt Pack' WHERE sku = 'AI-PP-032';
UPDATE products SET name = 'STRIDE Threat Modeling Agent' WHERE sku = 'AI-AG-033';
UPDATE products SET name = 'Codebase-to-Mermaid Architecture Diagram Sync' WHERE sku = 'AI-AB-034';
UPDATE products SET name = 'Technology Adoption Radar Template' WHERE sku = 'AI-TP-035';
UPDATE products SET name = 'RFC & Design Doc Review Agent' WHERE sku = 'AI-AG-036';
UPDATE products SET name = 'Terraform & Kubernetes Manifest Prompt Pack' WHERE sku = 'AI-PP-038';
UPDATE products SET name = 'On-Call Alert Triage Agent' WHERE sku = 'AI-AG-039';
UPDATE products SET name = 'Airflow Pipeline Failure & Schema-Drift Monitor' WHERE sku = 'AI-AB-040';
UPDATE products SET name = 'Deploy & Rollback Runbook Template Library' WHERE sku = 'AI-TP-041';
UPDATE products SET name = 'Stack-Trace-to-Root-Cause Debugging Prompts' WHERE sku = 'AI-PP-042';
UPDATE products SET name = 'Spaced-Repetition Exam Study Prompt Pack' WHERE sku = 'AI-PP-043';
UPDATE products SET name = 'Cornell-Style Course Notes System' WHERE sku = 'AI-TP-044';
UPDATE products SET name = 'Line-Level Essay Feedback Agent' WHERE sku = 'AI-AG-045';
UPDATE products SET name = 'Lecture-to-Anki-Flashcards Prompt Pack' WHERE sku = 'AI-PP-046';
UPDATE products SET name = 'Semester Course & GPA Planner Template' WHERE sku = 'AI-TP-047';
UPDATE products SET name = 'DOI-to-Citation Formatter Automation' WHERE sku = 'AI-AB-048';
UPDATE products SET name = 'Socratic Method AI Tutor Agent' WHERE sku = 'AI-AG-049';
UPDATE products SET name = 'Difficult Workplace Email Prompt Pack' WHERE sku = 'AI-PP-050';
UPDATE products SET name = 'Meeting Agenda & Action-Item Minutes Template' WHERE sku = 'AI-TP-051';
UPDATE products SET name = 'Receipt-to-Expense-Report Automation' WHERE sku = 'AI-AB-052';
UPDATE products SET name = 'Meeting Scheduling Agent (Google + Outlook)' WHERE sku = 'AI-AG-053';
UPDATE products SET name = 'SOP & New-Hire Onboarding Checklist Kit' WHERE sku = 'AI-TP-054';
UPDATE products SET name = 'Portfolio Drift Rebalancing Analyst' WHERE sku = 'AI-AG-055';
UPDATE products SET name = 'Earnings Call Transcript Analysis Copilot' WHERE sku = 'AI-AG-056';
UPDATE products SET name = 'Monthly Spending Review CFO Agent' WHERE sku = 'AI-AG-057';
UPDATE products SET name = 'DCF Valuation Agent (Bull/Base/Bear)' WHERE sku = 'AI-AG-058';
UPDATE products SET name = 'Receipt-to-Tax-Ledger Automation' WHERE sku = 'AI-AB-059';
UPDATE products SET name = '13-Week Cashflow Forecast Automation' WHERE sku = 'AI-AB-060';
UPDATE products SET name = 'Three-Statement Financial Model Prompt Pack' WHERE sku = 'AI-PP-061';
UPDATE products SET name = '10-K-to-Thesis Equity Research Prompt Pack' WHERE sku = 'AI-PP-062';
UPDATE products SET name = 'Personal Budget & Net-Worth Tracker' WHERE sku = 'AI-TP-064';
