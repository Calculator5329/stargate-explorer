# GRAPHICS.md

The code is a solid render skeleton; the *look* is placeholder. This doc records where we are, the direction we picked, and the pipeline that follows from it.

**Decision (2026-09-03, revised same day): direction A — stylised low-poly, done properly.** Target is row A of `docs/art-direction-options.png`, at full fidelity — the reference is achievable in-browser. B stays open as a later migration: the render features A needs (env map, shadows, planet v2, asteroid instancing) are all reused by B; only the hulls get swapped. See DECISIONS.md.

## 1. Where we are (from `preview.png`, Sep 2026)

| Element | Current | Problem |
|---|---|---|
| Ship hull | Superellipse loft, 7 sections, 16-vert rings, flat shading | Reads as a smooth blob; no panel breaks, no canopy, no surface detail. Wings are flat slabs with visible thickness. |
| Ship material | `MeshStandardMaterial`, one colour per part, roughness 0.6 | No variation across the hull — nothing for light to catch. |
| Engines | Cylinder nacelle + flat glow disc | Glow disc is fine with bloom; no plume/trail so speed doesn't read. |
| Lighting | 1 directional + hemi + ambient, no shadows | Ship has no self-shadowing; wings don't shade the hull. |
| Sky | 1-draw-call shader: 3 star layers + 2 fbm lobes | Nebula is blurry and low-frequency; looks like a gradient. Stars have no size variety beyond 3 buckets. |
| Planet | fbm land/sea + ice caps + fresnel atmosphere | No clouds, no ocean specular, no night side lights, atmosphere is one uniform rim. |
| Debris | 120 flat icosahedrons | Looks like scattered dice. |
| Post | ACES + UnrealBloom | Fine. Bloom threshold 0.35 is low — planet day side blows out (see preview). |
| Perf | 4 fps in one screenshot | Unknown cause; must diagnose before adding cost. |

## 2. Direction candidates

### A — Stylised low-poly, done properly
Think *Sable*, *Astroneer*, *Hardspace: Shipbreaker* menus. Keep flat shading, but add: strong 2–3 tone palettes per faction, hard edge outlines (post-process or inverted-hull), matcap or toon ramp lighting, chunky readable silhouettes, exaggerated engine plumes.
- **Pipeline:** stays 100% procedural. Builder gets: panel-line inset extrusions, canopy sub-mesh, greeble scatter primitives, per-part palettes.
- **Cost:** low. Mostly shader + builder work.
- **Risk:** can look cheap if the palette and lighting aren't strong. Success is 80% art direction.

### B — Semi-realistic PBR hard-surface
Think *Everspace 2*, *Star Citizen* at a distance. Proper normal/roughness/metal maps, panel lines, decals, dirt, HDR environment reflections.
- **Pipeline:** almost certainly needs authored assets — Blender hulls with baked textures via `ships/loader.ts`. Procedural can supplement (triplanar detail noise, decal atlas) but can't carry it.
- **Cost:** high. Someone models ships. Bundle size grows (textures). Need an HDRI or procedural env-map for reflections.
- **Risk:** the uncanny valley between "placeholder" and "good" is wide; every ship has to hit the bar.

### C — Painterly / cel
Think *Rogue Squadron* remaster concept art, *Sky: Children of the Light*. Toon shading with hand-tuned ramps, screen-space paint texture, soft bloom, strong colour scripting per system.
- **Pipeline:** procedural geometry + custom shaders. Similar to A but shader-heavier.
- **Cost:** medium. Lots of shader iteration.
- **Risk:** hard to make combat readable if everything is soft.

**Chosen: A** (est. 4–6 weeks to reference fidelity vs 10–16 for B). B deferred; migration path is "swap hulls for Blender glTF, keep everything else".

## 2b. Reading the row-A reference — what makes it work
Study the reference before touching code. The look is not "few polygons"; it's these five things together:
1. **Hard black outlines** on every silhouette and panel edge, ~1.5–2 px at 1080p, slightly thinner on interior edges.
2. **Three-tone palette per ship** — gunmetal body, darker gray chines/leading edges, charcoal underside/nozzles — with almost no hue variation within a tone. Blue is reserved for canopy + plume. *(2026-09-03: cream/red from the reference frame lasted one round; Ethan asked for the show's gray, so `tauri` is gunmetal and the cream set survives as `cream` in `ships/palettes.ts`.)*
3. **Real panel detail in the geometry**: inset panels, a stepped canopy frame, hatches, a nozzle with visible rings, small decals (chevrons, numbers). Detail is *modelled*, not textured.
4. **Flat-facet lighting with a hard shadow terminator** — two-step ramp, a cool fill on the dark side so it never goes to black.
5. **Environment matches**: faceted asteroids with visible facets, planet with hard-edged continents and a crisp atmosphere line, nebula that is painted-flat with a few stepped tones rather than smooth fbm.

## 2c. What A realistically reaches in-browser
| Element | Reachable? | Notes |
|---|---|---|
| Ship | Yes, fully | Builder upgrades + outline pass + toon ramp. All procedural. |
| Outlines | Yes | Inverted-hull for ship (cheap, crisp) or post-process Sobel on depth+normals (everything). Probably both. |
| Planet | Yes | Quantise fbm to hard-edged continents, stepped shading, crisp atmosphere rim. |
| Asteroids | Yes | Low-subdivision icosahedra, flat-shaded, instanced, outlined. |
| Nebula | Yes | Posterise fbm into 3–4 tonal bands, add layered shape masks. |
| Plume | Yes | Flat stepped chevron shapes, not a gradient. |

## 3. Work items (A) — see PLAN.md M1 for the ordered list
- Perf overlay + quality tiers (M0) so every graphics change is measured.
- Shadow map from the key light, ship-only (small frustum around the player) — cheap, huge readability gain.
- Engine plume: stretched additive quad/ribbon along −Z, length ∝ throttle, colour shifts on boost.
- Bloom threshold up to ~0.7 with a separate emissive channel so only engines/stars/glare bloom, not the planet.
- Asteroid field: `IcosahedronGeometry(r, 1–2)` with vertex noise displacement, 4–6 base shapes instanced via `InstancedMesh`, slow tumble.
- Planet: cloud shell (fbm alpha, slow rotation), ocean specular (Blinn-Phong highlight on sea mask), rings mesh with noise alpha.
- Sky: add a ridged-noise layer for filament detail, a dust-lane mask, a milky-way band with its own star density.

## 4. Silhouette test (for M3)
Every ship def must pass: rendered as a black silhouette at 64 px, side and front, all six ships must be distinguishable from each other. Run via `?view=side&silhouette=1` (to be added).

## 5. Reference capture
Keep `docs/refs/` with screenshots of what we're aiming at, and `docs/shots/` with dated captures of our own build (`YYYY-MM-DD-view.png`) so progress is visible. Both gitignored if they get big.

## 6. Where we are (2026-09-04, late)

What the row-A direction has become after two days, so the next pass argues with the current state and not with section 1.

| Element | Now | Still missing |
|---|---|---|
| Ships | Parametric builder, toon ramp, inverted-hull outlines. Player: Facet (F-302 lineage), F-21 Broadsword heavy, Prometheus. Enemy: glider, interceptor, gunboat, Ha'tak capital. Neutral: racer. Faction palettes per system (bronze default, oxblood lucian, steel-teal serpent). | A silhouette test judged by Ethan, not by capture. Damage states on player hulls. |
| Belts | Three styles through one instanced pipeline: plum/rust rock, pale ice shards, gunmetal wreckage (Astra's derelict pieces). Baked crease lines, per-instance tumble, face-plane collision (convex hull for wrecks). | Non-uniform per-instance scale. Dust or particle haze between pieces. |
| Skies | Six procedural presets (abydos, deepSpace, chulak, ember, void, frost): two nebula lobes, star field, optional soft galactic band. Per-sky grade tint. | A sky authored from a reference painting rather than parameters. |
| Planets | Six presets (desert, ice, lava, jungle, ringed gas giant, moon): hard-stepped land/sea/light, ice line, one ring. | Clouds, city lights, a second moon. |
| Post | MSAA HalfFloat, UnrealBloom on emissives only, grade pass (vignette, saturation, tint), ACES output. Screen-space edge pass off in every tier. | Nothing planned; the outline budget is spent in geometry on purpose. |
| Motion | Plumes scale with throttle and boost, speed dust, kill replay with a cinematic cut, tunnel shader between systems. | Hit sparks on hulls, debris on wreck impacts. |

The single biggest visual risk left is legibility in the wreck field: gunmetal wreck on a deep-space sky at speed. Ethan has not flown it. If it reads as grey mush, the first lever is the `wreck` tint set in `world/asteroids.ts`, the second is a warmer `frost`/`deepSpace` lobe behind it.

