// Headless: spawn one of each enemy kind, let them fly 12 s, report speed/state/hp and whether they shot; then kill each with the right number of hits.
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
// optional extra query (e.g. system=netu) and output suffix: node scripts/kinds-test.mjs system=netu
const extra = process.argv[2] ?? "", tag = extra ? `-${extra.replace(/[^a-z0-9]+/gi, "-")}` : "";
await page.goto(`http://localhost:5187/?lock=free&quality=low&mission=belt-clear${extra ? "&" + extra : ""}`, { waitUntil: "load" });
await page.waitForTimeout(5000);
const r = await page.evaluate(async () => {
  const g = window.__game, f = window.__flight, E = g.combat.enemies;
  const T = (await import("/src/core/tunables.ts")).T;
  const kinds = ["glider", "interceptor", "gunboat"];
  const spawned = kinds.map((k, i) => E.spawn(f.pos.clone().add(new (f.pos.constructor)((i - 1) * 120, 0, 420)), f.pos, k));
  const shotsBefore = g.combat.shots.shots.filter((s) => s.alive && s.side === "enemy").length;
  let maxEnemyShots = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 250));
    maxEnemyShots = Math.max(maxEnemyShots, g.combat.shots.shots.filter((s) => s.alive && s.side === "enemy").length);
  }
  const report = spawned.map((e) => ({ kind: e.kind, alive: e.alive, hp: Math.round(e.hp), speed: Math.round(e.speed), state: e.state, radius: e.radius, dist: Math.round(e.pos.distanceTo(f.pos)) }));
  const dmgs = [...new Set(g.combat.shots.shots.filter((s) => s.side === "enemy").map((s) => s.dmg))];
  // kill them: hits needed = ceil(hp / gunDamage)
  const kills = spawned.map((e) => { let n = 0; while (e.alive && n < 100) { E.damage(e, g.combat.gunDamage); n++; } return { kind: e.kind, hits: n }; });
  return { report, shotsBefore, maxEnemyShots, dmgs, kills, playerHp: Math.round(g.combat.player.hp), rigs: E.list.length, T: { i: T.interceptor.hp, gb: T.gunboat.hp } };
});
console.log(JSON.stringify(r));
// picture: the two new hulls parked ahead, held in the player's frame so the chase cam sees them
await page.evaluate(() => {
  const g = window.__game, f = window.__flight, E = g.combat.enemies, V = f.pos.constructor;
  for (const e of E.list) e.alive = false, (e.rig.root.visible = false);
  const far = f.pos.clone().add(new V(0, 0, 1).applyQuaternion(f.quat).multiplyScalar(3000));
  const hold = [[E.spawn(f.pos.clone(), far, "interceptor"), new V(-14, 4, 42)], [E.spawn(f.pos.clone(), far, "gunboat"), new V(26, -3, 70)]];
  const tick = E.tick.bind(E);
  E.tick = (dt, p, s) => {
    tick(dt, p, s);
    for (const [e, off] of hold) {
      e.pos.copy(f.pos).add(off.clone().applyQuaternion(f.quat));
      e.prevPos.copy(e.pos);
      e.quat.copy(f.quat);
      e.prevQuat.copy(e.quat);
      e.speed = 60;
    }
  };
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `docs/shots/_kinds${tag}.png` });
await browser.close();
