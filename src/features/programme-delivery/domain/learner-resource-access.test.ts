import { describe, expect, it } from "vitest";
import type { ProgrammeResourceAttachmentRecord } from "@/features/programme-definition/domain/programme-resources";
import {
  LEARNER_SESSION_LOCKED_ERROR,
} from "@/features/programme-definition/domain/learner-facing-content";
import type { ApprenticeLearningBlock } from "./apprentice-learning";
import type { LearnerSessionView } from "./learner-session-view";
import {
  LEARNER_TUTOR_ONLY_RESOURCE_ERROR,
  decideApprenticeResourceAccess,
} from "./learner-resource-access";

function sessionView(
  overrides: Partial<LearnerSessionView> & Pick<LearnerSessionView, "id">,
): LearnerSessionView {
  return {
    sessionKey: "W003",
    title: "Hybrid and High-Voltage Vehicle Awareness",
    codesLine: "Week 3 · FS03 · W003",
    foundationSkillCode: "FS03",
    calendarWeek: 3,
    status: "available",
    statusLabel: "Available",
    releasedAt: "2026-08-14T10:44:39.000Z",
    learningInformation: "Approved copy",
    activityPractice: "Guided activity",
    hasApprovedLearning: true,
    materials: [],
    reviewLearning: true,
    openable: true,
    ...overrides,
  };
}

function block(
  sessions: LearnerSessionView[],
  unlocked = true,
): ApprenticeLearningBlock {
  return {
    spineItemId: "b1",
    title: "Block 1",
    displayTitle: "Block 1 — Foundation Skills",
    displayOrdinal: 1,
    weekStart: 1,
    weekEnd: 10,
    plannedOtjHours: 45,
    unlocked,
    sessions,
    tasks: [],
  };
}

function att(
  overrides: Partial<ProgrammeResourceAttachmentRecord> &
    Pick<ProgrammeResourceAttachmentRecord, "resourceId" | "audience">,
): ProgrammeResourceAttachmentRecord {
  return {
    id: `a-${overrides.resourceId}`,
    programmeVersionId: "pv",
    sessionId: "sess-w003",
    spineItemId: "b1",
    role: overrides.audience === "LEARNER_VISIBLE" ? "LEARNER_LEARNING" : "TUTOR_DELIVERY",
    learnerReleaseTiming:
      overrides.audience === "LEARNER_VISIBLE" ? "WITH_SESSION" : null,
    sortOrder: 10,
    metadata: {},
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

const learnerPpt = {
  id: "r-learn-ppt",
  title: "TEST learner presentation — Hybrid awareness (SAFE DEMO)",
  filename: "TEST_W003_learner_presentation.pptx",
};

const tutorPpt = {
  id: "r-tutor-ppt",
  title: "Features of Hybrid Vehicles",
  filename: "Features of Hybrid Vehicles.ppt",
};

describe("decideApprenticeResourceAccess", () => {
  it("allows LEARNER_VISIBLE + released + unlocked, including PowerPoint", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [att({ resourceId: learnerPpt.id, audience: "LEARNER_VISIBLE" })],
      blocks: [block([sessionView({ id: "sess-w003", openable: true })])],
      isTest: true,
    });
    expect(result).toEqual({ ok: true, sessionId: "sess-w003" });
  });

  it("denies LEARNER_VISIBLE + unreleased", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [att({ resourceId: learnerPpt.id, audience: "LEARNER_VISIBLE" })],
      blocks: [
        block([
          sessionView({
            id: "sess-w003",
            openable: false,
            status: "coming_up",
            statusLabel: "Coming up",
            releasedAt: null,
            hasApprovedLearning: false,
            reviewLearning: false,
          }),
        ]),
      ],
      isTest: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.error).toBe(LEARNER_SESSION_LOCKED_ERROR);
  });

  it("denies REVIEW_LATER until review materials are released", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [
        att({
          resourceId: learnerPpt.id,
          audience: "LEARNER_VISIBLE",
          learnerReleaseTiming: "REVIEW_LATER",
        }),
      ],
      blocks: [block([sessionView({ id: "sess-w003", openable: true })])],
      isTest: true,
      reviewReleasedSessionIds: new Set(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("allows REVIEW_LATER after review materials are released", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [
        att({
          resourceId: learnerPpt.id,
          audience: "LEARNER_VISIBLE",
          learnerReleaseTiming: "REVIEW_LATER",
        }),
      ],
      blocks: [block([sessionView({ id: "sess-w003", openable: true })])],
      isTest: true,
      reviewReleasedSessionIds: new Set(["sess-w003"]),
    });
    expect(result).toEqual({ ok: true, sessionId: "sess-w003" });
  });

  it("denies TUTOR_ONLY even when the Session is released", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: tutorPpt.id,
      resource: tutorPpt,
      attachments: [att({ resourceId: tutorPpt.id, audience: "TUTOR_ONLY" })],
      blocks: [block([sessionView({ id: "sess-w003", openable: true })])],
      isTest: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
    expect(result.error).toBe(LEARNER_TUTOR_ONLY_RESOURCE_ERROR);
  });

  it("denies a released Session in a locked Block", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [att({ resourceId: learnerPpt.id, audience: "LEARNER_VISIBLE" })],
      blocks: [
        block(
          [
            sessionView({
              id: "sess-w003",
              openable: false,
            }),
          ],
          false,
        ),
      ],
      isTest: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("denies another apprentice who does not have that Session on their journey", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [att({ resourceId: learnerPpt.id, audience: "LEARNER_VISIBLE" })],
      blocks: [block([sessionView({ id: "sess-other", openable: true })])],
      isTest: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("hides SAFE DEMO fixtures from non-test apprentices", () => {
    const result = decideApprenticeResourceAccess({
      resourceId: learnerPpt.id,
      resource: learnerPpt,
      attachments: [att({ resourceId: learnerPpt.id, audience: "LEARNER_VISIBLE" })],
      blocks: [block([sessionView({ id: "sess-w003", openable: true })])],
      isTest: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });

  it("denies a leaked tutor lesson plan even if marked learner visible", () => {
    const lp = {
      id: "r-lp",
      title: "FS03 lesson plan (v1.2)",
      filename: "Foundation_Skills_FS03_Week_3_Lesson_Plan_v1.2.docx",
    };
    const result = decideApprenticeResourceAccess({
      resourceId: lp.id,
      resource: lp,
      attachments: [att({ resourceId: lp.id, audience: "LEARNER_VISIBLE" })],
      blocks: [block([sessionView({ id: "sess-w003", openable: true })])],
      isTest: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });
});
