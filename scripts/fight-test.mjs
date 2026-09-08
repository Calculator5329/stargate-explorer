// Headless functional test of the combat loop against the running dev server: spawns two gliders ahead,
// holds fire and prints kills / hits / hp every 4 s. Usage: node scripts/fight-test.mjs (writes docs/shots/_fight-test.png).
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto((process.env.STARGATE_TEST_URL ?? "http://localhost:5187/") + "?lock=free&quality=low", { waitUntil: "load" });
await page.waitForTimeout(1500);
// spawn two gliders dead ahead, close, and hold fire
const r0 = await page.evaluate(() => {
  const g = window.__game, f = window.__flight;
  const p = f.pos.clone().add(new (f.pos.constructor)(0, 0, 220));
  g.enemies.spawn(p, f.pos); g.enemies.spawn(p.clone().add(new (f.pos.constructor)(8, 0, 40)), f.pos);
  document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
  return { phase: g.mission.phase, alive: g.enemies.aliveCount, hp: g.combat.player.hp };
});
console.log("t0", JSON.stringify(r0));
for (let i = 1; i <= 8; i++) {
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 })); // re-assert: an HMR reload drops it
    const g = window.__game;
    const P = g.combat.player;
    const live = g.combat.shots.shots.filter((s) => s.alive).length;
    return { phase: g.mission.phase, wave: g.mission.wave, alive: g.enemies.aliveCount, kills: P.kills, fired: P.fired, hits: P.hits, hp: Math.round(P.hp), shots: live, line: g.mission.line };
  });
  console.log(`t${i}`, JSON.stringify(r));
}
await page.screenshot({ path: "docs/shots/_fight-test.png" });
await browser.close();
