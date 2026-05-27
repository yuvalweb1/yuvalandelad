// Generate every icon size we need from a single source PNG.
//
//   node scripts/generate-icons.mjs
//
// Source: public/recapped_logo_clean_only_bubbles.png (the "mark", no wordmark).
// Output: Android mipmaps (mdpi → xxxhdpi), PWA icons (192/512), Play Store
// listing icon (512), hi-res master (1024). Each is a square PNG with the
// logo centered on a banana background and ~14% safe-area padding so the
// mark survives Android's adaptive-icon mask crop.
//
// Re-runnable: replace SOURCE and re-execute to refresh every output.

import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'public/recapped_logo_clean_only_bubbles.png');

// Banana (#FFD700) background — same accent the in-app deep gradient uses.
const BG = { r: 0xFF, g: 0xD7, b: 0x00, alpha: 1 };
// Safe-area: keep the logo inside this fraction of the canvas so Android's
// adaptive-icon mask (which crops corners to circles/squircles) doesn't eat
// the bubbles.
const PADDING = 0.14;

async function makeSquare(size) {
  const inset = Math.round(size * PADDING);
  const logoSize = size - inset * 2;
  const logoBuf = await sharp(SOURCE)
    .resize({
      width: logoSize, height: logoSize,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();
  return await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writePng(relPath, buf) {
  const abs = resolve(ROOT, relPath);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(abs, buf);
  console.log('  ✓', relPath, `(${buf.length.toLocaleString()} bytes)`);
}

// Path / target size pairs. Android needs both legacy ic_launcher.png and
// ic_launcher_round.png — we write the same square; the OS rounds it for the
// round variant. Adaptive icons (foreground + background layers) would be a
// follow-up — for v1 the legacy single-asset path is fine.
const TARGETS = [
  // Android launcher (square + round) per density bucket
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',        size: 48  },
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png',  size: 48  },
  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',        size: 72  },
  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png',  size: 72  },
  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',       size: 96  },
  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', size: 96  },
  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',      size: 144 },
  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png',size: 144 },
  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',     size: 192 },
  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png',size: 192 },
  // PWA / manifest
  { path: 'public/icon-192.png', size: 192 },
  { path: 'public/icon-512.png', size: 512 },
  // Play Store listing graphic (hi-res master also lives here)
  { path: 'play-store/icon-512.png',  size: 512  },
  { path: 'play-store/icon-1024.png', size: 1024 },
];

console.log(`Source: ${SOURCE}`);
console.log(`Background: banana ${`#${BG.r.toString(16)}${BG.g.toString(16)}${BG.b.toString(16)}`.toUpperCase()}`);
console.log(`Generating ${TARGETS.length} icons...\n`);

for (const t of TARGETS) {
  const buf = await makeSquare(t.size);
  await writePng(t.path, buf);
}

console.log(`\nDone. ${TARGETS.length} icons written.`);
