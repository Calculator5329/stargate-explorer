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
