// Generates the MULTINICHE AI social share image (multiniche-ai-og.png, 1200x630).
// Builds an SVG in the storefront's terminal/matrix aesthetic. Rasterize to PNG
// with: rsvg-convert icons/og-image.svg -o multiniche-ai-og.png
// Deterministic output so re-runs are stable.
// Run: node icons/build-og.mjs   (writes icons/og-image.svg)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const W = 1200;
const H = 630;

// --- palette (mirrors index.html's actual current :root — ink/panel/paper/
// teal/brass, not the pre-rebrand all-red "terminal" look this file used to
// have). The brand-mark square is the one deliberate exception: like
// ad-image.mts's STORE_ART, it keeps its original red (#FF2A2A) because the
// logo itself never moved off red in the rebrand — everything else here did.
const INK_A = '#121826';
const INK_B = '#0a0e16';
const PAPER = '#eef1f7';
const BRASS = '#ffb020';
const TEAL = '#22d3b0';
const MUTED_2 = '#5c6580';
const MARK_RED = '#ff2a2a';
const MONO = 'DejaVu Sans Mono, monospace';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_A}"/>
      <stop offset="1" stop-color="${INK_B}"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="42%" r="75%">
      <stop offset="0" stop-color="${TEAL}" stop-opacity=".10"/>
      <stop offset="1" stop-color="${TEAL}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- corner frame brackets -->
  <g stroke="${TEAL}" stroke-width="3" fill="none" opacity=".55">
    <path d="M40 74 V40 H74"/>
    <path d="M${W - 40} 74 V40 H${W - 74}"/>
    <path d="M40 ${H - 74} V${H - 40} H74"/>
    <path d="M${W - 40} ${H - 74} V${H - 40} H${W - 74}"/>
  </g>

  <!-- brand mark: engineered M monogram + cursor (kept red — see note above) -->
  <g transform="translate(56,62)">
    <rect x="0" y="0" width="78" height="78" rx="16" fill="none" stroke="${MARK_RED}" stroke-width="3" opacity=".85"/>
    <g fill="none" stroke="${MARK_RED}" stroke-width="7.5" stroke-linejoin="round" stroke-linecap="round" filter="url(#soft)">
      <path d="M21 55 L21 24 L39 42 L57 24 L57 55"/>
    </g>
    <rect x="29" y="60" width="20" height="6" rx="3" fill="${MARK_RED}"/>
  </g>

  <!-- brand lockup -->
  <text x="156" y="102" font-family="${MONO}" font-size="34" font-weight="bold" letter-spacing="6" fill="${PAPER}">MULTINICHE AI</text>
  <text x="158" y="130" font-family="${MONO}" font-size="15" letter-spacing="7" fill="${BRASS}" opacity=".8">LOAD THE TOOL YOU NEED</text>

  <!-- kicker -->
  <text x="60" y="234" font-family="${MONO}" font-size="24" font-weight="bold" letter-spacing="6" fill="${BRASS}">&gt; JACK IN — AI PRODUCTIVITY INSTRUMENTS</text>

  <!-- headline -->
  <g font-family="${MONO}" font-size="52" font-weight="bold" fill="${PAPER}">
    <text x="58" y="318">Prompt packs, automations,</text>
    <text x="58" y="388">and agent configs — built once,</text>
    <text x="58" y="458" fill="${TEAL}">sold as instruments.</text>
  </g>

  <!-- footer -->
  <line x1="58" y1="540" x2="${W - 58}" y2="540" stroke="${MUTED_2}" stroke-width="2" opacity=".6"/>
  <text x="58" y="576" font-family="${MONO}" font-size="19" font-weight="bold" letter-spacing="3" fill="${TEAL}" opacity=".85">PROMPT PACKS • AUTOMATION BLUEPRINTS • DOC TEMPLATES • AGENT CONFIGS</text>
  <text x="58" y="606" font-family="${MONO}" font-size="17" letter-spacing="2" fill="${MUTED_2}">multinicheai.com</text>
</svg>
`;

writeFileSync(join(DIR, 'og-image.svg'), svg);

console.log('Wrote icons/og-image.svg — rasterize with: rsvg-convert icons/og-image.svg -o multiniche-ai-og.png');
