// Headless captures for docs/shots. Usage: node scripts/capture-shots.mjs [YYYY-MM-DD] [baseUrl]
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
  silhouette: "?view=side&spin=0&silhouette=1",
};

mkdirSync("docs/shots", { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
for (const [name, q] of Object.entries(VIEWS)) {
  await page.goto(`${base}/${q}`, { waitUntil: "load" });
  await page.waitForTimeout(4500);
  const path = `docs/shots/${date}-${name}.png`;
  await page.screenshot({ path });
  console.log("wrote", path);
}
await browser.close();
