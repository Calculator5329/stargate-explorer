# Powered stunts and flight controls — in progress

Owner correction: the original moves are too modest; paid moves may exceed normal flight capability and need clearly staged on-screen motion. Settings selections are recorded in taste.md.

Design interrogation: failure would mean the camera cancels the stunt or exaggerated rates create arbitrary tumbles. A separate animation/teleport system would add duplicate flight state; refine the existing primitive steps and camera instead. Keep the vocabulary of moves/steps and use the same content table, boost payment, collision path and saved shortcut IDs. Adopt the narrow extension with measured trajectories and browser evaluation; agent checks do not establish owner visual acceptance. Earlier move/menu sources are preserved in docs/archive/2026-09-08-before-powered-stunts/.

Implementation checks: build passes (existing large chunk warning, ~852 kB). `powered-moves-check.mjs` runs real Flight/ChaseCamera and actual built fighter geometry through each paid move: reversal reaches opposite heading with a ~64 m lift, Vortex integrates 720° roll and ~47 m vertical span, each Sidewinder shifts ~108 m laterally and recovers its entry heading. These are isolated simulation measurements without rocks; they are not owner visual acceptance. Two bounded ribbons expire after the stunt. `sandbox-controls-check.mjs` passes fixed-profile migration from deliberately conflicting old saves, preserves adjustable settings, ignores retired C/X toggles, and retains remapping/practice/cost behavior. Replay clock/evaluation and audio scene checks pass.

Scoped instruction check: root CLAUDE.md's control paragraph now matches Ethan's current choices, `FLIGHT_PROFILE`, Input and menu; referenced files exist and the normal root instruction entry still exposes the paragraph. Updated its standing chunk-size description to the measured current build. No authority/discovery routing changes or wider workspace audit.

Browser visual inspection is pending because in-app CDP focus/navigation timed out; the owner was asked to close the stalled tab, which previously restored the connection.
