// Hebrew visual sweep: walks the same golden path as smoke-test, but in HE,
// dumping screenshots so we can eyeball that the i18n fixes landed.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSampleText } from '../src/lib/sample.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'play-store/sweep-he');
const URL = process.env.SMOKE_URL || 'http://localhost:4173/';

if (existsSync(SHOT_DIR)) rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

let stepNo = 0;
async function shot(page, label) {
  await page.screenshot({ path: join(SHOT_DIR, `${String(++stepNo).padStart(2, '0')}-${label}.png`) });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
  locale: 'he-IL',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'language', { get: () => 'he-IL' });
  Object.defineProperty(navigator, 'languages', { get: () => ['he-IL', 'he'] });
  localStorage.setItem('cw_seen_guide', '1');
  localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
  localStorage.setItem('cw_premium', '0');
  localStorage.setItem('cw_lang', 'he');
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (err) => { pageErrors.push(err.message); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await shot(page, 'landing');

// Upload demo file
const SAMPLE = join(SHOT_DIR, 'sample.txt');
writeFileSync(SAMPLE, generateSampleText(), 'utf8');
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
await page.waitForTimeout(800);
await shot(page, 'landing-with-file');

// Click CTA (gold gradient button at bottom)
const cta = page.locator('button').filter({ hasText: /חשוף|Expose|Reveal/i }).last();
if (await cta.count() > 0) await cta.click();
await page.waitForTimeout(900);

// Skip ad + onboarding
for (let i = 0; i < 4; i++) {
  const skip = page.locator('button').filter({ hasText: /^Skip|דלג/i }).first();
  if (await skip.count() === 0) break;
  try { await skip.click({ timeout: 6000 }); } catch {
    await page.waitForTimeout(5500);
    try { await skip.click({ timeout: 4000 }); } catch {}
  }
  await page.waitForTimeout(800);
}
await shot(page, 'wrapped-start');

// Walk slides until ad or menu
for (let i = 0; i < 40; i++) {
  const adSkip = page.locator('button').filter({ hasText: /^Skip|דלג/i }).first();
  if (await adSkip.count() > 0) break;
  const menuFound = await page.locator('text=/הצג שוב|REPLAY/i').count();
  if (menuFound > 0) break;
  if (i % 3 === 0) await shot(page, `slide-${String(i).padStart(2,'0')}`);
  await page.mouse.click(390 * 0.75, 844 * 0.5);
  await page.waitForTimeout(330);
}

// Skip ad_pre_menu
{
  const adSkip = page.locator('button').filter({ hasText: /^Skip|דלג/i }).first();
  if (await adSkip.count() > 0) {
    await page.waitForTimeout(5500);
    try { await adSkip.click({ timeout: 4000 }); } catch {}
    await page.waitForTimeout(900);
  }
}
await shot(page, 'postmenu');

await ctx.close();
await browser.close();

console.log(`\n› Hebrew sweep complete. ${pageErrors.length} runtime errors.`);
console.log(`› Screenshots: ${SHOT_DIR}`);
if (pageErrors.length) {
  console.log('\nErrors:');
  for (const e of pageErrors) console.log('  -', e);
}
