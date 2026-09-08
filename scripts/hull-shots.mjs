// Side + rear inspect captures for a list of hull keys: node scripts/hull-shots.mjs dart,lancer,bomber [YYYY-MM-DD] [baseUrl]
import { chromium } from "playwright-core";
const hulls = (process.argv[2] ?? "dart").split(",");
const date = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const base = process.argv[4] ?? "http://localhost:5187";
const browser = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const h of hulls) {
  for (const [view, q] of [["side", "spin=0"], ["rear", "spin=0"], ["top", "spin=0&dist=0.6"]]) {
    await page.goto(`${base}/?view=${view}&hull=${h}&quality=high&dynres=0&${q}`, { waitUntil: "load" });
    await page.waitForTimeout(1800);
    const out = `docs/shots/${date}-hull-${h}-${view}.png`;
    await page.screenshot({ path: out });
    console.log(out);
  }
}
await browser.close();
