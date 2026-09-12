# SWARM

Intent-hijack ad organism for [MULTINICHE AI](https://multinicheai.com).

Most ads try to create demand. SWARM hijacks demand that already exists: it maps live pain-utterances to a SKU, spawns proof-first micro-ads (search intercept, conversation native, proof-loop spec sheets, shadow listings), then evolves winners and kills losers.

**Autopilot is on by default.** Open the app and it hijacks intent, runs swarms, and evolves ripe generations with no click. Grok copy is only used when you turn that switch on for a manual spawn — autopilot never spends API quota.

Live source: [github.com/duprejesse3-ops/swarm](https://github.com/duprejesse3-ops/swarm)

## Host it yourself (does not depend on Grok)

The Grok preview at grok-sandbox.com sleeps. Cloudflare 521 means that tunnel died — not SWARM.

1. Open [vercel.com/new](https://vercel.com/new) and import `duprejesse3-ops/swarm`.
2. Deploy. Use the `*.vercel.app` URL (or `swarm.multinicheai.com`).
3. Install the PWA from **that** URL in Chrome. That home-screen app stays up.

Build command is `npm run build`. Optional env: `XAI_API_KEY` (Scan live X / Grok copy). Without it, autopilot still runs on the local genome.

## Install (Android + Windows)

This is a progressive web app. There is **no Play Store APK** and **no Microsoft Store listing**. Chrome and Edge install SWARM as a real app window (home screen / Start menu / taskbar).

### Android (Chrome)

1. Open the live SWARM app in **Chrome** (not an in-app browser).
2. Tap **Get app**, or Chrome menu → **Install app** / **Add to Home screen**.
3. Launch SWARM from the home screen. Autopilot is already running.

### Windows (Edge or Chrome)

1. Open SWARM in Edge or Chrome.
2. Click **Get app**, or the install icon in the address bar.
3. Pin to Start or the taskbar. The title bar overlays Windows chrome.
4. Keyboard: `1–6` move, `A` autopilot, `I` install page.

## Product (multinicheai.com)

SWARM is SKU **[AI-AB-070](https://multinicheai.com/product/AI-AB-070)** — Automation Blueprints, Store & Site Owners, **$79.00** one-time.

- Cart: [multinicheai.com/?product=AI-AB-070](https://multinicheai.com/?product=AI-AB-070)
- Tools: [Store & Site Owners](https://multinicheai.com/tools/stores)
- The in-app **Product** page emits SQL, `catalog.mts`, live-proof, llms.txt, and JSON-LD in the store's own fields.

### Source zip

[Download this repository as a zip](https://github.com/duprejesse3-ops/swarm/archive/refs/heads/main.zip)

## Run locally

```bash
npm install
npm run dev
```

The app listens on `0.0.0.0:8080`. Autopilot uses the local genome only. Optional Grok copy requires `XAI_API_KEY` and a manual spawn.

## What “fully automatic” means

- Autopilot hijacks new intent pulses and spawns organisms — no click required.
- Running swarms tick on their own. Ripe swarms evolve. Losers die.
- Lab state (swarms, organisms, pulses, log) persists in the browser.
- Copy stays proof-first. Deploy packets still copy out of Studio / Swarm when you are ready to paste into Google, X, or a thread.

## Copyright

© 2026 MULTINICHE AI. All rights reserved.

SWARM Intent Autopilot (SKU AI-AB-070) is a product of [MULTINICHE AI](https://multinicheai.com).
See [LICENSE](LICENSE).

