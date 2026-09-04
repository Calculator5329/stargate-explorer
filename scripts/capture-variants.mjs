// Captures the player-fighter look variants for the pick gallery (docs/design/ship-variants.html).
// Usage: node scripts/capture-variants.mjs [baseUrl] [variant,variant,...]
// Needs the dev server (port 5187) and the `?variant=` hook in main.ts; "current" is the default def.
// Same headless setup as capture-shots.mjs: SwiftShader pixels, meaningless timing.
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5187";
const only = process.argv[3]?.split(",");
const VARIANTS = ["current", "a", "b", "c"];
const VIEWS = {
  side: "?view=side&spin=0",
  top: "?view=top&spin=0&dist=0.55",
  rear: "?view=rear&spin=0",
  silhouette: "?view=side&spin=0&silhouette=1",
  chase: "?lock=free",
};
const SLOTS = new Set(["body", "accent", "dark", "glow", "canopy"]);

mkdirSync("docs/shots/variants", { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
const tris = {};
for (const v of VARIANTS) {
  if (only && !only.includes(v)) continue;
  const vq = v === "current" ? "" : `&variant=${v}`;
  for (const [name, q] of Object.entries(VIEWS)) {
    await page.goto(`${base}/${q}${vq}`, { waitUntil: "load" });
    await page.waitForTimeout(name === "chase" ? 4500 : 3000);
    if (name === "chase") {
      // hull triangle count: the slot meshes only (no outline shells, decals or plume), then everything under the ship
      tris[v] = await page.evaluate((slots) => {
        const ship = window.__game?.combat?.ship;
        if (!ship) return null;
        const count = (m) => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
        let hull = 0, total = 0;
        ship.traverse((o) => {
          if (!o.isMesh) return;
          total += count(o);
          if (slots.includes(o.name)) hull += count(o);
        });
        return { hull, total };
      }, [...SLOTS]);
    }
    const path = `docs/shots/variants/${v}-${name}.png`;
    await page.screenshot({ path });
    console.log("wrote", path);
  }
}
writeFileSync("docs/shots/variants/tris.json", JSON.stringify(tris, null, 2) + "\n");
console.log("tris", JSON.stringify(tris));
await browser.close();
