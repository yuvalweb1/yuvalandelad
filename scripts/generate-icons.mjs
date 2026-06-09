// Generate every icon size we need from a single source PNG.
//
//   node scripts/generate-icons.mjs
//
// Source: public/recapped_logo_clean_only_bubbles.png (the "mark", no wordmark).
// Output: Android mipmaps (mdpi → xxxhdpi), PWA icons (192/377), Play Store
// listing icon (377), hi-res master (1024). Each is a square PNG resized from
// the source — colors and background are preserved exactly as-is.
//
// Re-runnable: replace SOURCE and re-execute to refresh every output.

import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'public/icon-512.png');

async function makeSquare(size) {
  return await sharp(SOURCE)
    .resize({ width: size, height: size, fit: 'fill' })
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
  { path: 'public/icon-377.png', size: 377 },
  // Play Store listing graphic (hi-res master also lives here)
  { path: 'play-store/icon-377.png',  size: 377  },
  { path: 'play-store/icon-1024.png', size: 1024 },
];

console.log(`Source: ${SOURCE}`);
console.log(`Generating ${TARGETS.length} icons...\n`);

for (const t of TARGETS) {
  const buf = await makeSquare(t.size);
  await writePng(t.path, buf);
}

console.log(`\nDone. ${TARGETS.length} icons written.`);
