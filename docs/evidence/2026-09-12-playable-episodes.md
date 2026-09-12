# Playable episode operations — 2026-09-12

Antarctica and Fallen now run as game missions. This closes Ethan's requested two-level functionality pass; it does not turn the other ten art concepts into levels.

## Play and inspect

- Antarctica: `/?mission=antarctic-defense` — escort the Tel’tak, protect Prometheus and the outpost, then hold for the drone salvo.
- Fallen: `/?mission=superweapon-strike` — cross the blue jump ring, shoot the cooling vent, turn out and reach the green escape beacon. The hub unlocks this after Antarctica.
- Sandbox: `/?mission=proving-ground` — 1 Cobra reversal (50% boost), 2 Vortex drive (45%), 3/4 Sidewinder left/right (50%). Saved bindings override those defaults. Costs are paid normally; practice refills between moves.
- Fleet: `/episode-fleet.html` — 21 ship/role samples, including the nine episode hulls and all current combat/flight roles. Also linked from the pause menu. These are inspectable models, not 21 newly flyable player ships.

## Verified behavior

[Build log](episode-playable-checks/build.log): TypeScript and production Vite build pass. The existing large shared-chunk warning remains; no new runtime dependency.

[Terrain check](episode-playable-checks/polar-terrain-check.log): 52,482 triangles in 16 terrain draws, 849 surface-height samples and 60 independent ray comparisons, plus fast sweeps, slopes, penetrations and finite boundary cases. The collision follows the rendered ice surface.

[Deck check](episode-playable-checks/strike-deck-check.log): clear 280 m corridor, clear jump/vent/escape routes, floor/wall contact, fast bulkhead crossing, transformed mesh collision and independent visual-triangle raycasts. Glows are not invisible solid walls.

[Mission check](episode-playable-checks/episode-mission-check.log): actual mission/combat classes exercise escort arrival, bomber target changes, moving/firing defenders, cargo/site failure, player crash damage, damaging drone completion, jump transition, gun destruction of the vent, escape and timeout, blocked shots, and 1,000 actual projectile contacts against a rotated hull. Escape retains its own deadline after the strike window. A separate passive balance probe leaves the player invulnerable and does not shoot; its result is a simulation observation, not a human difficulty rating. The successful completion test deliberately removes hostile fighters after escort arrival to isolate the finale.

[Compatibility check](episode-playable-checks/episode-compat-check.log): actual Game.tick records each completion once and opens a clear return gate; legacy Ha’tak nodes still die from cannon rounds; tracer interpolation preserves simulation endpoints; allied kills do not credit the player. DOM/storage are stubbed in this CPU harness. Travel-to-paused restores mission scenery without advancing its clock, and the initial target distance uses the authored player position.

[Shortcut checks](episode-playable-checks/sandbox-controls-check.log) cover real input events, saved/remapped keys, pause/repeat, low boost and busy feedback, costs and practice refill. [Trajectory checks](episode-playable-checks/powered-moves-check.log) verify the existing reversal, two-roll helix, mirrored lateral cuts, vector velocity, camera containment in landscape/portrait and bounded fading trails. These trajectories predate this pass; cost/progress/rejection feedback is new.

## Browser evidence

The in-app browser rendered both mission arrivals, reached Fallen's attack phase from its jump entry, showed both new editor types and tuning controls, and activated all four stunts with actual 1–4 key presses. [Keyboard observations](../shots/episode-playable/shortcut-observations.json) and [additional sample observations](../shots/episode-playable/sample-observations.json) preserve the displayed state.

Production navigation passed: pause-menu fleet link → gallery → Fallen, and normal Missions → Antarctic destination → Dial & Launch → in-page Antarctic arrival. Pointer-lock acquisition returned a Chromium error in this agent browser; arrival remained paused. That exposed and then verified the fix restoring scenery during paused arrival. This is not a completed human-flown sortie or pointer-lock acceptance claim.

- [Antarctic arrival](../shots/episode-playable/antarctica-approach.png), [production gate arrival](../shots/episode-playable/production-gate-arrival.png), [Fallen approach](../shots/episode-playable/deck-approach.png).
- [Cobra](../shots/episode-playable/move-cobra.png), [Vortex](../shots/episode-playable/move-vortex.png), [left Sidewinder](../shots/episode-playable/move-sidewinder-left.png), [right Sidewinder](../shots/episode-playable/move-sidewinder-right.png).
- Added role samples: [Interceptor](../shots/episode-playable/sample-interceptor.png), [Gunboat](../shots/episode-playable/sample-gunboat.png), [Racer](../shots/episode-playable/sample-racer.png), [Broadsword](../shots/episode-playable/sample-heavy.png), [Dart](../shots/episode-playable/sample-dart.png), [Ace](../shots/episode-playable/sample-ace.png). The previous [48 episode-art captures](2026-09-11-episode-fleet.md) remain available.

## Limits and retention

The levels are first playable balance passes. Complete human-flown victories, pointer-lock feel and performance across device classes remain unverified. The existing Playwright browser suites were not run through a separate browser-control path; focused CPU regressions and supported in-app UI actions supplied the coverage above. HUD frame-rate snapshots are not benchmark results. The maps, hull scale and tactical objectives are game adaptations. No deployment was performed.

All required evidence is in this repository. Generated CPU bundles under `~/.cache/tmp/stargate-explorer/` are reproducible from the checked-in scripts and may be archived when idle; no deletion is authorized by this note. The retained lane is a reproducible local preview checkout.
