// Headless: the Ha'tak's shield nodes and the hull push-out. Parks the ship 260 m off a collar node, facing it,
// holds fire and expects the node to take hits and die; then flies the ship into the pyramid face and expects
// to be pushed out rather than trapped. node scripts/hatak-probe.mjs
import { chromium } from "playwright-core";
const base = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const browser = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`${base}?lock=free&quality=low&mission=hatak`, { waitUntil: "load" });
await page.waitForFunction(() => window.__game && window.__game.mission && window.__game.mission.phase === "run", null, { timeout: 20000 });
const r = await page.evaluate(async () => {
  const g = window.__game, f = window.__flight, m = g.mission, C = g.combat;
  const T = window.__T;
  const cap = m.cap, node = cap.weakPoints[0];
  // kill the turrets outright so nothing shoots back, then face the first node from 260 m
  for (const x of C.extras) if (x.alive && cap.turrets.some((t) => t.pos === x.pos)) x.damage(9999);
  const hp0 = node.hp;
  const dir = node.pos.clone().sub(cap.group.position).normalize(); // from the pyramid centre out through the node
  f.pos.copy(node.pos).addScaledVector(dir, 260);
  const look = node.pos.clone().sub(f.pos).normalize();
  f.quat.setFromUnitVectors(new (f.pos.constructor)(0, 0, 1), look);
  f.prevPos.copy(f.pos); f.prevQuat.copy(f.quat);
  f.vel.set(0, 0, 0); f.speed = 0; f.throttle = 0;
  const I = window.__input;
  I.fire = true;
  const t0 = performance.now();
  let shieldedLine = "";
  while (performance.now() - t0 < 9000 && node.alive) {
    await new Promise((r) => setTimeout(r, 100));
    f.pos.copy(node.pos).addScaledVector(dir, 260); f.vel.set(0, 0, 0); f.speed = 0; // stay parked
    f.quat.setFromUnitVectors(new (f.pos.constructor)(0, 0, 1), node.pos.clone().sub(f.pos).normalize());
    if (m.line.includes("shielded")) shieldedLine = m.line;
  }
  I.fire = false;
  const node1 = { hp0, hp: node.hp, alive: node.alive, hits: C.player.hits, fired: C.player.fired, shieldedLine };
  // push-out: put the ship inside the pyramid face and tick
  const inside = cap.group.position.clone().add(new (f.pos.constructor)(0, 30, 0).applyQuaternion(cap.group.quaternion));
  f.pos.copy(inside); f.vel.set(0, 0, 0);
  await new Promise((r) => setTimeout(r, 300));
  const out = { insideAfter: cap.contains(f.pos), dist: f.pos.distanceTo(cap.group.position).toFixed(1) };
  return { node1, out, describe: cap.describe() };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
const ok = !r.node1.alive && !r.out.insideAfter;
console.log(ok ? "hatak-probe OK" : "hatak-probe FAILED");
process.exit(ok ? 0 : 1);
