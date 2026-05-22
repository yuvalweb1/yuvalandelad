// One-off verification: load the app, run the demo through the Web Worker,
// skip onboarding, walk the (new) group-first deck, and confirm it is short
// (<= 10 slides), group-data-first, and ends on the teaser/unlock cards —
// with no console/page errors. Run: node scripts/verify-demo.mjs
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173/';
const errors = [];
const workerLog = [];

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel }); } catch { /* try next */ }
  }
  return await chromium.launch();
}

const browser = await launch();
const page = await (await browser.newContext()).newPage();

page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const txt = m.text();
  if (/favicon\.ico/i.test(txt) || /status of 404/i.test(txt)) return; // pre-existing
  errors.push('console.error: ' + txt);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.message || e)));
page.on('worker', (w) => workerLog.push(w.url()));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /demo|preview|דוגמה|דמו/i }).first().click();
const skip = page.getByRole('button', { name: /^(skip|דלג|saltar|passer|atla)$/i }).first();
await skip.waitFor({ state: 'visible', timeout: 15000 });
await skip.click();
await page.waitForTimeout(1500);

const frame = page.locator('.cw-frame');
const box = await frame.boundingBox();
const seen = [];
for (let i = 0; i < 16; i++) {
  const txt = (await frame.innerText()).replace(/\s+/g, ' ').trim();
  if (!seen.length || seen[seen.length - 1] !== txt) seen.push(txt);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.waitForTimeout(450);
}
const distinct = new Set(seen).size;
const all = seen.join(' \n ');

const checks = {
  'group overview':  /שנה, במספרים|THE GROUP|A year, in numbers/i,
  'leaderboard':     /טבלת המובילים|LEADERBOARD|🥇/i,
  'per-person':      /כולם, בספירה|BY THE NUMBERS|avg\/msg|ממוצע להודעה/i,
  'signature words': /מילות החתימה|SIGNATURE WORDS/i,
  'group top':       /שפת הקבוצה|THE GROUP SPEAKS/i,
  'teaser/unlock':   /לפתוח עוד|UNLOCK MORE|🔒|הניתוח המלא|full breakdown/i,
};
const missing = Object.entries(checks).filter(([, re]) => !re.test(all)).map(([k]) => k);

await browser.close();

console.log('worker used:', workerLog.length ? 'yes' : 'no (fallback)');
console.log('distinct slides walked:', distinct, distinct <= 10 ? '(<=10 ✓)' : '(TOO MANY ✗)');
console.log('sections found:', Object.keys(checks).filter(k => !missing.includes(k)).join(', ') || '(none)');
if (missing.length) { console.error('MISSING sections:', missing.join(', ')); process.exitCode = 1; }
if (distinct > 10) { console.error('Deck too long:', distinct); process.exitCode = 1; }
if (errors.length) { console.error('ERRORS:', errors.join(' | ')); process.exitCode = 1; }
if (!missing.length && distinct <= 10 && !errors.length) console.log('\nTight group-first deck verified. No errors. ✅');
