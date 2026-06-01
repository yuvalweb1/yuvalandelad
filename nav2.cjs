const {chromium} = require('playwright');
chromium.launch({headless:true}).then(async b => {
  const p = await b.newPage();
  await p.setViewportSize({width:390,height:844});
  await p.goto('http://localhost:5173');
  await p.waitForTimeout(1000);
  
  // Skip through how-to guide
  for (let i = 0; i < 10; i++) {
    const btn = await p.$('button:has-text("Next"), button:has-text("Got it"), button:has-text("let\'s go")');
    if (btn) { await btn.click(); await p.waitForTimeout(500); }
    else break;
  }
  await p.waitForTimeout(500);
  await p.screenshot({path:'c:/tmp/landing.png'});
  console.log('landing page captured');
  
  // Look for all clickable elements
  const els = await p.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button')).map(e => ({
      tag: e.tagName,
      text: e.textContent.trim().slice(0, 50),
      href: e.getAttribute('href') || ''
    })).slice(0, 30);
  });
  console.log(JSON.stringify(els, null, 2));
  await b.close();
}).catch(e=>console.error(e.message));
