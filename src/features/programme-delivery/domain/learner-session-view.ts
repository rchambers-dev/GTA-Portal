/**
 * Learner-safe Session copy. Never includes tutor-only, authoring, or QA fields.
 */

import type { ProgrammeSessionRecord } from "@/features/programme-definition/domain/programme-sessions";
import type { ProgrammeResourceRecord } from "@/features/programme-definition/domain/programme-resources";
import {
  LEARNER_ACTIVITY_LOCKED,
  LEARNER_ACTIVITY_NOT_RELEASED,
  LEARNER_ACTIVITY_PENDING,
  LEARNER_BLOCK_LOCKED,
  LEARNER_CONTENT_PENDING,
  LEARNER_NOT_RELEASED,
  approvedLearnerCopy,
  isSafeDemoTaggedResource,
  isSecurityTestFixtureResource,
  labelLearnerMaterialPurpose,
  learnerFacingSessionTitle,
  sessionCodesLine,
} from "@/features/programme-definition/domain/learner-facing-content";
import { classifyLearnerMaterialKind } from "@/features/programme-definition/domain/programme-resources";
import { describeResourceOpen } from "@/features/programme-definition/domain/programme-resource-previews";
import type { ResourceOpenMode, ResourceViewerKind } from "@/features/programme-definition/domain/programme-resource-previews";
import type { SessionLaneStatus } from "./session-lane";
import { labelSessionLaneStatus } from "./session-lane";

export type LearnerVisibleMaterial = {
  id: string;
  title: string;
  filename: string;
  kindLabel: string;
  purposeLabel: string;
  openLabel: string;
  canReview: boolean;
  binaryAvailable: boolean;
  extractAvailable: boolean;
  previewAvailable: boolean;
  openMode: ResourceOpenMode;
  extractLabel: string | null;
  downloadLabel: string | null;
  unavailableNote: string | null;
  previewUnavailableNote: string | null;
  viewerKind: ResourceViewerKind;
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
  releasedAt: string | null;
  learningInformation: string;
  activityPractice: string;
  hasApprovedLearning: boolean;
  materials: LearnerVisibleMaterial[];
  reviewLearning: boolean;
  /** Block window open AND a Session learning release exists for this enrolment. */
  openable: boolean;
};

export function productionLearnerResources(input: {
  resources: ProgrammeResourceRecord[];
  rolesByResourceId?: Map<string, string>;
  /** SAFE DEMO fixtures are hidden from real apprentices. */
  includeSafeDemoFixtures?: boolean;
  binaryResourceIds?: ReadonlySet<string>;
  previewResourceIds?: ReadonlySet<string>;
}): LearnerVisibleMaterial[] {
  return input.resources
    .filter((r) => !isSecurityTestFixtureResource(r))
    .filter(
      (r) =>
        input.includeSafeDemoFixtures === true || !isSafeDemoTaggedResource(r),
    )
    .map((r) => {
      const role = input.rolesByResourceId?.get(r.id) || "LEARNER_LEARNING";
      const kind = classifyLearnerMaterialKind({
        filename: r.filename,
        title: r.title,
        role,
      });
      const extractAvailable = Boolean(
        r.extractPath?.trim() || r.evidenceResourceId?.trim(),
      );
      const binaryAvailable = input.binaryResourceIds?.has(r.id) === true;
      const previewAvailable = input.previewResourceIds?.has(r.id) === true;
      const open = describeResourceOpen({
        filename: r.filename,
        binaryAvailable,
        previewAvailable,
        extractAvailable,
      });
      return {
        id: r.id,
        title: r.title,
        filename: r.filename,
        kindLabel: kind.kindLabel,
        purposeLabel: labelLearnerMaterialPurpose(role),
        openLabel: open.openLabel,
        canReview: extractAvailable,
        binaryAvailable,
        extractAvailable,
        previewAvailable,
        openMode: open.openMode,
        extractLabel: open.extractLabel,
        downloadLabel: open.downloadLabel,
        unavailableNote: open.unavailableNote,
        previewUnavailableNote: open.previewUnavailableNote,
        viewerKind: open.viewerKind,
      };
    });
}

export function toLearnerSessionView(input: {
  session: ProgrammeSessionRecord;
  status: SessionLaneStatus;
  released: boolean;
  releasedAt?: string | null;
  learnerResources: ProgrammeResourceRecord[];
  resourceRolesById?: Map<string, string>;
  /** S4: published copy is not openable until the Block is unlocked. */
  blockUnlocked?: boolean;
  includeSafeDemoFixtures?: boolean;
  binaryResourceIds?: ReadonlySet<string>;
  previewResourceIds?: ReadonlySet<string>;
}): LearnerSessionView {
  const approved = approvedLearnerCopy(input.session.learnerFacingContent);
  const materials = productionLearnerResources({
    resources: input.learnerResources,
    rolesByResourceId: input.resourceRolesById,
    includeSafeDemoFixtures: input.includeSafeDemoFixtures,
    binaryResourceIds: input.binaryResourceIds,
    previewResourceIds: input.previewResourceIds,
  });
  const title = learnerFacingSessionTitle({
    title: input.session.title,
    topic: approved?.summary || input.session.topic || input.session.title,
  });
  const blockUnlocked = input.blockUnlocked !== false;
  const released = input.released === true;
  const openable = blockUnlocked && released;
  const learningInformation = !blockUnlocked
    ? LEARNER_BLOCK_LOCKED
    : !released
      ? LEARNER_NOT_RELEASED
      : approved?.learningContent || LEARNER_CONTENT_PENDING;
  const activityPractice = !blockUnlocked
    ? LEARNER_ACTIVITY_LOCKED
    : !released
      ? LEARNER_ACTIVITY_NOT_RELEASED
      : approved?.activityPractice || LEARNER_ACTIVITY_PENDING;
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
    releasedAt: released ? input.releasedAt ?? null : null,
    learningInformation,
    activityPractice,
    hasApprovedLearning: openable && Boolean(approved?.learningContent),
    materials: openable ? materials : [],
    reviewLearning:
      openable &&
      (Boolean(approved?.learningContent) || materials.length > 0),
    openable,
  };
}

/**
 * Leak detector for tutor lesson plans in learner materials.
 * File extension is not authority — a LEARNER_VISIBLE PowerPoint is allowed.
 */
export function includesTutorLessonPlan(
  resources: Array<{ title: string; filename: string }>,
): boolean {
  return resources.some(
    (r) =>
      /lesson plan/i.test(r.title) || /Lesson_Plan/i.test(r.filename),
  );
}
