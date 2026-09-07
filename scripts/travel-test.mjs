// Headless: win the mission, confirm the gate opens and is the HUD marker, fly through it, watch the dial + tunnel + reload into the hub, then the arrive fade.
const BASE = (process.env.STARGATE_TEST_URL ?? "http://localhost:5187/").replace(/\/?$/, "/");
import { chromium } from "playwright-core";
// Hardware GL by default: under swiftshader a frame with the gate's burst and tunnel takes longer than playwright's
// screenshot timeout (the game itself holds 6..12 fps there, same as its baseline). SOFT_GL=1 keeps the software path.
const GL = process.env.SOFT_GL ? ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-gl=angle", "--use-angle=gl-egl"];
const browser = await chromium.launch({ args: [...GL, "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(BASE + "?lock=free&quality=low&mission=belt-clear", { waitUntil: "load" });
await page.waitForTimeout(6500);
const r1 = await page.evaluate(async () => {
  const g = window.__game, f = window.__flight;
  g.mission.win();
  await new Promise((r) => setTimeout(r, 400));
  const gate = g.gate;
  const d = gate.pos.distanceTo(f.pos);
  return { phase: g.mission.phase, gateAlive: gate.alive, markerIsGate: g.mission.marker === gate, dist: Math.round(d), again: document.querySelector("#hud .card .again").textContent };
});
console.log("won", JSON.stringify(r1));
// look at the gate: teleport 150 m in front of it, facing it
await page.evaluate(() => {
  const g = window.__game, f = window.__flight;
  const V = f.pos.constructor;
  f.pos.copy(g.gate.pos).addScaledVector(g.gate.normal, -150);
  const m = new (window.__rocks.group.matrixWorld.constructor)(); m.lookAt(g.gate.normal, new V(), new V(0, 1, 0)); f.quat.setFromRotationMatrix(m);
});
await page.waitForTimeout(600);
await page.screenshot({ path: "docs/shots/_gate.png" });
// fly through: step the ship across the disc
const r2 = await page.evaluate(async () => {
  const g = window.__game, f = window.__flight;
  f.pos.copy(g.gate.pos).addScaledVector(g.gate.normal, -20);
  await new Promise((r) => setTimeout(r, 150));
  f.pos.copy(g.gate.pos).addScaledVector(g.gate.normal, 20);
  await new Promise((r) => setTimeout(r, 300));
  return { gateAlive: g.gate.alive, dialOn: document.getElementById("dial").classList.contains("on"), busy: window.__travel.busy, dest: document.querySelector("#dial .dest").textContent };
});
console.log("crossed", JSON.stringify(r2));
// the dial and tunnel are timed by the gate (chevron cadence, burst, tunnel); poll for each phase rather than sleeping,
// and give the tunnel shot a short timeout: the reload into the hub follows it closely and a swiftshader frame is slow
await page.waitForFunction(() => document.getElementById("dial").classList.contains("on"), null, { timeout: 5000 });
await page.waitForTimeout(900);
await page.screenshot({ path: "docs/shots/_dial.png" });
await page.waitForFunction(() => window.__travel.tunnel.mesh.visible, null, { timeout: 8000 });
await page.screenshot({ path: "docs/shots/_tunnel.png", timeout: 2500 }).catch((e) => console.log("tunnel shot skipped:", String(e.message).split("\n")[0]));
await page.waitForURL(/hub=1/, { timeout: 15000 });
await page.waitForTimeout(400);
const r3 = await page.evaluate(() => ({ url: location.search, fade: window.__travel.tunnel.fade, hubOn: document.getElementById("hub").classList.contains("on"), systems: document.querySelectorAll("#hub .systems .system").length }));
console.log("arrived", JSON.stringify(r3));
await page.screenshot({ path: "docs/shots/_arrive.png" });
await page.waitForTimeout(2500);
const r4 = await page.evaluate(() => ({ fade: window.__travel.tunnel.fade, visible: window.__travel.tunnel.mesh.visible }));
console.log("settled", JSON.stringify(r4));
// launch a mission in another system from the hub. The console refuses a locked address (the lane's hub disables
// DIAL & LAUNCH), so seed the chain up to the escort into the save and come back to the hub first.
await page.evaluate(() => {
  const KEY = "stargate-explorer.save.v1";
  const j = JSON.parse(localStorage.getItem(KEY) || "{}");
  j.progress = { ...(j.progress ?? {}), missions: { ...(j.progress?.missions ?? {}), "belt-clear": { completions: 1 }, gauntlet: { completions: 1 }, "ring-race": { completions: 1 }, "shard-run": { completions: 1 } } };
  localStorage.setItem(KEY, JSON.stringify(j));
});
await page.goto(BASE + "?lock=free&quality=low&hub=1", { waitUntil: "load" });
await page.waitForTimeout(2500);
const r5 = await page.evaluate(async () => {
  const h = window.__hub; h.mission = "escort"; h.build();
  document.querySelector("#hub .go").click();
  await new Promise((r) => setTimeout(r, 500));
  const go = document.querySelector("#hub .go");
  return { hubOn: document.getElementById("hub").classList.contains("on"), dest: document.querySelector("#dial .dest").textContent, busy: window.__travel.busy, goDisabled: go.disabled, summary: document.querySelector("#hub .launch-summary").textContent, mission: h.mission, ship: h.ship, progress: JSON.parse(localStorage.getItem("stargate-explorer.save.v1")).progress };
});
console.log("launch", JSON.stringify(r5));
await page.waitForURL(/mission=escort/, { timeout: 15000 });
await page.waitForTimeout(3000);
const r6 = await page.evaluate(() => ({ url: location.search, title: window.__game.mission.def.title, sky: window.__game ? document.title : "" }));
console.log("escort", JSON.stringify(r6));
await page.screenshot({ path: "docs/shots/_chulak.png" });
await browser.close();
