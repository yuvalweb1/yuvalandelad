const {chromium} = require('playwright');
chromium.launch({headless:true}).then(async b => {
  const p = await b.newPage();
  await p.setViewportSize({width:390,height:844});
  await p.goto('http://localhost:5173');
  await p.waitForTimeout(1500);
  
  for (let i = 0; i < 6; i++) {
    const btn = await p.$('button:has-text("Next")');
    if (btn) { await btn.click(); await p.waitForTimeout(400); }
    else break;
  }
  await p.waitForTimeout(500);
  await p.screenshot({path:'c:/tmp/step2.png'});
  console.log('step2');
  
  const demoEl = await p.$('a:has-text("demo"), button:has-text("demo"), a:has-text("Demo"), [href*="demo"]');
  if (demoEl) {
    await demoEl.click();
    await p.waitForTimeout(2000);
    await p.screenshot({path:'c:/tmp/step3.png'});
    console.log('step3');
  } else {
    console.log('no demo');
    const html = await p.content();
    console.log(html.slice(0,500));
  }
  await b.close();
}).catch(e=>console.error(e.message));
