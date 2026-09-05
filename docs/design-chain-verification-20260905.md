# A48 Stargate Explorer: adopted mission-chain verification

Implemented in an isolated lane from `100f98ba5f46f38d2074bbf4119842f97f21822d`; root integration review remains pending. The initial audit and adopted design below are historical evidence. Cache evidence lives at `/home/ethan/.cache/tmp/astra-audit-20260905/stargate-chain-audit/`.

## Scope and prior disposition

Canonical registry entry workspace.json:2800–2811 identifies games/stargate-explorer as active, agents:full, private; publication remains owner-held. Read CLAUDE, STATUS, roadmap, DECISIONS and global preferences. No purpose/intent/taste files exist in this repo's docs listing; owning contract and current status/decisions supply the design constraints. Current HEAD100f98b. Agent context reports zero active sessions/leases, but canonical checkout contains unrelated uncommitted minimap/combat/world/launch/publication-config work. None was modified or treated as disposable. Script under audit is unchanged from HEAD.

The existing campaign A21 assessment correctly declined allocation cleanup without matched runtime evidence: sampled loops use scratch storage, instancing and fixed steps. This pass found no measured frame-time claim to overturn that disposition. Restaurant persistence and Neon/Gemini work are separate; this finding owns only Stargate's meaningful mission smoke path, not their source or balance. Existing owner-held difficulty/flight/art decisions remain untouched.

## One P2 finding: unlock progression is printed, never asserted

CLAUDE.md:49 requires scripts/chain-test.mjs after mission/level/save changes and says it checks the save's unlock chain. The script drives all eight missions via direct query URLs, counts a mission successful solely from phase===complete (:38–40), reads and prints persisted progress (:43–44), then exits based solely on mission failures or page errors (:47). It never verifies a completion record or expected unlocked hull. Direct query navigation means every mission can complete even if normal hub prerequisites remain locked.

Actual unchanged harness source was retained as baseline-source.mjs with SHA256 and HEAD in source-sha256.txt. The probe changes only the playwright import to a controlled browser-boundary fixture. That fixture returns complete for eight mission results and empty persisted progress {unlocked:[],missions:{}}. Running `node chain-probe.mjs` prints eight ok lines, empty progress, and exitCode=0 (results.log). No browser/game runtime was executed; this is a deterministic harness fault-injection proof, not evidence the current game actually loses saves. No game performance or FPS measurement is claimed.

The actual producer contract is Game.record (src/game.ts:79–88 in current working source): completion increments P.missions[id].completions, unlocks m.def.unlocks, writes the save. These lines are unchanged by the unrelated dirty minimap addition. LEVELS names heavy for blockade and prometheus for hatak. A missing write or unlock can therefore be invisible to the stated smoke gate.

## Adopt / refine / drop

ADOPT a narrow completion-and-persistence assertion in the existing chain script. Collect the executed mission id and declared unlock reward from each actual mission; require a corresponding persisted completion count and each expected reward after the browser has observed record completion. On failure print bounded missing records/rewards and exit nonzero. For user-selected mission subsets, check only those executed missions and their declared rewards; do not require the entire campaign. Preserve legitimate query-driven simulation acceleration and existing mission completion/error checks. Verify persisted localStorage across a reload or subsequent mission load, rather than infer persistence from m.phase or in-memory save alone.

REFINE failure synchronization: replace the final unconditional300ms wait with a bounded condition tied to expected saved records, ending in a useful failure; do not inflate timeout to disguise missing writes. Data remains mission-owned; do not duplicate a new hardcoded unlock registry in the test. Full chain's direct URLs still do not prove a player can navigate the hub; describe that limitation rather than turn this into a UI redesign.

DROP cosmetic test-count reduction or speculative allocation changes. Do not edit the dirty game/mission/save source for this gate repair; any runtime issue independently exposed is a separate proposed slice.

## Gate design and verification

Interaction: mission phase, Game.record, persisted localStorage and hull unlocks are distinct stages; completion alone is not durable progression. Adversarial: all missions report complete while save records/rewards are absent. Running-vs-declared: retained exact-source fault injection currently exits0. Repaired bad fixture must exitnonzero; good persisted fixture must pass. New probes are diagnostic only; acceptance also requires root independent review, required npm run build and the actual existing mission chain against an isolated candidate server once the AO gate is idle. Preserve existing warning budget. No browser/full suite was started during this audit.

Likely exact implementation owns scripts/chain-test.mjs plus a narrow reusable validation helper only if necessary for fault injection, docs/STATUS.md, docs/roadmap.md, docs/changelog.md and docs/design-chain-verification-20260905.md. Read current source/dirty/leases again before lane admission. Avoid CLAUDE changes unless actual gate discovery changes; its promised outcome becomes true with this fix. No new runtime dependencies, gameplay changes, provider calls, deployment or visibility change.

## Adopted before source implementation

Root adopted the narrow smoke repair under five exact paths, base100f98ba5f46f38d2074bbf4119842f97f21822d. The running mission id must match the requested id, including unknown queries that fall back. A new browser context prevents old saved success from masking a missing write; repeated requested ids require one additional completion per run. Declared rewards come from each running mission, not a hardcoded reward table. Missing/malformed storage fails with bounded diagnostics. Validate persisted counts/rewards after each subsequent navigation and one final reload. A bounded semantic poll replaces the unconditional300ms sleep; no gameplay or mission-timeout changes. Optional STARGATE_TEST_URL allows an isolated candidate server while keeping default localhost5187.

No new helper module is needed. Preserve canonical dirty gameplay/config files. Cache-only harness fault injection and build run first; actual browser chain waits until root confirms AO gate is idle. Root independently reviews before integration, which may be deferred by canonical dirty ownership.

## Archived original script

SHA-256: 6e7669683a40188fb6f60417f86f4bbde2dc24c20db7dcc0f15f210df4f7a4e2

```js
// Headless: drive every mission to its end card without flying it (kill spawns, teleport through gates,
// destroy capital parts), in one browser context so the save's progress chain and unlocks are exercised.
// Usage: node scripts/chain-test.mjs [mission-id ...]   (default: all)
import { chromium } from "playwright-core";
const ALL = ["belt-clear", "gauntlet", "ring-race", "shard-run", "graveyard-ambush", "escort", "blockade", "hatak"];
const ids = process.argv.length > 2 ? process.argv.slice(2) : ALL;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
for (const id of ids) {
  await page.goto(`http://localhost:5187/?lock=free&quality=low&mission=${id}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__game && window.__game.mission);
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
      if (type === "strike") for (const x of g.combat.extras) if (x.alive && x.damage) x.damage(1e6);
      if ((type === "run" || type === "race") && m.phase !== "intro" && performance.now() - lastGate > 500 && m.next < m.rings.length) {
        const r = m.rings[m.next];
        f.__jump = [r.pos.clone().addScaledVector(r.normal, -12), r.pos.clone().addScaledVector(r.normal, 12)];
        lastGate = performance.now();
      }
    }
    const P = g.combat.player;
    return { type, phase: m.phase, title: m.phase === "complete" ? m.winTitle : m.loseTitle, clock: Math.round(m.clock), kills: P.kills, hp: Math.round(P.hp), wall: Math.round((performance.now() - t0) / 1000), summary: m.phase === "complete" ? m.summary().replace(/\n/g, " | ") : m.loseLine };
  });
  const ok = res.phase === "complete";
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${id.padEnd(17)} ${res.type.padEnd(7)} ${res.title.padEnd(26)} clock ${String(res.clock).padStart(3)}s  wall ${res.wall}s  kills ${res.kills}  hp ${res.hp}   ${res.summary}`);
}
await page.waitForTimeout(300);
const save = await page.evaluate(() => JSON.parse(localStorage.getItem("stargate-explorer.save.v1")).progress);
console.log("progress:", JSON.stringify({ unlocked: save.unlocked, missions: Object.fromEntries(Object.entries(save.missions).map(([k, v]) => [k, v.completions])) }));
if (errs.length) console.log("page errors:", errs);
await browser.close();
process.exit(failed || errs.length ? 1 : 0);

```

## Construction checkpoint

The repaired script keeps validation inline. A new browser context is used, requested mission ids are checked before driving, per-run completion increments and mission-declared rewards are required, and progress is checked again after navigation/final reload. Missing JSON may wait up to1,500ms for a just-completed save; malformed JSON/schema fails immediately. Diagnostics are bounded and failures close the browser with nonzero status.

Controlled browser-boundary fault injection lives under `/home/ethan/.cache/tmp/astra-audit-20260905/stargate-chain-audit/candidate/`; only the Playwright import in the exact candidate script is redirected to synthetic browser results. All10 scenarios match expected exits: all/subset/repeated success; missing/malformed storage, missing reward, loss on reload/navigation, failed repeat increment and unknown-id fallback refuse. This is harness validation, not proof current gameplay loses data.

`npm run build` passes; receipt `/home/ethan/.cache/tmp/astra-stargate-chain-build.log`. One existing large-bundle warning remains (721.38kB current bundle); this slice changes no bundled game source. Actual browser verification was pending at this construction checkpoint; completed results follow.


## Completed verification — 2026-09-05

During the root-authorized browser window, the isolated built candidate ran at `http://127.0.0.1:15587/`. `STARGATE_TEST_URL=http://127.0.0.1:15587/ node scripts/chain-test.mjs` passed all eight missions and the final reload verified exactly one completion each, plus the declared `heavy` and `prometheus` rewards. Receipt: `/home/ethan/.cache/tmp/astra-stargate-chain-browser.log`. The real unknown-id invocation refused with `Requested mission unknown loaded belt-clear`, exit 1; receipt: `/home/ethan/.cache/tmp/astra-stargate-chain-unknown-browser.log`. No failed run was retried.

The rendered Clear the Field scene was inspected in `candidate/ui.png` under the evidence directory: ship, world, canvas and mission HUD were present. All browsers and the owned preview server were closed after verification. This is accelerated mission and raw persisted-storage verification, not normal hub eligibility, human flight-feel, native GPU performance, or in-memory hub display acceptance. The ten synthetic fault cases remain explicitly separate from these actual browser results. Independent script review found no blocker. No gameplay, deployment or canonical dirty source was changed.

## Setup correction and handoff

Root review identified that a directory-only `node_modules/` ignore does not ignore a `node_modules` symlink. Future isolated verification must inspect scope after all dependency setup and use a real ignored directory with child links or explicit external tools when needed. This lane's owned temporary link was moved intact to `/home/ethan/.cache/tmp/astra-audit-20260905/stargate-chain-audit/lane-node_modules-link`; it was never staged. The five-file candidate was committed and the tree verified clean after link archival. No source changed after the recorded build/browser acceptance, so no repeated heavy gate is justified by this documentation correction. Root approved source and browser evidence; default-branch delivery remains deferred because canonical gameplay has unrelated dirty work.
