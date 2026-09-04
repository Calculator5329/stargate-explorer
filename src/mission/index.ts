import type { LevelDef } from "@/mission/levels";
import type { Mission, MissionCtx } from "@/mission/mission";
import { ClearMission } from "@/mission/clear";
import { RunMission } from "@/mission/run";
import { ProtectMission } from "@/mission/protect";
import { StrikeMission } from "@/mission/strike";

export function createMission(def: LevelDef, ctx: MissionCtx): Mission {
  switch (def.type) {
    case "clear":
      return new ClearMission(def, ctx);
    case "run":
      return new RunMission(def, ctx);
    case "protect":
      return new ProtectMission(def, ctx);
    case "strike":
      return new StrikeMission(def, ctx);
  }
}
