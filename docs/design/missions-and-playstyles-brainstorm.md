# Missions and playstyles: brainstorm (2026-09-05)

Ethan asked for more missions and ships, and a brainstorm on new mission types
and playstyles. This is the brainstorm half. Nothing here is committed work;
each idea says what it would take so the pick is an informed one. The roadmap
carries the one open item that points here.

## Where the game is tonight

Six mission types: clear (waves), run (gate chain against a clock), race (gate
chain against AI), protect (waves around an escort), strike (staged capital
kill) and, new tonight, hold (outlast a clock against endless groups). Fourteen
missions across seven systems. Six flyable hulls: the fighter, the heavy, the
carrier, the light interceptor, the torpedo boat and a captured glider. Five
enemy kinds: glider, interceptor, gunboat, bomber, ace.

What every mission shares: the player is a fighter, the objective is either
"kill" or "fly through", and the belt is the arena. The ideas below are sorted
by how far they move from that.

## A. New mission shapes that reuse what exists

Cheap. Each is data plus a runner of under 150 lines, all driveable by the
chain test.

1. **Hunt.** One named target (an ace, later a bomber with escorts) that runs
   from you through the belt on a scripted waypoint path and only fights when
   cornered. Win when it dies, fail when it reaches the far gate. The runner is
   the run mission's ring chain with the target flying it. New playstyle:
   pursuit, energy management, choosing when to spend boost.
2. **Salvage / recon.** Fly to N marked points (wreck cores, sensor buoys) and
   hold within 40 m for two seconds each while gliders harass. No kill count
   matters. The run mission's rings without the order constraint. Playstyle:
   route planning and disengaging rather than fighting.
3. **Intercept.** Bombers on a straight line to a target you cannot see (the
   gate, a station off-map). Each one that crosses a line 800 m behind you
   costs a point; three points lost fails the mission. Waves never stop until
   the timer ends. Playstyle: prioritising slow tough targets over the fighters
   shooting at you. Cheap because bombers already ignore the player.
4. **Breach.** A minefield in a wall (the strike mission's Mines in a plane)
   with a gunboat behind it; you clear a lane with guns and torpedoes, then the
   friendly racers (AI on the ring chain) fly through it. Fail if two of them
   die. Playstyle: demolition and timing.
5. **Duel.** One ace, no belt (arena set to open space), best of three. Each
   round resets both ships nose-to-nose at 900 m. Pure dogfight test bed;
   also the cleanest way to tune the ace tables. Nearly free.
6. **Gauntlet with a clock that pays.** The run mission scored by margin:
   every second under the limit is a point and every kill on the way is ten.
   Score board per mission in the save. Nothing new to render.

## B. Shapes that need one new system

Medium. Each wants a new folder under `src/` and a decision entry.

7. **Boarding / capture.** Fly into a Ha'tak hangar (the capital already has a
   hangar face) after the guns are down, land, and the mission switches to a
   hold from inside the bay while gliders come in. Needs a landing detector and
   an interior shell. Payoff: the capital becomes a place, not a target.
8. **Convoy with choices.** Three tenders leave at once on diverging paths;
   you cannot cover all three. Which one you save decides the unlock (hull,
   palette or a mission branch). Needs multi-escort protect and a branch field
   on levels. Playstyle: triage.
9. **Wing command.** Two AI wingmen (the racer brain plus the enemy fire
   logic) with three orders on a key: attack my target, cover me, return.
   Every existing mission gets replayable with a wing. Needs a friendly-fighter
   brain; the escort target list already handles who they shoot at.
10. **Station defence.** A fixed structure with turrets you can repair by
    flying to them (the strike mission's turrets flown for the other side).
    Waves come from set vectors, and the minimap shows lanes. Playstyle:
    positional, tower-defence-like.
11. **Gate chase through systems.** A run that ends at a gate, dials the next
    system, and continues the chain there with the clock still running. Needs
    travel to carry mission state across the reload. Payoff: the gates become
    the game instead of a menu.

## C. Playstyles, independent of mission shape

These change how any mission plays and are worth more per hour than another
level.

12. **Loadouts.** Swap the missile rack for one of: a torpedo pair (capital
    damage), a flak burst (area, anti-interceptor), a decoy (pulls the saddle
    logic), or an extra fuel cell (longer boost). Chosen in the hangar, saved.
    Turns the hull choice into a two-axis choice.
13. **Difficulty as modifiers, not a slider.** Toggles with a score
    multiplier: no radar, no assist, hull does not regen, enemies flinch
    always. Pairs with idea 6.
14. **Pursuit camera and padlock view.** Already on the roadmap. Changes the
    feel of every dogfight more than any new enemy would.
15. **A carrier playstyle.** The Prometheus is flyable and slow. Give it point
    defence that fires on its own at anything inside 300 m and a launch key
    that spawns two friendly gliders (the captured hull). The carrier stops
    being a bad fighter and becomes a different game: position the ship, let
    the guns work, manage the wing.
16. **Drift as a stance.** Flight assist off is a toggle today. Make it pay:
    guns do 1.5× while drifting (you are not fighting the nose), enemies lose
    lead on a drifting target. Playstyle: sliding through a wave sideways.
17. **Salvage economy.** Rocks broken and hulls killed drop shards the ship
    collects on contact; shards buy loadout items. Gives the belt a reason to
    be shot at.

## D. Ships worth adding next

- **A friendly capital that fights.** The Prometheus as an AI ally in a strike
  mission: it trades broadsides with the Ha'tak while you kill the parts.
  Mostly a target list change and a turret loop.
- **An enemy carrier.** A smaller capital (the show's bomber-carrier scale)
  that spawns gliders until its hangar is killed. Reuses the capital's part
  machine with two parts.
- **Drone swarm.** Ten tiny fast targets with one hit point each and a shared
  brain that flocks. New brain, cheap hull. Playstyle: guns only, spray and
  sweep.
- **A player gunboat.** The captured-hull trick applied to the gunboat: slow,
  four guns, huge hull. Zero art cost.

## Suggested first picks

Plural, as always; these are three different bets, not a ranking.

- **Breadth for cheap:** ideas 5 (duel) and 1 (hunt). Two new mission types,
  under a day, and the duel doubles as the tuning bench for every enemy kind.
- **Depth on what exists:** ideas 12 (loadouts) and 15 (carrier playstyle).
  Nothing new to see, everything new to fly.
- **The big swing:** idea 11 (gate chase across systems) plus 9 (wingmen).
  Makes the gates and the fleet the game. Two to three sessions.

Whichever bet lands, the ace table and the bomber table want a pass from
Ethan's hands first; every idea above leans on those two kinds.

## Rulings (Ethan, 2026-09-06, chat)

- **Built:** 5 duel ("super good idea and pretty cheap. It's more of a free play
  mode"), 1 hunt ("really good idea"), 3 intercept ("okay, but it's less
  interesting ... since they're free, I would say go ahead and do it").
- **Later, in the roadmap:** 12 loadouts, growing into custom ships and
  add-ons; combo maneuvers (not in the list above: B plus W/A/D as
  predetermined moves paid from boost energy, "Mortal Kombat style"); a
  first-person foot mode, with gate-walking as part of the game "but not the
  entire point"; 7 boarding after foot mode; planet surfaces far out; bases
  that park ships, hold the upgrader and gate between planets.
- **Constraints:** third person stays for space. Scope guard: "we don't
  necessarily want to charge forward on everything that broadens scope because
  we are just going to turn ourselves into like No Man's Sky."
- **Not ruled on:** 2, 4, 6, 8, 9, 10, 11, 13, 15, 16, 17 and the ships in D.
