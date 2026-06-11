// Quick screenshot pass over the 2-step Welcome flow.
import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'play-store/welcome-snap');
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
  locale: 'he-IL',
});
await ctx.addInitScript(() => {
  // Force fresh first-run state
  localStorage.removeItem('cw_seen_welcome');
  localStorage.removeItem('cw_seen_guide');
  localStorage.removeItem('cw_user_name');
  localStorage.removeItem('cw_lang');
});
const page = await ctx.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.screenshot({ path: resolve(OUT, '1-language.png') });

// Tap Hebrew
await page.locator('button', { hasText: 'עברית' }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: resolve(OUT, '2-name-empty.png') });

// Type a name
await page.locator('input[type="text"]').first().fill('יובל');
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(OUT, '3-name-typed.png') });

await ctx.close();
await browser.close();
console.log(`Saved to ${OUT}`);
