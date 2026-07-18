// Generates the MULTINICHE AI matrix logo as SVG (standard + maskable variants).
// Deterministic output — no randomness — so re-runs are byte-stable.
// Run: node icons/build-logo.mjs   (writes icons/logo.svg + icons/logo-maskable.svg)

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const S = 512; // canvas size

// --- palette (mirrors the storefront CSS custom properties) ---
const INK_A = '#041b0d';
const INK_B = '#00060a'; // note: slight teal-black so the tile has depth
const GREEN = '#00FF41';
const GREEN_DIM = '#0d7a2e';
const GREEN_MID = '#23C552';

// Deterministic pseudo-random: mulberry32 seeded once.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build the matrix-rain backdrop: vertical columns of glyph "cells"
// that fade from a bright leading char up into darkness. Glyphs are
// tiny rects (0/1/dash segments) so no font is required at raster time.
function rain(seed, opacityScale) {
  const rand = rng(seed);
  const cols = 9;
  const colW = S / cols;
  const cell = 30; // vertical spacing of glyphs
  let out = '';
  for (let c = 0; c < cols; c++) {
    const cx = colW * c + colW / 2;
    const head = Math.floor(rand() * (S / cell)); // leading glyph index
    const len = 5 + Math.floor(rand() * 7); // trail length
    for (let i = 0; i < len; i++) {
      const idx = head - i;
      if (idx < 0) continue;
      const y = idx * cell + 6;
      const lead = i === 0;
      const op = (lead ? 0.85 : Math.max(0.05, 0.4 - i * 0.055)) * opacityScale;
      const fill = lead ? GREEN : GREEN_MID;
      // glyph = 2-3 short horizontal segments to suggest a digital character
      const g = rand();
      const w = 11 + Math.round(rand() * 5);
      const x = cx - w / 2;
      if (g < 0.4) {
        // "1"-like vertical tick
        out += `<rect x="${(cx - 2).toFixed(1)}" y="${y}" width="4" height="18" rx="1.5" fill="${fill}" opacity="${op.toFixed(3)}"/>`;
      } else if (g < 0.75) {
        // "0"/box-like
        out += `<rect x="${x.toFixed(1)}" y="${y}" width="${w}" height="18" rx="3" fill="none" stroke="${fill}" stroke-width="3" opacity="${op.toFixed(3)}"/>`;
      } else {
        // dash stack
        out += `<rect x="${x.toFixed(1)}" y="${y}" width="${w}" height="4" rx="2" fill="${fill}" opacity="${op.toFixed(3)}"/>`;
        out += `<rect x="${x.toFixed(1)}" y="${y + 8}" width="${(w * 0.6).toFixed(1)}" height="4" rx="2" fill="${fill}" opacity="${(op * 0.8).toFixed(3)}"/>`;
        out += `<rect x="${x.toFixed(1)}" y="${y + 14}" width="${w}" height="4" rx="2" fill="${fill}" opacity="${(op * 0.9).toFixed(3)}"/>`;
      }
    }
  }
  return out;
}

// The terminal prompt mark: a bold ">" chevron + underscore cursor,
// glowing. Centred on (256,256); `scale` shrinks it for the maskable
// safe zone.
function mark(scale) {
  const glow = `filter="url(#glow)"`;
  const body = `
    <g stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M182 168 L286 256 L182 344" stroke="${GREEN}" stroke-width="40" ${glow}/>
      <rect x="300" y="322" width="120" height="30" rx="15" fill="${GREEN}" ${glow}/>
    </g>`;
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${body}</g>`;
}

function defs() {
  return `
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${INK_A}"/>
      <stop offset="1" stop-color="${INK_B}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="46%" r="62%">
      <stop offset="0" stop-color="#000000" stop-opacity="0.72"/>
      <stop offset="0.55" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

function svg({ maskable }) {
  const r = maskable ? 0 : 112; // full-bleed for maskable, rounded tile otherwise
  const markScale = maskable ? 0.78 : 0.92;
  const border = maskable
    ? ''
    : `<rect x="6" y="6" width="${S - 12}" height="${S - 12}" rx="${r - 4}" fill="none" stroke="${GREEN_DIM}" stroke-width="3" opacity="0.55"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="MULTINICHE AI">
  <title>MULTINICHE AI</title>
${defs()}
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#tile)"/>
  <g opacity="0.9">${rain(1337, maskable ? 0.5 : 0.6)}</g>
  <rect x="0" y="0" width="${S}" height="${S}" rx="${r}" fill="url(#vignette)"/>
  ${border}
  ${mark(markScale)}
</svg>
`;
}

writeFileSync(join(DIR, 'logo.svg'), svg({ maskable: false }));
writeFileSync(join(DIR, 'logo-maskable.svg'), svg({ maskable: true }));
console.log('wrote icons/logo.svg and icons/logo-maskable.svg');
