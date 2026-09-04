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

<!-- next entry below -->
