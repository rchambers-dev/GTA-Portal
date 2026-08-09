import { describe, expect, it } from "vitest";
import {
  createDefaultProgrammeParameters,
  parseStoredProgrammeParameters,
  serializeProgrammeParameters,
  ProgrammeParametersValidationError,
} from "./programme-parameters";
import { mergeProgrammeFromDb } from "../spine-repository";
import type {
  GtaProgrammeVersion,
  ProgrammeDeliveryParameters,
} from "../types";
import { runBlockKsbValueV1 } from "./block-ksb-value-v1";
import { calculateTnp1 } from "./tnp1";

function sampleBlockParams(
  overrides: Partial<ProgrammeDeliveryParameters> = {},
): ProgrammeDeliveryParameters {
  return {
    ...createDefaultProgrammeParameters(),
    expectedOtjHours: 611.5,
    includeRplKnowledge: true,
    includeRplSkills: true,
    includeRplBehaviours: false,
    fundingBandPounds: 13000,
    fixedCostLines: [
      {
        id: "fc-epa",
        label: "EPA",
        amountPounds: 2000,
        enabled: true,
        sequence: 0,
      },
    ],
    formulaKey: "block_ksb_value_v1",
    formulaStatus: "published",
    rplNotes: "Behaviours off for this cohort",
    ...overrides,
  };
}

function sampleWeightedParams(): ProgrammeDeliveryParameters {
  return {
    ...createDefaultProgrammeParameters(),
    formulaKey: "weighted_ksb_cap_v1",
    formulaStatus: "published",
    expectedOtjHours: 611.5,
    includeAplK: true,
    includeAplS: true,
    includeAplB: false,
    aplWeightK: 0.4,
    aplWeightS: 0.6,
    aplWeightB: 0,
    aplMaxFraction: 0.25,
    includeRplKnowledge: true,
    includeRplSkills: true,
    includeRplBehaviours: true,
    fundingBandPounds: 13000,
    fixedCostLines: [],
    rplNotes: "Legacy weighted snapshot",
  };
}

function stubProgramme(
  id: string,
  params: ProgrammeDeliveryParameters,
): GtaProgrammeVersion {
  return {
    id,
    programmeId: "prog",
    programmeTitle: "Test",
    standardVersionId: "sv",
    standardCode: "ST0499",
    externalVersion: "1.3",
    internalVersion: "1",
    status: "draft",
    spineItems: [],
    ksbMappings: [],
    parameters: params,
    hasEnrolledApprentices: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("programme parameters persistence contract", () => {
  it("new programmes get block_ksb_value_v1 defaults at creation", () => {
    const d = createDefaultProgrammeParameters();
    expect(d.formulaKey).toBe("block_ksb_value_v1");
    expect(d.formulaStatus).toBe("draft");
    expect(d.includeRplKnowledge).toBe(true);
    expect(d.includeRplSkills).toBe(true);
    expect(d.includeRplBehaviours).toBe(true);
    expect(d.expectedOtjHours).toBeNull();
    expect(d.fundingBandPounds).toBeNull();
    expect(d.fixedCostLines).toEqual([]);
  });

  it("round-trips configured block_ksb_value_v1 parameters (PUT→DB→GET shape)", () => {
    const saved = sampleBlockParams();
    const stored = serializeProgrammeParameters(saved);
    const loaded = parseStoredProgrammeParameters(stored);
    expect(loaded).toEqual(saved);
    expect(loaded.expectedOtjHours).toBe(611.5);
    expect(loaded.includeRplBehaviours).toBe(false);
    expect(loaded.fundingBandPounds).toBe(13000);
    expect(loaded.fixedCostLines).toEqual(saved.fixedCostLines);
    expect(loaded.formulaStatus).toBe("published");
    expect(loaded.rplNotes).toBe("Behaviours off for this cohort");
  });

  it("round-trips explicit weighted_ksb_cap_v1 parameters", () => {
    const saved = sampleWeightedParams();
    const loaded = parseStoredProgrammeParameters(
      serializeProgrammeParameters(saved),
    );
    expect(loaded.formulaKey).toBe("weighted_ksb_cap_v1");
    expect(loaded.aplWeightK).toBe(0.4);
    expect(loaded.aplWeightS).toBe(0.6);
    expect(loaded.aplMaxFraction).toBe(0.25);
    expect(loaded.includeAplB).toBe(false);
    expect(loaded).toEqual(saved);
  });

  it("rejects unknown/corrupt formula keys (no silent default)", () => {
    expect(() =>
      parseStoredProgrammeParameters({
        ...sampleBlockParams(),
        formulaKey: "not_a_real_formula",
      }),
    ).toThrow(ProgrammeParametersValidationError);

    expect(() => parseStoredProgrammeParameters({})).toThrow(
      /no stored parameters/,
    );

    expect(() =>
      parseStoredProgrammeParameters({
        ...sampleBlockParams(),
        formulaKey: null,
      }),
    ).toThrow(/missing formulaKey/);
  });

  it("does not invent defaults for incomplete stored config", () => {
    expect(() =>
      parseStoredProgrammeParameters({
        formulaKey: "block_ksb_value_v1",
        // missing required fields
      }),
    ).toThrow(ProgrammeParametersValidationError);
  });
});

describe("hydrate: DB wins over stale localStorage", () => {
  it("mergeProgrammeFromDb keeps DB parameters over stale local defaults", () => {
    const staleLocal = stubProgramme("v1", createDefaultProgrammeParameters());
    const fromDb = stubProgramme(
      "v1",
      sampleBlockParams({ rplNotes: "from-db" }),
    );
    fromDb.spineItems = [
      {
        id: "b1",
        itemType: "block",
        gatewayType: null,
        title: "Block 1",
        sequence: 1,
        plannedWeeks: 10,
        plannedOtjHours: 45,
        countsTowardsLearningHours: true,
        metadata: {},
      },
    ];

    const merged = mergeProgrammeFromDb(staleLocal, fromDb);
    expect(merged.parameters.expectedOtjHours).toBe(611.5);
    expect(merged.parameters.includeRplBehaviours).toBe(false);
    expect(merged.parameters.rplNotes).toBe("from-db");
    expect(merged.spineItems).toHaveLength(1);
    // Local-only fields that DB does not own can remain if not in incoming —
    // but parameters must be DB.
    expect(merged.parameters).toEqual(fromDb.parameters);
  });

  it("requesting V1 never receives V2 parameters (version isolation)", () => {
    const v1 = stubProgramme("version-1", sampleBlockParams({ rplNotes: "V1" }));
    const v2 = stubProgramme(
      "version-2",
      sampleBlockParams({
        expectedOtjHours: 999,
        rplNotes: "V2 newest",
      }),
    );
    // Hydrate as if API returned V1 only
    const merged = mergeProgrammeFromDb(undefined, v1);
    expect(merged.id).toBe("version-1");
    expect(merged.parameters.rplNotes).toBe("V1");
    expect(merged.parameters.expectedOtjHours).not.toBe(v2.parameters.expectedOtjHours);
  });
});

describe("RPL/TNP same after parameter reload", () => {
  it("VALUE_SHARE + TNP1 match before and after serialize/parse", () => {
    const before = sampleBlockParams();
    const after = parseStoredProgrammeParameters(
      serializeProgrammeParameters(before),
    );

    const spineItems = [
      {
        id: "b1",
        itemType: "block" as const,
        gatewayType: null,
        title: "Block 1",
        sequence: 1,
        plannedWeeks: 10,
        plannedOtjHours: 45,
        countsTowardsLearningHours: true,
        metadata: {},
      },
    ];
    const mappings = [
      {
        id: "m1",
        blockId: "b1",
        ksbCode: "K1",
        isPrimary: true,
        learningIntent: "introduce" as const,
        curriculumValue: 10,
        mappingSource: "manual" as const,
        recommendationProvider: null,
        recommendationFeature: null,
        recommendedIntent: null,
        recommendationAccepted: null,
        confidence: null,
        aiReasonSummary: null,
        createdBy: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m2",
        blockId: "b1",
        ksbCode: "S1",
        isPrimary: true,
        learningIntent: "introduce" as const,
        curriculumValue: 10,
        mappingSource: "manual" as const,
        recommendationProvider: null,
        recommendationFeature: null,
        recommendedIntent: null,
        recommendationAccepted: null,
        confidence: null,
        aiReasonSummary: null,
        createdBy: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "m3",
        blockId: "b1",
        ksbCode: "B1",
        isPrimary: true,
        learningIntent: "introduce" as const,
        curriculumValue: 10,
        mappingSource: "manual" as const,
        recommendationProvider: null,
        recommendationFeature: null,
        recommendedIntent: null,
        recommendationAccepted: null,
        confidence: null,
        aiReasonSummary: null,
        createdBy: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const officialKsbs = [
      { code: "K1", type: "knowledge" as const },
      { code: "S1", type: "skill" as const },
      { code: "B1", type: "behaviour" as const },
    ];
    const blocks = [
      {
        blockId: "b1",
        plannedOtjHours: 45,
        learner: {
          knowledgePct: 50,
          skillsPct: 0,
          behavioursPct: 100,
        },
      },
    ];

    const rplBefore = runBlockKsbValueV1({
      spineItems,
      mappings,
      officialKsbs,
      programmeExpectedOtjHours: before.expectedOtjHours,
      blocks,
      params: {
        includeRplKnowledge: before.includeRplKnowledge,
        includeRplSkills: before.includeRplSkills,
        includeRplBehaviours: before.includeRplBehaviours,
        fundingBandPounds: before.fundingBandPounds,
        fixedCostLines: before.fixedCostLines,
      },
    });
    const rplAfter = runBlockKsbValueV1({
      spineItems,
      mappings,
      officialKsbs,
      programmeExpectedOtjHours: after.expectedOtjHours,
      blocks,
      params: {
        includeRplKnowledge: after.includeRplKnowledge,
        includeRplSkills: after.includeRplSkills,
        includeRplBehaviours: after.includeRplBehaviours,
        fundingBandPounds: after.fundingBandPounds,
        fixedCostLines: after.fixedCostLines,
      },
    });

    expect(rplAfter).toEqual(rplBefore);

    const tnpBefore = calculateTnp1({
      fundingBandPounds: before.fundingBandPounds,
      fixedCostLines: before.fixedCostLines,
      programmeCurriculumValue: rplBefore.programmeCurriculumValue,
      remainingProgrammeValue: rplBefore.remainingProgrammeValue,
    });
    const tnpAfter = calculateTnp1({
      fundingBandPounds: after.fundingBandPounds,
      fixedCostLines: after.fixedCostLines,
      programmeCurriculumValue: rplAfter.programmeCurriculumValue,
      remainingProgrammeValue: rplAfter.remainingProgrammeValue,
    });
    expect(tnpAfter).toEqual(tnpBefore);
    // Behaviours OFF ⇒ recognised behaviour value 0 despite 100% learner %
    expect(rplBefore.blocks[0]!.recognisedBehaviourValue).toBe(0);
  });
});
