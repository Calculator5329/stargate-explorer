# Replay repair after owner rejection · 2026-09-08

Ethan approved gate travel and rejected replay motion: multi-kill looked glitchy, follow-through did not play, and whole replay appeared to stop during firing.

## Causes and changes

- The old follow-through button called a freeze/scrub function. It now seeks relative to the final recorded kill and starts playback. Still-frame controls explicitly say Freeze.
- The previous paired camera translated exactly with the ships; a straight pursuit against a distant sky looked frozen. The revised camera starts from a fixed world-space vantage and pans with the action, retaining a fit adjustment when the subjects would leave frame.
- The old encounter placed a victim back on a prescribed line every frame and recycled it for each kill. The replacement spawns the formation once and advances Flight.tick and Combat.tick continuously. Its high-altitude fixture temporarily enlarges the arena so enemy containment does not bend it toward the belt, then restores the setting in a finally block. Each kill uses a real gun hit, spaced by fire timing, and the player turns during the post-kill footage.
- Completed evaluation playback holds rather than silently advancing normal gameplay. Approved gate evaluation controls were removed; production gate travel is untouched.

## Verification so far

`npm run build`, `scripts/replay-clock-check.mjs` and `scripts/replay-evaluation-check.mjs` pass. The new check instantiates real flight, enemies, combat and replay; only GUI/DOM drawing and audio are stubbed. It exercises the actual named Play buttons, continuously advancing playback through completion, real single/three-kill fixtures, fixed-camera intervals, finite coordinates, follow-through seeking/playback and completion hold. Existing checks retain N/X boundary, reproducibility, paired frustum and restoration coverage.

Owner visual acceptance: Ethan reviewed the repaired preview and said “all looks good,” then explicitly authorized push and deployment (2026-09-08). Agent browser control had timed out on focus/screenshots; no agent visual verification is claimed. Ethan separately rejected the quality of the new explosion animation and prioritized delivery before refining it.
