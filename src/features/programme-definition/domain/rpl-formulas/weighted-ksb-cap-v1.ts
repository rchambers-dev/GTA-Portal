/**
 * Autocare-style RPL / APL adjustment (centre method, not a national DfE formula).
 *
 *   apl_factor = (Σ included weight_x * X) / 100
 *   deduction  = MIN(block_otj * apl_max_fraction, block_otj * apl_factor)
 *   adjusted   = block_otj - deduction
 *
 * K/S/B are prior-learning percentages (0–100) entered per learner/block.
 * Weights, max fraction, and which letters are included are programme-version parameters.
 * Disabled letters are omitted from the sum entirely (not “weight 0” in the UI sense).
 */

export type WeightedKsbCapParams = {
  includeAplK: boolean;
  includeAplS: boolean;
  includeAplB: boolean;
  aplWeightK: number;
  aplWeightS: number;
  aplWeightB: number;
  /** 0–1 fraction of block OTJ that may be deducted. */
  aplMaxFraction: number;
};

export type WeightedKsbCapInput = {
  blockOtjHours: number;
  /** Prior Knowledge coverage %, 0–100. */
  priorKPercent: number;
  /** Prior Skill coverage %, 0–100. */
  priorSPercent: number;
  /** Prior Behaviour coverage %, 0–100. */
  priorBPercent: number;
  params: WeightedKsbCapParams;
};

export type WeightedKsbCapResult = {
  aplFactor: number;
  deductionHours: number;
  adjustedOtjHours: number;
};

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function clampFraction(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function runWeightedKsbCapV1(
  input: WeightedKsbCapInput,
): WeightedKsbCapResult {
  const blockOtj = clampNonNeg(input.blockOtjHours);
  const { params } = input;
  const maxFraction = clampFraction(params.aplMaxFraction);

  let weightedSum = 0;
  if (params.includeAplK) {
    weightedSum +=
      clampNonNeg(params.aplWeightK) * clampPercent(input.priorKPercent);
  }
  if (params.includeAplS) {
    weightedSum +=
      clampNonNeg(params.aplWeightS) * clampPercent(input.priorSPercent);
  }
  if (params.includeAplB) {
    weightedSum +=
      clampNonNeg(params.aplWeightB) * clampPercent(input.priorBPercent);
  }

  const aplFactor = weightedSum / 100;
  const maxDeduction = blockOtj * maxFraction;
  const calcDeduction = blockOtj * aplFactor;
  const deductionHours = Math.min(maxDeduction, calcDeduction);

  return {
    aplFactor,
    deductionHours,
    adjustedOtjHours: Math.max(0, blockOtj - deductionHours),
  };
}

/** Human-readable factor expression for the active letters. */
export function describeWeightedKsbCapFactor(
  params: Pick<
    WeightedKsbCapParams,
    | "includeAplK"
    | "includeAplS"
    | "includeAplB"
    | "aplWeightK"
    | "aplWeightS"
    | "aplWeightB"
  >,
): string {
  const terms: string[] = [];
  if (params.includeAplK) terms.push("K×weight_k");
  if (params.includeAplS) terms.push("S×weight_s");
  if (params.includeAplB) terms.push("B×weight_b");
  if (terms.length === 0) return "factor unused (no K/S/B included)";
  return `factor = (${terms.join(" + ")}) ÷ 100`;
}
