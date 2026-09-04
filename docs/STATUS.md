# STATUS.md — as of 2026-09-03 (M1 graphics baseline landed)

Snapshot of what actually works. This is the project state snapshot, not the workspace root `STATUS.md` handoff file (see CLAUDE.md). Update when things change; keep the "Known issues" list honest.

## Works
- Fixed-step loop with interpolation, fps counter.
- Pointer-lock mouse flight: virtual self-centering stick, W/S throttle, Q/E roll, Shift boost, soft-horizon auto-level, bank-into-turn. +X is port (see CLAUDE.md).
- Spring-damped chase camera with turn sway and speed-FOV.
- **Render stack (direction A):** MSAA HalfFloat RenderPass → `EdgePass` (depth+normal sobel over layer 0) → UnrealBloom (HDR threshold, emissives only) → `GradePass` (vignette, saturation, per-sky tint) → OutputPass (ACES). Inverted-hull outline shells on every ship solid, screen-constant width.
- **Toon lighting:** shared 4-texel ramp on `MeshToonMaterial`, warm key with shadow map following the player (±16 m frustum), cool hemisphere fill. Wings and fins shadow the hull.
- **World:** posterised two-lobe nebula with hot core and star flares (1 draw call, 3 presets `?sky=abydos|deepSpace|chulak`, each with its own grade), hard-step planet (3 land tones, 2 sea tones, 3 light steps, thin limb line, optional banded ring), 240 faceted asteroids in 6 `InstancedMesh`es with slow tumble, stepped sun disc.
- **Ship builder:** superellipse hull loft with recessed panels and accent stripes, airfoil wings/fins (accent leading edges and tips), nacelles with nozzle ring stack and throat, lofted canopy with frame bands, hatches, canvas decals (chevron, number). Five palette slots → five draw calls per ship + shells. F-11 Halberd re-authored to the reference proportions.
- **Plumes:** crossed chevron quads per engine, length ∝ throttle, boost widens a white core, blooms.
- `?view=side|top|front|rear` (`&spin=0`, `&dist=0.5` close-up), `?view=side&silhouette=1` readability test, `?quality=low|med|high`.
- lil-gui tuning panel bound to every constant (`T.render`, `T.outline`, `T.toon`, `T.plume`, `T.sky`, `T.planet`, …). Perf overlay. DOM HUD: speed, throttle bar, hint, fps.

## Partial
- `Input.fire` is tracked but nothing consumes it.
- `ships/loader.ts` exists but is unused and untested against a real GLTF (B migration hook; a glTF hull would need `outlineShell()` and toon materials applied per mesh).
- Nebula reads as flat cut-out lobes; the reference has more internal gradation. Taste pass item, see Known issues.

## Not started
Combat, AI, damage, particles, audio, menus, missions, gate/hub, saves, gamepad. Enemy hulls (glider-style fighters, a mothership) are not designed; `PALETTES.goauld` exists for them.

## Known issues
- **Awaiting Ethan's feedback** on the whole look (2026-09-03). Captures in `docs/shots/2026-09-03-*.png`; the reference frame is not yet in `docs/refs/`.
- Nebula lobes are large flat shapes with 4 lightness bands; against the reference they read as too flat and slightly too large. Tunable via `T.sky.nebulaStrength`; shape thresholds are in `world/skybox.ts`.
- Plume bloom hides the nozzle rings in the side view at throttle ≥ 0.5; the chevron structure is clearest at `quality=low` (no bloom).
- Edge pass lines are 1 px steps with no anti-aliasing (the normal target is single-sample). Acceptable for the style; revisit if it shimmers in motion on a visible tab.
- Standing build warning: one chunk at ~570 kB minified (148 kB gzip) because `three` is one chunk. A warning that is not this one is a new warning.
- Frame rate on the target floor is unmeasured: the preview pane runs hidden (rAF throttled, overlay reads 0 fps) and headless captures use SwiftShader. Needs a visible tab on real hardware.

## Metrics
| Metric | Target | Current |
|---|---|---|
| fps @ quality=med, 1080p, integrated GPU | ≥60 | unknown (see Known issues) |
| draw calls | <150 (M2) | 77–79 med (incl. normal pass), 42 low |
| triangles | <300k | ~56k med (chase), ~23k low |
| bundle size (gzipped) | <500 kB | 148 kB |
