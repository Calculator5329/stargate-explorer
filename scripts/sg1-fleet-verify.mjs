import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {writeFileSync} from 'node:fs';
const base=process.env.STARGATE_TEST_URL??'http://127.0.0.1:5191';
const out='docs/design/sg1-fleet';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const checks=[];
await page.goto(`${base}/fleet-review.html`);
assert.equal(await page.locator('#fleet button').count(),12);
for(const ship of await page.locator('#fleet button').all()){
 await ship.click();for(const angle of await page.locator('#angles button').all()){
  await angle.click();assert(await page.locator('#old-image').evaluate(im=>im.complete&&im.naturalWidth>0));assert(await page.locator('#new-image').evaluate(im=>im.complete&&im.naturalWidth>0));
 }
}
checks.push('All 12 entries and 6 camera controls load both embedded images');
await page.getByRole('button',{name:'Death glider',exact:true}).click();await page.getByRole('button',{name:'Perspective',exact:true}).click();
await page.getByLabel('Your preference for this ship').selectOption('revised');await page.getByLabel('What would you change?').fill('Verification choice');await page.reload();
assert.equal(await page.getByLabel('Your preference for this ship').inputValue(),'revised');assert.equal(await page.getByLabel('What would you change?').inputValue(),'Verification choice');
await page.getByRole('button',{name:'Show my review'}).click();assert((await page.locator('#review-text').inputValue()).includes('Death glider: revised'));
checks.push('Preferences and notes survive reload; review export includes selection');
await page.evaluate(()=>localStorage.removeItem('sg1-fleet-review-20260906'));await page.reload();
await page.screenshot({path:`${out}/review-desktop.png`,fullPage:true});
await page.setViewportSize({width:390,height:844});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:`${out}/review-mobile.png`,fullPage:true});checks.push('390px mobile layout has no horizontal overflow');
await page.setViewportSize({width:1440,height:1000});
const ids=['f11','glider','bomber','prometheus','heavy','dart','lancer','interceptor','gunboat','racer','ace','capital'];
await page.setContent(`<body style="background:#10171e;color:white;font:16px system-ui;margin:0;display:grid;grid-template-columns:repeat(3,1fr)">${ids.map(id=>`<div><p style="margin:4px 16px">${id}</p><img style="display:block;width:100%;height:210px;object-fit:contain" src="${base}/docs/design/sg1-fleet/captures/${id}-revised-perspective.png"></div>`).join('')}</body>`);
await page.locator('img').evaluateAll(ims=>Promise.all(ims.map(im=>im.decode())));await page.screenshot({path:`${out}/contact-sheet.png`,fullPage:true});
// Real gameplay spawning checks both art paths, plus enemy palette selection.
const gameplay=[];
for(const art of ['original','revised']){
 await page.goto(`${base}/?lock=free&quality=low&art=${art}`);await page.waitForFunction(()=>window.__game&&window.__flight);
 const sample=await page.evaluate(async()=>{
  const {HULLS,ORIGINAL_HULLS}=await import('/src/ships/hulls.ts');const {PALETTES}=await import('/src/ships/palettes.ts');const {Enemies}=await import('/src/combat/enemies.ts');
  const game=window.__game,flight=window.__flight;const fleet=new Enemies(game.combat.enemies.rocks,PALETTES.goauld);const V=flight.pos.constructor;
  const sample=['glider','interceptor','gunboat','bomber','ace'].map((kind,i)=>{const e=fleet.spawn(flight.pos.clone().add(new V(i*40,0,300)),flight.pos,kind);return {kind,color:e.rig.root.getObjectByName('body').material.color.getHex(),canopy:e.rig.root.getObjectByName('canopy')?.material.emissiveIntensity??null};});
  const {disposeTree}=await import('/src/render/dispose.ts');for(const e of fleet.list)disposeTree(e.rig.root);
  return {sample,palette:PALETTES.goauld.body,originalFighter:JSON.stringify(HULLS.f11)===JSON.stringify(ORIGINAL_HULLS.f11),bomberColor:HULLS.bomber.palette.body};
 });
 assert.equal(sample.originalFighter,art==='original');for(const e of sample.sample)if(art==='original')assert.equal(e.color,sample.palette);else if(e.kind==='bomber')assert.equal(e.color,sample.bomberColor);
 gameplay.push({art,...sample});await page.screenshot({path:`${out}/game-${art}.png`});
}
checks.push('Both art versions boot in gameplay; original fighter restored exactly; all five enemies spawn; bomber retains its revised material');
assert.deepEqual(errors,[]);checks.push('No browser page errors');
writeFileSync(`${out}/verification.json`,JSON.stringify({checks,gameplay,errors},null,2));await browser.close();console.log(JSON.stringify({checks,errors},null,2));
