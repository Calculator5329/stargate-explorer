// GPU-time attribution: baseline gpu ms per tier, then each cost toggled off in turn.
// Usage: node scripts/perf-attrib.mjs [tiers=med,high] [gl=egl] [w=1920] [h=1080]
import { chromium } from "playwright-core";
const arg = (k, d) => (process.argv.find((a) => a.startsWith(k + "="))?.slice(k.length + 1)) ?? d;
const tiers = arg("tiers", "med,high").split(","), gl = arg("gl", "egl"), W = +arg("w", "1920"), H = +arg("h", "1080"), DSF = +arg("dsf", "1");
const baseURL = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const ARGS = { egl: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"], swift: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
const VARIANTS = {
  baseline: "",
  "bloom off": "for (const p of R.composer.passes) if (p.constructor.name.includes('Bloom') || p.strength !== undefined) p.enabled = false;",
  "rocks hidden": "window.__rocks.group.visible = false;",
  "rock shells+lines hidden": "for (const c of window.__rocks.group.children) if (!(c.material && c.material.type === 'MeshToonMaterial')) c.visible = false;",
  "sky hidden": "window.__world.sky.mesh.visible = false;",
  "planet hidden": "window.__world.planet.group.visible = false;",
  "dpr 1": "R.gl.setPixelRatio(1); R.resize();",
  "shadows off": "R.gl.shadowMap.enabled = false; R.scene.traverse((o) => { if (o.material) { for (const m of [].concat(o.material)) m.needsUpdate = true; } });",
};
const browser = await chromium.launch({ args: ARGS[gl] });
for (const tier of tiers) {
  console.log(`--- ${gl} ${tier} ${W}x${H} dsf ${DSF}`);
  for (const [name, js] of Object.entries(VARIANTS)) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF })).newPage();
    const url = new URL(baseURL); url.search = new URLSearchParams({ lock: "free", quality: tier, mission: "blockade" });
    await page.goto(url.href, { waitUntil: "load" });
    await page.waitForFunction(() => window.__loop && window.__game && window.__renderer);
    await page.evaluate(() => { window.__game.mission.timer = 0; const i = window.__input; i.fire = true; i.boost = true; i.stick.x = 0.3; });
    await page.evaluate((code) => { const R = window.__renderer; new Function("R", code)(R); }, js);
    await page.waitForTimeout(2500);
    const s = [];
    for (let k = 0; k < 6; k++) { await page.waitForTimeout(400); s.push(await page.evaluate(() => { const l = window.__loop, R = window.__renderer, r = R.gl.info.render; return [l.fps, R.gpuMs, l.renderMs, r.calls, r.triangles]; })); }
    const avg = (i) => s.reduce((a, x) => a + x[i], 0) / s.length;
    console.log(`${name.padEnd(26)} fps ${avg(0).toFixed(0).padStart(3)}  gpu ${avg(1).toFixed(2).padStart(6)} ms  js ${avg(2).toFixed(2)} ms  calls ${avg(3).toFixed(0).padStart(3)}  tris ${(avg(4) / 1000).toFixed(0)}k`);
    await page.context().close();
  }
}
await browser.close();
