// Static ad creatives generator.
//
//   node scripts/generate-ads.mjs
//
// Renders the same concept in three aspect ratios via SVG → PNG:
//   • play-store/ad-square-1080.png       Instagram / Facebook feed
//   • play-store/ad-story-1080x1920.png   Stories / Reels / TikTok
//   • play-store/feature-graphic-1024x500.png  Google Play feature graphic
//
// Concept: banana→mango→pink diagonal background, italic "ה-WhatsApp שלך"
// kicker, oversized "עטוף." punchline in eggplant, then a faux Verdict card
// (the roast-mode UI) and a quiet wordmark + URL footer. No emoji in the SVG
// (librsvg renders color emoji unreliably) — just shapes and type.

import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Single layout function. `w` × `h` define the canvas; `scale` lets each
// format pick a base size so the same SVG renders sensibly across squares,
// stories and banners.
function buildSvg({ w, h, layout }) {
  // Layout modes change the composition (vertical vs centered horizontal).
  // Returns a string of inner SVG to drop inside <svg width={w} height={h}>.
  if (layout === 'story') {
    // 1080×1920 portrait — story / reel.
    return `
      <text x="540" y="540" font-family="Georgia, serif" font-style="italic"
            font-size="78" fill="rgba(74,14,78,0.85)" text-anchor="middle">
        ה‑WhatsApp שלך,
      </text>
      <text x="540" y="740" font-family="Inter Tight, Inter, Arial, sans-serif"
            font-size="220" font-weight="900" fill="#4A0E4E" text-anchor="middle"
            letter-spacing="-8">
        עטוף.
      </text>

      ${verdictCard({ cx: 540, cy: 1100, w: 880, h: 320, name: 'מאיה' })}

      <text x="540" y="1640" font-family="Inter, Arial, sans-serif"
            font-size="38" fill="rgba(74,14,78,0.65)" text-anchor="middle"
            font-weight="600">
        13 שקופיות · סטטיסטיקות · רואסטים
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
    return `
      <text x="60" y="160" font-family="Georgia, serif" font-style="italic"
            font-size="44" fill="rgba(74,14,78,0.85)">
        ה‑WhatsApp שלך,
      </text>
      <text x="60" y="320" font-family="Inter Tight, Inter, Arial, sans-serif"
            font-size="170" font-weight="900" fill="#4A0E4E"
            letter-spacing="-5">
        עטוף.
      </text>
      <text x="60" y="400" font-family="Inter, Arial, sans-serif"
            font-size="26" fill="rgba(74,14,78,0.65)" font-weight="600">
        סטטיסטיקות · רואסטים · 100% במכשיר שלך
      </text>
      <text x="60" y="450" font-family="Georgia, serif" font-style="italic"
            font-size="32" fill="#4A0E4E" font-weight="700">
        chat<tspan fill="#FF8C00">wrapped</tspan>
      </text>

      ${verdictCard({ cx: 740, cy: 250, w: 520, h: 280, name: 'יאיר' })}
    `;
  }
  // Default: 1080×1080 square — Instagram / Facebook feed.
  return `
    <text x="540" y="240" font-family="Georgia, serif" font-style="italic"
          font-size="64" fill="rgba(74,14,78,0.85)" text-anchor="middle">
      ה‑WhatsApp שלך,
    </text>
    <text x="540" y="420" font-family="Inter Tight, Inter, Arial, sans-serif"
          font-size="200" font-weight="900" fill="#4A0E4E" text-anchor="middle"
          letter-spacing="-7">
      עטוף.
    </text>

    ${verdictCard({ cx: 540, cy: 700, w: 820, h: 280, name: 'דור' })}

    <text x="540" y="930" font-family="Inter, Arial, sans-serif"
          font-size="32" fill="rgba(74,14,78,0.65)" text-anchor="middle"
          font-weight="600">
      13 שקופיות · סטטיסטיקות · רואסטים
    </text>
    <text x="540" y="1000" font-family="Georgia, serif" font-style="italic"
          font-size="52" fill="#4A0E4E" text-anchor="middle" font-weight="700">
      chat<tspan fill="#FF8C00">wrapped</tspan>
    </text>
  `;
}

// The faux roast verdict card — small dark rounded rectangle with a yellow
// stamp label and an italic 2-line tagline. cx/cy is the card's CENTER.
function verdictCard({ cx, cy, w, h, name }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
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
      <text x="${x + w / 2}" y="${y + 60}" font-family="Inter, Arial, sans-serif"
            font-size="22" fill="#f9c74f" text-anchor="middle"
            font-weight="800" letter-spacing="5">
        ✦  VERDICT
      </text>
      <text x="${x + w / 2}" y="${y + h / 2 + 10}" font-family="Georgia, serif"
            font-style="italic" font-size="46" fill="#fff" text-anchor="middle"
            font-weight="700">
        שלח את זה ל<tspan fill="#f3722c">${name}</tspan>.
      </text>
      <text x="${x + w / 2}" y="${y + h - 50}" font-family="Inter, Arial, sans-serif"
            font-size="26" fill="rgba(255,255,255,0.55)" text-anchor="middle">
        אתה יודע שאתה רוצה.
      </text>
    </g>
  `;
}

// Build one PNG given a target file path + dimensions + layout name.
async function render(out, w, h, layout) {
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

  ${buildSvg({ w, h, layout })}
</svg>`;
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  const abs = resolve(ROOT, out);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(abs, buf);
  console.log('  ✓', out, `${w}×${h}`, `(${buf.length.toLocaleString()} bytes)`);
}

console.log('Generating ad creatives...\n');
await render('play-store/ad-square-1080.png',           1080, 1080, 'square');
await render('play-store/ad-story-1080x1920.png',       1080, 1920, 'story');
await render('play-store/feature-graphic-1024x500.png', 1024, 500,  'banner');
console.log('\nDone. 3 creatives written to play-store/.');
