// node scripts/settings-test.mjs  → exercises the pause menu (rebind, invert Y, quality) and a fake gamepad
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
// a fake standard-mapping pad the page can drive through window.__pad
await page.addInitScript(() => {
  window.__pad = null;
  navigator.getGamepads = () => (window.__pad ? [window.__pad] : []);
});
await page.goto("http://localhost:5187/?mission=belt-clear", { waitUntil: "load" });
await page.waitForTimeout(2000);
const out = {};
out.menuOpen = await page.evaluate(() => document.getElementById("menu").classList.contains("on"));
await page.click("#menu .binds summary");
out.rows = await page.locator("#menu .binds .bind").count();
out.pullUpBefore = await page.locator("#menu .binds .bind").nth(0).textContent();
// rebind pull-up to ArrowUp
await page.locator("#menu .binds .bind").nth(0).click();
out.listening = await page.locator("#menu .binds .bind").nth(0).textContent();
await page.keyboard.press("ArrowUp");
out.pullUpAfter = await page.locator("#menu .binds .bind").nth(0).textContent();
// swap: bind dive to ArrowUp too → pull-up takes dive's old key
await page.locator("#menu .binds .bind").nth(1).click();
await page.keyboard.press("ArrowUp");
out.afterSwap = [await page.locator("#menu .binds .bind").nth(0).textContent(), await page.locator("#menu .binds .bind").nth(1).textContent()];
out.saved = await page.evaluate(() => JSON.parse(localStorage.getItem("stargate-explorer.save.v1")).settings);
await page.check("#menu [name=invert]");
out.invertSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("stargate-explorer.save.v1")).settings.invertY);
// reset restores W
await page.click("#menu .binds .reset");
out.afterReset = await page.locator("#menu .binds .bind").nth(0).textContent();
// quality change reloads without ?quality and the save carries it
await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.selectOption("#menu [name=quality]", "low")]);
await page.waitForFunction(() => document.querySelector("canvas") !== null);
await page.waitForTimeout(1500);
out.urlAfterQuality = page.url();
out.qualitySaved = await page.evaluate(() => JSON.parse(localStorage.getItem("stargate-explorer.save.v1")).settings.quality);
out.dpr = await page.evaluate(() => document.querySelector("canvas").width / innerWidth);
await browser.close();
// second page: lock=free so the sim runs, drive the fake pad
const b2 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p2 = await b2.newPage({ viewport: { width: 1280, height: 720 } });
p2.on("pageerror", (e) => console.error("page error:", e.message));
await p2.addInitScript(() => {
  window.__pad = null;
  navigator.getGamepads = () => (window.__pad ? [window.__pad] : []);
});
await p2.goto("http://localhost:5187/?lock=free&mission=belt-clear&quality=low", { waitUntil: "load" });
await p2.waitForTimeout(2000);
const pad = (axes, pressed) => ({ connected: true, mapping: "standard", axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });
await p2.evaluate((p) => (window.__pad = p), pad([0.8, -0.9, 0, 0], [7, 0]));
await p2.waitForTimeout(400);
out.pad = await p2.evaluate(() => {
  const g = window.__game, f = window.__flight;
  return { hint: document.querySelector("#hud .hint").textContent.slice(0, 40), speed: Math.round(f.speed), boosting: f.boosting, shots: g.combat.shots.shots.filter((s) => s.alive && s.side === "player").length };
});
await p2.evaluate((p) => (window.__pad = p), pad([0, 0, 0, 0], [5]));
await p2.waitForTimeout(500);
out.barrel = await p2.evaluate(() => window.__flight.barrelLeft !== 0);
await b2.close();
console.log(JSON.stringify(out, null, 1));
