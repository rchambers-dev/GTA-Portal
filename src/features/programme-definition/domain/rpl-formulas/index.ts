import type {
  ProgrammeDeliveryParameters,
  RplFormulaKey,
} from "../types";
import {
  runWeightedKsbCapV1,
  type WeightedKsbCapResult,
} from "./weighted-ksb-cap-v1";

export {
  describeWeightedKsbCapFactor,
  runWeightedKsbCapV1,
  type WeightedKsbCapInput,
  type WeightedKsbCapParams,
  type WeightedKsbCapResult,
} from "./weighted-ksb-cap-v1";

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
};

/**
 * Known centre methods. Add a new `formula_key` + runner when maths changes —
 * never silently change behaviour under an existing key.
 */
export const RPL_FORMULA_OPTIONS: RplFormulaOption[] = [
  {
    key: "weighted_ksb_cap_v1",
    label: "Weighted KSB with max % cap",
    why: "Uses Knowledge, Skills and Behaviours scores, then caps how much of a block can be reduced. This is the Autocare-style method.",
    programmeVariables: [
      "Which of K / S / B to use",
      "Weight for each letter",
      "Max APL % of block OTJ",
    ],
    learnerVariables: [
      "Prior learning % for each letter used",
      "Block OTJ hours",
    ],
  },
];

export const RPL_FORMULA_LABELS: Record<RplFormulaKey, string> =
  Object.fromEntries(
    RPL_FORMULA_OPTIONS.map((o) => [o.key, o.label]),
  ) as Record<RplFormulaKey, string>;

export function getRplFormulaOption(
  key: RplFormulaKey | undefined | null,
): RplFormulaOption {
  return (
    RPL_FORMULA_OPTIONS.find((o) => o.key === key) || RPL_FORMULA_OPTIONS[0]!
  );
}

/** Autocare ST0499 live programme defaults (Other Portal). */
export function defaultWeightedKsbCapParams(): Pick<
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
> {
  return {
    formulaKey: "weighted_ksb_cap_v1",
    formulaStatus: "draft",
    includeAplK: true,
    includeAplS: true,
    includeAplB: true,
    aplWeightK: 0.3,
    aplWeightS: 0.5,
    aplWeightB: 0.2,
    aplMaxFraction: 0.3,
  };
}

export type RunRplFormulaInput = {
  formulaKey: RplFormulaKey;
  blockOtjHours: number;
  priorKPercent: number;
  priorSPercent: number;
  priorBPercent: number;
  params: Pick<
    ProgrammeDeliveryParameters,
    | "includeAplK"
    | "includeAplS"
    | "includeAplB"
    | "aplWeightK"
    | "aplWeightS"
    | "aplWeightB"
    | "aplMaxFraction"
  >;
};

/**
 * Dispatch by formula_key. New keys get their own branch — never change
 * behaviour under an existing key once learners may be enrolled against it.
 */
export function runRplFormula(
  input: RunRplFormulaInput,
): WeightedKsbCapResult {
  switch (input.formulaKey) {
    case "weighted_ksb_cap_v1":
      return runWeightedKsbCapV1({
        blockOtjHours: input.blockOtjHours,
        priorKPercent: input.priorKPercent,
        priorSPercent: input.priorSPercent,
        priorBPercent: input.priorBPercent,
        params: input.params,
      });
    default: {
      const _exhaustive: never = input.formulaKey;
      throw new Error(`Unknown RPL formula key: ${_exhaustive}`);
    }
  }
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
