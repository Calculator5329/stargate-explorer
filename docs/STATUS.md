# STATUS.md — as of 2026-09-03 (M1 + feedback round 1 landed)

Snapshot of what actually works. This is the project state snapshot, not the workspace root `STATUS.md` handoff file (see CLAUDE.md). Update when things change; keep the "Known issues" list honest.

## Works
- Fixed-step loop with interpolation, fps counter.
- Pointer-lock mouse flight: virtual self-centering stick, W/S throttle, A/D roll, Shift boost, Space drift, double-tap A/D barrel roll, soft-horizon auto-level, bank-into-turn. Velocity vector chases the nose with inertia. +X is port (see CLAUDE.md).
- Hazards: sphere collision with every rock (bounce, speed bleed, camera shake, red flash); 1500 m arena with a soft turn-back current and HUD warning.
- Spring-damped chase camera (spring on the ship-relative offset, so no lag with speed) with turn sway, speed-FOV, boost pull-back and rumble.
- **Render stack (direction A):** MSAA HalfFloat RenderPass → UnrealBloom (HDR threshold, emissives only) → `GradePass` (vignette, saturation, per-sky tint) → OutputPass (ACES). Outlines are geometry: inverted-hull shells on every ship solid and (instanced) on every rock, screen-constant width, plus baked crease lines on rocks. `EdgePass` exists but is off in every tier.
- **Toon lighting:** shared 4-texel ramp on `MeshToonMaterial`, warm key with shadow map following the player (±16 m frustum), cool hemisphere fill. Wings and fins shadow the hull.
- **World:** posterised two-lobe nebula with hot core and star flares (1 draw call, 3 presets `?sky=abydos|deepSpace|chulak`, each with its own grade), hard-step planet (3 land tones, 2 sea tones, 3 light steps, thin limb line, optional banded ring), 900 faceted asteroids in 6 `InstancedMesh`es (body + shell + crease lines each) with slow tumble, stepped sun disc, velocity-streaked speed dust riding with the camera. Star field: magnitude spread, warm/white/blue tint, rare flares, faint milky-way band.
- **Ship builder:** superellipse hull loft with recessed panels and accent stripes, airfoil wings/fins (accent leading edges and tips), nacelles with nozzle ring stack and throat, lofted canopy with frame bands, hatches, canvas decals (chevron, number). Open intakes and plume-less pods. Five palette slots → five draw calls per ship + shells. F-11 Halberd follows the show's fighter in gunmetal (DECISIONS 2026-09-03).
- **Plumes:** banded outer cone + hot inner cone per engine, length ∝ throttle, boost widens the core, blooms.
- `?view=side|top|front|rear` (`&spin=0`, `&dist=0.5` close-up), `?view=side&silhouette=1` readability test, `?quality=low|med|high`.
- lil-gui tuning panel bound to every constant (`T.render`, `T.outline`, `T.toon`, `T.plume`, `T.sky`, `T.planet`, …). Perf overlay. DOM HUD: speed, throttle bar, hint, fps.

## Partial
- `Input.fire` is tracked but nothing consumes it.
- `ships/loader.ts` exists but is unused and untested against a real GLTF (B migration hook; a glTF hull would need `outlineShell()` and toon materials applied per mesh).

## Not started
Combat, AI, damage, particles, audio, menus, missions, gate/hub, saves, gamepad. Enemy hulls (glider-style fighters, a mothership) are not designed; `PALETTES.goauld` exists for them.

## Known issues
- **Awaiting Ethan's second look** (feedback round 1 landed 2026-09-03). Captures in `docs/shots/2026-09-04-*.png` (the `boost` view shows dust, pull-back, long plumes). Ethan's reference frames are still not in `docs/refs/`.
- Nebula is as Ethan wants it ("kind of like the nebula stuff as it is"); leave it.
- Ship likeness: proportions follow the F-302, but details (intake shape, tail numbers, panel lines) are first-pass. Compare the top view against a show still before iterating.
- Feel experiments are untested by a human: drift (Space), barrel roll (double-tap A/D), collision bounce, arena current. Every number is in `T.flight` / `T.arena` / `T.camera`. Rocks have no hit sound or debris yet.
- Fin shadows on the wings read as large dark blobs in the top view (shadow map 1024, ±16 m). Bias/size are in `world/sun.ts`.
- Crease lines are 1 px GL lines (MSAA-antialiased); they cannot be widened without a quad-line shader.
- Standing build warning: one chunk at ~583 kB minified (153 kB gzip) because `three` is one chunk. A warning that is not this one is a new warning.
- Frame rate on the target floor is unmeasured: the preview pane runs hidden (rAF throttled, overlay reads 0 fps) and headless captures use SwiftShader. Needs a visible tab on real hardware.

## Metrics
| Metric | Target | Current |
|---|---|---|
| fps @ quality=med, 1080p, integrated GPU | ≥60 | unknown (see Known issues) |
| draw calls | <150 (M2) | ~74 med, ~40 low |
| triangles | <300k | ~156k med (chase, 900 rocks + shells), ~5k inspect |
| bundle size (gzipped) | <500 kB | 153 kB |
