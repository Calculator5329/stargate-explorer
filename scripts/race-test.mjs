// Headless: load the ring race, let the intro run, then teleport the player through each gate a bit slower than the racers would; report places, finishes and the card.
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto("http://localhost:5187/?lock=free&quality=low&mission=ring-race", { waitUntil: "load" });
await page.waitForTimeout(7000);
const snap = () => page.evaluate(() => {
  const g = window.__game, m = g.mission;
  return { phase: m.phase, line: m.line, next: m.next, racers: m.racers.map((r) => ({ n: r.name, next: r.next, place: r.place, speed: Math.round(r.speed), dist: Math.round(r.pos.distanceTo(window.__flight.pos)) })) };
});
console.log("start", JSON.stringify(await snap()));
await page.screenshot({ path: "docs/shots/_race-grid.png" });
// follow the racers for a while without moving the player: they should pull ahead
await page.waitForTimeout(6000);
console.log("6s", JSON.stringify(await snap()));
// now teleport through the gates, one every 1.2 s
for (let i = 0; i < 8; i++) {
  await page.evaluate((i) => {
    // straddle the gate plane inside one sim tick: after flight.tick has set prevPos, move prev to 12 m short and pos to 12 m past
    const g = window.__game, f = window.__flight, r = g.mission.rings[i];
    if (!f.__hooked) {
      const orig = f.tick.bind(f);
      f.tick = (dt, input) => { orig(dt, input); const j = f.__jump; if (j) { f.prevPos.copy(j[0]); f.pos.copy(j[1]); f.__jump = null; } };
      f.__hooked = true;
    }
    f.__jump = [r.pos.clone().addScaledVector(r.normal, -12), r.pos.clone().addScaledVector(r.normal, 12)];
  }, i);
  console.log("gate", i, JSON.stringify(await page.evaluate(() => { const m = window.__game.mission; return { next: m.next, line: m.line }; })));
  await page.waitForTimeout(1200);
  if (i === 3) await page.screenshot({ path: "docs/shots/_race-mid.png" });
}
await page.waitForTimeout(800);
const end = await page.evaluate(() => {
  const g = window.__game, m = g.mission;
  return { phase: m.phase, title: m.winTitle, summary: m.summary(), racers: m.racers.map((r) => ({ n: r.name, next: r.next, place: r.place })), gate: g.gate.alive };
});
console.log("end", JSON.stringify(end));
await page.screenshot({ path: "docs/shots/_race-end.png" });
await browser.close();
