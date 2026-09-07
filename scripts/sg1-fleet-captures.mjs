import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const base=process.env.STARGATE_TEST_URL ?? 'http://127.0.0.1:5191';
const hulls=(process.argv[2]??'f11,glider,bomber,prometheus,heavy,dart,lancer,interceptor,gunboat,racer,ace,capital').split(',');
const views=(process.argv[3]??'perspective,top,side,front,rear,silhouette').split(',');
const out='docs/design/sg1-fleet/captures';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:900,height:600}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const records=[];
for(const hull of hulls) for(const version of ['original','revised']) for(const view of views){
 await page.goto(`${base}/docs/design/sg1-fleet/stage.html?hull=${hull}&version=${version}&view=${view}`);
 await page.waitForSelector('body[data-ready="true"]');
 const file=`${out}/${hull}-${version}-${view}.png`;
 await page.screenshot({path:file});
 records.push({hull,version,view,file,...await page.locator('body').evaluate(el=>({triangles:Number(el.dataset.triangles),calls:Number(el.dataset.calls)}))});
}
await browser.close();
writeFileSync(`${out}/measurements-${hulls.join('-')}.json`,JSON.stringify({errors,records},null,2));
if(errors.length)throw new Error(errors.join('\n'));
console.log(`Captured ${records.length} views; no page errors. Geometry counts are capture-stage measurements, not gameplay frame rate.`);
