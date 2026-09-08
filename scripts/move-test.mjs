// Moves against the running dev server, on the proving ground: the sandbox lists every shortcut and chord on the HUD, B then W
// inside the window fires the Lunge (bar paid, cap lifted, chip on the bar, camera pulled back), B alone after the
// window fires the Cobra (nose up), B then A fires the Scissor (roll and slide). Usage: node scripts/move-test.mjs
// (STARGATE_TEST_URL picks the server; default localhost:5187)
import { chromium } from "playwright-core";

const base = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const errs = [];
const check = (ok, msg) => (ok ? console.log("ok   " + msg) : (errs.push(msg), console.log("FAIL " + msg)));
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.goto(`${base}?lock=free&quality=low&mission=proving-ground`, { waitUntil: "load" });
await page.waitForFunction(() => window.__game && window.__game.mission.phase !== "intro", null, { timeout: 30000 });

const sb = await page.evaluate(() => ({ type: window.__game.mission.def.type, line: document.querySelector("#hud .sandbox-guide").textContent, keys: [...window.__input.moveKeys], n: window.__flight.moves.length }));
check(sb.type === "sandbox" && sb.n === 4, `proving ground is a sandbox level with ${sb.n} moves`);
check(sb.keys.includes("KeyB") && /Lungeor B then W/.test(sb.line) && /Cobraor B/.test(sb.line), `HUD lists the chords (${sb.line})`);

/** sample the flight every frame until `until` says stop or `ms` pass */
const sample = (ms, until) => page.evaluate(async ([ms, until]) => {
  const f = window.__flight, cam = window.__renderer.camera, q = f.quat;
  // rotate (0,0,1) and (-1,0,0) by q by hand: no THREE global in the page
  const rot = (x, y, z) => { const { x: qx, y: qy, z: qz, w: qw } = q; const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z; return { x: ix * qw + iw * -qx + iy * -qz - iz * -qy, y: iy * qw + iw * -qy + iz * -qx - ix * -qz, z: iz * qw + iw * -qz + ix * -qy - iy * -qx }; };
  const out = [], t0 = performance.now();
  const test = new Function("s", "return " + until);
  while (performance.now() - t0 < ms) {
    await new Promise(requestAnimationFrame);
    const fwd = rot(0, 0, 1), right = rot(-1, 0, 0);
    const s = { t: performance.now() - t0, move: f.move?.name ?? null, speed: f.speed, bar: f.boostEnergy, fwdY: fwd.y, rightY: right.y, x: f.pos.x, fov: cam.fov, chip: document.querySelector("#hud .boost .mv").className, chipText: document.querySelector("#hud .boost .mv").textContent };
    out.push(s);
    if (test(s)) break;
  }
  return out;
}, [ms, until]);

// B then W inside the window: the Lunge
const bar0 = await page.evaluate(() => window.__flight.boostEnergy);
await page.keyboard.down("KeyB");
await page.waitForTimeout(60);
await page.keyboard.down("KeyW");
await page.keyboard.up("KeyB");
await page.keyboard.up("KeyW");
let s = await sample(1600, "s.t > 1200 && s.move === null");
const lunge = s.filter((x) => x.move === "Lunge");
check(lunge.length > 0, `B then W fires the Lunge (${lunge.length} frames)`);
check(lunge.length > 0 && Math.abs(bar0 - lunge[0].bar - 0.25) < 0.03, `Lunge takes 25% off the bar (${bar0.toFixed(2)} -> ${lunge[0]?.bar.toFixed(2)})`);
const topSpeed = Math.max(...lunge.map((x) => x.speed));
check(topSpeed > 430, `Lunge lifts the cap past boost speed (${Math.round(topSpeed)} m/s)`);
check(lunge.some((x) => /\bon\b/.test(x.chip) && x.chipText === "LUNGE"), "the move's name shows on the boost bar while it runs");
check(s[s.length - 1].move === null && !/\bon\b/.test(s[s.length - 1].chip), "the move ends and the chip goes");
const fovBefore = s[0].fov, fovMove = Math.max(...lunge.map((x) => x.fov));
check(fovMove > fovBefore + 3, `camera kicks the FOV during the move (${fovMove.toFixed(1)} vs ${fovBefore.toFixed(1)} before it)`);

// B alone: the Cobra, after the window closes; let the Lunge's speed coast off first so the bleed reads clean
await page.waitForFunction(() => window.__flight.speed < 200, null, { timeout: 15000 });
await page.evaluate(() => window.__flight.quat.identity()); // level, nose along +Z, so the pitch reads absolute
await page.keyboard.press("KeyB");
s = await sample(2000, "s.t > 1500 && s.move === null");
const cobra = s.filter((x) => x.move === "Cobra");
check(cobra.length > 0 && cobra[0].t > 200, `B alone fires the Cobra once the window closes (${cobra.length} frames, first at ${Math.round(cobra[0]?.t ?? -1)} ms)`);
const noseUp = Math.max(...cobra.map((x) => x.fwdY));
const slowest = Math.min(...cobra.map((x) => x.speed));
check(noseUp > 0.5, `Cobra pulls the nose up (fwd.y peaks at ${noseUp.toFixed(2)})`);
check(slowest < 90, `Cobra bleeds speed (${Math.round(slowest)} m/s at the slowest)`);

// B then A: the Scissor left
await page.waitForTimeout(400);
await page.evaluate(() => window.__flight.quat.identity()); // the Cobra leaves the nose high; level again so the roll reads
await page.keyboard.down("KeyB");
await page.waitForTimeout(60);
await page.keyboard.down("KeyA");
await page.keyboard.up("KeyB");
await page.keyboard.up("KeyA");
s = await sample(1600, "s.t > 1200 && s.move === null");
const sc = s.filter((x) => x.move === "Scissor left");
check(sc.length > 0, `B then A fires the Scissor left (${sc.length} frames), not a plain roll`);
const rolled = Math.max(...sc.map((x) => Math.abs(x.rightY)));
check(rolled > 0.6, `Scissor rolls the hull (|right.y| peaks at ${rolled.toFixed(2)})`);

// The sandbox refills between moves; normal-flight affordability is covered by sandbox-controls-check.mjs.
await page.waitForFunction(() => !window.__flight.move && window.__flight.boostEnergy === 1, null, { timeout: 5000 });
check(await page.evaluate(() => window.__game.combat.practice), "sandbox protection is enabled");

check(pageErrors.length === 0, `no page errors (${pageErrors.slice(0, 2).join(" | ")})`);
await browser.close();
if (errs.length) {
  console.error(`\n${errs.length} failed`);
  process.exit(1);
}
console.log("\nall good");
