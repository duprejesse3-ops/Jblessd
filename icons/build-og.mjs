// Generates the MULTINICHE AI social share image (og-image.png, 1200x630).
// Builds an SVG in the storefront's terminal/matrix aesthetic. Rasterize to PNG
// with: rsvg-convert icons/og-image.svg -o og-image.png
// Deterministic output so re-runs are stable.
// Run: node icons/build-og.mjs   (writes icons/og-image.svg)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const W = 1200;
const H = 630;

// --- palette (mirrors the storefront CSS custom properties) ---
const INK_A = '#041b0d';
const INK_B = '#00060a';
const GREEN = '#00FF41';
const GREEN_MID = '#23C552';
const GREEN_DIM = '#0d7a2e';
const MONO = 'DejaVu Sans Mono, monospace';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_A}"/>
      <stop offset="1" stop-color="${INK_B}"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="42%" r="75%">
      <stop offset="0" stop-color="#00ff41" stop-opacity=".10"/>
      <stop offset="1" stop-color="#00ff41" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- corner frame brackets -->
  <g stroke="${GREEN_MID}" stroke-width="3" fill="none" opacity=".55">
    <path d="M40 74 V40 H74"/>
    <path d="M${W - 40} 74 V40 H${W - 74}"/>
    <path d="M40 ${H - 74} V${H - 40} H74"/>
    <path d="M${W - 40} ${H - 74} V${H - 40} H${W - 74}"/>
  </g>

  <!-- terminal icon -->
  <g transform="translate(56,68)">
    <rect width="72" height="56" rx="10" fill="none" stroke="${GREEN}" stroke-width="3" opacity=".85"/>
    <text x="16" y="38" font-family="${MONO}" font-size="30" font-weight="bold" fill="${GREEN}" filter="url(#soft)">&gt;_</text>
  </g>

  <!-- brand lockup -->
  <text x="150" y="102" font-family="${MONO}" font-size="34" font-weight="bold" letter-spacing="6" fill="#e8ffe8">MULTINICHE AI</text>
  <text x="152" y="130" font-family="${MONO}" font-size="15" letter-spacing="7" fill="${GREEN_MID}" opacity=".8">LOAD THE TOOL YOU NEED</text>

  <!-- kicker -->
  <text x="60" y="234" font-family="${MONO}" font-size="24" font-weight="bold" letter-spacing="6" fill="${GREEN}">&gt; JACK IN — AI PRODUCTIVITY INSTRUMENTS</text>

  <!-- headline -->
  <g font-family="${MONO}" font-size="52" font-weight="bold" fill="#dfffe0">
    <text x="58" y="318">Prompt packs, automations,</text>
    <text x="58" y="388">and agent configs — built once,</text>
    <text x="58" y="458" fill="${GREEN}">sold as instruments.</text>
  </g>

  <!-- footer -->
  <line x1="58" y1="540" x2="${W - 58}" y2="540" stroke="${GREEN_DIM}" stroke-width="2" opacity=".6"/>
  <text x="58" y="576" font-family="${MONO}" font-size="19" font-weight="bold" letter-spacing="3" fill="${GREEN_MID}" opacity=".85">PROMPT PACKS • AUTOMATION BLUEPRINTS • DOC TEMPLATES • AGENT CONFIGS</text>
  <text x="58" y="606" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${GREEN_DIM}">jblessd.com</text>
</svg>
`;

writeFileSync(join(DIR, 'og-image.svg'), svg);

console.log('Wrote icons/og-image.svg — rasterize with: rsvg-convert icons/og-image.svg -o og-image.png');
