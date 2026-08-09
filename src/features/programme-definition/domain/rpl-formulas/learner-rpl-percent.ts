/**
 * Learner RPL percentages (0–100 inclusive).
 * Invalid input is rejected — never silently clamped or coerced.
 */

export type LearnerRplPercentValidation =
  | { ok: true; value: number }
  | { ok: false; message: string };

/** Finite number in [0, 100]. No stepping, clamping, or NaN→0. */
export function validateLearnerRplPercent(
  raw: unknown,
  label = "RPL percentage",
): LearnerRplPercentValidation {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      message: `${label} must be a finite number between 0 and 100.`,
    };
  }
  if (raw < 0 || raw > 100) {
    return {
      ok: false,
      message: `${label} must be between 0 and 100 (inclusive).`,
    };
  }
  return { ok: true, value: raw };
}

export function assertLearnerRplPercent(
  raw: unknown,
  label = "RPL percentage",
): number {
  const result = validateLearnerRplPercent(raw, label);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export type LearnerBlockRplPercents = {
  knowledgePct: number;
  skillsPct: number;
  behavioursPct: number;
};

export function validateLearnerBlockRplPercents(
  input: LearnerBlockRplPercents,
):
  | { ok: true }
  | { ok: false; message: string; field: keyof LearnerBlockRplPercents } {
  for (const [field, label] of [
    ["knowledgePct", "Knowledge already held %"],
    ["skillsPct", "Skills already demonstrated %"],
    ["behavioursPct", "Behaviours already evidenced %"],
  ] as const) {
    const result = validateLearnerRplPercent(input[field], label);
    if (!result.ok) return { ok: false, message: result.message, field };
  }
  return { ok: true };
}
