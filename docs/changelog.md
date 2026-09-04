# Changelog

Newest on top. Roadmap items are checked off in `roadmap.md` and recorded here.

## 2026-09-04 — M2 "Clear the field" first pass + feedback round 3

- **Playable mission.** `game.ts` sits above flight and owns `combat/` (pooled instanced tracers, twin cannons on LMB, swept segment hits vs enemies / player / rocks, HP + regen, kills), `combat/enemies.ts` (glider AI: pursue with lead, fire inside a cone, break off close, evade when hit, rock repulsion, arena pull), `fx/explosion.ts` (flash disc + tetra debris; `spark()` for impacts), `mission/mission.ts` (intro → 3 waves of 2/3/5 → FIELD CLEAR card with time/kills/accuracy/hull; SHIP LOST card; R restarts) and `audio/audio.ts` (synth engine drone by speed, cannon, hit, damage, explosion, boost whoosh; M mutes). HUD gains HP bar, mission title/objective/kills line, reticle, target box with range + lead ring, off-screen arrow, end cards. Tunables in `T.weapons`, `T.enemy`, `T.player`.
- Ship likeness pass 2: F-11 rebuilt part by part after the F-302 (blunt drooped nose, tandem canopy with bulkheads, rectangular side intakes as boxy pods, 45° cropped delta with wingtip rails, four engines, canted deck fins). Builder: `EngineDef.aspect/boxiness/segments`, `nacelleSections()`, `intakeMouth()`, intake pods. Captures `docs/shots/f302-pass0-*` (before) and `f302-pass7-*` (after).
- Enemy hull: `combat/glider-def.ts`, a crescent-wing pod on the same builder (gold accents, orange glow).
- `?lock=free` treats the pointer as locked (headless tests, captures); `window.__game` / `__flight` are exposed for scripts. `capture-shots.mjs` gains a `fight` view.
- Round 3 fixes (f925ce5): opaque cel plumes (no see-through), boost energy with drain/recharge/re-engage floor and HUD bar, face-plane narrow phase for rock collision, both schemes kept.

## 2026-09-04 — Feedback round 2

- `core/scheme.ts`: arcade/classic control switch (`C`, `?controls=`), arcade default. Arcade = constant cruise (`cruiseSpeed`), W pull-up / S dive (`snapPitchRate`, `snapSlide`), Space brake (`brakeSpeed`, `brakeDecel`), Shift boost. Classic unchanged. HUD hint + mode tag per scheme; the bar shows speed/boost in arcade.
- Look toward Ethan's second reference: rust rock tints with a violet shadow emissive; planet palette saturated orange/blue with an indigo night side and no caps; nebula softer, denser, stippled, violet wash, dimmer hot core.
- `capture-shots.mjs`: `boost` holds Shift only.

## 2026-09-03 — Feedback round 1

- Controls: A/D roll; Space drift; double-tap A/D barrel roll. Q/E freed.
- Flight: velocity vector follows the nose with inertia (`velFollow`), drift freezes it, collisions reflect it (`Flight.bounce`).
- `sim/hazards.ts`: rock collision (bounce, speed bleed, shake, HUD flash) and the arena current past 1500 m with a HUD warning.
- `fx/dust.ts`: camera-riding speed dust, streaked along velocity, invisible when slow. Camera pulls back and rumbles on boost.
- `fx/plume.ts`: banded outer cone + hot inner cone per engine, replacing crossed quads.
- Asteroids: instanced outline shells + baked crease lines; screen-space `EdgePass` off in all tiers (class kept). Belt: 900 rocks, radius 60–1400, ±420 m. The "see-through" outlines were torn facets (per-occurrence jitter on an already non-indexed icosahedron); jitter is now per unique vertex (DECISIONS correction).
- Ship: F-11 re-authored after the show's fighter in gunmetal; builder gains open intakes (`EngineDef.intake`) and plume-less pods (`ShipDef.pods`).
- Sky: star field rewritten (magnitude spread, temperature tint, rare flares, milky-way band + haze).
- Inspect views hide the belt and dust; side view now looks at the lit port side.
- Captures: `boost` view (holds W + Shift for 6 s).

## 2026-09-03 — M1 graphics baseline (direction A)

- Chase camera springs its offset from the ship instead of its world position; the old spring lagged 25 m at 100 m/s and made the ship shrink with speed (2026-09-03).
- Outlines: inverted-hull shells on every ship solid (`render/outline.ts`, screen-constant width) plus a depth+normal sobel `EdgePass` over layer 0; layer 1 (`render/layers.ts`) opts out.
- Toon lighting: shared 4-texel ramp (`render/toon.ts`), key light with a player-following shadow map, cool hemisphere fill; `ships/palettes.ts` (tauri, goauld).
- Post: MSAA HalfFloat composer, HDR bloom threshold so only emissives bloom, `GradePass` vignette + saturation + per-sky tint, stepped sun disc.
- World: posterised nebula lobes with hot core and star flares, hard-step planet with thin limb line and optional ring, 6-shape instanced faceted asteroid belt (replaces `world/debris.ts`).
- Ships: soup builder with geometric orientation fix; recessed panels, accent stripes, airfoil wings/fins, nacelle + nozzle rings + throat, canopy with frame bands, hatches, canvas decals. F-11 Halberd re-authored.
- FX: `fx/plume.ts` chevron plumes, length ∝ throttle, boost core.
- Inspect: `&silhouette=1`, `&dist=`. Captures in `docs/shots/`.
- Vision reframed per Ethan (gate → missions, flying missions first, graphics before game); M2+ marked as placeholders.

## 2026-09-03 — fresh build of the render skeleton

- Fixed-step 60 Hz sim with interpolated render (`core/loop.ts`), pointer-lock mouse flight with a self-centering virtual stick, W/S throttle, Q/E roll, Shift boost, bank-into-turn and soft-horizon auto-level (`sim/flight.ts`).
- Spring-damped chase camera with stick sway and speed FOV (`render/camera.ts`).
- Procedural sky (3 presets), planet with fresnel atmosphere, sun glare sprite, instanced debris placeholder (`world/`).
- Parametric ship builder (superellipse loft, tapered slab wings/fins with root-pivot dihedral, nacelles + glow discs) and the F-11 Halberd def (`ships/`). Unused glTF loader hook kept.
- ACES + UnrealBloom post stack, `?quality=` tiers, `?view=` inspection modes, perf overlay, lil-gui tunables panel, DOM HUD.
- M0 items satisfied by construction: wiring-only `main.ts` (59 lines), no per-frame allocations, perf overlay, quality tiers, no private lil-gui field.
