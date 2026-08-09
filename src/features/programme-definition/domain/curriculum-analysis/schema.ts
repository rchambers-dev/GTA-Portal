import { z } from "zod";
import { normalizeEvidenceStrength } from "./evidence-sufficiency";

export const analysisClassificationSchema = z.enum([
  "primary_candidate",
  "curriculum_gap",
  "distributed_skill",
  "ambiguous",
]);

export const analysisConfidenceSchema = z.enum(["high", "medium", "low"]);

export const coverageAssessmentSchema = z.enum([
  "covered",
  "partial",
  "absent",
]);

export const ownershipAssessmentSchema = z.enum([
  "clear_primary",
  "ambiguous_primary",
  "distributed",
  "none",
]);

export const evidenceStrengthSchema = z.enum([
  "FULL",
  "NEAR_FULL",
  "MATERIAL_PARTIAL",
  "WEAK_ADJACENT",
  "ABSENT",
  // legacy accepted then normalized
  "PARTIAL",
  "WEAK_REFERENCE",
]);

export const modelKsbJudgementSchema = z.object({
  ksbCode: z.string().min(1),
  coverage: coverageAssessmentSchema.optional(),
  ownership: ownershipAssessmentSchema.optional(),
  evidenceStrength: evidenceStrengthSchema.optional(),
  coveredComponents: z.array(z.string()).optional(),
  missingComponents: z.array(z.string()).optional(),
  missingEssentialComponents: z.array(z.string()).optional(),
  coverageConfidence: analysisConfidenceSchema.optional(),
  ownershipConfidence: analysisConfidenceSchema.optional(),
  classification: analysisClassificationSchema,
  confidence: analysisConfidenceSchema,
  confidenceScore: z.coerce.number().min(0).max(100).nullable().optional(),
  proposedPrimaryBlockNumber: z
    .union([z.coerce.number().int().positive(), z.null()])
    .nullable(),
  reinforcementBlockNumbers: z
    .array(z.coerce.number().int().positive())
    .default([]),
  evidenceLocationRefs: z.array(z.string()).default([]),
  reasoningSummary: z.string().min(1),
  warnings: z.array(z.string()).default([]),
  rejectedFalsePositives: z.array(z.string()).default([]),
});

export type ModelKsbJudgement = z.infer<typeof modelKsbJudgementSchema>;
export type CoverageAssessment = z.infer<typeof coverageAssessmentSchema>;
export type OwnershipAssessment = z.infer<typeof ownershipAssessmentSchema>;
export type EvidenceStrengthAssessment = z.infer<typeof evidenceStrengthSchema>;

/**
 * Derive classification from staged coverage + ownership + sufficiency.
 * Ownership uncertainty must NOT force GAP.
 */
export function deriveClassificationFromCoverageOwnership(
  coverage: CoverageAssessment | undefined,
  ownership: OwnershipAssessment | undefined,
  evidenceStrength?: EvidenceStrengthAssessment,
): ModelKsbJudgement["classification"] | null {
  const strength = normalizeEvidenceStrength(evidenceStrength);

  if (coverage && (strength === "ABSENT" || strength === "WEAK_ADJACENT")) {
    return "curriculum_gap";
  }
  if (coverage && strength === "MATERIAL_PARTIAL") {
    // Material missing essential ⇒ gap. Ownership ambiguity is irrelevant here.
    return "curriculum_gap";
  }
  if (coverage && (strength === "FULL" || strength === "NEAR_FULL")) {
    if (ownership === "clear_primary") return "primary_candidate";
    if (ownership === "ambiguous_primary") return "ambiguous";
    if (ownership === "distributed") return "distributed_skill";
    if (ownership === "none") return "ambiguous";
  }

  if (!coverage) return null;
  if (coverage === "absent") return "curriculum_gap";
  if (coverage === "partial") return "curriculum_gap";
  // covered
  if (ownership === "clear_primary") return "primary_candidate";
  if (ownership === "ambiguous_primary") return "ambiguous";
  if (ownership === "distributed") return "distributed_skill";
  if (ownership === "none") return "ambiguous";
  return null;
}

export function parseModelKsbJudgement(raw: unknown): ModelKsbJudgement {
  const obj =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};

  const coerceBlock = (v: unknown): number | null => {
    if (v == null || v === "" || v === "null" || v === "none" || v === "undefined") {
      return null;
    }
    const n = typeof v === "number" ? v : Number(String(v).replace(/^B/i, ""));
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  };

  obj.proposedPrimaryBlockNumber = coerceBlock(obj.proposedPrimaryBlockNumber);
  if (Array.isArray(obj.reinforcementBlockNumbers)) {
    obj.reinforcementBlockNumbers = obj.reinforcementBlockNumbers
      .map((v) => coerceBlock(v))
      .filter((n): n is number => n != null);
  }
  if (typeof obj.confidenceScore === "string") {
    const n = Number(obj.confidenceScore);
    obj.confidenceScore = Number.isFinite(n) ? n : null;
  }

  if (obj.coverageAssessment && !obj.coverage) obj.coverage = obj.coverageAssessment;
  if (obj.ownershipAssessment && !obj.ownership) obj.ownership = obj.ownershipAssessment;
  if (obj.evidence_strength && !obj.evidenceStrength) {
    obj.evidenceStrength = obj.evidence_strength;
  }
  if (typeof obj.evidenceStrength === "string") {
    obj.evidenceStrength = String(obj.evidenceStrength).toUpperCase();
  }
  if (obj.missingEssential && !obj.missingEssentialComponents) {
    obj.missingEssentialComponents = obj.missingEssential;
  }

  const parsed = modelKsbJudgementSchema.parse(obj);
  const normalizedStrength = normalizeEvidenceStrength(parsed.evidenceStrength);
  const withNorm: ModelKsbJudgement = normalizedStrength
    ? { ...parsed, evidenceStrength: normalizedStrength }
    : parsed;

  const derived = deriveClassificationFromCoverageOwnership(
    withNorm.coverage,
    withNorm.ownership,
    withNorm.evidenceStrength,
  );
  if (derived && derived !== withNorm.classification) {
    return {
      ...withNorm,
      classification: derived,
      warnings: [
        ...withNorm.warnings,
        `Classification aligned to coverage=${withNorm.coverage} ownership=${withNorm.ownership} evidenceStrength=${withNorm.evidenceStrength ?? "n/a"}.`,
      ],
    };
  }

  return withNorm;
}

export function parseModelKsbJudgementText(text: string): ModelKsbJudgement {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI response did not contain a JSON object.");
  }
  const json = JSON.parse(body.slice(start, end + 1)) as unknown;
  return parseModelKsbJudgement(json);
}
