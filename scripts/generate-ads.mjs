// Static ad creatives generator.
//
//   node scripts/generate-ads.mjs
//
// Renders the same concept in three aspect ratios x two languages via
// SVG → PNG. Six files total:
//   • play-store/ad-square-1080-{en,he}.png       Instagram / Facebook feed
//   • play-store/ad-story-1080x1920-{en,he}.png   Stories / Reels / TikTok
//   • play-store/feature-graphic-1024x500-{en,he}.png  Google Play feature graphic
//
// Concept: banana→mango→pink diagonal background, italic kicker, oversized
// punchline in eggplant, then a faux Verdict card (the roast-mode UI) and a
// quiet wordmark + URL footer. No emoji in the SVG (librsvg renders color
// emoji unreliably) — just shapes and type.

import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Per-language copy. NOTE: Hebrew is currently disabled (see the loop at
// the bottom) because librsvg — which sharp uses to rasterize SVG — does
// not reliably bidi-shape Hebrew text or place mid-line accent spans
// correctly. The HE entries are kept for the day we swap to a Chromium-
// based renderer (puppeteer / playwright), or for hand-editing in Canva.
const COPY = {
  en: {
    kicker:    'your WhatsApp,',
    punch:     'WRAPPED.',
    sub:       '13 slides · stats · roasts',
    subBanner: '13 slides · stats · roasts · 100% on your device',
    verdictLabel: '✦  VERDICT',
    verdictLine1: (name) => ['Send this to ', name, '.'],
    verdictLine2: 'You know you want to.',
    sampleName: 'Maya',
  },
  he: {
    kicker:    'ה-WhatsApp שלך,',
    punch:     'עטוף.',
    sub:       '13 שקופיות · סטטיסטיקות · רואסטים',
    subBanner: '13 שקופיות · סטטיסטיקות · רואסטים · 100% במכשיר שלך',
    verdictLabel: '✦  VERDICT',
    verdictLine1: (name) => ['שלח את זה ל', name, '.'],
    verdictLine2: 'אתה יודע שאתה רוצה.',
    sampleName: 'דור',
  },
};

// Single layout function. `w` × `h` define the canvas; `layout` picks the
// composition; `c` is the per-language copy object from COPY[lang].
function buildSvg({ w, h, layout, c }) {
  if (layout === 'story') {
    // 1080×1920 portrait — story / reel.
    return `
      <text x="540" y="540" font-family="Georgia, serif" font-style="italic"
            font-size="78" fill="rgba(74,14,78,0.85)" text-anchor="middle">
        ${c.kicker}
      </text>
      <text x="540" y="740" font-family="Inter Tight, Inter, Arial, sans-serif"
            font-size="220" font-weight="900" fill="#4A0E4E" text-anchor="middle"
            letter-spacing="-8">
        ${c.punch}
      </text>

      ${verdictCard({ cx: 540, cy: 1100, w: 880, h: 320, c })}

      <text x="540" y="1640" font-family="Inter, Arial, sans-serif"
            font-size="38" fill="rgba(74,14,78,0.65)" text-anchor="middle"
            font-weight="600">
        ${c.sub}
      </text>
      <text x="540" y="1740" font-family="Georgia, serif" font-style="italic"
            font-size="62" fill="#4A0E4E" text-anchor="middle" font-weight="700">
        chat<tspan fill="#FF8C00">wrapped</tspan>
      </text>
      <text x="540" y="1810" font-family="Inter, Arial, sans-serif"
            font-size="30" fill="rgba(74,14,78,0.55)" text-anchor="middle"
            font-weight="600" letter-spacing="2">
        yuval.ella.org.il
      </text>
    `;
  }
  if (layout === 'banner') {
    // 1024×500 landscape — Play Store feature graphic.
    // Two columns: text on the left, Verdict card on the right. Sizing was
    // tuned so 'WRAPPED.' at fontSize 120 (width ~480px) plus 30px gap fits
    // before the card column starts at x=560.
    return `
      <text x="50" y="130" font-family="Georgia, serif" font-style="italic"
            font-size="40" fill="rgba(74,14,78,0.85)">
        ${c.kicker}
      </text>
      <text x="50" y="250" font-family="Inter Tight, Inter, Arial, sans-serif"
            font-size="100" font-weight="900" fill="#4A0E4E"
            letter-spacing="-4">
        ${c.punch}
      </text>
      <text x="50" y="330" font-family="Inter, Arial, sans-serif"
            font-size="22" fill="rgba(74,14,78,0.70)" font-weight="600">
        ${c.subBanner}
      </text>
      <text x="50" y="390" font-family="Georgia, serif" font-style="italic"
            font-size="32" fill="#4A0E4E" font-weight="700">
        chat<tspan fill="#FF8C00">wrapped</tspan>
      </text>

      ${verdictCard({ cx: 800, cy: 250, w: 400, h: 240, c, compact: true })}
    `;
  }
  // Default: 1080×1080 square — Instagram / Facebook feed.
  return `
    <text x="540" y="240" font-family="Georgia, serif" font-style="italic"
          font-size="64" fill="rgba(74,14,78,0.85)" text-anchor="middle">
      ${c.kicker}
    </text>
    <text x="540" y="420" font-family="Inter Tight, Inter, Arial, sans-serif"
          font-size="200" font-weight="900" fill="#4A0E4E" text-anchor="middle"
          letter-spacing="-7">
      ${c.punch}
    </text>

    ${verdictCard({ cx: 540, cy: 700, w: 820, h: 280, c })}

    <text x="540" y="930" font-family="Inter, Arial, sans-serif"
          font-size="32" fill="rgba(74,14,78,0.65)" text-anchor="middle"
          font-weight="600">
      ${c.sub}
    </text>
    <text x="540" y="1000" font-family="Georgia, serif" font-style="italic"
          font-size="52" fill="#4A0E4E" text-anchor="middle" font-weight="700">
      chat<tspan fill="#FF8C00">wrapped</tspan>
    </text>
  `;
}

// The faux roast verdict card — small dark rounded rectangle with a yellow
// stamp label and an italic 2-line tagline. cx/cy is the card's CENTER.
// `compact` shrinks the text for narrow cards (used in the banner layout
// where the card has to share the canvas with the WRAPPED. word).
function verdictCard({ cx, cy, w, h, c, compact = false }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const labelSize = compact ? 16 : 22;
  const labelSpace = compact ? 3 : 5;
  const lineSize  = compact ? 32 : 46;
  const subSize   = compact ? 18 : 26;
  // verdictLine1 returns [prefix, highlightedName, suffix]; we splice the
  // accent-colored sample name in the middle while keeping the rest white.
  const [pre, name, post] = c.verdictLine1(c.sampleName);
  return `
    <g>
      <defs>
        <radialGradient id="cardGrad" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stop-color="#3a1812" />
          <stop offset="60%" stop-color="#1a0606" />
        </radialGradient>
      </defs>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28"
            fill="url(#cardGrad)" stroke="rgba(243,114,44,0.30)" stroke-width="2" />
      <text x="${x + w / 2}" y="${y + (compact ? 44 : 60)}" font-family="Inter, Arial, sans-serif"
            font-size="${labelSize}" fill="#f9c74f" text-anchor="middle"
            font-weight="800" letter-spacing="${labelSpace}">
        ${c.verdictLabel}
      </text>
      <text x="${x + w / 2}" y="${y + h / 2 + 8}" font-family="Georgia, serif"
            font-style="italic" font-size="${lineSize}" fill="#fff" text-anchor="middle"
            font-weight="700">
        ${pre}<tspan fill="#f3722c">${name}</tspan>${post}
      </text>
      <text x="${x + w / 2}" y="${y + h - (compact ? 36 : 50)}" font-family="Inter, Arial, sans-serif"
            font-size="${subSize}" fill="rgba(255,255,255,0.55)" text-anchor="middle">
        ${c.verdictLine2}
      </text>
    </g>
  `;
}

// Build one PNG given a target file path + dimensions + layout + language.
async function render(out, w, h, layout, lang) {
  const c = COPY[lang];
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#FFE45C" />
      <stop offset="45%" stop-color="#FFD700" />
      <stop offset="85%" stop-color="#FF8C00" />
      <stop offset="100%" stop-color="#FF69B4" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" />

  <!-- Soft blur "blobs" for organic energy -->
  <circle cx="${w * 0.85}" cy="${h * 0.18}" r="${Math.min(w, h) * 0.18}"
          fill="#FFFFFF" opacity="0.28" />
  <circle cx="${w * 0.12}" cy="${h * 0.85}" r="${Math.min(w, h) * 0.22}"
          fill="#FF1867" opacity="0.18" />

  ${buildSvg({ w, h, layout, c })}
</svg>`;
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  const abs = resolve(ROOT, out);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(abs, buf);
  console.log('  ✓', out, `${w}×${h}`, `(${buf.length.toLocaleString()} bytes)`);
}

// Hebrew is disabled — see COPY comment above. Re-enable by adding 'he'.
const LANGS = ['en'];

console.log('Generating ad creatives...\n');
for (const lang of LANGS) {
  await render(`play-store/ad-square-1080-${lang}.png`,           1080, 1080, 'square', lang);
  await render(`play-store/ad-story-1080x1920-${lang}.png`,       1080, 1920, 'story',  lang);
  await render(`play-store/feature-graphic-1024x500-${lang}.png`, 1024, 500,  'banner', lang);
}
console.log(`\nDone. ${LANGS.length * 3} creatives written to play-store/.`);
console.log('Hebrew creatives: build in Canva — see play-store/AD_COPY.md.');
