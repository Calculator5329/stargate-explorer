# Changelog

## 2026-09-05 (evening) — Cursor steering, raw mouse, assist strength, escort log fix, varied belts

Ethan, 2026-09-05 (feedback chat, screenshot of the escort mission): prefers classic, assist "helps but I don't know if it needs to be quite as strong"; "kind of weird flying with the mouse ... I can't tell if it's because I have mouse acceleration or if I have not high enough sensitivity"; has to line the nose up exactly to hit; the HUD filled with repeated "Prometheus hull 100%"; asteroids should vary ("maybe gray, maybe different colors, maybe different sizes"), and the earlier "more dense" ask meant a bigger map with varied density, not one even fog.

- **Escort log spam fixed** (`mission/protect.ts`): the hull suffix was appended to `line` every sim tick, so a 60 s sortie had the line 3,600 entries long. It is now composed once onto the wave machine's line and recomposed only when that line changes.
- **Cursor steer mode** (`core/scheme.ts` `SteerMode`, `Input.steer`, HUD `.cursor`): the mouse moves an aim cursor on screen; the stick is the cursor's offset (dead zone, power curve, `T.flight.cursor*`). A still mouse holds a turn and the cursor shows where the nose is going. It is the default; the old mouse-speed stick stays as `relative` (menu "Mouse steer", `?steer=`). Sensitivity scales cursor pixels per mouse pixel in cursor mode.
- **Raw mouse input**: pointer lock now asks for `unadjustedMovement`, which bypasses the OS acceleration curve (Chromium; falls back to a plain lock elsewhere). Menu checkbox "Raw mouse", on by default. Every lock call goes through `lockPointer()`.
- **Assist strength** slider (0.2..1, `Scheme.assistStrength`): scales `latDamp` and the soft-horizon `autoLevel` while assist is on. X still toggles assist off entirely.
- **Belts vary per system** (`AsteroidOptions.tints/bigChance/big/small/voids/voidR`, `SystemDef.arena`): each belt mixes tint families (plum, grey, ochre, charcoal, one per base shape), has its own size mix (P3X-774 gets sparse 30..110 m boulders, Tollana small gravel), and `voids` carve empty pockets so density varies. Arenas are per system now (1700..2400 m, Abydos 2000) with the belts' `outer` grown to match; rock counts rose only 5..15 %.
- Save gains `steer`, `rawMouse`, `assistStrength` with defaults, so an existing save picks them up.
- **Gate travel holds the sim** (`Travel.holding`, `main.ts`): Ethan, "it lets me start playing while it's dialing ... the game starts before it should". Through the dial, the tunnel and the arrival fade only the input ticks (the aim cursor can be placed); flight, hazards, rocks and the mission clock wait. Verified in the pane: position and intro timer frozen while `holding`, released when the fade ends.


## 2026-09-05 (03:00) — Destructible asteroids, denser structured belts, mini-map, lethal crashes

Ethan, 2026-09-05 00:xx: "a lot more asteroids and a more interesting map ... a mini-map ... blow apart asteroids ... if enemies go into asteroids, they're destroyed. So if you blow apart an asteroid and it hits an enemy, they're dead." All four landed, verified headless only.

- Every rock is destructible: `Asteroids.damage(gi, amount, dir)`; hull points scale with radius (`T.rocks.hpPerMetre` 6, so a 5 m chip dies to two rounds, a 40 m boulder wants a missile). A broken rock bursts and spawns 2..6 fragments (`T.rocks.frag*`) from spare instance slots at the end of each shape's pool: they fly on with the shot, tumble fast, collide like rocks, and shrink away after ~7 s. Player cannon and missiles break rocks; enemy rounds only spark.
- Enemies that hit a rock harder than `T.rocks.crashKill` (8 m/s, relative to the rock, so a flying fragment counts) are destroyed. A fragment of a rock the player broke credits the kill to the player (`Enemy.crashCredit`). Soft scrapes still bounce.
- Belts roughly doubled (900..2300 rocks per system) with a layout: `clusters` (dense knots) and `band` (a ring at a radius) take a share of the rocks, the rest scatter. Chulak and Kheb have a ring band, Tollana's race circuit is a band, Abydos/Netu/P3X-774/Graveyard have knots.
- HUD mini-map (`ui/minimap.ts`, bottom right, 180 px): heading-up top-down view, 900 m range, rocks as dots sized by radius and faded by height difference, fragments amber, enemies red, marker/gate gold, arena edge ring.
- `Asteroids` now stores per-instance position/quaternion/scale arrays and composes matrices (no per-tick decompose); dead slots park at y=1e6 with radius 0 so every sphere consumer skips them.
- Rock breaks have their own sound (`Audio.crunch`: a low crack, a gravel rattle, sized by radius) instead of the ship explosion, and every end card lists `rocks broken N` when any were (`Mission.rocksLine`, also on the run and race cards).
- `scripts/rock-test.mjs`: breaks a rock under fire, flings a glider into a boulder, plants one in a fragment's path; all three pass. `chain-test.mjs` still passes all eight missions. Sim at ~1.1..1.7 ms in the headless captures. Captures: `shots/2026-09-05-minimap-chulak-band.png`, `shots/2026-09-05-kheb-dense.png`.

## 2026-09-05 — Fighter detail and outline batching

- Facet now has modeled beveled wing panels, separate trailing-edge plates, nacelle covers and cooling vents, retaining Ethan's selected gray silhouette.
- Ship outlines are merged after per-part normal generation: the detailed fighter's top inspect view fell from 84 to 35 draw calls in the local browser; this is not an FPS benchmark.
- Browser geometry check passed for all eight registered hulls: finite vertex/normal attributes, exactly one outline mesh each, zero page errors.
- `npm run build` passes with the existing large-chunk warning (721.38 kB JS, 199.42 kB gzip). Visual evidence: `shots/2026-09-05-final-{side,rear,top,chase}.png`. No flight, balance, mission or save changes.


Newest on top. Roadmap items are checked off in `roadmap.md` and recorded here.

## 2026-09-04 (late) — Settings, keybinds, gamepad, ice, wrecks, music

- **Factions:** a system can name a faction palette (`SystemDef.faction`, `ships/palettes.ts`) and every enemy hull spawned there is recoloured, plumes included. Netu flies oxblood-and-red (lucian); Kheb and the Graveyard fly cold steel with teal glow (serpent); everyone else keeps the bronze default.
- **Chain test** (`scripts/chain-test.mjs`): every mission driven to its end card headless in one browser context, then the save's completions and unlocks checked. All eight pass; heavy and Prometheus unlock.
- **Derelict fields:** third belt style, `wreck`. Astra authored four torn warship pieces (`world/derelict-geo.ts`: hull spine, broken wing, engine block, turret chunk) as merged low-poly primitives; they go through the same instanced rock pipeline (toon material, outline shell, crease lines, tumble). Concave shapes collide against their convex hull (`ConvexGeometry` planes) rather than their own facets, which would have left buried faces shrinking the collision volume. **THE GRAVEYARD** is the seventh system (deep-space sky, a far ringed giant, 420 wreck pieces) and **AMBUSH IN THE GRAVEYARD** its mission: three interceptor-heavy waves with a gunboat in the last, unlocked by the shard run. Flying the fighter straight into the largest wreck bounces it at the hull surface (headless check).

- **Music stub** (`audio/audio.ts`): a four-voice triangle pad under a slow-moving lowpass, keyed per star system (the system id hashes to a root between F2 and C3), whose chord glides with the mission mood: calm (open fifths), combat (a sus2 plus a gated low pulse at ~100 bpm), win (major, brighter), lost (minor, low and dark). `Game` sets the mood from live enemies; `win()`/`fail()` set it and play a sting (rising arpeggio / two falling saws). Ring passes get their own chime instead of the lock beep; the gate dial clicks up a step per chevron and thuds on the seventh.

- **Ice fields:** `Asteroids` takes a `style`. `ice` is long chisel-tipped shards in pale blue-green with a cold teal shadow side, more tumble, fewer giants. Every belt shape now carries its own bounding radius (`bounds`), so collision derives the instance scale from it instead of the hard 1.05 rock constant; shards collide against their real faces.
- **KHEB:** sixth system. Dead grey moon (the `moon` preset finally has a home), a new `frost` sky, a thick ice belt. **THE SHARD RUN** is its mission: twelve tight gates, no mines, no escorts, unlocked by the ring race.

- **Menu:** invert Y (push to dive), a quality tier selector (low/med/high, restarts the sortie because the renderer is built once per page; `?quality=` on the URL still wins for that page), and a Keys panel. Click a key, press the new one; a key another action holds swaps into the old slot; DEFAULTS restores WASD. Bindings live in the save (`core/binds.ts`, `Settings.binds`) and the HUD hint is generated from them, so a rebound key shows up in the legend.
- **Gamepad:** standard mapping polled in `Input.tick`. Left stick steers (dead zone and curve in `T.flight.padDead/padCurve`), right stick rolls and pulls/dives, RT fires, LT launches the missile, A boosts, B brakes, X/Y switch scheme/assist, bumpers barrel roll. The HUD hint switches to the pad legend once a pad produces input. Verified against a fake pad in `scripts/settings-test.mjs`; nobody has flown it with hardware yet.

## 2026-09-04 (night) — The ring race, two more systems, a heavy fighter

- **THE TOLLAN RING** (`mission/race.ts`, type `race`): the gauntlet's gate chain with four AI racers in it. They hold a grid beside you through the intro, then fly their own lane through each hoop with glider-style rock avoidance, a fixed skill spread (±8 %) and a rubber band (pressing when behind, easing two gates ahead). Any finish completes the mission; the card is your place ("2ND ACROSS THE LINE", who beat you) and the clock is the best-time record. Racer hull by Astra (`ships/racer-def.ts`: off-white pod-racer pair of outrigger engines, teal trim, race number 27). Headless: racers pass gates and the player's finish places correctly (`scripts/race-test.mjs`).
- **BREAK THE BLOCKADE**: a gunboat-heavy clear mission (one, two, then three gunboats with interceptor screens) in Netu. Clearing it unlocks the heavy fighter.
- **Systems** Tollana (ringed gas giant, void sky, thin belt) and Netu (lava moon, ember sky). Five systems now.
- **F-21 Broadsword** (`ships/heavy-def.ts`, Astra): the third player hull. Broad chined body, tandem canopy, cropped drooping wings, four engines in stacked pairs, canted fins. Stats: 0.88 speed, 0.7 agility, 2.2 hull, 1.6 guns, ten missiles, 1.35 size.
- Void sky: the milky-way band's edge is a smoothstep and the band is wider; it was a hard cyan stripe across the screen.
- `Mission.render(dt, alpha)` carries the sim interpolation so racers move as smoothly as gliders.

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
