# Roadmap (was PLAN.md)

Workspace convention: this file is the work queue; open work is an unchecked checkbox, finished work is checked with a dated note and recorded in `changelog.md`.

Living document. Milestones are ordered; each has an exit criterion so "done" is unambiguous. Reorder freely, but write down why in DECISIONS.md.

## Vision (Ethan, 2026-09-03)
A browser space-combat game in the *tone* of late-90s/2000s space sims (Freespace, X-Wing, Wing Commander) with Stargate-flavoured structure. You start out, go through a Stargate, and arrive at a mission. Missions come in types; the first type built is the **flying mission**: you pilot a spacecraft in the spirit of the SG-1 fighters and fight death-glider-style enemies, with a mothership or two as the big target, like the show. Short sessions (5–15 min), mouse + keyboard, no install.

**Graphics first.** M0 and M1 were about making the graphics look good before building the game out, because how good they get decides how far the game can be pushed. Ethan called the round-2 result "good enough to start on some of the next phases" (2026-09-04); M2 was rewritten then as the first playable level. M3–M5 are still pre-M1 sketches.

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
- [x] <!-- workspace:id=work:d0437917-4f28-5372-a757-79e429de2e24 --> Outline pass. Start with inverted-hull on the ship (back-face, scaled along normals, black `MeshBasicMaterial`). Then a post-process edge pass (Sobel on depth + normal buffer) for everything else. Tunable width. (done 2026-09-03: `render/outline.ts` inverted-hull shells with screen-constant width (`T.outline.hullWidth`), `render/edgepass.ts` depth+normal sobel over layer 0; width, thresholds and crease fade in `T.outline`)
- [x] <!-- workspace:id=work:ccae956d-a412-5dd9-9d57-de2b7ee8eb53 --> Toon lighting: custom shader chunk or `MeshToonMaterial` with a 2–3 step gradient map, plus a cool hemisphere fill so shadow side stays readable. Faction palettes in `ships/palettes.ts`. (done 2026-09-03: `render/toon.ts` shared 4-texel ramp on MeshToonMaterial (shadow/mid/lit, `T.toon`), hemisphere fill in `world/sun.ts`, `ships/palettes.ts` tauri + goauld)

**Week 2–3 — ship detail in the builder**
- [x] <!-- workspace:id=work:9668c74e-4adb-5fea-8af5-8018ad1b0c09 --> `ShipDef` gains: `panels` (inset rects on hull, extruded −normal), `canopy` (separate lofted sub-mesh with frame), `hatches`, `nozzle` (ring stack), `decals` (flat quads with a tiny SDF/canvas texture for chevrons/numbers). (done 2026-09-03: recessed `panels` per loft cell, accent `stripes`, lofted `canopy` with frame bands, `hatches`, nozzle ring stack + throat per engine, canvas `decals` (chevron, number, stripe))
- [x] <!-- workspace:id=work:ac68d23a-a75d-5353-bcef-8b40e0c278a1 --> Fix wing/fin dihedral pivot (rotate about root, not origin). Wings get a tapered airfoil section instead of a flat slab. (done 2026-09-03: six-point airfoil sections lofted root→tip with root-pivot dihedral; leading edges and tips take the accent slot)
- [x] <!-- workspace:id=work:f199ede0-bb2a-5e92-812b-e74a6575f173 --> Per-part palette slots: body / accent / dark / glow. F-11 Halberd re-authored to match reference proportions. (done 2026-09-03: slots body/accent/dark/glow/canopy bucketed into one mesh each; F-11 re-authored (16 m, 12 m span, forward canopy, boxy mid-body, canted tails, half-embedded nacelles))
- [x] <!-- workspace:id=work:0333b6e6-98bb-578c-bd3e-ba7f2325db42 --> Silhouette test view (`?view=side&silhouette=1`). (done 2026-09-03: `&silhouette=1` (black ship on white, world hidden, post off); `&dist=` scales framing)

**Week 3–4 — environment**
- [x] <!-- workspace:id=work:ba21512d-de94-54c8-af15-97f970798fc2 --> Plume: 2–3 stacked flat chevron quads in ship-local −Z, length ∝ throttle, hard-edged, additive; boost adds a white core. (done 2026-09-03: `fx/plume.ts` two crossed quads per engine, V-notch chevrons, length ∝ throttle, boost widens a white core; HDR colour so only it blooms)
- [x] <!-- workspace:id=work:9edfbf93-cbd4-5666-9842-de8fdbfaef3c --> Asteroids: 6 base `IcosahedronGeometry(r, 0–1)` shapes with mild vertex jitter, `InstancedMesh`, outlined, slow tumble. Replaces debris. (done 2026-09-03: `world/asteroids.ts` 6 jittered icosahedra, one InstancedMesh each (240 rocks), toon material, outlined by the edge pass)
- [x] <!-- workspace:id=work:9eccc30e-7cbd-5b74-88f1-380332fb07fe --> Planet v2: posterised continents (hard `step` instead of `smoothstep`), 3-tone land / 2-tone sea, stepped shading, crisp atmosphere rim line, optional ring. (done 2026-09-03: `world/planet.ts` hard steps for land/sea, 3 land tones, 2 sea tones, 3 light steps, thin limb line on a 1.02R shell, `ring?: RingDef` banded ring (off on the default planet))
- [x] <!-- workspace:id=work:0dd68c0e-2f84-5291-a900-bf6b44f8153e --> Nebula v2: posterise fbm into 3–4 tonal bands with 2–3 shape masks; keep 1 draw call. (done 2026-09-03: two lobe masks + swirl, 4 lightness bands per lobe, hot core where they overlap, star flares; still one draw call)

**Week 4–5 — light and post**
- [x] <!-- workspace:id=work:a5308cbb-c116-5c62-b09e-572acf1b9725 --> Shadow map from key light, tight frustum around player (wings shadow the hull). (done 2026-09-03: directional shadow map (1024 med / 2048 high) with a ±16 m ortho frustum that follows the player; fins and wings shadow the hull)
- [x] <!-- workspace:id=work:64854cf3-f1fa-5b32-b3e8-b9ba6f00ca24 --> Bloom: threshold ~0.7, emissive-only (plume, canopy, stars, glare) so the planet stops blowing out. (done 2026-09-03: threshold 1.0 in linear HDR: toon diffuse stays under 1.0, emissives (plume, glow discs, glare, bright stars) sit at 1.5+; no separate render)
- [x] <!-- workspace:id=work:7f3de477-b453-553c-a180-ecad67707d6f --> Post: light vignette, colour-grade LUT per sky preset, sun glare rework to a flat stepped disc. (done 2026-09-03: `render/gradepass.ts` vignette + saturation + shadow/highlight tint per sky preset; glare is a flat 4-step disc)
- [x] <!-- workspace:id=work:b3da22a5-9667-53d1-9914-1d5da057e045 --> Perf pass with the M0 overlay; quality tiers (outline post-pass is the expensive bit — low tier = inverted-hull only). (done 2026-09-03: low = no edge pass, bloom, shadows or MSAA (42 calls / 23k tris); med/high add them; counts in STATUS.md. fps floor still unmeasured (hidden-tab captures read 0))

**Week 5–6 — buffer + taste pass**
- [x] <!-- workspace:id=work:dac14c8e-a2be-5768-9f81-0c1536e0016a --> Side-by-side captures vs reference; iterate palettes, outline width, ramp steps. *(2026-09-03: one pass against Ethan's in-chat reference frame, `docs/shots/2026-09-03-*.png`. Cream/red palette, 1.8 px hull outlines, 3-step ramp, blue HDR plumes all land; nebula is the weak spot (banded but heavy coverage). Reference PNGs still need dropping into `docs/refs/`. Further iteration waits on Ethan's feedback.)*
- **Exit:** `?view=side` capture of the F-11 and a chase-cam flyby that sit next to row A without looking like the poor cousin. *(2026-09-03: M1 code complete; whether it sits next to row A is Ethan's call on the captures.)*

**Migration hook for B (don't build now, don't block it):** keep `ships/loader.ts` alive and make the outline/toon passes toggleable per material, so a glTF hull can drop in with PBR materials later.

### M1.5 — Feedback round 1 (Ethan, 2026-09-03)  *(done 2026-09-03)*

Ethan's notes on the M1 captures, in his words where it matters: "very good start"; A/D should roll, not Q/E; booster has visual artifacts; asteroids fly-through and their outlines "see-through" and angle-dependent; the ship "should look a lot more like the show ... that gray ... F-302"; nebula fine as is, stars "don't look accurate"; more indication of speed; a bounded field dense enough to read speed against; ideas for dogfight feel.

- [x] <!-- workspace:id=work:f740fc1c-e3e2-530f-a75b-b8c7195d7a60 --> A/D roll (Q/E dropped); hint text updated. *(2026-09-03)*
- [x] <!-- workspace:id=work:8b6f3237-faf8-5b8d-ad28-5da7eb646fe6 --> Plume rebuilt as banded cones with a hot inner core; the crossed quads that showed as diagonal dark bands are gone. *(2026-09-03)*
- [x] <!-- workspace:id=work:585598d7-0a17-593f-ba67-4c90defcd7db --> Asteroids: instanced inverted-hull shells + baked crease lines (55°) replace the screen-space edge pass, which is now off in every tier. Root cause of the see-through lines was torn rock geometry (jitter per vertex occurrence), fixed by welding the jitter per unique vertex. *(2026-09-03)*
- [x] <!-- workspace:id=work:ab7d7073-4db9-5829-b6bc-d2ea296a4276 --> Collision: sphere vs rock, bounce with speed bleed, camera shake, red HUD flash. *(2026-09-03)*
- [x] <!-- workspace:id=work:0967deab-45b1-5834-8612-cde4f22d1e60 --> Arena: 1500 m field, belt densified to 900 rocks inside it; past the edge a soft current turns you back and the HUD says so. *(2026-09-03)*
- [x] <!-- workspace:id=work:491b2484-a5c1-5d9b-a069-71f197db87ce --> Speed cues: velocity-streaked dust that fades in above 70 m/s, camera pull-back and rumble on boost, wider FOV swing. *(2026-09-03)*
- [x] <!-- workspace:id=work:99784b63-c01e-54d1-8eca-b4edc1d6944d --> Flight feel experiments: velocity vector now chases the nose with inertia; Space drifts (nose free, velocity frozen); double-tap A/D barrel-rolls with a sideways hop. All tunable, all reversible. *(2026-09-03)*
- [x] <!-- workspace:id=work:a2852cbc-6a00-5bf5-a464-ed4c2e9d7bbc --> Hull re-authored to follow the show's fighter: gunmetal palette, wedge nose with chines, tandem canopy forward, intake-fed engines on the aft deck, canted fins on the nacelles, under-wing booster pods. `?palette=cream` is not wired; the cream palette stays in `palettes.ts`. *(2026-09-03)*
- [x] <!-- workspace:id=work:7887c1ec-d100-5c48-beeb-f1ec0a837003 --> Stars: dim 1 px points with a warm/white/blue spread, flares only on the rare bright ones, faint milky-way band with haze; no sub-pixel sparkle. *(2026-09-03)*
- **Exit:** Ethan's second look at `docs/shots/2026-09-04-*.png` (boost view added). Open feel questions are listed in STATUS.md.

### M1.6 — Feedback round 2 (Ethan, 2026-09-04)  *(done 2026-09-04, awaiting his look)*
Ethan, on the round-1 shots: try W as a sharp pull-up and S as a dive with a constant cruise speed, Shift boost, Space brake, "as a switcher so we could try this mode out and then potentially go back"; planet, asteroids and nebula should look "a little bit more like" his second reference frame (orange/violet painterly nebula with dark negative space, plum rocks with rust-lit facets, saturated orange/blue planet with an indigo night side, no ice caps).
- [x] <!-- workspace:id=work:08c83605-3293-54f3-b636-d5af80a1d136 --> Control scheme switch: `core/scheme.ts`, arcade by default, `C` toggles live, `?controls=classic|arcade`; HUD hint and a fading mode tag follow it. *(2026-09-04)*
- [x] <!-- workspace:id=work:76a30ce0-af62-552e-ab7e-7975466e4ccd --> Arcade scheme: `cruiseSpeed` held, W/S add `snapPitchRate` on top of the mouse and let the velocity slide (`snapSlide`), Space brakes to `brakeSpeed` at `brakeDecel`, Shift boosts. Classic (W/S throttle, Space drift) unchanged. *(2026-09-04)*
- [x] <!-- workspace:id=work:a3a68acb-d46c-5f33-9ed8-6bc1affea7d3 --> Palette pass toward the reference: rock tints rust with a violet emissive for the shadow side; planet palette saturated orange/blue, coloured night side (`night`), caps off (`T.planet.iceLine` 1.05); nebula thresholds lowered, posterisation softened, fine stipple grain, violet wash, hot core dimmed. *(2026-09-04, `docs/shots/2026-09-04b-*.png`)*
- [x] <!-- workspace:id=work:c7dae40f-e677-5f0c-96e8-15bac91dea91 --> Capture `boost` view holds Shift only (W is a pull-up in arcade). *(2026-09-04)*
- [ ] <!-- workspace:id=work:07313f42-98be-5676-94b9-8c2bed1cda86 --> Ethan flies both schemes and picks one (or keeps both). Reference PNGs still want dropping into `docs/refs/`.

**Exit:** Ethan's verdict on the arcade scheme and the 2026-09-04b shots.

### M1.7 — Feedback round 3 (Ethan, 2026-09-04)
Ethan on round 2: "fantastic ... especially the graphics"; plumes still glitch ("you shouldn't really be able to see through the boosters"); the ship "still doesn't look enough like an SG-1 ship"; keep **both** control schemes for now; boost needs a cooldown "so it's not overpowered"; rock collision triggers on a close fly-by without a hit. Then: "good enough to start on some of the next phases".
- [x] <!-- workspace:id=work:a6ff6cca-a8fa-5242-b9a9-ee880aec5f00 --> Plumes: both cones opaque with the chevron notches cut out (a cel flame is a solid shape), base seated inside the nozzle. Verified on `2026-09-04c-{rear,chase}.png`. *(2026-09-04)*
- [x] <!-- workspace:id=work:8776de56-9126-59a4-b545-1d5a29717b76 --> Boost energy: `Flight.boostEnergy` drains while boosting, recharges when not, cannot re-engage below a floor; thin orange bar above the throttle bar. Tunables `boostDrain`, `boostRecharge`, `boostMinEngage`. *(2026-09-04)*
- [x] <!-- workspace:id=work:32f50df1-de54-544a-b618-aace2111f99a --> Rock collision narrow phase: bounding sphere, then the ship point against the rock's face planes in rock space (`Asteroids.planes`, `Hazards.narrow`). *(2026-09-04, untested by a human)*
- [x] <!-- workspace:id=work:9f7f3816-aa13-50a2-948e-2f9cd27e6dc3 --> Ship likeness pass 2: longer slender nose, canopy further forward, boxy side intakes under the wing roots, wing notch, canted twin tails, two large rocket exhausts, flatter hull. Top and side captures against the show's fighter. (2026-09-04: F-11 rebuilt after the F-302: blunt drooped nose, tandem canopy, boxy side intakes, cropped delta, four engines, canted fins; `docs/shots/f302-pass7-*.png` vs `f302-pass0-*`. Still missing: intake taper, gun ports, weapons bay.)
- [x] <!-- workspace:id=work:04f898cf-37e1-5e96-9fd5-305bbbee2b5d --> DECISIONS: both schemes stay (supersedes "the loser is deleted"). *(2026-09-04)*

**Exit:** round-3 captures plus a chat rundown for Ethan's return.

### M1.8 — Feedback round 4 (2026-09-04, Ethan playing the M2 build)
Ethan: "the ship look has degraded from last time", "boosters are really bad now too", everything else looks and feels good; unsure whether gliders are too hard or just fast.
- [x] <!-- workspace:id=work:776227ad-e112-5397-beba-9b45e39e79e9 --> (2026-09-04) Ship likeness pass 3, from Ethan's two reference images: slender faceted fuselage, one huge thin delta (LE z 3 → -5.5, straight TE at -7), two round intake nacelles above the wing aft, wingtip plates, no tail fins. `docs/shots/f302-pass8-*.png`.
- [x] <!-- workspace:id=work:ecd1bb12-00cb-5b05-8a1d-0c07086dc006 --> (2026-09-04) Plumes: no chevron cut-outs (read as torn holes), cones taper to a point instead of a 0.22 tube, shorter (4.5 m cruise / 11 m boost), base 0.78 of nozzle radius.
- [ ] <!-- workspace:id=work:fba868e4-9fd9-587a-8c19-51b17732b9b8 --> Glider difficulty: Ethan is playing to find out whether it is speed (dash 190 vs cruise 150) or tracking. Do not touch `T.enemy` until he reports. Candidates: slower dash, longer break-off, a target-lock arrow that persists, slower enemy rounds.

### M2 — First playable level ("Clear the field")
Rewritten 2026-09-04 from the pre-M1 sketch. One mission you can play start to finish in 5–10 minutes: you are already in the field; gliders arrive in waves; clear them; a mission-complete card with time and accuracy; restart. Gate transit, hub and mission select are M4.
- [x] <!-- workspace:id=work:7b8a8fda-764e-5a7a-ab08-c8e32aaada66 --> (2026-09-04, `combat/projectiles.ts` + `combat/combat.ts`, no muzzle-flash mesh beyond a glow disc) Guns: twin fast projectiles (pooled, instanced), muzzle flash, tracer, impact spark. Fire on LMB (`input.fire` already exists). Fire rate and spread in `T.weapons`.
- [x] <!-- workspace:id=work:cd7ab24a-d901-5d00-b5ca-ff2d953a304a --> (2026-09-04, `combat/enemies.ts` + `combat/glider-def.ts`; waves of 2/3/5, AI verified headless: it closes, shoots, hurts) Target: a death-glider-style enemy hull from the builder (crescent wings, central pod) with a pursue / fire-when-aligned / break-off / evade-when-hit state machine, rough rock avoidance, waves of 3–6.
- [x] <!-- workspace:id=work:4d78adab-7972-573f-8f27-f2317ecaeaeb --> (2026-09-04, `fx/explosion.ts`; 4 hits kills a glider) Damage: HP for player and enemies, hit flash, destruction explosion (flash + debris chunks + glow), enemy shots that hurt the player.
- [x] <!-- workspace:id=work:ff1206d5-01e6-5dfc-b447-bb6eb76d3219 --> (2026-09-04, `ui/hud.ts` `updateCombat`; one arrow for the nearest target, not one per target) HUD: reticle, target box with lead indicator, off-screen target arrows, HP bar, kill counter, wave/objective line.
- [x] <!-- workspace:id=work:aff1406c-5afc-5dd4-8ca5-a6fe6b36ea16 --> (2026-09-04, cards in `index.html`, R reloads) Player death → "ship lost" card → restart; mission complete card (time, kills, accuracy) → restart.
- [x] <!-- workspace:id=work:86261681-ed73-5db7-9e4a-41c1ad122519 --> (2026-09-04, `mission/mission.ts`, `CLEAR_THE_FIELD` data) Mission script (`src/mission/`): intro line, 3 waves; all counts and timings in data, not code. **Dropped from this pass:** the heavier finale hull, the third wave is 5 gliders instead. Bomber-scale target moves to M3 (fleet).
- [x] <!-- workspace:id=work:38d2f8b9-bca8-5dda-ac4e-d8ed104df163 --> (2026-09-04, `audio/audio.ts`, unheard by anyone yet: headless has no speakers) Sound, minimal WebAudio synthesis (pulled forward from M5 because it carries most of the "dogfight" feel): engine hum by speed, cannon, hit, explosion, boost. Mute key.
- [x] <!-- workspace:id=work:52ed959e-96d7-551f-a39e-dd552cae6f44 --> (2026-09-04, `docs/shots/2026-09-04d-fight.png`) Captures of a fight (`scripts/capture-shots.mjs` gains a `fight` view that lets a wave spawn), STATUS/changelog/DECISIONS updated, chat rundown.
- **Exit:** Ethan plays "Clear the field" through once and has feedback that is about the game, not the tooling.

### M2.5 — Overnight build (2026-09-04, from Ethan's "GOT EM" feedback and the milestone list he sent)
Ethan asked for momentum, lethal rock hits, a canon secondary weapon, then "all that + the other milestones": more level types (race, asteroid run, protect, cruiser strike), obstacles, a deeper map, the Prometheus as an unlockable with its own stats, SG-1-flavoured stories, better crash/explosion animation. Everything below landed in one night and is verified headless only.
- [x] <!-- workspace:id=work:04c0f5f7-4e96-5652-8b45-fc517e8c9d4d --> (2026-09-04, `sim/flight.ts` velocity vector, X toggles assist) Momentum: lateral slide through turns, coast-down after boost, flight-assist-off drift mode.
- [x] <!-- workspace:id=work:afdb46e7-80bf-5340-9fe9-db863536251b --> (2026-09-04, `Flight.impactDamage`, gliders too via `Enemies.rockHit`) Rock hits hurt by normal speed; head-on at cruise is fatal.
- [x] <!-- workspace:id=work:f27ef0cd-96e9-5416-84e5-fac2dbec90be --> (2026-09-04, `combat/missiles.ts`, RMB) Lock-on missiles, in-canon for the F-302.
- [x] <!-- workspace:id=work:7f96a786-586c-503e-9483-d2d3e6a632be --> (2026-09-04, `ui/menu.ts`, `core/save.ts`, `core/difficulty.ts`) Esc pause/start menu: scheme, flight assist, mouse sensitivity, difficulty preset, mute, restart, missions. Persisted.
- [x] <!-- workspace:id=work:0abbed7b-8d96-55c5-9765-3ad942930a85 --> (2026-09-04, `ships/registry.ts` stats applied in Flight/Combat/camera/hazards) Per-ship stats; Prometheus flyable (`ships/prometheus-def.ts`, subagent hull).
- [x] <!-- workspace:id=work:e50baee0-7583-55ac-95d6-4a3f67d797eb --> (2026-09-04, `mission/levels.ts` + runners `clear/run/protect/strike.ts`, `ui/hub.ts`) Mission framework with four types and a mission-select hub with saved progress: Clear the Field, The Gauntlet (12 gates vs the clock), Cover the Prometheus (escort), Bring Down the Ha'tak (turrets → shield nodes → hull; unlocks the Prometheus).
- [x] <!-- workspace:id=work:6cd9dbd1-549a-5f70-a543-09fe7b8b7b67 --> (2026-09-04, `combat/capital.ts`, subagent) Ha'tak-style capital ship with turrets that shoot, weak points, staged death.
- [x] <!-- workspace:id=work:a535278b-528a-5087-b826-600383ff55dd --> (2026-09-04, `fx/explosion.ts` rewrite, subagent; `crash()` wired to player and glider rock hits) Two-tone fireball + shockwave ring + debris + smoke explosions; crash dust cones.
- [x] <!-- workspace:id=work:37b2b79e-8a08-5c72-a4d8-4a3c37a5e66d --> (2026-09-04, `mission/mines.ts`) First new obstacle type: proximity mines. Two on every Gauntlet gate rim, a ring of fourteen around the Ha'tak. 45 hull in the blast, lockable and shootable (a hit sets them off in place, hurting gliders too).
- [x] <!-- workspace:id=work:89c26fc0-c6ef-57b3-887e-475b51bfa910 --> (2026-09-04, `Combat.hurt`/`dieTick`, `Flight.dead`) Player death sequence: controls die, the ship tumbles and burns for 1.6 s with small bursts before the final one; the loss card waits for it.
- [x] <!-- workspace:id=work:b70400d1-54d3-5427-a740-559fe116be0b --> (2026-09-04, Ethan's first play: "quite good") Ethan played. His asks and what landed the same morning: cannon 13/s; camera attitude lag so pull-ups and barrel rolls read on screen; Gauntlet rebuilt as a rock-pocket obstacle course with two-way gates and 620 m spacing; kill replay (`replay/`). Ship look: variant gallery for him to pick (`docs/design/ship-variants.html`).
- [x] <!-- workspace:id=work:de7c52a9-692a-5204-a127-87537a6d1fec --> (2026-09-04) Ethan picked variant A (Facet) from the gallery; it is the shipped hull (`PLAYER_HULL`), `?variant=original` flies the old one.
- [ ] <!-- workspace:id=work:00163495-25bd-5fc6-aaff-0f2a30070732 --> Ethan reports on the new gauntlet spacing, the camera lag numbers and whether the replay picks the right kill.
- [x] <!-- workspace:id=work:57bb3468-cb35-5690-ae4e-574d5df6065c --> (2026-09-04) Dogfight feel: gliders jousted. Ethan picked "get on the tail" + "fear the guns" from four options; landed as `saddle` and `flinch` states in `combat/enemies.ts`. Roles per glider (shooter + wingmen) held until he has flown this.
- [ ] <!-- workspace:id=work:68395d97-6739-5b0f-ae3d-2cfbd657762a --> Ethan flies the dogfight brain and reports: does it feel like a fight, and is it now too hard to get a kill? Then decide on per-glider roles.
- [ ] <!-- workspace:id=work:3ee79dc8-228b-52e9-b899-41891b36037e --> Ethan plays the four missions and the Prometheus and reports: difficulty preset that fits, gate count/time for the Gauntlet, whether the Ha'tak fight is legible (which part to shoot next).
- [x] <!-- workspace:id=work:09c613ca-7697-53fd-be4e-95ba2b315843 --> Obstacle types beyond rocks, mines and the hull. *(2026-09-04 late: ice shards (Kheb, the shard run) and derelict wreckage (The Graveyard, the ambush) as belt styles; gamepad landed later the same night; the deeper map (five systems, gate travel), the gunboat and the ring race with AI racers all landed, see M3/M4.)*
- **Exit:** Ethan's feedback on the four missions is about the game, not the tooling.

### M2.6 — Asteroid batch (2026-09-05, Ethan: "a lot more asteroids and a more interesting map ... a mini-map ... blow apart asteroids ... if enemies go into asteroids, they're destroyed")

- [x] <!-- workspace:id=work:b368131c-8625-559d-bfbd-9abf9b722f31 --> Destructible rocks with fragments that keep colliding; player cannon and missiles break them. *(2026-09-05, `Asteroids.damage`, `T.rocks`, `scripts/rock-test.mjs`)*
- [x] <!-- workspace:id=work:bf0ecc63-8b5c-54b4-bbfa-bed54f5ad1bd --> Enemies destroyed on rock impact; a player-made fragment that kills one is the player's kill. *(2026-09-05, `Enemies.rockHit`, `Enemy.crashCredit`)*
- [x] <!-- workspace:id=work:eff11deb-83be-5f85-986c-75f517df70ea --> Belts ~2x denser with per-system layout (cluster knots, ring bands). *(2026-09-05, `AsteroidOptions.clusters/band`, `world/systems.ts`)*
- [x] <!-- workspace:id=work:fe4f9463-5fcd-5ef8-a4ba-d3de503733d3 --> HUD mini-map, heading-up, rocks/enemies/marker/arena edge. *(2026-09-05, `ui/minimap.ts`)*
- [ ] <!-- workspace:id=work:54d0c9c4-db0c-57a4-931b-2fe9ed017fbf --> Ethan flies it: rock hp, fragment speed and life, crash threshold, mini-map range and size are untuned guesses in `T.rocks`.
- [x] <!-- workspace:id=work:e51bbaa3-205f-54c6-a2c3-e891face26af --> Rock-break sound of its own (a crunch, not the ship explosion), and a "rocks broken" line on the end card. *(2026-09-05, `Audio.crunch`, `Mission.rocksLine`, checked by rock-test scenario 4)*

### M2.7 — Feedback round 5 (2026-09-05, Ethan on the asteroid batch and the escort mission)
Ethan: prefers classic; assist helps but may be too strong; arcade W/S up/down "not great"; mouse flight "kind of weird" (acceleration? sensitivity?); has to line the nose up exactly to hit; HUD filled with "Prometheus hull 100%" on the escort; asteroids should vary in colour and size, the map should grow and density should vary.
- [x] Escort HUD line appended the hull suffix every tick; composed once now. *(2026-09-05)*
- [x] Cursor steer mode (default) with an aim cursor, `relative` kept as an option; raw mouse motion via pointer-lock `unadjustedMovement`. *(2026-09-05, untested by a human)*
- [x] Assist strength slider scaling `latDamp` and `autoLevel`. *(2026-09-05)*
- [x] Belts vary per system: mixed tint families, size mix, empty pockets; arenas 1700..2400 m per system. *(2026-09-05, headless only; captures wanted)*
- [ ] Ethan flies cursor vs relative steer and reports; then tune `cursorRadius`/`cursorCurve` or drop the loser.
- [ ] Ethan says what is wrong with arcade W/S (abrupt, slow, fights the mouse, slide) before `snapPitchRate`/`snapSlide` move.
- [ ] Aim help so hits do not need a perfect line-up: options are a small gun gimbal cone (rounds bend a few degrees toward the boxed target), wider convergence with more spread, or a bigger lead ring. Ethan picks.
- [ ] Ethan's look at the belts per system (grey/plum mix, boulder sizes, pockets, arena size); rock counts rose ~10 %, fps on his machine unmeasured.
- [x] Gate travel: the sim ran through the dial and the arrival fade; now held until the fade ends. *(2026-09-05)*
- [x] Ethan likes cursor steer. Maneuverability picks: strafe thrusters (Q/E) shipped, speed-coupled turn rate shipped as a menu toggle (off by default). *(2026-09-05, Ethan: "let's do one and then two could be a switcher option"; padlock view, target-plane assist, gun gimbal cone and cursor snap stay open below)*
- [ ] Remaining maneuverability ideas, Ethan's call after flying strafe + speed-turn: padlock target view, target-plane assist, gun gimbal cone, cursor snap.
- [x] Space brakes in classic too (drift only via assist off). *(2026-09-05, Ethan: "make space actually work to brake")*
- [x] Barrel roll: camera holds its up, the hull spins on screen. *(2026-09-05, `scripts/barrel-test.mjs` 0° swing; Ethan to fly it)*
- [x] Replay: 7 s before / 3 s after, both cameras parked in the world so speed reads. *(2026-09-05, `scripts/replay-test.mjs`; Ethan to watch one)*
- [x] Ha'tak: guns damage ring guns and shield nodes from the start, shielded-pyramid cue, torpedo reload 14 s. *(2026-09-05, `scripts/chain-test.mjs`)*
- [ ] Ethan flies the Ha'tak again: is the part legibility enough now (marker + line), or do the ring guns and nodes need their own HUD boxes?
- [x] Barrel roll flipped the screen instead of following the roll: camera up taken from the lagged frame, `barrelFollow` 4.5 → 18. *(2026-09-05, `scripts/barrel-test.mjs`; superseded the same night by the roll-hold camera below)*
- [x] Kill replay showed neither the rounds nor the kill: player rounds recorded and re-emitted into a visual tracer pool, both shots framed on ship + kill. *(2026-09-05, `scripts/replay-test.mjs`, `docs/shots/2026-09-05-replay-shotB.png`)*
- [x] Prometheus hull pass 5 (Ethan: "doesn't look that great"): Astra (codex) design lane `prometheus-hull-pass-5-…-aabeef46` owns `ships/prometheus-def.ts` + pass-5 captures; review captures against `docs/shots/prom-pass4-*.png` before landing. Fallbacks if the parametric builder tops out: a hand-written Three.js mesh module, or a Blender glTF through `ships/loader.ts`. *(2026-09-05: pass 5 landed by hand from run commit 595eab1 after the lane's verification failed on a read-path the session had edited; `docs/shots/prom-pass5-*.png`: stepped bridge, split stern blocks with three nozzles each, chamfer band, hangar accent strips. Better, still smallish detail; Ethan to judge)*
- [x] Stargate-themed hub and gate: glyph-address dial UI with an original constellation glyph set and an angular script for titles, a more accurate gate model (inner glyph ring that spins, nine chevrons, kawoosh), glyphs lighting during the dial. Dispatched to an Astra (codex) design lane 2026-09-05; review the diff and captures before landing. *(2026-09-05: landed via `agent integrate`, merge 9631e80; captures in `docs/design/gate-hub-redesign-*.png`; kawoosh and tunnel frames of the new gate not yet seen)*
- [ ] Ethan dials a gate on the new hub: glyph legibility, gate model, kawoosh and tunnel; then a DECISIONS follow-up if the glyph set changes.

### M3 — Fleet & factions
- [x] <!-- workspace:id=work:fbd1c463-3000-5d78-830c-2a559fa5d2a3 --> 3 player hulls, 3 enemy hulls, distinct silhouettes (see GRAPHICS.md silhouette test). *(2026-09-04: enemies glider / interceptor / gunboat; players Facet / F-21 Broadsword / Prometheus; plus the neutral racer. `?hull=` inspects any; silhouettes judged by capture, not yet by Ethan)*
- [x] <!-- workspace:id=work:4f39c478-be65-577d-b085-12e3d36e930e --> Faction materials/palettes. *(2026-09-04 late: `SystemDef.faction` names a PALETTES entry and every enemy hull spawned in that system takes it; goauld default, lucian (oxblood/red, Netu), serpent (steel/teal, Kheb and the Graveyard). `node scripts/kinds-test.mjs system=netu` for a look.)*
- [x] <!-- workspace:id=work:b24057c9-9ff2-5002-a606-e79c2d569ced --> 3+ sky presets, 3+ planet presets. *(2026-09-04: skies abydos/deepSpace/chulak/ember/void, planets desert/ice/lava/jungle/gasGiant/moon; Astra authored the new ones)*
- [x] <!-- workspace:id=work:b0ce8258-8118-50ac-b155-ac1f6e3adaa2 --> Enemy variety: interceptor, gunboat, one capital-scale target. *(2026-09-04: capital `combat/capital.ts`; interceptor + gunboat `combat/enemy-kinds.ts`, used by the missions)*

### M4 — Structure
- [x] <!-- workspace:id=work:ccb23c6e-65b9-507b-a9a3-fe96f5e509a5 --> Hub scene → gate dial UI → transit FX → system → objective → return. *(2026-09-04: `travel/` + `world/systems.ts`; the hub is a DOM overlay rather than a scene, the return is a gate that opens on a win)*
- [x] <!-- workspace:id=work:b43496f3-906d-5db6-9ea7-ceced0195364 --> (2026-09-04, `mission/levels.ts`; clear, run, protect, strike) Mission templates: dogfight, escort, capital strike.
- [x] <!-- workspace:id=work:e90114d4-73ac-502d-bfab-5043ad89afcc --> (2026-09-04, Prometheus unlocks after the Ha'tak strike; `Game.record`) Progression: at least ship unlock.

### M5 — Polish
- [x] <!-- workspace:id=work:b86d77b4-a469-55be-8c6a-b9e9f335ea9e --> (2026-09-05) Astra 3D detail pass: beveled Facet wing panels, trailing-edge plates, nacelle service covers and cooling vents; batch ship outlines. Build passed; inspect/chase visual verification, target-hardware frame-rate benchmark remains unmeasured.
- [x] <!-- workspace:id=work:4a4b65a8-1b9b-5003-aed0-604b95e6f42d --> Audio (engine loop, weapons, UI, music stubs). *(engine, weapons, UI 2026-09-03/04; music stub 2026-09-04 late: a four-voice pad keyed per system whose chord follows the mood (calm / combat / win / lost) plus a combat pulse, win/lose stings, a ring-pass chime and chevron sounds on the dial. All synthesized, still no assets.)*
- [x] <!-- workspace:id=work:1d92fc39-1255-51d0-936b-36bb8c72dc2b --> Menus, settings (sensitivity, invert, quality), keybinds. *(menu + sensitivity + difficulty 2026-09-04; invert Y, quality tier (reloads the sortie) and a Keys panel with click-to-rebind, swap on conflict, defaults, 2026-09-04 night: `core/binds.ts`, `scripts/settings-test.mjs`)*
- [x] <!-- workspace:id=work:209c7577-9da9-598d-b34e-2a868f079b94 --> (2026-09-04, `core/save.ts`: settings + progress in one blob) Save/load (localStorage).
- [x] <!-- workspace:id=work:239b2be7-4508-5066-a3f7-4910c341b86e --> Gamepad support. *(2026-09-04 night: standard mapping polled in `Input.tick`, left stick steers, right stick roll/pull-dive, RT fire, LT missile, A boost, B brake, X/Y scheme/assist, bumpers barrel; dead zone + curve in `T.flight.padDead/padCurve`; HUD hint swaps once a pad speaks. Verified with a fake pad only, no hardware in the loop.)*

## Verification
- [x] (2026-09-05, A48) Make mission-chain smoke require the requested mission, persisted completion increments and declared rewards across navigation/reload; full eight-mission browser run, unknown-id refusal, ten controlled fault cases and build passed. [Evidence](design-chain-verification-20260905.md).

## Non-goals (for now)
Multiplayer, mobile/touch, VR, mod support, story/dialogue system.
