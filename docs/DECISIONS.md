# DECISIONS.md

Append-only log. One entry per decision that constrains future work. Format: date, decision, why, consequences. Reversing a decision gets a new entry, not an edit.

---

### 2026-09-03 — No engine; Three.js + TS + Vite directly
**Why:** full control over the sim/render split and the post stack; small bundle; no editor lock-in.
**Consequences:** we own physics, scene management, and asset pipeline. No ECS yet — add one only when entity count makes it necessary (probably M2/M3).

### 2026-09-03 — Fixed-step sim at 60 Hz, interpolated render
**Why:** deterministic feel regardless of frame rate; makes future replay/netcode possible.
**Consequences:** render code must sample, never read sim state directly. Tick rate is a constant in `loop.ts`.

### 2026-09-03 — Kinematic arcade-sim flight, not rigid-body
**Why:** velocity tracks the nose; readable and fun in minutes. Newtonian would need drift assist UI and much more tuning.
**Consequences:** no inertia-based sliding. If we ever want drift, add it as an explicit mode, not by swapping the model.

### 2026-09-03 — Ship-local +Z forward / +Y up / +X right
**Why:** matches Three.js `lookAt` and camera conventions; avoids the −Z-forward confusion.
**Consequences:** any imported GLTF must be exported this way (Blender: Y-up, −Z forward is the glTF default — rotate before export or in the loader).

### 2026-09-03 — All feel constants in `tunables.ts`, bound to lil-gui
**Why:** tune live, commit numbers. No hunting through files for magic numbers.
**Consequences:** new systems (weapons, AI, FX) add their own `T.<section>` and bind it in `debug.ts`.

### 2026-09-03 — Art is code (procedural ships/sky/planets), GLTF as escape hatch
**Why:** fast iteration, tiny bundle, no artist dependency. Loader hook kept so this can be revisited.
**Consequences:** visual quality ceiling depends on the builder and shaders. See GRAPHICS.md — direction decision pending.

### 2026-09-03 — Franchise names as placeholders; original ship designs required
**Why:** working title uses Stargate terms for flavour during development. Ship silhouettes are deliberately original.
**Consequences:** if this is ever distributed, rename places/factions or clear the rights. No franchise glyphs, logos, or copied hulls at any stage.

### 2026-09-03 — Planning docs live in-repo (`CLAUDE.md`, `docs/`)
**Why:** the docs are read by both people and coding agents; keeping them next to the code keeps them current.
**Consequences:** doc updates ride along with the commits that change behaviour.

### 2026-09-03 — Art direction: B, semi-realistic PBR hard-surface
**Why:** all three mock-ups (`docs/art-direction-options.png`) looked good; B has the highest ceiling and is the only direction that can be *downgraded* to A or C later by re-shading. Team makes its own Blender assets, which removes B's main blocker.
**Consequences:** the "art is code" pillar softens to "geometry is authored, everything else is code". Ship hulls come from Blender via glTF; the parametric builder stays for prototyping and enemy placeholder hulls. Expect bundle growth from textures — budget ~1–2 MB per fighter. Reflections need an environment map. GI is faked, not computed.

### 2026-09-03 — REVISED: art direction is A (stylised low-poly), B deferred
**Why:** effort estimate — A reaches its reference in ~4–6 weeks with no modelling; B needs 10–16 weeks plus 1–3 weeks per additional hull. A at full fidelity is still a strong look. Playable-and-good sooner beats higher ceiling later.
**Consequences:** supersedes the B decision above. "Art is code" pillar stands. M1 rewritten for A. The rendering work (shadows, planet v2, asteroid instancing, post) carries over if we migrate to B; only hulls would be replaced. Keep `ships/loader.ts` and make toon/outline passes per-material so a glTF can drop in later.

### 2026-09-03 — Assets are self-made only
**Why:** no third-party packs, no licensing questions, consistent style.
**Consequences:** every new hull is a modelling task. Keep the silhouette test (GRAPHICS.md §4) so variety is designed, not accidental.

### 2026-09-03 — Repo lives at `games/stargate-explorer`; PLAN.md is `docs/roadmap.md`
**Why:** workspace convention (`~/projects/CLAUDE.md`): the work queue must be `docs/roadmap.md` with checkboxes so the MASTER_TODO rollup and id stamping see it; `docs/changelog.md` records what shipped. `docs/STATUS.md` keeps its role as the state snapshot; it is not the root `STATUS.md` handoff file the workspace reserves for mid-task state.
**Consequences:** references to `docs/PLAN.md` mean `docs/roadmap.md`. Checkbox ids are stamped by the workspace sweep, never hand-written.

### 2026-09-03 — Dev server on port 5187
**Why:** 5173 (vite's default) is the Forge Shell.
**Consequences:** `npm run dev` serves `http://localhost:5187`; the workspace launch entry `stargate-explorer` uses the same port.

### 2026-09-03 — CORRECTION: +X is port, not starboard
**Why:** the earlier entry says "+Z forward / +Y up / +X right". Three.js is right-handed, so with those forward and up axes right = forward × up = −X. Building to the written "+X right" produced inverted yaw and roll (Ethan, first flight).
**Consequences:** the convention is +Z forward, +Y up, +X port. Flight, camera sway and inspect views are written against that; `sim/flight.ts` states the rotation signs. A glTF export still needs +Z forward / +Y up; nothing else changes.

### 2026-09-03 — Vision: gate → mission; flying missions first; graphics before game
**Why:** Ethan's ruling in chat: "you start out and go into a Stargate, it'll be different missions, the first type are flying missions piloting a spacecraft that looks like one of the SG-1 ships, fighting death gliders or a mothership or two." M0 and M1 are about the graphics because their quality decides how far the game can be pushed.
**Consequences:** M2–M5 in `roadmap.md` are placeholders to be rewritten after M1 feedback. Player hull stays an original design *in the spirit of* the show's fighter (wedge nose, forward canopy, twin engines, canted tails); enemy hulls will be evocative of gliders and a mothership the same way. The "no copied hulls" rule above stands; "looks like" means silhouette family, not likeness.

### 2026-09-03 — Outlines: inverted hull on ships + screen-space edge pass, layer 1 opts out
**Why:** inverted hull alone gives clean ship silhouettes but nothing for rocks, planets or creases; a depth+normal sobel gives everything but needs an extra scene render. Doing both matches row A: thick clean ship outline, thinner crease lines everywhere.
**Consequences:** `EdgePass` renders layer 0 once more with a `MeshNormalMaterial` override into a normal+depth target. Anything on layer 1 (`render/layers.ts`, `noEdge()`) is excluded: sky, glare, atmosphere shell, plumes, glow discs, outline shells. New transparent or additive objects must go on layer 1 or they get outlines. Low tier drops the pass and keeps the shells.

### 2026-09-03 — Bloom is emissive-only by HDR threshold, not by a second render
**Why:** the composer buffers are HalfFloat linear; tone mapping happens in `OutputPass`. Keeping every diffuse toon result under 1.0 and every emissive at 1.5+ makes a threshold of 1.0 select emissives for free. A darkening pass would cost a third scene render per frame.
**Consequences:** light intensities are budgeted: albedo × (key + fill) / π must stay under 1.0 (`T.toon.keyIntensity` 2.7, `fillIntensity` 0.6, brightest albedo ≈ 0.92). Anything that should glow uses `glowMaterial()` or an HDR colour, never a bright albedo. Nebula and planet are clamped below 0.95.

### 2026-09-03 — Ship parts are one triangle soup per slot, orientation fixed geometrically
**Why:** hand-wound quads broke every time a part was mirrored or a fin angle went negative. Testing each triangle's normal against an interior reference (loft axis or ring centre) is cheap at build time and makes mirroring a one-line `x = -x`.
**Consequences:** `ships/builder.ts` buckets triangles by palette slot (5 draw calls per ship regardless of part count) and emits one outline shell per solid. Parts must be convex-ish per ring pair or the interior-point test misfires; recesses and throats pass an explicit direction or `inward`. A glTF hull would bypass all of this and only needs a shell (`outlineShell(positions)`).

### 2026-09-03 — Shots are captured headless with `playwright-core` (dev dependency); the browser pane cannot measure fps
**Why:** the in-app preview pane runs hidden, so rAF is throttled and the overlay reads 0 fps; region zoom is unsupported. Headless Chromium renders WebGL through SwiftShader, which is fine for pixels and useless for timing. `playwright-cli` insisted on a Google Chrome channel that is not installed, so the repo carries a 20-line script on `playwright-core` instead (the only dev dependency beyond the toolchain; it downloads no browser by itself, `npx playwright install chromium` once).
**Consequences:** `node scripts/capture-shots.mjs [date]` writes the five standard views to `docs/shots/` at 1280×720 with the dev server running. Frame timing must come from a visible tab on real hardware; STATUS.md keeps that row as "unmeasured" until then.

<!-- next entry below -->

### 2026-09-03 — The player fighter follows the show's F-302 closely (supersedes "designs stay original")
**Why:** Ethan, on the M1 captures: the ship "should look a lot more like the show ... that gray ... F-302". The 2026-09-03 M1 hull was flagged in chat as "in the spirit of" and he asked for closer. This is a private, unpublished repo.
**Consequences:** `ships/defs.ts` models the F-11 on the F-302's proportions and layout (wedge nose, forward tandem canopy, aft-deck intake engines, canted fins, booster pods) in gunmetal. Identifiers and copy still avoid franchise names. **Publication of any kind must re-open this**: the visibility policy's `ask` default applies, and a likeness this close is an IP question for Ethan, not for an agent.

### 2026-09-03 — Screen-space edge pass retired in favour of geometry outlines everywhere
**Why:** the sobel pass drew angle-dependent, aliased lines on asteroid facets that Ethan read as "see-through" outlines. Depth/normal thresholds cannot be stable on a tumbling faceted rock.
**Consequences:** every outlined thing carries its own geometry: inverted-hull shells (ships and, instanced, rocks) plus baked crease lines for rocks (own edge extraction; `EdgesGeometry` emitted every edge on this soup). `EdgePass` stays in the tree with `tier.edges` false everywhere; delete it if nothing wants it by M3. Draw calls drop (one fewer full-scene render).

### 2026-09-03 — Flight keeps a velocity vector separate from the nose
**Why:** pure nose-following felt like a camera on rails; drift, collisions and barrel rolls all need a velocity that can disagree with the heading for a moment.
**Consequences:** `Flight.velDir` chases the nose at `velFollow` (9/s, so normal flight is unchanged in feel), freezes while Space is held, reflects on `bounce()`. Anything that moves the ship must go through `velDir`/`pos`, never by editing `quat` alone. Controls are A/D roll, Space drift, double-tap A/D barrel roll; Q/E are free.

### 2026-09-03 — CORRECTION: the "see-through" rock outlines were torn geometry, not the edge pass
**Why:** the entry above blames the sobel pass. Measured afterwards with a node script: `IcosahedronGeometry(1, 1)` is already non-indexed, so applying the per-vertex y-squash jitter per vertex *occurrence* moved shared corners to different places on each face (232 of 240 edges unmatched). The hairline cracks showed the dark inverted-hull shell behind them and shifted with view angle, which is exactly what Ethan described. The screen-space pass only made them more visible.
**Consequences:** `rockGeometry` keys its `[scale, squash]` jitter per unique position so shared corners stay welded; the crease extraction (`creaseEdges`, 55°) then finds sparse creases instead of every edge. The edge-pass retirement stands on its own merits (one fewer full-scene render, no angle-dependent lines), but it was not the fix. Any future procedural mesh that gets a shell must be welded first; `outlineGeometry()` in `render/outline.ts` does the welding for ships.

### 2026-09-04 — Two control schemes behind a runtime switch, arcade default
**Why:** Ethan wants to try constant-speed flight with W/S as a hard pull-up/dive and Space as a brake, "as a switcher so we could try this mode out and then potentially go back". A branch or a build flag would make the comparison a reload; a key makes it a moment.
**Consequences:** `core/scheme.ts` holds the mode; `Input` exposes raw keys (`pitchKey`, `space`) and `Flight` gives them meaning per scheme. Anything that reads W/S or Space must go through the scheme, never the key set. The HUD reads the scheme for its hint and bar. When Ethan picks, the loser is deleted rather than kept as an option (M5 keybinds are a separate question).

### 2026-09-04 — Palette follows Ethan's second reference frame
**Why:** "the planet, asteroids, and nebula should all look a little bit more like this": orange/violet painterly nebula with dark negative space, plum rocks with rust-lit facets, saturated orange/blue planet with a coloured night side, no ice caps.
**Consequences:** rock albedo is rust and a flat violet emissive owns the shadow side (MeshToonMaterial cannot hue-shift per band, so the emissive stands in for the cool shadow); the planet shader mixes a `night` colour on the dark side instead of darkening albedo; nebula posterisation is 65 % smooth now, with a fine stipple. The earlier "cream/red fighter, white caps" reference is superseded where the two differ.

### 2026-09-04 — Both control schemes stay (supersedes "the loser is deleted")
**Why:** Ethan flew both: "honestly, I really like both. And I think I'd like to keep both as options for now."
**Consequences:** the scheme switch is a feature, not a trial. New flight mechanics must work under both (or state which they belong to); the M5 keybind/settings screen gets the toggle. Arcade stays the default.

### 2026-09-04 — Combat is a layer above flight, with kinematic enemies and swept instanced rounds
**Why:** M2 needs a fight, not a physics engine. The player ship already flies kinematically; enemies that fly the same way (pose + speed, `rotateTowards` a wanted facing) are cheap, predictable and tunable. Rounds are fast enough that per-frame point tests miss, so each is a swept segment against spheres.
**Consequences:** `game.ts` owns `combat/`, `mission/`, `audio/`; `main.ts` only wires it. `Enemies` knows nothing about rendering beyond its `ShipRig`; `Combat` owns projectiles and explosions and resolves every hit (player rounds vs enemy spheres at `T.enemy.radius`, enemy rounds vs the player sphere, both vs rock spheres). Enemy hull defs live in `combat/glider-def.ts`, not `ships/defs.ts`, so enemy design does not fight the player-ship likeness work. Mission content is data (`MissionDef`); a new level is a new object, not new code. Sound is synthesised, no assets, per the code-driven content pillar. `?lock=free` and `window.__game` exist for headless verification and stay; they are not a cheat surface anyone would find.

### 2026-09-04 — Missions are runners over shared `Tracked`/`Lockable` shapes; levels are data
**Why:** four level types were wanted in one night. The HUD box, the lock cone, missiles and cannon hits all needed to work on turrets, shield nodes, a hull and an escort, not just gliders, without four copies of the hit code.
**Consequences:** `combat/targets.ts` defines `Tracked` (pos, vel, alive, radius) and `Lockable` (adds `damage()`); `Combat.extras` are enemy-side lockables the mission owns, `Combat.friendlies` are what enemy rounds can hurt. `Enemies.targets` is a list gliders pick from round-robin, so an escort mission just pushes the escort twice. `mission/levels.ts` is the only place level numbers live; a runner (`clear`, `run`, `protect`, `strike`) is code for a *type*, never for one level. `Game.record` is the only writer of progress. Franchise words (Prometheus, Ha'tak, Goa'uld) appear only in strings shown to the player, per the IP note.

### 2026-09-04 — Settings and progress live in one localStorage blob; difficulty only touches the enemy side
**Why:** the pause menu needed persistence and the "are they too fast or do I suck" question needed presets. Scaling the player's ship with difficulty would blur it with ship stats.
**Consequences:** `core/save.ts` (`stargate-explorer.save.v1`, defaults merged over a partial or corrupt blob). `core/difficulty.ts` `D` multiplies enemy speed, hp, fire rate, damage and spread at use time; `T` stays the feel source and the tuning panel still rules. Ship stats (`ships/registry.ts`) are the only thing that changes the player.

### 2026-09-04 — A star system is a page; gate travel is a reload
**Why:** the World (sky, planet, sun, belt) is built once and everything from the shadow frustum to the rock spheres the AI reads assumes one belt. Rebuilding it live for a system swap would mean tearing down and re-wiring every system that holds a reference, for a transition the tunnel shader hides anyway.
**Consequences:** `world/systems.ts` `SystemDef` is the unit of content; `Travel.depart` plays the dial and tunnel, then sets `location.search` with `arrive=1`, and the fresh page fades the tunnel out. Progress and settings survive because they already live in localStorage. Anything that must persist across a jump goes in the save blob or the query string, never in memory. A live in-scene swap is a later decision if the reload ever shows.

### 2026-09-04 — Enemy kinds are `T` tables, not subclasses
**Why:** the brain is one function of numbers (speeds, turn rate, cones, distances); the interceptor and gunboat differ from the glider in numbers and one switch (`dogfight` 0/1), not in logic. The tuning panel binds flat numeric sections of `T`, so a kind that is a section of `T` is live-tunable for free.
**Consequences:** `combat/enemy-kinds.ts` maps kind → `{def, stats}` where `stats` is a reference into `T` (`T.enemy`, `T.interceptor`, `T.gunboat`); the three tables must share a shape (`EnemyStats = typeof T.enemy`). Per-shot damage rides on the round (`Shot.dmg`). A kind whose behaviour cannot be expressed as numbers (a bomber run, a minelayer) is a new state in the brain, gated by a flag in the table, before it is ever a subclass.

### 2026-09-04 — Astra authors 3D defs from written briefs
**Why:** Ethan pointed at GPT-6 Astra for "the 3D stuff". The two enemy hulls and seven presets came from briefs that fixed axes, sizes, palette slots and silhouette goals, with the builder's `ShipDef` shape as the contract; Astra ran as `codex exec` in a workspace-write sandbox with git, servers and the browser forbidden, and every def was typechecked and captured before being kept.
**Consequences:** briefs live in `.astra/` (gitignored, they are scratch); the result is judged by capture, never by reading the numbers. Astra output never touches game logic, tunables or docs, and never commits.

### 2026-09-04 — Keybinds are a table in the save; a quality change is a reload

**Why:** `Input` used to test literal key codes. A rebind feature either threads a lookup through every consumer or gives `Input` one table and keeps everything else reading `input.pitchKey`/`roll`/`boost`. The table (`core/binds.ts`, action → `KeyboardEvent.code`) is a `Settings` field so it persists with the rest and merges over defaults when the save predates it. The renderer, its post stack and the world's planet segment count are built once in `main.ts`; rebuilding them live would mean tearing down the scene mid-mission for a setting nobody flips more than once. So a quality change writes the save and reloads the page without `?quality=`.

**Consequences:** new flight actions get a `Binds` entry, a label, and a default; nothing outside `Input` and the menu sees key codes. Mouse buttons, Esc, the end-card keys and the backtick stay fixed. A pad maps onto the same `Input` fields, so the flight model and combat never know which device is speaking.

### 2026-09-04 — Obstacle variety is a belt style, not a new system

**Why:** ice shards and derelict wreckage needed to collide, be avoided by enemies, block missiles and render with the outline pipeline exactly like rocks. Everything downstream reads `RockSpheres`/`RockField` (centres, radii, planes, `matrixAt`), so a second field class would have meant a second consumer path in hazards, enemies, combat and every mission's `clear()`. Instead `Asteroids` takes a `style` that swaps the base geometry, palette, scale bands and tumble, and each base shape carries its own bounding radius so the sphere and the narrow phase agree for any unit shape. Concave wrecks collide against their convex hull: the face-plane test is an intersection of half-spaces, and a merged primitive's buried faces would shrink that volume to almost nothing.

**Consequences:** a new obstacle kind is a `StyleDef` (geometry factory + numbers) and a `belt.style` on the system; nothing else changes. Shapes must be roughly convex or opt into `hull: true`. Per-instance non-uniform scale is still not supported (the narrow phase assumes uniform), so elongation is baked into the base geometry.


### 2026-09-05 — Convex armor plates and batched ship outlines

**Why:** Ethan asked Astra to improve the game's 3D art. The selected Facet silhouette stays; thin beveled plates break up its blank wings and nacelles using the existing palette. Optional `ShipDef.armor` describes convex XZ footprints, height, thickness and mirroring. No assets or dependencies added.

**Consequences:** `buildShip` welds each solid's shell independently, then merges shell geometries. This preserves separate normals at touching parts while drawing the ship's outlines in one call. Armor is visual only; flight and collision dimensions stay the same. Captures, rather than an FPS estimate, judge the art.


### 2026-09-05 — A rock is a slot; breaking one retires the slot and fragments borrow spare slots

**Why:** destructible asteroids had to keep every existing consumer (hazards, enemies, combat, missions' `clear()`, the gate placer) working unchanged: they all walk `centers`/`radii` by global index. Removing instances would renumber everything and force a rebuild of the instanced meshes. Instead a broken rock keeps its index but parks at y=1e6 with radius 0, which every sphere test rejects for free, and fragments are written into a fixed tail of spare slots per shape (`frags`, default 40) on a ring cursor. Per-instance position/quaternion/scale live in typed arrays and the matrix is composed each tick, so fragments can move and shrink without decomposing matrices.

**Consequences:** `Asteroids.count` includes the spare slots (so it exceeds `belt.count`); code that wants only real rocks checks `alive[i]` or `radii[i] > 0`. A burst of more than `frags` fragments per shape recycles the oldest. `RockSpheres` gained optional `vel`/`playerMade` so enemies can use relative closing speed and credit the player. The kill rule for enemies is a threshold on relative closing speed (`T.rocks.crashKill`), not the player's graze/kill damage curve, because Ethan asked for "if enemies go into asteroids, they're destroyed".


### 2026-09-05 — Mouse steering is a cursor, not a velocity stick; raw motion by default

**Why:** the original virtual stick integrated mouse *speed* with a 0.2 s decay (`stickReturn` 5), so a still mouse flew straight and holding a turn meant dragging the mouse continuously, and any OS acceleration curve multiplied straight into the turn rate. Ethan (2026-09-05): "kind of weird flying with the mouse ... I can't tell if it's because I have mouse acceleration or if I have not high enough sensitivity". Both causes were real. The space-sim convention (Freelancer, Everspace, Star Conflict) is an aim cursor: the stick is the cursor's offset from centre, so the mouse position, not its speed, is the command, and the cursor doubles as the "where is my nose going" indicator he was missing when lining up on gliders. Pointer lock's `unadjustedMovement` removes the acceleration curve at the source.

**Consequences:** `Input.steer` picks the mode per tick; both write the same `stick`, so `Flight` is untouched. The pad still writes the stick directly. `cursorReturn` (0) exists so the cursor can be made to drift home if Ethan finds a stuck cursor annoying. The `relative` mode stays selectable until he has flown both; delete it only on his word. All lock calls go through `lockPointer()` so the raw-motion request and its fallback live in one place.

### 2026-09-05 — Original address glyphs and a shared procedural ring gate

**Why:** Ethan asked for a gate-themed mission console, symbol-based dialing and
more recognizable ring construction. The existing IP note excludes franchise
marks; the new constellation set and A–Z display face are original stroke data,
not copies of the show's 39 symbols or Ancient script. English stays visible
under the display face. Ethan can explicitly override the glyph-art stance;
publication and likeness decisions still belong to him.

**Consequences:** `ui/glyphs.ts` is the common source for DOM SVG and a cached
canvas texture strip. System ids seed six distinct coordinate glyphs plus a
shared origin, so hub and travel agree without extending the systems table.
`Gate` supplies both the return marker and the travel presentation: thick
annulus, two-sided rotating glyph band, nine geometric chevrons with seven used,
a sub-threshold event horizon, and a short vertex-deformed vortex during the
existing seventh-lock pause. Small chevron inserts supply HDR glow. Travel
retains its states and simulation-hold contract; its chevron audio calls also
advance the DOM glyphs. No assets or dependencies were added. Local constants
stay in the owned files for this lane. Build/adapter checks and the unfulfilled
browser-capture requirement are recorded in `docs/design/gate-hub-redesign.md`.

### 2026-09-05 — Escort hull is level data; enemy hulls are flyable by registry entry; "hold" is the sixth mission type

**Why:** Ethan asked for more missions and ships in one breath. Two of the
cheapest ways to get both were blocked by hard-coding: the protect runner built
the Prometheus by name, and the hangar's locked-card text named the Ha'tak
mission. Both moved to data (`ProtectLevel.escortHull/escortName/escortPalette/
escortRadius`, `unlockedBy()` searching `LEVELS` for the mission that hands a
hull over). A captured death glider became a player ship by adding one line to
`ships/registry.ts` pointing at the enemy def: the builder does not care which
side a def is on, so any enemy hull can be earned and flown at zero art cost.
The hold type exists because every other type ends when a list is empty;
outlasting a clock is a different pressure (spend or save missiles, kill or
evade) and the cheapest new playstyle available.

**Consequences:** new missions that escort something other than the carrier
need only a hull key. A recoloured enemy hull as a friendly takes a palette name
(`escortPalette`), not a new def. The chain test drives hold missions by
setting the clock near the end, so it verifies the win path and the unlock but
not the pacing; pacing is Ethan's to fly. Enemy kinds that differ only in
numbers (the ace) are a `T` table plus a def spread with a new palette, not a
new hull; kinds that need a new silhouette (the bomber) get a def under
`combat/`. Franchise names stay in strings (the "Ha'tak" in titles) and out of
identifiers, as before. The brainstorm for further types lives in
`docs/design/missions-and-playstyles-brainstorm.md`.

## 2026-09-06 — Missions script enemies through one hook; no native scrollbars; scope guard on the playstyle list

**Decision:** a mission that needs an enemy to fly a path sets `Enemy.steer`
(a direction) and `Enemy.steerSpeed` and the enemy brain stands down until the
mission clears it. No second AI class, no separate "runner" entity: the hunt
quarry and the bomber-line runners are the same `Enemy` objects the guns,
missiles, replay, rock crashes and kill credit already handle. Rock avoidance
stays on under scripting and looks further ahead in proportion to the scripted
speed, because a straight line through a dense belt at 168 m/s with a
half-second lookahead ends in a rock (measured, hunt probe run 2).

Native scrollbars are banned in every surface of the game (Ethan 2026-09-06:
"totally takes you out of it"). The global rule in `index.html` is a thin gold
thumb on a transparent track; a richer "ancient scroll" treatment is a design
item. New UI must not introduce an element that scrolls without that rule.

The list of playstyles Ethan named (combos, loadouts and custom ships,
first-person foot mode, boarding, surfaces, bases with gates between planets)
is recorded in the roadmap under Later with his scope guard: "we don't
necessarily want to charge forward on everything that broadens scope because we
are just going to turn ourselves into like No Man's Sky". Each entry is one
mechanic with an entry condition; none starts without Ethan promoting it.

**Consequences:** new mission shapes that move enemies on rails cost a level
type plus a runner and no AI work. A scripted enemy that must not shoot gets
that for free (firing is gated on `!e.steer`); one that should shoot while
flying a line needs a new flag, not a special case. The duel is the tuning
bench for every enemy table because it isolates one kind in open space
(`beltScale` on the level). Foot mode, when it comes, is a new folder and a
new DECISIONS entry; nothing in `sim/flight.ts` should bend toward it now.

## 2026-09-06 — Bake what does not move; cull what the camera cannot see; drop pixels before frames

**Context:** Ethan asked for an in-depth performance pass across hardware and devices. The local GPU is vsync-locked at 60 with 1 ms of GPU time on every tier, so measurement moved to SwiftShader at 720p as the weak-device proxy (`scripts/perf-bench.mjs`, `scripts/perf-attrib.mjs`). The cost order there: 4x MSAA on a HalfFloat target, bloom, the belt drawn unculled, then the procedural sky and planet shaders (five octaves of fbm per pixel per frame for a picture that never changes).

**Decision:**
- The skybox and the planet surface are **baked** on first use (cube map and equirect albedo respectively, `WebGLCubeRenderTarget` / `WebGLRenderTarget` sized by the tier's `bakeSize`) and only re-baked when an input uniform changes. The procedural shaders stay as the bake source, so the look is authored exactly as before and `scripts/bake-compare.mjs` proves it.
- The belt is **frustum-culled by compaction**: sim arrays keep the fixed `gi` layout every consumer indexes, and `Asteroids.cull` rewrites only the GPU side each frame (visible instances packed to the front, `count` set on body, shell and lines, `addUpdateRange` on the used part). `matrixAt(gi)` remains the one place a rock's transform is built. No spatial structure yet; a sphere-versus-frustum test on 2200 rocks is under 0.2 ms.
- Tiers cap **pixels**, not only device pixel ratio, and medium runs **2x MSAA**. The canvas never asks for its own antialiasing since the composer target carries the samples. **Dynamic resolution** is a setting with hysteresis (down fast, up slow) and a floor, on by default, because a frame drop is worse than a soft frame in a dogfight and the toon look survives a lower resolution better than most.
- The **aim cursor integrates at mouse-event rate**; the tick only decays it. The boost rumble is deterministic sines. Per-frame randomness on the camera is reserved for hits.

**Consequences:** a new sky or planet uniform that should animate must either be excluded from the bake key (and applied in the cube/surface material instead) or accept a re-bake per change; nothing in either preset animates today. Anything that reads `InstancedMesh` slot `i` of a shape as rock `gi` is now wrong; read the sim arrays. `Renderer.pixelRatio()` is the only place resolution is decided; the perf overlay shows `res N%` and `gpu X ms`, and `perf-bench`/`perf-attrib` are the measurement tools to rerun after any render change.

## 2026-09-06 — Gate travel swaps the system in place; targets own their hit test

**Context:** Ethan: "in transitions, the sound is bad and I still have text like while I'm going through the portal", and the Ha'tak's shield nodes could not be killed. The old trip reloaded the page with `?arrive=1` at the end of the tunnel: the AudioContext died, the engine drone kept running until then, the start menu opened over the arrival, and the HUD reappeared half a second into the tunnel when the dial overlay came down. The nodes sat inside the pyramid's collision sphere, so the shielded hull ate every round.

**Decision:**
- **One page, many sorties.** `main.ts` owns the persistent layer (renderer, input, flight, camera, HUD, audio, menu, hub, travel) and a `Sortie` (level, world, rig, hazards, game) that `build()` creates and `teardown()` disposes. `Travel.onSwap` fires at 0.6 s into the tunnel, when the screen is fully covered; the URL is rewritten with `history.replaceState` so a refresh lands in the same place. Everything disposable has a `dispose()` (world, sun, sky and planet bakes, game groups) routed through `render/dispose.ts`. The reload path survives only for a page opened with `?arrive=1`.
- **The HUD is hidden by travel state**, `hud.setTravel(travel.holding)` every frame, never by which overlay happens to be up.
- **A `Lockable` may supply `hits(a, b)`**, an exact segment test; `combat.ts` prefers it over the radius sphere for rounds and missiles. `Capital` implements it with a signed-distance shape (pyramid, inverted underside, ring band) and uses the same shape to push the player out along the nearest face.

**Consequences:** anything created per sortie must be created in `build()` and released in `teardown()`; a listener added on `window` or the canvas in `game.ts` goes through its `AbortController`. Anything that should persist across systems (audio, settings, pointer lock, the aim cursor) lives above the sortie and must not be re-created in `build()`. A new large target with parts inside its silhouette should implement `hits`, not rely on a bigger or smaller sphere. `scripts/travel-test.mjs` and the `?arrive=1` path are both still exercised; if the reload path is ever dropped, `Travel.arrive()` goes with it.

## 2026-09-06 — The campaign is data, the designer lives in the game, the dev server is the store

**Context:** Ethan wants to plan levels, unlocks and power on purpose and to have a builder UI where he arranges pieces the code provides (campaign board and encounter composer first, a move composer and stat sheets after). Three hosting shapes were on the table: a separate web app over the repo, a Node CLI with generated pages, or a mode inside the running game. Ethan picked the in-game mode with files as the store.

**Decision:** the campaign (acts and levels) lives in `src/content/campaign.json`; `mission/levels.ts` imports it and stays the type contract, with a dev-time check for the mistakes a hand edit can make. The designer is `src/editor/`, mounted over the game by `?edit=1` through a dynamic import so the shipped bundle never carries it. Saving posts the whole file to a Vite dev-server middleware (`/__content/save`) fenced to `src/content/*.json`; the built game has no store and says so. The power curve is a model computed from the same tables the game runs on (`editor/power.ts`), never a second set of numbers. There is no general node-scripting tool: a new kind of level is a new type in `levels.ts`, a runner in `mission/`, and one field list in `editor/schema.ts`.

**Consequences:** the game and the designer cannot disagree about what a level is, because both read one JSON through one union. Every future content table (ships, enemy kinds, moves) follows the same route: a JSON under `src/content/`, a typed import, an editor panel, the same save endpoint. Vite's full reload after a save is the price of no live re-binding; FLY IT on a different level relies on it. Positions on the board (`board`) and acts (`act`) are content, so the file carries layout, and a level with neither still renders (the board places it). The model's feel constants are the one place to calibrate when a headless fight can measure hull lost per enemy.

### 2026-09-06 — Reversible SG-1 fleet refinement
**Why:** Ethan asked for closer SG-1 ships and a reviewable comparison, explicitly retaining every old design.
**Consequences:** Existing definitions remain exported as `*_ORIGINAL`; revisions are derived separately in `ships/refinements.ts`. Revised art is the default; `?art=original` restores the prior fleet without changing saves or gameplay stats. `?hull=old-<key>` inspects a single original. The selected Facet and earlier fighter variants remain intact. Standard Goa'uld enemies now retain each hull's material palette, including blue bomber engines; original-art mode restores the previous faction-wide recoloring, and special factions still recolor both modes. An optional armor top-footprint scale supports the bomber's pyramid; omitted values retain the original builder behavior. The offline review embeds actual paired captures and five attributed SG-1 stills, identifies original game designs as original, and gives the Ha'tak a reversible dark-ring material pass without changing its geometry. Review preferences are local to the browser and never apply changes automatically. No production assets were downloaded; reference stills live only in the private review.

## 2026-09-06 — Blender benchmark stays separate

Ethan explicitly authorized one Blender death-glider benchmark and comparison, with no replacements. Author source with Blender Python, export GLB, and prove it through the existing Three.js loader in a separate review entry point. Keep all runtime registries and ShipRig unchanged until a later owner decision. Portable Blender is an authoring tool in the task cache, not a runtime dependency. Both game-toon and exported metallic treatments are shown because geometry and material direction are separate judgments.
## 2026-09-06: Moves are step lists the bar pays for; trigger keys are content, not a bind

**Context:** Ethan's move-composer packet (`planning/reports/move-composer-packet-20260906`, answered 2026-09-07T02:08Z). Seven calls, all on the recommended option, plus two notes: a sandbox to try moves in, and trigger keys that are not only B.

**Decision:**
- **A move is data**: `src/content/moves.json`, typed by `sim/moves.ts` (`MoveDef`: trigger `{key, dir}`, cost, duration, steps of `brake | boost | snapPitch | yaw | roll | hop` with start, length, amount). `Flight.tick` interprets it inline: no per-move code, no second physics path. While a move runs the player's stick, roll keys and boost are ignored; the steps add rates or set the speed target; a boost step lifts the cap. The barrel roll stays its own thing (a double-tap, not a chord) and yields to a move.
- **The boost bar is the one currency.** Cost is a bar fraction paid on start; below it the chord does nothing. No second meter, no cooldown table.
- **Trigger keys live on the move, not in `binds.ts`.** `Input.moveKeys` is derived from the table, so a family on F or T needs no code. The direction half of a chord comes from the pull-up / dive / roll binds, so rebinding W or A moves the chord with it. A direction tap inside the window belongs to the move; the double-tap barrel and the pull are suppressed for that tap.
- **The camera reuses the barrel treatment** (`rolling` = barrel or move): follow the nose only, FOV kick, pull-back. No per-move camera data yet.
- **The sandbox is a level type** (`sandbox`), not a mode flag: it rides the same mission factory, editor schema and hub card as every other level, and the campaign carries one (`proving-ground`).
- **TRY IT is live, unsaved.** The designer hands its working `moves` array to `Flight.moves` and `Input.moveKeys` by reference and starts the move on the level already loaded; SAVE is what writes `moves.json`. A tried move never reaches the file by accident.
- **Player only.** Enemies have no bar and no trigger policy; the interpreter does not know who owns it, so that is a later mission-side decision.

**Consequences:** a new primitive step is one `StepKind`, one case in the flight switch, one unit label and one help line in the composer. A move that needs something the primitives cannot express (a target-relative turn, a weapon burst) wants a new step kind, not a special case. `Content.save` posts two files; a third table follows the same route. The four starter numbers are guesses until Ethan flies the proving ground.

## 2026-09-08 — Explicit presentation scenes and reproducible replay effects
Travel, paused, hub, replay and flight resolve to one presentation mode. Flight input and simulation stop outside flight; audio buses switch with that mode. Replay owns separate tracer/destruction pools and reconstructs effects from recorded seeds on its playback clock. Event lighting uses three bounded shadowless lights, saved off by default. Cloud maps remain baked; cloud shell/shadow transforms animate without rebaking. The optional review module is dynamically loaded only for `?review=1` and labels its predetermined encounter as scripted. No new dependency or art pipeline.

## 2026-09-08 — Bounded continuous multi-kill capture
Keep the latest N kills within X seconds of the newest kill (defaults 3 and 8). Preserve seven seconds before the first included kill where available, capped after any excluded death, and three after the last. Store 42 seconds of poses and 2800 rounds for supported limits of 8 kills/30 seconds. Every selected kill controls slow motion and a player/victim framing beat; fade attention back to the player after the final breakup. Fit the two padded subjects against both camera axes rather than zooming toward the victim alone. N/X evaluation changes are session tunables; no save migration.

## 2026-09-08 — The frame-rate controller reads the second-worst frame, and bloom is the only thing it may switch off

**Decision.** `Renderer.adapt()` decides on the second-worst frame time of its window, never on a mean
frame rate. When the 0.35 resolution floor is not enough it disables the bloom pass, and it re-enables
bloom before it gives back any resolution. No other effect may be added to that ladder without a new entry
here, and shadows specifically may not.

**Why.** Ethan's report was "drops to 30 FPS sometimes". A mean is blind to that: frames alternating 16.7
and 33.3 ms average to 40 fps while the picture visibly hitches. A mean is also wrecked from the other side
by the one-off load stall, which read as a catastrophically slow machine and cost resolution for the rest
of the sortie. Reading the window's second-worst frame answers "how bad are my bad frames" and, by
construction, cannot be moved by a single hitch. Bloom is the largest fill cost of the medium and high
tiers and disabling the pass touches no scene material, so nothing relinks and the switch itself does not
stutter. `shadowMap.enabled` is part of every program's cache key, so putting shadows on the ladder would
relink the whole scene mid-fight, which is exactly the stall `render/warmup.ts` was built to remove.

**Consequences.** A machine on relief looks plainer, and the overlay must say so (`bloom off (perf)`), or a
screenshot from it reads as a bug. `setSilhouette` has to respect the relief state rather than assume it
owns the bloom pass. Anything that wants to switch a render feature at runtime has to check first whether
it is in a program's cache key; if it is, the answer is a quality tier chosen at load, not an adaptive
step. Tests of the controller must stop the render loop, because its own frames otherwise land in the
window being fed and the reading is of a mixture.

## 2026-09-11 — Episode art before mission integration

Ethan requested episode-based ship and level graphics, with Antarctica as the centerpiece, and deferred order and implementation. Agent judgment: keep this pass in a separate Vite entry (`episode-fleet.html`) using the existing procedural Three.js geometry/material approach. Missing hulls live in `episode-earth.ts`, `episode-alien.ts` and `episode-machine.ts`; scene props live in `episode-scenes.ts`. The review composes these with existing ships without changing gameplay registries. Source facts, approximated shapes and proposed objectives are labeled separately. Ship sizes are review units, never canon measurements. This is revisitable art structure, not a new campaign format.
