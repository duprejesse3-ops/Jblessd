-- Adds a third wave of products that broadens the catalog into two new
-- audiences: software architects and engineers. Like the earlier waves this is
-- a roll-forward migration — it never touches an existing seed, it only inserts
-- new SKUs. ON CONFLICT (sku) DO NOTHING keeps it idempotent and lets it coexist
-- with the founding catalog, wave two, and any products owners listed themselves.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  ('AI-TP-031', 'Architecture Decision Record Kit', 'templates', 'architects', 'Notion + Markdown template', 19, 'Capture the decision, the options you rejected, and why — so the next architect inherits reasoning, not folklore.', 'ADR + RFC + trade-off matrix'),
  ('AI-PP-032', 'System Design Prompt Pack', 'prompts', 'architects', '50 prompts · PDF + Notion', 24, 'Pressure-test a design across scale, failure modes, and cost before you commit a single line.', 'C4 diagrams + capacity math'),
  ('AI-AG-033', 'Threat Modeling Agent', 'agents', 'architects', 'Agent config + STRIDE library', 41, 'Walks a proposed design and surfaces the attack paths, trust boundaries, and mitigations you missed.', 'STRIDE + data-flow analysis'),
  ('AI-AB-034', 'Architecture Diagram Sync', 'automations', 'architects', 'GitHub Actions blueprint', 33, 'Keeps your diagrams honest by regenerating them from the code and infra on every merge.', 'Mermaid + Structurizr export'),
  ('AI-TP-035', 'Tech Radar Template', 'templates', 'architects', 'Notion + Sheets template', 16, 'Track what your org should adopt, trial, or retire — with the rationale attached to each ring.', 'Adopt / Trial / Assess / Hold'),
  ('AI-AG-036', 'RFC Review Agent', 'agents', 'architects', 'Agent config + review rubric', 37, 'Reads a design doc like a principal engineer would and returns sharp, specific questions before the meeting.', 'Scored against a design rubric'),
  ('AI-AB-037', 'Incident Postmortem Automation', 'automations', 'engineers', 'PagerDuty + Slack blueprint', 34, 'Turns an incident timeline into a blameless postmortem draft with action items already assigned.', 'Timeline + root-cause + follow-ups'),
  ('AI-PP-038', 'Infrastructure-as-Code Prompt Pack', 'prompts', 'engineers', '45 prompts · PDF', 22, 'Generate, review, and refactor Terraform and Kubernetes manifests without the copy-paste drift.', 'Terraform + K8s + Helm'),
  ('AI-AG-039', 'On-Call Triage Agent', 'agents', 'engineers', 'Agent config + runbook loader', 45, 'Reads the alert, pulls the runbook, and proposes the first three checks before you finish logging in.', 'Alert-to-runbook mapping'),
  ('AI-AB-040', 'Data Pipeline Monitor', 'automations', 'engineers', 'Airflow + Slack blueprint', 36, 'Catches silent pipeline failures and schema drift, then explains what broke in plain language.', 'dbt + Airflow + Great Expectations'),
  ('AI-TP-041', 'Runbook Template Library', 'templates', 'engineers', 'Notion + Markdown templates', 18, 'Operational runbooks your whole team can follow at 3am — deploys, rollbacks, and recovery.', 'Deploy / rollback / restore plays'),
  ('AI-PP-042', 'Debugging Copilot Prompts', 'prompts', 'engineers', '60 prompts · PDF + Notion', 20, 'Structured prompts that turn a stack trace and a hunch into a reproducible root cause.', 'Repro → isolate → fix workflow')
ON CONFLICT (sku) DO NOTHING;
