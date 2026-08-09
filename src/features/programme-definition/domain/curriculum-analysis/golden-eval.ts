/**
 * Golden baseline evaluation harness.
 * Labels are evaluation-only and must NEVER be injected into analysis prompts.
 */

import type { CurriculumAnalysisResult } from "./types";

export type GoldenPrimary = { ksbCode: string; blockNumber: number };
export type GoldenClassification =
  | "primary_candidate"
  | "curriculum_gap"
  | "distributed_skill";

export type GoldenLabel = {
  ksbCode: string;
  classification: GoldenClassification;
  primaryBlockNumber: number | null;
};

export type EvalDisagreement = {
  ksbCode: string;
  goldenClassification: GoldenClassification;
  aiClassification: CurriculumAnalysisResult["classification"];
  goldenPrimary: number | null;
  aiPrimary: number | null;
  confidence: CurriculumAnalysisResult["confidence"];
  reason: string;
};

export type GoldenEvalReport = {
  official: number;
  compared: number;
  primaryClassificationAccuracy: number;
  primaryBlockAccuracy: number;
  gapDetectionAccuracy: number;
  distributedSkillAccuracy: number;
  falsePositivePrimaryRate: number;
  falseGapRate: number;
  ambiguousReviewRate: number;
  confidenceDistribution: Record<string, number>;
  disagreements: EvalDisagreement[];
  counts: {
    goldenPrimaries: number;
    goldenGaps: number;
    goldenDistributed: number;
    aiPrimaries: number;
    aiGaps: number;
    aiDistributed: number;
    aiAmbiguous: number;
  };
};

export const AUTOCARE_V1_GOLDEN_PRIMARIES: GoldenPrimary[] = [
  // existing 15
  { ksbCode: "K12", blockNumber: 2 },
  { ksbCode: "K24", blockNumber: 2 },
  { ksbCode: "S12", blockNumber: 2 },
  { ksbCode: "S15", blockNumber: 2 },
  { ksbCode: "K29", blockNumber: 3 },
  { ksbCode: "K30", blockNumber: 3 },
  { ksbCode: "S1", blockNumber: 3 },
  { ksbCode: "S2", blockNumber: 3 },
  { ksbCode: "S3", blockNumber: 3 },
  { ksbCode: "S19", blockNumber: 3 },
  { ksbCode: "S4", blockNumber: 4 },
  { ksbCode: "K21", blockNumber: 6 },
  { ksbCode: "K23", blockNumber: 6 },
  { ksbCode: "S13", blockNumber: 6 },
  { ksbCode: "S14", blockNumber: 6 },
  // automated 23
  { ksbCode: "B1", blockNumber: 1 },
  { ksbCode: "B2", blockNumber: 3 },
  { ksbCode: "B3", blockNumber: 6 },
  { ksbCode: "B4", blockNumber: 10 },
  { ksbCode: "K3", blockNumber: 1 },
  { ksbCode: "K4", blockNumber: 3 },
  { ksbCode: "K5", blockNumber: 1 },
  { ksbCode: "K9", blockNumber: 7 },
  { ksbCode: "K11", blockNumber: 5 },
  { ksbCode: "K14", blockNumber: 6 },
  { ksbCode: "K17", blockNumber: 9 },
  { ksbCode: "K19", blockNumber: 2 },
  { ksbCode: "K22", blockNumber: 9 },
  { ksbCode: "K26", blockNumber: 2 },
  { ksbCode: "K27", blockNumber: 2 },
  { ksbCode: "K33", blockNumber: 1 },
  { ksbCode: "S5", blockNumber: 1 },
  { ksbCode: "S6", blockNumber: 3 },
  { ksbCode: "S8", blockNumber: 1 },
  { ksbCode: "S17", blockNumber: 2 },
  { ksbCode: "S18", blockNumber: 8 },
  { ksbCode: "S22", blockNumber: 1 },
  { ksbCode: "S24", blockNumber: 10 },
  // human verified 7
  { ksbCode: "K15", blockNumber: 2 },
  { ksbCode: "K16", blockNumber: 2 },
  { ksbCode: "K32", blockNumber: 5 },
  { ksbCode: "S21", blockNumber: 5 },
  { ksbCode: "S16", blockNumber: 3 },
  { ksbCode: "K6", blockNumber: 1 },
  { ksbCode: "K25", blockNumber: 6 },
];

export const AUTOCARE_V1_GOLDEN_GAPS = [
  "B5",
  "K1",
  "K2",
  "K7",
  "K13",
  "K18",
  "K20",
  "K31",
  "K34",
  "S7",
  "S11",
  "S20",
  "S23",
  "S25",
  "K8",
  "S9",
  "K10",
  "K28",
] as const;

export const AUTOCARE_V1_GOLDEN_DISTRIBUTED = ["S10"] as const;

export function buildAutocareV1GoldenLabels(): GoldenLabel[] {
  const labels: GoldenLabel[] = [];
  for (const p of AUTOCARE_V1_GOLDEN_PRIMARIES) {
    labels.push({
      ksbCode: p.ksbCode.toUpperCase(),
      classification: "primary_candidate",
      primaryBlockNumber: p.blockNumber,
    });
  }
  for (const code of AUTOCARE_V1_GOLDEN_GAPS) {
    labels.push({
      ksbCode: code.toUpperCase(),
      classification: "curriculum_gap",
      primaryBlockNumber: null,
    });
  }
  for (const code of AUTOCARE_V1_GOLDEN_DISTRIBUTED) {
    labels.push({
      ksbCode: code.toUpperCase(),
      classification: "distributed_skill",
      primaryBlockNumber: null,
    });
  }
  return labels;
}

export function evaluateAgainstGolden(
  results: CurriculumAnalysisResult[],
  labels: GoldenLabel[] = buildAutocareV1GoldenLabels(),
): GoldenEvalReport {
  const byCode = new Map(results.map((r) => [r.ksbCode.toUpperCase(), r]));
  const labelByCode = new Map(labels.map((l) => [l.ksbCode.toUpperCase(), l]));

  let primaryClassCorrect = 0;
  let primaryClassTotal = 0;
  let primaryBlockCorrect = 0;
  let primaryBlockTotal = 0;
  let gapCorrect = 0;
  let gapTotal = 0;
  let distCorrect = 0;
  let distTotal = 0;
  let falsePrimary = 0;
  let nonPrimaryGolden = 0;
  let falseGap = 0;
  let coveredGolden = 0;
  let ambiguous = 0;

  const disagreements: EvalDisagreement[] = [];
  const confidenceDistribution: Record<string, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const result of results) {
    confidenceDistribution[result.confidence] =
      (confidenceDistribution[result.confidence] ?? 0) + 1;
    if (result.classification === "ambiguous") ambiguous += 1;
  }

  for (const label of labels) {
    const ai = byCode.get(label.ksbCode);
    if (!ai) {
      disagreements.push({
        ksbCode: label.ksbCode,
        goldenClassification: label.classification,
        aiClassification: "ambiguous",
        goldenPrimary: label.primaryBlockNumber,
        aiPrimary: null,
        confidence: "low",
        reason: "Missing AI result for golden KSB",
      });
      continue;
    }

    if (label.classification === "primary_candidate") {
      primaryClassTotal += 1;
      coveredGolden += 1;
      if (ai.classification === "primary_candidate") {
        primaryClassCorrect += 1;
        primaryBlockTotal += 1;
        if (ai.proposedPrimaryBlockNumber === label.primaryBlockNumber) {
          primaryBlockCorrect += 1;
        } else {
          disagreements.push({
            ksbCode: label.ksbCode,
            goldenClassification: label.classification,
            aiClassification: ai.classification,
            goldenPrimary: label.primaryBlockNumber,
            aiPrimary: ai.proposedPrimaryBlockNumber,
            confidence: ai.confidence,
            reason: "Primary block mismatch",
          });
        }
      } else {
        if (ai.classification === "curriculum_gap") falseGap += 1;
        disagreements.push({
          ksbCode: label.ksbCode,
          goldenClassification: label.classification,
          aiClassification: ai.classification,
          goldenPrimary: label.primaryBlockNumber,
          aiPrimary: ai.proposedPrimaryBlockNumber,
          confidence: ai.confidence,
          reason: "Golden Primary not classified as primary_candidate",
        });
      }
    } else if (label.classification === "curriculum_gap") {
      gapTotal += 1;
      nonPrimaryGolden += 1;
      if (ai.classification === "curriculum_gap") gapCorrect += 1;
      else {
        if (ai.classification === "primary_candidate") falsePrimary += 1;
        disagreements.push({
          ksbCode: label.ksbCode,
          goldenClassification: label.classification,
          aiClassification: ai.classification,
          goldenPrimary: null,
          aiPrimary: ai.proposedPrimaryBlockNumber,
          confidence: ai.confidence,
          reason: "Golden gap not classified as curriculum_gap",
        });
      }
    } else if (label.classification === "distributed_skill") {
      distTotal += 1;
      nonPrimaryGolden += 1;
      if (ai.classification === "distributed_skill") distCorrect += 1;
      else {
        if (ai.classification === "primary_candidate") falsePrimary += 1;
        disagreements.push({
          ksbCode: label.ksbCode,
          goldenClassification: label.classification,
          aiClassification: ai.classification,
          goldenPrimary: null,
          aiPrimary: ai.proposedPrimaryBlockNumber,
          confidence: ai.confidence,
          reason: "Golden distributed-skill not classified as distributed_skill",
        });
      }
    }
  }

  // Extra AI primaries on unknown codes shouldn't happen; ignore.

  const pct = (n: number, d: number) => (d === 0 ? 0 : n / d);

  return {
    official: labels.length,
    compared: labels.filter((l) => byCode.has(l.ksbCode)).length,
    primaryClassificationAccuracy: pct(primaryClassCorrect, primaryClassTotal),
    primaryBlockAccuracy: pct(primaryBlockCorrect, primaryBlockTotal),
    gapDetectionAccuracy: pct(gapCorrect, gapTotal),
    distributedSkillAccuracy: pct(distCorrect, distTotal),
    falsePositivePrimaryRate: pct(falsePrimary, nonPrimaryGolden),
    falseGapRate: pct(falseGap, coveredGolden),
    ambiguousReviewRate: pct(ambiguous, results.length),
    confidenceDistribution,
    disagreements,
    counts: {
      goldenPrimaries: primaryClassTotal,
      goldenGaps: gapTotal,
      goldenDistributed: distTotal,
      aiPrimaries: results.filter((r) => r.classification === "primary_candidate")
        .length,
      aiGaps: results.filter((r) => r.classification === "curriculum_gap").length,
      aiDistributed: results.filter((r) => r.classification === "distributed_skill")
        .length,
      aiAmbiguous: ambiguous,
    },
  };
}

/** Guard helper for tests — golden labels must not appear in prompt payloads. */
export function assertNoGoldenLeak(promptText: string): void {
  if (
    /GOLDEN_BASELINE_LABELS|goldenPrimary|humanApprovedPrimaryBatch|AUTOCARE_V1_GOLDEN_/i.test(
      promptText,
    )
  ) {
    throw new Error("Golden labels leaked into analysis prompt.");
  }
}
