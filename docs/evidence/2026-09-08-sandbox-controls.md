# Sandbox controls — 2026-09-08

Implemented in isolated `sandbox-moves` lane, based on main `9322e90`.

## Available to test

Open `?mission=proving-ground`, or select SANDBOX in pause/gate control. Defaults: 1 Cobra, 2 Lunge, 3 Scissor left, 4 Scissor right. Esc → Flight & move keys edits and saves direct shortcuts. Occupied bindings swap. B then rebound pull/roll direction remains available, with B alone resolving Cobra after the chord window.

Sandbox has no enemies or completion timer, protects the hull, refills the boost bar between moves and restocks missiles every three seconds. Normal flight retains move costs and hull damage. The practice guide reads the same move table and bindings as input. The speed-coupled-turn checkbox now applies/saves on change. The expanded settings panel scrolls within the viewport.

## Verification

- `npm run build`: passes TypeScript and Vite. Existing large-chunk warning persists (~848 kB main); no performance floor inferred.
- `node scripts/sandbox-controls-check.mjs`: actual keyboard events through Input → Flight for all four moves; custom keys and rebound chords, repeats, pause/resume queue clearing, low-bar refusal outside practice, saved migration/persistence, regular combat damage, practice protection/refill.
- `node scripts/replay-evaluation-check.mjs`, `node scripts/replay-clock-check.mjs`, `node scripts/audio-scene-check.mjs`: pass regression checks.
- In-app browser: rebound Cobra to J and reloaded (J retained); changed Cobra to occupied 2 (Cobra became 2, Lunge became J); DEFAULTS restored 1–4. Pause and gate-control Sandbox entry buttons navigated to proving ground. Speed-coupled turn was checked, survived reload, then restored off. All four number keys produced the corresponding RUNNING guide/HUD state during flight; observed ship movement and move feedback. Settings expansion initially clipped the panel; corrected overflow and verified access to bottom controls.
- Browser automation cannot obtain normal pointer lock here (WrongDocumentError during automated FLY). Move activation/visual inspection used the existing `lock=free` harness. This does not establish physical mouse feel or owner acceptance.
- Initial browser connection timed out; Ethan closed its tabs and a fresh tab recovered. Preview server itself returned HTTP 200.
- Legacy `scripts/move-test.mjs` expectations updated for the new guide/refill; that browser script was not run in this session.

Capture: [active Scissor](../shots/2026-09-08-sandbox-move.png).

## Named, not built

Agent suggestions for subsequent movement testing: show actual velocity direction separately from the aim marker; bind a recenter-steering action; offer a small set of clearly named steering/assist presets. These are proposals, not selected physics changes. Explosion animation refinement remains the previous open follow-up.
