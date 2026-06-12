// Parity check for The Long Run i18n: every locale must define the
// same duoq_* keys as en.js, with identical {placeholder} sets per key.
import { I18N } from '../src/i18n/index.js';

const en = I18N.en;
const duoqKeys = Object.keys(en).filter(k => k.startsWith('duoq_'));
const ph = (s) => String(s).match(/\{[a-z]+\}/g) || [];

// A locale may use any placeholder the runtime supplies for that key.
// Boss-win lines always receive {w}/{l}/{wv}/{lv}/{a}/{b}; other keys
// receive exactly what en.js uses.
function allowed(key) {
  const base = new Set(ph(en[key]));
  if (/^duoq_q_.*_win$/.test(key)) ['{w}', '{l}', '{wv}', '{lv}', '{a}', '{b}'].forEach(p => base.add(p));
  return base;
}

let bad = 0;
for (const [code, dict] of Object.entries(I18N)) {
  if (code === 'en') continue;
  const missing = duoqKeys.filter(k => !(k in dict));
  const phMismatch = duoqKeys.filter(k => {
    if (!(k in dict)) return false;
    const ok = allowed(k);
    return ph(dict[k]).some(p => !ok.has(p));
  });
  if (missing.length || phMismatch.length) {
    bad++;
    console.log(`✗ ${code}: ${missing.length} missing${missing.length ? ' [' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '…' : '') + ']' : ''}${phMismatch.length ? `, placeholder mismatch in [${phMismatch.join(', ')}]` : ''}`);
  } else {
    console.log(`✓ ${code}: ${duoqKeys.length}/${duoqKeys.length} keys, placeholders intact`);
  }
}
console.log(bad === 0 ? '\nAll locales in parity.' : `\n${bad} locale(s) need fixes.`);
process.exit(bad === 0 ? 0 : 1);
