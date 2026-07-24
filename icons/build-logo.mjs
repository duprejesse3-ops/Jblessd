// Generates the MULTINICHE AI monogram logo as SVG (standard + maskable variants).
// The mark is an engineered "M" (for MULTINICHE) rising to twin peaks with a
// terminal cursor block beneath it — a nod to the command-line/AI heritage
// without the generic matrix-rain motif. Deterministic output — no randomness —
// so re-runs are byte-stable.
// Run: node icons/build-logo.mjs   (writes icons/logo.svg + icons/logo-maskable.svg)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const S = 512; // canvas size

// --- brand palette (mirrors the storefront CSS custom properties) ---
const INK_A = '#1b0404';
const INK_B = '#0a0400';
const ACCENT = '#ff2a2a';
const ACCENT_MID = '#e03a3a';
const ACCENT_DIM = '#7a1f1f';

function defs() {
  return `
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_A}"/>
      <stop offset="1" stop-color="${INK_B}"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="42%" r="58%">
      <stop offset="0" stop-color="${ACCENT}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx="50%" cy="46%" r="62%">
      <stop offset="0" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

// The monogram: an "M" drawn as a single bold stroke rising to twin peaks,
// with a terminal cursor block sitting on the baseline beneath it.
// `scale` shrinks it into the maskable safe zone. Centred on (256,256).
function mark(scale) {
  const glow = `filter="url(#glow)"`;
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <g fill="none" stroke="${ACCENT}" stroke-width="50" stroke-linejoin="round" stroke-linecap="round">
      <path d="M136 316 L136 152 L256 260 L376 152 L376 316" ${glow}/>
    </g>
    <rect x="192" y="350" width="128" height="34" rx="17" fill="${ACCENT}" ${glow}/>
  </g>`;
}

function svg({ maskable }) {
  const r = maskable ? 0 : 112; // full-bleed for maskable, rounded tile otherwise
  const markScale = maskable ? 0.72 : 0.9;
  // Double keyline gives the tile an "instrument panel" frame; dropped for the
  // maskable variant so nothing lands in the platform crop zone.
  const frame = maskable
    ? ''
    : `<rect x="7" y="7" width="${S - 14}" height="${S - 14}" rx="${r - 5}" fill="none" stroke="${ACCENT_DIM}" stroke-width="3" opacity="0.55"/>
    <rect x="22" y="22" width="${S - 44}" height="${S - 44}" rx="${r - 17}" fill="none" stroke="${ACCENT_DIM}" stroke-width="1.5" opacity="0.3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="MULTINICHE AI">
  <title>MULTINICHE AI</title>
${defs()}
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#tile)"/>
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#core)"/>
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#vignette)"/>
  ${frame}
  ${mark(markScale)}
</svg>
`;
}

writeFileSync(join(DIR, 'logo.svg'), svg({ maskable: false }));
writeFileSync(join(DIR, 'logo-maskable.svg'), svg({ maskable: true }));
console.log('wrote icons/logo.svg and icons/logo-maskable.svg');
