// Headless: four things the mission and combat layers reported wrongly. Each is a number or a sentence the
// player is shown, so none of them broke a gate; all four were found by exploring the deployed build.
// Run after touching src/mission/intercept.ts, src/mission/strike.ts, Mission.deathLine or Combat.destroy/hurt.
const BASE = (process.env.STARGATE_TEST_URL ?? "http://localhost:5187/").replace(/\/?$/, "/");
import { chromium } from "playwright-core";

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"] });
let bad = 0;
const ok = (pass, label, detail = "") => {
  console.log(`${pass ? "ok  " : "FAIL"} ${label}${detail ? `   ${detail}` : ""}`);
  if (!pass) bad++;
};
const open = async (url) => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on("pageerror", (e) => (console.error("page error:", e.message), bad++));
  await page.goto(BASE + url, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  return page;
};

// --- 1: the bomber count on the HUD, and the spawn budget that reads the same number -------------------
{
  const page = await open("?lock=free&quality=low&mission=bomber-line");
  // force several spawn windows, killing most runners between them, so the pool hands the same objects back
  const r = await page.evaluate(async () => {
    const g = window.__game, m = g.mission, E = g.combat.enemies;
    const runnerKind = m.def.runner;
    for (let cycle = 0; cycle < 6; cycle++) {
      m.spawnT = 0;
      await new Promise((x) => setTimeout(x, 350));
      // kill all but one, so the next window has room and must reuse the dead objects
      const live = E.list.filter((e) => e.alive && e.kind === runnerKind);
      for (const e of live.slice(1)) (e.alive = false), (e.rig.root.visible = false);
      await new Promise((x) => setTimeout(x, 200));
    }
    m.spawnT = 0;
    await new Promise((x) => setTimeout(x, 500));
    // truth comes from the enemy pool, which cannot double-count: one object, one entry
    const truth = E.list.filter((e) => e.alive && e.kind === runnerKind).length;
    const shown = Number(/·\s*(\d+)\s*bomber/.exec(m.line)?.[1] ?? -1);
    return { truth, shown, line: m.line, maxAlive: m.def.maxAlive };
  });
  ok(r.shown === r.truth, "the bomber count on the HUD is the number of live bombers", JSON.stringify(r));
  ok(r.truth > 0 && r.truth <= r.maxAlive, "spawning keeps up and stays inside maxAlive", JSON.stringify({ truth: r.truth, maxAlive: r.maxAlive }));
  await page.close();
}

// --- 2: a dead player scores nothing --------------------------------------------------------------------
{
  const page = await open("?lock=free&quality=low&mission=belt-clear");
  const r = await page.evaluate(async () => {
    const g = window.__game, C = g.combat, f = window.__flight;
    while (C.enemies.aliveCount < 2) await new Promise((x) => setTimeout(x, 250));
    C.hurt(9999, f, "enemy");
    await new Promise((x) => setTimeout(x, 300));
    const atDeath = C.player.kills;
    // fly the survivors into rocks: each crash used to be credited to the corpse
    // crash them during the 1.6 s death sequence, which is when the counter used to run away
    for (const e of C.enemies.list) if (e.alive) C.enemies.crashed.push(e), (e.alive = false);
    await new Promise((x) => setTimeout(x, 2500));
    return { atDeath, after: C.player.kills, alive: C.player.alive, card: document.querySelector("#hud .card p")?.textContent ?? "" };
  });
  ok(r.after === r.atDeath, "no kills are credited after the player dies", JSON.stringify(r));
  await page.close();
}

// --- 3 + 4: the two cards say what actually happened ------------------------------------------------------
{
  const page = await open("?lock=free&quality=low&mission=hatak");
  const r = await page.evaluate(async () => {
    const g = window.__game, m = g.mission;
    for (const n of m.nodes) if (n.alive) g.combat.extras[g.combat.extras.indexOf(n)]?.damage?.(9999) ?? (n.alive = false);
    for (const n of m.nodes) n.alive = false;
    m.cap.hp = 0;
    m.win();
    await new Promise((x) => setTimeout(x, 500));
    return { summary: m.summary(), aliveGuns: m.turrets.filter((t) => t.alive).length, guns: m.turrets.length };
  });
  // every ring gun is untouched, so the card must not claim they are down
  const guns = /ring guns (\d+)/.exec(r.summary)?.[1];
  ok(guns === "0", "the Ha'tak card counts destroyed ring guns, not the array length", JSON.stringify(r));
  ok(/shield nodes 3/.test(r.summary), "the Ha'tak card counts the nodes that were destroyed", JSON.stringify({ summary: r.summary }));
  await page.close();
}
{
  const page = await open("?lock=free&quality=low&mission=belt-clear");
  const r = await page.evaluate(async () => {
    const g = window.__game, C = g.combat, f = window.__flight;
    C.hurt(9999, f, "enemy");
    await new Promise((x) => setTimeout(x, 2600));
    return { line: g.mission.line, card: document.querySelector("#hud .card p")?.textContent ?? "", cause: C.player.cause };
  });
  ok(!/belt took you/.test(r.card), "a death by enemy fire is not blamed on the belt", JSON.stringify(r));
  await page.close();
}
{
  const page = await open("?lock=free&quality=low&mission=belt-clear");
  const r = await page.evaluate(async () => {
    const g = window.__game, C = g.combat, f = window.__flight;
    C.hurt(9999, f, "rock");
    await new Promise((x) => setTimeout(x, 2600));
    return { card: document.querySelector("#hud .card p")?.textContent ?? "" };
  });
  ok(/belt took you/.test(r.card), "a death by rock still reads as the belt", JSON.stringify(r));
  await page.close();
}

await browser.close();
console.log(bad === 0 ? "\ncombat-guard OK" : `\ncombat-guard FAILED (${bad})`);
process.exit(bad === 0 ? 0 : 1);
