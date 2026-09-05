// Headless: drive every mission to its end card without flying it (kill spawns, teleport through gates,
// destroy capital parts), in one browser context so the save's progress chain and unlocks are exercised.
// Usage: node scripts/chain-test.mjs [mission-id ...]   (default: all)
import { chromium } from "playwright-core";
const ALL = ["belt-clear", "gauntlet", "ring-race", "shard-run", "graveyard-ambush", "escort", "blockade", "hatak"];
const ids = process.argv.length > 2 ? process.argv.slice(2) : ALL;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
for (const id of ids) {
  await page.goto(`http://localhost:5187/?lock=free&quality=low&mission=${id}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__game && window.__game.mission);
  const res = await page.evaluate(async () => {
    const g = window.__game, m = g.mission, f = window.__flight;
    const type = m.def.type;
    m.timer = 0; // skip the intro
    const orig = f.tick.bind(f);
    f.tick = (dt, input) => { orig(dt, input); const j = f.__jump; if (j) { f.prevPos.copy(j[0]); f.pos.copy(j[1]); f.__jump = null; } };
    const t0 = performance.now();
    let steps = 0, lastGate = 0;
    while (!m.done && performance.now() - t0 < 120000) {
      await new Promise((r) => setTimeout(r, 200));
      steps++;
      for (const e of g.enemies.list) if (e.alive) g.enemies.damage(e, 1e6);
      if (type === "strike") for (const x of g.combat.extras) if (x.alive && x.damage) x.damage(1e6);
      if ((type === "run" || type === "race") && m.phase !== "intro" && performance.now() - lastGate > 500 && m.next < m.rings.length) {
        const r = m.rings[m.next];
        f.__jump = [r.pos.clone().addScaledVector(r.normal, -12), r.pos.clone().addScaledVector(r.normal, 12)];
        lastGate = performance.now();
      }
    }
    const P = g.combat.player;
    return { type, phase: m.phase, title: m.phase === "complete" ? m.winTitle : m.loseTitle, clock: Math.round(m.clock), kills: P.kills, hp: Math.round(P.hp), wall: Math.round((performance.now() - t0) / 1000), summary: m.phase === "complete" ? m.summary().replace(/\n/g, " | ") : m.loseLine };
  });
  const ok = res.phase === "complete";
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${id.padEnd(17)} ${res.type.padEnd(7)} ${res.title.padEnd(26)} clock ${String(res.clock).padStart(3)}s  wall ${res.wall}s  kills ${res.kills}  hp ${res.hp}   ${res.summary}`);
}
await page.waitForTimeout(300);
const save = await page.evaluate(() => JSON.parse(localStorage.getItem("stargate-explorer.save.v1")).progress);
console.log("progress:", JSON.stringify({ unlocked: save.unlocked, missions: Object.fromEntries(Object.entries(save.missions).map(([k, v]) => [k, v.completions])) }));
if (errs.length) console.log("page errors:", errs);
await browser.close();
process.exit(failed || errs.length ? 1 : 0);
