// Visual check for "Chaos: The Game".
// Flow: lang → name skip → demo → CTA(parse) → CTA(load) → onboarding
//       → Wrapped → ⋮ Menu → Home → MODES → Chaos timeline → play.
import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SHOT = 'c:/tmp/chaos-shots';
if (existsSync(SHOT)) rmSync(SHOT, { recursive: true, force: true });
mkdirSync(SHOT, { recursive: true });
let n = 0;
const shot = async (p, label) => { await p.screenshot({ path: join(SHOT, `${String(++n).padStart(2,'0')}-${label}.png`) }); console.log('  shot:', label); };
const cnt = async (loc) => (await loc.count()) > 0;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true, locale: 'en-US',
});
await ctx.addInitScript(() => {
  localStorage.setItem('cw_seen_guide', '1');
  localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
  localStorage.setItem('cw_premium', '1');
  localStorage.setItem('cw_show_demo', '1');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('  ⚠ pageerror:', e.message); });
const B = (re) => page.locator('button').filter({ hasText: re }).first();
const menuBtn = () => page.locator('button[aria-label="Menu"]').first();
const clickCTA = async () => { const c = page.locator('button').filter({ hasText: /Expose them|Reveal|Play my|View|Open/i }).last(); if (await c.count()) { await c.click({ force: true }).catch(() => {}); return true; } return false; };

async function completeOnboarding(done, max = 16) {
  for (let i = 0; i < max; i++) {
    if (await done()) return true;
    const cont = B(/Continue|Next|Let.s go|Start|See/i);
    if (await cnt(cont)) {
      if (await cont.isEnabled().catch(() => false)) { await cont.click().catch(() => {}); await page.waitForTimeout(700); continue; }
      // Selection-gated: pick first real option card, then retry Continue.
      const card = page.locator('button:not([aria-label])').filter({ hasNotText: /Continue|Next|Skip|Settings|Switch|Expose|Modes|Home/i }).first();
      if (await cnt(card)) { await card.click().catch(() => {}); await page.waitForTimeout(400); continue; }
    }
    const skip = B(/^Skip$/i);
    if (await cnt(skip)) { await skip.click().catch(() => {}); await page.waitForTimeout(700); continue; }
    await page.waitForTimeout(500);
  }
  return await done();
}

console.log('› loading');
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

if (await cnt(B(/English/))) { console.log('› English'); await B(/English/).click(); await page.waitForTimeout(800); }
if (await cnt(B(/^Skip$/i))) { console.log('› skip name'); await B(/^Skip$/i).click(); await page.waitForTimeout(800); }
if (await cnt(B(/demo/i))) { console.log('› demo'); await B(/demo/i).click(); await page.waitForTimeout(1000); }

// CTA #1 — parse the demo chat (returns to landing, recap auto-selected).
console.log('› CTA parse'); await clickCTA();
await page.waitForTimeout(5000);

// CTA #2 — load the recap → onboarding.
console.log('› CTA load'); await clickCTA();
await page.waitForTimeout(1500);

// Complete onboarding → Wrapped.
const inWrapped = await completeOnboarding(async () => cnt(menuBtn()));
console.log('› in wrapped:', inWrapped);
await shot(page, 'wrapped');

// Exit wrapped: ⋮ Menu → Home.
if (await cnt(menuBtn())) {
  await menuBtn().click(); await page.waitForTimeout(600);
  if (await cnt(B(/^Home$/i))) { await B(/^Home$/i).click(); await page.waitForTimeout(900); }
}
await shot(page, 'landing');

// Bottom nav → Modes.
console.log('› modes nav:', await cnt(B(/^Modes$/i)));
if (await cnt(B(/^Modes$/i))) { await B(/^Modes$/i).click(); await page.waitForTimeout(900); }
await shot(page, 'modes');

// Chaos timeline → (relationship set, so straight to title).
console.log('› chaos entry:', await cnt(B(/timeline/i)));
if (await cnt(B(/timeline/i))) { await B(/timeline/i).click(); await page.waitForTimeout(1200); }
await completeOnboarding(async () => cnt(B(/Start the game/i)), 6);
await shot(page, 'chaos-title');

let atTitle = await cnt(B(/Start the game/i));
console.log('› at title:', atTitle);
if (atTitle) {
  await B(/Start the game/i).click(); await page.waitForTimeout(900);
  for (let r = 1; r <= 9; r++) {
    let lock = B(/Lock it in/i);
    if (!(await cnt(lock))) { console.log('  no lock at round', r); break; }
    if (await lock.isDisabled().catch(() => false)) {
      const card = page.locator('button:not([aria-label])').filter({ hasNotText: /Lock it in|Continue|Start the game|Play again|Done/i }).first();
      if (await cnt(card)) { await card.click().catch(() => {}); await page.waitForTimeout(300); }
    }
    await shot(page, `round-${String(r).padStart(2,'0')}-ask`);
    lock = B(/Lock it in/i);
    await lock.click({ timeout: 3000 }).catch((e) => console.log('  lock fail', e.message));
    await page.waitForTimeout(700);
    await shot(page, `round-${String(r).padStart(2,'0')}-reveal`);
    const cont = B(/Continue/i);
    if (!(await cnt(cont))) { console.log('  no continue at round', r); break; }
    await cont.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
  }
  await shot(page, 'finale-score');
}

console.log('\n› page errors:', errors.length ? errors : 'none');
await browser.close();
