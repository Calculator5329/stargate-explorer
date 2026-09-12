# Sandbox flight lab — 2026-09-12

Use `/?mission=proving-ground`. The sandbox opens the existing pause menu at the flight lab. Choose a preset, resume, steer and press Esc to compare or adjust. The experiment is local to this browser and sandbox; ordinary missions keep their current handling. Shortcuts still use the existing saved move bindings (defaults 1–4).

## Motion and persistence checks

- [Production build](flight-lab-checks/build.log): pass; existing shared-chunk warning only.
- [Handling check](flight-lab-checks/sandbox-handling.log): actual Flight traces prove low-speed turning advantage, a distinct middle-speed peak, hull-normalized curves, stronger braking, lower velocity lag with higher grip, reset isolation, all 16 preset/move trajectory combinations, retained comparison/custom values and corrupt/unavailable storage behavior.
- [Controls check](flight-lab-checks/sandbox-controls.log): real key events, rebinding, repeat/pause, normal cost refusal, practice replenishment and preserved campaign settings/progress.
- [Powered moves](flight-lab-checks/powered-moves.log): existing authored reversal, helix and lateral cuts retain their motion and camera fit.
- [Episode compatibility](flight-lab-checks/episode-compat.log): mission completion, legacy combat, tracer interpolation and paused-arrival visibility still pass in the CPU harness.

In one fixed-input comparison with the same steering power, high grip produced 7.34° nose/velocity separation versus 35.57° with low grip. After one third of a second braking from 240 m/s, the original brake left 186.67 m/s and the stronger brake left 106.67 m/s. These are scripted simulation observations, not ratings of human difficulty or fun. The full probe inputs are in `scripts/sandbox-handling-check.mjs`.

## Browser observations

Native in-app UI actions selected Brake & turn, edited steering power to 1.75×, switched to current handling and back, and reloaded with the custom value retained. Tight grip, Loose drift and Sweet spot selections showed their corresponding values; Sweet spot displayed its 140 m/s target for the default hull. Current handling restored the displayed 1.00× gain, retaining the experiment for comparison. Reset flight position remained reachable.

Actual mouse dragging steered the ship in the supported `lock=free` preview. An actual 2 press launched Vortex, showed 55% remaining boost and live progress. Normal Missions → Antarctica → Dial & Launch performed an in-page trip out of an active experiment; the Antarctic pause menu restored the fixed profile and removed the lab and move guide. [Campaign arrival](../shots/flight-lab/campaign-after-lab.png).

[Desktop panel study](../shots/flight-lab/panel.png) predates the final removal of A/B prefixes from button labels. [Narrow panel](../shots/flight-lab/panel-narrow.png) shows the final labels. [Vortex with tight grip](../shots/flight-lab/vortex-tight-grip.png) and [drift flight](../shots/flight-lab/drift-flight.png) show actual running scenes; the drift capture predates compact narrow-screen hint spacing. [Final compact guide](../shots/flight-lab/compact-guide.png) keeps the ship clear in the narrow preview. These are screenshots, not completed human acceptance.

## Limits and retention

Native pointer-lock acquisition did not resume flight in this agent browser; free flight supplied steering and shortcut coverage. Human mouse feel, difficulty preference and device performance remain unverified. The legacy standalone Playwright suites were not run through a separate browser-control path. No deployment was performed. No general save schema or global campaign tunables are changed by an experiment.

[Primary-source design references](../refs/flight-handling.md) distinguish documented game mechanics from our experimental presets; these are not replicas of Elite Dangerous or Squadrons. The proposal for a separate boost-drift action remains unbuilt; this pass includes loose momentum and the existing paid stunts.

Scoped instruction check: the new taste ruling and decision preserve the fixed profile in CLAUDE.md and the September 8 owner choices. This is sandbox-only physical tuning, with no new instruction authority or cross-repo discovery route.

Authored source, research citations and required evidence are durable in this repo. Generated check bundles under `~/.cache/tmp/stargate-explorer/` are reproducible from the checked-in scripts and idle after validation; no deletion is authorized. The retained flight-lab lane serves the local preview on port 5207.
