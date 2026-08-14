import { describe, expect, it } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";
import {
  isSecurityTestFixtureResource,
} from "@/features/programme-definition/domain/learner-facing-content";
import {
  assertNoTutorOnlyLeak,
  filterLearnerVisibleAttachments,
  learnerVisibleResourcesForSession,
  tutorDeliveryResourcesForSession,
} from "./learner-session-materials";
import {
  includesTutorLessonPlan,
  toLearnerSessionView,
} from "./learner-session-view";
import { resolveApprenticeSessionAccess } from "./apprentice-learning";
import type { ApprenticeLearningBlock } from "./apprentice-learning";
import { canAuthorProgramme } from "@/features/programme-definition/domain/curriculum-authoring-access";
import { canUseTutorDeliveryApi } from "./staff-delivery-access";
import type {
  ProgrammeResourceAttachmentRecord,
  ProgrammeResourceRecord,
} from "@/features/programme-definition/domain/programme-resources";
import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";

const W011_LP: ProgrammeResourceRecord = {
  id: "r-lp-w011",
  programmeVersionId: "pv",
  resourceKey: "res_lp_16fe848ac370",
  title: "Week 11 lesson plan — Customer Service Scenarios (v4.4)",
  filename: "Autocare_L2_Week_011_Lesson_Plan_v4.4.docx",
  sourcePath: "",
  evidenceResourceId: "res_lp_16fe848ac370",
  extractPath: "",
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

const W011_LEARNER: ProgrammeResourceRecord = {
  id: "r-learn-w011",
  programmeVersionId: "pv",
  resourceKey: "test_learner_resource_w011_visibility",
  title: "TEST learner resource — W011 visibility proof — SAFE DEMO",
  filename: "TEST_W011_learner_visibility_proof.txt",
  sourcePath: "",
  evidenceResourceId: "",
  extractPath:
    "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/test_w011_learner_visibility_proof.txt",
  metadata: { isTest: true },
  createdAt: "",
  updatedAt: "",
};

const tutorAtt: ProgrammeResourceAttachmentRecord = {
  id: "a-lp",
  programmeVersionId: "pv",
  resourceId: W011_LP.id,
  sessionId: "sess-w011",
  spineItemId: "b2",
  role: "TUTOR_DELIVERY",
  audience: "TUTOR_ONLY",
  sortOrder: 10,
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

const learnerAtt: ProgrammeResourceAttachmentRecord = {
  id: "a-learn",
  programmeVersionId: "pv",
  resourceId: W011_LEARNER.id,
  sessionId: "sess-w011",
  spineItemId: "b2",
  role: "LEARNER_LEARNING",
  audience: "LEARNER_VISIBLE",
  sortOrder: 20,
  metadata: { isTest: true },
  createdAt: "",
  updatedAt: "",
};

const session: ProgrammeSessionRecord = {
  id: "sess-w011",
  programmeVersionId: "pv",
  spineItemId: "b2",
  sessionKey: "W011",
  sequence: 11,
  calendarWeek: 11,
  sessionIndexInWeek: 1,
  title: "Customer Service Scenarios",
  topic: "Customer Service Scenarios",
  foundationSkillCode: null,
  plannedOtjHours: null,
  publishStatus: "published",
  learningObjectivesReview: { status: "candidate_for_review" },
  learnerFacingContent: {
    status: "approved_published",
    candidate: null,
    approved: {
      summary: "Customer Service Scenarios",
      learningContent: "Approved W011 learner copy",
      activityPractice: "Role-play. This is session practice — not a formal Task.",
      sourceLabel: "v4.4",
      approvedAt: "2026-08-13T20:00:00.000Z",
      approvedByName: "Curriculum owner",
    },
  },
  metadata: {},
  createdAt: "",
  updatedAt: "",
};

function account(input: {
  workspace: PortalAccount["workspace"];
  permissions: string[];
}): PortalAccount {
  return {
    id: "u1",
    name: "Test",
    initials: "T",
    email: "test@example.invalid",
    baseRole: input.workspace === "apprentice" ? "Apprentice" : "Tutor",
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
  };
}

describe("W011 author → tutor → apprentice visibility chain", () => {
  it("lets a tutor see the lesson plan and the learner-visible resource", () => {
    const tutorMaterials = [tutorAtt, learnerAtt].filter(
      (a) => a.audience === "TUTOR_ONLY" || a.role === "TUTOR_DELIVERY",
    );
    const learnerMaterials = filterLearnerVisibleAttachments([
      tutorAtt,
      learnerAtt,
    ]);
    expect(tutorMaterials.map((a) => a.resourceId)).toContain(W011_LP.id);
    expect(learnerMaterials.map((a) => a.resourceId)).toEqual([W011_LEARNER.id]);
    expect(assertNoTutorOnlyLeak(learnerMaterials).ok).toBe(true);
  });

  it("never returns the tutor-only W011 lesson plan on the apprentice view", () => {
    const resources = learnerVisibleResourcesForSession({
      attachments: [tutorAtt, learnerAtt],
      resources: [W011_LP, W011_LEARNER],
      sessionId: "sess-w011",
    });
    const view = toLearnerSessionView({
      session,
      status: "coming_up",
      released: true,
      learnerResources: resources,
      blockUnlocked: true,
      includeSafeDemoFixtures: true,
    });
    expect(view.materials.map((m) => m.title)).toEqual([W011_LEARNER.title]);
    expect(includesTutorLessonPlan(view.materials)).toBe(false);
    expect(isSecurityTestFixtureResource(W011_LEARNER)).toBe(false);
  });

  it("does not let a locked Block 2 Session return the W011 learner resource", () => {
    const resources = learnerVisibleResourcesForSession({
      attachments: [tutorAtt, learnerAtt],
      resources: [W011_LP, W011_LEARNER],
      sessionId: "sess-w011",
    });
    const view = toLearnerSessionView({
      session,
      status: "coming_up",
      released: true,
      learnerResources: resources,
      blockUnlocked: false,
    });
    const block: ApprenticeLearningBlock = {
      spineItemId: "b2",
      title: "Block 2",
      displayTitle: "Block 2",
      displayOrdinal: 2,
      weekStart: 11,
      weekEnd: 20,
      plannedOtjHours: 45,
      unlocked: false,
      sessions: [view],
      tasks: [],
    };
    expect(view.openable).toBe(false);
    expect(view.materials).toEqual([]);
    expect(view.learningInformation).not.toMatch(/Approved W011/);
    expect(resolveApprenticeSessionAccess([block], "sess-w011").status).toBe(
      "locked",
    );
  });

  it("blocks apprentice logins from the tutor delivery API", () => {
    const apprentice = buildEffectiveSession(
      account({
        workspace: "apprentice",
        permissions: ["apprentice.workspace.own"],
      }),
      [],
    );
    const tutor = buildEffectiveSession(
      account({
        workspace: "staff",
        permissions: [
          "staff.workspace.view",
          "modules.deliver",
          "apprentices.assigned.view",
        ],
      }),
      [],
    );
    const owner = buildEffectiveSession(
      account({
        workspace: "management",
        permissions: ["management.workspace.view", "management.programme.setup"],
      }),
      [],
    );
    expect(canUseTutorDeliveryApi(apprentice)).toBe(false);
    expect(canUseTutorDeliveryApi(tutor)).toBe(true);
    expect(canUseTutorDeliveryApi(owner)).toBe(true);
    expect(canAuthorProgramme(apprentice)).toBe(false);
    expect(canAuthorProgramme(tutor)).toBe(false);
    expect(canAuthorProgramme(owner)).toBe(true);
  });

  it("keeps tutor-only W011 lesson plan on the delivery bundle, not the learner list", () => {
    const tutorResources = tutorDeliveryResourcesForSession({
      attachments: [tutorAtt, learnerAtt],
      resources: [W011_LP, W011_LEARNER],
      sessionId: "sess-w011",
    });
    const learnerResources = learnerVisibleResourcesForSession({
      attachments: [tutorAtt, learnerAtt],
      resources: [W011_LP, W011_LEARNER],
      sessionId: "sess-w011",
    });
    expect(tutorResources.map((r) => r.id)).toEqual([W011_LP.id]);
    expect(learnerResources.map((r) => r.id)).toEqual([W011_LEARNER.id]);
  });
});
