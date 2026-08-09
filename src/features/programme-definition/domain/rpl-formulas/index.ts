import type {
  ProgrammeDeliveryParameters,
  RplFormulaKey,
} from "../types";
import { defaultBlockKsbValueV1Params } from "./block-ksb-value-v1";

export {
  runWeightedKsbCapV1,
  type WeightedKsbCapInput,
  type WeightedKsbCapParams,
  type WeightedKsbCapResult,
} from "./weighted-ksb-cap-v1";

export {
  runBlockKsbValueV1,
  defaultBlockKsbValueV1Params,
  type BlockKsbValueV1Input,
  type BlockKsbValueV1Result,
  type BlockKsbValueV1BlockResult,
  type BlockKsbValueV1BlockInput,
  type BlockKsbValueV1Params,
} from "./block-ksb-value-v1";

export {
  DEFAULT_CURRICULUM_VALUE,
  assertCurriculumValue,
  validateCurriculumValue,
  normalizeCurriculumValue,
  calculateBlockCurriculumTotals,
  calculateProgrammeCurriculumValue,
  buildKsbTypeMap,
  trainingBlockIds,
  type BlockCurriculumTotals,
} from "./block-curriculum-value";

export {
  availableRplDimensions,
  officialRplDimensions,
  isProgrammeRplDimensionEnabled,
  hasRplDimension,
  RPL_DIMENSION_ORDER,
  RPL_DIMENSION_LABELS,
  RPL_DIMENSION_PCT_FIELD,
  RPL_DIMENSION_INCLUDE_FIELD,
  type RplDimension,
  type ProgrammeRplIncludeFlags,
} from "./available-rpl-dimensions";

export {
  validateLearnerRplPercent,
  assertLearnerRplPercent,
  validateLearnerBlockRplPercents,
  type LearnerBlockRplPercents,
} from "./learner-rpl-percent";

export {
  calculateFixedCostTotal,
  calculateTnp1,
  createFixedCostLine,
  normalizeFixedCostLines,
  validateFixedCostLine,
  type FixedCostLineItem,
  type Tnp1CalcInput,
  type Tnp1CalcResult,
} from "./tnp1";

export {
  createDefaultProgrammeParameters,
  parseStoredProgrammeParameters,
  serializeProgrammeParameters,
  ProgrammeParametersValidationError,
  programmeParametersSchema,
} from "./programme-parameters";

/** Friendly catalogue of known RPL / APL calculation methods. */
export type RplFormulaOption = {
  key: RplFormulaKey;
  /** Short title shown in the picker. */
  label: string;
  /** One-line “why this method”. */
  why: string;
  /** Variables staff set on the programme. */
  programmeVariables: string[];
  /** Variables entered later when a learner joins. */
  learnerVariables: string[];
  /** Whether this key uses legacy K/S/B weights + cap UI. */
  usesLegacyWeights: boolean;
};

/**
 * Formula methods offered in Programme Builder for new / active selection.
 * Legacy weighted_ksb_cap_v1 is intentionally omitted — runner kept for any
 * historical programme versions already published against that key.
 */
export const RPL_FORMULA_OPTIONS: RplFormulaOption[] = [
  {
    key: "block_ksb_value_v1",
    label: "Block KSB curriculum value (VALUE_SHARE OTJ)",
    why: "Sums individual Block↔KSB curriculum values into a Block Value, applies learner K/S/B recognition %, then allocates OTJ by share of programme curriculum value.",
    programmeVariables: [
      "Expected programme OTJ hours",
      "Curriculum values on each Block↔KSB mapping (Spine Builder)",
      "Which of K / S / B are RPL-eligible",
    ],
    learnerVariables: [
      "Knowledge already held % per block",
      "Skills already demonstrated % per block",
      "Behaviours already evidenced % per block",
    ],
    usesLegacyWeights: false,
  },
];

/** Frozen catalogue entry — not offered in the picker. */
const LEGACY_WEIGHTED_KSB_CAP_OPTION: RplFormulaOption = {
  key: "weighted_ksb_cap_v1",
  label: "Weighted KSB with max % cap (legacy)",
  why: "Legacy Autocare-style method: weights Knowledge / Skills / Behaviours scores, then caps how much of a block’s planned OTJ can be reduced.",
  programmeVariables: [
    "Which of K / S / B to use",
    "Weight for each letter",
    "Max APL % of block OTJ",
  ],
  learnerVariables: [
    "Prior learning % for each letter used",
    "Block planned OTJ hours",
  ],
  usesLegacyWeights: true,
};

export const RPL_FORMULA_LABELS: Record<RplFormulaKey, string> = {
  block_ksb_value_v1: RPL_FORMULA_OPTIONS[0]!.label,
  weighted_ksb_cap_v1: LEGACY_WEIGHTED_KSB_CAP_OPTION.label,
};

export function isLegacyWeightedFormula(
  key: RplFormulaKey | undefined | null,
): boolean {
  return key === "weighted_ksb_cap_v1";
}

/**
 * Resolve a stored formula key.
 * - explicit known keys kept
 * - missing/null → block_ksb_value_v1 (current default)
 * - unknown non-null → throws (never silently runs legacy maths)
 */
export function resolveRplFormulaKey(raw: unknown): RplFormulaKey {
  if (raw === "block_ksb_value_v1" || raw === "weighted_ksb_cap_v1") {
    return raw;
  }
  if (raw == null || raw === "") {
    return "block_ksb_value_v1";
  }
  throw new Error(
    `Unknown RPL formula key: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`,
  );
}

/** Defaults for NEW programme versions (block_ksb_value_v1). */
export function defaultBlockKsbValueProgrammeParams(): Pick<
  ProgrammeDeliveryParameters,
  | "formulaKey"
  | "formulaStatus"
  | "includeAplK"
  | "includeAplS"
  | "includeAplB"
  | "aplWeightK"
  | "aplWeightS"
  | "aplWeightB"
  | "aplMaxFraction"
  | "includeRplKnowledge"
  | "includeRplSkills"
  | "includeRplBehaviours"
  | "fundingBandPounds"
  | "fixedCostLines"
> {
  const finance = defaultBlockKsbValueV1Params();
  return {
    formulaKey: "block_ksb_value_v1",
    formulaStatus: "draft",
    // Legacy fields retained on the schema for historical versions only.
    includeAplK: true,
    includeAplS: true,
    includeAplB: true,
    aplWeightK: 0.3,
    aplWeightS: 0.5,
    aplWeightB: 0.2,
    aplMaxFraction: 0.3,
    // RPL eligibility for block_ksb_value_v1 — all official dims eligible by default.
    includeRplKnowledge: true,
    includeRplSkills: true,
    includeRplBehaviours: true,
    fundingBandPounds: finance.fundingBandPounds,
    fixedCostLines: finance.fixedCostLines,
  };
}

export function formulaHasIncludedLetters(
  params: Pick<
    ProgrammeDeliveryParameters,
    "includeAplK" | "includeAplS" | "includeAplB"
  >,
): boolean {
  return Boolean(
    params.includeAplK || params.includeAplS || params.includeAplB,
  );
}

/** Sum of weights for enabled letters only (disabled are ignored, not renormalised). */
export function enabledFormulaWeightsSum(
  params: Pick<
    ProgrammeDeliveryParameters,
    | "includeAplK"
    | "includeAplS"
    | "includeAplB"
    | "aplWeightK"
    | "aplWeightS"
    | "aplWeightB"
  >,
): number {
  let sum = 0;
  if (params.includeAplK) sum += Number(params.aplWeightK) || 0;
  if (params.includeAplS) sum += Number(params.aplWeightS) || 0;
  if (params.includeAplB) sum += Number(params.aplWeightB) || 0;
  return sum;
}

const WEIGHT_SUM_EPSILON = 0.001;

/**
 * Enabled K/S/B weights must sum to 1.0. Never silently renormalises.
 * Only required for weighted_ksb_cap_v1.
 */
export function validateFormulaWeights(
  params: Pick<
    ProgrammeDeliveryParameters,
    | "includeAplK"
    | "includeAplS"
    | "includeAplB"
    | "aplWeightK"
    | "aplWeightS"
    | "aplWeightB"
    | "aplMaxFraction"
  >,
): { ok: true; sum: number } | { ok: false; sum: number; message: string } {
  if (!formulaHasIncludedLetters(params)) {
    return {
      ok: false,
      sum: 0,
      message: "Include at least one of K, S, or B in the formula.",
    };
  }
  const sum = enabledFormulaWeightsSum(params);
  if (Math.abs(sum - 1) > WEIGHT_SUM_EPSILON) {
    return {
      ok: false,
      sum,
      message: `Enabled K/S/B weights must sum to 1.0 (currently ${sum.toFixed(3)}). Weights are not auto-adjusted.`,
    };
  }
  const max = Number(params.aplMaxFraction);
  if (!Number.isFinite(max) || max < 0 || max > 1) {
    return {
      ok: false,
      sum,
      message: "Max APL must be between 0% and 100% (0–1 internally).",
    };
  }
  return { ok: true, sum };
}
