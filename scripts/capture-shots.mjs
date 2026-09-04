// Headless captures for docs/shots. Usage: node scripts/capture-shots.mjs [YYYY-MM-DD] [baseUrl] [view,view,...]
// Needs the dev server running (npm run dev) and a Chromium for playwright-core
// (`npx playwright install chromium` once). SwiftShader renders the WebGL; pixels
// are right, timing is meaningless.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const base = process.argv[3] ?? "http://localhost:5187";
const VIEWS = {
  side: "?view=side&spin=0",
  rear: "?view=rear&spin=0",
  top: "?view=top&spin=0&dist=0.55",
  chase: "",
  boost: "", // chase view after holding W + Shift: plumes, dust streaks, pull-back
  silhouette: "?view=side&spin=0&silhouette=1",
  fight: "?lock=free", // two gliders spawned 160 m ahead through window.__game, guns firing
};
const HOLD = { boost: ["ShiftLeft"] };
const FIRE = new Set(["fight"]);
const only = process.argv[4]?.split(",");

mkdirSync("docs/shots", { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
for (const [name, q] of Object.entries(VIEWS)) {
  if (only && !only.includes(name)) continue;
  await page.goto(`${base}/${q}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  for (const code of HOLD[name] ?? []) await page.evaluate((c) => document.dispatchEvent(new KeyboardEvent("keydown", { code: c })), code);
  if (FIRE.has(name)) {
    await page.evaluate(() => {
      const g = window.__game, f = window.__flight, V = f.pos.constructor;
      g.enemies.spawn(f.pos.clone().add(new V(-14, 6, 160)), f.pos.clone().add(new V(0, 0, 400)));
      g.enemies.spawn(f.pos.clone().add(new V(18, -4, 190)), f.pos.clone().add(new V(0, 0, 400)));
      document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    });
    await page.waitForTimeout(1600);
  } else await page.waitForTimeout(HOLD[name] ? 6000 : 3000);
  const path = `docs/shots/${date}-${name}.png`;
  await page.screenshot({ path });
  console.log("wrote", path);
}
await browser.close();
