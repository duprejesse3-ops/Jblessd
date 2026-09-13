# Architecture Diagram Sync

A GitHub Actions workflow that regenerates `docs/architecture.md` — a real
Mermaid diagram — from your codebase's actual structure on every push to
main. Not a blueprint you wire yourself.

## What it does, precisely

1. On every push to `main`, it scans the repo: top-level directories, how
   many source files each has, and which directories import from which
   others (regex-based — no parser, no build step, works on plain JS/TS).
2. Claude draws a Mermaid flowchart from that scan. It's instructed not to
   invent a node or edge that isn't in the scan — the diagram is a picture
   of what's actually there, not what an LLM assumes a repo like this
   "usually" looks like.
3. Writes `docs/architecture.md`. If the diagram is identical to what's
   already committed, nothing happens — no empty commits on every merge.
4. If it changed, commits it with `[skip ci]` (so the commit doesn't
   re-trigger this same workflow and loop forever).

## What it does not do

Parse your actual AST, understand TypeScript types, or follow path aliases
(`@/lib/...` style imports) — the scan is regex-based on relative import
paths (`./`, `../`) specifically so it has zero dependencies and needs no
build step. If your codebase uses path aliases heavily, the cross-directory
edges it finds will be incomplete. It also doesn't read Terraform/infra
files for resource-level detail yet — it only notes which infra files exist
(Dockerfile, docker-compose.yml, terraform/, etc.) as context for the
diagram, not as diagram nodes themselves.

## Install (5 minutes)

1. Copy `bin/` and `lib/` into your repo, e.g. `tools/architecture-diagram-sync/`.
2. Copy `.github-workflow-template/architecture-diagram-sync.yml` to
   `.github/workflows/architecture-diagram-sync.yml`.
3. If you used a different location, edit `working-directory:` in the
   workflow.
4. Add one repo secret: `ANTHROPIC_API_KEY`.
5. Push to main. First run creates `docs/architecture.md`; every push after
   that keeps it honest.

If your default branch isn't `main`, update both the `on: push: branches:`
trigger and `git push origin HEAD:main` in the workflow.

## Testing locally

```sh
npm install --omit=dev
cp .env.example .env
node bin/diagram-sync.mjs
cat docs/architecture.md
```

```sh
npm test
```
Runs without real API keys — checks the scanner against a small fixture repo
and the write-if-changed logic, not a live Claude call.
