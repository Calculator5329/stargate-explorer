// Drive requested missions and verify their durable completion counts/rewards.
// Usage: node scripts/chain-test.mjs [mission-id ...] (default: all)
// STARGATE_TEST_URL selects an isolated server; default remains localhost:5187.
import { chromium } from "playwright-core";
const ALL = ["belt-clear", "duel", "gauntlet", "hunt", "ring-race", "wreck-race", "shard-run", "descent", "graveyard-ambush", "chulak-aces", "escort", "bomber-line", "blockade", "netu-convoy", "hold-the-gate", "hatak", "tollana-siege"];
const ids = process.argv.length > 2 ? process.argv.slice(2) : ALL;
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const SAVE_KEY = "stargate-explorer.save.v1";
const SAVE_WAIT_MS = 1500;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const expected = new Map();
const rewards = new Set();
const errs = [];

async function readProgress(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  if (raw === null) return null;
  let save;
  try { save = JSON.parse(raw); } catch { throw new Error("Persisted save is malformed JSON"); }
  const p = save?.progress;
  if (!p || typeof p !== "object" || Array.isArray(p) || !p.missions || typeof p.missions !== "object" || Array.isArray(p.missions)
    || !Array.isArray(p.unlocked) || p.unlocked.some((id) => typeof id !== "string" || !id)) throw new Error("Persisted progress has an invalid shape");
  for (const record of Object.values(p.missions)) {
    if (!record || !Number.isSafeInteger(record.completions) || record.completions < 0) throw new Error("Persisted completion count is invalid");
  }
  return p;
}

function progressProblem(progress) {
  if (!progress) return "Persisted save is missing";
  for (const [id, count] of expected) {
    if (progress.missions[id]?.completions !== count) return `Persisted completion count for ${id.slice(0, 80)} must be ${count}`;
  }
  for (const reward of rewards) if (!progress.unlocked.includes(reward)) return `Persisted unlock is missing: ${reward.slice(0, 80)}`;
  return null;
}

async function waitForProgress(page) {
  const deadline = performance.now() + SAVE_WAIT_MS;
  let problem;
  do {
    problem = progressProblem(await readProgress(page));
    if (!problem) return;
    await page.waitForTimeout(50);
  } while (performance.now() < deadline);
  throw new Error(problem);
}

try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { if (errs.length < 10) errs.push(e.message.slice(0, 240)); });
  for (const id of ids) {
    const url = new URL(baseURL);
    url.search = new URLSearchParams({ lock: "free", quality: "low", mission: id });
    await page.goto(url.href, { waitUntil: "load" });
    await page.waitForFunction(() => window.__game && window.__game.mission);
    const meta = await page.evaluate(() => ({ id: window.__game.mission.def.id, unlocks: window.__game.mission.def.unlocks ?? null }));
    if (meta.id !== id) throw new Error(`Requested mission ${id.slice(0, 80)} loaded ${String(meta.id).slice(0, 80)}`);
    if (meta.unlocks !== null && (typeof meta.unlocks !== "string" || !meta.unlocks)) throw new Error("Mission declared an invalid unlock reward");
    const before = await readProgress(page);
    if (expected.size) { const problem = progressProblem(before); if (problem) throw new Error(`After navigation: ${problem}`); }
    const nextCount = (before?.missions[id]?.completions ?? 0) + 1;
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
      g.combat.player.hp = g.combat.maxHp; // the player never flies here and turret fire landed it at 12% hull (escort) before the fixed 0.9 assist profile; completion is the subject, not survival
      if (type === "strike") for (const x of g.combat.extras) if (x.alive && x.damage) x.damage(1e6);
      if ((type === "hold" || type === "intercept") && m.phase !== "intro" && m.clock < m.def.duration - 3) m.clock = m.def.duration - 3; // outlasting the clock for real is the whole mission; the chain test only needs the win path
      if ((type === "run" || type === "race") && m.phase !== "intro" && performance.now() - lastGate > 500 && m.next < m.rings.length) {
        const r = m.rings[m.next];
        f.__jump = [r.pos.clone().addScaledVector(r.normal, -12), r.pos.clone().addScaledVector(r.normal, 12)];
        lastGate = performance.now();
      }
    }
    const P = g.combat.player;
    return { type, phase: m.phase, title: m.phase === "complete" ? m.winTitle : m.loseTitle, clock: Math.round(m.clock), kills: P.kills, hp: Math.round(P.hp), wall: Math.round((performance.now() - t0) / 1000), summary: m.phase === "complete" ? m.summary().replace(/\n/g, " | ") : m.loseLine };
  });
    if (res.phase !== "complete") throw new Error(`Mission ${id.slice(0, 80)} ended ${String(res.phase).slice(0, 80)}`);
    expected.set(id, nextCount);
    if (meta.unlocks) rewards.add(meta.unlocks);
    await waitForProgress(page);
    console.log(`ok   ${id.padEnd(17)} ${res.type.padEnd(7)} ${res.title.padEnd(26)} clock ${String(res.clock).padStart(3)}s  wall ${res.wall}s  kills ${res.kills}  hp ${res.hp}   ${res.summary}`);
  }
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.__game && window.__game.mission);
  const persisted = await readProgress(page);
  const problem = progressProblem(persisted);
  if (problem) throw new Error(`After reload: ${problem}`);
  if (errs.length) throw new Error(`Page errors: ${errs.join(" | ")}`);
  console.log("persisted progress verified:", JSON.stringify({ missions: Object.fromEntries(expected), unlocks: [...rewards] }));
} catch (error) {
  console.error("FAIL", String(error?.message ?? error).slice(0, 600));
  process.exitCode = 1;
} finally {
  await browser.close();
}
