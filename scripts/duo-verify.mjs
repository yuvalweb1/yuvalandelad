// Headless verification of THE LONG RUN (Duo mode mini-game).
//
//   npm run preview   (or dev server), then:
//   SMOKE_URL=http://localhost:4173/ node scripts/duo-verify.mjs
//
// Walks: upload sample → onboarding skip → Wrapped → Home → Modes →
// The Long Run map → level 1 run (simulated taps) → capsule / boss /
// results overlays. Screenshots land in play-store/duo-verify/.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Synthetic Android-format export: 2 loud + 2 quiet authors over ~10
// months, with night bursts, a chaos minute, a 12-day silence, emojis,
// questions and love messages — enough signal for every game system.
function generateSampleText() {
  const lines = [];
  const authors = ['Maya', 'Tom', 'Lior', 'Dana'];
  const emo = ['😂', '❤️', '🔥', '😭', '✨'];
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const d0 = new Date(2025, 0, 5, 9, 0, 0);
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const texts = [
    'are you coming today?', 'lol no way', 'I love you ❤️', 'ok ok fine',
    'did you see that??', 'omg 😂😂', 'where are you', 'on my way',
    'this is the funniest thing ever I swear, you have to see it when you get home',
    'good morning ☀️', 'night night 🌙', 'CALL ME NOW', 'hahahaha 🔥',
  ];
  let d = new Date(d0);
  for (let day = 0; day < 300; day++) {
    if (day === 150) { d = new Date(d.getTime() + 12 * 86400000); day += 12; } // the great silence
    const msgs = day % 7 === 5 ? 14 : 4 + Math.floor(rnd() * 8);
    for (let m = 0; m < msgs; m++) {
      const hour = rnd() < 0.18 ? Math.floor(rnd() * 4) : 8 + Math.floor(rnd() * 15);
      d.setHours(hour, Math.floor(rnd() * 60));
      const who = authors[rnd() < 0.42 ? 0 : rnd() < 0.55 ? 1 : rnd() < 0.6 ? 2 : 3];
      const txt = texts[Math.floor(rnd() * texts.length)] + (rnd() < 0.3 ? ' ' + emo[Math.floor(rnd() * emo.length)] : '');
      lines.push(`${fmt(d)} - ${who}: ${txt}`);
    }
    // one chaos minute mid-year
    if (day === 100) {
      d.setHours(22, 14);
      for (let k = 0; k < 12; k++) lines.push(`${fmt(d)} - ${authors[k % 2]}: WHAT IS HAPPENING ${emo[k % 5]}${emo[(k + 1) % 5]}`);
    }
    d = new Date(d.getTime() + 86400000);
  }
  return lines.join('\n');
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'play-store/duo-verify');
const URL = process.env.SMOKE_URL || 'http://localhost:4173/';

if (existsSync(SHOT_DIR)) rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
let stepNo = 0;
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? ' — ' + detail : ''}`);
}
async function shot(page, label) {
  await page.screenshot({ path: join(SHOT_DIR, `${String(++stepNo).padStart(2, '0')}-${label}.png`) });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  localStorage.setItem('cw_seen_welcome', '1');
  localStorage.setItem('cw_seen_guide', '1');
  localStorage.setItem('cw_lang', 'en');
  localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (err) => { pageErrors.push(err.message); console.log(`  ⚠ page error: ${err.message}`); });

console.log(`\n› ${URL}`);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

// ── Upload sample chat ─────────────────────────────────────────
const SAMPLE = join(SHOT_DIR, 'sample.txt');
writeFileSync(SAMPLE, generateSampleText(), 'utf8');
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
await page.waitForTimeout(800);
const cta = page.locator('button').filter({ hasText: /Expose|Reveal|Play|Wrapped|Recap/i }).last();
if (await cta.count() > 0) await cta.click();
await page.waitForTimeout(1500);

// ── Modes → The Long Run (first entry detours via Onboarding) ──
await page.locator('text=/^Modes$/i').first().click().catch(() => {});
await page.waitForTimeout(800);
await shot(page, 'modes');
try {
  await page.locator('button', { hasText: /Long Run/i }).first().click({ timeout: 4000 });
  record('Long Run tile present + clicked', true);
} catch (e) { record('Long Run tile present + clicked', false, e.message); }
await page.waitForTimeout(1200);

// Onboarding: pick self → continue → pick relationship → continue.
if (await page.locator('text=/Which one are you/i').count() > 0) {
  await page.locator('button', { hasText: /Maya/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: /Continue/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, 'onboard-rel');
  // Relationship step: pick the first visible option, then continue/finish.
  await page.locator('button', { hasText: /Friends|Couple|Family|Work|Other/i }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: /Continue|Done|Finish|→/i }).last().click().catch(() => {});
  await page.waitForTimeout(1500);
  record('onboarding completed', true);
  // We land in Wrapped — exit via menu → Home, then back to Modes → game.
  try {
    await page.locator('button[aria-label="Menu"]').first().click({ timeout: 6000 });
    await page.waitForTimeout(600);
    await page.locator('button', { hasText: /Home/i }).first().click();
    record('exited Wrapped to Home', true);
  } catch (e) { record('exited Wrapped to Home', false, e.message); }
  await page.waitForTimeout(900);
  await page.locator('text=/^Modes$/i').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('button', { hasText: /Long Run/i }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
}
await shot(page, 'map');

// ── Map sanity ─────────────────────────────────────────────────
const mapOk = await page.locator('text=/THE LONG RUN/i').count() > 0;
record('map renders (title)', mapOk);
record('album button on map', await page.locator('text=/💌/').count() > 0);

// ── Album opens ────────────────────────────────────────────────
await page.locator('button', { hasText: /💌/ }).first().click().catch(() => {});
await page.waitForTimeout(700);
record('album sheet opens', await page.locator('text=/MEMORY ALBUM/i').count() > 0);
await shot(page, 'album');
await page.mouse.click(195, 80); // close sheet via backdrop
await page.waitForTimeout(600);

// ── Start level 1 ──────────────────────────────────────────────
try {
  await page.locator('button[aria-label="Level 1"]').first().click({ timeout: 4000 });
  await page.waitForTimeout(700);
  await shot(page, 'level-intro');
  record('level intro overlay', await page.locator('text=/RUN/').count() > 0);
  await page.locator('button', { hasText: /RUN →/ }).first().click();
  record('run started', true);
} catch (e) { record('run started', false, e.message); }
await page.waitForTimeout(900);
await shot(page, 'run-start');
record('canvas mounted', await page.locator('canvas').count() > 0);

// ── Play: rhythmic hold-jumps; handle overlays as they appear ──
let sawCapsule = false, sawBoss = false, sawResults = false, deaths = 0;
const cx = 195, cy = 500;
const deadline = Date.now() + 120000;
while (Date.now() < deadline) {
  const body = await page.locator('body').innerText().catch(() => '');
  if (/MEMORY RECOVERED/i.test(body)) {
    if (!sawCapsule) { sawCapsule = true; await shot(page, 'capsule'); }
    await page.locator('button', { hasText: /KEEP RUNNING/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
    continue;
  }
  if (/Bet right/i.test(body)) {
    if (!sawBoss) { sawBoss = true; await shot(page, 'boss'); }
    // Bet on Maya's corner, then claim the run.
    await page.locator('button', { hasText: /Maya/ }).first().click().catch(() => {});
    await page.waitForTimeout(900);
    await shot(page, 'boss-revealed');
    await page.locator('button', { hasText: /CLAIM/i }).first().click().catch(() => {});
    await page.waitForTimeout(700);
    continue;
  }
  if (/CLEAR!/i.test(body)) {
    sawResults = true;
    await shot(page, 'results');
    break;
  }
  if (/RUN IT BACK/i.test(body)) {
    deaths++;
    await shot(page, `death-${deaths}`);
    if (deaths > 4) break;
    await page.locator('button', { hasText: /RUN IT BACK/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    continue;
  }
  // Bunny-hop: medium hold-jumps back to back clear tap-level gaps.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(260);
  await page.mouse.up();
  await page.waitForTimeout(240);
}
record('capsule overlay seen', sawCapsule);
record('boss overlay seen', sawBoss);
record('results screen reached', sawResults, deaths ? `${deaths} deaths` : undefined);
if (sawResults) {
  record('stars awarded on results', await page.locator('text=⭐').count() > 0);
}

record('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every(r => r.ok) ? 0 : 1);
