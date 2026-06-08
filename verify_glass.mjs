import { chromium } from 'playwright';

const PORT = 5174;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
await page.setViewportSize({ width: 414, height: 896 });

await page.goto(`http://localhost:${PORT}`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(2000);
await page.screenshot({ path: 'C:/tmp/navbar_glass/00_initial.png' });
console.log('initial url/title:', page.url(), await page.title());
console.log('body text sample:', (await page.locator('body').innerText()).slice(0, 400));

// Try Demo to get into wrapped/landing-with-data quickly
const tryDemo = await page.locator('text=/try demo/i').first();
if (await tryDemo.count()) {
  await tryDemo.click();
  await page.waitForTimeout(5000);
}

await page.screenshot({ path: 'C:/tmp/navbar_glass/01_after_demo.png' });

// Find nav bar - look for Home/Modes tabs
const home = page.locator('text=/^home$/i').first();
if (await home.count()) {
  await home.click();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: 'C:/tmp/navbar_glass/02_home_navbar.png' });

const modes = page.locator('text=/^modes$/i').first();
if (await modes.count()) {
  await modes.click();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: 'C:/tmp/navbar_glass/03_modes_navbar.png' });

console.log('Console errors:', (await page.evaluate(() => window.__consoleErrors || 'n/a')));
await browser.close();
