# Changelog

Newest on top. Roadmap items are checked off in `roadmap.md` and recorded here.

## 2026-09-04 (evening) — Three star systems, gate travel home, an enemy roster

Ethan is away until tomorrow and asked for the rest of the plan to keep moving; the 3D pieces here (two enemy hulls, five planet presets, two sky presets) were authored by GPT-6 Astra from written briefs and reviewed by capture. None of it has been flown by a human.
- **Systems** (`world/systems.ts`): a `SystemDef` names the sky, planet preset and position, sun direction and belt (count, seed, radii, thickness). Abydos (desert, orange/violet nebula, 900 rocks), Chulak (jungle world, green nebula, 1000 rocks in a thicker belt), P3X-774 (ice world, deep space, 520 rocks). Every level carries a system id; the World is built from it once per page. `?system=` and `?planet=` override for inspection.
- **Gate travel** (`travel/`): winning a mission opens a return gate 700 m ahead (torus with nine breathing chevrons and a toon-rippled puddle) and makes it the HUD marker; flying through it, or `G` on the end card, dials home. Dialling is a DOM ring of seven chevrons lighting in turn with a tick each (`Travel`), then a fullscreen posterised wormhole shader (`Tunnel`) for 1.7 s, then a reload into the destination with `arrive=1`, which fades the tunnel out over 1.1 s. Launching from the hub goes the same way to the mission's system. Verified headless end to end (`scripts/travel-test.mjs`).
- **Hub** groups missions under their system, "NO GATE ADDRESS YET" until one is unlocked.
- **Enemy roster** (`combat/enemy-kinds.ts`): **interceptor** (Astra hull, 7 m needle, gold trim; hp 22, cruise 175 / dash 250, 2.0 rad/s, 0.6× rounds, flinches 90 % of the time) and **gunboat** (Astra hull, 22 m slab, red bridge, three engines; hp 170, cruise 85 / dash 115, 0.55 rad/s, 2.4× rounds, never saddles or flinches) join the glider. Each kind's numbers are a full table in `T` (`T.interceptor`, `T.gunboat`) so the tuning panel binds them. Waves name their kinds: the last belt-clear wave and the gauntlet chase bring interceptors, the escort's later waves bring gunboats, the Ha'tak launches interceptors first. Headless: all three fly, shoot and die (4 / 2 / 15 cannon hits).
- **Planet presets** `ice`, `lava`, `jungle`, `gasGiant` (banded, ringed), `moon`; **sky presets** `ember`, `void`. Only desert/ice/jungle are used by a system so far.
- Scripts: `scripts/cap.mjs name=query,query` captures; `scripts/kinds-test.mjs`.

## 2026-09-04 (midday) — Gliders dogfight instead of jousting

Ethan: the fight was "stopping and turning around and going straight at the enemy ship, over and over". Two new brain states in `combat/enemies.ts`, existing `T.enemy` numbers untouched:
- **saddle**: a glider inside 340 m that the player is facing refuses the head-on pass and steers, at cruise, for a point 90 m behind and 45 m beside the player on the flank it is already on, until it is on the tail or 4.5 s pass. From the cockpit something is trying to get behind you and you have to break to shake it.
- **flinch**: a glider inside the player's fire cone (8°) closer than 280 m jinks out sideways and up or down before the shot, 70 % of the time, on a 3.2 s cooldown. Evade still fires on a hit.
The player state now carries its nose direction (`PlayerState.fwd`, optional `Target.fwd`); the escort has none, so gliders still joust the escort. Headless measure with an ideal nose-tracking player over 40 s: nose-to-nose passes 22 → 1–6 samples, glider-behind-player samples 3 → 8–14, and 40–60 % of glider time in saddle. Not yet flown by a human.

## 2026-09-04 (midday) — Facet hull is the player fighter

Ethan picked variant A from the gallery. `PLAYER_HULL` in `ships/variants` is the shipped def; `?variant=original` flies the previous loft. Enemy gliders unchanged.

## 2026-09-04 (morning, Ethan's first play) — Kill replay, camera reveal, faster guns, gauntlet as obstacle course

Ethan flew the overnight build: "quite good". Five asks, four landed here, the fifth (the ship's look) is a variant gallery for him to pick from.
- **Kill replay** (`replay/replay.ts`): every sim tick records the ship and up to ten gliders into a 10 s ring buffer; a kill schedules a cut of `[kill − 4.5 s, kill + 1.6 s]`, scored by the stick deflection, speed, boost and a barrel roll in the last 3 s, and the sortie keeps its best. `V` on the end card or REPLAY THE KILL in the pause menu plays it at 0.55× with two shots: a drone parked beside the ship's line a third of the way in, then a close orbit through the kill; bursts replay at their moment. HUD hides except a REPLAY tag; `V`/Esc skip. Sim is paused during playback; gliders' visibility is restored after.
- **Camera reveals the manoeuvre** (`render/camera.ts`, `T.camera.followRate` 7 / `barrelFollow` 4.5 / `barrelFov` 8 / `barrelDistance` 2.5): the camera's attitude now chases the ship's with a lag instead of copying it, so a pull-up or dive shows the ship pitching against the view and a barrel roll spins the hull most of the way round on screen, with an FOV kick and a small pull-back.
- **Cannon** `T.weapons.fireRate` 9 → 13 rounds/s.
- **The Gauntlet rebuilt** (`mission/run.ts`, level data): ten gates 620 m apart (was twelve at 360 m); each gate is placed at the best of fourteen candidate headings, scored by how much rock sits within 240 m while the hoop itself stays clear, so the run threads rock pockets instead of open space; the chain steers back toward the centre near the arena edge. Gates count from **either direction**. Hoops carry four rim pylons so they read edge-on. 120 s window, gliders at gate 4.

## 2026-09-04 (overnight) — Mines, death sequence

- **Prometheus plumes** (`ShipDef.plumeScale`, 3.5 on the Prometheus): plume lengths are fighter metres, so big hulls scale them; six long jets on boost (`docs/shots/2026-09-04-prometheus-boost.png`).
- **Proximity mines** (`mission/mines.ts`): dark faceted shell with a pulsing red core; fly within 24 m (more for a big hull) and it takes 45 hull off you; shoot it or missile it (they lock) and it goes off where it sits, and any glider inside 60 m eats double. The Gauntlet lays two on every gate rim (`minesPerGate`), the Ha'tak sits inside a ring of fourteen (`mines`).
- **Death sequence**: every source of player damage now goes through `Combat.hurt`; at zero hull `Flight.dead` kills the controls, the ship tumbles on its last velocity and throws a small burst every quarter second for 1.6 s, then the big burst hides it and the mission reads lost. Gun and missile muzzle offsets scale with the hull's `size`, so the Prometheus fires from its own bow.

## 2026-09-04 (overnight) — Missions, hub, menu, Prometheus, Ha'tak, new FX

- **Mission framework** (`mission/levels.ts` data, `mission/mission.ts` base + `Waves`, runners `clear.ts` / `run.ts` / `protect.ts` / `strike.ts`, `mission/index.ts` factory): four levels. *Clear the Field* (as before). *The Gauntlet*: 12 glowing gates laid on an S-curve through the belt, 90 s, gliders join at gate 5; the next gate is amber and boxed on the HUD. *Cover the Prometheus*: the Prometheus (600 hull, 26 m/s) crawls toward the gate while two thirds of each wave go for her; her hull is in the mission line; lose her, lose the mission. *Bring Down the Ha'tak*: a capital ship 1.7 km ahead; six ring turrets shoot back (1 km range), shield nodes are hardened until the turrets fall, the hull takes damage once the nodes are gone, staged death, first clear unlocks the Prometheus. Missions register their shootable parts with `Combat.extras` and their protectees with `Combat.friendlies`; lock, missiles, cannon hits and the HUD box all work on the shared `Tracked`/`Lockable` shape. Each glider picks its target from `Enemies.targets` round-robin.
- **Mission select** (`ui/hub.ts`, MISSIONS button): cards with lock chain, best time and completions; ship row with stats; LAUNCH reloads with `?mission=&ship=`. Progress in `core/save.ts` (`Game.record` is the only writer).
- **Start / pause menu** (`ui/menu.ts`): Esc (pointer unlock) pauses the sim and opens it; scheme, flight assist, mouse sensitivity (× `stickGain`), difficulty (`core/difficulty.ts`: easy/normal/hard multipliers on enemy speed, hp, fire rate, damage, spread), mute, restart. Settings persist.
- **Ship stats applied**: `ShipStats` scale speed/agility (Flight), hull/guns/rack (Combat), and a `size` that scales the chase camera and collision radius. Prometheus (`ships/prometheus-def.ts`, BC-303-style slab hull, tower, two stern engine blocks, 6.7k tris): 70 % speed, 45 % agility, 600 hull, 2.2× guns, 16 missiles.
- **Ha'tak** (`combat/capital.ts` + `capital-geo.ts`): pyramid in a ring with lobes, 6 dome turrets, 3 shield nodes, glow window strips, hangar gate; `aimAt`, `damagePart`, staged `die`; 5.9k tris.
- **FX rewrite** (`fx/explosion.ts`, `fx-util.ts`): eight shared instanced meshes for every burst; white pop → shockwave ring → lumpy two-tone fireball → tumbling chunks with ember streaks → toon smoke puffs. `crash(pos, normal, speed)` dust cone + chips, wired to player rock hits (`Combat`) and glider scrapes (`Enemies.onCrash`).
- Captures: `docs/shots/hub-pass1.png`, `menu-pass1-menu.png`, `menu-pass2-prometheus.png`, `mission-pass2-gauntlet.png`, `mission-pass1-hatak-dying.png`, `capital-pass3-*`, `prom-pass4-*`, `fx-pass5-*`.

## 2026-09-04 (overnight) — Lock-on missiles

- `combat/missiles.ts`: RMB launches a homing missile once a glider has sat inside the lock cone (`T.missile.lockCone`, `lockTime` 0.9 s); six per sortie, restocked each wave; proximity fuse; 60 damage (a glider dies to one). HUD box shrinks onto the target as the lock builds, dashed while locking, red + "LOCK" when ready; missile rack shown above the HP bar. Lock tone and launch whoosh.
- `ships/registry.ts`: `?ship=f11|prometheus` picks the player hull; per-hull stats (speed, agility, hull, guns, missiles) scale the shared tunables. Prometheus is a placeholder def until its hull lands.

## 2026-09-04 (overnight) — Momentum, rock damage

- Flight has a real velocity vector: forward component chases the target speed (`accel`, coasts down at `coastDecel` so a released boost carries), lateral component decays at `latDamp` (3.2/s, was an effective 9/s snap), so hard turns slide. X toggles flight assist off: `latDampOff` 0.15/s, speed only from Shift thrust / Space retro (W/S thrust in classic). HUD tag shows ASSIST OFF.
- Rock impacts hurt: damage = ((normal speed − 35) / (150 − 35))² × max hp, for the player and for gliders (which bounce, lose half their speed, and explode when it kills them). Head-on at cruise is fatal; a graze scrapes.

## 2026-09-04 — Feedback round 4 (ship + plumes)

- F-11 pass 3 from Ethan's reference images: slender fuselage, one big thin delta with a straight trailing edge, two round intake nacelles above the wing, wingtip plates, no tail fins (`docs/shots/f302-pass8-*`). 4.0k tris in the top view (pass 2 was 7.5k).
- Plumes: chevron notches removed, cones taper to a point, shorter and narrower (`T.plume`).

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
