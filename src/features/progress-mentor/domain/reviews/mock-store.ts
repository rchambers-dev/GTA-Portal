import {
  MENTOR_ID,
  MENTOR_APPRENTICES,
  MENTOR_NAME,
  type MentorApprenticeRow,
} from "../../data/mentor-caseload";
import {
  canCreateReview,
  deriveReadinessStatus,
  makeChecklistItem,
  missingLabels,
  readinessPercent,
} from "./readiness";
import {
  buildAttendanceDetail,
  buildModuleProgressForApprentice,
} from "./programme-modules";
import {
  buildContributionText,
  buildReviewNarrative,
} from "./review-content";
import { buildSignOffState } from "./sign-off";
import {
  REVIEW_CYCLE_LABEL,
  REVIEW_READY_LEAD_DAYS,
  nextReviewDueDate,
  readyByDate,
} from "./policy";
import type {
  ChecklistItem,
  ChecklistItemKey,
  ChecklistItemState,
  DueStatus,
  FormalReview,
  ReviewRequirement,
  ReviewSnapshot,
} from "./types";

function apprentice(id: string): MentorApprenticeRow {
  const row = MENTOR_APPRENTICES.find((l) => l.apprenticeId === id);
  if (!row) throw new Error(`Unknown apprentice ${id}`);
  return row;
}

type PartialStates = Partial<Record<ChecklistItemKey, ChecklistItemState>>;

function buildChecklist(
  l: MentorApprenticeRow,
  states: PartialStates,
  isFirstReview: boolean,
): ChecklistItem[] {
  const defaults: Record<ChecklistItemKey, ChecklistItemState> = {
    apprentice_identity: "complete",
    employer_contact: "complete",
    review_date_scheduled: "complete",
    assigned_mentor: "complete",
    previous_review_loaded: isFirstReview ? "not_applicable" : "complete",
    previous_actions_loaded: "complete",
    previous_actions_reviewed: "complete",
    apprentice_reflection_requested: "complete",
    apprentice_reflection_received: "complete",
    employer_feedback_requested: "complete",
    employer_feedback_received: "complete",
    tutor_evidence_requested: "complete",
    tutor_evidence_received: "complete",
    attendance_available: l.attendancePercent != null ? "complete" : "unavailable",
    planned_progress: "complete",
    actual_progress: "complete",
    progress_variance: "complete",
    off_the_job: "complete",
    mandatory_evidence: "complete",
    open_interventions: "complete",
    support_information: "complete",
    epa_readiness: l.epaApproaching ? "complete" : "not_applicable",
    safeguarding_prompts: "complete",
  };
  const merged = { ...defaults, ...states };
  return (Object.keys(merged) as ChecklistItemKey[]).map((key) =>
    makeChecklistItem(key, merged[key], {
      isFirstReview,
      reason:
        merged[key] === "unavailable" && key === "attendance_available"
          ? "Attendance feed not yet linked"
          : null,
    }),
  );
}

function dueFor(date: string, today = "2026-07-17"): DueStatus {
  const planned = new Date(date).getTime();
  const now = new Date(today).getTime();
  const days = Math.round((planned - now) / 86400000);
  if (days < 0) return "overdue";
  // Due soon once inside the ready-by window (1 week before due).
  if (days <= REVIEW_READY_LEAD_DAYS) return "due_soon";
  return "on_track";
}

function finaliseRequirement(
  base: Omit<
    ReviewRequirement,
    | "readinessStatus"
    | "readinessPercent"
    | "missingItems"
    | "queueTab"
    | "dueStatus"
  > & { dueStatus?: DueStatus; queueTab?: ReviewRequirement["queueTab"] },
): ReviewRequirement {
  const dueStatus = base.dueStatus ?? dueFor(base.plannedReviewDate);
  const readinessStatus = deriveReadinessStatus({
    checklist: base.checklist,
    dueStatus,
    preparationOpenedAt: base.preparationOpenedAt,
  });
  const gate = canCreateReview(base.checklist);
  let queueTab: ReviewRequirement["queueTab"] = base.queueTab ?? "needs_creating";
  if (!base.formalReviewId) {
    if (queueTab === "upcoming") {
      // keep upcoming
    } else if (gate.allowed) {
      queueTab = "ready_to_create";
    } else if (dueStatus === "overdue") {
      queueTab = "overdue_requirement";
    } else {
      queueTab = "needs_creating";
    }
  }
  return {
    ...base,
    dueStatus,
    readinessStatus,
    readinessPercent: readinessPercent(base.checklist),
    missingItems: missingLabels(base.checklist),
    queueTab,
  };
}

function req(
  partial: {
    requirementId: string;
    apprenticeId: string;
    plannedReviewDate: string;
    reviewType?: string;
    reviewCycle?: string;
    previousReviewId?: string | null;
    preparationOpenedAt?: string | null;
    formalReviewId?: string | null;
    isFirstReview?: boolean;
    states?: PartialStates;
    generatedAt?: string;
    queueTab?: ReviewRequirement["queueTab"];
  },
): ReviewRequirement {
  const l = apprentice(partial.apprenticeId);
  const isFirst = partial.isFirstReview ?? !l.lastReviewDate;
  const checklist = buildChecklist(l, partial.states ?? {}, isFirst);
  return finaliseRequirement({
    requirementId: partial.requirementId,
    apprenticeId: l.apprenticeId,
    apprenticeName: l.displayName,
    employerId: l.employerId,
    employerName: l.employerName,
    programmeId: l.programmeId,
    programmeName: l.programmeName,
    tutorName: l.tutorName,
    mentorId: MENTOR_ID,
    mentorName: MENTOR_NAME,
    plannedReviewDate: partial.plannedReviewDate,
    reviewCycle: partial.reviewCycle ?? REVIEW_CYCLE_LABEL,
    reviewType: partial.reviewType ?? "Progress review",
    previousReviewId: partial.previousReviewId ?? (isFirst ? null : `hist-${l.apprenticeId}`),
    lastReviewDate: l.lastReviewDate,
    preparationOpenedAt: partial.preparationOpenedAt ?? null,
    formalReviewId: partial.formalReviewId ?? null,
    isFirstReview: isFirst,
    checklist,
    overrides: [],
    generatedAt: partial.generatedAt ?? "2026-06-01",
    queueTab: partial.queueTab,
  });
}

/** Mutable in-session store — Create Review updates these until live Supabase wiring. */
export const REVIEW_REQUIREMENTS: ReviewRequirement[] = [];

function snapshotFromApprentice(
  l: MentorApprenticeRow,
  requirement: ReviewRequirement,
): ReviewSnapshot {
  const moduleProgress = buildModuleProgressForApprentice({
    programmeId: l.programmeId,
    programmeYear: l.programmeYear,
    actualProgressPercent: l.actualProgressPercent,
    reviewDate: requirement.plannedReviewDate,
  });
  const attendanceDetail = buildAttendanceDetail(
    l.attendancePercent,
    requirement.plannedReviewDate,
  );
  const apprenticeReceived =
    requirement.checklist.find((c) => c.key === "apprentice_reflection_received")
      ?.state === "complete";
  const employerReceived =
    requirement.checklist.find((c) => c.key === "employer_feedback_received")
      ?.state === "complete";
  const tutorReceived =
    requirement.checklist.find((c) => c.key === "tutor_evidence_received")
      ?.state === "complete";

  return {
    plannedProgressPercent: l.plannedProgressPercent,
    actualProgressPercent: l.actualProgressPercent,
    variancePercent: l.actualProgressPercent - l.plannedProgressPercent,
    attendancePercent: l.attendancePercent,
    attendanceUnavailableReason:
      l.attendancePercent == null ? "Marked unavailable at review create" : null,
    offTheJobHours: 40 + Math.round(l.actualProgressPercent * 1.2),
    missingMandatoryEvidence: l.missingMandatoryEvidence,
    openInterventionIds: l.interventionId ? [l.interventionId] : [],
    previousActionIds: [],
    apprenticeContribution: buildContributionText(l, "apprentice", apprenticeReceived),
    employerContribution: buildContributionText(l, "employer", employerReceived),
    providerContribution: buildContributionText(l, "tutor", tutorReceived),
    sourceTimestamps: {
      progress: "2026-07-17T08:00:00Z",
      attendance: "2026-07-17T08:00:00Z",
      evidence: "2026-07-16T16:00:00Z",
      modules: "2026-07-17T08:00:00Z",
    },
    capturedAt: "2026-07-17T09:00:00Z",
    programmeYear: l.programmeYear,
    programmeWeek: l.programmeWeek,
    modules: moduleProgress.modules,
    modulesCompleted: moduleProgress.completedCount,
    modulesRemaining: moduleProgress.remainingCount,
    modulesInProgress: moduleProgress.inProgressCount,
    modulesVisibleTotal: moduleProgress.totalVisible,
    currentYearModulesTotal: moduleProgress.currentYearTotal,
    currentYearModulesCompleted: moduleProgress.currentYearCompleted,
    currentYearModulesRemaining: moduleProgress.currentYearRemaining,
    attendanceDetail,
  };
}

function formal(
  partial: Omit<
    FormalReview,
    | "snapshot"
    | "liveProgress"
    | "tutorName"
    | "discussionNotes"
    | "barriersNotes"
    | "wellbeingNotes"
    | "learningFocus"
    | "employerWorkplaceNotes"
    | "signOff"
  > & {
    snapshot?: ReviewSnapshot;
    tutorName?: string;
    discussionNotes?: string | null;
    barriersNotes?: string | null;
    wellbeingNotes?: string | null;
    learningFocus?: string | null;
    employerWorkplaceNotes?: string | null;
    signOff?: Partial<FormalReview["signOff"]>;
  },
): FormalReview {
  const l = apprentice(partial.apprenticeId);
  const requirement =
    REVIEW_REQUIREMENTS.find((r) => r.requirementId === partial.requirementId) ??
    req({
      requirementId: partial.requirementId,
      apprenticeId: partial.apprenticeId,
      plannedReviewDate: partial.reviewDate,
      formalReviewId: partial.reviewId,
    });
  const narrative = buildReviewNarrative(l, requirement);
  const signOff = buildSignOffState({
    apprentice: l,
    tutorName: partial.tutorName ?? l.tutorName,
    reviewDate: partial.reviewDate,
    stage: partial.stage,
    existing: partial.signOff,
  });
  return {
    ...partial,
    tutorName: partial.tutorName ?? l.tutorName,
    snapshot: partial.snapshot ?? snapshotFromApprentice(l, requirement),
    liveProgress: {
      plannedProgressPercent: l.plannedProgressPercent,
      actualProgressPercent: Math.min(100, l.actualProgressPercent + 1),
      attendancePercent: l.attendancePercent,
    },
    signOff,
    progressJudgement: partial.progressJudgement ?? narrative.progressJudgement,
    discussionNotes: partial.discussionNotes ?? narrative.discussionNotes,
    barriersNotes: partial.barriersNotes ?? narrative.barriersNotes,
    wellbeingNotes: partial.wellbeingNotes ?? narrative.wellbeingNotes,
    learningFocus: partial.learningFocus ?? narrative.learningFocus,
    employerWorkplaceNotes:
      partial.employerWorkplaceNotes ?? narrative.employerWorkplaceNotes,
  };
}

export let FORMAL_REVIEWS: FormalReview[] = [];

export function getRequirement(id: string): ReviewRequirement | undefined {
  return REVIEW_REQUIREMENTS.find((r) => r.requirementId === id);
}

export function getFormalReview(id: string): FormalReview | undefined {
  const existing = FORMAL_REVIEWS.find((r) => r.reviewId === id);
  if (existing) return existing;

  if (id.startsWith("rev-created-")) {
    const requirementId = id.replace("rev-created-", "");
    const requirement = getRequirement(requirementId);
    if (!requirement) return undefined;

    return formal({
      reviewId: id,
      requirementId,
      apprenticeId: requirement.apprenticeId,
      apprenticeName: requirement.apprenticeName,
      employerId: requirement.employerId,
      employerName: requirement.employerName,
      programmeName: requirement.programmeName,
      mentorName: requirement.mentorName,
      reviewDate: requirement.plannedReviewDate,
      reviewType: requirement.reviewType,
      previousReviewId: requirement.previousReviewId,
      stage: "created",
      progressPercent: 5,
      lastEditedAt: "2026-07-17T09:00:00Z",
      lastEditedBy: MENTOR_NAME,
      missingSections: ["Discussion", "Judgement", "Agreed actions", "Sign-off"],
      signOff: {
        apprenticeSigned: false,
        employerSigned: false,
        providerSigned: false,
        summaryIssued: false,
        amendmentRequested: false,
        reminderSent: false,
      },
      participants: [requirement.apprenticeName, MENTOR_NAME, requirement.employerName],
      progressJudgement: null,
      actionsCreated: 0,
      nextReviewDate: null,
      completedBy: null,
      completedAt: null,
      audit: [
        {
          at: "2026-07-17T09:00:00Z",
          userId: MENTOR_ID,
          userName: MENTOR_NAME,
          action: "created",
          detail: "Created from review requirement",
        },
      ],
      readOnly: false,
      originalDueDate: requirement.plannedReviewDate,
      daysOverdue: null,
      escalationStatus: null,
      rearrangeCount: 0,
    });
  }

  return undefined;
}

export function refreshRequirement(reqRow: ReviewRequirement): ReviewRequirement {
  return finaliseRequirement(reqRow);
}

export function updateRequirement(
  requirementId: string,
  patch: Partial<ReviewRequirement>,
): ReviewRequirement | undefined {
  const idx = REVIEW_REQUIREMENTS.findIndex((r) => r.requirementId === requirementId);
  if (idx < 0) return undefined;
  const next = refreshRequirement({ ...REVIEW_REQUIREMENTS[idx], ...patch });
  REVIEW_REQUIREMENTS[idx] = next;
  return next;
}

export function addFormalReview(review: FormalReview): void {
  FORMAL_REVIEWS = [review, ...FORMAL_REVIEWS];
}

export { snapshotFromApprentice };
