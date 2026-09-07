// The game designer (?edit=1): board renders every level with its requires edges, the sim holds, an edit in the
// inspector moves the power readout, and a save reaches the dev server's content store. Writes and deletes
// src/content/_editor-test.json; never touches campaign.json.
// Usage: node scripts/editor-test.mjs   (STARGATE_TEST_URL picks the server; default localhost:5187)
import { chromium } from "playwright-core";
import { readFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const base = process.env.STARGATE_TEST_URL ?? "http://localhost:5187/";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testFile = "src/content/_editor-test.json";
const errs = [];
const check = (ok, msg) => (ok ? console.log("ok   " + msg) : (errs.push(msg), console.log("FAIL " + msg)));

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/400/.test(m.text()) && consoleErrors.push(m.text())); // the store's refusal below is deliberate
await page.goto(`${base}?edit=1&lock=free&quality=low&mission=escort`);
await page.waitForFunction(() => window.__editor && document.querySelectorAll("#editor g.node").length > 0, null, { timeout: 30000 });

const info = await page.evaluate(() => {
  const c = window.__editor.content;
  return { nodes: document.querySelectorAll("#editor g.node").length, edges: document.querySelectorAll("#editor path.edge").length, levels: c.levels.length, expectedEdges: c.levels.filter((l) => l.requires).length, acts: c.acts.length, bands: document.querySelectorAll("#editor g.band").length, selected: window.__editor.selected, active: window.__editor.active, rows: document.querySelectorAll("#editor .curve-row").length };
});
check(info.nodes === info.levels && info.levels >= 17, `board shows every level (${info.nodes} of ${info.levels})`);
check(info.edges === info.expectedEdges, `one edge per requires (${info.edges} of ${info.expectedEdges})`);
check(info.bands === info.acts && info.acts === 3, `one band per act (${info.bands})`);
check(info.rows === info.levels, `power curve lists every level (${info.rows})`);
check(info.selected === "escort" && info.active, "the current mission is selected and the designer is active");

// the sim holds while the designer is up
const t0 = await page.evaluate(() => window.__game.mission.timer);
await page.waitForTimeout(600);
const t1 = await page.evaluate(() => window.__game.mission.timer);
check(t1 === t0, `sim held while editing (intro timer ${t0} -> ${t1})`);

// edit a wave count through the inspector and watch the threat move
const before = await page.evaluate(() => document.querySelector("#editor .power .big b").textContent);
const firstCount = page.locator("#editor .waves .wave input").first();
const old = Number(await firstCount.inputValue());
await firstCount.fill(String(old + 6));
await firstCount.press("Enter");
await firstCount.blur();
await page.waitForTimeout(100);
const after = await page.evaluate(() => ({ threat: document.querySelector("#editor .power .big b").textContent, count: window.__editor.content.level("escort").waves[0].count, dirty: window.__editor.content.dirty, status: document.querySelector("#editor .status").textContent }));
check(after.count === old + 6, `wave count edit landed in the content copy (${old} -> ${after.count})`);
check(after.threat !== before, `threat moved with the edit (${before} -> ${after.threat})`);
check(after.dirty && /unsaved/.test(after.status), `status reads dirty (${after.status})`);

// undo
await page.click("#editor .undo");
const undone = await page.evaluate(() => window.__editor.content.level("escort").waves[0].count);
check(undone === old, `undo restored the wave (${undone})`);

// drag a card into another act band
const drag = await page.evaluate(() => {
  const l = window.__editor.content.level("duel");
  return { act: l.act, x: l.board.x, y: l.board.y };
});
const node = page.locator('#editor g.node[data-id="duel"] rect').first();
const box = await node.boundingBox();
await page.mouse.move(box.x + 40, box.y + 20);
await page.mouse.down();
await page.mouse.move(box.x + 40, box.y + 200, { steps: 8 });
await page.mouse.move(box.x + 40, box.y + 320, { steps: 8 });
await page.mouse.up();
const dragged = await page.evaluate(() => {
  const l = window.__editor.content.level("duel");
  return { act: l.act, x: l.board.x, y: l.board.y };
});
check(dragged.y > drag.y + 200, `drag moved the card (${drag.y} -> ${dragged.y})`);
check(dragged.act !== drag.act, `card changed act by band (${drag.act} -> ${dragged.act})`);
await page.click("#editor .undo");

// change a level type through the select and confirm the template (the drag selected the duel; go back)
await page.evaluate(() => window.__editor.select("escort"));
const titleBefore = await page.evaluate(() => window.__editor.content.level("escort").title);
await page.selectOption("#editor .inspector select >> nth=0", "hold");
const typed = await page.evaluate(() => {
  const l = window.__editor.content.level("escort");
  return { type: l.type, duration: l.duration, title: l.title, requires: l.requires, act: l.act };
});
check(typed.type === "hold" && typed.duration > 0 && typed.title === titleBefore && typed.requires === "gauntlet" && typed.act === "act2", `type change applied the hold template and kept identity (${JSON.stringify(typed)})`);
await page.click("#editor .undo");

// new level, then delete it
await page.click("#editor .inspector button.wide >> nth=-1");
const made = await page.evaluate(() => ({ n: window.__editor.content.levels.length, sel: window.__editor.selected, req: window.__editor.content.level(window.__editor.selected)?.requires }));
check(made.n === info.levels + 1 && made.req === "escort", `new level added after the selected one (${made.sel} requires ${made.req})`);
await page.click("#editor .inspector button.danger");
const gone = await page.evaluate(() => window.__editor.content.levels.length);
check(gone === info.levels, `delete removed it (${gone})`);

// save to a scratch file through the content store
const saved = await page.evaluate((f) => window.__editor.content.save(f), testFile);
check(saved === "saved", `save endpoint answered (${saved})`);
try {
  const j = JSON.parse(await readFile(resolve(root, testFile), "utf8"));
  check(Array.isArray(j.levels) && j.levels.length === info.levels && j.acts.length === 3, `file on disk holds ${j.levels.length} levels and ${j.acts.length} acts`);
  await unlink(resolve(root, testFile));
} catch (e) {
  check(false, `file on disk: ${e}`);
}
const bad = await page.evaluate(async () => (await fetch("/__content/save", { method: "POST", body: JSON.stringify({ file: "../evil.json", data: {} }) })).status);
check(bad === 400, `store rejects a path outside src/content (${bad})`);

// fly: the overlay goes away and the sim runs
await page.evaluate(() => window.__editor.hide());
const f0 = await page.evaluate(() => window.__game.mission.timer);
await page.waitForTimeout(600);
const f1 = await page.evaluate(() => ({ t: window.__game.mission.timer, hidden: document.getElementById("editor").hidden }));
check(f1.t < f0 && f1.hidden, `sim runs again once hidden (intro timer ${f0} -> ${f1.t})`);

await page.evaluate(() => window.__editor.show());
await page.screenshot({ path: resolve(root, "docs/shots/2026-09-06-designer-board.png") });
check(consoleErrors.length === 0, `no page errors (${consoleErrors.slice(0, 3).join(" | ")})`);
await browser.close();
if (errs.length) {
  console.error(`\n${errs.length} failed`);
  process.exit(1);
}
console.log("\nall good");
