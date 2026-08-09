/**
 * block_ksb_value_v1 — VALUE_SHARE OTJ methodology.
 *
 * Individual KSB curriculumValue → Block Value → recognised value → OTJ.
 * No 30% cap. No programme K/S/B weights. Primary is not financial.
 *
 * includeRpl* controls which official dimensions may generate recognised value.
 * Excluded dimensions stay in curriculum totals / VALUE_SHARE denominator.
 */

import type { BlockKsbMapping, ImportedKsb, SpineItem } from "../types";
import {
  calculateBlockCurriculumTotals,
  calculateProgrammeCurriculumValue,
  trainingBlockIds,
  buildKsbTypeMap,
  type BlockCurriculumTotals,
} from "./block-curriculum-value";
import {
  assertLearnerRplPercent,
  type LearnerBlockRplPercents,
} from "./learner-rpl-percent";
import {
  isProgrammeRplDimensionEnabled,
  type ProgrammeRplIncludeFlags,
} from "./available-rpl-dimensions";

/** Phase 1 params + Phase 2 finance fields stored on the programme version. */
export type BlockKsbValueV1Params = {
  fundingBandPounds: number | null;
  fixedCostLines: import("./tnp1").FixedCostLineItem[];
  /**
   * Missing ⇒ true (historical programme snapshots remain fully eligible).
   * Independent of legacy includeApl*.
   */
  includeRplKnowledge?: boolean;
  includeRplSkills?: boolean;
  includeRplBehaviours?: boolean;
};

export type BlockKsbValueV1BlockInput = {
  blockId: string;
  /** Delivery OTJ — pass-through only; not used for VALUE_SHARE maths. */
  plannedOtjHours: number;
  learner: LearnerBlockRplPercents;
};

export type BlockKsbValueV1Input = {
  spineItems: SpineItem[];
  mappings: BlockKsbMapping[];
  officialKsbs: Pick<ImportedKsb, "code" | "type">[];
  /** Versioned programme configuration — never hard-coded in the runner. */
  programmeExpectedOtjHours: number | null;
  blocks: BlockKsbValueV1BlockInput[];
  params?: BlockKsbValueV1Params;
};

export type BlockKsbValueV1BlockResult = {
  blockId: string;
  knowledgeValue: number;
  skillsValue: number;
  behaviourValue: number;
  blockValue: number;
  recognisedKnowledgeValue: number;
  recognisedSkillsValue: number;
  recognisedBehaviourValue: number;
  recognisedBlockValue: number;
  remainingBlockValue: number;
  recognisedFraction: number;
  plannedOtjHours: number;
  derivedBlockCurriculumOtj: number;
  recognisedOtj: number;
  remainingOtj: number;
};

export type BlockKsbValueV1Result = {
  formulaKey: "block_ksb_value_v1";
  otjAllocation: "VALUE_SHARE";
  programmeCurriculumValue: number;
  hoursPerCurriculumUnit: number | null;
  otjAllocatable: boolean;
  recognisedProgrammeValue: number;
  remainingProgrammeValue: number;
  recognisedOtj: number;
  remainingOtj: number;
  derivedProgrammeCurriculumOtj: number;
  blocks: BlockKsbValueV1BlockResult[];
};

function resolveIncludeFlags(
  params: BlockKsbValueV1Params | undefined,
): ProgrammeRplIncludeFlags {
  return {
    includeRplKnowledge: params?.includeRplKnowledge,
    includeRplSkills: params?.includeRplSkills,
    includeRplBehaviours: params?.includeRplBehaviours,
  };
}

function recognise(
  totals: BlockCurriculumTotals,
  learner: LearnerBlockRplPercents,
  include: ProgrammeRplIncludeFlags,
): Pick<
  BlockKsbValueV1BlockResult,
  | "recognisedKnowledgeValue"
  | "recognisedSkillsValue"
  | "recognisedBehaviourValue"
  | "recognisedBlockValue"
  | "remainingBlockValue"
  | "recognisedFraction"
> {
  const recognisedKnowledgeValue = isProgrammeRplDimensionEnabled(
    include,
    "knowledge",
  )
    ? totals.knowledgeValue *
      (assertLearnerRplPercent(
        learner.knowledgePct,
        "Knowledge already held %",
      ) /
        100)
    : 0;
  const recognisedSkillsValue = isProgrammeRplDimensionEnabled(
    include,
    "skill",
  )
    ? totals.skillsValue *
      (assertLearnerRplPercent(
        learner.skillsPct,
        "Skills already demonstrated %",
      ) /
        100)
    : 0;
  const recognisedBehaviourValue = isProgrammeRplDimensionEnabled(
    include,
    "behaviour",
  )
    ? totals.behaviourValue *
      (assertLearnerRplPercent(
        learner.behavioursPct,
        "Behaviours already evidenced %",
      ) /
        100)
    : 0;
  const recognisedBlockValue =
    recognisedKnowledgeValue +
    recognisedSkillsValue +
    recognisedBehaviourValue;
  const remainingBlockValue = totals.blockValue - recognisedBlockValue;
  const recognisedFraction =
    totals.blockValue > 0 ? recognisedBlockValue / totals.blockValue : 0;

  return {
    recognisedKnowledgeValue,
    recognisedSkillsValue,
    recognisedBehaviourValue,
    recognisedBlockValue,
    remainingBlockValue,
    recognisedFraction,
  };
}

/**
 * Pure runner for block_ksb_value_v1.
 * Assumes curriculumValue on mappings is already validated (> 0).
 * Assumes learner percents are validated (0–100 finite) — asserts if not.
 * Excluded RPL dimensions contribute 0 recognised value; curriculum unchanged.
 */
export function runBlockKsbValueV1(
  input: BlockKsbValueV1Input,
): BlockKsbValueV1Result {
  const ksbTypes = buildKsbTypeMap(input.officialKsbs);
  const blockIds = trainingBlockIds(input.spineItems);
  const blockIdSet = new Set(blockIds);
  const include = resolveIncludeFlags(input.params);

  // Enforce block-only: ignore any mapping whose target is not a training block.
  const mappings = input.mappings.filter((m) => blockIdSet.has(m.blockId));

  const totalsById = new Map<string, BlockCurriculumTotals>();
  for (const blockId of blockIds) {
    totalsById.set(
      blockId,
      calculateBlockCurriculumTotals(blockId, mappings, ksbTypes),
    );
  }

  const programmeCurriculumValue = calculateProgrammeCurriculumValue([
    ...totalsById.values(),
  ]);

  const expectedOtj = input.programmeExpectedOtjHours;
  const otjAllocatable =
    expectedOtj != null &&
    Number.isFinite(expectedOtj) &&
    expectedOtj >= 0 &&
    programmeCurriculumValue > 0;

  const hoursPerCurriculumUnit = otjAllocatable
    ? (expectedOtj as number) / programmeCurriculumValue
    : null;

  const learnerByBlock = new Map(
    input.blocks.map((b) => [b.blockId, b] as const),
  );

  const blocks: BlockKsbValueV1BlockResult[] = [];
  for (const blockId of blockIds) {
    const totals = totalsById.get(blockId)!;
    const blockInput = learnerByBlock.get(blockId);
    const learner: LearnerBlockRplPercents = blockInput?.learner ?? {
      knowledgePct: 0,
      skillsPct: 0,
      behavioursPct: 0,
    };
    const recognition = recognise(totals, learner, include);
    const unit = hoursPerCurriculumUnit ?? 0;

    blocks.push({
      blockId,
      knowledgeValue: totals.knowledgeValue,
      skillsValue: totals.skillsValue,
      behaviourValue: totals.behaviourValue,
      blockValue: totals.blockValue,
      ...recognition,
      plannedOtjHours: blockInput?.plannedOtjHours ?? 0,
      derivedBlockCurriculumOtj: totals.blockValue * unit,
      recognisedOtj: recognition.recognisedBlockValue * unit,
      remainingOtj: recognition.remainingBlockValue * unit,
    });
  }

  const recognisedProgrammeValue = blocks.reduce(
    (s, b) => s + b.recognisedBlockValue,
    0,
  );
  const remainingProgrammeValue = blocks.reduce(
    (s, b) => s + b.remainingBlockValue,
    0,
  );
  const recognisedOtj = blocks.reduce((s, b) => s + b.recognisedOtj, 0);
  const remainingOtj = blocks.reduce((s, b) => s + b.remainingOtj, 0);
  const derivedProgrammeCurriculumOtj = blocks.reduce(
    (s, b) => s + b.derivedBlockCurriculumOtj,
    0,
  );

  return {
    formulaKey: "block_ksb_value_v1",
    otjAllocation: "VALUE_SHARE",
    programmeCurriculumValue,
    hoursPerCurriculumUnit,
    otjAllocatable,
    recognisedProgrammeValue,
    remainingProgrammeValue,
    recognisedOtj,
    remainingOtj,
    derivedProgrammeCurriculumOtj,
    blocks,
  };
}

export function defaultBlockKsbValueV1Params(): BlockKsbValueV1Params {
  return {
    fundingBandPounds: null,
    fixedCostLines: [],
    includeRplKnowledge: true,
    includeRplSkills: true,
    includeRplBehaviours: true,
  };
}
