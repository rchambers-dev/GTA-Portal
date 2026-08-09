/**
 * Versioned fixed-cost line items + TNP1 calculation (Phase 2).
 *
 * Chain:
 *   fundingBand − fixedCostTotal → variableCostPot
 *   variableCostPot ÷ programmeCurriculumValue → £ / curriculum unit
 *   remainingProgrammeValue × £/unit → remainingVariableCost
 *   fixedCostTotal + remainingVariableCost → TNP1
 *
 * Fixed costs are never reduced by RPL.
 * fixedCostTotal is DERIVED from enabled line items — not manually typed.
 */

export type FixedCostLineItem = {
  id: string;
  label: string;
  /** Amount in GBP for this line. Must be finite and ≥ 0. */
  amountPounds: number;
  /** When false, line is excluded from the derived total. */
  enabled: boolean;
  sequence: number;
};

export type FixedCostLineValidation =
  | { ok: true; value: FixedCostLineItem }
  | { ok: false; message: string };

export type ValidateFixedCostLineOptions = {
  /**
   * When true, reject blank labels.
   * Draft UI rows start empty so staff can type the label — keep false for
   * create/normalize; enforce on publish / export if needed.
   */
  requireLabel?: boolean;
};

export function validateFixedCostLine(
  raw: Partial<FixedCostLineItem> & { label?: unknown; amountPounds?: unknown },
  options: ValidateFixedCostLineOptions = {},
): FixedCostLineValidation {
  const label = String(raw.label ?? "").trim();
  if (options.requireLabel && !label) {
    return { ok: false, message: "Fixed-cost line needs a label." };
  }
  const amount = Number(raw.amountPounds);
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false,
      message: "Fixed-cost amount must be a finite number ≥ 0.",
    };
  }
  return {
    ok: true,
    value: {
      id: raw.id && String(raw.id) ? String(raw.id) : crypto.randomUUID(),
      label,
      amountPounds: amount,
      enabled: raw.enabled !== false,
      sequence:
        typeof raw.sequence === "number" && Number.isFinite(raw.sequence)
          ? raw.sequence
          : 0,
    },
  };
}

/** Sum of enabled line amounts. Disabled lines contribute 0. */
export function calculateFixedCostTotal(lines: FixedCostLineItem[]): number {
  return lines.reduce((sum, line) => {
    if (!line.enabled) return sum;
    const n = Number(line.amountPounds);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
}

export function normalizeFixedCostLines(raw: unknown): FixedCostLineItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FixedCostLineItem[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const result = validateFixedCostLine({
      ...(item as Partial<FixedCostLineItem>),
      sequence:
        typeof (item as FixedCostLineItem).sequence === "number"
          ? (item as FixedCostLineItem).sequence
          : index,
    });
    if (result.ok) out.push(result.value);
  });
  return out.sort((a, b) => a.sequence - b.sequence);
}

/**
 * Create a fixed-cost line for editing / defaults.
 * Blank labels are allowed so Programme Builder can add an empty row.
 */
export function createFixedCostLine(args: {
  label?: string;
  amountPounds?: number;
  enabled?: boolean;
  sequence?: number;
}): FixedCostLineItem {
  const result = validateFixedCostLine(
    {
      label: args.label ?? "",
      amountPounds: args.amountPounds ?? 0,
      enabled: args.enabled !== false,
      sequence: args.sequence ?? 0,
    },
    { requireLabel: false },
  );
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export type Tnp1CalcInput = {
  /** Programme / negotiated funding base (GBP). Versioned config. */
  fundingBandPounds: number | null;
  fixedCostLines: FixedCostLineItem[];
  /** From Phase 1 block_ksb_value_v1. */
  programmeCurriculumValue: number;
  remainingProgrammeValue: number;
  /** Optional — exposed for UI/hooks; not required for TNP1 maths. */
  recognisedProgrammeValue?: number;
};

export type Tnp1CalcResult = {
  formulaKey: "block_ksb_value_v1";
  financeStage: "tnp1_v1";
  allocatable: boolean;
  /** Why allocatable is false — null when ok. */
  blockedReason: string | null;
  fundingBandPounds: number | null;
  fixedCostTotal: number;
  variableCostPot: number | null;
  programmeCurriculumValue: number;
  remainingProgrammeValue: number;
  recognisedProgrammeValue: number;
  poundsPerCurriculumUnit: number | null;
  remainingVariableCost: number | null;
  recognisedVariableCost: number | null;
  /** Derived: fixedCostTotal + remainingVariableCost */
  tnp1: number | null;
};

/**
 * Pure TNP1 calculator. Does not mutate fixed costs for RPL.
 * Assumes Phase 1 remainingProgrammeValue is already validated.
 */
export function calculateTnp1(input: Tnp1CalcInput): Tnp1CalcResult {
  const fixedCostTotal = calculateFixedCostTotal(input.fixedCostLines);
  const programmeCurriculumValue = Number(input.programmeCurriculumValue);
  const remainingProgrammeValue = Number(input.remainingProgrammeValue);
  const recognisedProgrammeValue = Number(
    input.recognisedProgrammeValue ??
      Math.max(0, programmeCurriculumValue - remainingProgrammeValue),
  );

  const base: Omit<
    Tnp1CalcResult,
    | "allocatable"
    | "blockedReason"
    | "variableCostPot"
    | "poundsPerCurriculumUnit"
    | "remainingVariableCost"
    | "recognisedVariableCost"
    | "tnp1"
  > = {
    formulaKey: "block_ksb_value_v1",
    financeStage: "tnp1_v1",
    fundingBandPounds:
      input.fundingBandPounds == null || !Number.isFinite(input.fundingBandPounds)
        ? null
        : input.fundingBandPounds,
    fixedCostTotal,
    programmeCurriculumValue: Number.isFinite(programmeCurriculumValue)
      ? programmeCurriculumValue
      : 0,
    remainingProgrammeValue: Number.isFinite(remainingProgrammeValue)
      ? remainingProgrammeValue
      : 0,
    recognisedProgrammeValue: Number.isFinite(recognisedProgrammeValue)
      ? recognisedProgrammeValue
      : 0,
  };

  if (base.fundingBandPounds == null) {
    return {
      ...base,
      allocatable: false,
      blockedReason: "Set the programme funding band / negotiated base.",
      variableCostPot: null,
      poundsPerCurriculumUnit: null,
      remainingVariableCost: null,
      recognisedVariableCost: null,
      tnp1: null,
    };
  }

  if (base.fundingBandPounds < 0) {
    return {
      ...base,
      allocatable: false,
      blockedReason: "Funding band must be ≥ 0.",
      variableCostPot: null,
      poundsPerCurriculumUnit: null,
      remainingVariableCost: null,
      recognisedVariableCost: null,
      tnp1: null,
    };
  }

  const variableCostPot = base.fundingBandPounds - fixedCostTotal;
  if (variableCostPot < 0) {
    return {
      ...base,
      allocatable: false,
      blockedReason:
        "Fixed cost total exceeds the funding band — reduce fixed costs or raise the band.",
      variableCostPot,
      poundsPerCurriculumUnit: null,
      remainingVariableCost: null,
      recognisedVariableCost: null,
      tnp1: null,
    };
  }

  if (!(programmeCurriculumValue > 0)) {
    return {
      ...base,
      allocatable: false,
      blockedReason:
        "Programme curriculum value is 0 — map KSB curriculum values on the spine first.",
      variableCostPot,
      poundsPerCurriculumUnit: null,
      remainingVariableCost: null,
      recognisedVariableCost: null,
      tnp1: null,
    };
  }

  const poundsPerCurriculumUnit = variableCostPot / programmeCurriculumValue;
  const remainingVariableCost =
    remainingProgrammeValue * poundsPerCurriculumUnit;
  const recognisedVariableCost =
    recognisedProgrammeValue * poundsPerCurriculumUnit;
  const tnp1 = fixedCostTotal + remainingVariableCost;

  return {
    ...base,
    allocatable: true,
    blockedReason: null,
    variableCostPot,
    poundsPerCurriculumUnit,
    remainingVariableCost,
    recognisedVariableCost,
    tnp1,
  };
}
