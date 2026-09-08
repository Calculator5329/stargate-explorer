# Changelog

## 2026-09-08 — Cemented flight profile, rebuilt settings menu, powered stunts

Classic throttle, cursor steering, raw mouse and flight assist at 0.9 are now fixed (`FLIGHT_PROFILE` in `core/save.ts`, applied over any old save); the C/X keys, the gamepad X/Y buttons and the `?controls=`/`?steer=` switches are retired. Sensitivity, invert Y (a switch, off by default), speed-coupled turning, difficulty, quality, dynamic resolution, event lighting, mute and the key table stay adjustable. The pause menu is rebuilt in `ui/menu.css`: profile strip, piloting and presentation columns, custom switches, the key table behind a REMAP disclosure, and it fits a 900 px window. The four B-chord moves are now staged stunts (cobra reversal, vortex drive, sidewinder left/right) with slide, lift and coast steps, an entry-attitude camera hold and two short ribbons; every amount is a guess until Ethan flies them. Gates: `scripts/settings-test.mjs`, `sandbox-controls-check.mjs`, `powered-moves-check.mjs`, plus fight, travel, rock and chain. Recovered from the lane's uncommitted tree and finished; see [evidence](evidence/2026-09-08-powered-stunts.md).

## 2026-09-08 — Mid-fight stutters removed

Every shader program a sortie can show is now linked and drawn once before play (`render/warmup.ts`: `compileAsync`, then one hidden frame into a 4x4 target with every object shown and the light groups untouched), and the level's enemy hulls are built before the first frame (`Enemies.prewarm`). The stutters Ethan saw at every tier were driver shader links on the first explosion, tracer, fragment, flare and gate frame, 50 to 130 ms each. Tracers, missiles, rock fragments, the escort and the HUD target box are now interpolated at render rate, so a 240 Hz display no longer shows them stepping at 60 Hz; the minimap redraws at 30 Hz and the audio and sandbox guide skip unchanged frames. Uncapped on the RTX 5070 Ti the worst frame in a 25 s blockade fight fell from 105 to 121 ms to 5.6 (low), 9.0 (med) and 18.0 ms (high), with no frame over 25 ms. New probe: `scripts/stutter-probe.mjs`. Readings in [evidence](evidence/2026-09-perf.md).

## 2026-09-08 — Sandbox move practice

Added direct SANDBOX entry from pause/gate control, saved one-key bindings for all four moves (defaults 1–4), and a practice guide that follows custom keys and shows the running move. Existing B chords remain available. Sandbox hull damage is disabled and the boost bar refills between moves; normal sorties retain costs/damage. Fixed the speed-coupled-turn checkbox persistence and made expanded settings scroll within the viewport. Build, focused simulation checks and browser controls verification pass; see [evidence](evidence/2026-09-08-sandbox-controls.md).

## 2026-09-08 — Replay motion repair approved

Replaced pair-locked camera translation with world-space fly-by framing, made follow-through actually play, labelled snapshot actions Freeze, and simulated the evaluation formation continuously. Removed approved gate-trip evaluation controls. Build and actual-control CPU checks pass; Ethan reviewed the repaired preview and approved push/deployment. Explosion animation refinement remains open. See `evidence/2026-09-08-replay-repair.md`.


## 2026-09-08 — Multi-kill replay and player follow-through

Replay now captures up to three recent kills within eight seconds by default, with N/X controls in evaluation. Both ships fit the kill camera in landscape and portrait, each kill receives slow motion, and the ending follows the player. Expanded bounded history preserves the full sequence plus three seconds after the latest kill. Gate travel retains Ethan’s approved behavior. Build and extended replay checks pass; paired-shot/follow-through captures are in `docs/shots/2026-09-08-replay-{pair,follow}.png`.


## 2026-09-08 — Coherent travel, destruction and replay

Gate travel now holds gameplay and switches audio scenes through dial, opening, entry, tunnel and destination reveal. Replay owns seeded debris and tracers, aligns the kill with recorded disappearance, and frames the moving breakup. Added structural fragments, layered clouds/atmosphere and warped continents, quieter sky detail, ribbed wreck sections and convex ice prisms. Event lighting is saved and off by default. `?review=1` provides explicitly scripted freeze/play controls. [Verification and captures](evidence/2026-09-08-graphics-scenes.md).

## 2026-09-06 — Reviewed fleet integrated into main

Preserved existing designer evidence in a separate commit, retained both sides of documentation additions, and merged the selected procedural fleet through supported lane close. Blender remains separate. Combined build, fleet, moves and editor verification passed; original Al’kesh and historical art switches remain available.

## 2026-09-06 — Isolated Blender death-glider benchmark

Authored an editable Blender glider and five-material GLB with engine/muzzle attachment nodes. Added a separate Three.js inspector and self-contained comparison against original/preferred procedural gliders, with game-toon and metallic treatments. Verified exported axes, all views, live orbit and review controls. No fleet, ShipRig, combat or save changes. [Evidence](design/blender-glider/README.md).

## 2026-09-06 — Owner-directed SG-1 variants

Recorded Ethan’s twelve first-pass choices and explicit choice to keep gameplay roles with SG-1-derived variants. Broadsword/Dart now derive from F-302, Lancer/Racer from X-301, Interceptor from death glider, Gunboat from Al’kesh. Added rear/underside Al’kesh and licensed-model Prometheus reference photographs. Rebuilt Prometheus with a long forebody and aft bridge/pods, and Ha’tak with an angular outer structure and pyramid panel courses. Al’kesh original remains the default; the new candidate is opt-in. Original and first-pass models remain available. Updated the comparison and separated previous owner feedback from new candidate choices. Build, browser review, art-selection preservation and Ha’tak combat probes passed. Target-hardware performance remains unmeasured.

## 2026-09-06 — Reversible SG-1 fleet graphics

Refined the fighter, glider, bomber and Prometheus against SG-1 references; added construction details and quieter materials to six original hulls. The ace inherits the new glider. Every previous definition remains intact, selectable with `?art=original` or an `old-` inspect key. Added the offline `/fleet-review.html` comparison with six paired views, source stills and browser-local review notes. Ha’tak gains a darker outer structure around the gold pyramid; its geometry is retained. [Evidence](design/sg1-fleet/README.md).
## 2026-09-06: Moves, the boost bar pays, a chord triggers, the designer composes, a proving ground to try them

Ethan answered the move-composer packet (all seven calls on the recommended option) with two notes: "some type of sandbox mode where I can test all these different moves out" and "it doesn't necessarily just need to be the B key. It could be other keys as well for different types of moves". Both are in.

- **A move is a list of primitive steps** (`src/sim/moves.ts`, table in `src/content/moves.json`): brake, boost, snapPitch, yaw, roll, hop, each with a start, a length and an amount on the move's timeline. `Flight.tick` plays them: the stick, the roll keys and Shift are dead for the duration, boost steps lift the speed cap to their target without draining the bar, brake steps decelerate at `T.flight.moveDecel` (400 m/s²) and boost steps accelerate at `moveAccel` (800 m/s²), sharper than the keys.
- **The boost bar pays.** A move costs a fraction of the bar (Cobra 35%, Lunge 25%, Scissors 30%) and refuses to fire below it. The running move's name sits on the bar as a chip.
- **Chord trigger, per-move keys.** `Input` arms on any key in `moveKeys` (every trigger key in the table, so a second family can sit on F or T), takes a direction from the pull-up / dive / roll binds inside the 260 ms window, or fires the plain move when the window closes; a direction tap inside the window is the move's, not a roll or a pull. The four starters: B Cobra (brake, nose up 77°, nose down, short burst), B+W Lunge (to 560 m/s with a dip), B+A / B+D Scissor (half roll, sideways slide, yaw, roll back).
- **Camera** treats a move like the barrel roll: follows the nose only, FOV +8, pull-back 2.5 m.
- **Proving ground** (`type: "sandbox"`, `src/mission/sandbox.ts`, level `proving-ground` in act 1): no enemies, no clock, no win; the HUD line lists every chord and names the move running; missiles restock so the guns can be tried too.
- **MOVES tab** in the designer (`src/editor/moves.ts`): a shelf of moves, the selected one as name / trigger key / direction / cost / duration rows, a timeline of the steps and one card per step with kind and three number fields; NEW, DUPLICATE, DELETE, ADD STEP; UNDO and SAVE cover moves like levels (`Content` now carries both files and posts each). TRY IT makes the working table live without saving and fires the move where the ship is; PROVING GROUND ▸ flies the sandbox level.
- Gates: `node scripts/move-test.mjs` (sandbox lists the chords, B+W Lunge pays 25% and reaches 560 m/s with the chip on and the FOV kicked, B alone fires the Cobra at ~270 ms with the nose to vertical and speed down to 72, B+A rolls the hull, an empty bar refuses) and `node scripts/editor-test.mjs` (MOVES tab: shelf, cards and bars per step, a step edit, UNDO, TRY IT fires the working copy in the game). Shots: `docs/shots/2026-09-06-designer-moves.png`, `2026-09-06-proving-ground.png`.

## 2026-09-06 — The game designer: campaign board, encounter composer, campaign in JSON

Ethan, 2026-09-06: plan the levels, unlocks and power properly instead of "randomly did a bunch of levels", and build a game builder alongside the game so he can arrange prebuilt pieces in a UI. Agreed priorities: campaign board, encounter composer, then the move composer, then stat sheets; in-game mode with files as the store.

- **Campaign in data.** `src/content/campaign.json` holds three acts and all seventeen levels; `mission/levels.ts` imports it (`resolveJsonModule`), keeps the `LevelDef` union as the contract and runs `checkLevels` in dev (duplicate ids, dangling requires, requires cycles). `LevelDef` gained `act` and `board` (the card's spot).
- **Content store.** `vite.config.ts` adds a dev-only `POST /__content/save` that writes pretty JSON under `src/content/`; anything else is refused with a 400. Vite's reload then runs the new campaign.
- **`?edit=1` opens the designer** (`src/editor/`, code-split so the game never loads it otherwise): board on the left (draggable cards, requires arrows, act bands, threat pills, the power curve), inspector on the right (type with templates, chain, every field the type declares in `schema.ts`, wave rows with enemy-kind chips, power readout, duplicate / delete / new / undo / save / FLY IT). The sim holds while the overlay is up; FLY IT locks the pointer and releasing it brings the designer back; flying a different level saves and reloads with `fly=1`.
- **Power model** (`editor/power.ts`): threat (hull lost over the level as a fraction of the hull the chain has handed over by then), clear time and clock pressure per level type, from `T`, the difficulty preset and the ship stats. Three feel constants at the top; a paper estimate until a headless fight calibrates it.
- **Draft arc:** FIRST FLIGHT (Abydos and Tollana: guns, missiles, the chain, one duel), THE FLEET (escorts, blockades, the hangar filling up), MOTHERSHIPS (two Ha'taks). The chain is unchanged; only acts and positions are new.
- **Second pass on Ethan's first look** ("the back panel is see-through ... the right side panel is a little confusing ... simpler and better explained"): opaque backdrop with the HUD, dial and hub hidden while the designer is up; the inspector reordered into WHAT IT IS, WHERE, PLACE IN THE CAMPAIGN, THE FIGHT, STORY, HOW HARD, each opening with a one-line explanation; a plain sentence per level type (`schema.ts` `TYPE_HELP`); waves as cards with labelled boxes and a resolved mix line ("1 gunboat, 3 gliders"); a HOW THIS WORKS tab; the threat readout says comfortable / a real fight / lethal.
- **Third pass** (Ethan picked the wave packs and the wizard, and asked for UI refinements; the playtest ledger is dropped because the difficulty measure is unproven and would be tuned on one player): `editor/packs.ts` holds seven prebuilt wave packs (glider swarm, interceptor sweep, gunboat wall, ace pair, bomber run, mixed pressure, finale) shown as a shelf under the wave list with their resolved mix; `editor/wizard.ts` replaces the bare template with four choices (kind with its sentence, opening pack, system with its blurb, the level it follows) and a title; TIDY lays every act out as a tree; clicking empty board deselects; the curve rows show the type; the save status carries the time.
- **Refinements** (Ethan's "also just UI UX refinements", all three candidates): the board is a viewport (drag empty space to pan, wheel zooms about the cursor, a zoom bar with FIT; the first render fits the whole campaign); hovering a card shows a FLY tag that runs the level without opening the inspector; the STORY section ends with the level as the player sees it, the hub card with its old-script title and the HUD line with the intro. editor-test covers zoom, pan-without-deselect, FIT, the hover tag and the preview. Screenshot: `docs/shots/2026-09-06-designer-viewport.png`.
- Gate: `node scripts/editor-test.mjs` (17 cards, 16 edges, 3 bands, sim held, wave edit moves the threat, undo, drag between bands, type template, new and delete, save to a scratch file and the path fence, sim runs again once hidden). Capture `docs/shots/2026-09-06-designer-board.png`.

## 2026-09-06 — Feedback round 6: in-page gate travel, Prometheus pass 6, Ha'tak fixed, replays that show the kill

Ethan, 2026-09-06: transitions sound bad and HUD text shows in the wormhole; the Prometheus should look like the real one (four reference images); interceptors too hard, gunboats too easy, the Ha'tak's three nodes impossible; a more discreet settings menu; replays that show everything including asteroid kills, with good angles.

- **Gate travel stays on the page.** The reload at the end of the tunnel is gone: at 0.6 s into the tunnel (fully covered) `main.ts` tears down the sortie (world, rig, mission, combat, gate, tracers, all disposed through `render/dispose.ts`) and builds the destination in place, then rewrites the URL with `history.replaceState`. The AudioContext, the pointer lock and the settings survive, so there is no silence and no click-to-resume at the far end. The reload path remains only for a page opened with `?arrive=1`.
- **No text in the wormhole.** `#hud.travel` hides every HUD layer for the whole trip (the old rule only held while the dial overlay was up, which is removed half a second into the tunnel). The start screen is shown once, until the first FLY (`Settings.onboarded`); after that the game loads straight into the sortie and Esc toggles the menu.
- **Transition sound.** Engine ducked through the trip, a kawoosh burst at the tunnel, a wormhole sweep (noise through a lowpass sweeping 180 → 2600 → 320 Hz over a sub sine, two shimmers) that runs into the arrival fade, chevron blips softened. The missile launch sound is no longer reused for the gate.
- **Prometheus pass 6** from the reference images, described in `docs/refs/prometheus-references-2026-09-06.md`: one long flat box hull, two open hangar boxes on the bow flanks with their mouths forward, a low raised deck with a stepped command tower and antenna masts just aft of centre, dark greeble strips along every flank, a full-beam stern wall with four rectangular exhausts, one gunmetal grey. Captures `docs/shots/2026-09-06-hull-prometheus-*.png` against the `-before-` set.
- **Ha'tak nodes were unkillable** because they sat inside the pyramid's 91 m collision sphere and rounds died on the "shielded" hull first. `Capital` now has a solid hit shape (pyramid with an inverted underside and the ring band): `hitBy` for segments, `contains` and `pushOut` for the player, and `Lockable.hits` lets any target supply an exact hit test that `combat.ts` uses for rounds and missiles. `scripts/hatak-probe.mjs` is the gate.
- **Balance** (`core/tunables.ts`, guesses until flown): interceptor hp 20, cruise 158, dash 218, wider flinch and slower fire; gunboat hp 260, tighter fire cone, faster cadence, damage 3.0; bomber hp 320.
- **Replays.** Enemies are recorded by id in 16 slots (the old list-index slots lost anything spawned after the tenth), rock breaks are recorded and replayed as bursts, both cameras park at the first candidate spot outside every rock with a sight line to the kill and the ship (`Replay.park`), shot A looks a little ahead of the ship so the victim is in the picture, shot B settles between the ship and the wreck after the kill instead of on the ship alone. `Replay.progress` exposes the clip position for the test.
- **Perf-pass cleanups landed with this**: `Flight.reset`, `ChaseCamera.reset`, `Hud.reset`, `World.dispose` and friends exist for the swap; `scripts/travel-test.mjs` honours `STARGATE_TEST_URL`.
- **Gates run**: travel-test, chain-test 17/17, replay-test, rock-test, pursuit-probe, perf-probe, hatak-probe, `npm run build` (the standing three chunk warning only). Nothing flown by a human yet.

## 2026-09-06 — Performance pass and the Shift cursor jitter

Ethan, 2026-09-06: "in-depth performance pass, improving performance and FPS across modes and hardware and different devices", and "the cursor that I use, it gets jittery, sometimes when I'm holding shift".

- **Measured first.** On the RTX 5070 Ti every tier sits on vsync at 60 fps with about 1 ms of GPU time, so the local machine cannot show a bottleneck. SwiftShader at 720p (the weak-device proxy) put the cost order at: 4x MSAA on the HalfFloat target, then bloom, then the belt drawn unculled (331k triangles), then the procedural sky and planet shaders. Readings in `docs/evidence/2026-09-perf.md`.
- **Sky and planet are baked.** The procedural skybox renders once into a cube map (`WebGLCubeRenderTarget`, 512 on low, 1024 above) and the planet's fbm surface once into an equirect albedo texture; both are re-baked only when their inputs change. The per-frame cost of five-octave noise per pixel is gone. `scripts/bake-compare.mjs before|after` captures the same two views for a pixel compare; the after captures match.
- **Belt culling.** `Asteroids.cull(camera)` packs the alive rocks inside the frustum into the front of each shape's instance buffer, sets `count`/`instanceCount` on the body, shell and crease lines, and uploads only that range. Chase view on Abydos: 511 of 2202 instances drawn. The sim arrays keep their fixed layout, so collision, damage and fragments are unchanged (rock-test is the gate). Rock tumble no longer allocates per tick.
- **Tiers re-cut.** Medium drops from 4x to 2x MSAA; low has none. Each tier caps the pixel count (2.1 / 3.7 / 8.3 megapixels) as well as the device pixel ratio, so a 4K display at "high" does not render 33 million samples. The canvas no longer asks for its own antialiasing (the composer target carries the MSAA; the canvas one was wasted). Menu labels say what each tier costs.
- **Dynamic resolution** (`Renderer.adapt`, a setting, default on): every 1.5 s, under 50 fps the render scale drops 15 % (floor 55 %); after 6 s at 58 fps or better it climbs 10 %. The perf overlay shows `res N%` while it is below full. Off returns to the tier's full resolution at once.
- **GPU timer in the overlay** (`gpu X ms`) from `EXT_disjoint_timer_query_webgl2` when the browser exposes it; SwiftShader and Chromium on Linux do.
- **Cursor jitter under Shift.** Two causes, both fixed: the aim cursor was integrated once per sim tick (60 Hz) from accumulated mouse deltas, so on a 144 Hz mouse and display it stepped; it now moves in the mousemove handler and the tick only applies the return decay. And the boost rumble was per-frame `Math.random()` on the camera position, which under a still cursor read as the cursor shaking; it is now a sum of sines at three frequencies, so it hums instead of stutters. Hit shake stays random (it should read as a jolt).
- **HUD** style writes (scheme fade, hit flash, boost bar, cursor transform) are change-gated; a same-value style write still costs a style recalc on some browsers.
- **Tests**: `scripts/perf-probe.mjs` (cursor at event rate, relative mode unchanged, dynamic resolution steps, belt culls) is the gate for this batch; `rock-test.mjs` and `replay-test.mjs` now honour `STARGATE_TEST_URL` like the others.

## 2026-09-06 — Duel, hunt and intercept; scripted enemy steering; no native scrollbars

Ethan, 2026-09-06 (chat, on the brainstorm): duel "super good idea and pretty cheap, more of a free play mode"; hunt "really good idea"; intercept "okay, but it's less interesting ... since they're free, I would say go ahead"; "lets never have these scrollbars in this game, totally takes you out of it".

- **Three mission types, 6 → 9; missions 14 → 17.** THE DUEL (Tollana, `beltScale` 0.06 so the belt is a handful of reference rocks; one foe spawned 900 m ahead nose-on per round, first to three, hull and rack restored between rounds, `?foe=glider|interceptor|gunboat|bomber|ace` overrides the kind). RUN IT DOWN (Chulak, an ace flies the nine-gate chain at 168 m/s and escapes through the last gate; inside 260 m it turns and fights for seven seconds, then runs again; catching it is boost management). THE BOMBER LINE (P3X-774, bombers spawn ahead and fly a straight line to a glowing relay 1300 m behind the start with gliders and interceptors riding along; a bomber at the relay is a leak, uncredited; three leaks lose the relay, two and a half minutes wins).
- **Scripted steering on enemies** (`Enemy.steer`, `Enemy.steerSpeed`): a mission can hand any enemy a direction and a speed; the brain and the guns switch off while it is set, rock avoidance stays on and looks further ahead in proportion to the scripted speed (the ace's 80 m avoid distance is half a second at running speed). Quarry and runners are ordinary enemies otherwise: guns, missiles, replays, rock crashes and kill credit all apply.
- **Scrollbars**: thin gold thumb on a transparent track everywhere (`scrollbar-width: thin` plus the WebKit pseudo-elements), `scrollbar-gutter: stable` on the hub panel, a `.scroll-fade` mask utility. The "ancient scroll" treatment Ethan asked for is a roadmap item with a design lane.
- **Tests**: `scripts/chain-test.mjs` covers all 17 (the clock jump now applies to intercept as well as hold); new `scripts/pursuit-probe.mjs` asserts the quarry runs the chain unaided, turns to fight when the player closes, that runners close on the relay with escorts, that a runner at the relay counts one leak and the mission continues, and that `?foe=` takes.
- **Rulings recorded** (roadmap "Later" section, brainstorm doc): combo maneuvers on B+W/A/D from boost energy, loadouts then custom ships, first-person foot mode with gate-walking as part of the game, boarding, planet surfaces, bases with upgraders and planet-to-planet gates. Scope guard on record: no drift toward No Man's Sky.

## 2026-09-05 (late night) — Six missions, three ships, two enemy kinds, a hold mission type, and a brainstorm

Ethan, 2026-09-05: "Add more missions ships, and start brainstorming on new types of missions and playstyles".

- **Missions 8 → 14.** RACE THROUGH THE WRECKS (race, Graveyard, six rivals, ten gates), THE DESCENT (run, P3X-774, fourteen gates, three mines a rim, aces join at gate five), THE ACES OF CHULAK (clear, aces; unlocks the captured glider), BRING THE TENDER HOME (protect, Netu, a captured gunboat hull in Tau'ri grey as the escort, bombers hunting it; unlocks the Lancer), HOLD THE GATE (new type, Abydos, three minutes against growing groups with a missile restock every 30 s; unlocks the Dart), THE SECOND MOTHERSHIP (strike, Tollana, aces on the ring, bombers on reinforcement, 22 mines).
- **Hold mission type** (`mission/hold.ts`, `HoldLevel`): groups on an interval that grow per minute of clock, capped alive count, kinds cycled across spawns so the heavy end of the list arrives late, win when the clock runs out. Chain test drives it by jumping the clock.
- **Escort is data**: `ProtectLevel.escortHull/escortName/escortPalette/escortRadius`; the runner and its HUD lines take the name from the level. The Prometheus escort is unchanged.
- **Ships 3 → 6.** F-19 Dart (`ships/dart-def.ts`: light interceptor, speed 1.25, agility 1.3, hull 0.55, two missiles), F-24 Lancer (`ships/lancer-def.ts`: torpedo boat, eighteen missiles, light guns, two long tubes under the wings), captured Glider (the enemy def as a registry entry, no missiles). Hangar lock text now names the mission that hands a hull over instead of always saying "bring down the Ha'tak".
- **Enemy kinds 3 → 5.** Bomber (`combat/bomber-def.ts`, `T.bomber`: 260 hp, slow, 3.6× damage, never dogfights) and Ace (`T.ace`: glider hull with gold trim, faster, tougher, flinches 95 % of the time, saddles long). `?hull=dart|lancer|bomber|ace` inspects them; first captures in `docs/shots/2026-09-06-hull-*.png` via the new `scripts/hull-shots.mjs`.
- **Brainstorm**: `docs/design/missions-and-playstyles-brainstorm.md`: seventeen mission and playstyle ideas in three cost bands, four ship ideas, three different first-pick bets for Ethan.

## 2026-09-05 (night) — Replay of the last kill on V, victim in frame, crash kills credited, first hosting deploy

Ethan, 2026-09-05 (feedback chat, fifth round): "deploy all and make sure ... the replays are actually showing the enemy ship, getting blown up and everything and then allow you to press v at any point at least for now to show the last kill as a replay ... it should be counted as one of your own kills if an enemy hits it into an asteroid and kills itself".

- **V at any time replays the last kill** (`Game` keydown → `Replay.cutNow()` + `play()`): the sim already holds while a replay runs, so the fight pauses and resumes where it was; V or Esc skips out. The clip is always the most recent kill (the best-score gate is gone), so what you just did is what you watch. HUD hint carries `V last kill`.
- **The victim stays in frame**: the second camera parks 40 m past the kill point along the ship's heading, 20 m to starboard, and looks back down the approach, so the enemy flies toward the lens and blows up 40 m away instead of passing behind it. The first camera looks at the ship again (a lerp toward a far kill lost the ship at 24 m). `scripts/replay-test.mjs` now asserts the victim and the kill point on screen just before the burst and drives a mid-sortie V.
- **A rock kill is your kill**: every enemy that dies on an asteroid, belt rock or flung fragment, credits the player (`Combat` passes `byPlayer` for all crashes, so it also cuts a replay). `scripts/rock-test.mjs` flipped its belt-rock assertion from "no credit" to "credited".
- **Deploy**: `firebase deploy --only hosting:stargate` from `dist/` to https://stargate-explorer-5329.web.app, on Ethan's instruction in the feedback chat; `.firebase/` cache ignored. Working title and place names are still franchise terms (see CLAUDE.md IP note); this is a private playtest URL, not a publication.

## 2026-09-05 (late) — Strafe thrusters, speed-coupled turn toggle, Space brakes, roll-hold camera, replay from the ground, Ha'tak guns bite

Ethan, 2026-09-05 (feedback chat, fourth round): "For maneuverability ideas, let's do one and then two could be a switcher option"; "barrel roll camera should stay and I should see my ship spin instead of the whole camera spinning. steer feels really good now. make space actually work to brake"; replays "don't seem to show movement + kill just right yet. more time before + a little after the kill ... it looked like I was a stationary ship moving a tiny bit to the right and left"; "the top 3 things on the hatak ship if I hit with my normal guns it does nothing same for hitting the rest of the hatak ship ... out of torpedos (maybe a slow slow reload)".

- **Strafe thrusters** (`Q`/`E`, rebindable `strafeLeft`/`strafeRight`, `Input.strafe`, `Flight.strafeV`): the sideways velocity component is driven to `T.flight.strafeSpeed` (70 m/s, × hull agility) at `strafeAccel` and eased back when released; the ship banks a little into the strafe (`strafeBank`). Keyboard only for now; no pad binding.
- **Speed-coupled turn rate** (menu checkbox "Speed-coupled turn rate", save `speedTurn`, `Scheme.speedTurn`, default off): pitch and yaw rates scale from `turnSlowGain` 1.35 at min speed to `turnFastGain` 0.6 at boost speed. Off, the ship turns as before.
- **Space brakes in both schemes** (`sim/flight.ts`): classic Space used to free the nose ("drift") and bleed speed; it now brakes toward `brakeSpeed` at `brakeDecel` like arcade, and releasing it returns to the throttle speed. Drift lives on flight assist off (`X`) only. Bind label, HUD hint, menu text and the scheme doc say "brake"; `Flight.drifting` stays false.
- **Barrel roll: the camera holds its up** (`render/camera.ts`): while a barrel roll runs the camera frame follows only the nose (a look-rotation from the ship's forward and the frame's own up) at `barrelFollow` (now 9, a follow rate again), so the hull spins in front of a steady horizon. A full roll ends at the starting roll angle, so normal following resumes without a snap. `scripts/barrel-test.mjs` now reads 0° of camera-up swing through a roll (was 343°).
- **Replay from the ground** (`replay/replay.ts`): window 7 s before / 3 s after the kill (was 4.5 / 1.6; ring kept 12 s), playback at 0.7× with 0.3× inside ±0.45 s of the kill. Both cameras are parked in the world and track the ship: A beside the path a third of the way in, B beside the kill point on the ship's starboard side (`Highlight.killT/killSide`), so the ship comes at the lens, the kill goes off close and the ship passes and recedes. Nothing is attached to the ship any more. `scripts/replay-test.mjs`: ship in frame in A, ship + tracers + kill in frame in B.
- **Ha'tak: guns and torpedoes both bite on every ring gun and shield node from the start** (`mission/strike.ts`): the shield nodes were hardened until the ring guns were gone, which read as "hitting does nothing". Only the pyramid itself is shielded now, until the three nodes are down; a round on the shielded pyramid shows "Pyramid shielded. Kill the N shield nodes first." for a second. The stage machine is count-based (guns silent / nodes down) and each node kill launches the reinforcement cone; the opening line says guns and torpedoes both work.
- **Stargate-themed hub and gate landed** (codex lane, merge 9631e80): `ui/glyphs.ts` original glyph set drives the hub's address register and the gate's glyph band; `travel/gate.ts` is a thick ring with a spinning two-sided glyph band, nine chevrons (seven used), sub-threshold event horizon and a short vortex on the seventh lock; the hub is a flat dark console. Design record `docs/design/gate-hub-redesign.md`, DECISIONS entry by the lane; session captures `docs/design/gate-hub-redesign-*.png`.
- **Prometheus hull pass 5 landed** by hand from the lane's commit 595eab1 (`ships/prometheus-def.ts` only): stepped bridge, split stern blocks, chamfer band, hangar accent strips. Captures `docs/shots/prom-pass5-*.png`.
- **Travel test on hardware GL** (`scripts/travel-test.mjs`): under swiftshader a frame with the new gate's burst and tunnel outlasts playwright's screenshot timeout while the game keeps its software baseline (6..12 fps), and on the RTX 5070 Ti it is 60 fps throughout, so the test launches Chromium on `gl-egl` by default (`SOFT_GL=1` for the old path), polls for the dial and tunnel phases instead of sleeping, and seeds the unlock chain before the cross-system launch (the lane's hub refuses a locked address). The kawoosh, tunnel and arrival captures in `docs/design/` were retaken from the landed main.
- **Torpedo reload** (`T.missile.reload` 14 s): while the rack is not full one torpedo rebuilds every 14 s (`Combat.reloadT`), waves still restock in full.

## 2026-09-05 (night) — Barrel-roll camera, replay shows the rounds and the kill

Ethan, 2026-09-05 (feedback chat, third round): "barrel roll animation is broken it like flips the screen instead of following the whole roll"; "kill replays are really cool ... but i can't even see the bullets that i shot and i also don't see the enemy like kill i just see my plane doing some cool moves"; the Prometheus "doesn't look that great".

- **Barrel-roll flip fixed** (`render/camera.ts`): the camera's up vector was lerped separately from the lagged frame, so half-way round a roll it passed through zero and `lookAt` flipped the picture. Up now comes straight from the frame. `T.camera.barrelFollow` 4.5 → 18: at 4.5 the frame lagged the 9.5 rad/s roll by more than 180° and the shortest-path slerp ran the roll backwards; 18 keeps the lag near 30° so the hull visibly rolls ahead of the view. `upFollow` is gone. `node scripts/barrel-test.mjs` samples the camera up through a roll and reports the largest frame-to-frame swing (343° total, no jump beyond one frame's worth of roll).
- **Replay re-emits the player's rounds** (`replay/replay.ts` `markShot`, `Combat.onFire`, `Projectiles.spawn/clear`): every player round's position and velocity is recorded beside the poses (800-entry ring), cut into the clip with the frames, and played back into a visual-only tracer pool at the clip's rate. Nothing resolves hits against that pool.
- **Replay frames the kill**: the clip keeps the scored kill's position; both shots look at a point between the ship and the kill (the drone shot leans at most ~17° off the ship so the ship never leaves frame at the pass; the lean fades once the kill is behind). Shot B is now over the shoulder toward the kill instead of an orbit around the ship. `node scripts/replay-test.mjs` drives a kill and checks tracers, ship and kill point in frame (`docs/shots/2026-09-05-replay-shotB.png`).
- Prometheus hull pass 5 dispatched to an Astra (codex) design lane owning `ships/prometheus-def.ts` (and the builder if a primitive is needed) with pass-5 captures as the deliverable.

## 2026-09-05 (evening) — Cursor steering, raw mouse, assist strength, escort log fix, varied belts

Ethan, 2026-09-05 (feedback chat, screenshot of the escort mission): prefers classic, assist "helps but I don't know if it needs to be quite as strong"; "kind of weird flying with the mouse ... I can't tell if it's because I have mouse acceleration or if I have not high enough sensitivity"; has to line the nose up exactly to hit; the HUD filled with repeated "Prometheus hull 100%"; asteroids should vary ("maybe gray, maybe different colors, maybe different sizes"), and the earlier "more dense" ask meant a bigger map with varied density, not one even fog.

- **Escort log spam fixed** (`mission/protect.ts`): the hull suffix was appended to `line` every sim tick, so a 60 s sortie had the line 3,600 entries long. It is now composed once onto the wave machine's line and recomposed only when that line changes.
- **Cursor steer mode** (`core/scheme.ts` `SteerMode`, `Input.steer`, HUD `.cursor`): the mouse moves an aim cursor on screen; the stick is the cursor's offset (dead zone, power curve, `T.flight.cursor*`). A still mouse holds a turn and the cursor shows where the nose is going. It is the default; the old mouse-speed stick stays as `relative` (menu "Mouse steer", `?steer=`). Sensitivity scales cursor pixels per mouse pixel in cursor mode.
- **Raw mouse input**: pointer lock now asks for `unadjustedMovement`, which bypasses the OS acceleration curve (Chromium; falls back to a plain lock elsewhere). Menu checkbox "Raw mouse", on by default. Every lock call goes through `lockPointer()`.
- **Assist strength** slider (0.2..1, `Scheme.assistStrength`): scales `latDamp` and the soft-horizon `autoLevel` while assist is on. X still toggles assist off entirely.
- **Belts vary per system** (`AsteroidOptions.tints/bigChance/big/small/voids/voidR`, `SystemDef.arena`): each belt mixes tint families (plum, grey, ochre, charcoal, one per base shape), has its own size mix (P3X-774 gets sparse 30..110 m boulders, Tollana small gravel), and `voids` carve empty pockets so density varies. Arenas are per system now (1700..2400 m, Abydos 2000) with the belts' `outer` grown to match; rock counts rose only 5..15 %.
- Save gains `steer`, `rawMouse`, `assistStrength` with defaults, so an existing save picks them up.
- **Gate travel holds the sim** (`Travel.holding`, `main.ts`): Ethan, "it lets me start playing while it's dialing ... the game starts before it should". Through the dial, the tunnel and the arrival fade only the input ticks (the aim cursor can be placed); flight, hazards, rocks and the mission clock wait. Verified in the pane: position and intro timer frozen while `holding`, released when the fade ends.


## 2026-09-05 — Mission-chain persistence assertions (A48)

- The existing chain smoke refuses wrong mission fallback and missing, malformed or lost persisted progress. It checks exact per-run completion increments and mission-declared rewards after navigation and final reload, including selected subsets and repeated missions.
- A bounded semantic save wait replaces the blind delay; an isolated browser context prevents prior progress masking a failed write. `STARGATE_TEST_URL` supports isolated preview verification.
- Build, ten controlled harness fault cases, actual eight-mission chain and actual unknown-id refusal passed. The existing 721.38 kB bundle warning remains; no bundled game source changed. [Design, archived source and evidence](design-chain-verification-20260905.md).

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
