// Stutter probe: per-frame rAF deltas on the real GPU in a live fight, per tier.
// Reports p50/p95/p99/max frame ms, long-frame counts, when the long frames happened, and (profile=1) top self-time.
// Usage: STARGATE_TEST_URL=http://127.0.0.1:4187/ node scripts/stutter-probe.mjs [tiers=low,med] [seconds=20] [profile=1] [gl=egl]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const arg = (k, d) => (process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1)) ?? d;
const tiers = arg("tiers", "low,med").split(","), secs = +arg("seconds", "20"), profile = arg("profile", "0") === "1", gl = arg("gl", "egl");
const mission = arg("mission", "blockade");
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const EXTRA = (process.env.STUTTER_EXTRA_ARGS ?? "").split(" ").filter(Boolean);
const ARGS = { egl: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", ...EXTRA], swift: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
const browser = await chromium.launch({ args: ARGS[gl] });
for (const tier of tiers) {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
  const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: tier, mission });
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForFunction(() => window.__loop && window.__game);
  await page.evaluate(() => { window.__game.mission.timer = 0; const i = window.__input; i.fire = true; i.boost = true; i.stick.x = 0.3; });
  await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  if (profile) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
  await page.evaluate(() => {
    window.__ft = []; window.__long = []; let last = performance.now();
    const tick = (now) => { const d = now - last; last = now; window.__ft.push(d); if (d > 25) window.__long.push([+(now / 1000).toFixed(2), +d.toFixed(1), window.__renderer.scale, window.__game.enemies.aliveCount]); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([+(e.startTime / 1000).toFixed(2), +e.duration.toFixed(0)]); }).observe({ entryTypes: ["longtask"] }); } catch {}
  });
  await page.waitForTimeout(secs * 1000);
  const r = await page.evaluate(() => {
    const ft = window.__ft.slice().sort((a, b) => a - b); const q = (p) => ft[Math.floor(ft.length * p)];
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1;
    return { n: ft.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: ft[ft.length - 1], over25: ft.filter((x) => x > 25).length, over50: ft.filter((x) => x > 50).length, long: window.__long.slice(0, 40), lt: window.__lt.slice(0, 40), scale: window.__renderer.scale, gpuMs: window.__renderer.gpuMs, fps: window.__loop.fps, simMs: window.__loop.simMs, renderMs: window.__loop.renderMs, mem, calls: window.__renderer.gl.info.render.calls, tris: window.__renderer.gl.info.render.triangles, programs: window.__renderer.gl.info.programs?.length };
  });
  console.log(`\n== ${gl} ${tier} ${mission}: ${r.n} frames in ${secs}s  fps ${r.fps.toFixed(0)}  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  p99 ${r.p99.toFixed(1)}  max ${r.max.toFixed(1)} ms  >25ms ${r.over25}  >50ms ${r.over50}`);
  console.log(`   sim ${r.simMs.toFixed(2)} render ${r.renderMs.toFixed(2)} gpu ${r.gpuMs.toFixed(2)} ms  scale ${r.scale}  calls ${r.calls} tris ${(r.tris / 1000).toFixed(0)}k  programs ${r.programs}  heap ${r.mem} MB`);
  if (r.long.length) console.log("   long frames [t, ms, scale, enemies]:", JSON.stringify(r.long));
  if (r.lt.length) console.log("   longtasks [t, ms]:", JSON.stringify(r.lt));
  const warn = logs.filter((l) => /warn|error/i.test(l)); if (warn.length) console.log("   console:", warn.slice(0, 10).join("\n            "));
  if (profile) {
    const { profile: p } = await cdp.send("Profiler.stop");
    const self = new Map(); const total = p.samples.length; const byId = new Map(p.nodes.map((n) => [n.id, n]));
    for (const id of p.samples) { const n = byId.get(id); const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").slice(-1)[0].split("?")[0]}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) ?? 0) + 1); }
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    console.log(`   top self-time:`); for (const [k, v] of top) console.log(`    ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
    // busy bursts: contiguous runs of non-idle samples; the biggest ones are the hitches. Report what ran inside each.
    const bursts = []; let cur = null; let t = 0;
    for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]); const dt = (p.timeDeltas[i] ?? 0) / 1000; t += dt; const idle = n.callFrame.functionName === "(idle)";
      if (idle) { if (cur) { bursts.push(cur); cur = null; } continue; }
      if (!cur) cur = { start: t, ms: 0, fn: new Map() }; cur.ms += dt; const key = `${n.callFrame.functionName || "(anon)"}:${n.callFrame.lineNumber}`; cur.fn.set(key, (cur.fn.get(key) ?? 0) + dt); }
    if (cur) bursts.push(cur);
    bursts.sort((a, b) => b.ms - a.ms);
    console.log(`   biggest busy bursts (ms since profile start, total ms, top functions by self ms):`);
    for (const b of bursts.slice(0, 6)) console.log(`    +${(b.start / 1000).toFixed(2)}s ${b.ms.toFixed(0)} ms  ` + [...b.fn.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(" | "));
    writeFileSync(process.env.STUTTER_PROFILE_DIR ? `${process.env.STUTTER_PROFILE_DIR}/stutter-${gl}-${tier}.cpuprofile` : `/dev/null`, JSON.stringify(p));
  }
  await page.context().close();
}
await browser.close();
