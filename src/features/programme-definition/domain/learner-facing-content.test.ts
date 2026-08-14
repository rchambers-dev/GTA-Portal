import { describe, expect, it } from "vitest";
import {
  approvedLearnerCopy,
  candidateFromSource,
  isSecurityTestFixtureResource,
  learnerFacingBlockTitle,
  learnerFacingSessionTitle,
  parseLearnerFacingContent,
  sessionCodesLine,
} from "./learner-facing-content";

describe("learner-facing content", () => {
  it("does not treat a source candidate as approved apprentice copy", () => {
    const content = parseLearnerFacingContent({
      status: "candidate_for_review",
      candidate: {
        summary: "Workshop safety",
        learningContent: "Candidate aims from FS01",
        activityPractice: "Safety walk",
        sourceLabel: "FS01 lesson plan",
      },
    });
    expect(content.status).toBe("candidate_for_review");
    expect(approvedLearnerCopy(content)).toBeNull();
  });

  it("returns approved copy only after curriculum-owner publish", () => {
    const content = parseLearnerFacingContent({
      status: "approved_published",
      candidate: {
        summary: "Raw candidate",
        learningContent: "Do not show this",
        activityPractice: "",
        sourceLabel: "FS01 lesson plan",
      },
      approved: {
        summary: "Workshop safety",
        learningContent: "Approved learner summary",
        activityPractice: "Safety walk",
        sourceLabel: "FS01 lesson plan",
        approvedAt: "2026-08-13T12:00:00.000Z",
        approvedByName: "Curriculum owner",
      },
    });
    expect(approvedLearnerCopy(content)?.learningContent).toBe(
      "Approved learner summary",
    );
  });

  it("builds a staff-side candidate from source aims without inventing extras", () => {
    const draft = candidateFromSource({
      sourceLabel: "FS01 lesson plan",
      topic: "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
      lessonAims: ["Develop safe working expectations."],
      byTheEnd: ["Identify hazards and controls."],
      activityLines: ["Guided site and workshop safety walk."],
    });
    expect(draft.summary).toContain("Workshop Safety");
    expect(draft.learningContent).toContain("Develop safe working expectations.");
    expect(draft.activityPractice).toContain("workshop safety walk");
  });

  it("uses a learner-facing Block 1 heading without the controlled title", () => {
    expect(learnerFacingBlockTitle(1, "Foundation Skills")).toBe(
      "Block 1 — Foundation Skills",
    );
    expect(
      learnerFacingBlockTitle(
        1,
        "Motor Vehicle Foundation Skills - Shared Controlled Programme",
      ),
    ).toBe("Block 1 — Foundation Skills");
  });

  it("keeps Session codes secondary to the learner title", () => {
    expect(
      learnerFacingSessionTitle({
        title: "FS01: Workshop Safety",
        topic: "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
      }),
    ).toBe(
      "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
    );
    expect(
      sessionCodesLine({
        calendarWeek: 1,
        foundationSkillCode: "FS01",
        sessionKey: "W001",
      }),
    ).toBe("Week 1 · FS01 · W001");
  });

  it("recognises the SAFE DEMO learner fixture", () => {
    expect(
      isSecurityTestFixtureResource({
        title: "TEST learner handout fixture (W001) — SAFE DEMO",
        filename: "TEST_W001_learner_handout_fixture.txt",
      }),
    ).toBe(true);
    expect(
      isSecurityTestFixtureResource({
        title: "Workshop safety handout",
        filename: "safety.pdf",
      }),
    ).toBe(false);
    expect(
      isSecurityTestFixtureResource({
        title: "TEST learner resource — W011 visibility proof — SAFE DEMO",
        filename: "TEST_W011_learner_visibility_proof.txt",
      }),
    ).toBe(false);
  });
});
