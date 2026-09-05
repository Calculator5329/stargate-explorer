// Capture a BUILT tree (dist/) without the dev server: serves the directory from an in-process static server on an
// ephemeral port, drives the hub, the dial and the return gate, writes PNGs, exits. Made for reviewing a lane's build
// when the 5187 dev server belongs to another session. Usage: node scripts/capture-dist.mjs <distDir> <outPrefix>
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";
const [dist, out, mode = "flow"] = [process.argv[2], process.argv[3], process.argv[4]];
if (!dist || !out) { console.error("usage: capture-dist.mjs <distDir> <outPrefix> [flow|views:<hull>]"); process.exit(2); }
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const srv = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(dist, p === "/" || p === "\\" ? "index.html" : p);
  try { const b = await readFile(file); res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
const shot = (name) => page.screenshot({ path: `${out}-${name}.png` }).then(() => console.log("wrote", `${out}-${name}.png`));

if (mode.startsWith("views:")) {
  // inspect views of one hull, the same set the capture script and the lane briefs name
  const hull = mode.slice(6);
  for (const [name, q] of [["side", "view=side&spin=0"], ["top", "view=top&spin=0&dist=0.55"], ["front", "view=front&spin=0"], ["rear", "view=rear&spin=0"], ["silhouette", "view=side&spin=0&silhouette=1"]]) {
    await page.goto(`${base}/?${q}&hull=${hull}&quality=med`, { waitUntil: "load" });
    await page.waitForTimeout(1800);
    await shot(name);
  }
  await browser.close(); srv.close(); process.exit(0);
}
// 1. hub
await page.goto(`${base}/?hub=1&lock=free&quality=low`, { waitUntil: "load" });
await page.waitForTimeout(2000);
await shot("hub");
// 2. dial: the console's launch control starts travel.depart
// depart to another system (a same-system launch reloads without dialing); Travel only reads id and name
const go = await page.evaluate(() => { document.querySelector("#hub .back")?.click(); window.__travel.depart({ id: "chulak", name: "Chulak" }, new URLSearchParams(location.search)); return window.__travel.stage; });
console.log("depart", go);
// swiftshader frame times are irregular, so time the shots by the travel clock, not the wall clock
const travelAt = async (stage, t) => { for (let i = 0; i < 300; i++) { const s = await page.evaluate(() => ({ stage: window.__travel?.stage, t: window.__travel?.t ?? 0 })); if (s.stage === stage && s.t >= t) return s; if (s.stage === "idle" && stage !== "idle") return s; await page.waitForTimeout(40); } };
console.log("dial", JSON.stringify(await travelAt("dial", 1.2)));
await shot("dial");
console.log("kawoosh", JSON.stringify(await travelAt("dial", 2.45)));
await shot("kawoosh");
console.log("tunnel", JSON.stringify(await travelAt("tunnel", 0.6)));
await shot("tunnel");
await page.waitForLoadState("load");
await page.waitForTimeout(600);
await shot("arrive");
// 3. return gate in the world, 115 m ahead facing the ship; its own clock encodes the chevrons
await page.goto(`${base}/?lock=free&quality=low`, { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game, f = window.__flight;
  const V = f.pos.constructor;
  const fwd = new V(0, 0, 1).applyQuaternion(f.quat);
  // off the flight line so the ship does not fly through it during the capture
  const side = new V(1, 0, 0).applyQuaternion(f.quat);
  g.gate.open(f.pos.clone().addScaledVector(fwd, 260).addScaledVector(side, 90), fwd.clone().negate());
});
await page.waitForTimeout(900);
await shot("gate-dialing");
await page.waitForTimeout(2500);
await shot("gate-open");
await browser.close();
srv.close();
