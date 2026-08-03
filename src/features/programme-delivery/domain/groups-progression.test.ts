import { describe, expect, it } from "vitest";
import {
  addCalendarMonthsIso,
  groupsPhaseWindowDates,
  programmeMonthsElapsed,
} from "./programme-months";
import {
  buildGroupsBragBoard,
  calculateGroupsProgress,
  summariseGroupCompletion,
} from "./groups-progression";
import type {
  CeaApprenticeState,
  CeaPackDef,
} from "@/features/apprentice-portal/domain/cea";

const START = "2024-01-15";

const miniPack: CeaPackDef = {
  id: "test-pack",
  title: "Test",
  version: "1.0",
  standardCode: "ST0068",
  standardLabel: "Test",
  milestones: [
    {
      id: "ms-0-6",
      title: "0–6 months",
      description: "",
      sortOrder: 1,
      phaseLabel: "0–6 months",
      monthStart: 0,
      monthEnd: 6,
      kind: "groups_phase",
    },
    {
      id: "ms-7-12",
      title: "7–12 months",
      description: "",
      sortOrder: 2,
      phaseLabel: "7–12 months",
      monthStart: 7,
      monthEnd: 12,
      kind: "groups_phase",
    },
    {
      id: "ms-gateway1",
      title: "Gateway 1",
      description: "",
      sortOrder: 3,
      phaseLabel: "Gateway 1",
      monthStart: 12,
      monthEnd: 12,
      kind: "gateway",
      courseWeightPercent: 10,
    },
  ],
  groups: [
    {
      id: "g1",
      milestoneId: "ms-0-6",
      number: 1,
      title: "Group 1",
      mandatoryRequired: 1,
      milestoneWeightPercent: 50,
      courseWeightPercent: 2.5,
      yearLabel: "Year 1",
      phaseLabel: "0–6 months",
      tasks: [
        {
          id: "g1-t1",
          groupId: "g1",
          number: 1,
          title: "Task 1",
        },
      ],
    },
    {
      id: "g2",
      milestoneId: "ms-0-6",
      number: 2,
      title: "Group 2",
      mandatoryRequired: 1,
      milestoneWeightPercent: 50,
      courseWeightPercent: 2.5,
      yearLabel: "Year 1",
      phaseLabel: "0–6 months",
      tasks: [
        {
          id: "g2-t1",
          groupId: "g2",
          number: 1,
          title: "Task 1",
        },
      ],
    },
    {
      id: "g5",
      milestoneId: "ms-7-12",
      number: 5,
      title: "Group 5",
      mandatoryRequired: 1,
      milestoneWeightPercent: 100,
      courseWeightPercent: 5,
      yearLabel: "Year 1",
      phaseLabel: "7–12 months",
      tasks: [
        {
          id: "g5-t1",
          groupId: "g5",
          number: 1,
          title: "Task 1",
        },
      ],
    },
  ],
  gatewayItems: [],
  supportItems: [],
};

function blankState(overrides?: Partial<CeaApprenticeState>): CeaApprenticeState {
  return {
    apprenticeId: "a1",
    packId: miniPack.id,
    mandatoryByGroup: {
      g1: ["g1-t1"],
      g2: ["g2-t1"],
      g5: ["g5-t1"],
    },
    progress: {},
    milestoneReflections: {},
    ...overrides,
  };
}

describe("programme months", () => {
  it("adds calendar months with day clamp", () => {
    expect(addCalendarMonthsIso("2024-01-31", 1)).toBe("2024-02-29");
    expect(addCalendarMonthsIso(START, 6)).toBe("2024-07-15");
  });

  it("builds 0–6 and 7–12 windows from the sheet rule", () => {
    expect(groupsPhaseWindowDates({
      programmeStartIso: START,
      monthStart: 0,
      monthEnd: 6,
    })).toEqual({ startIso: START, endIso: "2024-07-15" });

    expect(groupsPhaseWindowDates({
      programmeStartIso: START,
      monthStart: 7,
      monthEnd: 12,
    })).toEqual({ startIso: "2024-07-15", endIso: "2025-01-15" });
  });

  it("counts elapsed programme months", () => {
    expect(programmeMonthsElapsed(START, "2024-01-15")).toBe(0);
    expect(programmeMonthsElapsed(START, "2024-07-15")).toBe(6);
    expect(programmeMonthsElapsed(START, "2024-07-14")).toBe(5);
  });
});

describe("groups progression engine", () => {
  it("marks incomplete work behind after the phase end", () => {
    const board = buildGroupsBragBoard({
      pack: miniPack,
      state: blankState(),
      programmeStartIso: START,
      asOfIso: "2024-08-01",
    });
    const g1 = board.trainingRows.find((r) => r.group.id === "g1");
    expect(g1?.brag).toBe("red");
    const g5 = board.trainingRows.find((r) => r.group.id === "g5");
    expect(g5?.brag).toBe("green");
  });

  it("marks finished-before-end as blue while the window is open", () => {
    const state = blankState({
      progress: {
        "g1-t1": {
          taskId: "g1-t1",
          kind: "mandatory",
          additionalEnabled: false,
          status: "signed_off",
          apprenticeNotes: "",
          fields: {},
          fieldReviews: {},
          comments: [],
          versions: [],
          apprenticeDeclaredAt: null,
          submissionCount: 1,
          isResubmission: false,
          submittedAt: "2024-03-01",
          readyAt: "2024-03-01",
          employerSignedByName: null,
          employerSignedAt: null,
          signedOffByRole: "teacher",
          signedOffByName: "Tutor",
          signedOffAt: "2024-03-01",
          returnNote: null,
          tutorReview: null,
        },
      },
    });
    const board = buildGroupsBragBoard({
      pack: miniPack,
      state,
      programmeStartIso: START,
      asOfIso: "2024-04-01",
    });
    expect(board.trainingRows.find((r) => r.group.id === "g1")?.brag).toBe(
      "blue",
    );
  });

  it("treats gateway RAG as behind once past due", () => {
    const board = buildGroupsBragBoard({
      pack: miniPack,
      state: blankState(),
      programmeStartIso: START,
      asOfIso: "2025-02-01",
    });
    const gw = board.milestoneRows.find((r) => r.milestone.id === "ms-gateway1");
    expect(gw?.status).toBe("behind");
  });

  it("credits course % only for signed-off mandatory groups", () => {
    const incomplete = calculateGroupsProgress({
      pack: miniPack,
      state: blankState(),
      programmeStartIso: START,
      asOfIso: "2024-08-01",
    });
    expect(incomplete.actualPercent).toBe(0);
    expect(incomplete.plannedPercent).toBeGreaterThan(0);

    const state = blankState({
      progress: {
        "g1-t1": {
          taskId: "g1-t1",
          kind: "mandatory",
          additionalEnabled: false,
          status: "signed_off",
          apprenticeNotes: "",
          fields: {},
          fieldReviews: {},
          comments: [],
          versions: [],
          apprenticeDeclaredAt: null,
          submissionCount: 1,
          isResubmission: false,
          submittedAt: "2024-03-01",
          readyAt: "2024-03-01",
          employerSignedByName: null,
          employerSignedAt: null,
          signedOffByRole: "teacher",
          signedOffByName: "Tutor",
          signedOffAt: "2024-03-01",
          returnNote: null,
          tutorReview: null,
        },
        "g2-t1": {
          taskId: "g2-t1",
          kind: "mandatory",
          additionalEnabled: false,
          status: "signed_off",
          apprenticeNotes: "",
          fields: {},
          fieldReviews: {},
          comments: [],
          versions: [],
          apprenticeDeclaredAt: null,
          submissionCount: 1,
          isResubmission: false,
          submittedAt: "2024-03-02",
          readyAt: "2024-03-02",
          employerSignedByName: null,
          employerSignedAt: null,
          signedOffByRole: "teacher",
          signedOffByName: "Tutor",
          signedOffAt: "2024-03-02",
          returnNote: null,
          tutorReview: null,
        },
      },
    });
    expect(summariseGroupCompletion(miniPack.groups[0]!, state).complete).toBe(
      true,
    );
    const done = calculateGroupsProgress({
      pack: miniPack,
      state,
      programmeStartIso: START,
      asOfIso: "2024-08-01",
    });
    // 2.5 + 2.5 of total weights (2.5+2.5+5+10 = 20) → 25%
    expect(done.actualPercent).toBe(25);
  });
});
