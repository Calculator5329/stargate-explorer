// Headless test of destructible rocks and lethal crashes against the running dev server (5187).
//  1. shoot the nearest rock dead ahead until it breaks: expects fragments (ttl>0 slots) and rocks.broken to rise
//  2. spawn a glider and fling it into a rock: expects it dead within a second, no kill credit
//  3. spawn a glider next to a player-made fragment moving at it: expects a kill credited to the player
// Usage: node scripts/rock-test.mjs [system=abydos]   → docs/shots/_rock-test.png
import { chromium } from "playwright-core";
const extra = process.argv[2] ?? "";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto(`http://localhost:5187/?lock=free&quality=low${extra ? "&" + extra : ""}`, { waitUntil: "load" });
await page.waitForTimeout(1500);
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fail++; };

// --- 1. break a rock by teleporting the ship in front of a small one and holding fire
const r1 = await page.evaluate(async () => {
  const f = window.__flight, R = window.__rocks, g = window.__game;
  const V = f.pos.constructor;
  // pick a live rock of radius 6..14 near the start
  let best = -1, bd = Infinity;
  for (let i = 0; i < R.count; i++) {
    const r = R.radii[i]; if (r < 6 || r > 14) continue;
    const d = Math.hypot(R.centers[i * 3], R.centers[i * 3 + 1], R.centers[i * 3 + 2]);
    if (d < bd) (bd = d), (best = i);
  }
  const c = new V(R.centers[best * 3], R.centers[best * 3 + 1], R.centers[best * 3 + 2]);
  // park 120 m from it, facing it, hold still
  const dir = c.clone().normalize();
  f.pos.copy(c).addScaledVector(dir, -120);
  f.quat.setFromUnitVectors(new V(0, 0, 1), dir);
  f.vel.set(0, 0, 0); f.velDir.copy(dir); f.speed = 0;
  const hp0 = R.hp[best], radius = R.radii[best];
  document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
  const t0 = performance.now();
  let frames = 0;
  while (R.alive[best] && performance.now() - t0 < 12000) { await new Promise((r) => setTimeout(r, 100)); frames++; f.pos.copy(c).addScaledVector(dir, -120); f.vel.set(0, 0, 0); f.speed = 0; }
  document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
  let frags = 0;
  for (let i = 0; i < R.count; i++) if (R.alive[i] && R.ttl[i] > 0) frags++;
  return { best, radius, hp0, alive: R.alive[best], frags, broken: R.broken, fired: g.combat.player.fired, ms: Math.round(performance.now() - t0), count: R.count };
});
console.log("break", JSON.stringify(r1));
check(r1.alive === 0, "rock broke under cannon fire");
check(r1.frags >= 2, `fragments spawned (${r1.frags})`);
check(r1.broken === 1, "rocks.broken counted");
await page.screenshot({ path: "docs/shots/_rock-test.png" });

// --- 2. a glider flung into a big rock dies, no credit
const r2 = await page.evaluate(async () => {
  const f = window.__flight, R = window.__rocks, g = window.__game;
  const V = f.pos.constructor;
  let best = -1, br = 0;
  for (let i = 0; i < R.count; i++) if (R.alive[i] && R.ttl[i] === 0 && R.radii[i] > br) (br = R.radii[i]), (best = i);
  const c = new V(R.centers[best * 3], R.centers[best * 3 + 1], R.centers[best * 3 + 2]);
  const from = c.clone().add(new V(br + 60, 0, 0));
  f.pos.copy(c).add(new V(0, br + 400, 0)); f.vel.set(0, 0, 0); f.speed = 0; // player well clear
  const e = g.enemies.spawn(from, c);
  const kills0 = g.combat.player.kills;
  // point it at the rock and give it speed; the brain avoids rocks, so re-aim every tick for a moment
  const t0 = performance.now();
  while (e.alive && performance.now() - t0 < 4000) {
    e.vel.set(-160, 0, 0); e.speed = 160;
    await new Promise((r) => setTimeout(r, 16));
  }
  return { alive: e.alive, kills: g.combat.player.kills - kills0, ms: Math.round(performance.now() - t0) };
});
console.log("crash", JSON.stringify(r2));
check(!r2.alive, "glider destroyed on rock impact");
check(r2.kills === 0, "no kill credit for a belt rock");

// --- 3. a fragment the player made kills a glider: credited
const r3 = await page.evaluate(async () => {
  const f = window.__flight, R = window.__rocks, g = window.__game;
  const V = f.pos.constructor;
  // break a rock by direct damage so we have fresh fragments, then plant a glider in one's path
  let best = -1, bd = Infinity;
  for (let i = 0; i < R.count; i++) { const r = R.radii[i]; if (!R.alive[i] || R.ttl[i] > 0 || r < 10 || r > 20) continue; const d = Math.hypot(R.centers[i*3]-f.pos.x, R.centers[i*3+1]-f.pos.y, R.centers[i*3+2]-f.pos.z); if (d < bd) (bd = d), (best = i); }
  const c = new V(R.centers[best * 3], R.centers[best * 3 + 1], R.centers[best * 3 + 2]);
  f.pos.copy(c).add(new V(0, 500, 0)); f.vel.set(0, 0, 0); f.speed = 0;
  R.damage(best, 1e6, new V(1, 0, 0));
  let fi = -1;
  for (let i = 0; i < R.count; i++) if (R.alive[i] && R.ttl[i] > 0 && R.playerMade[i]) { fi = i; break; }
  const fp = new V(R.centers[fi * 3], R.centers[fi * 3 + 1], R.centers[fi * 3 + 2]);
  const fv = new V(R.vel[fi * 3], R.vel[fi * 3 + 1], R.vel[fi * 3 + 2]);
  const speed = fv.length();
  const ahead = fp.clone().addScaledVector(fv.clone().normalize(), 25);
  const e = g.enemies.spawn(ahead, fp);
  const kills0 = g.combat.player.kills;
  const t0 = performance.now();
  while (e.alive && performance.now() - t0 < 3000) { e.vel.set(0, 0, 0); e.speed = 0; e.pos.copy(ahead); await new Promise((r) => setTimeout(r, 16)); }
  return { fi, speed: Math.round(speed), alive: e.alive, kills: g.combat.player.kills - kills0, ms: Math.round(performance.now() - t0) };
});
console.log("fragment", JSON.stringify(r3));
check(!r3.alive, "glider killed by a flying fragment");
check(r3.kills === 1, "fragment kill credited to the player");
const perf = await page.evaluate(() => document.querySelector("#hud .perf")?.textContent);
console.log("perf:", perf?.replace(/\n/g, " | "));
await browser.close();
process.exit(fail ? 1 : 0);
