import type { LearnerSessionView } from "./learner-session-view";

/** Learner-facing Task status. Internal S7 reason stays staff-only. */
export const CONTROLLED_TASK_AVAILABILITY_LABEL = "Coming up";

export function isRetiredCeaGroupTaskKey(taskKey: string): boolean {
  return /^g\d+-t\d+$/i.test(taskKey.trim());
}

/**
 * Block 2 Session practice is never the matching formal Task.
 * Completing the Session does not complete, release, or unlock the Task.
 */
export const BLOCK2_SESSION_IS_NOT_TASK = [
  {
    sessionKey: "W012",
    taskNumber: 3,
    reason: "Electrical inspection practice is not Task 3",
  },
  {
    sessionKey: "W014",
    taskNumber: 4,
    reason: "TPMS session practice is not Task 4",
  },
  {
    sessionKey: "W016",
    taskNumber: 2,
    reason: "Session job-card practice is not the Employer Job Card (Task 2)",
  },
  {
    sessionKey: "W020",
    taskNumber: 5,
    reason: "Dispute session is not the controlled Block Reflection (Task 5)",
  },
] as const;

/** Session delivery never completes or releases a controlled Task. */
export function sessionCompletionCompletesTask(
  _sessionKey: string,
  _taskNumber: number,
): boolean {
  return false;
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

export function comingUpTaskRow(input: {
  id: string;
  taskKey: string;
  spineItemId: string;
  blockOrdinal: number;
  taskNumber: number;
  kind: string;
  title: string;
}): ApprenticeLearningTaskRow {
  return {
    ...input,
    availabilityLabel: CONTROLLED_TASK_AVAILABILITY_LABEL,
    openable: false,
  };
}

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

export type ApprenticeSessionAccess =
  | {
      status: "open";
      session: LearnerSessionView;
      block: ApprenticeLearningBlock;
    }
  | {
      status: "locked";
      session: LearnerSessionView;
      block: ApprenticeLearningBlock;
    }
  | { status: "missing" };

/**
 * Publishing curriculum copy does not grant access.
 * A Session is openable only when its Block is unlocked (S4).
 */
export function resolveApprenticeSessionAccess(
  blocks: ApprenticeLearningBlock[],
  sessionId: string,
): ApprenticeSessionAccess {
  const id = sessionId.trim();
  if (!id) return { status: "missing" };
  for (const block of blocks) {
    const session = block.sessions.find((s) => s.id === id);
    if (!session) continue;
    if (!block.unlocked || !session.openable) {
      return { status: "locked", session, block };
    }
    return { status: "open", session, block };
  }
  return { status: "missing" };
}

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
