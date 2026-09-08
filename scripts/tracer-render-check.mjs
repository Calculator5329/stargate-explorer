// Tracers must be drawn where they actually are. The sim advances a round once a tick and the renderer
// lerps prevPos→pos by the frame's alpha, so `prevPos` has to be one tick behind `pos` — not the muzzle it
// was fired from. When combat kept its own copy of the previous position (through 2026-09-08) prevPos never
// moved, and every bolt drew a long way behind itself: "it's like the blaster shoots backwards".
// Checks the sim gap and the actual instance matrices the GPU gets. Usage: node scripts/tracer-render-check.mjs
import { chromium } from "playwright-core";
import assert from "node:assert";

const url = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
await page.goto(url + "?lock=free&quality=low&mission=duel", { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const g = window.__game, f = window.__flight, V = f.pos.constructor;
  g.enemies.spawn(f.pos.clone().add(new V(0, 0, 900)), f.pos);
  document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
});
await page.waitForTimeout(1200);
const r = await page.evaluate(() => {
  const g = window.__game;
  const live = g.combat.shots.shots.filter((s) => s.alive && s.side === "player");
  const step = live.map((s) => s.pos.distanceTo(s.prevPos));
  const tick = live.map((s) => s.vel.length() / 60);
  // what the GPU is handed: instance translation vs the round's own position
  const mesh = g.combat.shots.group.children.find((c) => c.isInstancedMesh);
  const M = mesh.instanceMatrix.array;
  const drawn = live.slice(0, 8).map((s, i) => {
    const o = i * 16;
    const len = Math.max(6, s.vel.length() * 0.014); // tracer is drawn from its tail
    const back = len / 2;
    const dir = s.vel.clone().normalize();
    const tail = new s.pos.constructor(M[o + 12], M[o + 13], M[o + 14]).addScaledVector(dir, back);
    return tail.distanceTo(s.pos);
  });
  return { n: live.length, step, tick, drawn, fired: g.combat.player.fired };
});
assert.ok(r.n >= 4, `expected live player rounds, got ${r.n} (fired ${r.fired})`);
// a round travels exactly one tick between prevPos and pos
for (let i = 0; i < r.step.length; i++) {
  assert.ok(Math.abs(r.step[i] - r.tick[i]) < 1.5,
    `round ${i}: prevPos is ${r.step[i].toFixed(1)} m behind pos, one tick is ${r.tick[i].toFixed(1)} m — the tracer draws where it is not`);
}
// and it is drawn within one tick of where it is, whatever this frame's alpha
for (let i = 0; i < r.drawn.length; i++) {
  assert.ok(r.drawn[i] <= r.tick[i] + 2,
    `round ${i}: drawn ${r.drawn[i].toFixed(1)} m from its true position, more than the ${r.tick[i].toFixed(1)} m a tick covers`);
}
console.log(`ok   ${r.n} rounds: prevPos one tick (${r.tick[0].toFixed(1)} m) behind, drawn within ${Math.max(...r.drawn).toFixed(1)} m of true position`);
await browser.close();
