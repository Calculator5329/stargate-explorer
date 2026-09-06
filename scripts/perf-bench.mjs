// Frame-time bench: each quality tier on the real GPU (gl-egl) and on SwiftShader (a weak-device proxy),
// in a live fight with fire and boost held. Prints fps, sim ms, render ms, draw calls, triangles.
// Usage: node scripts/perf-bench.mjs [tiers=low,med,high] [gl=egl,swift] [seconds=6] [profile=1]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const arg = (k, d) => (process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1)) ?? d;
const tiers = arg("tiers", "low,med,high").split(","), gls = arg("gl", "egl,swift").split(","), secs = +arg("seconds", "6"), profile = arg("profile", "0") === "1";
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const ARGS = { egl: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"], swift: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
for (const gl of gls) {
  const browser = await chromium.launch({ args: ARGS[gl] });
  for (const tier of tiers) {
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: tier, mission: "blockade" });
    await page.goto(url.href, { waitUntil: "load" });
    await page.waitForFunction(() => window.__loop && window.__game);
    await page.evaluate(() => { window.__game.mission.timer = 0; const i = window.__input; i.fire = true; i.boost = true; i.stick.x = 0.3; });
    await page.waitForTimeout(2500); // waves out, fps window settled
    const cdp = await page.context().newCDPSession(page);
    if (profile) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.start"); }
    const t0 = Date.now(); const samples = [];
    while (Date.now() - t0 < secs * 1000) { await page.waitForTimeout(500); samples.push(await page.evaluate(() => { const l = window.__loop, r = window.__renderer.gl.info.render; return [l.fps, l.simMs, l.renderMs, r.calls, r.triangles, window.__game.enemies.aliveCount]; })); }
    const avg = (i) => (samples.reduce((a, s) => a + s[i], 0) / samples.length);
    console.log(`${gl.padEnd(5)} ${tier.padEnd(4)} fps ${avg(0).toFixed(0).padStart(4)}  sim ${avg(1).toFixed(2)} ms  render ${avg(2).toFixed(2)} ms  calls ${avg(3).toFixed(0)}  tris ${(avg(4) / 1000).toFixed(0)}k  enemies ${avg(5).toFixed(1)}`);
    if (profile) {
      const { profile: p } = await cdp.send("Profiler.stop");
      const self = new Map(); const total = p.samples.length; const byId = new Map(p.nodes.map((n) => [n.id, n]));
      for (const id of p.samples) { const n = byId.get(id); const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").slice(-1)[0].split("?")[0]}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) ?? 0) + 1); }
      const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
      console.log(`  top self-time (${gl} ${tier}):`); for (const [k, v] of top) console.log(`    ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
      writeFileSync(`docs/evidence/profile-${gl}-${tier}.cpuprofile`, JSON.stringify(p));
    }
    await page.context().close();
  }
  await browser.close();
}
