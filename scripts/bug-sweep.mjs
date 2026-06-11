// Extended Playwright bug sweep against live site.
// Covers: Welcome questionnaire, auto-match, kebab menu, profile sheet,
// Modes "coming soon" modal, PaymentSheet.
//
//   SMOKE_URL=http://yuval.ella.org.il/ node scripts/bug-sweep.mjs

import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = resolve(ROOT, 'play-store/bug-sweep');
const URL = process.env.SMOKE_URL || 'http://yuval.ella.org.il/';

if (existsSync(SHOT_DIR)) rmSync(SHOT_DIR, { recursive: true, force: true });
mkdirSync(SHOT_DIR, { recursive: true });

const bugs = [];
const allPageErrors = [];
const allConsoleErrors = [];
let stepNo = 0;

function bug(severity, step, expected, actual) {
  bugs.push({ severity, step, expected, actual });
  console.log(`  [${severity}] ${step}\n    expected: ${expected}\n    actual:   ${actual}`);
}
async function shot(page, label) {
  try {
    await page.screenshot({ path: join(SHOT_DIR, `${String(++stepNo).padStart(2, '0')}-${label}.png`) });
  } catch {}
}

async function newCtx(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    locale: opts.locale || 'en-US',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await ctx.addInitScript((init) => {
    Object.defineProperty(navigator, 'language', { get: () => init.lang });
    Object.defineProperty(navigator, 'languages', { get: () => [init.lang] });
    // Always reset welcome state but keep howto skipped
    localStorage.setItem('cw_seen_guide', '1');
    localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
    localStorage.setItem('cw_premium', '0');
    localStorage.setItem('cw_show_demo', '1'); // enable demo link
    localStorage.removeItem('cw_seen_welcome');
    localStorage.removeItem('cw_user_name');
    localStorage.removeItem('cw_user_country');
  }, { lang: opts.locale || 'en-US' });
  return ctx;
}

function attachErrorListeners(page, label) {
  page.on('pageerror', (err) => {
    allPageErrors.push({ label, msg: err.message });
    console.log(`  PAGE ERROR [${label}]: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out noisy 404s on optional assets
      if (/Failed to load resource/i.test(text)) return;
      allConsoleErrors.push({ label, msg: text });
    }
  });
}

const browser = await chromium.launch({ headless: true });

// ============================================================
// TEST 1: Welcome flow — name + country (IL), language auto-switch
// ============================================================
console.log('\n=== TEST 1: Welcome (Israel → he) ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'welcome-il');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await shot(page, 'welcome-initial');

  // Verify Welcome rendered (look for name input)
  const nameInput = page.locator('input[type="text"]').first();
  const nameCount = await nameInput.count();
  if (nameCount === 0) {
    bug('CRITICAL', 'Welcome screen on first visit', 'Name input visible', 'No text input found — Welcome did not render');
  } else {
    // Fill name
    await nameInput.fill('TestUserName');
    await page.waitForTimeout(200);

    // Tap country picker — button containing "Country" placeholder text
    // The placeholder is inside a <button>. Find the button before the CTA.
    const countryBtn = page.locator('button').filter({ hasText: /Country|Where/i }).first();
    if (await countryBtn.count() === 0) {
      bug('HIGH', 'Welcome country picker trigger', 'Country picker button visible', 'No country picker button found');
    } else {
      await countryBtn.click();
      await page.waitForTimeout(700);
      await shot(page, 'welcome-country-open');

      // Search "Israel"
      const search = page.locator('input[type="search"]').first();
      if (await search.count() > 0) {
        await search.fill('Israel');
        await page.waitForTimeout(300);
      }
      const israelRow = page.locator('button[role="option"]').filter({ hasText: /Israel/i }).first();
      if (await israelRow.count() === 0) {
        bug('HIGH', 'Welcome country search', '"Israel" option visible', 'Could not find Israel in country list');
      } else {
        await israelRow.click();
        await page.waitForTimeout(400);
      }
    }

    await shot(page, 'welcome-filled');

    // Press Continue
    const cont = page.locator('button').filter({ hasText: /Continue|המשך/i }).first();
    if (await cont.count() === 0) {
      bug('HIGH', 'Welcome continue button', 'Continue button visible', 'Continue button not found');
    } else {
      await cont.click();
      await page.waitForTimeout(1200);
    }
    await shot(page, 'after-welcome');

    // Verify language switched to Hebrew — look for RTL or Hebrew chars
    const htmlDir = await page.evaluate(() => document.documentElement.dir || document.body.dir);
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const hasHebrew = /[֐-׿]/.test(bodyText);
    if (!hasHebrew) {
      bug('HIGH', 'Welcome IL→he language auto-switch', 'UI text in Hebrew after picking Israel', `No Hebrew characters detected in body. dir=${htmlDir}`);
    }

    // Verify localStorage
    const stored = await page.evaluate(() => ({
      name: localStorage.getItem('cw_user_name'),
      seen: localStorage.getItem('cw_seen_welcome'),
      country: localStorage.getItem('cw_user_country'),
    }));
    if (stored.name !== 'TestUserName') {
      bug('HIGH', 'Welcome persists name', 'cw_user_name = "TestUserName"', `cw_user_name = ${JSON.stringify(stored.name)}`);
    }
    if (stored.seen !== '1') {
      bug('MEDIUM', 'Welcome persists seen flag', 'cw_seen_welcome = "1"', `cw_seen_welcome = ${JSON.stringify(stored.seen)}`);
    }
  }
  await ctx.close();
}

// ============================================================
// TEST 1b: Welcome with Japan → ja
// ============================================================
console.log('\n=== TEST 1b: Welcome (Japan → ja) ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'welcome-jp');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Hiroshi');
    const countryBtn = page.locator('button').filter({ hasText: /Country|Where/i }).first();
    if (await countryBtn.count() > 0) {
      await countryBtn.click();
      await page.waitForTimeout(700);
      const search = page.locator('input[type="search"]').first();
      if (await search.count() > 0) await search.fill('Japan');
      await page.waitForTimeout(300);
      const jp = page.locator('button[role="option"]').filter({ hasText: /Japan/i }).first();
      if (await jp.count() > 0) await jp.click();
      await page.waitForTimeout(400);
    }
    const cont = page.locator('button').filter({ hasText: /Continue|続行|次へ/i }).first();
    if (await cont.count() > 0) await cont.click();
    await page.waitForTimeout(1500);
    await shot(page, 'after-welcome-jp');
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const hasJa = /[぀-ゟ゠-ヿ一-鿿]/.test(bodyText);
    if (!hasJa) {
      bug('HIGH', 'Welcome JP→ja language auto-switch', 'UI text in Japanese after picking Japan', 'No Japanese characters detected in body');
    }
  }
  await ctx.close();
}

// ============================================================
// TEST 2: Auto-match — name "Jordan" should skip "who you are" step
// ============================================================
console.log('\n=== TEST 2: Auto-match name "Jordan" → skip self-pick ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'automatch');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Jordan'); // matches demo chat user
    // skip the Welcome (don't pick country to avoid lang switch)
    const skip = page.locator('button').filter({ hasText: /^Skip$/i }).first();
    if (await skip.count() > 0) {
      await skip.click();
    } else {
      // there's no language switch since no country; press Continue
      const cont = page.locator('button').filter({ hasText: /Continue/i }).first();
      if (await cont.count() > 0) await cont.click();
    }
    await page.waitForTimeout(1200);
  }

  // Skip flag check: when user used Skip, cw_user_name is empty. Let's go with
  // Continue path only (name without country).
  // Restart with continue path so userName persists
  await ctx.close();
}

{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'automatch2');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Fill Jordan, no country, Continue
  const nameInput = page.locator('input[type="text"]').first();
  await nameInput.fill('Jordan');
  const cont = page.locator('button').filter({ hasText: /Continue/i }).first();
  await cont.click();
  await page.waitForTimeout(1200);
  await shot(page, 'landing-after-welcome');

  // We should now be on landing. Click "Try demo" / demo link
  const demo = page.locator('button').filter({ hasText: /demo/i }).first();
  if (await demo.count() === 0) {
    bug('HIGH', 'Demo link on landing', 'Demo button visible', 'No demo button found on landing');
  } else {
    await demo.click();
    await page.waitForTimeout(1000);
    // Press main CTA
    const cta = page.locator('button').filter({ hasText: /Expose|Reveal|Play|Wrapped|Recap/i }).last();
    if (await cta.count() > 0) await cta.click();
    await page.waitForTimeout(2500); // parsing
    await shot(page, 'after-parsing');

    // Wait for onboarding or wrapped to appear
    await page.waitForFunction(() => {
      const t = document.body.innerText || '';
      return /relationship|who are you|Friends|Family|Work|Continue|Skip/i.test(t);
    }, null, { timeout: 25000 }).catch(() => {});

    // Detect "who are you" step — looks for "Which one are you" / question
    const text1 = await page.evaluate(() => document.body.innerText || '');
    const hasWhoAreYou = /Which one are you|who are you|who you are/i.test(text1);
    // If autoMatch fired, we should jump straight to relationship step
    const hasRelationship = /Friends|Family|Work|Just us/i.test(text1);
    await shot(page, 'onboarding-step');

    if (hasWhoAreYou && !hasRelationship) {
      bug('HIGH', 'Auto-match "Jordan" should skip self-pick', 'Onboarding starts at relationship step', 'Self-pick step shown despite name matching participant "Jordan"');
    } else if (hasRelationship) {
      console.log('  OK: auto-match worked, jumped to relationship step');
    }
  }
  await ctx.close();
}

// ============================================================
// TEST 2b: Non-matching name "Zzzzzzz" → picker DOES show
// ============================================================
console.log('\n=== TEST 2b: Non-matching name → picker shown ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'automatch-no');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const nameInput = page.locator('input[type="text"]').first();
  await nameInput.fill('Zzzxqyy');
  const cont = page.locator('button').filter({ hasText: /Continue/i }).first();
  await cont.click();
  await page.waitForTimeout(1200);

  const demo = page.locator('button').filter({ hasText: /demo/i }).first();
  if (await demo.count() > 0) await demo.click();
  await page.waitForTimeout(800);
  const cta = page.locator('button').filter({ hasText: /Expose|Reveal|Play|Wrapped|Recap/i }).last();
  if (await cta.count() > 0) await cta.click();
  await page.waitForTimeout(3500);

  await page.waitForFunction(() => {
    const t = document.body.innerText || '';
    return /Friends|Family|Work|Jordan|Riley|Alex/i.test(t);
  }, null, { timeout: 25000 }).catch(() => {});

  const text = await page.evaluate(() => document.body.innerText || '');
  // If picker is shown, we should see participant names (Jordan/Riley/etc.)
  const hasParticipants = /Jordan|Riley|Morgan|Alex|Sam/.test(text);
  const hasOnlyRelationship = !hasParticipants && /Friends|Family|Work/i.test(text);
  await shot(page, 'onboarding-nomatch');
  if (hasOnlyRelationship) {
    bug('MEDIUM', 'Non-matching welcome name "Zzzxqyy"', 'Self-pick (participant list) shown', 'Self-pick step appears to be skipped (relationship shown without participant list)');
  }
  await ctx.close();
}

// ============================================================
// TEST 3: Kebab menu — Replay, Change Profile
// ============================================================
console.log('\n=== TEST 3: Kebab menu + Profile sheet ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'kebab');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // skip welcome
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Jordan');
    const cont = page.locator('button').filter({ hasText: /Continue/i }).first();
    await cont.click();
    await page.waitForTimeout(1200);
  }

  const demo = page.locator('button').filter({ hasText: /demo/i }).first();
  if (await demo.count() > 0) await demo.click();
  await page.waitForTimeout(800);
  const cta = page.locator('button').filter({ hasText: /Expose|Reveal|Play|Wrapped|Recap/i }).last();
  if (await cta.count() > 0) await cta.click();
  await page.waitForTimeout(3000);

  // Skip ad if present
  for (let i = 0; i < 3; i++) {
    const skipAd = page.locator('button').filter({ hasText: /^Skip/i }).first();
    if (await skipAd.count() === 0) break;
    try { await skipAd.click({ timeout: 6000 }); }
    catch { await page.waitForTimeout(5500); try { await skipAd.click({ timeout: 3000 }); } catch {} }
    await page.waitForTimeout(800);
  }

  // Onboarding: hit Continue / next until we reach wrapped (kebab visible)
  for (let i = 0; i < 6; i++) {
    const continueBtn = page.locator('button').filter({ hasText: /Continue|Next|Start|Done|המשך|Friends|Family|Work|Just us|Other/i }).first();
    const kebab = page.locator('button[aria-label="Menu"]').first();
    if (await kebab.count() > 0) break;
    if (await continueBtn.count() > 0) {
      try { await continueBtn.click({ timeout: 2000 }); } catch {}
      await page.waitForTimeout(700);
    } else break;
  }

  // Skip ad_pre_wrapped if present
  for (let i = 0; i < 2; i++) {
    const skipAd = page.locator('button').filter({ hasText: /^Skip/i }).first();
    if (await skipAd.count() === 0) break;
    try { await skipAd.click({ timeout: 6000 }); }
    catch { await page.waitForTimeout(5500); try { await skipAd.click({ timeout: 3000 }); } catch {} }
    await page.waitForTimeout(800);
  }

  await page.waitForTimeout(800);
  await shot(page, 'wrapped-arrived');

  // Locate kebab
  const kebab = page.locator('button[aria-label="Menu"]').first();
  if (await kebab.count() === 0) {
    bug('HIGH', 'Wrapped kebab menu trigger', '3-dot kebab button visible top-right', 'No button with aria-label="Menu" found on Wrapped');
  } else {
    // advance the deck a couple slides so we have something to replay back from
    await page.mouse.click(390 * 0.75, 844 * 0.5);
    await page.waitForTimeout(500);
    await page.mouse.click(390 * 0.75, 844 * 0.5);
    await page.waitForTimeout(500);
    await page.mouse.click(390 * 0.75, 844 * 0.5);
    await page.waitForTimeout(500);

    // Open kebab
    await kebab.click();
    await page.waitForTimeout(600);
    await shot(page, 'kebab-open');

    // Verify 4 items
    const sheetText = await page.evaluate(() => document.body.innerText || '');
    const hasHome    = /\bHome\b/i.test(sheetText);
    const hasRoast   = /Roast/i.test(sheetText);
    const hasReplay  = /Replay/i.test(sheetText);
    const hasProfile = /Change profile|Profile/i.test(sheetText);
    if (!hasHome)    bug('MEDIUM', 'Kebab menu Home action', 'Home item visible', 'Home not in kebab sheet');
    if (!hasRoast)   bug('MEDIUM', 'Kebab menu Roast action', 'Roast Mode item visible', 'Roast not in kebab sheet');
    if (!hasReplay)  bug('MEDIUM', 'Kebab menu Replay action', 'Replay item visible', 'Replay not in kebab sheet');
    if (!hasProfile) bug('MEDIUM', 'Kebab menu Profile action', 'Change profile item visible', 'Change profile not in kebab sheet');

    // Tap Replay — slide should reset to 0
    const replayBtn = page.locator('button').filter({ hasText: /Replay/i }).first();
    if (await replayBtn.count() > 0) {
      await replayBtn.click();
      await page.waitForTimeout(800);
      await shot(page, 'after-replay');
      // Hard to assert slide index w/o internal hook — check first slide segment is full white
      const firstSegBg = await page.evaluate(() => {
        const segs = document.querySelectorAll('div[style*="position: absolute"][style*="top: 0"] > div');
        if (!segs.length) return null;
        return getComputedStyle(segs[0]).backgroundColor;
      });
      if (firstSegBg && firstSegBg !== 'rgb(255, 255, 255)') {
        bug('MEDIUM', 'Replay resets to slide 0', 'First segment fully white', `First segment bg = ${firstSegBg}`);
      }
    }

    // Open kebab again → Change Profile → sheet opens
    const kebab2 = page.locator('button[aria-label="Menu"]').first();
    if (await kebab2.count() > 0) {
      await kebab2.click();
      await page.waitForTimeout(500);
      const profileBtn = page.locator('button').filter({ hasText: /Change profile|Profile/i }).first();
      if (await profileBtn.count() > 0) {
        await profileBtn.click();
        await page.waitForTimeout(700);
        await shot(page, 'profile-sheet');
        const sheetText2 = await page.evaluate(() => document.body.innerText || '');
        const hasEditTitle = /Edit profile|Which one are you|Save/i.test(sheetText2);
        if (!hasEditTitle) {
          bug('HIGH', 'Profile edit sheet content', 'Profile sheet with participant list + Save', `Sheet text does not contain expected labels. Got: ${sheetText2.slice(0,200)}`);
        }
        // Try to pick a different participant — find a button with "Riley"
        const riley = page.locator('button').filter({ hasText: /^Riley/i }).first();
        if (await riley.count() > 0) {
          await riley.click();
          await page.waitForTimeout(300);
          // Tap Save
          const save = page.locator('button').filter({ hasText: /^Save$/i }).first();
          if (await save.count() > 0) {
            await save.click();
            await page.waitForTimeout(700);
            await shot(page, 'after-profile-save');
          } else {
            bug('MEDIUM', 'Profile sheet Save button', 'Save button visible', 'No Save button found');
          }
        }
      }
    }
  }
  await ctx.close();
}

// ============================================================
// TEST 4: Modes view → Duo/Chaos "coming soon" modal
// ============================================================
console.log('\n=== TEST 4: Modes "Coming Soon" modal ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'modes');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // skip welcome
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Jordan');
    const cont = page.locator('button').filter({ hasText: /Continue/i }).first();
    await cont.click();
    await page.waitForTimeout(1200);
  }
  const demo = page.locator('button').filter({ hasText: /demo/i }).first();
  if (await demo.count() > 0) await demo.click();
  await page.waitForTimeout(700);
  const cta = page.locator('button').filter({ hasText: /Expose|Reveal|Play|Wrapped|Recap/i }).last();
  if (await cta.count() > 0) await cta.click();
  await page.waitForTimeout(3000);

  // skip ads + onboarding
  for (let i = 0; i < 5; i++) {
    const skipAd = page.locator('button').filter({ hasText: /^Skip/i }).first();
    if (await skipAd.count() > 0) {
      try { await skipAd.click({ timeout: 6000 }); }
      catch { await page.waitForTimeout(5500); try { await skipAd.click({ timeout: 3000 }); } catch {} }
      await page.waitForTimeout(700);
      continue;
    }
    // try Continue
    const cont = page.locator('button').filter({ hasText: /Continue|Friends|Family|Work|Just us|Other/i }).first();
    const kebab = page.locator('button[aria-label="Menu"]').first();
    if (await kebab.count() > 0) break;
    if (await cont.count() > 0) {
      try { await cont.click({ timeout: 2000 }); } catch {}
      await page.waitForTimeout(700);
    } else break;
  }

  // Walk all slides until PostMenu (or Modes nav)
  for (let i = 0; i < 50; i++) {
    const adSkip = page.locator('button').filter({ hasText: /^Skip/i }).first();
    if (await adSkip.count() > 0) {
      await page.waitForTimeout(5500);
      try { await adSkip.click({ timeout: 4000 }); } catch {}
      await page.waitForTimeout(600);
      continue;
    }
    const replay = await page.locator('text=/Watch again|Replay|Play again/i').count();
    if (replay > 0) break;
    await page.mouse.click(390 * 0.75, 844 * 0.5);
    await page.waitForTimeout(280);
  }
  await shot(page, 'at-postmenu');

  // Now look for bottom nav "Modes"
  const modesNav = page.locator('button, a').filter({ hasText: /^Modes$|Modes/ }).first();
  if (await modesNav.count() === 0) {
    bug('MEDIUM', 'Modes bottom-nav', 'Modes tab visible', 'No Modes nav button found on post-wrapped screen');
  } else {
    try { await modesNav.click({ timeout: 3000 }); } catch {}
    await page.waitForTimeout(800);
    await shot(page, 'modes-view');

    // Tap Duo tile
    const duo = page.locator('text=/Duo|Compare/i').first();
    if (await duo.count() === 0) {
      bug('MEDIUM', 'Modes view Duo tile', 'Duo tile visible', 'No Duo tile found in Modes view');
    } else {
      try { await duo.click({ timeout: 3000 }); } catch {}
      await page.waitForTimeout(700);
      await shot(page, 'duo-coming-soon');
      const txt = await page.evaluate(() => document.body.innerText || '');
      if (!/Coming soon|Got it|cooking|hang tight/i.test(txt)) {
        bug('HIGH', 'Duo tile → Coming soon modal', 'Coming soon modal opens on Duo tap', `No coming-soon text found after tapping Duo. Body sample: ${txt.slice(0,200)}`);
      }
      // dismiss
      const ok = page.locator('button').filter({ hasText: /Got it|OK|Close/i }).first();
      if (await ok.count() > 0) {
        try { await ok.click({ timeout: 2000 }); } catch {}
        await page.waitForTimeout(500);
      }
    }
    // Tap Chaos tile
    const chaos = page.locator('text=/Chaos/i').first();
    if (await chaos.count() > 0) {
      try { await chaos.click({ timeout: 3000 }); } catch {}
      await page.waitForTimeout(700);
      const txt = await page.evaluate(() => document.body.innerText || '');
      if (!/Coming soon|Got it|cooking|hang tight/i.test(txt)) {
        bug('HIGH', 'Chaos tile → Coming soon modal', 'Coming soon modal opens on Chaos tap', 'No coming-soon text after tapping Chaos');
      }
    }
  }
  await ctx.close();
}

// ============================================================
// TEST 5: PaymentSheet
// ============================================================
console.log('\n=== TEST 5: PaymentSheet ===');
{
  const ctx = await newCtx(browser, { locale: 'en-US' });
  const page = await ctx.newPage();
  attachErrorListeners(page, 'payment');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // skip welcome
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    const skip = page.locator('button').filter({ hasText: /^Skip$/i }).first();
    if (await skip.count() > 0) await skip.click();
    else {
      await nameInput.fill('Tester');
      const cont = page.locator('button').filter({ hasText: /Continue/i }).first();
      if (await cont.count() > 0) await cont.click();
    }
    await page.waitForTimeout(1200);
  }

  // Open Settings via gear
  const gear = page.locator('button[aria-label="Settings"]').first();
  if (await gear.count() === 0) {
    bug('CRITICAL', 'Settings gear on landing', 'Gear button visible', 'No Settings gear found');
  } else {
    await gear.click();
    await page.waitForTimeout(800);
    await shot(page, 'settings');

    // Find premium card → trigger payment sheet. Could be "Upgrade", "Premium", "Unlock"
    const premiumCta = page.locator('button').filter({ hasText: /Upgrade|Unlock|Get Premium|Premium|Pro/i }).first();
    if (await premiumCta.count() === 0) {
      bug('MEDIUM', 'Settings premium card', 'Premium upgrade CTA visible', 'No Premium/Upgrade button found in Settings');
    } else {
      try { await premiumCta.click({ timeout: 3000 }); } catch {}
      await page.waitForTimeout(900);
      await shot(page, 'payment-sheet');

      const txt = await page.evaluate(() => document.body.innerText || '');
      const hasBit  = /\bBit\b/.test(txt);
      const hasVisa = /Visa/.test(txt);
      const hasCard = /Credit card|Card/i.test(txt);
      const hasDiscount = /Discount|discount code/i.test(txt);
      const hasPay = /Pay|Subscribe|Purchase/i.test(txt);

      if (!hasBit)      bug('HIGH', 'PaymentSheet Bit tab', 'Bit tab visible', 'No "Bit" tab found in PaymentSheet');
      if (!hasVisa)     bug('HIGH', 'PaymentSheet Visa tab', 'Visa tab visible', 'No "Visa" tab found in PaymentSheet');
      if (!hasCard)     bug('HIGH', 'PaymentSheet Credit card tab', 'Credit card tab visible', 'No "Credit card" tab found in PaymentSheet');
      if (!hasDiscount) bug('MEDIUM', 'PaymentSheet discount field', 'Discount code field visible', 'No discount field found');
      if (!hasPay)      bug('HIGH', 'PaymentSheet Pay button', 'Pay button visible', 'No Pay button found');

      // dismiss
      const close = page.locator('button').filter({ hasText: /Cancel|Close|×/i }).first();
      if (await close.count() > 0) {
        try { await close.click({ timeout: 2000 }); } catch {}
      } else {
        // tap backdrop
        await page.mouse.click(195, 60);
      }
      await page.waitForTimeout(600);
      await shot(page, 'payment-dismissed');
    }
  }
  await ctx.close();
}

await browser.close();

// ============================================================
// Final report
// ============================================================
console.log('\n' + '='.repeat(60));
console.log(`BUGS FOUND: ${bugs.length}`);
console.log(`PAGE ERRORS CAUGHT: ${allPageErrors.length}`);
console.log(`CONSOLE ERRORS: ${allConsoleErrors.length}`);
console.log('='.repeat(60));

if (bugs.length) {
  console.log('\n--- BUGS ---');
  for (const b of bugs) {
    console.log(`\n[${b.severity}] ${b.step}`);
    console.log(`  Expected: ${b.expected}`);
    console.log(`  Actual:   ${b.actual}`);
  }
}
if (allPageErrors.length) {
  console.log('\n--- PAGE ERRORS ---');
  for (const e of allPageErrors) console.log(`  [${e.label}] ${e.msg}`);
}
if (allConsoleErrors.length) {
  console.log('\n--- CONSOLE ERRORS ---');
  for (const e of allConsoleErrors.slice(0, 20)) console.log(`  [${e.label}] ${e.msg}`);
}

console.log(`\nScreenshots: ${SHOT_DIR}`);
process.exit(0);
