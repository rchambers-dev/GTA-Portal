/**
 * Deterministic heuristic judge used for tests / offline runs / hybrid signal.
 * Explicit providerMode=heuristic — not a silent AI fallback.
 * General curriculum rules only — no golden KSB→block hardcoding.
 */

import type { RetrievalHit } from "./retriever";
import type { ModelKsbJudgement } from "./schema";
import type { OfficialKsbRef } from "./types";
import {
  assessEvidenceSufficiency,
  type EvidenceSufficiency,
} from "./evidence-sufficiency";

const LATE_WEEK = 100;

function listsMultipleSystems(description: string): boolean {
  const d = description.toLowerCase();
  if (!/inspect|remove|replace/.test(d)) return false;
  const systems = [
    /steering/,
    /suspension/,
    /braking|brake/,
    /emission/,
    /air conditioning|climate/,
    /engine/,
    /electrical/,
    /drivetrain|transmission/,
  ];
  return systems.filter((re) => re.test(d)).length >= 3;
}

function bestHitPerBlock(hits: RetrievalHit[]): Map<number, RetrievalHit> {
  const map = new Map<number, RetrievalHit>();
  for (const h of hits) {
    const prev = map.get(h.session.blockNumber);
    if (!prev || h.score > prev.score || (h.score === prev.score && h.session.week < prev.session.week)) {
      map.set(h.session.blockNumber, h);
    }
  }
  return map;
}

export function heuristicJudgeKsb(input: {
  ksb: OfficialKsbRef;
  hits: RetrievalHit[];
  sufficiency?: EvidenceSufficiency;
}): ModelKsbJudgement {
  const code = input.ksb.code.toUpperCase();
  const desc = input.ksb.description.toLowerCase();
  const sufficiency =
    input.sufficiency ??
    assessEvidenceSufficiency({ ksb: input.ksb, hits: input.hits });
  const usable = input.hits
    .filter((h) => !h.rejected && h.score >= 3.5)
    .sort((a, b) => b.score - a.score || a.session.week - b.session.week);
  const strong = usable.filter((h) => h.score >= 6.5 && h.session.week < LATE_WEEK);

  // Sufficiency: WEAK/ABSENT ⇒ gap; MATERIAL_PARTIAL with named essentials ⇒ gap.
  const strength = sufficiency.coverageStrength;
  if (
    strength === "ABSENT" ||
    strength === "WEAK_ADJACENT" ||
    strength === "WEAK_REFERENCE" ||
    (strength === "MATERIAL_PARTIAL" &&
      sufficiency.missingEssentialComponents.length > 0) ||
    (strength === "PARTIAL" && sufficiency.missingMaterialBreadth)
  ) {
    return {
      ksbCode: code,
      coverage:
        strength === "MATERIAL_PARTIAL" || strength === "PARTIAL"
          ? "partial"
          : "absent",
      ownership: "none",
      evidenceStrength:
        strength === "PARTIAL"
          ? "MATERIAL_PARTIAL"
          : strength === "WEAK_REFERENCE"
            ? "WEAK_ADJACENT"
            : strength,
      coveredComponents: sufficiency.coveredComponents,
      missingComponents: sufficiency.missingComponents,
      missingEssentialComponents: sufficiency.missingEssentialComponents,
      coverageConfidence: "high",
      ownershipConfidence: "high",
      classification: "curriculum_gap",
      confidence: "medium",
      confidenceScore: 70,
      proposedPrimaryBlockNumber: null,
      reinforcementBlockNumbers: [],
      evidenceLocationRefs: usable.slice(0, 2).map((h) => h.session.evidenceRefId),
      reasoningSummary: `Evidence sufficiency ${strength}: official essential breadth not defensibly covered.`,
      warnings: [
        "Heuristic sufficiency: weak/adjacent/material-partial — gap signal.",
        ...sufficiency.reasons,
      ],
      rejectedFalsePositives: input.hits
        .filter((h) => h.rejected)
        .map((h) => h.rejectReason || h.session.evidenceRefId),
    };
  }

  // Genuine multi-system breadth with no single owner in evidence.
  if (listsMultipleSystems(input.ksb.description)) {
    const blocks = new Set(usable.map((h) => h.session.blockNumber));
    if (blocks.size >= 2 || usable.length >= 2) {
      return {
        ksbCode: code,
        classification: "distributed_skill",
        confidence: "high",
        confidenceScore: 80,
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [...blocks].slice(0, 5),
        evidenceLocationRefs: usable.slice(0, 5).map((h) => h.session.evidenceRefId),
        reasoningSummary:
          "Official requirement spans multiple distinct vehicle systems; evidence is spread across blocks with no single defensive Primary owner.",
        warnings: ["Distributed-skill / Primary-ownership review — not a no-teaching gap."],
        rejectedFalsePositives: [],
      };
    }
  }

  // Known thin/absent official topics from methodology (keyword absence).
  const hardGapSignals = [
    [/fca|pci|payment card|financial conduct/, ["fca", "pci", "payment card"]],
    [/state-of-health|state of health|\bsoh\b/, ["state-of-health", "soh"]],
    [/equity|diversity|inclusion|inclusive workplace/, ["inclusion", "diversity", "equity", "inclusive"]],
    [/gdpr|cyber security|\bcyber\b/, ["gdpr", "cyber"]],
    [/levels of autonomy|passive and active/, ["levels of autonomy", "passive and active"]],
  ] as const;

  for (const [re, needles] of hardGapSignals) {
    if (!re.test(desc)) continue;
    const found = usable.some((h) =>
      needles.some((n) => h.session.searchableText.includes(n)),
    );
    if (!found) {
      return {
        ksbCode: code,
        classification: "curriculum_gap",
        confidence: "high",
        confidenceScore: 75,
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: [],
        reasoningSummary:
          "No defensible current teaching evidence for the distinctive official requirement wording.",
        warnings: ["Hard gap signal — distinctive official terms absent from strong evidence."],
        rejectedFalsePositives: input.hits
          .filter((h) => h.rejected)
          .map((h) => h.rejectReason || h.session.evidenceRefId),
      };
    }
  }

  if (!usable.length) {
    return {
      ksbCode: code,
      classification: "curriculum_gap",
      confidence: "medium",
      confidenceScore: 60,
      proposedPrimaryBlockNumber: null,
      reinforcementBlockNumbers: [],
      evidenceLocationRefs: [],
      reasoningSummary: "Retrieval found no substantive current-approved teaching evidence.",
      warnings: [],
      rejectedFalsePositives: input.hits
        .filter((h) => h.rejected)
        .map((h) => h.rejectReason || h.session.evidenceRefId),
    };
  }

  // Prefer earliest substantive teaching among near-tied top hits.
  const pool = (strong.length ? strong : usable).slice(0, 6);
  const topScore = pool[0]!.score;
  const nearTied = pool.filter((h) => topScore - h.score <= 1.8);
  const byBlock = bestHitPerBlock(nearTied);
  const blockHits = [...byBlock.values()].sort(
    (a, b) => a.session.week - b.session.week || b.score - a.score,
  );

  if (blockHits.length >= 2) {
    const earliest = blockHits[0]!;
    const rival = blockHits[1]!;
    const scoreGap = Math.abs(earliest.score - rival.score);
    const weekGap = rival.session.week - earliest.session.week;

    // Close score across blocks → review unless earliest is clearly stronger teaching.
    if (scoreGap < 1.4 && weekGap <= 35) {
      return {
        ksbCode: code,
        classification: "ambiguous",
        confidence: "medium",
        confidenceScore: 55,
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: blockHits.map((h) => h.session.blockNumber).slice(0, 4),
        evidenceLocationRefs: blockHits.slice(0, 2).map((h) => h.session.evidenceRefId),
        reasoningSummary: `Near-tied teaching homes: B${earliest.session.blockNumber} W${earliest.session.week} vs B${rival.session.blockNumber} W${rival.session.week}.`,
        warnings: ["Human curriculum intent required — do not force Primary."],
        rejectedFalsePositives: [],
      };
    }
  }

  const scoreWinner = pool[0]!;
  const earliestCompetitive = [...pool].sort(
    (a, b) => a.session.week - b.session.week || b.score - a.score,
  )[0]!;

  // Steering systems vs geometry false home
  if (/steering systems/i.test(desc) && !/geometry|alignment/i.test(desc)) {
    const steeringReal = usable.find((h) =>
      /power assisted|epas|steering rack|steering system/.test(h.session.searchableText),
    );
    if (!steeringReal) {
      return {
        ksbCode: code,
        classification: "curriculum_gap",
        confidence: "high",
        confidenceScore: 78,
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: [],
        evidenceLocationRefs: usable.slice(0, 2).map((h) => h.session.evidenceRefId),
        reasoningSummary:
          "Geometry/tyre-wear adjacency is insufficient for steering-systems purpose/function/location teaching.",
        warnings: ["Rejected steering-geometry false friend as Primary."],
        rejectedFalsePositives: ["steering geometry ≠ steering systems"],
      };
    }
  }

  // Tyre remove/repair/replace/balance — require practical breadth, not TPMS-only adjacency
  if (/tyre|tire/.test(desc) && /remove|replace|repair|balance/.test(desc)) {
    const balance = usable.find(
      (h) =>
        /balance|strip|demount|remove.*tyre|tyre.*replace/.test(h.session.practicalText) &&
        !/tpms/i.test(h.session.topic),
    );
    const tpmsOnly = /tpms|pressure monitoring/i.test(scoreWinner.session.topic);
    if (!balance || tpmsOnly) {
      return {
        ksbCode: code,
        classification: "curriculum_gap",
        confidence: "high",
        confidenceScore: 82,
        proposedPrimaryBlockNumber: null,
        reinforcementBlockNumbers: usable.map((h) => h.session.blockNumber).slice(0, 3),
        evidenceLocationRefs: usable.slice(0, 3).map((h) => h.session.evidenceRefId),
        reasoningSummary:
          "No defensible remove/repair/replace/balance practical Primary; TPMS/inspection adjacency insufficient.",
        warnings: ["Partial tyre/TPMS evidence is not Primary-eligible."],
        rejectedFalsePositives: ["TPMS≠full tyre strip/balance skill"],
      };
    }
  }

  // Later higher lexical score that looks like reinforcement → prefer earlier teaching home
  let top = scoreWinner;
  if (
    earliestCompetitive.session.blockNumber !== scoreWinner.session.blockNumber &&
    earliestCompetitive.session.week + 12 <= scoreWinner.session.week &&
    scoreWinner.score - earliestCompetitive.score < 2.5 &&
    earliestCompetitive.score >= 5.0
  ) {
    top = earliestCompetitive;
  }

  const conf: ModelKsbJudgement["confidence"] =
    top.score >= 9 ? "high" : top.score >= 6.5 ? "medium" : "low";

  if (conf === "low") {
    return {
      ksbCode: code,
      classification: "ambiguous",
      confidence: "low",
      confidenceScore: top.score,
      proposedPrimaryBlockNumber: null,
      reinforcementBlockNumbers: [top.session.blockNumber],
      evidenceLocationRefs: [top.session.evidenceRefId],
      reasoningSummary: "Weak/indirect evidence only — human review required.",
      warnings: ["LOW confidence must not auto-become Primary."],
      rejectedFalsePositives: [],
    };
  }

  const reinforcements = usable
    .filter((h) => h.session.blockNumber !== top.session.blockNumber)
    .slice(0, 4)
    .map((h) => h.session.blockNumber);

  const chronologyNote =
    top.session.evidenceRefId !== scoreWinner.session.evidenceRefId
      ? ` Earlier substantive teaching preferred over later lexical match at B${scoreWinner.session.blockNumber} W${scoreWinner.session.week}.`
      : "";

  return {
    ksbCode: code,
    classification: "primary_candidate",
    confidence:
      top.session.evidenceRefId !== scoreWinner.session.evidenceRefId ? "medium" : conf,
    confidenceScore: Math.min(99, top.score * 8),
    proposedPrimaryBlockNumber: top.session.blockNumber,
    reinforcementBlockNumbers: reinforcements,
    evidenceLocationRefs: usable.slice(0, 4).map((h) => h.session.evidenceRefId),
    reasoningSummary: `Strongest defensible teaching home at B${top.session.blockNumber} W${top.session.week} (${top.session.topic}).${chronologyNote}`,
    warnings:
      top.session.evidenceRefId !== scoreWinner.session.evidenceRefId
        ? ["Chronology guard: later lexical match demoted to reinforcement."]
        : [],
    rejectedFalsePositives: input.hits
      .filter((h) => h.rejected)
      .map((h) => h.rejectReason || h.session.evidenceRefId),
  };
}
