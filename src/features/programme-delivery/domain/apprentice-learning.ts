import type { LearnerSessionView } from "./learner-session-view";

/** Learner-facing Task status. Internal S7 reason stays staff-only. */
export const CONTROLLED_TASK_AVAILABILITY_LABEL = "Coming up";

export function isRetiredCeaGroupTaskKey(taskKey: string): boolean {
  return /^g\d+-t\d+$/i.test(taskKey.trim());
}

export type ApprenticeLearningTaskRow = {
  id: string;
  taskKey: string;
  spineItemId: string;
  blockOrdinal: number;
  taskNumber: number;
  kind: string;
  title: string;
  availabilityLabel: string;
  openable: boolean;
};

export type ApprenticeLearningBlock = {
  spineItemId: string;
  title: string;
  displayTitle: string;
  displayOrdinal: number;
  weekStart: number | null;
  weekEnd: number | null;
  plannedOtjHours: number;
  unlocked: boolean;
  sessions: LearnerSessionView[];
  tasks: ApprenticeLearningTaskRow[];
};

export type ApprenticeLearningJourney = {
  apprenticeId: string;
  displayName: string;
  apprenticeReference: string;
  isTest: boolean;
  enrolmentId: string;
  programmeVersionId: string;
  programmeTitle: string;
  programmeWeek: number;
  blocks: ApprenticeLearningBlock[];
  visibilityProof: {
    sessionKey: string;
    resourceTitles: string[];
    includesTutorLessonPlan: boolean;
    tutorOnlyCount: number;
  } | null;
};
