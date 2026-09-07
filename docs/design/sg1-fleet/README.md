# SG-1 fleet comparison · 2026-09-06

Open `index.html` directly, or `/fleet-review.html` on the game server. It is a
self-contained offline comparison of 12 fleet entries across six camera views,
with five attributed show reference stills. Twelve entries changed (ten hull
families, the veteran glider, and a material-only Ha'tak refinement).

## Use and return

Choose a ship and angle, record a preference and optional note, then use
**Show my review** to copy the summary into chat. Choices persist only in that
browser and do not apply to the game. The two launch links use `?art=revised`
and `?art=original`; there is no save migration. Old individual hulls are also
available as `?hull=old-f11`, `old-glider`, etc. Earlier fighter variants remain.

## Reference evaluation

- F-302: broadened the delta while preserving the selected Facet panels; circular
  engine intakes, understated canopy and modeled missile hardware. Reference:
  https://rdanderson.com/stargate/lexicon/entries/f302.htm
- Death glider: connected the previously separated wing sections into a descending
  crescent, shortened the pod, widened the cockpit, added paired staff cannons.
  Reference: https://rdanderson.com/stargate/lexicon/entries/deathglider.htm
- Al'kesh: replaced the generic delta/box-bridge arrangement with rounded shoulders,
  a four-sided pyramid, belly weapons and four smaller blue exhausts. Reference:
  https://rdanderson.com/stargate/lexicon/entries/alkesh.htm
- Prometheus: retained Ethan's September 6 reference-based silhouette, added
  layered roof plates and flank ribs, reduced the hangar light bars and bridge
  glow. Reference: https://rdanderson.com/stargate/lexicon/entries/prometheus.htm
- Broadsword, Dart, Lancer, interceptor, gunboat and racer are original game ships.
  Their new construction details and quieter materials unify the fleet without
  claiming screen counterparts. The Dart is not the Wraith Dart.
- Ha'tak: the outer structure is dark gunmetal around a gold pyramid, following
  https://rdanderson.com/stargate/lexicon/entries/hatak.htm. All geometry, parts
  and combat behavior remain unchanged. A bulkier ring would be a further iteration.

The reference JPGs were viewed on the linked Richard Dean Anderson Lexicon pages
and saved from their observed `../images/` image URLs. SG-1 stills belong to their
respective rights holders. These are review references, not imported game assets.

## Evidence and reproducibility

`preservation.json` records the base commit and exact original definition checks.
`verification.json` records browser checks of every comparison control, local
preference retention, narrow layout and both art paths in gameplay. The full
capture measurement JSON under `captures/` records triangles and draw calls
(including outlines/decals) from the studio stage; it is not an FPS benchmark.
`build.log` records the TypeScript/Vite build. `review-desktop.png`,
`review-mobile.png`, `contact-sheet.png` and `game-*.png` retain the viewed result.
The normal game side/rear/chase shots are in `docs/shots/2026-09-06-sg1-fleet-*.png`.

Run from the repo with its dev server running:

```
STARGATE_TEST_URL=http://localhost:5187 node scripts/sg1-fleet-captures.mjs
node scripts/sg1-fleet-review.mjs
STARGATE_TEST_URL=http://localhost:5187 node scripts/sg1-fleet-verify.mjs
npm run build
```

The studio imports the actual builder/materials, uses shared framing for each
pair and excludes gameplay/engine plumes. The stage is dev-only and not a game
entrypoint. The offline generated page has no runtime dependency or network
image requests. Browser verification uses isolated test storage.

## Remaining judgment

The visual preference is Ethan's. No owner approval is claimed. This pass keeps
the existing toon shader, nebulae, planets, interface and flight/combat values;
it does not claim a photorealistic or fully screen-accurate game conversion.
Target-hardware frame-rate impact is unmeasured. The returning action is to open
the comparison and identify which revisions to retain or change.


## Further quality improvement discussed with Ethan

Ethan asked about Blender/MCP and stronger 3D authoring on 2026-09-06. Proposed,
not yet authorized or built: use one reference-matched Blender death glider as a
quality benchmark, compare it in gameplay against both retained versions, then
choose whether to expand across the fleet. Shape authoring, bevels, normal and
roughness maps, and appropriate lighting can go beyond the current procedural
builder. No Blender MCP tool is available in this session and no Blender binary
was found on PATH or the checked /opt, /usr/local and ~/.local locations.
`ships/loader.ts` contains an unused glTF loader; it still needs integration with
ShipRig and engine attachment points. The present revision remains procedural.

The capital combat probe (`STARGATE_TEST_URL=http://127.0.0.1:5191/
node scripts/hatak-probe.mjs`) reported `hatak-probe OK`: the shield node was
killable and the player was pushed out of the hull. The six original capital
studio images are byte-identical before and after its material change; retained
hashes are in `capital-original-before.sha256`.
