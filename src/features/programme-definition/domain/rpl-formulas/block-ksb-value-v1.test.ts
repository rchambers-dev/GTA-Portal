import { describe, expect, it } from "vitest";
import {
  runBlockKsbValueV1,
  validateLearnerRplPercent,
  validateCurriculumValue,
} from "./index";
import type { BlockKsbMapping, ImportedKsb, SpineItem } from "../types";

const now = "2026-01-01T00:00:00.000Z";

function block(id: string, sequence: number, plannedOtjHours = 0): SpineItem {
  return {
    id,
    itemType: "block",
    gatewayType: null,
    title: `Block ${sequence}`,
    sequence,
    plannedWeeks: 1,
    plannedOtjHours,
    countsTowardsLearningHours: true,
    metadata: {},
  };
}

function mapping(
  blockId: string,
  ksbCode: string,
  curriculumValue: number,
  isPrimary = true,
): BlockKsbMapping {
  return {
    id: crypto.randomUUID(),
    blockId,
    ksbCode,
    isPrimary,
    learningIntent: isPrimary ? "introduce" : "reinforce",
    curriculumValue,
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

const officialKsbs: Pick<ImportedKsb, "code" | "type">[] = [
  { code: "K1", type: "knowledge" },
  { code: "K2", type: "knowledge" },
  { code: "K9", type: "knowledge" },
  { code: "S1", type: "skill" },
  { code: "B1", type: "behaviour" },
];

describe("validateLearnerRplPercent", () => {
  it("accepts 0–100 inclusive", () => {
    expect(validateLearnerRplPercent(0).ok).toBe(true);
    expect(validateLearnerRplPercent(100).ok).toBe(true);
    expect(validateLearnerRplPercent(37.5).ok).toBe(true);
  });

  it("rejects out of range and non-finite without clamping", () => {
    expect(validateLearnerRplPercent(150).ok).toBe(false);
    expect(validateLearnerRplPercent(-1).ok).toBe(false);
    expect(validateLearnerRplPercent(Number.NaN).ok).toBe(false);
    expect(validateLearnerRplPercent("50" as unknown).ok).toBe(false);
  });
});

describe("validateCurriculumValue", () => {
  it("requires finite > 0", () => {
    expect(validateCurriculumValue(1).ok).toBe(true);
    expect(validateCurriculumValue(0).ok).toBe(false);
    expect(validateCurriculumValue(-1).ok).toBe(false);
  });
});

describe("runBlockKsbValueV1", () => {
  it("matches the approved end-to-end worked example (VALUE_SHARE)", () => {
    // Programme OTJ = 660, programme curriculum value = 120
    // Single valued block of 10 with learner 25/50/0 → recognised 3
    const spineItems = [
      block("b1", 1, 55),
      { ...block("gw", 2), itemType: "gateway" as const, title: "Gateway" },
    ];
    // Values that sum to programme 120: this block 10 + filler block 110
    const b2 = block("b2", 3, 0);
    const mappings = [
      mapping("b1", "K1", 1),
      mapping("b1", "K2", 3),
      mapping("b1", "S1", 4),
      mapping("b1", "B1", 2),
      // filler to reach programme value 120
      mapping("b2", "K9", 110),
    ];

    const result = runBlockKsbValueV1({
      spineItems: [...spineItems, b2],
      mappings,
      officialKsbs,
      programmeExpectedOtjHours: 660,
      blocks: [
        {
          blockId: "b1",
          plannedOtjHours: 55,
          learner: {
            knowledgePct: 25,
            skillsPct: 50,
            behavioursPct: 0,
          },
        },
        {
          blockId: "b2",
          plannedOtjHours: 0,
          learner: { knowledgePct: 0, skillsPct: 0, behavioursPct: 0 },
        },
      ],
    });

    expect(result.formulaKey).toBe("block_ksb_value_v1");
    expect(result.otjAllocation).toBe("VALUE_SHARE");
    expect(result.programmeCurriculumValue).toBe(120);
    expect(result.hoursPerCurriculumUnit).toBeCloseTo(5.5);
    expect(result.otjAllocatable).toBe(true);

    const b1 = result.blocks.find((b) => b.blockId === "b1")!;
    expect(b1.knowledgeValue).toBe(4);
    expect(b1.skillsValue).toBe(4);
    expect(b1.behaviourValue).toBe(2);
    expect(b1.blockValue).toBe(10);
    expect(b1.recognisedKnowledgeValue).toBe(1);
    expect(b1.recognisedSkillsValue).toBe(2);
    expect(b1.recognisedBehaviourValue).toBe(0);
    expect(b1.recognisedBlockValue).toBe(3);
    expect(b1.remainingBlockValue).toBe(7);
    expect(b1.recognisedFraction).toBeCloseTo(0.3);
    expect(b1.derivedBlockCurriculumOtj).toBeCloseTo(55);
    expect(b1.recognisedOtj).toBeCloseTo(16.5);
    expect(b1.remainingOtj).toBeCloseTo(38.5);
    // Delivery planned OTJ is pass-through only
    expect(b1.plannedOtjHours).toBe(55);

    expect(result.recognisedProgrammeValue).toBe(3);
    expect(result.remainingProgrammeValue).toBe(117);
    expect(result.recognisedOtj).toBeCloseTo(16.5);
    expect(result.remainingOtj).toBeCloseTo(643.5);
  });

  it("counts non-primary mappings in block value", () => {
    const spineItems = [block("b1", 1), block("b2", 2)];
    const mappings = [
      mapping("b1", "K9", 2, true),
      mapping("b2", "K9", 0.5, false),
    ];
    const result = runBlockKsbValueV1({
      spineItems,
      mappings,
      officialKsbs,
      programmeExpectedOtjHours: 100,
      blocks: [
        {
          blockId: "b1",
          plannedOtjHours: 0,
          learner: { knowledgePct: 0, skillsPct: 0, behavioursPct: 0 },
        },
        {
          blockId: "b2",
          plannedOtjHours: 0,
          learner: { knowledgePct: 0, skillsPct: 0, behavioursPct: 0 },
        },
      ],
    });
    expect(result.programmeCurriculumValue).toBe(2.5);
    expect(result.blocks.find((b) => b.blockId === "b2")!.blockValue).toBe(0.5);
  });

  it("ignores mappings on non-block spine items", () => {
    const spineItems: SpineItem[] = [
      block("b1", 1),
      {
        id: "epa1",
        itemType: "epa",
        gatewayType: null,
        title: "EPA",
        sequence: 2,
        plannedWeeks: null,
        plannedOtjHours: 0,
        countsTowardsLearningHours: false,
        metadata: {},
      },
    ];
    const mappings = [
      mapping("b1", "K1", 1),
      mapping("epa1", "K2", 99),
    ];
    const result = runBlockKsbValueV1({
      spineItems,
      mappings,
      officialKsbs,
      programmeExpectedOtjHours: 10,
      blocks: [
        {
          blockId: "b1",
          plannedOtjHours: 0,
          learner: { knowledgePct: 0, skillsPct: 0, behavioursPct: 0 },
        },
      ],
    });
    expect(result.programmeCurriculumValue).toBe(1);
  });

  it("does not allocate OTJ when expected OTJ is missing", () => {
    const result = runBlockKsbValueV1({
      spineItems: [block("b1", 1)],
      mappings: [mapping("b1", "K1", 1)],
      officialKsbs,
      programmeExpectedOtjHours: null,
      blocks: [
        {
          blockId: "b1",
          plannedOtjHours: 40,
          learner: { knowledgePct: 100, skillsPct: 0, behavioursPct: 0 },
        },
      ],
    });
    expect(result.otjAllocatable).toBe(false);
    expect(result.hoursPerCurriculumUnit).toBeNull();
    expect(result.recognisedOtj).toBe(0);
    expect(result.remainingOtj).toBe(0);
    expect(result.blocks[0]!.recognisedBlockValue).toBe(1);
  });

  it("throws on invalid learner percentages (no silent clamp)", () => {
    expect(() =>
      runBlockKsbValueV1({
        spineItems: [block("b1", 1)],
        mappings: [mapping("b1", "K1", 1)],
        officialKsbs,
        programmeExpectedOtjHours: 10,
        blocks: [
          {
            blockId: "b1",
            plannedOtjHours: 0,
            learner: { knowledgePct: 150, skillsPct: 0, behavioursPct: 0 },
          },
        ],
      }),
    ).toThrow(/Knowledge already held/);
  });

  it("forces recognised value to 0 for RPL-excluded dimensions without changing curriculum", () => {
    // Block: K=4, S=5, B=2 → blockValue 11
    // B OFF; learner K 50%, S 20%, B 100% (ignored) → recognised 2+1+0 = 3
    const result = runBlockKsbValueV1({
      spineItems: [block("b1", 1)],
      mappings: [
        mapping("b1", "K1", 4),
        mapping("b1", "S1", 5),
        mapping("b1", "B1", 2),
      ],
      officialKsbs,
      programmeExpectedOtjHours: 110,
      blocks: [
        {
          blockId: "b1",
          plannedOtjHours: 0,
          learner: {
            knowledgePct: 50,
            skillsPct: 20,
            behavioursPct: 100,
          },
        },
      ],
      params: {
        fundingBandPounds: null,
        fixedCostLines: [],
        includeRplKnowledge: true,
        includeRplSkills: true,
        includeRplBehaviours: false,
      },
    });

    const b1 = result.blocks[0]!;
    expect(b1.knowledgeValue).toBe(4);
    expect(b1.skillsValue).toBe(5);
    expect(b1.behaviourValue).toBe(2);
    expect(b1.blockValue).toBe(11);
    expect(result.programmeCurriculumValue).toBe(11);
    expect(b1.recognisedKnowledgeValue).toBe(2);
    expect(b1.recognisedSkillsValue).toBe(1);
    expect(b1.recognisedBehaviourValue).toBe(0);
    expect(b1.recognisedBlockValue).toBe(3);
    expect(b1.remainingBlockValue).toBe(8);
    // VALUE_SHARE denominator unchanged (full curriculum)
    expect(result.hoursPerCurriculumUnit).toBeCloseTo(10);
  });

  it("treats missing includeRpl flags as all enabled (historical snapshots)", () => {
    const result = runBlockKsbValueV1({
      spineItems: [block("b1", 1)],
      mappings: [mapping("b1", "B1", 2)],
      officialKsbs,
      programmeExpectedOtjHours: 20,
      blocks: [
        {
          blockId: "b1",
          plannedOtjHours: 0,
          learner: { knowledgePct: 0, skillsPct: 0, behavioursPct: 50 },
        },
      ],
      params: {
        fundingBandPounds: null,
        fixedCostLines: [],
      },
    });
    expect(result.blocks[0]!.recognisedBehaviourValue).toBe(1);
  });
});
