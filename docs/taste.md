# Visual feedback

## 2026-09-06 · Fleet review

- Ethan said the revised death glider “is looking good imo,” showing its in-game
  top view. Preserve that silhouette, muted metal and faceted character as the
  approved visual baseline for this hull. This is not approval of every ship.
- Ethan said the Ha'tak “could be improved,” showing the dark-ring/gold-pyramid
  studio view. The next revision should improve its geometry and scale detail,
  not only recolor the same smooth ring. Preserve that iteration for comparison.
- Blender remains a discussed option, not an approved wholesale replacement of
  the current visual style.

## Fleet choices and direction · 2026-09-06
- Revised preferred: Death glider, F-302 lineage, Prometheus, Broadsword, Lancer, Gunboat, Racer, Veteran glider. This is a relative preference, not approval of accuracy.
- Al’kesh: original preferred. Find better reference images before another redesign.
- Prometheus: revised preferred, still inaccurate; use side references.
- Broadsword: changes were too similar to judge as a substantial improvement.
- Dart: undecided; needs a source reference and an SG-1-derived design.
- Interceptor: undecided, neither selected. Do not interpret the ambiguous closing phrase as approval.
- Lancer and Gunboat must also derive from SG-1, as must all the other fighters.
- Ha’tak: undecided, revised much better, continue refinement.
- Veteran glider: revised “way, way, way better”; preserve it.
- Ethan explicitly selected: **Keep roles; use SG-1 craft variants.** Preserve role/stats/progression; make source craft recognizable and label invented loadouts as game variants. Do not reduce the roster.

## Blender benchmark · 2026-09-06
- Ethan authorized one Blender death-glider benchmark and another comparison. **Do not replace any fleet assets yet.** Keep the benchmark separate from ShipRig and the hull registry; compare it in Three.js against the preferred procedural glider before proposing adoption.

### Blender benchmark verdict · 2026-09-06
Ethan: “Blender is slightly better, but I don't know if it's enough that we would actually want to switch to it, since we already have things working in Three.js.” Record as a modest visual preference, **not approval to adopt the asset or change the pipeline**. Keep the procedural glider active and preserve the Blender source/GLB/comparison. Agent recommendation: the modest gain does not currently justify integration and maintenance; Blender would remain an authoring tool feeding Three.js, not replace Three.js. Revisit only with a clearer quality benefit or fresh owner direction.

## Apply review choices · 2026-09-06
Ethan explicitly requested keeping the current procedural approach and implementing the comparison feedback into the game. Use the selected procedural fleet in normal gameplay, retain original Al’kesh, keep SG-1-derived role variants and the refined Prometheus/Ha’tak, and leave Blender separate. Preserve earlier models via art switches.

### Integration clarification · 2026-09-06
Ethan challenged the unnecessary request to approve preserving existing designer documentation before fleet integration. The instruction to implement the reviewed fleet already authorizes routine, reversible preservation needed for that integration. Inspect and retain unrelated work in a separate commit when needed; do not turn the staging convention into a new owner approval gate. Do not discard others’ work or bypass an actual lease conflict.

## Graphics scene direction · 2026-09-08
Ethan authorized recommendations 1–5: coherent transitions without mixed gameplay/audio, staged ship destruction, replay presentation, improved planets, and distinct asteroid replacements. Include optional event lighting for evaluation. Keep the procedural Three.js direction and existing fleet choices. Browser inspection is part of implementation; evaluation scenes must be labelled scripted and report actual state.

## Replay feedback · 2026-09-08
Ethan approved the whole gate trip. Replay is almost right: the kill shot must keep both player and victim in frame, then show a short player follow-through after the kill. Capture up to a configurable N kills within X seconds, not just a single scored kill. Preserve the approved gate trip.

## Replay correction · 2026-09-08, second evaluation
Ethan rejected the revised replay motion as glitchy and visually frozen. Follow-through must play, not silently open a frozen snapshot. Whole playback must visibly move throughout the approach, kill and exit; projected in-frame tests and still captures do not establish this. Preserve the approved gate trip and remove its finished evaluation controls. Multi-kill evaluation needs continuous trajectories without enemies being teleported onto the gun line.

## Replay acceptance and explosion follow-up · 2026-09-08
Ethan reviewed the repaired preview: “all looks good” and explicitly requested push and deployment. The new explosion animation is not satisfactory; defer its refinement until after this delivery. This accepts the replay repair, not the explosion visual quality.

## Sandbox and custom moves · 2026-09-08
Ethan requested a sandbox mode and access to the new moves through custom keys so he can test them. Expose practice directly from the pause menu and gate control, reuse the existing proving-ground mission and four content-authored moves, and let each move have a saved single-key shortcut. Keep existing chords available. Practice should remove death/resource interruptions; HUD hints must follow rebound keys. Movement-feel changes remain proposals until tested/selected.

## Powered movement correction · 2026-09-08
Ethan rejected the modest Cobra/Lunge/Scissor set as not cool or complicated enough. Paid moves should be unmistakable, multi-stage visual stunts, including thrust/rotation combinations unavailable in normal flight. Boost energy buys exceptional movement. Preserve a readable ship silhouette and steady camera reference so the move is visible; do not count larger numbers or a passing sim test as visual acceptance.

## Cemented flight choices and menu · 2026-09-08
Ethan selected classic controls, cursor mouse steering, raw mouse on, flight assist on at 0.9. Remove their settings controls and hidden keyboard/gamepad/URL switches that contradict those fixed choices. Keep sensitivity, invert Y (a switch, off by default: "invert stays a switcher defaulting to no", later the same day), speed-coupled turning, difficulty, quality, dynamic resolution, event lighting, mute and key bindings adjustable. Slim and restyle the menu to fit the game's flight-system/gate-control visual language.

## Episode expansion scope · Ethan, 2026-09-11

“Specifically ones modeled after actual episodes in Stargate SG-1.” Antarctica is “a really huge one.” Build the new ship and level graphics first; “then we'll talk about the order and how to implement these levels later.” The art pass must distinguish researched episode facts from proposed fighter objectives and scene placements. Preserve the preferred existing fleet while introducing missing types. The autonomous window is one hour, with a hard stop by 23:30 America/Chicago on September 11; this session used the earlier elapsed-hour cutoff, 23:27.

## Playable episodes and visible paid moves · Ethan, 2026-09-12

Antarctica then a second episode are now authorized for actual gameplay, including maps, terrain collision, escorts, defenders and attack priorities. Improve Antarctic detail beyond the initial art-study screenshot. After the two missions, make the shortcut-key powered stunts reachable and visibly worthwhile; Ethan says he has not seen the promised cool moves. Do not treat the presence of move JSON or CPU test success as proof that he can find and experience them. This supersedes the September 11 implementation deferral for these two episodes only.


## Paid move visibility · 2026-09-12

Ethan still had not seen the promised paid shortcut stunts. A table or a passing trajectory test alone does not close that complaint: verify the reachable sandbox with the actual bound keys, expose each cost and progress, and explain a rejected press. Existing large trajectories are Cobra reversal, Vortex drive and mirrored Sidewinders; do not call them newly created when only their visibility/feedback changed. The local preview and deployed build must be distinguished in delivery.
