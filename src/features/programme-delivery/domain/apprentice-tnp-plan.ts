/**
 * Build TNP1 for an apprentice against a programme version + learner RPL %.
 */

import type {
  GtaProgrammeVersion,
  OfficialStandardVersion,
} from "@/features/programme-definition/domain/types";
import {
  calculateTnp1,
  type Tnp1CalcResult,
} from "@/features/programme-definition/domain/rpl-formulas";
import type { BlockRplInput } from "./rpl-funding-calc";
import { buildBlockKsbValuePlanForProgramme } from "./block-ksb-value-plan";

export type ApprenticeTnpPlan = {
  rpl: ReturnType<typeof buildBlockKsbValuePlanForProgramme>;
  tnp: Tnp1CalcResult;
};

export function buildApprenticeTnpPlan(args: {
  programme: GtaProgrammeVersion;
  official: OfficialStandardVersion;
  rplByBlockId: Record<string, BlockRplInput>;
}): ApprenticeTnpPlan {
  const rpl = buildBlockKsbValuePlanForProgramme(args);
  const tnp = calculateTnp1({
    fundingBandPounds: args.programme.parameters?.fundingBandPounds ?? null,
    fixedCostLines: args.programme.parameters?.fixedCostLines ?? [],
    programmeCurriculumValue: rpl.programmeCurriculumValue,
    remainingProgrammeValue: rpl.remainingProgrammeValue,
    recognisedProgrammeValue: rpl.recognisedProgrammeValue,
  });
  return { rpl, tnp };
}
