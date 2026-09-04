# Changelog

Newest on top. Roadmap items are checked off in `roadmap.md` and recorded here.

## 2026-09-04 (overnight) — Mines, death sequence

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
