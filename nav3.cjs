const {chromium} = require('playwright');
chromium.launch({headless:true}).then(async b => {
  const p = await b.newPage();
  await p.setViewportSize({width:390,height:844});
  await p.goto('http://localhost:5173');
  await p.waitForTimeout(1000);
  
  // Skip through how-to guide
  for (let i = 0; i < 10; i++) {
    const btn = await p.$('button:has-text("Next"), button:has-text("Got it")');
    if (btn) { await btn.click(); await p.waitForTimeout(500); }
    else break;
  }
  await p.waitForTimeout(500);
  
  // Close any modals
  const closeBtn = await p.$('button:has-text("×"), button:has-text("Maybe later")');
  if (closeBtn) { await closeBtn.click(); await p.waitForTimeout(300); }
  
  // Click "Try the demo →"
  const demoBtn = await p.$('button:has-text("Try the demo")');
  if (demoBtn) {
    console.log('found demo button');
    await demoBtn.click();
    await p.waitForTimeout(3000);
    await p.screenshot({path:'c:/tmp/after_demo.png'});
    console.log('after demo screenshot taken');
  }
  
  // Now navigate forward through slides to the final menu
  // Keep clicking forward until we reach the menu stage
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(400);
    const stage = await p.evaluate(() => {
      // Look for mode tiles which indicate PostMenu
      return document.querySelector('button:has-text("Roast"), button:has-text("Duo"), button:has-text("Chaos")') ? 'menu' : 'other';
    });
    if (stage === 'menu') {
      console.log('Found menu at iteration', i);
      break;
    }
    // Try clicking forward
    await p.click('body', {position: {x: 300, y: 400}}).catch(() => {});
  }
  
  await p.screenshot({path:'c:/tmp/final_menu.png'});
  console.log('final screenshot taken');
  await b.close();
}).catch(e=>console.error(e.message));
