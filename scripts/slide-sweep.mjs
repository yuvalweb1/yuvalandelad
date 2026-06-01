// Visual sweep: walk the entire wrapped deck in English AND Hebrew, taking a
// screenshot of every slide so we can spot overflow / empty / RTL / missing-
// translation bugs.
//
//   node scripts/slide-sweep.mjs                   # remote (yuval.ella.org.il)
//   SWEEP_URL=http://localhost:5173/ node ...      # local
//
// Output: play-store/sweep/<locale>/NN-slide.png

import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSampleText } from '../src/lib/sample.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_ROOT = resolve(ROOT, 'play-store/sweep');
const URL = process.env.SWEEP_URL || 'http://yuval.ella.org.il/';
const LOCALES = ['en', 'he'];
const MAX_SHOTS = 60;

if (existsSync(SHOT_ROOT)) rmSync(SHOT_ROOT, { recursive: true, force: true });
mkdirSync(SHOT_ROOT, { recursive: true });

const SAMPLE_PATH = join(SHOT_ROOT, 'sample.txt');
writeFileSync(SAMPLE_PATH, generateSampleText(), 'utf8');

const allErrors = {};

async function activeSlideIndex(page) {
  return await page.evaluate(() => {
    const segs = document.querySelectorAll('div[style*="position: absolute"][style*="top: 0"] > div');
    if (!segs.length) return -1;
    let idx = -1;
    segs.forEach((s, i) => {
      const bg = getComputedStyle(s).backgroundColor;
      if (bg === 'rgb(255, 255, 255)') idx = i;
    });
    return idx;
  });
}

async function sweepLocale(locale) {
  console.log(`\n========== LOCALE: ${locale} ==========`);
  const shotDir = join(SHOT_ROOT, locale);
  mkdirSync(shotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const navLang = locale === 'he' ? 'he-IL' : 'en-US';
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: navLang,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await ctx.addInitScript((loc) => {
    Object.defineProperty(navigator, 'language', { get: () => loc.nav });
    Object.defineProperty(navigator, 'languages', { get: () => [loc.nav, loc.code] });
    localStorage.setItem('cw_seen_guide', '1');
    localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
    localStorage.setItem('cw_premium', '0');
    localStorage.setItem('cw_lang', loc.code);
  }, { code: locale, nav: navLang });

  const page = await ctx.newPage();
  const errors = [];
  allErrors[locale] = errors;
  page.on('pageerror', (err) => {
    errors.push(err.message);
    console.log(`  [${locale}] page error: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore noisy CSP/font failures; keep real script errors
      if (!/Content Security Policy|font|Failed to load resource/i.test(txt)) {
        errors.push(`console: ${txt}`);
      }
    }
  });

  let shotNo = 0;
  const shot = async (label) => {
    if (shotNo >= MAX_SHOTS) return;
    shotNo += 1;
    await page.screenshot({
      path: join(shotDir, `${String(shotNo).padStart(2, '0')}-${label}.png`),
    });
  };

  console.log(`  Loading ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Upload demo file via Landing's file input
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(SAMPLE_PATH);
  await page.waitForTimeout(900);

  // Click main CTA (gold gradient bottom button). Match across locales.
  const cta = page.locator('button').filter({
    hasText: /Expose|Reveal|Play|Wrapped|Recap|חשוף|חשפו|גלה|גלו|הצג/i,
  }).last();
  if (await cta.count() === 0) {
    console.log(`  [${locale}] CTA not found, dumping body text`);
    const bodyTxt = await page.locator('body').innerText();
    console.log(bodyTxt.slice(0, 500));
  }
  await cta.click();
  await page.waitForTimeout(1200);

  // Wait for parsing → ad/onboard/wrapped. Skip any ads/onboarding.
  await page.waitForFunction(() => {
    const t = document.body.innerText || '';
    return /Skip|skip|דלג/i.test(t)
      || !!document.querySelector('button[aria-label*="Close" i]');
  }, null, { timeout: 30000 }).catch(() => {});
  await shot('post-parse');

  // Burn through up to ~6 skip buttons (post-parse ad + onboard + pre-wrapped ad)
  for (let i = 0; i < 6; i++) {
    const skip = page.locator('button').filter({ hasText: /^Skip|^דלג/i }).first();
    if (await skip.count() === 0) break;
    try {
      await skip.click({ timeout: 6000 });
    } catch {
      await page.waitForTimeout(5500);
      try { await skip.click({ timeout: 4000 }); } catch {}
    }
    await page.waitForTimeout(900);
  }

  // Wait for the close button (wrapped close X) to appear; that confirms we're on Wrapped
  await page.locator('button[aria-label*="Close" i]').first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);

  // Walk slides
  let lastIdx = -2;
  let stuck = 0;
  for (let i = 0; i < MAX_SHOTS - 1; i++) {
    // Check if we reached PostMenu — Replay / Watch again CTA
    const replay = await page.locator('text=/Watch again|Replay|Play again|צפה שוב|נגן שוב|פעם נוספת|שוב/i').count();
    if (replay > 0) {
      await shot('postmenu');
      console.log(`  [${locale}] hit PostMenu after ${shotNo} screenshots`);
      break;
    }

    // Check if we hit an ad slot — skip it.
    const adSkip = page.locator('button').filter({ hasText: /^Skip|^דלג/i }).first();
    if (await adSkip.count() > 0) {
      await shot('ad-slot');
      await page.waitForTimeout(5500);
      try { await adSkip.click({ timeout: 4000 }); } catch {}
      await page.waitForTimeout(900);
      continue;
    }

    const idx = await activeSlideIndex(page);
    await shot(`slide-${String(idx).padStart(2, '0')}`);
    if (idx === lastIdx) {
      stuck += 1;
      if (stuck >= 3) {
        console.log(`  [${locale}] appears stuck at slide ${idx}, stopping`);
        break;
      }
    } else {
      stuck = 0;
      lastIdx = idx;
    }

    // Tap right side to advance
    await page.mouse.click(390 * 0.78, 844 * 0.5);
    await page.waitForTimeout(500);
  }

  await ctx.close();
  await browser.close();
  console.log(`  [${locale}] done — ${shotNo} screenshots, ${errors.length} errors`);
}

for (const locale of LOCALES) {
  try {
    await sweepLocale(locale);
  } catch (err) {
    console.error(`\nLocale ${locale} crashed:`, err.message);
  }
}

console.log('\n========== SUMMARY ==========');
for (const locale of LOCALES) {
  const errs = allErrors[locale] || [];
  console.log(`${locale}: ${errs.length} runtime errors`);
  for (const e of errs.slice(0, 10)) console.log(`   • ${e}`);
}
console.log(`\nScreenshots: ${SHOT_ROOT}`);
