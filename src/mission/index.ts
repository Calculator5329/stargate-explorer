import type { LevelDef } from "@/mission/levels";
import type { Mission, MissionCtx } from "@/mission/mission";
import { ClearMission } from "@/mission/clear";
import { RunMission } from "@/mission/run";
import { ProtectMission } from "@/mission/protect";
import { StrikeMission } from "@/mission/strike";
import { RaceMission } from "@/mission/race";
import { HoldMission } from "@/mission/hold";
import { DuelMission } from "@/mission/duel";
import { HuntMission } from "@/mission/hunt";
import { InterceptMission } from "@/mission/intercept";
import { SandboxMission } from "@/mission/sandbox";

import { PolarMission } from "@/mission/polar";
import { DeckMission } from "@/mission/deck";

export function createMission(def: LevelDef, ctx: MissionCtx): Mission {
  switch (def.type) {
    case "polar": return new PolarMission(def, ctx);
    case "deck": return new DeckMission(def, ctx);
    case "clear":
      return new ClearMission(def, ctx);
    case "run":
      return new RunMission(def, ctx);
    case "protect":
      return new ProtectMission(def, ctx);
    case "strike":
      return new StrikeMission(def, ctx);
    case "race":
      return new RaceMission(def, ctx);
    case "hold":
      return new HoldMission(def, ctx);
    case "duel":
      return new DuelMission(def, ctx);
    case "hunt":
      return new HuntMission(def, ctx);
    case "intercept":
      return new InterceptMission(def, ctx);
    case "sandbox":
      return new SandboxMission(def, ctx);
  }
}
