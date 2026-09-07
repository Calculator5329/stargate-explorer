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

// hover a card for the FLY tag; the story preview shows the intro as the HUD will
const preview = await page.evaluate(() => ({ line: document.querySelector("#editor .preview .hudline .obj")?.textContent ?? "", intro: window.__editor.content.level("escort").intro[0] }));
check(preview.line.includes(preview.intro), `story preview carries the intro line (${preview.line.slice(0, 50)})`);
const escortRect = page.locator('#editor g.node[data-id="escort"] rect').first();
const eb = await escortRect.boundingBox();
await page.mouse.move(eb.x + 20, eb.y + 20);
await page.waitForTimeout(500);
const flyOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('#editor g.node[data-id="escort"] g.fly')).opacity);
check(flyOpacity === "1", `hovering a card shows its FLY tag (opacity ${flyOpacity})`);
await page.mouse.click(eb.x + eb.width - 30, eb.y + eb.height - 16);
await page.waitForTimeout(100);
// the loaded level with a clean copy flies in place: no save, no reload, the designer just hides
const flew = await page.evaluate(() => ({ hidden: document.getElementById("editor").hidden, active: window.__editor.active }));
check(flew.hidden && !flew.active, `the FLY tag on the loaded level hides the designer (${JSON.stringify(flew)})`);
// flying locks the pointer, which pins every later hit-test to the lock point: release it before going on
await page.evaluate(() => (document.exitPointerLock(), window.__editor.show()));
await page.waitForTimeout(100);
await page.mouse.move(10, 10);

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

// new level through the wizard: pick a type and a pack, name it, create; then delete it
await page.click("#editor .inspector button.wide >> nth=-1");
await page.waitForSelector("#editor .wizard");
await page.click('#editor .wz-card[data-type="clear"]');
await page.click('#editor .wz-card[data-pack="gunboat-wall"]');
await page.fill("#editor .wz-title", "the netu picket");
await page.click("#editor .wz-go");
const made = await page.evaluate(() => {
  const l = window.__editor.content.level(window.__editor.selected);
  return { n: window.__editor.content.levels.length, sel: window.__editor.selected, req: l?.requires, title: l?.title, waves: l?.waves?.length, act: l?.act, wizardGone: !document.querySelector("#editor .wizard") };
});
check(made.n === info.levels + 1 && made.req === "escort" && made.title === "THE NETU PICKET" && made.waves === 2 && made.act === "act2" && made.wizardGone, `wizard made the level after the selected one with the pack (${JSON.stringify(made)})`);
// a pack dropped into the wave list
await page.click("#editor .pack button >> nth=3");
const packed = await page.evaluate(() => window.__editor.content.level(window.__editor.selected).waves.length);
check(packed === 3, `pack appended its waves (${packed})`);
await page.click("#editor .inspector button.danger");
const gone = await page.evaluate(() => window.__editor.content.levels.length);
check(gone === info.levels, `delete removed it (${gone})`);

// tidy lays every card out without losing one
await page.click("#editor .tidy");
const tidy = await page.evaluate(() => {
  const ls = window.__editor.content.levels;
  const spots = new Set(ls.map((l) => `${l.board.x},${l.board.y}`));
  return { n: ls.length, distinct: spots.size };
});
check(tidy.distinct === tidy.n, `tidy gave every card its own spot (${tidy.distinct} of ${tidy.n})`);
await page.click("#editor .undo");

// viewport: wheel zooms, dragging empty space pans without deselecting, FIT brings it back
const vb0 = await page.getAttribute("#editor svg.board", "viewBox");
const svgBox = await page.locator("#editor svg.board").boundingBox();
await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(50);
const vb1 = await page.getAttribute("#editor svg.board", "viewBox");
check(vb1 !== vb0, `wheel zoomed the board (${vb0} -> ${vb1})`);
await page.evaluate(() => window.__editor.select("escort"));
const emptySpot = await page.evaluate(() => {
  // probe the svg for a screen point no card covers
  const s = document.querySelector("#editor svg.board").getBoundingClientRect();
  for (let y = s.bottom - 20; y > s.top; y -= 40) for (let x = s.right - 20; x > s.left; x -= 60) {
    const el = document.elementFromPoint(x, y);
    if (el && el.closest("svg.board") && !el.closest("g.node")) return { x, y };
  }
  return { x: s.left + 5, y: s.top + 5 };
});
await page.mouse.move(emptySpot.x, emptySpot.y);
await page.mouse.down();
await page.mouse.move(emptySpot.x - 150, emptySpot.y - 100, { steps: 6 });
await page.mouse.up();
const vb2 = await page.getAttribute("#editor svg.board", "viewBox");
const stillSel = await page.evaluate(() => window.__editor.selected);
check(vb2 !== vb1 && stillSel === "escort", `drag on empty space panned and kept the selection (${vb1} -> ${vb2}, ${stillSel})`);
await page.mouse.click(emptySpot.x, emptySpot.y);
check((await page.evaluate(() => window.__editor.selected)) === null, "a plain click on empty space deselects");
await page.click("#editor .zoombar .fit");
const zoomText = await page.textContent("#editor .zoombar .zv");
check(/^\d+%$/.test(zoomText), `FIT reset the view (${zoomText})`);

// save to a scratch file through the content store
const saved = await page.evaluate((f) => window.__editor.content.post(f, window.__editor.content.toJSON()), testFile);
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

// moves tab: shelf lists the table, a step field edits the working copy, UNDO returns it, TRY IT hands the
// working table to the game and fires the move where the ship is
await page.click('#editor .tab[data-tab="moves"]');
const mv = await page.evaluate(() => ({ shelf: document.querySelectorAll("#editor .moves .shelf .mv").length, moves: window.__editor.content.moves.length, steps: document.querySelectorAll("#editor .moves .step").length, first: window.__editor.content.moves[0].steps.length, inspectorHidden: document.querySelector("#editor .inspector").hidden, bars: document.querySelectorAll("#editor .moves .timeline rect.bar").length }));
check(mv.shelf === mv.moves && mv.moves >= 4, `moves shelf lists every move (${mv.shelf} of ${mv.moves})`);
check(mv.steps === mv.first && mv.bars === mv.first && mv.inspectorHidden, `one card and one timeline bar per step (${mv.steps}), inspector out of the way`);
const amount = page.locator('#editor .moves .step[data-i="0"] input').nth(2);
const oldAmount = Number(await amount.inputValue());
await amount.fill(String(oldAmount + 5));
await amount.press("Enter");
await amount.blur();
await page.waitForTimeout(100);
const edited = await page.evaluate(() => ({ amount: window.__editor.content.moves[0].steps[0].amount, dirty: window.__editor.content.dirty, tab: document.querySelector("#editor .tab.on").dataset.tab }));
check(edited.amount === oldAmount + 5 && edited.dirty && edited.tab === "moves", `step amount edit lands (${oldAmount} -> ${edited.amount}) and the tab stays`);
await page.click("#editor .undo");
check((await page.evaluate(() => window.__editor.content.moves[0].steps[0].amount)) === oldAmount, "UNDO returns the step amount");
await page.evaluate(() => (window.__editor.content.moves[0].name = "Cobra test"));
await page.click("#editor .moves .try");
await page.waitForTimeout(150);
const tried = await page.evaluate(() => ({ hidden: document.getElementById("editor").hidden, move: window.__flight.move?.name ?? null, live: window.__flight.moves === window.__editor.content.moves, keys: [...window.__input.moveKeys] }));
check(tried.hidden && tried.move === "Cobra test" && tried.live, `TRY IT fires the working copy's move in the game (${tried.move}, keys ${tried.keys.join(",")})`);
await page.evaluate(() => (document.exitPointerLock(), window.__editor.show()));
await page.evaluate(() => (window.__editor.content.moves[0].name = "Cobra"));
await page.mouse.move(10, 10);
await page.click('#editor .tab[data-tab="board"]');

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
