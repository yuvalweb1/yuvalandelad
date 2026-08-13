// Copy the self-hosted Twemoji SVG set into public/ so emoji render identically
// on every device instead of relying on the OS emoji font (some devices — e.g.
// older Samsung One UI — lack glyphs for newer emoji and show an empty tofu box).
//
//   node scripts/copy-twemoji.mjs          # copy if missing/stale
//   node scripts/copy-twemoji.mjs --force  # always re-copy
//
// Source: node_modules/@twemoji/svg/*.svg  (jdecked's Twemoji, MIT)
// Output: public/twemoji/svg/*.svg         (gitignored; bundled by Vite + Capacitor)
//
// Runs automatically before `dev` and `build` (see package.json predev/prebuild).
// Idempotent: skips the copy when the output already has the full set, so the
// dev-server start stays instant after the first run.

import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/@twemoji/svg');
const OUT = resolve(ROOT, 'public/twemoji/svg');
const force = process.argv.includes('--force');

if (!existsSync(SRC)) {
  console.error(
    '[twemoji] node_modules/@twemoji/svg not found.\n' +
    '          Run: npm install --save-dev --legacy-peer-deps @twemoji/svg'
  );
  process.exit(1);
}

const svgs = readdirSync(SRC).filter(f => f.endsWith('.svg'));
const have = existsSync(OUT) ? readdirSync(OUT).filter(f => f.endsWith('.svg')).length : 0;

if (!force && have >= svgs.length) {
  console.log(`[twemoji] ${have} SVGs already present in public/twemoji/svg — skipping.`);
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
for (const f of svgs) copyFileSync(join(SRC, f), join(OUT, f));
console.log(`[twemoji] copied ${svgs.length} SVGs → public/twemoji/svg`);
