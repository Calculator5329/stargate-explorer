// Headless check of the kill replay against the running dev server: spawns a glider ahead, holds fire until it dies,
// waits for the cut, plays the clip and reports whether tracers and the victim's rig are on screen in both shots.
// Usage: node scripts/replay-test.mjs (writes docs/shots/_replay-A.png and _replay-B.png).
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
await page.goto("http://localhost:5187/?lock=free&quality=low", { waitUntil: "load" });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const g = window.__game, f = window.__flight;
  const p = f.pos.clone().add(new (f.pos.constructor)(0, 0, 160));
  g.enemies.spawn(p, f.pos);
});
let kills = 0;
for (let i = 0; i < 80 && kills === 0; i++) {
  await page.waitForTimeout(500);
  // keep the glider parked in the gun line so the kill is certain (it evades otherwise); the rounds still do the killing
  kills = await page.evaluate(() => {
    const g = window.__game, f = window.__flight, e = g.enemies.list[0];
    // hold fire for the first 7.5 s of sim time so the clip gets its full pre-roll (the cut keeps PRE = 7 s before the kill)
    if (g.replay.t > 7.5) document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    if (e && e.alive) { const fwd = new (f.pos.constructor)(0, 0, 1).applyQuaternion(f.quat); e.pos.copy(f.pos).addScaledVector(fwd, 120); e.prevPos.copy(e.pos); e.vel.copy(f.vel ?? e.vel).multiplyScalar(0); }
    return g.combat.player.kills;
  });
}
console.log("kills", kills);
await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseup", { button: 0 })));
let has = false; // POST 1.6 s of sim time, then the cut; the sim runs slow under swiftshader so poll
for (let i = 0; i < 20 && !has; i++) { await page.waitForTimeout(500); has = await page.evaluate(() => window.__game.replay.hasHighlight); }
console.log("highlight", has);
const started = await page.evaluate(() => window.__game.playReplay());
console.log("play", started);
const probe = () => page.evaluate(() => {
  const g = window.__game, r = g.replay;
  const cam = g.cam;
  const tr = r.tracers.shots.filter((s) => s.alive).length;
  const onScreen = (o) => { const v = o.clone().project(cam); return Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1; };
  const shown = g.enemies.list.filter((e) => e.rig.root.visible);
  return { playing: r.playing, tracers: tr, glidersShown: shown.length, glidersOnScreen: shown.filter((e) => onScreen(e.rig.root.position)).length, killOnScreen: r.clip ? onScreen(r.clip.kill) : null, shipOnScreen: onScreen(g.combat.ship.position) };
});
// clip position as a fraction; the clip is short here (the kill comes a second or two in) so time by frac, not seconds
const frac = () => page.evaluate(() => { const r = window.__game.replay, c = r.clip; if (!c) return 2; const F = c.frames, S = 8 + 10 * 8; return (r.clipT - F[0]) / (F[(c.count - 1) * S] - F[0]); });
const until = async (f) => { for (let i = 0; i < 200 && (await frac()) < f; i++) await page.waitForTimeout(100); };
await until(0.3);
console.log("shotA", JSON.stringify(await probe()));
await page.screenshot({ path: "docs/shots/_replay-A.png" });
// the kill sits at PRE / (PRE + POST) = 0.7 of the clip: camera B must show the victim just before it goes
await until(0.64);
console.log("shotB-pre", JSON.stringify(await probe()));
await page.screenshot({ path: "docs/shots/_replay-B.png" });
await until(0.8);
console.log("shotB-post", JSON.stringify(await probe()));
await page.screenshot({ path: "docs/shots/_replay-C.png" });
await until(1.5);

// V mid-sortie: the mission is still running, V must start the last kill's replay at once and V again must stop it
const midV = await page.evaluate(async () => {
  const g = window.__game;
  const before = { done: g.mission.done, playing: g.replay.playing };
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV" }));
  await new Promise((r) => setTimeout(r, 300));
  const started = g.replay.playing;
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyV" }));
  await new Promise((r) => setTimeout(r, 100));
  return { ...before, started, stopped: !g.replay.playing };
});
console.log("midV", JSON.stringify(midV));console.log("after", JSON.stringify(await probe()));
await browser.close();
