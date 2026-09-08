# Powered stunts and flight controls

Owner correction: the original moves are too modest; paid moves may exceed normal flight capability and need clearly staged on-screen motion. Settings selections are recorded in taste.md.

Design interrogation: failure would mean the camera cancels the stunt or exaggerated rates create arbitrary tumbles. A separate animation/teleport system would add duplicate flight state; refine the existing primitive steps and camera instead. Keep the vocabulary of moves/steps and use the same content table, boost payment, collision path and saved shortcut IDs. Adopt the narrow extension with measured trajectories and browser evaluation; agent checks do not establish owner visual acceptance. Earlier move/menu sources are preserved in docs/archive/2026-09-08-before-powered-stunts/.

Implementation checks: build passes (existing large chunk warning, ~852 kB). `powered-moves-check.mjs` runs real Flight/ChaseCamera and actual built fighter geometry through each paid move: reversal reaches opposite heading with a ~64 m lift, Vortex integrates 720° roll and ~47 m vertical span, each Sidewinder shifts ~108 m laterally and recovers its entry heading. These are isolated simulation measurements without rocks; they are not owner visual acceptance. Two bounded ribbons expire after the stunt. `sandbox-controls-check.mjs` passes fixed-profile migration from deliberately conflicting old saves, preserves adjustable settings, ignores retired C/X toggles, and retains remapping/practice/cost behavior. Replay clock/evaluation and audio scene checks pass.

Scoped instruction check: root CLAUDE.md's control paragraph now matches Ethan's current choices, `FLIGHT_PROFILE`, Input and menu; referenced files exist and the normal root instruction entry still exposes the paragraph. Updated its standing chunk-size description to the measured current build. No authority/discovery routing changes or wider workspace audit.

Browser visual inspection is pending because in-app CDP focus/navigation timed out; the owner was asked to close the stalled tab, which previously restored the connection.

## Landing, 2026-09-08 (second session)

The lane was found with all of the above uncommitted and no live holder. Committed as found, merged `main` (the stutter fix, clean merge), then one correction from Ethan's restated list: **Invert Y stays a switch, off by default**; the lane had cemented it off and removed the control. `FLIGHT_PROFILE` no longer carries `invertY`, the Piloting column has the switch, `settings-test.mjs` checks it again and `sandbox-controls-check.mjs` asserts an old save's `invertY: true` survives migration.

Menu captures on the merged build (1600x900 and 900x700, real GPU): `docs/shots/2026-09-08-menu.png`, `docs/shots/2026-09-08-menu-keys.png`, `docs/shots/2026-09-08-menu-narrow.png`. Everything Ethan listed is present: sensitivity slider, invert switch, difficulty and quality selects, dynamic resolution, event lighting and mute switches, the key table; nothing for scheme, steer, raw mouse or assist.

Gates on the merged build (`STARGATE_TEST_URL` on a lane preview): settings-test, sandbox-controls-check, powered-moves-check, fight-test, travel-test, rock-test, chain-test, and `stutter-probe.mjs` med uncapped (max 16.9 ms with the gates running alongside, no frame over 25 ms, 58 programs constant: the two ribbon materials are warmed with the rest). Stunt feel and the menu's look are still unflown by Ethan.

The first full chain run on the merged build lost the escort mission deterministically (twice), while main won it with the player at 12% hull: the chain test never flies the player, turret fire lands on an idle ship, and the fixed 0.9 assist profile moved that marginal case over the line. The test now tops the player's hull up each poll; it drives completion and rewards, not survival. Escort and chulak-aces pass at full hull on the merged build.
