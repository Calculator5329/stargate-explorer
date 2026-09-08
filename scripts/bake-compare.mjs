// Captures the same view of two systems (sky + planet) for a before/after pixel compare of the bake path.
// Usage: node scripts/bake-compare.mjs <tag>    → docs/shots/2026-09-06-bake-<tag>-<system>.png
import { chromium } from "playwright-core";
const tag = process.argv[2] ?? "x";
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const browser = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
for (const system of ["abydos", "tollana"]) {
  const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: "med", system, mission: "belt-clear", dynres: "0" });
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForFunction(() => window.__game && window.__flight);
  // look toward the planet from the start with the hud off, so the compare is pure world
  await page.evaluate(() => { const f = window.__flight, p = window.__world.planet.group.position; const d = p.clone().sub(f.pos).normalize(); f.quat.setFromUnitVectors(new f.pos.constructor(0, 0, 1), d); f.prevQuat.copy(f.quat); document.getElementById("hud").style.display = "none"; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/shots/2026-09-06-bake-${tag}-${system}.png` });
}
await browser.close();
