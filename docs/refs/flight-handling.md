# Flight handling precedents

Research checked 2026-09-12. These are design references for sandbox experiments,
not reproductions of either game's physics or tuning.

## Supported mechanics

- **Elite Dangerous:** the player guide's cockpit speed-indicator description
  says the blue speed range gives the best manoeuvrability and smallest turning
  circle. This supports making a favourable turning-speed band visible; it does
  not supply a numerical turn-rate curve or justify assuming maximum turn rate
  at zero speed. [Frontier player guide, Cockpit Interface / Speed Indicator](https://d1wv0x2frmpnh.cloudfront.net/elite/website/assets/English-PlayersGuide_v2.00-Horizons.pdf).
- **Star Wars: Squadrons:** EA's PC manual gives separate keyboard commands for
  boost and drift while boosting, alongside throttle, pitch, yaw and roll. This
  supports treating drift as an intentional manoeuvre with an activation
  condition. The controls manual does not establish a momentum-retention value,
  angular acceleration, turn-rate bonus, or drift duration. [EA PC text manual](https://www.ea.com/able/resources/star-wars/star-wars-squadrons/pc/text-manual).

The former EA boost-and-drift tips URL currently redirects to a product page
when fetched directly. Its detailed physical claims are not used here. The
Frontier PDF was downloaded and text-extracted because the web reader rejected
its size; the speed-indicator wording was verified in that extraction.

## Sandbox proposals

These are our experiments, not sourced game specifications. Keep the established
classic controls, cursor steering, raw mouse and assist choice; compare handling
parameters without silently changing those choices.

| Preset idea | Distinct experiment | What the pilot should compare |
| --- | --- | --- |
| Direct response | Short angular response time and quick velocity alignment | How easily the nose settles on a target after a turn |
| Turning band | Broad maximum-turn band at moderate speed, softer turning above and below | Whether slowing to the marked band helps an overshoot become a useful turn |
| Momentum | Slower velocity alignment while retaining responsive nose rotation | Whether aiming across the travel direction feels controllable and readable |
| Boost drift | A deliberate boost-to-drift transition temporarily reduces velocity alignment, then smoothly restores it | Whether the pilot can rotate, preserve a visible travel arc, and recover predictably |

Useful live controls are angular response, maximum pitch/yaw rates, velocity
alignment, turn-band centre/width/strength, and boost-drift recovery time. Show
the current speed and nose-versus-travel angle so the pilot can connect a slider
change to the motion. Any displayed numbers should come from the running sim;
subjective labels such as responsive or floaty remain descriptions.

Use the same straight approach, sustained turn and boost-release turn for each
comparison. The tuning values still need actual flying and Ethan's verdict.
