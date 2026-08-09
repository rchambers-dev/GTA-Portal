import { describe, expect, it } from "vitest";
import { resolveProgrammeForEnrolment } from "./resolve-enrolment-programme";
import type { ProgrammeDefinitionState } from "@/features/programme-definition/domain/types";
import { defaultProgrammeParameters } from "@/features/programme-definition/domain/programme-definition-store";

function baseState(): ProgrammeDefinitionState {
  return {
    version: 5,
    officialVersions: [
      {
        id: "off-1",
        standardCode: "ST0499",
        occupationCode: "OCC0499",
        title: "Autocare",
        externalVersion: "1.3",
        level: 2,
        status: "approved",
        typicalDurationMonths: 27,
        assessmentPeriodMonths: null,
        minimumComplianceHours: 605,
        maximumFundingPounds: 13000,
        larsCode: null,
        route: "",
        pathway: "",
        cluster: "",
        assessmentPlanUrl: "",
        approvedForDeliveryDate: null,
        updatedDate: null,
        apprenticeshipDetailsComplete: true,
        duties: [],
        ksbs: [
          { code: "K1", type: "knowledge", description: "K1" },
          { code: "S1", type: "skill", description: "S1" },
        ],
        linkedProducts: [],
        occupationRawPayload: null,
        apprenticeshipRawPayload: null,
        sourceHash: "h",
        importedAt: "2026-01-01T00:00:00.000Z",
        locked: true,
      },
    ],
    programmes: [
      {
        id: "prog-old",
        programmeId: "p",
        programmeTitle: "Autocare old",
        standardVersionId: "off-1",
        standardCode: "ST0499",
        externalVersion: "1.3",
        internalVersion: "1",
        status: "published",
        spineItems: [],
        ksbMappings: [],
        parameters: {
          ...defaultProgrammeParameters(),
          formulaKey: "block_ksb_value_v1",
        },
        hasEnrolledApprentices: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "prog-new",
        programmeId: "p",
        programmeTitle: "Autocare new",
        standardVersionId: "off-1",
        standardCode: "ST0499",
        externalVersion: "1.3",
        internalVersion: "2",
        status: "published",
        spineItems: [],
        ksbMappings: [],
        parameters: {
          ...defaultProgrammeParameters(),
          formulaKey: "block_ksb_value_v1",
        },
        hasEnrolledApprentices: false,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ],
    selectedProgrammeId: "prog-new",
    activityLog: [],
    apiPingByStandard: {},
  };
}

describe("resolveProgrammeForEnrolment", () => {
  it("uses the pinned programme version, not the newest selected one", () => {
    const state = baseState();
    const result = resolveProgrammeForEnrolment({
      enrolment: {
        standardCode: "ST0499",
        gtaProgrammeVersionId: "prog-old",
      },
      programmeState: state,
    });
    expect(result.status).toBe("pinned");
    if (result.status === "pinned") {
      expect(result.programme.id).toBe("prog-old");
      expect(result.official.id).toBe("off-1");
    }
  });

  it("does not auto-bind when unpinned", () => {
    const result = resolveProgrammeForEnrolment({
      enrolment: {
        standardCode: "ST0499",
        gtaProgrammeVersionId: null,
      },
      programmeState: baseState(),
    });
    expect(result.status).toBe("unpinned");
    if (result.status === "unpinned") {
      expect(result.candidates.length).toBe(2);
    }
  });

  it("surfaces a missing pin target without falling back to newest", () => {
    const result = resolveProgrammeForEnrolment({
      enrolment: {
        standardCode: "ST0499",
        gtaProgrammeVersionId: "does-not-exist",
      },
      programmeState: baseState(),
    });
    expect(result.status).toBe("pin_missing_programme");
  });
});
