import { describe, expect, it } from "vitest";
import {
  BLOCK2_SESSION_IS_NOT_TASK,
  CONTROLLED_TASK_AVAILABILITY_LABEL,
  comingUpTaskRow,
  isRetiredCeaGroupTaskKey,
  resolveApprenticeSessionAccess,
  sessionCompletionCompletesTask,
  type ApprenticeLearningBlock,
} from "./apprentice-learning";
import type { LearnerSessionView } from "./learner-session-view";
import { assignSessionLaneStatuses } from "./session-lane";
import { includesTutorLessonPlan } from "./learner-session-view";

describe("controlled apprentice learning (no Groups/CEA)", () => {
  it("does not treat retired CEA Group task keys as controlled Tasks", () => {
    expect(isRetiredCeaGroupTaskKey("g1-t1")).toBe(true);
    expect(isRetiredCeaGroupTaskKey("g3-t12")).toBe(true);
    expect(isRetiredCeaGroupTaskKey("b1-t1")).toBe(false);
    expect(isRetiredCeaGroupTaskKey("b1-t5")).toBe(false);
  });

  it("uses honest Coming up copy instead of auto-Available", () => {
    expect(CONTROLLED_TASK_AVAILABILITY_LABEL).toBe("Coming up");
    expect(CONTROLLED_TASK_AVAILABILITY_LABEL).not.toMatch(/Available/i);
    expect(CONTROLLED_TASK_AVAILABILITY_LABEL).not.toMatch(/S7|configured/i);
  });

  it("renders W001/W002 completed, one Current/next, remaining upcoming", () => {
    const lane = assignSessionLaneStatuses(
      [
        { id: "w001", key: "W001" },
        { id: "w002", key: "W002" },
        { id: "w003", key: "W003" },
        { id: "w004", key: "W004" },
        { id: "w010", key: "W010" },
        { id: "w011", key: "W011" },
      ],
      new Set(["w001", "w002"]),
    );
    expect(lane.filter((r) => r.status === "current")).toHaveLength(1);
    expect(lane.find((r) => r.session.key === "W001")?.status).toBe("completed");
    expect(lane.find((r) => r.session.key === "W002")?.status).toBe("completed");
    expect(lane.find((r) => r.session.key === "W003")?.status).toBe("current");
    expect(lane.find((r) => r.session.key === "W004")?.status).toBe("upcoming");
    expect(lane.find((r) => r.session.key === "W011")?.status).toBe("upcoming");
  });

  it("does not treat FS01 lesson plan titles as learner-visible", () => {
    expect(
      includesTutorLessonPlan([
        { title: "FS01 lesson plan", filename: "FS01_Lesson_Plan.docx" },
      ]),
    ).toBe(true);
    expect(
      includesTutorLessonPlan([
        {
          title: "TEST learner handout fixture (W001) — SAFE DEMO",
          filename: "TEST_W001_learner_handout_fixture.txt",
        },
      ]),
    ).toBe(false);
  });

  it("treats Block 1 teaching PowerPoints as tutor-only leak if they appear in learner materials", () => {
    expect(
      includesTutorLessonPlan([
        {
          title: "Features of Hybrid Vehicles",
          filename: "Features of Hybrid Vehicles.ppt",
        },
      ]),
    ).toBe(true);
  });

  it("treats Block 2 v4.4 lesson plans and teaching PowerPoints as tutor-only leaks", () => {
    expect(
      includesTutorLessonPlan([
        {
          title: "Week 12 lesson plan — Electrical System Inspection (v4.4)",
          filename: "Autocare_L2_Week_012_Lesson_Plan_v4.4.docx",
        },
      ]),
    ).toBe(true);
    expect(
      includesTutorLessonPlan([
        {
          title: "Unplaced Block 2 teaching deck",
          filename: "Block2_Teaching.pptx",
        },
      ]),
    ).toBe(true);
  });

  it("does not let a week-3 apprentice open published Block 2 content", () => {
    const w003: LearnerSessionView = {
      id: "sess-w003",
      sessionKey: "W003",
      title: "Hybrid and High-Voltage Vehicle Awareness",
      codesLine: "Week 3 · FS03 · W003",
      foundationSkillCode: "FS03",
      calendarWeek: 3,
      status: "current",
      statusLabel: "Current / next",
      deliveredAt: null,
      learningInformation: "Approved Block 1 copy",
      activityPractice: "Guided activity",
      hasApprovedLearning: true,
      materials: [],
      reviewLearning: false,
      openable: true,
    };
    const w011: LearnerSessionView = {
      id: "sess-w011",
      sessionKey: "W011",
      title: "Customer Service Scenarios",
      codesLine: "Week 11 · W011",
      foundationSkillCode: null,
      calendarWeek: 11,
      status: "upcoming",
      statusLabel: "Upcoming",
      deliveredAt: null,
      learningInformation: "Locked placeholder",
      activityPractice: "Locked placeholder",
      hasApprovedLearning: false,
      materials: [],
      reviewLearning: false,
      openable: false,
    };
    const blocks: ApprenticeLearningBlock[] = [
      {
        spineItemId: "b1",
        title: "Block 1",
        displayTitle: "Block 1 — Foundation Skills",
        displayOrdinal: 1,
        weekStart: 1,
        weekEnd: 10,
        plannedOtjHours: 45,
        unlocked: true,
        sessions: [w003],
        tasks: [],
      },
      {
        spineItemId: "b2",
        title: "Block 2",
        displayTitle: "Block 2",
        displayOrdinal: 2,
        weekStart: 11,
        weekEnd: 20,
        plannedOtjHours: 45,
        unlocked: false,
        sessions: [w011],
        tasks: [],
      },
    ];
    expect(resolveApprenticeSessionAccess(blocks, "sess-w003").status).toBe(
      "open",
    );
    expect(resolveApprenticeSessionAccess(blocks, "sess-w011").status).toBe(
      "locked",
    );
    expect(resolveApprenticeSessionAccess(blocks, "sess-missing").status).toBe(
      "missing",
    );
  });

  it("keeps Block 2 Tasks Coming up after matching Session completion", () => {
    for (const pair of BLOCK2_SESSION_IS_NOT_TASK) {
      expect(
        sessionCompletionCompletesTask(pair.sessionKey, pair.taskNumber),
      ).toBe(false);
      const row = comingUpTaskRow({
        id: `b2-t${pair.taskNumber}`,
        taskKey: `b2-t${pair.taskNumber}`,
        spineItemId: "b2",
        blockOrdinal: 2,
        taskNumber: pair.taskNumber,
        kind: "practical",
        title: `Task ${pair.taskNumber}`,
      });
      expect(row.availabilityLabel).toBe(CONTROLLED_TASK_AVAILABILITY_LABEL);
      expect(row.openable).toBe(false);
    }
  });
});
