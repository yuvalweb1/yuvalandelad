// One-off verification: load the app, run the demo through the Web Worker,
// skip onboarding, walk every slide, and confirm the new Step-3 slides
// (Novelist / Ghoster / Vibe Check) render with no console/page errors.
// Not part of the app. Run: node scripts/verify-demo.mjs
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
  if (/favicon\.ico/i.test(txt)) return;            // pre-existing, unrelated
  if (/status of 404/i.test(txt)) return;            // favicon (URL not in text)
  errors.push('console.error: ' + txt);
});
page.on('pageerror', (e) => errors.push('pageerror: ' + (e.message || e)));
page.on('worker', (w) => workerLog.push(w.url()));

await page.goto(URL, { waitUntil: 'networkidle' });

// Landing -> demo
await page.getByRole('button', { name: /demo|preview|דוגמה|דמו/i }).first().click();

// Onboarding -> Skip straight into the wrapped player
const skip = page.getByRole('button', { name: /^(skip|דלג|saltar|passer|atla)$/i }).first();
await skip.waitFor({ state: 'visible', timeout: 15000 });
await skip.click();
await page.waitForTimeout(1500);

// Walk slides via the "next" tap-zone (right 70%), collecting visible text.
const frame = page.locator('.cw-frame');
const box = await frame.boundingBox();
const seen = [];
for (let i = 0; i < 32; i++) {
  const txt = (await page.locator('.cw-frame').innerText()).replace(/\s+/g, ' ').trim();
  seen.push(txt);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.waitForTimeout(450);
}
const all = seen.join(' \n ');

const checks = {
  'Novelist': /✍️|הסופר|novelist/i,
  'Ghoster':  /👻|גוסטינג|ghoster/i,
  'VibeCheck': /✨|וַייב|וייב|בדיקת|vibe/i,
};
const missing = Object.entries(checks).filter(([, re]) => !re.test(all)).map(([k]) => k);

await browser.close();

console.log('worker used:', workerLog.length ? 'yes (' + workerLog[0] + ')' : 'no (fallback)');
console.log('distinct slide texts captured:', new Set(seen).size);
console.log('new slides found:', Object.keys(checks).filter(k => !missing.includes(k)).join(', ') || '(none)');
if (missing.length) { console.error('MISSING new slides:', missing.join(', ')); process.exitCode = 1; }
if (errors.length) {
  console.error('\nERRORS (' + errors.length + '):');
  for (const e of errors) console.error('  - ' + e);
  process.exitCode = 1;
}
if (!missing.length && !errors.length) console.log('\nAll 3 Step-3 slides rendered. No errors. ✅');
