# Changelog

Newest on top. Roadmap items are checked off in `roadmap.md` and recorded here.

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
