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
- [x] <!-- workspace:id=work:c17ad6ce-53bf-5fd8-b03e-379f47e148ce --> Move debris spawn + inspection views out of `main.ts` into `world/debris.ts` and `render/inspect.ts`. (done 2026-09-03: fresh build started this way (`world/debris.ts`, `render/inspect.ts`, `main.ts` is 59 lines))
- [x] <!-- workspace:id=work:7dba1386-09b8-578e-9509-c4aa309ed2d9 --> Remove per-frame allocations in `camera.ts` (`new Quaternion()`, `new Vector3()` in `update`) and `flight.ts` (`.clone()`, `new Vector3(0,1,0)`). (done 2026-09-03: fresh build uses module scratch vectors in camera, flight, debris)
- [x] <!-- workspace:id=work:33edf0ac-afcd-5848-b725-6bf16a4f4283 --> Add a perf overlay (draw calls, tris, ms sim / ms render) next to the fps readout. Needed before any graphics work so we can see what each change costs. (done 2026-09-03: `render/perf.ts` (fps, sim ms, render ms, calls, tris))
- [x] <!-- workspace:id=work:f09379e6-b5a1-556d-b321-45bca718cd52 --> Diagnose the 4 fps case. Add a `?quality=low|med|high` param controlling DPR cap, bloom on/off, planet segment count. (done 2026-09-03: `?quality=low|med|high` added (DPR cap, bloom, planet segments). The 4 fps capture is not reproducible in this build; a hidden or background tab throttles rAF and reads 0–4 fps in the overlay, which is the likeliest explanation. Re-open if it recurs on a visible tab)
- [x] <!-- workspace:id=work:14ca1621-5b62-5e27-bce5-9d0220e3a493 --> Fix `gui.show(gui._hidden)` — relies on a private field; use a local `visible` flag. (done 2026-09-03: `ui/debug.ts` uses a local `visible` flag)
- **Exit:** build passes, ≥60 fps on the target hardware floor with `quality=med`, `main.ts` under 60 lines. *(2026-09-03: build passes and `main.ts` is 59 lines; the fps floor is unmeasured because target hardware is still deferred, see STATUS.md.)*

### M1 — Graphics baseline (direction A)  (~4–6 weeks)
Get one ship and one system to row A of `docs/art-direction-options.png`. Ordered so each step is visible on its own.

**Week 1 — the two changes that define the look**
- [ ] <!-- workspace:id=work:d0437917-4f28-5372-a757-79e429de2e24 --> Outline pass. Start with inverted-hull on the ship (back-face, scaled along normals, black `MeshBasicMaterial`). Then a post-process edge pass (Sobel on depth + normal buffer) for everything else. Tunable width.
- [ ] <!-- workspace:id=work:ccae956d-a412-5dd9-9d57-de2b7ee8eb53 --> Toon lighting: custom shader chunk or `MeshToonMaterial` with a 2–3 step gradient map, plus a cool hemisphere fill so shadow side stays readable. Faction palettes in `ships/palettes.ts`.

**Week 2–3 — ship detail in the builder**
- [ ] <!-- workspace:id=work:9668c74e-4adb-5fea-8af5-8018ad1b0c09 --> `ShipDef` gains: `panels` (inset rects on hull, extruded −normal), `canopy` (separate lofted sub-mesh with frame), `hatches`, `nozzle` (ring stack), `decals` (flat quads with a tiny SDF/canvas texture for chevrons/numbers).
- [ ] <!-- workspace:id=work:ac68d23a-a75d-5353-bcef-8b40e0c278a1 --> Fix wing/fin dihedral pivot (rotate about root, not origin). Wings get a tapered airfoil section instead of a flat slab.
- [ ] <!-- workspace:id=work:f199ede0-bb2a-5e92-812b-e74a6575f173 --> Per-part palette slots: body / accent / dark / glow. F-11 Halberd re-authored to match reference proportions.
- [ ] <!-- workspace:id=work:0333b6e6-98bb-578c-bd3e-ba7f2325db42 --> Silhouette test view (`?view=side&silhouette=1`).

**Week 3–4 — environment**
- [ ] <!-- workspace:id=work:ba21512d-de94-54c8-af15-97f970798fc2 --> Plume: 2–3 stacked flat chevron quads in ship-local −Z, length ∝ throttle, hard-edged, additive; boost adds a white core.
- [ ] <!-- workspace:id=work:9edfbf93-cbd4-5666-9842-de8fdbfaef3c --> Asteroids: 6 base `IcosahedronGeometry(r, 0–1)` shapes with mild vertex jitter, `InstancedMesh`, outlined, slow tumble. Replaces debris.
- [ ] <!-- workspace:id=work:9eccc30e-7cbd-5b74-88f1-380332fb07fe --> Planet v2: posterised continents (hard `step` instead of `smoothstep`), 3-tone land / 2-tone sea, stepped shading, crisp atmosphere rim line, optional ring.
- [ ] <!-- workspace:id=work:0dd68c0e-2f84-5291-a900-bf6b44f8153e --> Nebula v2: posterise fbm into 3–4 tonal bands with 2–3 shape masks; keep 1 draw call.

**Week 4–5 — light and post**
- [ ] <!-- workspace:id=work:a5308cbb-c116-5c62-b09e-572acf1b9725 --> Shadow map from key light, tight frustum around player (wings shadow the hull).
- [ ] <!-- workspace:id=work:64854cf3-f1fa-5b32-b3e8-b9ba6f00ca24 --> Bloom: threshold ~0.7, emissive-only (plume, canopy, stars, glare) so the planet stops blowing out.
- [ ] <!-- workspace:id=work:7f3de477-b453-553c-a180-ecad67707d6f --> Post: light vignette, colour-grade LUT per sky preset, sun glare rework to a flat stepped disc.
- [ ] <!-- workspace:id=work:b3da22a5-9667-53d1-9914-1d5da057e045 --> Perf pass with the M0 overlay; quality tiers (outline post-pass is the expensive bit — low tier = inverted-hull only).

**Week 5–6 — buffer + taste pass**
- [ ] <!-- workspace:id=work:dac14c8e-a2be-5768-9f81-0c1536e0016a --> Side-by-side captures vs reference; iterate palettes, outline width, ramp steps.
- **Exit:** `?view=side` capture of the F-11 and a chase-cam flyby that sit next to row A without looking like the poor cousin.

**Migration hook for B (don't build now, don't block it):** keep `ships/loader.ts` alive and make the outline/toon passes toggleable per material, so a glTF hull can drop in with PBR materials later.

### M2 — Combat loop
- [ ] <!-- workspace:id=work:7b8a8fda-764e-5a7a-ab08-c8e32aaada66 --> Guns: hitscan-or-fast-projectile, muzzle flash, tracer, impact spark. Fire on LMB (`input.fire` already exists).
- [ ] <!-- workspace:id=work:cd7ab24a-d901-5d00-b5ca-ff2d953a304a --> Target: one enemy fighter with a simple pursue/evade state machine.
- [ ] <!-- workspace:id=work:4d78adab-7972-573f-8f27-f2317ecaeaeb --> Damage: HP, hit flash, destruction explosion (particles + light flash + debris chunks).
- [ ] <!-- workspace:id=work:ff1206d5-01e6-5dfc-b447-bb6eb76d3219 --> HUD: targeting reticle, lead indicator, target box, HP bars, radar/compass.
- [ ] <!-- workspace:id=work:aff1406c-5afc-5dd4-8ca5-a6fe6b36ea16 --> Player death + restart.
- **Exit:** a 1v1 that's fun for 3 minutes.

### M3 — Fleet & factions
- [ ] <!-- workspace:id=work:fbd1c463-3000-5d78-830c-2a559fa5d2a3 --> 3 player hulls, 3 enemy hulls, distinct silhouettes (see GRAPHICS.md silhouette test).
- [ ] <!-- workspace:id=work:4f39c478-be65-577d-b085-12e3d36e930e --> Faction materials/palettes.
- [ ] <!-- workspace:id=work:b24057c9-9ff2-5002-a606-e79c2d569ced --> 3+ sky presets, 3+ planet presets.
- [ ] <!-- workspace:id=work:b0ce8258-8118-50ac-b155-ac1f6e3adaa2 --> Enemy variety: interceptor, gunboat, one capital-scale target.

### M4 — Structure
- [ ] <!-- workspace:id=work:ccb23c6e-65b9-507b-a9a3-fe96f5e509a5 --> Hub scene → gate dial UI → transit FX → system → objective → return.
- [ ] <!-- workspace:id=work:b43496f3-906d-5db6-9ea7-ceced0195364 --> Mission templates: dogfight, escort, capital strike.
- [ ] <!-- workspace:id=work:e90114d4-73ac-502d-bfab-5043ad89afcc --> Progression: at least ship unlock.

### M5 — Polish
- [ ] <!-- workspace:id=work:4a4b65a8-1b9b-5003-aed0-604b95e6f42d --> Audio (engine loop, weapons, UI, music stubs).
- [ ] <!-- workspace:id=work:1d92fc39-1255-51d0-936b-36bb8c72dc2b --> Menus, settings (sensitivity, invert, quality), keybinds.
- [ ] <!-- workspace:id=work:209c7577-9da9-598d-b34e-2a868f079b94 --> Save/load (localStorage).
- [ ] <!-- workspace:id=work:239b2be7-4508-5066-a3f7-4910c341b86e --> Gamepad support.

## Non-goals (for now)
Multiplayer, mobile/touch, VR, mod support, story/dialogue system.
