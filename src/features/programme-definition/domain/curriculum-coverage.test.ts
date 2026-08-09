import { describe, expect, it } from "vitest";
import { buildCurriculumCoverageSnapshot } from "./curriculum-coverage";
import {
  AUTOCARE_ST0499_V1_DISTRIBUTED_SKILL_REVIEWS,
  AUTOCARE_ST0499_V1_REVIEWED_GAPS,
} from "./reviewed-curriculum-gaps";
import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  OfficialStandardVersion,
  SpineItem,
} from "./types";

function block(id: string, sequence: number, title?: string): SpineItem {
  return {
    id,
    itemType: "block",
    gatewayType: null,
    title: title ?? `Block ${sequence}`,
    sequence,
    plannedWeeks: 1,
    plannedOtjHours: 10,
    countsTowardsLearningHours: true,
    metadata: { blockNumber: sequence },
  };
}

function primary(blockId: string, ksbCode: string): BlockKsbMapping {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    blockId,
    ksbCode,
    isPrimary: true,
    learningIntent: "introduce",
    curriculumValue: 1,
    mappingSource: "manual",
    recommendationProvider: null,
    recommendationFeature: null,
    recommendedIntent: null,
    recommendationAccepted: null,
    confidence: null,
    aiReasonSummary: null,
    createdBy: "test",
    createdAt: now,
    updatedAt: now,
  };
}

function official(codes: string[]): OfficialStandardVersion {
  return {
    ksbs: codes.map((code) => ({
      code,
      type: code.startsWith("K")
        ? "knowledge"
        : code.startsWith("S")
          ? "skill"
          : "behaviour",
      description: `${code} statement`,
    })),
  } as OfficialStandardVersion;
}

function nowSafe() {
  return "2026-01-01T00:00:00.000Z";
}

function programme(
  id: string,
  spineItems: SpineItem[],
  ksbMappings: BlockKsbMapping[],
): GtaProgrammeVersion {
  return {
    id,
    programmeId: "p1",
    programmeTitle: "Autocare",
    standardVersionId: "sv1",
    standardCode: "ST0499",
    externalVersion: "1.3",
    internalVersion: "1",
    status: "draft",
    spineItems,
    ksbMappings,
    parameters: {
      expectedOtjHours: null,
      formulaKey: "block_ksb_value_v1",
      formulaStatus: "draft",
      includeAplK: true,
      includeAplS: true,
      includeAplB: true,
      aplWeightK: 0.3,
      aplWeightS: 0.5,
      aplWeightB: 0.2,
      aplMaxFraction: 1,
      includeRplKnowledge: true,
      includeRplSkills: true,
      includeRplBehaviours: true,
      fundingBandPounds: null,
      fixedCostLines: [],
      rplNotes: "",
    },
    hasEnrolledApprentices: false,
    createdAt: nowSafe(),
    updatedAt: nowSafe(),
  };
}

describe("buildCurriculumCoverageSnapshot", () => {
  const versionId = AUTOCARE_ST0499_V1_REVIEWED_GAPS.programmeVersionId;
  const gapCodes = AUTOCARE_ST0499_V1_REVIEWED_GAPS.groups.flatMap((g) =>
    g.ksbs.map((c) => c.toUpperCase()),
  );
  const distributedCodes =
    AUTOCARE_ST0499_V1_DISTRIBUTED_SKILL_REVIEWS.map((r) =>
      r.ksbCode.toUpperCase(),
    );

  it("counts 18 reviewed gaps and keeps S10 as distributed-skill review", () => {
    expect(gapCodes).toHaveLength(18);
    expect(distributedCodes).toEqual(["S10"]);
    expect(new Set([...gapCodes, ...distributedCodes]).size).toBe(19);

    const snap = buildCurriculumCoverageSnapshot(
      programme(versionId, [block("b2", 2)], []),
      official([...gapCodes, ...distributedCodes, "K12"]),
    );

    expect(snap.reviewedGapCount).toBe(18);
    expect(snap.distributedSkillCount).toBe(1);
    expect(snap.bucketByCode.S10).toBe("distributed_skill_review");
    expect(snap.bucketByCode.K8).toBe("reviewed_gap");
    expect(snap.bucketByCode.K12).toBe("not_yet_resolved");
    expect(snap.publicationBlocked).toBe(true);
    expect(snap.reviewedRegister?.groups).toHaveLength(13);
  });

  it("derives approved coverage from DB mappings only", () => {
    const b2 = block("b2", 2);
    const snap = buildCurriculumCoverageSnapshot(
      programme(versionId, [b2], [primary("b2", "K12")]),
      official(["K12", "K1", "S10"]),
    );
    expect(snap.approvedPrimaryCount).toBe(1);
    expect(snap.reviewedGapCount).toBe(1);
    expect(snap.distributedSkillCount).toBe(1);
    expect(snap.notYetResolvedCount).toBe(0);
    expect(snap.gatewayEpaMappingCount).toBe(0);
    expect(snap.publicationBlocked).toBe(true);
  });

  it("does not attach register for unrelated programmes", () => {
    const snap = buildCurriculumCoverageSnapshot(
      programme("other", [block("b2", 2)], [primary("b2", "K12"), primary("b2", "K1")]),
      official(["K12", "K1", "S10"]),
    );
    expect(snap.reviewedGapCount).toBe(0);
    expect(snap.distributedSkillCount).toBe(0);
    expect(snap.notYetResolvedCount).toBe(1); // S10
  });
});
