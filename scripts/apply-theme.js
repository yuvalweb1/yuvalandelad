import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const THEME_PATH = join(ROOT, 'theme.json');
const APP_PATH = join(ROOT, 'src', 'App.jsx');

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const isHexKey = k => /^#[0-9a-fA-F]{3,8}$/.test(k);
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function apply() {
  const theme = JSON.parse(readFileSync(THEME_PATH, 'utf8'));
  let content = readFileSync(APP_PATH, 'utf8');
  let total = 0;

  console.log('Applying theme.json → src/App.jsx\n');

  const colorEntries = Object.entries(theme.colors || {}).filter(
    ([k, v]) => isHexKey(k) && typeof v === 'string' && v !== k
  );

  const rgbLookup = {};
  for (const [oldHex, newHex] of colorEntries) {
    const { r, g, b } = hexToRgb(oldHex);
    rgbLookup[`${r},${g},${b}`] = newHex;
  }

  const sortedByLen = [...colorEntries].sort((a, b) => b[0].length - a[0].length);
  for (const [oldHex, newHex] of sortedByLen) {
    const re = new RegExp(escapeRegex(oldHex) + '(?![0-9a-fA-F])', 'gi');
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, newHex);
      console.log(`  hex   ${oldHex} → ${newHex}  ×${matches.length}`);
      total += matches.length;
    }
  }

  if (Object.keys(rgbLookup).length > 0) {
    let rgbaCount = 0;
    content = content.replace(
      /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g,
      (match, r, g, b, a) => {
        const newHex = rgbLookup[`${r},${g},${b}`];
        if (!newHex) return match;
        const { r: nr, g: ng, b: nb } = hexToRgb(newHex);
        rgbaCount++;
        return `rgba(${nr},${ng},${nb},${a})`;
      }
    );
    if (rgbaCount > 0) {
      console.log(`  rgba  (auto-converted to match remapped hex)  ×${rgbaCount}`);
      total += rgbaCount;
    }
  }

  const fontEntries = Object.entries(theme.fonts || {}).filter(
    ([k, v]) => typeof v === 'string' && v !== k
  );
  for (const [oldFont, newFont] of fontEntries) {
    const re = new RegExp(`(['"])${escapeRegex(oldFont)}(['"])`, 'g');
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, `$1${newFont}$2`);
      console.log(`  font  ${oldFont} → ${newFont}  ×${matches.length}`);
      total += matches.length;
    }
  }

  if (total === 0) {
    console.log('No changes — theme.json values match the current file.');
    return;
  }

  writeFileSync(APP_PATH, content, 'utf8');
  console.log(`\n${total} replacements applied to src/App.jsx`);
  console.log('  preview:  npm run dev');
  console.log('  undo:     git checkout src/App.jsx');
}

apply();
