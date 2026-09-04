# CLAUDE.md — Stargate Explorer

Browser space-combat game. Three.js 0.170 + TypeScript 5 + Vite 5. No engine, no external art. Art direction: stylised low-poly with outlines and toon lighting — target is row A of docs/art-direction-options.png (see docs/GRAPHICS.md; Ethan's reference frame: cream/red faceted fighter, twin long blue plumes, chunky outlined asteroids, hard-edged orange/blue planet, vivid orange/purple nebula).
Read this file first. Then `docs/STATUS.md` for what's live, `docs/roadmap.md` for what's next (the file the planning docs call PLAN.md), `docs/DECISIONS.md` before changing anything architectural.

Workspace fence: `games/stargate-explorer`, `agents: full`, private GitHub remote (push authorized). Publication, visibility and deploys are Ethan's. Workspace conventions in `~/projects/CLAUDE.md` apply; this file adds to them.

## Commands
```
npm run dev      # vite dev server, http://localhost:5187  (5173 is the Forge Shell)
npm run build    # tsc --noEmit && vite build  — must pass before any commit
npm run preview  # serve dist/
```
Verify command is `npm run build` plus a look at the running game: a flight-feel change is verified by flying it, an art change by a capture. Standing build warning: one ~580 kB chunk (three). A warning that is not that one is new and blocks the commit.
Inspection views for asset work: `?view=side|top|front|rear` (static cam, ship rotates; `&spin=0` holds it, `&dist=0.5` moves in). `?view=side&silhouette=1` is the black-on-white readability test. `?quality=low|med|high`, `?sky=abydos|deepSpace|chulak`.
Backtick (`) toggles the lil-gui tuning panel.

## Hard conventions (do not break)
- **Axes:** ship-local +Z forward, +Y up. Three.js is right-handed, so **+X is port (the ship's left)** and starboard is −X. Builder, flight model, camera, GLTF loader all assume it. Rotation signs: +X drops the nose, +Y yaws to port, +Z rolls right (`sim/flight.ts` spells this out). The first hand-off wrote "+X right"; that read produced inverted controls on 2026-09-03.
- **Units:** metres, seconds, radians. Speeds in m/s.
- **Sim/render split:** `core/loop.ts` runs sim at fixed 1/60 s; render interpolates (`Flight.sample(alpha,…)`). Never read `flight.pos/quat` directly in render code — sample.
- **Tunables:** every feel/number constant goes in `core/tunables.ts` and gets bound in `ui/debug.ts`. No magic numbers in sim/camera code.
- **Outlines are geometry:** ship solids and rocks get inverted-hull shells (`render/outline.ts`, instancing-aware), rocks also get baked crease lines. The screen-space `EdgePass` is off in every tier (DECISIONS 2026-09-03); anything that must never be outlined still goes on layer 1 via `noEdge()`.
- **Movement goes through `Flight.velDir`/`pos`:** the nose and the velocity are separate; drift, bounce and the barrel hop rely on it. Controls: mouse steers, A/D roll (double-tap = barrel roll), Shift boost; W/S and Space mean different things per `core/scheme.ts` (arcade: pull-up/dive + brake; classic: throttle + drift). `C` toggles, `?controls=` picks. Read keys through the scheme, never `Input.keys`.
- **Bloom budget:** diffuse stays under 1.0 linear (albedo × (key + fill) / π); anything that should glow uses `glowMaterial()` or an HDR colour. The bloom threshold is 1.0, not a separate emissive render.
- **Allocation:** no `new THREE.Vector3()` / `.clone()` inside per-frame or per-tick paths. Use module-level or instance scratch vars (`_p`, `_q`, `_tmp` pattern already in use).
- **Path alias:** import via `@/…`, never relative `../../`.
- **Strict TS:** `noUnusedLocals`/`noUnusedParameters`/`noUncheckedIndexedAccess` are on. Prefix intentionally-unused params with `_`.

## Layout
```
src/
  core/    loop, input, scheme (arcade/classic), tunables, random
  sim/     flight model (kinematic arcade-sim), hazards (rock collision, arena edge)
  render/  renderer + post stack, chase camera, inspect views, perf overlay
  world/   procedural skybox, planet, sun, asteroids, World composition
  ships/   parametric builder, ship defs, palettes, rig (ship + plumes), GLTF loader
  fx/      engine plumes, speed dust (particles, flashes later)
  ui/      DOM HUD, debug panel
docs/      roadmap, STATUS, DECISIONS, GRAPHICS, changelog, refs/, shots/
```
New systems get their own folder under `src/` (e.g. `src/combat/`, `src/ai/`, `src/fx/`). Keep `main.ts` as wiring only (61 lines today; the M0 exit said under 60, treat it as a ceiling to trend back to).

## Working style
- Small, verifiable steps. After any visual change, capture `?view=side&spin=0`, `?view=rear&spin=0` and the chase view into `docs/shots/YYYY-MM-DD-view.png` and compare against the previous one. Captures come from `node scripts/capture-shots.mjs` (headless Chromium via `playwright-core`, see `docs/shots/README.md`); the in-app preview pane cannot zoom or measure fps.
- Check `docs/STATUS.md` "Known issues" before debugging — it may already be listed. `docs/STATUS.md` is the state snapshot; the workspace's root `STATUS.md` (mid-task handoff only) is a different file and is absent when there is no WIP.
- When you make a decision that constrains future work (data format, render approach, third-party lib), append an entry to `docs/DECISIONS.md` in the same commit.
- Update `docs/STATUS.md` when a milestone item lands. Keep it honest: "works", "partial", "broken". Check the roadmap box with a dated note and add a `docs/changelog.md` line.
- Don't add dependencies without noting why in DECISIONS.md. Current runtime dep is just `three` (lil-gui comes from its examples); `playwright-core` is dev-only, for captures.

## IP note
Working title and place names (Abydos, Chulak, Tau'ri) are Stargate franchise terms, and since 2026-09-03 the player fighter deliberately follows the show's F-302 (Ethan's call, DECISIONS.md). Franchise names stay out of identifiers; no logos or glyphs. Any publication re-opens the likeness question with Ethan first.
