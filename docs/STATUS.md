# STATUS.md — as of 2026-09-04 (M2 "Clear the field" first pass, unplayed by a human)

Snapshot of what actually works. This is the project state snapshot, not the workspace root `STATUS.md` handoff file (see CLAUDE.md). Update when things change; keep the "Known issues" list honest.

## Works
- Fixed-step loop with interpolation, fps counter.
- Pointer-lock mouse flight: virtual self-centering stick, A/D roll, double-tap A/D barrel roll, Shift boost, soft-horizon auto-level, bank-into-turn. Two schemes (`C` toggles, `?controls=`): **arcade** (default) holds a cruise speed, W pulls up / S dives hard, Space brakes; **classic** has a W/S throttle and Space drift. Velocity vector chases the nose with inertia. +X is port (see CLAUDE.md).
- Hazards: sphere collision with every rock (bounce, speed bleed, camera shake, red flash); 1500 m arena with a soft turn-back current and HUD warning.
- Spring-damped chase camera (spring on the ship-relative offset, so no lag with speed) with turn sway, speed-FOV, boost pull-back and rumble.
- **Render stack (direction A):** MSAA HalfFloat RenderPass → UnrealBloom (HDR threshold, emissives only) → `GradePass` (vignette, saturation, per-sky tint) → OutputPass (ACES). Outlines are geometry: inverted-hull shells on every ship solid and (instanced) on every rock, screen-constant width, plus baked crease lines on rocks. `EdgePass` exists but is off in every tier.
- **Toon lighting:** shared 4-texel ramp on `MeshToonMaterial`, warm key with shadow map following the player (±16 m frustum), cool hemisphere fill. Wings and fins shadow the hull.
- **World:** posterised two-lobe nebula with hot core and star flares (1 draw call, 3 presets `?sky=abydos|deepSpace|chulak`, each with its own grade), hard-step planet (3 land tones, 2 sea tones, 3 light steps, thin limb line, optional banded ring), 900 faceted asteroids in 6 `InstancedMesh`es (body + shell + crease lines each) with slow tumble (rust albedo, violet shadow emissive), stepped sun disc, velocity-streaked speed dust riding with the camera. Star field: magnitude spread, warm/white/blue tint, rare flares, faint milky-way band.
- **Ship builder:** superellipse hull loft with recessed panels and accent stripes, airfoil wings/fins (accent leading edges and tips), nacelles with nozzle ring stack and throat, lofted canopy with frame bands, hatches, canvas decals (chevron, number). Open intakes and plume-less pods. Five palette slots → five draw calls per ship + shells. F-11 Halberd follows the show's fighter in gunmetal (DECISIONS 2026-09-03; pass 2 on 2026-09-04 added boxy intakes via `EngineDef.aspect/boxiness/segments`, four engines, wingtip rails).
- **Plumes:** banded outer cone + hot inner cone per engine, length ∝ throttle, boost widens the core, blooms.
- `?view=side|top|front|rear` (`&spin=0`, `&dist=0.5` close-up), `?view=side&silhouette=1` readability test, `?quality=low|med|high`.
- lil-gui tuning panel bound to every constant (`T.render`, `T.outline`, `T.toon`, `T.plume`, `T.sky`, `T.planet`, …). Perf overlay. DOM HUD: speed, throttle/speed bar, boost energy bar, HP bar, hint, fps.
- **Boost energy:** drains while boosting, recharges otherwise, will not re-engage below a floor (`T.flight.boostDrain/boostRecharge/boostMinEngage`); the thin orange bar shows it.
- **Rock collision** is sphere broad phase + face-plane narrow phase (`Hazards.narrow`), so close fly-bys no longer bounce.
- **Combat (M2 first pass, verified headless only):** LMB fires twin cannons (`T.weapons`); pooled instanced tracers; swept hits against gliders, the player and rocks; impact sparks; destruction bursts with debris. Gliders (`combat/glider-def.ts`, `combat/enemies.ts`) pursue with lead, fire inside a cone, break off close, evade when hit, avoid rocks. Player HP with delayed regen; enemy rounds flash + shake.
- **Mission "Clear the field"** (`mission/mission.ts`): intro → 3 waves (2/3/5 gliders spawned 700–1100 m out, ahead) → FIELD CLEAR card (time, kills, accuracy, hull) or SHIP LOST card; R restarts. Objective line + kills top-left; target box with range and lead ring; off-screen arrow to the nearest glider.
- **Sound:** synthesised engine drone, cannon, hit, damage, explosion, boost whoosh; created on the first click; M mutes.

## Partial
- Combat balance is a first guess: no human has flown a wave. Enemy hp 40 / player round 12 (4 hits), enemy rounds 7 hp against 100. Glider AI has no formation, no wingman logic, no retreat.
- Muzzle flash is a glow disc only; no hit decals, no damage states on hulls.
- Sound is unheard by anyone (headless has no speakers); levels are guesses.
- `ships/loader.ts` exists but is unused and untested against a real GLTF (B migration hook; a glTF hull would need `outlineShell()` and toon materials applied per mesh).

## Not started
Heavier enemy hulls (bomber, mothership), menus, mission select, gate/hub, saves, gamepad, settings/keybinds.

## Known issues
- **Awaiting Ethan's verdict on M2** (2026-09-04): play "Clear the field" once; the fight capture is `docs/shots/2026-09-04d-fight.png`. Ethan's two reference frames are still not in `docs/refs/`.
- Headless SwiftShader runs the sim at ~0.5× real time, so a headless fight is slow motion; timing judgments need a real GPU.
- Rocks: the violet shadow side comes from a flat emissive, so it also tints lit facets slightly; the reference's plum-in-shadow / rust-in-light split would need a per-band hue ramp (custom toon shader).
- Ship likeness (pass 2, 2026-09-04): blunt nose, tandem canopy, boxy intakes, cropped delta, four engines, canted fins. Still missing: the intake box necking down aft (needs a builder `taper` + plume-radius override), splitter plates, gun ports, belly bay; length 15.7 m vs the show's 17. 7.5k tris in the top view (ceiling 8k).
- Feel experiments are untested by a human: barrel roll (double-tap A/D), collision bounce and narrow phase, arena current, boost energy. Every number is in `T.flight` / `T.arena` / `T.camera`. Rock hits have no debris.
- Fin shadows on the wings read as large dark blobs in the top view (shadow map 1024, ±16 m). Bias/size are in `world/sun.ts`.
- Crease lines are 1 px GL lines (MSAA-antialiased); they cannot be widened without a quad-line shader.
- Standing build warning: one chunk at ~607 kB minified (161 kB gzip) because `three` is one chunk. A warning that is not this one is a new warning.
- Frame rate on the target floor is unmeasured: the preview pane runs hidden (rAF throttled, overlay reads 0 fps) and headless captures use SwiftShader. Needs a visible tab on real hardware.

## Metrics
| Metric | Target | Current |
|---|---|---|
| fps @ quality=med, 1080p, integrated GPU | ≥60 | unknown (see Known issues) |
| draw calls | <150 (M2) | ~93 med in a fight (chase), ~40 low |
| triangles | <300k | ~156k med (chase, 900 rocks + shells), ~5k inspect |
| bundle size (gzipped) | <500 kB | 153 kB |
