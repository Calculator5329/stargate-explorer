// Behaviour probe for the scripted-steering missions: the hunt quarry must run the chain and turn
// to fight when the player is close; bomber-line runners must fly at the relay and leak when they reach it.
// Usage: node scripts/pursuit-probe.mjs   (dev server on localhost:5187 or STARGATE_TEST_URL)
import { chromium } from "playwright-core";
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails++; };
try {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
  const open = async (id, extra = {}) => {
    const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: "low", mission: id, ...extra });
    await page.goto(url.href, { waitUntil: "load" });
    await page.waitForFunction(() => window.__game && window.__game.mission);
  };
  const sim = (seconds) => page.evaluate(async (s) => {
    const g = window.__game, m = g.mission; m.timer = 0;
    const t0 = m.clock; m.timer = 0; while (m.clock - t0 < s && !m.done) await new Promise((r) => setTimeout(r, 100));
  }, seconds);

  // hunt: quarry runs the chain on its own
  await open("hunt");
  const h0 = await page.evaluate(() => { const m = window.__game.mission; m.timer = 0; return { rings: m.rings.length, clock: m.clock, phase: m.phase }; });
  await sim(12);
  const h1 = await page.evaluate(() => { const m = window.__game.mission, q = window.__game.enemies.list.find((e) => e.alive); return { qNext: m.qNext, steer: !!q?.steer, speed: q?.speed, line: m.line, rocks: window.__rocks?.count ?? -1 }; });
  console.log("hunt", h0, h1);
  check(h1.qNext >= 2, `quarry advanced through the chain on its own (gate ${h1.qNext} after 12 s)`);
  check(h1.steer && h1.speed > 120, "quarry is scripted and at running speed");
  // teleport the player onto the quarry: it should turn to fight (steer released)
  await page.evaluate(() => { const g = window.__game, f = window.__flight, q = g.enemies.list.find((e) => e.alive); f.pos.copy(q.pos).addScaledVector(q.vel, -1.2); f.prevPos.copy(f.pos); });
  await sim(1.5);
  const h2 = await page.evaluate(() => { const g = window.__game, m = g.mission, q = g.enemies.list.find((e) => e.alive); return { steer: !!q?.steer, fightT: m.fightT, line: m.line }; });
  console.log("hunt fight", h2);
  check(!h2.steer && h2.fightT > 0, "quarry turned to fight when the player closed");

  // bomber-line: runners head for the relay and a leak counts.
  // `mission.runners` is a Set (pooled enemies are reused, so object identity is what keeps its count honest).
  await open("bomber-line");
  await sim(22);
  const b1 = await page.evaluate(() => { const g = window.__game, m = g.mission; const rs = [...m.runners].filter((e) => e.alive); const relay = m.relay.pos;
    const closing = rs.map((e) => { const d = relay.clone().sub(e.pos); return e.vel.dot(d.normalize()); });
    return { sent: m.sent, alive: rs.length, closing, others: g.enemies.list.filter((e) => e.alive && !rs.includes(e)).length, line: m.line }; });
  console.log("bomber-line", b1);
  check(b1.sent >= 1 && b1.alive >= 1, "runners spawned");
  check(b1.closing.every((c) => c > 60), "every live runner is closing on the relay");
  check(b1.others >= 1, "escorts came with them");
  await page.evaluate(() => { const m = window.__game.mission; const e = [...m.runners].find((x) => x.alive); e.pos.copy(m.relay.pos).addScaledVector(e.vel, -0.2); });
  await sim(0.5);
  const b2 = await page.evaluate(() => { const m = window.__game.mission; return { leaks: m.leaks, line: m.line, done: m.done }; });
  console.log("leak", b2);
  check(b2.leaks === 1 && !b2.done, "a runner at the relay is one leak, uncredited, mission continues");

  // duel: open space and ?foe= override
  await open("duel", { foe: "gunboat" });
  const d = await page.evaluate(() => ({ foe: window.__game.mission.foe, rocks: window.__rocks?.count ?? window.__rocks?.live ?? -1 }));
  console.log("duel", d);
  check(d.foe === "gunboat", "?foe= picks the opponent");
} finally { await browser.close(); }
console.log(fails ? `${fails} FAILED` : "all ok");
process.exit(fails ? 1 : 0);
