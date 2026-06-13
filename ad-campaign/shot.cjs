// Screenshot harness for ad variants — renders an HTML file at exact pixel
// dimensions and writes a PNG. Local marketing tooling only; not part of the app.
// Usage: node ad-campaign/shot.cjs <input.html> <output.png> [width] [height]
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const [, , htmlPath, outPath, w = '1080', h = '1920'] = process.argv;
  if (!htmlPath || !outPath) {
    console.error('Usage: node shot.cjs <input.html> <output.png> [w] [h]');
    process.exit(1);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: Number(w), height: Number(h) },
    deviceScaleFactor: 1,
  });
  const fileUrl = 'file:///' + path.resolve(htmlPath).replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  // Let webfonts finish and any entrance animations settle.
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outPath });
  await browser.close();
  console.log('WROTE', path.resolve(outPath));
})();
