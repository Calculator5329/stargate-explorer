// node scripts/cap.mjs name=query ...   → docs/shots/_name.png at 1280x720 after 2.5 s
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf("="), name = arg.slice(0, i), q = arg.slice(i + 1);
  await page.goto(`http://localhost:5187/?${q.replace(/,/g, "&")}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `docs/shots/_${name}.png` });
  console.log(name);
}
await browser.close();
