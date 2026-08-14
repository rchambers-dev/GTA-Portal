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

  it("renders W001/W002 Available and remaining Coming up after release", () => {
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
    expect(lane.find((r) => r.session.key === "W001")?.status).toBe("available");
    expect(lane.find((r) => r.session.key === "W002")?.status).toBe("available");
    expect(lane.find((r) => r.session.key === "W003")?.status).toBe("coming_up");
    expect(lane.find((r) => r.session.key === "W004")?.status).toBe("coming_up");
    expect(lane.find((r) => r.session.key === "W011")?.status).toBe("coming_up");
    expect(lane.filter((r) => r.status === "available")).toHaveLength(2);
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

  it("does not hide a PowerPoint just because of its file extension", () => {
    expect(
      includesTutorLessonPlan([
        {
          title: "TEST learner presentation — Hybrid awareness (SAFE DEMO)",
          filename: "TEST_W003_learner_presentation.pptx",
        },
      ]),
    ).toBe(false);
    expect(
      includesTutorLessonPlan([
        {
          title: "Features of Hybrid Vehicles",
          filename: "Features of Hybrid Vehicles.ppt",
        },
      ]),
    ).toBe(false);
  });

  it("still treats lesson plans as tutor leaks if they appear in learner materials", () => {
    expect(
      includesTutorLessonPlan([
        {
          title: "Week 12 lesson plan — Electrical System Inspection (v4.4)",
          filename: "Autocare_L2_Week_012_Lesson_Plan_v4.4.docx",
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
      status: "available",
      statusLabel: "Available",
      releasedAt: "2026-08-14T09:00:00.000Z",
      learningInformation: "Approved Block 1 copy",
      activityPractice: "Guided activity",
      hasApprovedLearning: true,
      materials: [],
      reviewLearning: true,
      openable: true,
    };
    const w011: LearnerSessionView = {
      id: "sess-w011",
      sessionKey: "W011",
      title: "Customer Service Scenarios",
      codesLine: "Week 11 · W011",
      foundationSkillCode: null,
      calendarWeek: 11,
      status: "coming_up",
      statusLabel: "Coming up",
      releasedAt: null,
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

  it("does not let an apprentice open an unreleased Session in an unlocked Block", () => {
    const w003: LearnerSessionView = {
      id: "sess-w003",
      sessionKey: "W003",
      title: "Hybrid and High-Voltage Vehicle Awareness",
      codesLine: "Week 3 · FS03 · W003",
      foundationSkillCode: "FS03",
      calendarWeek: 3,
      status: "coming_up",
      statusLabel: "Coming up",
      releasedAt: null,
      learningInformation: "Not released",
      activityPractice: "Not released",
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
    ];
    expect(resolveApprenticeSessionAccess(blocks, "sess-w003").status).toBe(
      "locked",
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
