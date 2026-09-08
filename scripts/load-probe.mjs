// Load probe: every frame from the first one, under CPU throttling, as a stand-in for a laptop.
// The stutter probe deliberately skips the first three seconds; this one only looks there.
// Usage: node scripts/load-probe.mjs [tiers=low,med,high] [cpu=4] [seconds=20] [gl=egl|swift] [mission=blockade]
import { chromium } from "playwright-core";
const arg = (k, d) => (process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1)) ?? d;
const tiers = arg("tiers", "med").split(","), cpu = +arg("cpu", "4"), secs = +arg("seconds", "20");
const gl = arg("gl", "egl"), mission = arg("mission", "blockade");
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const ARGS = {
  egl: ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
  swift: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};
const browser = await chromium.launch({ args: ARGS[gl] });
for (const tier of tiers) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  // record from the very first frame, before any app code runs
  await page.addInitScript(() => {
    window.__t0 = performance.now();
    window.__ft = []; window.__lt = [];
    let last = performance.now();
    const tick = (now) => { window.__ft.push([now, now - last]); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]); }).observe({ entryTypes: ["longtask"] }); } catch {}
  });
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: tier, mission });
  const nav = Date.now();
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForFunction(() => window.__loop && window.__game, null, { timeout: 60000 });
  const ready = Date.now() - nav;
  await page.evaluate(() => { const i = window.__input; i.fire = true; i.stick.x = 0.25; });
  await page.waitForTimeout(secs * 1000);
  const r = await page.evaluate(() => {
    const ft = window.__ft;
    const d = ft.map((x) => x[1]).sort((a, b) => a - b);
    const q = (p) => d[Math.floor(d.length * p)] ?? 0;
    const worst = ft.slice().sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, ms]) => [+(t / 1000).toFixed(2), +ms.toFixed(0)]).sort((a, b) => a[0] - b[0]);
    // frame budget by second, so a slow stretch is visible as a stretch
    const bySec = {};
    for (const [t, ms] of ft) { const s = Math.floor(t / 1000); (bySec[s] ??= []).push(ms); }
    const secs = Object.entries(bySec).slice(0, 20).map(([s, a]) => `${s}s:${a.length}f/${Math.max(...a).toFixed(0)}ms`);
    return {
      frames: ft.length, first: +(ft[0]?.[0] ?? 0).toFixed(0),
      p50: q(0.5), p95: q(0.95), max: d[d.length - 1] ?? 0,
      over33: d.filter((x) => x > 33).length, over100: d.filter((x) => x > 100).length,
      worst, secs, lt: window.__lt.filter((x) => x[1] > 60).slice(0, 14),
      scale: window.__renderer?.scale, gpu: +(window.__renderer?.gpuMs ?? 0).toFixed(2),
      fps: +(window.__loop?.fps ?? 0).toFixed(0), render: +(window.__loop?.renderMs ?? 0).toFixed(2), sim: +(window.__loop?.simMs ?? 0).toFixed(2),
      calls: window.__renderer?.gl.info.render.calls, tris: window.__renderer?.gl.info.render.triangles,
      dpr: window.devicePixelRatio, drawW: window.__renderer?.gl.domElement.width, drawH: window.__renderer?.gl.domElement.height,
      marks: (window.__marks ?? []).filter((m) => m.ms > 3).slice(0, 20),
    };
  });
  console.log(`\n== ${gl} cpu${cpu}x ${tier}: interactive at ${ready} ms, first frame ${r.first} ms, ${r.frames} frames`);
  console.log(`   steady fps ${r.fps}  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  max ${r.max.toFixed(0)} ms   frames>33ms ${r.over33}  >100ms ${r.over100}`);
  console.log(`   sim ${r.sim} render ${r.render} gpu ${r.gpu} ms  res scale ${r.scale}  buffer ${r.drawW}x${r.drawH} (dpr ${r.dpr})  calls ${r.calls} tris ${(r.tris / 1000).toFixed(0)}k`);
  console.log(`   frames per second of wall time: ${r.secs.join("  ")}`);
  console.log(`   worst frames [t s, ms]: ${JSON.stringify(r.worst)}`);
  if (r.lt.length) console.log(`   long tasks >60ms [t ms, ms]: ${JSON.stringify(r.lt)}`);
  if (r.marks?.length) console.log(`   steps >3ms: ${r.marks.map((m) => `${m.name}@${m.at}ms=${m.ms}ms`).join("  ")}`);
  await ctx.close();
}
await browser.close();
