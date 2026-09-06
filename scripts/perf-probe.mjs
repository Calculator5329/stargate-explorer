// Perf-pass invariants: the aim cursor integrates at mouse-event rate (the Shift jitter fix), relative steer still
// accumulates to the tick, dynamic resolution steps down on slow frames and back up, the belt draws only what the camera sees.
// Usage: node scripts/perf-probe.mjs   (exit 1 on any FAIL)
import { chromium } from "playwright-core";
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const browser = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: "med", mission: "belt-clear" });
await page.goto(url.href, { waitUntil: "load" });
await page.waitForFunction(() => window.__game && window.__input);
// pause the sim so no tick runs between events; then each mousemove must move the cursor by itself
const xs = await page.evaluate(() => {
  const inp = window.__input, loop = window.__loop;
  loop.stop?.();
  inp.steer = "cursor"; inp.cursor.x = 0; inp.cursor.y = 0;
  const out = [];
  for (let i = 0; i < 5; i++) { document.dispatchEvent(new MouseEvent("mousemove", { movementX: 10, movementY: -4 })); out.push([inp.cursor.x, inp.cursor.y]); }
  loop.start?.();
  return out;
});
const eventRate = xs.every((v, i) => Math.abs(v[0] - 10 * (i + 1)) < 1e-6 && Math.abs(v[1] + 4 * (i + 1)) < 1e-6);
console.log(`cursor at event rate: ${eventRate ? "PASS" : "FAIL"} ${JSON.stringify(xs)}`);
// relative mode still accumulates until the tick
const rel = await page.evaluate(() => { const inp = window.__input; inp.steer = "relative"; const before = inp.stick.x; document.dispatchEvent(new MouseEvent("mousemove", { movementX: 200, movementY: 0 })); return [before, inp.stick.x]; });
console.log(`relative mode untouched by the event: ${rel[0] === rel[1] ? "PASS" : "FAIL"} ${JSON.stringify(rel)}`);
// dynamic resolution: force a low fps reading through adapt(), then a high one
const dyn = await page.evaluate(async () => {
  const R = window.__renderer; const out = { start: R.scale };
  R.dynamic = true;
  for (let i = 0; i < 6; i++) R.adapt(1.6, 30);
  out.afterSlow = R.scale;
  for (let i = 0; i < 24; i++) R.adapt(1.6, 60);
  out.afterFast = R.scale;
  R.dynamic = false; R.adapt(1.6, 30); out.off = R.scale;
  return out;
});
const ok = dyn.start === 1 && dyn.afterSlow === 0.55 && dyn.afterFast === 1 && dyn.off === 1;
console.log(`dynamic resolution steps: ${ok ? "PASS" : "FAIL"} ${JSON.stringify(dyn)}`);
// belt culling: drawn instances must be fewer than alive rocks in the chase view
const cull = await page.evaluate(() => { const a = window.__rocks; let alive = 0; for (const v of a.alive) alive += v; return { alive, drawn: a.drawn }; });
console.log(`belt culled: ${cull.drawn > 0 && cull.drawn < cull.alive ? "PASS" : "FAIL"} ${JSON.stringify(cull)}`);
await browser.close();
process.exit(eventRate && rel[0] === rel[1] && ok && cull.drawn < cull.alive ? 0 : 1);
