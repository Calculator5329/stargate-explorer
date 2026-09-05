// Headless check of the chase camera through a barrel roll against the running dev server: starts a roll, samples the
// camera's up vector every frame and reports the largest frame-to-frame swing. A flip shows as a jump near 180°;
// a camera that follows the roll swings a few degrees a frame. Usage: node scripts/barrel-test.mjs
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto("http://localhost:5187/?lock=free&quality=low", { waitUntil: "load" });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const g = window.__game, f = window.__flight;
  const cam = g.cam;
  const ups = [];
  f.barrelLeft = Math.PI * 2;
  const t0 = performance.now();
  while (performance.now() - t0 < 4000) {
    await new Promise(requestAnimationFrame);
    ups.push([cam.up.x, cam.up.y, cam.up.z, f.barrelLeft]);
    if (f.barrelLeft === 0 && ups.length > 30 && ups[ups.length - 30][3] === 0) break;
  }
  let maxDeg = 0, at = -1, rolled = 0;
  for (let i = 1; i < ups.length; i++) {
    const a = ups[i - 1], b = ups[i];
    const d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
    rolled += d;
    if (d > maxDeg) { maxDeg = d; at = i; }
  }
  return { frames: ups.length, maxStepDeg: +maxDeg.toFixed(1), at, totalSwingDeg: Math.round(rolled), endUp: ups[ups.length - 1].slice(0, 3).map((v) => +v.toFixed(2)) };
});
console.log(JSON.stringify(r));
await browser.close();
