/**
 * AI-1.4 calibration hybrid — evidence sufficiency + ownership signals.
 * Heuristic/sufficiency calibrate; never force golden-derived answers.
 */

import type { RetrievalHit } from "./retriever";
import type { ModelKsbJudgement } from "./schema";
import type { AnalysisConfidence } from "./types";
import type { EvidenceSufficiency } from "./evidence-sufficiency";
import {
  normalizeEvidenceStrength,
  strengthAllowsPrimary,
  sufficiencyToCoverage,
} from "./evidence-sufficiency";

function demoteConfidence(c: AnalysisConfidence): AnalysisConfidence {
  if (c === "high") return "medium";
  if (c === "medium") return "low";
  return "low";
}

function bestWeekForBlock(hits: RetrievalHit[], block: number): number | null {
  const relevant = hits
    .filter((h) => !h.rejected && h.session.blockNumber === block)
    .sort((a, b) => b.score - a.score || a.session.week - b.session.week);
  return relevant[0]?.session.week ?? null;
}

function bestScoreForBlock(hits: RetrievalHit[], block: number): number {
  let best = 0;
  for (const h of hits) {
    if (h.rejected) continue;
    if (h.session.blockNumber === block) best = Math.max(best, h.score);
  }
  return best;
}

function mergeSufficiencyFields(
  out: ModelKsbJudgement,
  sufficiency: EvidenceSufficiency,
): ModelKsbJudgement {
  return {
    ...out,
    evidenceStrength:
      normalizeEvidenceStrength(out.evidenceStrength) ??
      normalizeEvidenceStrength(sufficiency.coverageStrength),
    coveredComponents: out.coveredComponents ?? sufficiency.coveredComponents,
    missingComponents: out.missingComponents ?? sufficiency.missingComponents,
    missingEssentialComponents:
      out.missingEssentialComponents ?? sufficiency.missingEssentialComponents,
  };
}

/**
 * AI-1.4 sufficiency calibration.
 * FULL/NEAR_FULL → covered. MATERIAL_PARTIAL → gap only with named essentials.
 */
export function applyEvidenceSufficiencyCalibration(input: {
  judgement: ModelKsbJudgement;
  sufficiency: EvidenceSufficiency;
}): ModelKsbJudgement {
  let out = mergeSufficiencyFields(input.judgement, input.sufficiency);
  const s = input.sufficiency;
  const strength =
    normalizeEvidenceStrength(out.evidenceStrength) ??
    normalizeEvidenceStrength(s.coverageStrength) ??
    "ABSENT";

  out = {
    ...out,
    evidenceStrength: strength,
    missingEssentialComponents:
      out.missingEssentialComponents ?? s.missingEssentialComponents,
    coverage: sufficiencyToCoverage(strength),
    coverageConfidence:
      strength === "NEAR_FULL"
        ? out.coverageConfidence ?? "medium"
        : out.coverageConfidence ?? (strength === "FULL" ? "high" : "medium"),
  };

  // Over-claiming Primary without FULL/NEAR_FULL
  if (out.classification === "primary_candidate" && !strengthAllowsPrimary(strength)) {
    if (strength === "ABSENT" || strength === "WEAK_ADJACENT") {
      return {
        ...out,
        ownership: "none",
        classification: "curriculum_gap",
        confidence: demoteConfidence(out.confidence),
        proposedPrimaryBlockNumber: null,
        reasoningSummary: `${out.reasoningSummary} | Sufficiency: ${strength} — core competence not established.`,
        warnings: [
          ...out.warnings,
          `Sufficiency: demoted to curriculum_gap (${strength}).`,
          ...s.reasons,
        ],
      };
    }

    if (
      strength === "MATERIAL_PARTIAL" &&
      (out.missingEssentialComponents?.length ||
        s.missingEssentialComponents.length)
    ) {
      return {
        ...out,
        ownership: "none",
        classification: "curriculum_gap",
        confidence: "medium",
        proposedPrimaryBlockNumber: null,
        reasoningSummary: `${out.reasoningSummary} | Sufficiency: MATERIAL_PARTIAL — missing essential: ${(out.missingEssentialComponents ?? s.missingEssentialComponents).slice(0, 3).join("; ")}`,
        warnings: [
          ...out.warnings,
          "Sufficiency: named essential missing → curriculum_gap.",
          ...s.reasons,
        ],
      };
    }
  }

  // Gap without named essential when strength is only MATERIAL_PARTIAL
  if (
    out.classification === "curriculum_gap" &&
    strength === "MATERIAL_PARTIAL" &&
    !(out.missingEssentialComponents?.length || s.missingEssentialComponents.length)
  ) {
    return {
      ...out,
      coverage: "covered",
      coverageConfidence: "medium",
      ownership: "ambiguous_primary",
      classification: "ambiguous",
      confidence: "medium",
      proposedPrimaryBlockNumber: null,
      reasoningSummary: `${out.reasoningSummary} | Sufficiency: cannot name missing essential — not a confident gap.`,
      warnings: [
        ...out.warnings,
        "Sufficiency: gap requires named missing essential; demoted to ambiguous.",
      ],
    };
  }

  if (out.classification === "primary_candidate" && strengthAllowsPrimary(strength)) {
    out = {
      ...out,
      coverage: "covered",
      coverageConfidence:
        strength === "FULL" ? out.coverageConfidence ?? "high" : "medium",
      ownershipConfidence:
        out.ownershipConfidence ??
        (out.confidence === "high" && strength === "FULL" ? "high" : "medium"),
      confidence:
        strength === "NEAR_FULL" || out.ownershipConfidence === "medium"
          ? "medium"
          : out.confidence,
    };
  }

  return out;
}

export function applyConservativeHybrid(input: {
  llm: ModelKsbJudgement;
  heuristic: ModelKsbJudgement;
  hits: RetrievalHit[];
  sufficiency: EvidenceSufficiency;
}): ModelKsbJudgement {
  let out = applyEvidenceSufficiencyCalibration({
    judgement: input.llm,
    sufficiency: input.sufficiency,
  });
  const h = input.heuristic;
  const hits = input.hits;
  const s = input.sufficiency;
  const strength =
    normalizeEvidenceStrength(s.coverageStrength) ??
    normalizeEvidenceStrength(out.evidenceStrength) ??
    "ABSENT";

  if (out.classification === "curriculum_gap" && strengthAllowsPrimary(strength)) {
    if (h.classification === "distributed_skill") {
      return {
        ...out,
        coverage: "covered",
        ownership: "distributed",
        classification: "distributed_skill",
        confidence: "medium",
        confidenceScore: Math.min(out.confidenceScore ?? 65, 65),
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [
          ...new Set([
            ...out.reinforcementBlockNumbers,
            ...h.reinforcementBlockNumbers,
          ]),
        ].slice(0, 5),
        reasoningSummary: `${out.reasoningSummary} | Calibration: ${strength} multi-system evidence — not a curriculum gap.`,
        warnings: [
          ...out.warnings,
          `Calibration: gap overridden → distributed_skill (${strength}).`,
        ],
      };
    }

    if (input.llm.proposedPrimaryBlockNumber != null) {
      return {
        ...out,
        coverage: "covered",
        ownership: "clear_primary",
        ownershipConfidence: "medium",
        classification: "primary_candidate",
        confidence: "medium",
        proposedPrimaryBlockNumber: input.llm.proposedPrimaryBlockNumber,
        reasoningSummary: `${out.reasoningSummary} | Calibration: ${strength} coverage — Primary restored at medium confidence.`,
        warnings: [
          ...out.warnings,
          `Calibration: false-gap guard (${strength}) — gap → primary_candidate medium.`,
        ],
      };
    }

    return {
      ...out,
      coverage: "covered",
      ownership: "ambiguous_primary",
      classification: "ambiguous",
      confidence: "medium",
      confidenceScore: Math.min(out.confidenceScore ?? 60, 58),
      proposedPrimaryBlockNumber: null,
      reasoningSummary: `${out.reasoningSummary} | Calibration: ${strength} taught; ownership needs review (not a gap).`,
      warnings: [
        ...out.warnings,
        `Calibration: false-gap guard (${strength}) — gap → ambiguous.`,
      ],
    };
  }

  if (
    h.classification === "distributed_skill" &&
    out.classification === "primary_candidate" &&
    strengthAllowsPrimary(strength)
  ) {
    return {
      ...out,
      coverage: "covered",
      ownership: "distributed",
      classification: "distributed_skill",
      confidence: demoteConfidence(out.confidence),
      confidenceScore: Math.min(out.confidenceScore ?? 70, 68),
      proposedPrimaryBlockNumber: null,
      reinforcementBlockNumbers: [
        ...new Set([
          ...(out.proposedPrimaryBlockNumber != null
            ? [out.proposedPrimaryBlockNumber]
            : []),
          ...out.reinforcementBlockNumbers,
          ...h.reinforcementBlockNumbers,
        ]),
      ].slice(0, 5),
      reasoningSummary: `${out.reasoningSummary} | Calibration: heuristic multi-system signal → distributed_skill review.`,
      warnings: [
        ...out.warnings,
        "Calibration: Primary → distributed_skill (multi-system ownership signal).",
      ],
    };
  }

  if (
    out.classification === "primary_candidate" &&
    h.classification === "curriculum_gap"
  ) {
    if (!strengthAllowsPrimary(strength)) {
      if (
        strength === "MATERIAL_PARTIAL" &&
        s.missingEssentialComponents.length === 0
      ) {
        out = {
          ...out,
          confidence: demoteConfidence(out.confidence),
          warnings: [
            ...out.warnings,
            "Calibration: heuristic gap without named essential — Primary retained.",
          ],
        };
      } else {
        return {
          ...out,
          coverage: sufficiencyToCoverage(strength),
          ownership: "none",
          classification: "curriculum_gap",
          confidence: "medium",
          proposedPrimaryBlockNumber: null,
          missingEssentialComponents: s.missingEssentialComponents,
          reasoningSummary: `${out.reasoningSummary} | Calibration: heuristic gap + ${strength} — curriculum_gap.`,
          warnings: [
            ...out.warnings,
            "Calibration: insufficient breadth — Primary not retained.",
          ],
        };
      }
    } else {
      out = {
        ...out,
        confidence: demoteConfidence(out.confidence),
        ownershipConfidence: "medium",
        reasoningSummary: `${out.reasoningSummary} | Calibration: heuristic gap disagreed but ${strength} sufficiency — Primary retained.`,
        warnings: [
          ...out.warnings,
          `Calibration: LLM Primary retained (${strength}); heuristic gap → confidence demoted.`,
        ],
      };
    }
  } else if (
    out.classification === "primary_candidate" &&
    h.classification !== "primary_candidate" &&
    h.classification !== "distributed_skill"
  ) {
    out = {
      ...out,
      confidence: demoteConfidence(out.confidence),
      warnings: [
        ...out.warnings,
        `Calibration: heuristic=${h.classification} → confidence demoted.`,
      ],
    };
  }

  if (
    out.classification === "primary_candidate" &&
    h.classification === "primary_candidate" &&
    out.proposedPrimaryBlockNumber != null &&
    h.proposedPrimaryBlockNumber != null &&
    out.proposedPrimaryBlockNumber !== h.proposedPrimaryBlockNumber
  ) {
    const llmBlock = out.proposedPrimaryBlockNumber;
    const hBlock = h.proposedPrimaryBlockNumber;
    const llmScore = bestScoreForBlock(hits, llmBlock);
    const hScore = bestScoreForBlock(hits, hBlock);
    const scoreRatio =
      Math.min(llmScore, hScore) / Math.max(llmScore, hScore || 1);

    if (scoreRatio >= 0.85) {
      return {
        ...out,
        coverage: "covered",
        ownership: "ambiguous_primary",
        ownershipConfidence: "medium",
        classification: "ambiguous",
        confidence: "medium",
        confidenceScore: Math.min(out.confidenceScore ?? 60, 55),
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [
          ...new Set([llmBlock, hBlock, ...out.reinforcementBlockNumbers]),
        ].slice(0, 5),
        reasoningSummary: `${out.reasoningSummary} | Calibration: near-tied Primary homes B${llmBlock} vs B${hBlock} → ambiguous.`,
        warnings: [
          ...out.warnings,
          "Calibration: Primary-block near-tie → ambiguous (coverage retained).",
        ],
      };
    }

    return {
      ...out,
      confidence: demoteConfidence(out.confidence),
      ownershipConfidence: "medium",
      reinforcementBlockNumbers: [
        ...new Set([hBlock, ...out.reinforcementBlockNumbers]),
      ].slice(0, 5),
      reasoningSummary: `${out.reasoningSummary} | Calibration: ownership review — rival B${hBlock}; LLM Primary B${llmBlock} retained.`,
      warnings: [
        ...out.warnings,
        "Calibration: Primary-block disagreement → confidence demoted; rival surfaced.",
      ],
    };
  }

  if (out.classification === "primary_candidate" && out.proposedPrimaryBlockNumber != null) {
    const chosen = out.proposedPrimaryBlockNumber;
    const chosenWeek = bestWeekForBlock(hits, chosen);
    const chosenScore = bestScoreForBlock(hits, chosen);
    if (chosenWeek != null && chosenScore > 0) {
      const earlierCompetitors = hits.filter(
        (hit) =>
          !hit.rejected &&
          hit.session.blockNumber !== chosen &&
          hit.session.week + 12 <= chosenWeek &&
          hit.score >= chosenScore * 0.85,
      );
      if (earlierCompetitors.length) {
        const earliest = [...earlierCompetitors].sort(
          (a, b) => a.session.week - b.session.week || b.score - a.score,
        )[0]!;
        return {
          ...out,
          ownership: "ambiguous_primary",
          ownershipConfidence: "medium",
          classification: "ambiguous",
          confidence: "medium",
          confidenceScore: Math.min(out.confidenceScore ?? 60, 55),
          proposedPrimaryBlockNumber: null,
          reinforcementBlockNumbers: [
            ...new Set([
              chosen,
              earliest.session.blockNumber,
              ...out.reinforcementBlockNumbers,
            ]),
          ].slice(0, 5),
          reasoningSummary: `${out.reasoningSummary} | Chronology signal: earlier B${earliest.session.blockNumber} nearly ties later B${chosen}.`,
          warnings: [
            ...out.warnings,
            "Chronology signal: near-tied earlier vs later → ambiguous.",
          ],
        };
      }

      const weakerEarlier = hits.filter(
        (hit) =>
          !hit.rejected &&
          hit.session.blockNumber !== chosen &&
          hit.session.week + 12 <= chosenWeek &&
          hit.score >= chosenScore * 0.65 &&
          hit.score < chosenScore * 0.85,
      );
      if (weakerEarlier.length) {
        const earliest = [...weakerEarlier].sort(
          (a, b) => a.session.week - b.session.week || b.score - a.score,
        )[0]!;
        out = {
          ...out,
          confidence: demoteConfidence(out.confidence),
          ownershipConfidence: "medium",
          reinforcementBlockNumbers: [
            ...new Set([
              earliest.session.blockNumber,
              ...out.reinforcementBlockNumbers,
            ]),
          ].slice(0, 5),
          warnings: [
            ...out.warnings,
            `Chronology signal: earlier rival B${earliest.session.blockNumber} surfaced; Primary retained.`,
          ],
        };
      }
    }
  }

  return out;
}
