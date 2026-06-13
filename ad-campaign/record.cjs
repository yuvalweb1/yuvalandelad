// Records the animated ad HTML to a webm video at 1080x1920.
// Local marketing tooling only; not part of the app.
// Usage: node ad-campaign/record.cjs
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    recordVideo: { dir: path.resolve('ad-campaign'), size: { width: 1080, height: 1920 } },
  });
  const page = await ctx.newPage();
  const fileUrl = 'file:///' + path.resolve('ad-campaign/video-ad.html').replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  // timeline is 15.5s after fonts load; record a touch longer for the end-hold
  await page.waitForTimeout(17500);
  const video = page.video();
  await page.close();
  await video.saveAs(path.resolve('ad-campaign/recapped-ad-15s.webm'));
  await video.delete();
  await ctx.close();
  await browser.close();
  console.log('WROTE', path.resolve('ad-campaign/recapped-ad-15s.webm'));
})();
