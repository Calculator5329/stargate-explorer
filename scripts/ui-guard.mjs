// Headless: the three ways GATE CONTROL and the save were unusable, each of which shipped and none of
// which any existing script would have caught. Run after touching src/ui/hub.ts, src/core/save.ts or the
// #hub block in index.html.
//   1. the console opens with the pointer still locked to the canvas, so it has no cursor and eats clicks
//   2. the console is taller than the viewport, so DIAL & LAUNCH sits below the fold with the panel at scrollTop 0
//   3. a save holding a value of the wrong type kills the page, or the menu, with no way back in the app
const BASE = (process.env.STARGATE_TEST_URL ?? "http://localhost:5187/").replace(/\/?$/, "/");
import { chromium } from "playwright-core";

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"] });
let bad = 0;
const ok = (pass, label, detail = "") => {
  console.log(`${pass ? "ok  " : "FAIL"} ${label}${detail ? `   ${detail}` : ""}`);
  if (!pass) bad++;
};

// --- 1 + 2: the console, reached the way the game reaches it -------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => (console.error("page error:", e.message), bad++));
  await page.goto(BASE + "?quality=low&mission=belt-clear", { waitUntil: "load" });
  await page.waitForTimeout(3000);
  // dismiss the start screen the way a player does; FLY takes the pointer lock (the minimap is also a
  // <canvas>, so the game's own is the one appended straight to <body>)
  await page.click("#menu .fly");
  await page.waitForTimeout(600);
  const locked = await page.evaluate(() => document.pointerLockElement !== null);
  ok(locked, "pointer lock taken by FLY (precondition)");

  const shown = await page.evaluate(async () => {
    window.__hub.show();
    await new Promise((r) => setTimeout(r, 300));
    return {
      hubOn: document.getElementById("hub").classList.contains("on"),
      stillLocked: document.pointerLockElement !== null,
      menuOn: document.getElementById("menu").classList.contains("on"),
    };
  });
  ok(shown.hubOn, "hub opens");
  ok(!shown.stillLocked, "hub releases pointer lock", JSON.stringify(shown));
  ok(!shown.menuOn, "the pause menu does not open over the hub");

  // a click at a system button's own centre must actually select it
  const picked = await page.evaluate(async () => {
    // a locked system is still selectable (it just cannot launch), so any unselected row will do
    const target = [...document.querySelectorAll("#hub .system")].find((b) => !b.classList.contains("sel"));
    if (!target) return { before: "?", after: "?", note: "no unselected system row" };
    const before = document.querySelector("#hub .destination span").textContent;
    const r = target.getBoundingClientRect();
    document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button")?.click();
    await new Promise((x) => setTimeout(x, 200));
    return { before, after: document.querySelector("#hub .destination span").textContent };
  });
  ok(picked.before !== picked.after, "a click at a system button's centre changes the destination", JSON.stringify(picked));

  for (const [w, h] of [[1280, 720], [1024, 768], [1366, 768], [1280, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const geo = await page.evaluate(() => {
      const go = document.querySelector("#hub .go").getBoundingClientRect();
      const back = document.querySelector("#hub .back").getBoundingClientRect();
      const panel = document.querySelector("#hub .panel").getBoundingClientRect();
      return { goBottom: Math.round(go.bottom), goTop: Math.round(go.top), backBottom: Math.round(back.bottom), panelBottom: Math.round(panel.bottom), vh: innerHeight, vw: innerWidth, panelRight: Math.round(panel.right) };
    });
    const inside = geo.goTop >= 0 && geo.goBottom <= geo.vh && geo.backBottom <= geo.vh && geo.panelBottom <= geo.vh && geo.panelRight <= geo.vw;
    ok(inside, `${w}x${h}: DIAL & LAUNCH and BACK are on screen without scrolling`, JSON.stringify(geo));
  }
  await page.close();
}

// --- 3: saves that hold the wrong type ------------------------------------------------------------------
const CORRUPT = [
  ['quality "ultra"', '{"settings":{"quality":"ultra"}}'],
  ["quality null", '{"settings":{"quality":null}}'],
  ['sens "loud"', '{"settings":{"sens":"loud"}}'],
  ["sens NaN-ish", '{"settings":{"sens":null,"assistStrength":"x"}}'],
  ["booleans as strings", '{"settings":{"mute":"yes","invertY":1,"dynamicRes":"no","onboarded":"true"}}'],
  ["difficulty object", '{"settings":{"difficulty":{"hp":9}}}'],
  ["progress wrong types", '{"progress":{"ship":7,"unlocked":"f11","missions":[1,2]}}'],
  ["mission record wrong types", '{"progress":{"missions":{"belt-clear":{"completions":"many","bestTime":null}}}}'],
];
for (const [label, blob] of CORRUPT) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript((b) => localStorage.setItem("stargate-explorer.save.v1", b), blob);
  // no `?quality=` on purpose: the URL parameter is parsed and would mask a bad tier in the save, which is
  // exactly the value that used to take the page down before the canvas existed
  await page.goto(BASE + "?mission=belt-clear", { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    canvas: !!document.querySelector("canvas"),
    game: !!window.__game,
    // the menu must be reachable: it is the only in-app way back from a bad setting
    menuBuilt: !!document.querySelector("#menu .menu-body"),
    renderer: !!window.__renderer,
    sens: window.__input?.sens ?? null,
  }));
  const good = errs.length === 0 && state.canvas && state.game && state.menuBuilt && typeof state.sens === "number";
  ok(good, `corrupt save boots and keeps the menu: ${label}`, JSON.stringify({ ...state, errs }));
  await page.close();
}

await browser.close();
console.log(bad === 0 ? "\nui-guard OK" : `\nui-guard FAILED (${bad})`);
process.exit(bad === 0 ? 0 : 1);
