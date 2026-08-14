import { describe, expect, it } from "vitest";
import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";
import {
  LEARNER_BLOCK_LOCKED,
  LEARNER_CONTENT_PENDING,
  LEARNER_NOT_RELEASED,
} from "@/features/programme-definition/domain/learner-facing-content";
import {
  includesTutorLessonPlan,
  toLearnerSessionView,
} from "./learner-session-view";

const baseSession: ProgrammeSessionRecord = {
  id: "s1",
  programmeVersionId: "pv",
  spineItemId: "b1",
  sessionKey: "W001",
  sequence: 1,
  calendarWeek: 1,
  sessionIndexInWeek: 1,
  title: "FS01: Workshop Safety",
  topic: "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
  foundationSkillCode: "FS01",
  plannedOtjHours: null,
  publishStatus: "published",
  learningObjectivesReview: {
    status: "candidate_for_review",
    lessonAims: ["Do not show this raw authoring enum to learners."],
    byTheEnd: ["Hidden candidate aim"],
    sourceLabel: "FS01 lesson plan",
  },
  learnerFacingContent: {
    status: "candidate_for_review",
    candidate: {
      summary: "Candidate only",
      learningContent: "CANDIDATE FROM SOURCE — must not leak",
      activityPractice: "Candidate activity",
      sourceLabel: "FS01 lesson plan",
    },
    approved: null,
  },
  metadata: { note: "internal" },
  createdAt: "",
  updatedAt: "",
};

const testFixture = {
  id: "r-learn",
  programmeVersionId: "pv",
  resourceKey: "handout",
  title: "TEST learner handout fixture (W001) — SAFE DEMO",
  filename: "TEST_W001_learner_handout_fixture.txt",
  sourcePath: "",
  evidenceResourceId: "",
  extractPath: "",
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

const genuine = {
  ...testFixture,
  id: "r-real",
  title: "Workshop safety reminder",
  filename: "workshop-safety.txt",
  extractPath: "tests/artifacts/demo.txt",
};

describe("toLearnerSessionView", () => {
  it("does not expose authoring status, candidate aims, or tutor lesson plans", () => {
    const view = toLearnerSessionView({
      session: baseSession,
      status: "available",
      released: true,
      releasedAt: "2026-08-12T10:00:00.000Z",
      learnerResources: [testFixture],
    });

    const json = JSON.stringify(view);
    expect(json).not.toMatch(/candidate_for_review/);
    expect(json).not.toMatch(/publishStatus/);
    expect(json).not.toMatch(/CANDIDATE FROM SOURCE/);
    expect(json).not.toMatch(/authoring/);
    expect(view.learningInformation).toBe(LEARNER_CONTENT_PENDING);
    expect(view.materials).toEqual([]);
    expect(view.openable).toBe(true);
    expect(includesTutorLessonPlan(view.materials)).toBe(false);
  });

  it("shows approved learner copy and hides the SAFE DEMO fixture", () => {
    const view = toLearnerSessionView({
      session: {
        ...baseSession,
        learnerFacingContent: {
          status: "approved_published",
          candidate: baseSession.learnerFacingContent.candidate,
          approved: {
            summary:
              "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
            learningContent: "You will learn how to work safely in the workshop.",
            activityPractice: "Guided workshop safety walk.",
            sourceLabel: "FS01 lesson plan",
            approvedAt: "2026-08-13T12:00:00.000Z",
            approvedByName: "Curriculum owner",
          },
        },
      },
      status: "available",
      released: true,
      releasedAt: "2026-08-12T10:00:00.000Z",
      learnerResources: [testFixture, genuine],
    });

    expect(view.title).toBe(
      "Workshop Safety, Hazards, Housekeeping and Occupational Expectations",
    );
    expect(view.codesLine).toBe("Week 1 · FS01 · W001");
    expect(view.learningInformation).toContain("work safely");
    expect(view.activityPractice).toContain("safety walk");
    expect(view.materials.map((m) => m.title)).toEqual([
      "Workshop safety reminder",
    ]);
    expect(view.reviewLearning).toBe(true);
    expect(view.openable).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/SAFE DEMO/);
  });

  it("shows a LEARNER_VISIBLE PowerPoint as a learning material, not as a tutor leak", () => {
    const learnerPpt = {
      ...genuine,
      id: "r-ppt",
      title: "Hybrid awareness for learners",
      filename: "hybrid-awareness.pptx",
      extractPath: "tests/artifacts/demo.pptx.txt",
    };
    const view = toLearnerSessionView({
      session: {
        ...baseSession,
        learnerFacingContent: {
          status: "approved_published",
          candidate: baseSession.learnerFacingContent.candidate,
          approved: {
            summary: "Workshop Safety",
            learningContent: "You will learn how to work safely.",
            activityPractice: "Guided walk.",
            sourceLabel: "FS01 lesson plan",
            approvedAt: "2026-08-13T12:00:00.000Z",
            approvedByName: "Curriculum owner",
          },
        },
      },
      status: "available",
      released: true,
      releasedAt: "2026-08-12T10:00:00.000Z",
      learnerResources: [learnerPpt],
      resourceRolesById: new Map([[learnerPpt.id, "LEARNER_LEARNING"]]),
    });
    expect(view.materials).toHaveLength(1);
    expect(view.materials[0]?.kindLabel).toBe("PowerPoint");
    expect(view.materials[0]?.openLabel).toBe("View learning extract");
    expect(view.materials[0]?.binaryAvailable).toBe(false);
    expect(view.materials[0]?.openMode).toBe("extract");
    expect(view.materials[0]?.unavailableNote).toBe(
      "Original file not currently available",
    );
    expect(includesTutorLessonPlan(view.materials)).toBe(false);
  });

  it("offers Open presentation only when a portal preview exists", () => {
    const learnerPpt = {
      ...genuine,
      id: "r-ppt-bin",
      title: "Hybrid awareness for learners",
      filename: "hybrid-awareness.pptx",
      extractPath: "tests/artifacts/demo.pptx.txt",
    };
    const view = toLearnerSessionView({
      session: {
        ...baseSession,
        learnerFacingContent: {
          status: "approved_published",
          candidate: baseSession.learnerFacingContent.candidate,
          approved: {
            summary: "Workshop Safety",
            learningContent: "You will learn how to work safely.",
            activityPractice: "Guided walk.",
            sourceLabel: "FS01 lesson plan",
            approvedAt: "2026-08-13T12:00:00.000Z",
            approvedByName: "Curriculum owner",
          },
        },
      },
      status: "available",
      released: true,
      releasedAt: "2026-08-12T10:00:00.000Z",
      learnerResources: [learnerPpt],
      resourceRolesById: new Map([[learnerPpt.id, "LEARNER_LEARNING"]]),
      binaryResourceIds: new Set([learnerPpt.id]),
      previewResourceIds: new Set([learnerPpt.id]),
    });
    expect(view.materials[0]?.openLabel).toBe("Open presentation");
    expect(view.materials[0]?.downloadLabel).toBe("Download original");
    expect(view.materials[0]?.binaryAvailable).toBe(true);
    expect(view.materials[0]?.previewAvailable).toBe(true);
    expect(view.materials[0]?.openMode).toBe("preview");
    expect(view.materials[0]?.extractLabel).toBe("View extract");
    expect(view.materials[0]?.unavailableNote).toBeNull();
  });

  it("keeps the Session title as a roadmap but hides copy until the tutor releases it", () => {
    const view = toLearnerSessionView({
      session: {
        ...baseSession,
        sessionKey: "W003",
        calendarWeek: 3,
        learnerFacingContent: {
          status: "approved_published",
          candidate: baseSession.learnerFacingContent.candidate,
          approved: {
            summary: "Hybrid and High-Voltage Vehicle Awareness",
            learningContent: "You will learn how hybrid and high-voltage systems work.",
            activityPractice: "Guided hybrid awareness activity.",
            sourceLabel: "W003 lesson plan",
            approvedAt: "2026-08-13T12:00:00.000Z",
            approvedByName: "Curriculum owner",
          },
        },
      },
      status: "coming_up",
      released: false,
      learnerResources: [genuine],
      blockUnlocked: true,
    });

    expect(view.title).toBe("Hybrid and High-Voltage Vehicle Awareness");
    expect(view.openable).toBe(false);
    expect(view.hasApprovedLearning).toBe(false);
    expect(view.materials).toEqual([]);
    expect(view.reviewLearning).toBe(false);
    expect(view.learningInformation).toBe(LEARNER_NOT_RELEASED);
  });

  it("keeps the Session title as a roadmap but hides approved copy while the Block is locked", () => {
    const view = toLearnerSessionView({
      session: {
        ...baseSession,
        sessionKey: "W011",
        calendarWeek: 11,
        learnerFacingContent: {
          status: "approved_published",
          candidate: baseSession.learnerFacingContent.candidate,
          approved: {
            summary: "Customer Service Scenarios",
            learningContent:
              "This session is about handling workshop customer conversations.",
            activityPractice: "Role-play. This is session practice — not a formal Task.",
            sourceLabel: "W011 lesson plan",
            approvedAt: "2026-08-13T20:00:00.000Z",
            approvedByName: "Curriculum owner",
          },
        },
      },
      status: "coming_up",
      released: true,
      learnerResources: [genuine],
      blockUnlocked: false,
    });

    expect(view.title).toBe("Customer Service Scenarios");
    expect(view.openable).toBe(false);
    expect(view.hasApprovedLearning).toBe(false);
    expect(view.materials).toEqual([]);
    expect(view.learningInformation).toBe(LEARNER_BLOCK_LOCKED);
    expect(view.activityPractice).not.toMatch(/Role-play/);
    expect(JSON.stringify(view)).not.toMatch(/Curriculum owner/);
  });
});
