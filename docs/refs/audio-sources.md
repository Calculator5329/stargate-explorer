# Audio source candidates — 2026-09-12

Recommendation: use selected **Kenney Sci-Fi Sounds** metallic impacts and explosion crunches as transient layers beneath locally authored bass, noise, and sweeps. Its descriptive filenames make selection straightforward, and its archive includes an explicit CC0 license. This is a suitability inference from creator metadata and archive inspection, **not an audition or a claim about perceived punch**.

## Sources and exact downloads

| Pack | Primary source and license | Exact archive | Candidate role |
| --- | --- | --- | --- |
| Kenney — Sci-Fi Sounds (2020) | [Creator site](https://kenney.nl/assets/sci-fi-sounds), [Kenney's upload](https://opengameart.org/content/sci-fi-sounds); CC0, 70 OGG sounds, creator reports normalized volume | [sci-fi_sounds.zip](https://opengameart.org/sites/default/files/sci-fi_sounds.zip) | Most directly organized set for metal impacts, explosion transients, engine textures, and weapons |
| rubberduck — 50 CC0 Sci-Fi SFX (2018) | [Author upload](https://opengameart.org/content/50-cc0-sci-fi-sfx); CC0, creator describes explosions, machine loops, rockets, shooting, and teleportation | [sci-fi-sfx.zip](https://opengameart.org/sites/default/files/sci-fi-sfx.zip) | Alternate explosion/shot/rocket layers; machine loops for texture |
| rubberduck — 60 CC0 Sci-Fi SFX (2019) | [Author upload](https://opengameart.org/content/60-cc0-sci-fi-sfx); CC0, creator describes 22 effects with variations, 60 total; tags include laser, metal, ambient, warp | [60-sci-fi-sfx_0.zip](https://opengameart.org/sites/default/files/60-sci-fi-sfx_0.zip) | Reserve collection; generic names prevent confident role selection without listening |

All three downloads succeeded and their ZIP directories were inspected on 2026-09-12. They are retained outside the repository at `/home/ethan/.cache/tmp/stargate-explorer/audio-reference/`. No software was installed and no sounds were auditioned during this research.

## Inspected archive paths

Kenney has these paths inside `sci-fi_sounds.zip`:

- `Audio/impactMetal_000.ogg` through `Audio/impactMetal_004.ogg`: metal impact candidates.
- `Audio/explosionCrunch_000.ogg` through `Audio/explosionCrunch_004.ogg`: explosion transient candidates.
- `Audio/lowFrequency_explosion_000.ogg` and `Audio/lowFrequency_explosion_001.ogg`: explosion body candidates.
- `Audio/laserLarge_000.ogg` through `Audio/laserLarge_004.ogg` and corresponding `laserSmall_000`–`004`: weapon layers.
- `Audio/spaceEngineLow_000.ogg` through `Audio/spaceEngineLow_004.ogg`, corresponding `spaceEngineLarge_000`–`004`, and `engineCircular_000`–`004`: engine texture candidates. Loop continuity has not been checked.
- `Audio/thrusterFire_000.ogg` through `Audio/thrusterFire_004.ogg`: boost/ignition candidates.
- `License.txt`: identifies Kenney, Sci-Fi Sounds 1.0, and Creative Commons Zero; explicitly permits personal, educational, and commercial projects and makes credit optional.

rubberduck's 50 pack contains root paths `explosion_01.ogg`, `explosion_02.ogg`, `shoot_01.ogg`, `shoot_02.ogg`, `rocket_01.ogg`, `loop_machine_01.ogg` through `loop_machine_03.ogg`, and `teleport_01.ogg` / `teleport_02.ogg`. Its archive contains OGG files only; retain the linked author-page license provenance when importing.

rubberduck's 60 pack uses generic names such as `sfx_01a.ogg`, `sfx_01b.ogg`, and `sfx_22b.ogg`; its archive also contains OGG files only. Do not assign these to gameplay roles from filenames alone.

## Redistribution and transformations

The creators label these packs CC0. The [Creative Commons CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/) permits copying, modification, and distribution, including commercial use, without requesting permission. This supports retaining selected original or transformed sounds in the game repository and serving them as browser assets. Preserve author/source/license information for provenance; Kenney explicitly says attribution is optional. These are creator uploads, not identified franchise recordings. This research does not independently establish every sound's production history.

## Download identity

SHA-256 of the inspected archives:

```text
119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04  sci-fi_sounds.zip
7824c08e54b5b68d6c70ced9d8fe9e47f86ce19c1d8d47d093e1dc1b579f78ec  sci-fi-sfx.zip
11ebf7d8c4ece445128eeb95c969e0ed36ff34fc2c8ef0e04a154d62e2f938f8  60-sci-fi-sfx_0.zip
```
