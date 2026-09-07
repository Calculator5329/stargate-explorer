import { T } from "@/core/tunables";
import { D } from "@/core/difficulty";
import { ENEMY_KINDS, type EnemyKind } from "@/combat/enemy-kinds";
import { SHIPS, type PlayerShip } from "@/ships/registry";
import type { LevelDef, Wave } from "@/mission/levels";

/**
 * The power curve: a paper estimate of how hard each level is for the ship a player would have there,
 * from the same numbers the game runs on (`T`, the difficulty preset, the ship stats). It is a model,
 * not a measurement: the constants below (hit rates, exposure) are the guesses that make the numbers
 * land near what the headless fights show. Use it to see the shape of the campaign and to catch a
 * spike; do not tune a single level to a decimal of it.
 *
 *   threat   damage taken over the level as a fraction of the hull; 1.0 = dead with no regen
 *   clearMin estimated minutes to finish
 *   pressure kill rate demanded / kill rate available (hold, intercept, strike); above 1 the clock wins
 */
export interface PowerRead {
  threat: number;
  clearMin: number;
  pressure: number;
  enemyHp: number;
  peakDps: number;
  ship: string;
  note: string;
}

/**
 * fraction of player rounds that connect, of enemy rounds that connect, and of the fight enemies spend with the
 * player in their cone. Set by feel against the fighter missions on 2026-09-06 (three gliders cost about a fifth
 * of the hull); recalibrate here, in one place, when a headless fight can measure it.
 */
const HIT = 0.35, ACC = 0.08, EXPOSURE = 0.25;

interface Player { dps: number; hp: number; missiles: number; cruise: number }

function player(ship: PlayerShip): Player {
  const s = ship.stats;
  return { dps: T.weapons.fireRate * T.weapons.damage * s.guns * HIT, hp: T.player.hp * s.hull, missiles: s.missiles * T.missile.damage * 0.7, cruise: T.flight.cruiseSpeed * s.speed };
}

function kindHp(k: EnemyKind): number {
  return ENEMY_KINDS[k].stats.hp * D.enemyHp;
}
function kindDps(k: EnemyKind): number {
  const s = ENEMY_KINDS[k].stats;
  return T.weapons.enemyFireRate * s.fireRate * T.weapons.enemyDamage * s.damage * D.enemyDamage * ACC;
}
function cycle(count: number, kinds: EnemyKind[] | undefined): EnemyKind[] {
  const out: EnemyKind[] = [];
  for (let i = 0; i < count; i++) out.push(kinds?.length ? kinds[i % kinds.length]! : "glider");
  return out;
}
function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** the strongest hull (by hull × guns) the chain has handed over before this level, else the fighter */
export function shipAt(levels: readonly LevelDef[], id: string): PlayerShip {
  const have = new Set<string>(["f11"]);
  const seen = new Set<string>();
  let cur = levels.find((l) => l.id === id)?.requires;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const l = levels.find((x) => x.id === cur);
    if (l?.unlocks && SHIPS[l.unlocks]) have.add(l.unlocks);
    cur = l?.requires;
  }
  let best = SHIPS.f11!;
  for (const s of have) {
    const p = SHIPS[s]!;
    if (p.stats.hull * p.stats.guns > best.stats.hull * best.stats.guns) best = p;
  }
  return best;
}

/** levels in campaign order: every level after the one it requires, then by act order, then left to right on the board */
export function chainOrder(levels: readonly LevelDef[], actIds: readonly string[]): LevelDef[] {
  const rank = (l: LevelDef): number => (actIds.indexOf(l.act ?? "") + 1) * 1e6 + (l.board?.x ?? 0) * 100 + (l.board?.y ?? 0) / 100;
  const sorted = [...levels].sort((a, b) => rank(a) - rank(b));
  const out: LevelDef[] = [], done = new Set<string>();
  const visit = (l: LevelDef, depth: number): void => {
    if (done.has(l.id) || depth > 64) return;
    const req = l.requires ? sorted.find((x) => x.id === l.requires) : undefined;
    if (req) visit(req, depth + 1);
    done.add(l.id);
    out.push(l);
  };
  for (const l of sorted) visit(l, 0);
  return out;
}

function waves(ws: Wave[], p: Player): { threat: number; clearMin: number; enemyHp: number; peakDps: number } {
  let pool = p.missiles, dmg = 0, t = 0, hpAll = 0, peak = 0;
  for (const w of ws) {
    const kinds = cycle(w.count, w.kinds);
    const hp = sum(kinds.map(kindHp)), dps = sum(kinds.map(kindDps));
    const used = Math.min(pool, hp * 0.5);
    pool -= used;
    const fight = (hp - used) / p.dps + w.count * 1.5 + (w.near + w.far) / 2 / (p.cruise * 2);
    dmg += dps * EXPOSURE * fight;
    t += fight + w.delay;
    hpAll += hp;
    peak = Math.max(peak, dps);
  }
  return { threat: dmg / p.hp, clearMin: t / 60, enemyHp: hpAll, peakDps: peak };
}

export function power(level: LevelDef, ship: PlayerShip): PowerRead {
  const p = player(ship);
  const base = { pressure: 0, ship: ship.id, note: "" };
  switch (level.type) {
    case "clear":
      return { ...base, ...waves(level.waves, p), note: `${level.waves.length} waves, ${sum(level.waves.map((w) => w.count))} ships` };
    case "protect": {
      const r = waves(level.waves, p);
      // heavies on the escort: whatever gunboats and bombers do while you are busy with the rest
      const heavies = level.waves.flatMap((w) => cycle(w.count, w.kinds)).filter((k) => k === "gunboat" || k === "bomber");
      const escortDmg = sum(heavies.map(kindDps)) * 0.5 * (r.clearMin * 60 * 0.4);
      const escortThreat = escortDmg / level.escortHp;
      return { ...base, ...r, threat: Math.max(r.threat, escortThreat), note: `escort takes ~${Math.round(escortThreat * 100)}% of ${level.escortHp} hull` };
    }
    case "run":
    case "race":
    case "hunt": {
      const courseT = (level.rings * level.spacing) / (p.cruise * 0.85);
      const slack = courseT / level.timeLimit;
      const chaseT = level.harassAt < level.rings ? courseT * (1 - level.harassAt / level.rings) : 0;
      const kinds = cycle(level.harass, level.harassKinds);
      let dmg = sum(kinds.map(kindDps)) * EXPOSURE * chaseT;
      dmg += level.minesPerGate * level.rings * 0.06 * 20; // one gate in sixteen clips a mine
      let pressure = slack;
      let note = `course ${Math.round(courseT)} s of ${level.timeLimit} s, gates ${level.ringRadius} m at ${level.spacing} m`;
      if (level.type === "hunt") {
        pressure = level.quarrySpeed / (p.cruise * 1.6);
        dmg += kindDps(level.quarry) * EXPOSURE * level.fightT * 2;
        note = `quarry ${level.quarrySpeed} m/s vs your boost ${Math.round(p.cruise * 1.6)}; ${kindHp(level.quarry)} hp to chew`;
      }
      if (level.type === "race") {
        pressure = level.racerSpeed / (p.cruise * 1.1);
        note = `rivals ${level.racerSpeed} m/s vs your cruise ${Math.round(p.cruise)}`;
      }
      return { ...base, threat: dmg / p.hp, clearMin: courseT / 60, pressure, enemyHp: sum(kinds.map(kindHp)), peakDps: sum(kinds.map(kindDps)), note };
    }
    case "hold": {
      const groups = Math.max(1, Math.floor((level.duration - level.firstDelay) / level.interval) + 1);
      let spawned = 0;
      for (let g = 0; g < groups; g++) spawned += level.groupStart + level.groupGrow * ((level.firstDelay + g * level.interval) / 60);
      const all = cycle(Math.round(spawned), level.kinds);
      const hpAll = sum(all.map(kindHp)), avgDps = sum(all.map(kindDps)) / Math.max(1, all.length);
      const alive = Math.min(level.maxAlive, spawned / groups + 1);
      const dmg = avgDps * alive * EXPOSURE * level.duration;
      const restock = level.restockEvery > 0 ? Math.floor(level.duration / level.restockEvery) : 0;
      const pressure = (hpAll - p.missiles * (1 + restock)) / (p.dps * level.duration);
      return { ...base, threat: dmg / p.hp, clearMin: level.duration / 60, pressure, enemyHp: hpAll, peakDps: avgDps * alive, note: `~${Math.round(spawned)} ships over ${level.duration} s, ${alive.toFixed(1)} alive on average` };
    }
    case "intercept": {
      const groups = Math.max(1, Math.floor((level.duration - level.firstDelay) / level.interval) + 1);
      let runners = 0;
      for (let g = 0; g < groups; g++) runners += level.groupStart + level.groupGrow * ((level.firstDelay + g * level.interval) / 60);
      const escorts = cycle(Math.round(groups * level.escortsPer), level.escortKinds);
      const transit = ((level.near + level.far) / 2 + level.lineBehind) / level.runnerSpeed;
      const perGroup = runners / groups;
      const killT = (perGroup * kindHp(level.runner)) / (p.dps + p.missiles / level.duration);
      const pressure = killT / transit;
      const dmg = sum(escorts.map(kindDps)) / groups * EXPOSURE * level.duration + kindDps(level.runner) * 0.3 * level.duration;
      return { ...base, threat: dmg / p.hp, clearMin: level.duration / 60, pressure, enemyHp: runners * kindHp(level.runner) + sum(escorts.map(kindHp)), peakDps: sum(escorts.map(kindDps)) / groups, note: `~${Math.round(runners)} runners, ${Math.round(transit)} s each to the relay, ${Math.round(killT)} s to kill a group` };
    }
    case "strike": {
      const hull = 6 * 40 + 3 * 80 + 600;
      const escorts = cycle(level.escorts, level.escortKinds), reinf = cycle(level.reinforce * 3, level.reinforceKinds);
      const fighters = sum([...escorts, ...reinf].map(kindHp));
      // each part wants an approach and a line-up on top of the rounds it eats: turrets, then nodes, then the core
      const fightT = (hull + fighters - p.missiles) / p.dps + 6 * 8 + 3 * 12 + 20;
      const dps = sum(escorts.map(kindDps)) + sum(reinf.map(kindDps)) / 3 + 6 * 0.4; // turrets mostly miss a strafing fighter
      const dmg = dps * EXPOSURE * fightT + level.mines * 0.08 * 20;
      return { ...base, threat: dmg / p.hp, clearMin: fightT / 60, pressure: 0, enemyHp: hull + fighters, peakDps: dps, note: `${hull} hull on the ship, ${escorts.length + reinf.length} fighters over the fight, ${level.mines} mines` };
    }
    case "sandbox":
      return { ...base, threat: 0, clearMin: 0, enemyHp: 0, peakDps: 0, note: "nothing shoots back" };
    case "duel": {
      const roundT = kindHp(level.foe) / p.dps + 12;
      const dmg = kindDps(level.foe) * EXPOSURE * roundT;
      return { ...base, threat: dmg / p.hp, clearMin: (level.rounds * (roundT + level.pause)) / 60, pressure: 0, enemyHp: kindHp(level.foe) * level.rounds, peakDps: kindDps(level.foe), note: `${ENEMY_KINDS[level.foe].label.toLowerCase()} ${kindHp(level.foe)} hp, hull restored between rounds` };
    }
  }
}
