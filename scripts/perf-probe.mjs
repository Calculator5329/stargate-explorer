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
// Dynamic resolution. The controller judges the 90th-percentile frame time of each window, so it is fed
// frames, not a frame rate: 40 slow frames, then good ones. The "sometimes" case is the one that matters
// most — a tenth of the frames at 33 ms and the rest at 16.7 ms must still be treated as too slow, because
// that is exactly what Ethan sees as a stutter and what a mean frame rate would call 55 fps and ignore.
const dyn = await page.evaluate(async () => {
  const R = window.__renderer;
  // Hold the render loop: its own frames would otherwise land in the same window as the synthetic ones and
  // the reading would be of a mixture, which is not a test of anything.
  window.__loop.stop();
  const reset = () => { R.dynamic = true; R.scale = 1; R.adaptT = 0; R.goodT = 0; R.frameMs.length = 0; R.readings = 0; R.bakeLatch = 0; };
  const feed = (n, ms) => { for (let i = 0; i < n; i++) R.adapt(ms / 1000); };
  reset();
  const out = { start: R.scale };
  feed(40, 33.3); // a steady 30 fps
  out.afterSlow = R.scale;
  const slowScale = R.scale;
  // start the good stretch on a clean window: the frames left over from the slow phase have not been read
  // yet and would otherwise be judged again alongside the good ones
  R.adaptT = 0; R.goodT = 0; R.frameMs.length = 0;
  for (let w = 0; w < 8; w++) feed(70, 16.7); // eight good windows: one climb step every fourth
  out.afterFast = R.scale;
  // one 900 ms load stall inside an otherwise perfect window must not cost any resolution
  reset();
  feed(20, 16.7); R.adapt(0.9); feed(20, 16.7);
  out.afterOneStall = R.scale;
  // one frame in ten at 33 ms: a mean frame rate would read 55 fps and do nothing about it
  reset();
  for (let i = 0; i < 40; i++) R.adapt((i % 10 === 0 ? 33.3 : 16.7) / 1000);
  out.afterIntermittent = R.scale;
  // still too slow at the resolution floor: bloom is dropped, and comes back before any pixels do
  reset();
  feed(400, 33.3);
  out.floorScale = R.scale; out.floorRelief = R.relief;
  R.adaptT = 0; R.goodT = 0; R.frameMs.length = 0;
  for (let w = 0; w < 6; w++) feed(70, 16.7);
  out.reliefBack = R.relief; out.scaleAfterRelief = R.scale;
  reset(); R.relief = 0; if (R.bloom) R.bloom.enabled = true;
  R.dynamic = false; feed(40, 33.3); out.off = R.scale;
  // the bake size must latch after the first reading: the controller's 0.05 steps straddle the power-of-two
  // boundaries, and a re-bake on every crossing costs far more than the sharper sky is worth
  reset();
  out.bakeCold = R.bakeSize();
  feed(40, 33.3);
  out.bakeSettled = R.bakeSize();
  R.scale = 1;
  out.bakeAfterClimb = R.bakeSize();
  window.__loop.start();
  return { ...out, slowScale };
});
const ok = dyn.start === 1 && dyn.afterSlow < 0.75 && dyn.afterSlow >= 0.35 && dyn.afterFast > dyn.slowScale
  && dyn.afterOneStall === 1 && dyn.afterIntermittent < 1 && dyn.off === 1
  && dyn.floorScale === 0.35 && dyn.floorRelief === 1 && dyn.reliefBack === 0 && dyn.scaleAfterRelief === 0.35
  && dyn.bakeCold === 256 && dyn.bakeSettled < 1024 && dyn.bakeAfterClimb === dyn.bakeSettled;
console.log(`dynamic resolution steps: ${ok ? "PASS" : "FAIL"} ${JSON.stringify(dyn)}`);
// belt culling: drawn instances must be fewer than alive rocks in the chase view
const cull = await page.evaluate(() => { const a = window.__rocks; let alive = 0; for (const v of a.alive) alive += v; return { alive, drawn: a.drawn }; });
console.log(`belt culled: ${cull.drawn > 0 && cull.drawn < cull.alive ? "PASS" : "FAIL"} ${JSON.stringify(cull)}`);
await browser.close();
process.exit(eventRate && rel[0] === rel[1] && ok && cull.drawn < cull.alive ? 0 : 1);
