/**
 * Learner-safe Session copy. Never includes tutor-only, authoring, or QA fields.
 */

import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";
import type { ProgrammeResourceRecord } from "@/features/programme-definition/domain/programme-resources";
import {
  LEARNER_ACTIVITY_PENDING,
  LEARNER_CONTENT_PENDING,
  approvedLearnerCopy,
  isSecurityTestFixtureResource,
  labelLearnerMaterialPurpose,
  learnerFacingSessionTitle,
  sessionCodesLine,
} from "@/features/programme-definition/domain/learner-facing-content";
import type { SessionDeliveryRecord } from "./session-delivery";
import type { SessionLaneStatus } from "./session-lane";
import { labelSessionLaneStatus } from "./session-lane";

export type LearnerVisibleMaterial = {
  id: string;
  title: string;
  filename: string;
  purposeLabel: string;
  canReview: boolean;
};

export type LearnerSessionView = {
  id: string;
  sessionKey: string;
  title: string;
  codesLine: string;
  foundationSkillCode: string | null;
  calendarWeek: number;
  status: SessionLaneStatus;
  statusLabel: string;
  deliveredAt: string | null;
  learningInformation: string;
  activityPractice: string;
  hasApprovedLearning: boolean;
  materials: LearnerVisibleMaterial[];
  reviewLearning: boolean;
};

export function productionLearnerResources(input: {
  resources: ProgrammeResourceRecord[];
  rolesByResourceId?: Map<string, string>;
}): LearnerVisibleMaterial[] {
  return input.resources
    .filter((r) => !isSecurityTestFixtureResource(r))
    .map((r) => ({
      id: r.id,
      title: r.title,
      filename: r.filename,
      purposeLabel: labelLearnerMaterialPurpose(
        input.rolesByResourceId?.get(r.id) || "LEARNER_LEARNING",
      ),
      canReview: Boolean(r.extractPath?.trim() || r.evidenceResourceId?.trim()),
    }));
}

export function toLearnerSessionView(input: {
  session: ProgrammeSessionRecord;
  status: SessionLaneStatus;
  delivery: SessionDeliveryRecord | null;
  learnerResources: ProgrammeResourceRecord[];
  resourceRolesById?: Map<string, string>;
}): LearnerSessionView {
  const approved = approvedLearnerCopy(input.session.learnerFacingContent);
  const materials = productionLearnerResources({
    resources: input.learnerResources,
    rolesByResourceId: input.resourceRolesById,
  });
  const title = learnerFacingSessionTitle({
    title: input.session.title,
    topic: approved?.summary || input.session.topic || input.session.title,
  });
  return {
    id: input.session.id,
    sessionKey: input.session.sessionKey,
    title,
    codesLine: sessionCodesLine({
      calendarWeek: input.session.calendarWeek,
      foundationSkillCode: input.session.foundationSkillCode,
      sessionKey: input.session.sessionKey,
    }),
    foundationSkillCode: input.session.foundationSkillCode,
    calendarWeek: input.session.calendarWeek,
    status: input.status,
    statusLabel: labelSessionLaneStatus(input.status),
    deliveredAt: input.delivery?.deliveredAt ?? null,
    learningInformation: approved?.learningContent || LEARNER_CONTENT_PENDING,
    activityPractice: approved?.activityPractice || LEARNER_ACTIVITY_PENDING,
    hasApprovedLearning: Boolean(approved?.learningContent),
    materials,
    reviewLearning:
      input.status === "completed" &&
      (Boolean(approved?.learningContent) || materials.length > 0),
  };
}

export function includesTutorLessonPlan(
  resources: Array<{ title: string; filename: string }>,
): boolean {
  return resources.some(
    (r) =>
      /lesson plan/i.test(r.title) ||
      /Lesson_Plan/i.test(r.filename) ||
      /\.(ppt|pptx|pptm)$/i.test(r.filename) ||
      /Features of Hybrid Vehicles|Safety in High Voltage|Working on High Voltage/i.test(
        `${r.title} ${r.filename}`,
      ),
  );
}
