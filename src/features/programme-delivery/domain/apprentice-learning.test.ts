import { describe, expect, it } from "vitest";
import {
  CONTROLLED_TASK_AVAILABILITY_LABEL,
  isRetiredCeaGroupTaskKey,
} from "./apprentice-learning";
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
});
