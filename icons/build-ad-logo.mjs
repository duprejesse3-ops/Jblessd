// Generates large "logo" image assets for Google Ads (and any ad placement that
// asks for a standalone brand mark). Google Ads logo assets come in two shapes:
//   - Square  (1:1) — recommended 1200x1200, min 128x128
//   - Landscape (4:1) — recommended 1200x300,  min 512x128
// This writes both as SVG in the storefront's terminal/matrix aesthetic, reusing
// the engineered-M monogram from build-logo.mjs. Deterministic output — no
// randomness — so re-runs are byte-stable.
//
// Run:   node icons/build-ad-logo.mjs
// Then rasterize to the PNGs Google Ads accepts:
//   rsvg-convert icons/ad-logo-square.svg    -w 1200 -h 1200 -o icons/ad-logo-1200.png
//   rsvg-convert icons/ad-logo-landscape.svg -w 1200 -h 300  -o icons/ad-logo-landscape-1200.png

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));

// --- brand palette (mirrors the storefront CSS custom properties) ---
const INK_A = '#1b0404';
const INK_B = '#0a0400';
const ACCENT = '#ff2a2a';
const ACCENT_DIM = '#7a1f1f';

// Shared gradient/glow defs. `id` suffix keeps them unique per-shape when both
// SVGs are ever inlined on the same page.
function defs(id) {
  return `
  <defs>
    <linearGradient id="tile-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_A}"/>
      <stop offset="1" stop-color="${INK_B}"/>
    </linearGradient>
    <radialGradient id="core-${id}" cx="50%" cy="42%" r="58%">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette-${id}" cx="50%" cy="46%" r="62%">
      <stop offset="0" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow-${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

// The monogram: an "M" drawn as a single bold stroke rising to twin peaks, with
// a terminal cursor block on the baseline beneath it. Authored in a 512-unit box
// (same as logo.svg); callers translate/scale it into place. `cx,cy` centre it.
function mark(id, cx, cy, scale) {
  const glow = `filter="url(#glow-${id})"`;
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-256 -256)">
    <g fill="none" stroke="${ACCENT}" stroke-width="50" stroke-linejoin="round" stroke-linecap="round">
      <path d="M136 316 L136 152 L256 260 L376 152 L376 316" ${glow}/>
    </g>
    <rect x="192" y="350" width="128" height="34" rx="17" fill="${ACCENT}" ${glow}/>
  </g>`;
}

// Square 1:1 tile — a scaled-up twin of logo.svg, drawn at 1200 so the committed
// PNG rasterizes crisply at the size Google Ads recommends.
function square() {
  const S = 1200;
  const r = 262; // 112/512 * 1200, keeping the corner radius proportional
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="MULTINICHE AI">
  <title>MULTINICHE AI</title>
${defs('sq')}
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#tile-sq)"/>
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#core-sq)"/>
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#vignette-sq)"/>
  <rect x="16" y="16" width="${S - 32}" height="${S - 32}" rx="${r - 12}" fill="none" stroke="${ACCENT_DIM}" stroke-width="7" opacity="0.55"/>
  <rect x="52" y="52" width="${S - 104}" height="${S - 104}" rx="${r - 40}" fill="none" stroke="${ACCENT_DIM}" stroke-width="3.5" opacity="0.3"/>
  ${mark('sq', 600, 600, 2.1)}
</svg>
`;
}

// Landscape 4:1 lockup — the same mark centred on the brand background so the
// logo reads even where Google Ads crops to a wide slot.
function landscape() {
  const W = 1200;
  const H = 300;
  const r = 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="MULTINICHE AI">
  <title>MULTINICHE AI</title>
${defs('ls')}
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="url(#tile-ls)"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="url(#core-ls)"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="url(#vignette-ls)"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="${r - 8}" fill="none" stroke="${ACCENT_DIM}" stroke-width="4" opacity="0.5"/>
  ${mark('ls', W / 2, H / 2, 0.5)}
</svg>
`;
}

writeFileSync(join(DIR, 'ad-logo-square.svg'), square());
writeFileSync(join(DIR, 'ad-logo-landscape.svg'), landscape());
console.log('Wrote icons/ad-logo-square.svg and icons/ad-logo-landscape.svg');
console.log('Rasterize with:');
console.log('  rsvg-convert icons/ad-logo-square.svg    -w 1200 -h 1200 -o icons/ad-logo-1200.png');
console.log('  rsvg-convert icons/ad-logo-landscape.svg -w 1200 -h 300  -o icons/ad-logo-landscape-1200.png');
