// i18n completeness guard.
//
// en.js is the single source of truth for the KEY SET. Every other locale must
// define exactly the same keys — no missing keys (which silently fall back to
// English in buildT) and no stray keys (dead translations nobody renders).
//
// This is the mechanism behind "a new mode/slide is instantly available in every
// language": add the key to en.js, run `npm run i18n:check`, and it tells you
// precisely which locale files still need the string. Wire it into CI / a
// pre-commit hook to make the requirement enforceable rather than aspirational.
//
//   npm run i18n:check        # report; exits non-zero if anything is off
//   npm run i18n:check -- --fix  # stub every missing key with its English value
//
// --fix unblocks shipping a feature without hand-translating 14 files in the same
// PR: it copies the English string so the key exists everywhere (still readable,
// just not localized yet), and flags them with a `// TODO i18n` marker so the
// untranslated strings are easy to grep for later.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(HERE, '..', 'src', 'i18n');

// Keep this list in sync with i18n/index.js (the picker in Settings.jsx reads
// from there). en is the reference and is intentionally excluded from checks.
const LOCALES = ['he', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'ar', 'tr', 'hi', 'zh', 'ja', 'ko'];

const fix = process.argv.includes('--fix');

const load = async (code) => (await import(`file://${join(I18N_DIR, `${code}.js`)}`)).default;

const en = await load('en');
const enKeys = Object.keys(en);

let totalMissing = 0;
let totalExtra = 0;
const report = [];

for (const code of LOCALES) {
  const dict = await load(code);
  const keys = new Set(Object.keys(dict));
  const missing = enKeys.filter((k) => !keys.has(k));
  const extra = Object.keys(dict).filter((k) => !(k in en));

  totalMissing += missing.length;
  totalExtra += extra.length;

  report.push({ code, missing, extra, count: keys.size });

  if (fix && missing.length) {
    stubMissing(code, missing);
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n  i18n completeness — reference: en (${enKeys.length} keys)\n`);
for (const { code, missing, extra, count } of report) {
  const ok = missing.length === 0 && extra.length === 0;
  const mark = ok ? '✓' : '✗';
  console.log(
    `  ${mark} ${pad(code, 4)} ${pad(`${count} keys`, 12)}` +
      (missing.length ? ` · missing ${missing.length}` : '') +
      (extra.length ? ` · extra ${extra.length}` : ''),
  );
  if (!ok && !fix) {
    if (missing.length) console.log(`        missing: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ` …(+${missing.length - 12})` : ''}`);
    if (extra.length) console.log(`        extra:   ${extra.slice(0, 12).join(', ')}${extra.length > 12 ? ` …(+${extra.length - 12})` : ''}`);
  }
}

if (fix) {
  console.log(`\n  --fix: stubbed missing keys with English values (look for "// TODO i18n").`);
  console.log(`  Re-run without --fix after translating.\n`);
  process.exit(0);
}

if (totalMissing === 0 && totalExtra === 0) {
  console.log(`\n  All ${LOCALES.length} locales are complete. ✓\n`);
  process.exit(0);
}

console.log(`\n  ✗ ${totalMissing} missing key(s), ${totalExtra} stray key(s) across locales.`);
console.log(`  Add the missing strings (or run \`npm run i18n:check -- --fix\` to stub them).\n`);
process.exit(1);

// --- helpers -------------------------------------------------------------

// Append stubbed keys before the final closing brace of a locale file. Cheap and
// format-tolerant: we don't parse/serialize (which would mangle comments and the
// hand-tuned ordering), we just splice lines in before the last `}`.
function stubMissing(code, missing) {
  const file = join(I18N_DIR, `${code}.js`);
  const src = readFileSync(file, 'utf8');
  const lastBrace = src.lastIndexOf('}');
  if (lastBrace === -1) {
    console.warn(`  ! ${code}.js: no closing brace found, skipping --fix`);
    return;
  }
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const lines = missing.map((k) => `  ${k}: '${esc(en[k])}', // TODO i18n`).join('\n');
  const next = `${src.slice(0, lastBrace)}\n  // ---- auto-stubbed by i18n-check --fix (translate these) ----\n${lines}\n${src.slice(lastBrace)}`;
  writeFileSync(file, next);
}
