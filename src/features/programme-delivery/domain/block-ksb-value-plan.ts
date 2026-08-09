/**
 * Bridge: run programme-definition RPL formulas for management learner RPL UI.
 */

import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
} from "@/features/programme-definition/domain/types";
import {
  runBlockKsbValueV1,
  type BlockKsbValueV1Result,
} from "@/features/programme-definition/domain/rpl-formulas";
import type { BlockRplInput } from "./rpl-funding-calc";
import { emptyBlockRpl } from "./rpl-funding-calc";

export function buildBlockKsbValuePlanForProgramme(args: {
  programme: GtaProgrammeVersion;
  official: OfficialStandardVersion;
  rplByBlockId: Record<string, BlockRplInput>;
}): BlockKsbValueV1Result {
  const { programme, official, rplByBlockId } = args;
  const blocks = programme.spineItems
    .filter((i) => i.itemType === "block")
    .map((item) => {
      const learner = rplByBlockId[item.id] ?? emptyBlockRpl();
      return {
        blockId: item.id,
        plannedOtjHours: item.plannedOtjHours,
        learner: {
          knowledgePct: learner.knowledgePct,
          skillsPct: learner.skillsPct,
          behavioursPct: learner.behavioursPct,
        },
      };
    });

  return runBlockKsbValueV1({
    spineItems: programme.spineItems,
    mappings: programme.ksbMappings ?? [],
    officialKsbs: official.ksbs,
    programmeExpectedOtjHours: programme.parameters?.expectedOtjHours ?? null,
    blocks,
    params: {
      fundingBandPounds: programme.parameters?.fundingBandPounds ?? null,
      fixedCostLines: programme.parameters?.fixedCostLines ?? [],
      includeRplKnowledge: programme.parameters?.includeRplKnowledge,
      includeRplSkills: programme.parameters?.includeRplSkills,
      includeRplBehaviours: programme.parameters?.includeRplBehaviours,
    },
  });
}
