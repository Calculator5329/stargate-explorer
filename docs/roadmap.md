# Roadmap (was PLAN.md)

Workspace convention: this file is the work queue; open work is an unchecked checkbox, finished work is checked with a dated note and recorded in `changelog.md`.

Living document. Milestones are ordered; each has an exit criterion so "done" is unambiguous. Reorder freely, but write down why in DECISIONS.md.

## Vision (draft — confirm)
A browser space-combat game in the *tone* of late-90s/2000s space sims (Freespace, X-Wing, Wing Commander) with Stargate-flavoured structure: a hub, a gate you dial, a destination system, an objective, a return. Short sessions (5–15 min), mouse + keyboard, no install.

## Pillars
1. **Flight feel first.** If flying around an empty system isn't fun, nothing else matters. Every milestone re-validates this.
2. **Readable at speed.** Silhouettes, contrast, motion cues. Visual polish serves readability, not the other way round.
3. **Code-driven content.** Ships, skies, planets are data + procedural generation so iteration is fast and the bundle stays small. External assets only where procedural can't reach (see GRAPHICS.md).
4. **Ship small, ship often.** Every milestone produces a playable build.

## Open questions (block planning until answered)
- ~~Graphics target.~~ **Resolved:** A, stylised low-poly at reference fidelity. B is the later migration if wanted. → GRAPHICS.md
- ~~Asset policy.~~ **Resolved:** 100% procedural for A. Self-made Blender glTF only if/when migrating to B.
- **Scope of "combat".** One enemy type and guns only for M2, or missiles/countermeasures from the start?
- **Target hardware.** Deferred ("don't care yet"). Revisit at end of M1 once we know what B costs.
- **Multiplayer.** Assume no. Confirm — it changes the sim architecture if yes.

## Milestones

### M0 — Foundation hygiene  (now → 1 session)
Small fixes so later work isn't fighting the base.
- [x] Move debris spawn + inspection views out of `main.ts` into `world/debris.ts` and `render/inspect.ts`. (done 2026-09-03: fresh build started this way (`world/debris.ts`, `render/inspect.ts`, `main.ts` is 59 lines))
- [x] Remove per-frame allocations in `camera.ts` (`new Quaternion()`, `new Vector3()` in `update`) and `flight.ts` (`.clone()`, `new Vector3(0,1,0)`). (done 2026-09-03: fresh build uses module scratch vectors in camera, flight, debris)
- [x] Add a perf overlay (draw calls, tris, ms sim / ms render) next to the fps readout. Needed before any graphics work so we can see what each change costs. (done 2026-09-03: `render/perf.ts` (fps, sim ms, render ms, calls, tris))
- [x] Diagnose the 4 fps case. Add a `?quality=low|med|high` param controlling DPR cap, bloom on/off, planet segment count. (done 2026-09-03: `?quality=low|med|high` added (DPR cap, bloom, planet segments). The 4 fps capture is not reproducible in this build; a hidden or background tab throttles rAF and reads 0–4 fps in the overlay, which is the likeliest explanation. Re-open if it recurs on a visible tab)
- [x] Fix `gui.show(gui._hidden)` — relies on a private field; use a local `visible` flag. (done 2026-09-03: `ui/debug.ts` uses a local `visible` flag)
- **Exit:** build passes, ≥60 fps on the target hardware floor with `quality=med`, `main.ts` under 60 lines. *(2026-09-03: build passes and `main.ts` is 59 lines; the fps floor is unmeasured because target hardware is still deferred, see STATUS.md.)*

### M1 — Graphics baseline (direction A)  (~4–6 weeks)
Get one ship and one system to row A of `docs/art-direction-options.png`. Ordered so each step is visible on its own.

**Week 1 — the two changes that define the look**
- [ ] Outline pass. Start with inverted-hull on the ship (back-face, scaled along normals, black `MeshBasicMaterial`). Then a post-process edge pass (Sobel on depth + normal buffer) for everything else. Tunable width.
- [ ] Toon lighting: custom shader chunk or `MeshToonMaterial` with a 2–3 step gradient map, plus a cool hemisphere fill so shadow side stays readable. Faction palettes in `ships/palettes.ts`.

**Week 2–3 — ship detail in the builder**
- [ ] `ShipDef` gains: `panels` (inset rects on hull, extruded −normal), `canopy` (separate lofted sub-mesh with frame), `hatches`, `nozzle` (ring stack), `decals` (flat quads with a tiny SDF/canvas texture for chevrons/numbers).
- [ ] Fix wing/fin dihedral pivot (rotate about root, not origin). Wings get a tapered airfoil section instead of a flat slab.
- [ ] Per-part palette slots: body / accent / dark / glow. F-11 Halberd re-authored to match reference proportions.
- [ ] Silhouette test view (`?view=side&silhouette=1`).

**Week 3–4 — environment**
- [ ] Plume: 2–3 stacked flat chevron quads in ship-local −Z, length ∝ throttle, hard-edged, additive; boost adds a white core.
- [ ] Asteroids: 6 base `IcosahedronGeometry(r, 0–1)` shapes with mild vertex jitter, `InstancedMesh`, outlined, slow tumble. Replaces debris.
- [ ] Planet v2: posterised continents (hard `step` instead of `smoothstep`), 3-tone land / 2-tone sea, stepped shading, crisp atmosphere rim line, optional ring.
- [ ] Nebula v2: posterise fbm into 3–4 tonal bands with 2–3 shape masks; keep 1 draw call.

**Week 4–5 — light and post**
- [ ] Shadow map from key light, tight frustum around player (wings shadow the hull).
- [ ] Bloom: threshold ~0.7, emissive-only (plume, canopy, stars, glare) so the planet stops blowing out.
- [ ] Post: light vignette, colour-grade LUT per sky preset, sun glare rework to a flat stepped disc.
- [ ] Perf pass with the M0 overlay; quality tiers (outline post-pass is the expensive bit — low tier = inverted-hull only).

**Week 5–6 — buffer + taste pass**
- [ ] Side-by-side captures vs reference; iterate palettes, outline width, ramp steps.
- **Exit:** `?view=side` capture of the F-11 and a chase-cam flyby that sit next to row A without looking like the poor cousin.

**Migration hook for B (don't build now, don't block it):** keep `ships/loader.ts` alive and make the outline/toon passes toggleable per material, so a glTF hull can drop in with PBR materials later.

### M2 — Combat loop
- [ ] Guns: hitscan-or-fast-projectile, muzzle flash, tracer, impact spark. Fire on LMB (`input.fire` already exists).
- [ ] Target: one enemy fighter with a simple pursue/evade state machine.
- [ ] Damage: HP, hit flash, destruction explosion (particles + light flash + debris chunks).
- [ ] HUD: targeting reticle, lead indicator, target box, HP bars, radar/compass.
- [ ] Player death + restart.
- **Exit:** a 1v1 that's fun for 3 minutes.

### M3 — Fleet & factions
- [ ] 3 player hulls, 3 enemy hulls, distinct silhouettes (see GRAPHICS.md silhouette test).
- [ ] Faction materials/palettes.
- [ ] 3+ sky presets, 3+ planet presets.
- [ ] Enemy variety: interceptor, gunboat, one capital-scale target.

### M4 — Structure
- [ ] Hub scene → gate dial UI → transit FX → system → objective → return.
- [ ] Mission templates: dogfight, escort, capital strike.
- [ ] Progression: at least ship unlock.

### M5 — Polish
- [ ] Audio (engine loop, weapons, UI, music stubs).
- [ ] Menus, settings (sensitivity, invert, quality), keybinds.
- [ ] Save/load (localStorage).
- [ ] Gamepad support.

## Non-goals (for now)
Multiplayer, mobile/touch, VR, mod support, story/dialogue system.
