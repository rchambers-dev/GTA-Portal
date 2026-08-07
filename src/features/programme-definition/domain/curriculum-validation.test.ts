import { describe, expect, it } from "vitest";
import {
  createCurriculumValidationService,
  DEFAULT_CURRICULUM_RULES,
  HEAVY_DUPLICATION_BLOCK_THRESHOLD,
  REPEATED_INTENT_THRESHOLD,
} from "./curriculum-validation";
import type {
  BlockKsbMapping,
  GtaProgrammeVersion,
  OfficialStandardVersion,
  SpineItem,
} from "./types";

function block(id: string, sequence: number): SpineItem {
  return {
    id,
    itemType: "block",
    gatewayType: null,
    title: `Block ${sequence}`,
    sequence,
    plannedWeeks: 1,
    plannedOtjHours: 10,
    countsTowardsLearningHours: true,
    metadata: {},
  };
}

function mapping(
  blockId: string,
  ksbCode: string,
  learningIntent: BlockKsbMapping["learningIntent"],
): BlockKsbMapping {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    blockId,
    ksbCode,
    isPrimary: false,
    learningIntent,
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

function programme(
  spineItems: SpineItem[],
  ksbMappings: BlockKsbMapping[],
): GtaProgrammeVersion {
  return {
    id: "pv1",
    programmeId: "p1",
    programmeTitle: "Test",
    standardVersionId: "sv1",
    standardCode: "ST0000",
    externalVersion: "1.0",
    internalVersion: "1",
    status: "draft",
    spineItems,
    ksbMappings,
    parameters: {
      expectedOtjHours: null,
      formulaKey: "weighted_ksb_cap_v1",
      formulaStatus: "draft",
      includeAplK: true,
      includeAplS: true,
      includeAplB: true,
      aplWeightK: 0.3,
      aplWeightS: 0.5,
      aplWeightB: 0.2,
      aplMaxFraction: 0.3,
      rplNotes: "",
    },
    hasEnrolledApprentices: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const official = {
  ksbs: [
    { code: "K1", type: "knowledge", description: "K1" },
    { code: "K2", type: "knowledge", description: "K2" },
    { code: "K3", type: "knowledge", description: "K3" },
    { code: "K4", type: "knowledge", description: "K4" },
    { code: "K5", type: "knowledge", description: "K5" },
    { code: "S1", type: "skill", description: "S1" },
  ],
} as OfficialStandardVersion;

describe("curriculumValidation", () => {
  it("warns when ASSESS precedes INTRODUCE", () => {
    const service = createCurriculumValidationService();
    const spine = [block("b1", 1), block("b2", 2)];
    const findings = service.validate(
      programme(spine, [
        mapping("b1", "K1", "assess"),
        mapping("b2", "K1", "introduce"),
      ]),
      official,
    );
    expect(findings.some((f) => f.code === "ksb_assess_before_introduce")).toBe(
      true,
    );
  });

  it("warns on multiple INTRODUCE", () => {
    const service = createCurriculumValidationService();
    const spine = [block("b1", 1), block("b2", 2)];
    const findings = service.validate(
      programme(spine, [
        mapping("b1", "K1", "introduce"),
        mapping("b2", "K1", "introduce"),
      ]),
      official,
    );
    expect(findings.some((f) => f.code === "ksb_multi_introduce")).toBe(true);
  });

  it("warns when the same intent repeats enough times", () => {
    const service = createCurriculumValidationService();
    const spine = Array.from({ length: REPEATED_INTENT_THRESHOLD }, (_, i) =>
      block(`b${i + 1}`, i + 1),
    );
    const maps = spine.map((b) => mapping(b.id, "K1", "practise"));
    const findings = service.validate(programme(spine, maps), official);
    expect(findings.some((f) => f.code === "ksb_repeated_intent")).toBe(true);
  });

  it("warns on absolute heavy duplication", () => {
    const service = createCurriculumValidationService();
    const spine = Array.from(
      { length: HEAVY_DUPLICATION_BLOCK_THRESHOLD },
      (_, i) => block(`b${i + 1}`, i + 1),
    );
    const maps = spine.map((b, i) =>
      mapping(b.id, "K1", i === 0 ? "introduce" : "practise"),
    );
    const findings = service.validate(programme(spine, maps), official);
    expect(findings.some((f) => f.code === "ksb_heavy_duplication")).toBe(true);
  });

  it("allows registering an extra rule without changing defaults", () => {
    const service = createCurriculumValidationService([]);
    expect(service.listRules()).toHaveLength(0);
    service.register(DEFAULT_CURRICULUM_RULES[0]!);
    expect(service.listRules()).toHaveLength(1);
  });

  it("never emits errors — findings are advisory warnings", () => {
    const service = createCurriculumValidationService();
    const spine = [block("b1", 1), block("b2", 2)];
    const findings = service.validate(
      programme(spine, [
        mapping("b1", "K1", "assess"),
        mapping("b2", "K1", "introduce"),
      ]),
      official,
    );
    expect(findings.every((f) => f.severity === "warning")).toBe(true);
  });
});
