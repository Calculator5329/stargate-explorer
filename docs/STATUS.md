# STATUS.md — as of 2026-09-03 (fresh build)

Snapshot of what actually works. This is the project state snapshot, not the workspace root `STATUS.md` handoff file (see CLAUDE.md). Update when things change; keep the "Known issues" list honest.

## Works
- Fixed-step loop with interpolation, fps counter.
- Pointer-lock mouse flight: virtual self-centering stick, W/S throttle, Q/E roll, Shift boost, soft-horizon auto-level, bank-into-turn.
- Spring-damped chase camera with turn sway and speed-FOV.
- Procedural skybox (3 presets, `?sky=abydos|deepSpace|chulak`), procedural planet with atmosphere, sun glare sprite.
- Parametric ship builder + one ship def (F-11 Halberd).
- ACES tone mapping + bloom post stack.
- lil-gui tuning panel bound to every constant. `?view=` inspection modes (`&spin=0` holds the ship still for repeatable captures).
- Perf overlay (fps, sim ms, render ms, draw calls, tris) and `?quality=low|med|high` tiers.
- Placeholder debris is one `InstancedMesh` (1 draw call), slow tumble.
- DOM HUD: speed, throttle bar, hint, fps.

## Partial
- `Input.fire` is tracked but nothing consumes it.
- `ships/loader.ts` exists but is unused and untested against a real GLTF. Now on the critical path (M1 track 1).

## Not started
Combat, AI, damage, FX/particles, audio, menus, missions, gate/hub, saves, gamepad, asteroid field (debris is placeholder).

## Known issues
- Ship reads as a smooth blob next to the reference: no panel breaks, canopy, plume, outlines or toon ramp yet (Ethan, 2026-09-03: "doesn't fit our mockups in depth and quality"). That is M1 in `roadmap.md`; the reference frame is the target.
- **4 fps observed** in an earlier preview capture; not reproducible in this build. Hidden/background tabs throttle rAF and the overlay reads 0–4 fps there, which is the likeliest cause. Re-open if it shows on a visible tab.
- Bloom threshold 0.35 lets the planet's day side and atmosphere bloom heavily. M1 moves bloom to an emissive-only channel.
- Planet fresnel atmosphere is a single shell; looks like a rim, not a volume.
- Wings and fins are flat tapered slabs; no panel detail, canopy, or nozzle rings (M1).
- Standing build warning: vite reports the single chunk at 550 kB minified (142 kB gzip) because `three` is one chunk. Not a defect; a warning that is not this one is a new warning.
- Frame rate on the target floor is unmeasured: target hardware is deferred (PLAN open questions).

## Metrics to start tracking (once the overlay exists)
| Metric | Target | Current |
|---|---|---|
| fps @ quality=med, 1080p, integrated GPU | ≥60 | unknown |
| draw calls | <150 (M2) | 28 (debris is instanced) |
| triangles | <300k | ~10.8k at quality=med |
| bundle size (gzipped) | <500 kB | 142 kB |
