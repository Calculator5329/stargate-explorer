# Blender death-glider benchmark

Ethan authorized **one Blender benchmark and another comparison, without replacing anything** on September 6, 2026. The current playable fleet and preferred procedural glider remain unchanged.

Open `http://127.0.0.1:5191/benchmarks/glider-comparison.html`, or the self-contained `index.html`. It compares original/current procedural ships against the new GLB in six matched Three.js views. The default material treatment uses the game's toon materials/palette and outline helper; Metallic uses the exported PBR materials and a generated neutral reflection environment. The page links a live orbit inspector and the editable source.

## What was authored

`death-glider-benchmark.blend` is an editable Blender 4.5.3 scene with separate wing, hull, canopy, frame, panel-seam, cannon and engine components. `scripts/blender-glider.py` reproduces it with Blender's Python API. The exported `public/benchmarks/death-glider.glb` is a self-contained indexed mesh with five material primitives and four named attachment empties. The source is saved before an export duplicate is joined; no source components are discarded. No image generator, downloaded model, texture pack or Blender MCP was used.

A portable Blender 4.5.3 Linux build was downloaded from Blender's official mirror into `/home/ethan/.cache/tmp/blender-benchmark-runtime/`. No system installation or package dependency was changed. This runtime is not committed. Run from the worktree:

```
/home/ethan/.cache/tmp/blender-benchmark-runtime/blender-4.5.3-linux-x64/blender --background --factory-startup --python scripts/blender-glider.py
node scripts/blender-benchmark.mjs
npm run build
```

The comparison capture requires a dev server (default 5191, override `STARGATE_TEST_URL`) and browser execution outside the sandbox. `--review-only` reuses retained mesh captures while rebuilding and checking the HTML.

## Three.js compatibility and limits

The separate `src/ships/blender-benchmark.ts` entry imports the app's existing `loadShipGLTF`, toon and outline helpers. It is only loaded by this review's `stage.html`, never by ShipRig, the hull registry or gameplay. The current production JavaScript build filenames remain unchanged from the prior fleet revision.

`verification.json` records 24 rendered mesh/material/angle combinations, triangle/draw-call counts and attachment positions. `review-verification.json` records baseline/material/angle controls, feedback persistence/export, mobile overflow, offline HTML and actual live orbit interaction. `asset.json` records Blender's source triangle/material counts. `comparison-desktop.png`, `comparison-mobile.png` and `orbit-inspection.png` show the reviewed artifact.

The Blender → glTF axis conversion was checked through the exported nodes: engines point aft (negative Z), muzzles forward (positive Z), port positive X, vertical position Y. Units are game-space metres. A later playable integration would still need asynchronous preloading, ShipRig attachment-driven plumes/muzzles, faction materials, collision/scale judgment, disposal and replay checks. None is silently installed by this benchmark.

The mesh is a stylized reference-based interpretation, not a measured production replica. Reference: [Richard Dean Anderson SG-1 Lexicon](https://rdanderson.com/stargate/lexicon/entries/deathglider.htm). Current source geometry has 13,692 triangles before outlines. This is a visual benchmark, not an FPS benchmark; target-hardware cost remains unmeasured. No normal maps, texture painting, animated wings or gameplay effects are claimed.

## Owner verdict · September 6, 2026

Ethan judged Blender slightly better but questioned whether that improvement justified switching from the working approach. This is not adoption approval. The procedural glider remains active; the benchmark stays preserved and separate. Blender would feed the existing Three.js renderer, not replace it. The agent recommends retaining the current workflow given this modest visual gain and the extra asset integration/maintenance.
