// Focused kebab/profile test — slower, with more retries.
import { chromium } from 'playwright';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'play-store/bug-sweep/kebab');
if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
const URL = process.env.SMOKE_URL || 'http://yuval.ella.org.il/';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  locale: 'en-US',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
  localStorage.setItem('cw_seen_guide', '1');
  localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
  localStorage.setItem('cw_premium', '0');
  localStorage.setItem('cw_show_demo', '1');
  localStorage.setItem('cw_seen_welcome', '1');
  localStorage.setItem('cw_user_name', 'Jordan');
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    console.log(`[${m.type()}]`, m.text().slice(0, 300));
  }
});

let n = 0;
const shot = async (label) => {
  await page.screenshot({ path: join(SHOT_DIR, `${String(++n).padStart(2,'0')}-${label}.png`) });
};

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await shot('landing');

// Fetch demo chat text, write to local tmp, use setInputFiles
import('node:fs').then(fs => {
  fs.writeFileSync(join(SHOT_DIR, 'sample.txt'), 'placeholder', 'utf8');
});
const SAMPLE_PATH = join(SHOT_DIR, 'sample.txt');
const demoResp = await page.evaluate(async () => {
  const r = await fetch('demo_chat.txt');
  return await r.text();
});
const fs = await import('node:fs');
fs.writeFileSync(SAMPLE_PATH, demoResp, 'utf8');
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_PATH);
await page.waitForTimeout(800);
await shot('after-file-set');

// CTA — use last() like smoke-test does
const cta = page.locator('button').filter({ hasText: /Expose them/i }).last();
console.log('cta count:', await page.locator('button').filter({ hasText: /Expose them/i }).count());
// Use force click + scrollIntoView in case nav element overlays
await cta.scrollIntoViewIfNeeded();
await cta.click({ force: true });
await page.waitForTimeout(2000);
await shot('after-cta-click');
// poll for stage change up to 30s
for (let i = 0; i < 30; i++) {
  const t = await page.evaluate(() => document.body.innerText || '');
  if (/Which one are you|Friends.*Family.*Work|Just us|skip ad/i.test(t)) break;
  if (/SCANNING|PARSING|loading|Reading/i.test(t)) console.log(`  parsing at ${i}s`);
  await page.waitForTimeout(1000);
}
await shot('after-cta');

// Onboarding: name matches Jordan so should skip to relationship
const bodyText = await page.evaluate(() => document.body.innerText || '');
console.log('after-cta body:', bodyText.slice(0, 300));

// Click any relationship option
const friends = page.locator('button').filter({ hasText: /Friends/i }).first();
if (await friends.count() > 0) {
  console.log('clicking Friends');
  await friends.click();
  await page.waitForTimeout(700);
}
await shot('after-relationship');

// Click Continue
for (let i = 0; i < 3; i++) {
  const cont = page.locator('button').filter({ hasText: /Continue|Done|Start/i }).first();
  if (await cont.count() === 0) break;
  try { await cont.click({ timeout: 2000 }); } catch {}
  await page.waitForTimeout(900);
}
await shot('after-continue');

// Skip ad if present
for (let i = 0; i < 2; i++) {
  const skipAd = page.locator('button').filter({ hasText: /^Skip/i }).first();
  if (await skipAd.count() === 0) break;
  try { await skipAd.click({ timeout: 6000 }); }
  catch { await page.waitForTimeout(5500); try { await skipAd.click({ timeout: 3000 }); } catch {} }
  await page.waitForTimeout(800);
}
await shot('after-ad-skip');

await page.waitForTimeout(1500);
await shot('wrapped-arrived');

// Inspect aria-labels on the page
const labels = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button[aria-label]')).map(b => b.getAttribute('aria-label'));
});
console.log('aria-labels on page:', labels);

const kebab = page.locator('button[aria-label="Menu"]').first();
console.log('kebab Menu count:', await kebab.count());

const kebabAny = page.locator('button[aria-label*="enu" i]').first();
console.log('kebab any menu count:', await kebabAny.count());

if (await kebab.count() > 0) {
  await kebab.click();
  await page.waitForTimeout(700);
  await shot('kebab-open');
  const sheetText = await page.evaluate(() => document.body.innerText || '');
  console.log('sheet text:', sheetText.slice(0, 500));
}

await ctx.close();
await browser.close();
