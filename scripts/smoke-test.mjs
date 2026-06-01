// Headless smoke test for the live site.
//
//   node scripts/smoke-test.mjs                  # remote (yuval.ella.org.il)
//   SMOKE_URL=http://localhost:5173/ node ...    # local dev
//
// Walks the golden path (Landing → upload demo chat → CTA → Onboarding skip
// → Wrapped slides → PostMenu → RoastMode → ShareSheet) and checks that
// every interactive control on the way is present, clickable, and produces
// the expected stage/UI change. Reports pass/fail per check at the end.
//
// Forces locale=en so selectors are stable. Per-stage screenshots land in
// play-store/smoke/ for failure triage.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSampleText } from '../src/lib/sample.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'play-store/smoke');
const URL = process.env.SMOKE_URL || 'http://yuval.ella.org.il/';

if (existsSync(SHOT_DIR)) rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
let stepNo = 0;
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const sym = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${sym} ${name}${detail ? '  —  ' + detail : ''}`);
}
async function shot(page, label) {
  await page.screenshot({ path: join(SHOT_DIR, `${String(++stepNo).padStart(2, '0')}-${label}.png`) });
}

// ── Setup ──────────────────────────────────────────────────────────
console.log('\n› Launching headless Chromium...');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
  locale: 'en-US',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  localStorage.setItem('cw_seen_guide', '1');
  localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
  localStorage.setItem('cw_premium', '0');
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (err) => { pageErrors.push(err.message); console.log(`  ⚠ page error: ${err.message}`); });

console.log(`\n› Loading ${URL}\n`);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await shot(page, 'landing');

// ── Landing ─────────────────────────────────────────────────────────
console.log('LANDING');

const gear = page.locator('button[aria-label="Settings"]').first();
record('settings gear visible', await gear.count() > 0);

const fileInput = page.locator('input[type="file"]').first();
record('file input present', await fileInput.count() > 0);

const switchBtn = page.locator('button', { hasText: /^SWITCH/ }).first();
record('SWITCH button present', await switchBtn.count() > 0);

const howToLink = page.locator('button', { hasText: /Show|How|see how/i }).first();
record('how-to link present', await howToLink.count() > 0);

const demoLink = page.locator('button', { hasText: /demo/i }).first();
record('demo link present', await demoLink.count() > 0);

// ── Settings ────────────────────────────────────────────────────────
if (await gear.count() > 0) {
  console.log('\nSETTINGS (via gear)');
  await gear.click();
  await page.waitForTimeout(700);
  await shot(page, 'settings');

  const settingsTitle = page.locator('text=/^Settings$/').first();
  record('settings: title visible', await settingsTitle.count() > 0);

  // Section title is "Language" — uppercased via text-transform CSS, but
  // the DOM text content stays mixed-case. Match case-insensitively.
  const langSection = page.locator('text=/Language/i').first();
  record('settings: language section visible', await langSection.count() > 0);
  const langChange = page.locator('button', { hasText: /Change/i }).first();
  record('settings: language change button visible', await langChange.count() > 0);

  const premium = page.locator('text=/Premium/').first();
  record('settings: premium section visible', await premium.count() > 0);

  const pp = page.locator('text=/Privacy Policy/i').first();
  record('settings: privacy policy link visible', await pp.count() > 0);

  if (await langChange.count() > 0) {
    await langChange.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(900);  // bottom sheet slide-in animation
    const englishOpt = page.locator('button', { hasText: /English/ }).first();
    const opened = await englishOpt.count() > 0;
    record('settings: language picker opens', opened);
    // Dismiss the sheet by clicking on the backdrop (top of viewport, well
    // above where any sheet content sits). BottomSheet's onClose fires on
    // backdrop click. This is gentler than force-clicking a row.
    await page.mouse.click(195, 60);
    await page.waitForTimeout(700);
  }

  // Wait for any bottom-sheet backdrop to clear before clicking Back.
  await page.waitForTimeout(400);
  const back = page.locator('button[aria-label="Back"]').first();
  if (await back.count() > 0) {
    let backOk = false;
    try {
      await back.click({ timeout: 3000 });
      backOk = true;
    } catch {
      // Backdrop might be intercepting — try forcing the click.
      try { await back.click({ force: true, timeout: 2000 }); backOk = true; } catch {}
    }
    await page.waitForTimeout(700);
    const onLanding = await page.locator('input[type="file"]').count() > 0;
    record('settings: back returns to Landing', backOk && onLanding);
  } else {
    record('settings: back button present', false, 'aria-label="Back" not found');
  }
}

// ── Upload demo chat → click CTA → Parsing ──────────────────────────
console.log('\nUPLOAD + CTA + PARSING');
const SAMPLE = join(SHOT_DIR, 'sample.txt');
writeFileSync(SAMPLE, generateSampleText(), 'utf8');
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
await page.waitForTimeout(800);
await shot(page, 'file-attached');

// The CTA is the gold gradient button at the bottom of Landing.
// Text comes from t.landing_cta. Match broadly to survive copy drift.
const cta = page.locator('button').filter({ hasText: /Expose|Reveal|Play|Wrapped|Recap/i }).last();
const ctaCount = await cta.count();
record('main CTA button visible after upload', ctaCount > 0);
if (ctaCount > 0) await cta.click();
await page.waitForTimeout(900);
await shot(page, 'after-cta');

let advanced = false;
try {
  await page.waitForFunction(() => {
    const t = document.body.innerText || '';
    return /Skip|skip|דלג/i.test(t) ||
           document.querySelector('button[aria-label*="Close" i]') ||
           document.querySelector('button[aria-label*="close" i]');
  }, null, { timeout: 25000 });
  advanced = true;
} catch {}
record('parsing → onboarding/wrapped reached within 25s', advanced);
await shot(page, 'post-parse');

if (advanced) {
  for (let i = 0; i < 4; i++) {
    const skip = page.locator('button').filter({ hasText: /^Skip/i }).first();
    if (await skip.count() === 0) break;
    let clicked = false;
    try {
      await skip.click({ timeout: 6000 });
      clicked = true;
    } catch {
      await page.waitForTimeout(5500);
      try { await skip.click({ timeout: 4000 }); clicked = true; } catch {}
    }
    record(`skip button #${i + 1}`, clicked);
    if (!clicked) break;
    await page.waitForTimeout(900);
  }
  await shot(page, 'wrapped');
}

// ── Wrapped ────────────────────────────────────────────────────────
console.log('\nWRAPPED');

const close = page.locator('button[aria-label*="Close" i]').first();
record('wrapped: close button visible', await close.count() > 0);

async function activeSlideIndex() {
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
const before = await activeSlideIndex();
await page.mouse.click(390 * 0.75, 844 * 0.5);
await page.waitForTimeout(700);
const after = await activeSlideIndex();
record(`wrapped: tap-to-advance increments slide (${before} → ${after})`, after === before + 1);

// Walk the deck. Stop as soon as we hit an ad slot ("Skip ad ↗") or
// PostMenu (Replay CTA); whichever comes first.
for (let i = 0; i < 40; i++) {
  const adSkip = page.locator('button').filter({ hasText: /^Skip/i }).first();
  if (await adSkip.count() > 0) break;
  const menuFound = await page.locator('text=/Watch again|Replay|Play again/i').count();
  if (menuFound > 0) break;
  await page.mouse.click(390 * 0.75, 844 * 0.5);
  await page.waitForTimeout(330);
}
await shot(page, 'after-many-taps');

// If an ad slot (ad_pre_menu) is up, dismiss it; the Skip button arms after
// the 5s countdown.
{
  const adSkip = page.locator('button').filter({ hasText: /^Skip/i }).first();
  if (await adSkip.count() > 0) {
    await page.waitForTimeout(5500);
    try { await adSkip.click({ timeout: 4000 }); } catch {}
    await page.waitForTimeout(900);
  }
}

// ── PostMenu ────────────────────────────────────────────────────────
console.log('\nPOSTMENU');

const replay = page.locator('text=/Watch again|Replay|Play again/i').first();
const onMenu = await replay.count() > 0;
record('reached PostMenu (replay CTA visible)', onMenu);
if (onMenu) await shot(page, 'postmenu');

if (onMenu) {
  // PostMenu surfaces 3 mode tiles (Roast / Duo / Chaos). Profile is a
  // "coming soon" stage with no tile yet — don't assert it.
  const roast    = page.locator('text=/Roast/i').first();
  const duo      = page.locator('text=/Duo|Compare/i').first();
  const chaos    = page.locator('text=/Chaos/i').first();
  record('postmenu: Roast tile visible',    await roast.count()    > 0);
  record('postmenu: Duo tile visible',      await duo.count()      > 0);
  record('postmenu: Chaos tile visible',    await chaos.count()    > 0);

  const switchPerson = page.locator('text=/Switch|VIEWING AS/i').first();
  record('postmenu: switch-person surface visible', await switchPerson.count() > 0);

  // Confidence badge text is "✓ {n}% VERIFIED" — match the number+%.
  const verify = page.locator('text=/100%|Verify|Check/i').first();
  record('postmenu: verify surface visible', await verify.count() > 0);

  if (await roast.count() > 0) {
    try { await roast.click({ timeout: 3000 }); } catch {}
    await page.waitForTimeout(700);

    const adSkip = page.locator('button').filter({ hasText: /^Skip/i }).first();
    if (await adSkip.count() > 0) {
      await page.waitForTimeout(5500);
      try { await adSkip.click({ timeout: 4000 }); } catch {}
      await page.waitForTimeout(700);
    }
    await shot(page, 'roastmode');

    console.log('\nROASTMODE');
    const backTxt = page.locator('text=/← Back|← חזור|^Back$/').first();
    record('roastmode: back link visible', await backTxt.count() > 0);

    const shareBtn = page.locator('button').filter({ hasText: /^Share$/i }).first();
    const hasShare = await shareBtn.count() > 0;
    record('roastmode: share button visible', hasShare);

    if (hasShare) {
      try { await shareBtn.click({ timeout: 3000 }); } catch {}
      await page.waitForTimeout(700);
      await shot(page, 'sharesheet');

      console.log('\nSHARESHEET');
      const wa = page.locator('text=/^WhatsApp$/i').first();
      record('sharesheet: WhatsApp channel visible', await wa.count() > 0);
      const tg = page.locator('text=/^Telegram$/i').first();
      record('sharesheet: Telegram channel visible', await tg.count() > 0);
      const x  = page.locator('text=/^X$/').first();
      record('sharesheet: X channel visible', await x.count() > 0);
      const copyText = page.locator('text=/Copy text/i').first();
      record('sharesheet: copy text action visible', await copyText.count() > 0);
      const copyLink = page.locator('text=/Copy link/i').first();
      record('sharesheet: copy link action visible', await copyLink.count() > 0);
      const cancel = page.locator('button').filter({ hasText: /^Cancel$/i }).first();
      record('sharesheet: cancel button visible', await cancel.count() > 0);
    }
  }
}

// ── Wrap up ─────────────────────────────────────────────────────────
record('no runtime page errors', pageErrors.length === 0, pageErrors.length ? pageErrors.join('; ') : '');

await ctx.close();
await browser.close();

const pass = results.filter(r => r.ok).length;
const fail = results.length - pass;
console.log(`\n${'='.repeat(48)}`);
console.log(` Results: ${pass}/${results.length} passed${fail ? `, ${fail} failed` : ''}`);
console.log(`${'='.repeat(48)}\n`);
console.log(`Screenshots: ${SHOT_DIR}`);

if (fail > 0) {
  console.log('\nFAILURES:');
  for (const r of results) if (!r.ok) console.log(`  ✗ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  process.exit(1);
}
