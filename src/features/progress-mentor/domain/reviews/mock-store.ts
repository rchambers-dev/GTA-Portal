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

/** Mutable demo store — Create Review updates these in-session. */
export const REVIEW_REQUIREMENTS: ReviewRequirement[] = [
  // Needs creating / prep (not ready)
  req({
    requirementId: "req-ava",
    apprenticeId: "lrn-ava-brooks",
    plannedReviewDate: "2026-07-12",
    preparationOpenedAt: readyByDate("2026-07-12"),
    states: {
      apprentice_reflection_requested: "requested",
      apprentice_reflection_received: "missing",
      employer_feedback_requested: "requested",
      employer_feedback_received: "missing",
      previous_actions_reviewed: "missing",
      tutor_evidence_received: "missing",
      tutor_evidence_requested: "requested",
    },
  }),
  req({
    requirementId: "req-liam",
    apprenticeId: "lrn-liam-anderson",
    plannedReviewDate: "2026-07-20",
    preparationOpenedAt: readyByDate("2026-07-20"),
    states: {
      apprentice_reflection_requested: "requested",
      apprentice_reflection_received: "missing",
      employer_feedback_requested: "requested",
      employer_feedback_received: "requested",
      previous_actions_reviewed: "missing",
      tutor_evidence_received: "missing",
    },
  }),
  req({
    requirementId: "req-ethan",
    apprenticeId: "lrn-ethan-clarke",
    plannedReviewDate: "2026-07-16",
    reviewType: "Gateway review",
    preparationOpenedAt: readyByDate("2026-07-16"),
    states: {
      apprentice_reflection_requested: "missing",
      apprentice_reflection_received: "missing",
      previous_actions_loaded: "missing",
      previous_actions_reviewed: "missing",
      mandatory_evidence: "missing",
      epa_readiness: "missing",
    },
  }),
  req({
    requirementId: "req-harvey",
    apprenticeId: "lrn-harvey-cole",
    plannedReviewDate: "2026-07-15",
    preparationOpenedAt: null,
    states: {
      apprentice_reflection_requested: "missing",
      apprentice_reflection_received: "missing",
      employer_feedback_requested: "missing",
      employer_feedback_received: "missing",
      tutor_evidence_requested: "missing",
      tutor_evidence_received: "missing",
      previous_actions_loaded: "missing",
      previous_actions_reviewed: "missing",
    },
  }),
  req({
    requirementId: "req-dylan",
    apprenticeId: "lrn-dylan-moore",
    plannedReviewDate: "2026-07-14",
    reviewType: "EPA readiness",
    preparationOpenedAt: readyByDate("2026-07-14"),
    states: {
      tutor_evidence_received: "missing",
      mandatory_evidence: "missing",
      epa_readiness: "requested",
    },
  }),
  req({
    requirementId: "req-sofia",
    apprenticeId: "lrn-sofia-martinez",
    plannedReviewDate: "2026-07-18",
    preparationOpenedAt: readyByDate("2026-07-18"),
    states: {
      actual_progress: "unavailable",
      progress_variance: "unavailable",
      apprentice_reflection_requested: "requested",
      apprentice_reflection_received: "missing",
    },
  }),
  req({
    requirementId: "req-amelia",
    apprenticeId: "lrn-amelia-frost",
    plannedReviewDate: "2026-07-22",
    preparationOpenedAt: readyByDate("2026-07-22"),
    states: {
      employer_feedback_requested: "requested",
      employer_feedback_received: "missing",
      off_the_job: "missing",
    },
  }),

  // Ready to create (5)
  req({
    requirementId: "req-james",
    apprenticeId: "lrn-james-wilson",
    plannedReviewDate: "2026-07-25",
    preparationOpenedAt: readyByDate("2026-07-25"),
  }),
  req({
    requirementId: "req-finley",
    apprenticeId: "lrn-finley-brooks",
    plannedReviewDate: "2026-07-13",
    preparationOpenedAt: readyByDate("2026-07-13"),
    states: {
      employer_feedback_received: "missing",
      tutor_evidence_received: "missing",
    },
  }),
  req({
    requirementId: "req-ellie",
    apprenticeId: "lrn-ellie-scott",
    plannedReviewDate: "2026-07-24",
    preparationOpenedAt: readyByDate("2026-07-24"),
  }),
  req({
    requirementId: "req-grace",
    apprenticeId: "lrn-grace-powell",
    plannedReviewDate: "2026-07-23",
    preparationOpenedAt: readyByDate("2026-07-23"),
    states: {
      apprentice_reflection_received: "missing",
    },
  }),
  req({
    requirementId: "req-leo",
    apprenticeId: "lrn-leo-griffin",
    plannedReviewDate: "2026-07-21",
    preparationOpenedAt: readyByDate("2026-07-21"),
  }),

  // Upcoming (preparation not open / not urgent)
  req({
    requirementId: "req-oscar",
    apprenticeId: "lrn-oscar-hayes",
    plannedReviewDate: "2026-08-05",
    preparationOpenedAt: null,
    queueTab: "upcoming",
    states: {
      apprentice_reflection_requested: "missing",
      apprentice_reflection_received: "missing",
      employer_feedback_requested: "missing",
      employer_feedback_received: "missing",
      tutor_evidence_requested: "missing",
      tutor_evidence_received: "missing",
      previous_actions_reviewed: "missing",
    },
  }),
  req({
    requirementId: "req-freya",
    apprenticeId: "lrn-freya-ward",
    plannedReviewDate: "2026-08-12",
    preparationOpenedAt: null,
    queueTab: "upcoming",
    states: {
      apprentice_reflection_requested: "missing",
      employer_feedback_requested: "missing",
      tutor_evidence_requested: "missing",
    },
  }),
  req({
    requirementId: "req-chloe",
    apprenticeId: "lrn-chloe-nash",
    plannedReviewDate: "2026-08-18",
    preparationOpenedAt: null,
    queueTab: "upcoming",
    isFirstReview: true,
    states: {
      previous_review_loaded: "not_applicable",
      apprentice_reflection_requested: "missing",
      employer_feedback_requested: "missing",
      tutor_evidence_requested: "missing",
    },
  }),
  req({
    requirementId: "req-harry",
    apprenticeId: "lrn-harry-kent",
    plannedReviewDate: "2026-08-20",
    preparationOpenedAt: null,
    queueTab: "upcoming",
  }),
  req({
    requirementId: "req-ivy",
    apprenticeId: "lrn-ivy-marshall",
    plannedReviewDate: "2026-08-25",
    preparationOpenedAt: null,
    queueTab: "upcoming",
  }),
  req({
    requirementId: "req-noah-next",
    apprenticeId: "lrn-noah-reid",
    plannedReviewDate: "2026-08-08",
    preparationOpenedAt: null,
    queueTab: "upcoming",
  }),
  req({
    requirementId: "req-isla-next",
    apprenticeId: "lrn-isla-bennett",
    plannedReviewDate: "2026-08-15",
    preparationOpenedAt: null,
    queueTab: "upcoming",
  }),
  req({
    requirementId: "req-mia-next",
    apprenticeId: "lrn-mia-chen",
    plannedReviewDate: "2026-08-10",
    preparationOpenedAt: null,
    queueTab: "upcoming",
  }),
];

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

export let FORMAL_REVIEWS: FormalReview[] = [
  // Open reviews (6)
  formal({
    reviewId: "rev-mia-open",
    requirementId: "req-mia-open",
    apprenticeId: "lrn-mia-chen",
    apprenticeName: "Mia Chen",
    employerId: "emp-ashfield",
    employerName: "Ashfield Logistics",
    programmeName: "Business Admin L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-17",
    reviewType: "Priority review",
    previousReviewId: "hist-lrn-mia-chen",
    stage: "awaiting_employer",
    progressPercent: 72,
    lastEditedAt: "2026-07-16T14:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: ["Employer contribution"],
    signOff: {
      apprenticeSigned: true,
      employerSigned: false,
      providerSigned: false,
      summaryIssued: false,
      amendmentRequested: false,
      reminderSent: true,
    },
    participants: ["Mia Chen", MENTOR_NAME, "Claire Dunn"],
    progressJudgement: null,
    actionsCreated: 2,
    nextReviewDate: nextReviewDueDate("2026-07-17"),
    completedBy: null,
    completedAt: null,
    audit: [
      {
        at: "2026-07-15T10:00:00Z",
        userId: MENTOR_ID,
        userName: MENTOR_NAME,
        action: "created",
      },
    ],
    readOnly: false,
    originalDueDate: "2026-07-17",
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 0,
  }),
  formal({
    reviewId: "rev-noah-open",
    requirementId: "req-noah-open",
    apprenticeId: "lrn-noah-reid",
    apprenticeName: "Noah Reid",
    employerId: "emp-peak",
    employerName: "Peak Power Solutions",
    programmeName: "Electrical Install L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-19",
    reviewType: "Progress review",
    previousReviewId: "hist-lrn-noah-reid",
    stage: "in_progress",
    progressPercent: 45,
    lastEditedAt: "2026-07-17T09:30:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: ["Actions", "Judgement"],
    signOff: {
      apprenticeSigned: false,
      employerSigned: false,
      providerSigned: false,
      summaryIssued: false,
      amendmentRequested: false,
      reminderSent: false,
    },
    participants: ["Noah Reid", MENTOR_NAME],
    progressJudgement: null,
    actionsCreated: 0,
    nextReviewDate: null,
    completedBy: null,
    completedAt: null,
    audit: [
      {
        at: "2026-07-14T11:00:00Z",
        userId: MENTOR_ID,
        userName: MENTOR_NAME,
        action: "created",
      },
    ],
    readOnly: false,
    originalDueDate: "2026-07-19",
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 0,
  }),
  formal({
    reviewId: "rev-isla-amend",
    requirementId: "req-isla-amend",
    apprenticeId: "lrn-isla-bennett",
    apprenticeName: "Isla Bennett",
    employerId: "emp-donvalley",
    employerName: "Don Valley Bodyworks",
    programmeName: "Panel Technician L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-10",
    reviewType: "Progress review",
    previousReviewId: "hist-lrn-isla-bennett",
    stage: "returned_for_amendment",
    progressPercent: 90,
    lastEditedAt: "2026-07-16T16:00:00Z",
    lastEditedBy: "Employer contact",
    missingSections: ["Amended summary"],
    signOff: {
      apprenticeSigned: true,
      employerSigned: false,
      providerSigned: true,
      summaryIssued: true,
      amendmentRequested: true,
      reminderSent: false,
    },
    participants: ["Isla Bennett", MENTOR_NAME, "Employer"],
    progressJudgement: "On track with support",
    actionsCreated: 1,
    nextReviewDate: nextReviewDueDate("2026-07-10"),
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-07-10",
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 1,
  }),
  formal({
    reviewId: "rev-freya-open",
    requirementId: "req-freya-open",
    apprenticeId: "lrn-freya-ward",
    apprenticeName: "Freya Ward",
    employerId: "emp-ashfield",
    employerName: "Ashfield Logistics",
    programmeName: "Business Admin L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-11",
    reviewType: "Progress review",
    previousReviewId: null,
    stage: "preparation_continuing",
    progressPercent: 20,
    lastEditedAt: "2026-07-15T12:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: ["Apprentice reflection", "Progress"],
    signOff: {
      apprenticeSigned: false,
      employerSigned: false,
      providerSigned: false,
      summaryIssued: false,
      amendmentRequested: false,
      reminderSent: false,
    },
    participants: ["Freya Ward", MENTOR_NAME],
    progressJudgement: null,
    actionsCreated: 0,
    nextReviewDate: null,
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-07-11",
    daysOverdue: 6,
    escalationStatus: "Overdue incomplete",
    rearrangeCount: 0,
  }),
  formal({
    reviewId: "rev-leo-paused",
    requirementId: "req-leo-paused",
    apprenticeId: "lrn-leo-griffin",
    apprenticeName: "Leo Griffin",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeName: "Plumbing Eng. L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-09",
    reviewType: "Progress review",
    previousReviewId: "hist-lrn-leo-griffin",
    stage: "paused",
    progressPercent: 35,
    lastEditedAt: "2026-07-12T10:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: ["Employer feedback"],
    signOff: {
      apprenticeSigned: false,
      employerSigned: false,
      providerSigned: false,
      summaryIssued: false,
      amendmentRequested: false,
      reminderSent: false,
    },
    participants: ["Leo Griffin", MENTOR_NAME],
    progressJudgement: null,
    actionsCreated: 0,
    nextReviewDate: null,
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-07-09",
    daysOverdue: 8,
    escalationStatus: null,
    rearrangeCount: 2,
  }),
  formal({
    reviewId: "rev-harry-await-app",
    requirementId: "req-harry-await",
    apprenticeId: "lrn-harry-kent",
    apprenticeName: "Harry Kent",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeName: "Plumbing Eng. L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-18",
    reviewType: "Progress review",
    previousReviewId: "hist-lrn-harry-kent",
    stage: "awaiting_apprentice",
    progressPercent: 60,
    lastEditedAt: "2026-07-16T11:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: ["Apprentice contribution"],
    signOff: {
      apprenticeSigned: false,
      employerSigned: false,
      providerSigned: false,
      summaryIssued: false,
      amendmentRequested: false,
      reminderSent: true,
    },
    participants: ["Harry Kent", MENTOR_NAME],
    progressJudgement: null,
    actionsCreated: 1,
    nextReviewDate: null,
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-07-18",
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 0,
  }),

  // Awaiting sign-off (3) — also counted separately from open
  formal({
    reviewId: "rev-sign-james",
    requirementId: "req-sign-james",
    apprenticeId: "lrn-james-wilson",
    apprenticeName: "James Wilson",
    employerId: "emp-northline",
    employerName: "Northline Services Ltd",
    programmeName: "Plumbing Eng. L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-06-20",
    reviewType: "Progress review",
    previousReviewId: null,
    stage: "awaiting_sign_off",
    progressPercent: 100,
    lastEditedAt: "2026-07-14T09:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: [],
    signOff: {
      apprenticeSigned: true,
      employerSigned: false,
      providerSigned: true,
      summaryIssued: true,
      amendmentRequested: false,
      reminderSent: true,
    },
    participants: ["James Wilson", MENTOR_NAME, "Employer"],
    progressJudgement: "On track",
    actionsCreated: 2,
    nextReviewDate: nextReviewDueDate("2026-06-20"),
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-06-20",
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 0,
  }),
  formal({
    reviewId: "rev-sign-ellie",
    requirementId: "req-sign-ellie",
    apprenticeId: "lrn-ellie-scott",
    apprenticeName: "Ellie Scott",
    employerId: "emp-peak",
    employerName: "Peak Power Solutions",
    programmeName: "Electrical Install L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-01",
    reviewType: "Progress review",
    previousReviewId: "hist-lrn-ellie-scott",
    stage: "awaiting_sign_off",
    progressPercent: 100,
    lastEditedAt: "2026-07-15T15:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: [],
    signOff: {
      apprenticeSigned: false,
      employerSigned: true,
      providerSigned: true,
      summaryIssued: true,
      amendmentRequested: false,
      reminderSent: false,
    },
    participants: ["Ellie Scott", MENTOR_NAME],
    progressJudgement: "Slightly behind",
    actionsCreated: 3,
    nextReviewDate: nextReviewDueDate("2026-07-01"),
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-07-01",
    daysOverdue: 3,
    escalationStatus: "Sign-off overdue",
    rearrangeCount: 0,
  }),
  formal({
    reviewId: "rev-sign-grace",
    requirementId: "req-sign-grace",
    apprenticeId: "lrn-grace-powell",
    apprenticeName: "Grace Powell",
    employerId: "emp-donvalley",
    employerName: "Don Valley Bodyworks",
    programmeName: "Panel Technician L3",
    mentorName: MENTOR_NAME,
    reviewDate: "2026-07-05",
    reviewType: "Progress review",
    previousReviewId: "hist-lrn-grace-powell",
    stage: "awaiting_sign_off",
    progressPercent: 100,
    lastEditedAt: "2026-07-13T10:00:00Z",
    lastEditedBy: MENTOR_NAME,
    missingSections: [],
    signOff: {
      apprenticeSigned: true,
      employerSigned: true,
      providerSigned: false,
      summaryIssued: false,
      amendmentRequested: false,
      reminderSent: true,
    },
    participants: ["Grace Powell", MENTOR_NAME],
    progressJudgement: "On track",
    actionsCreated: 1,
    nextReviewDate: nextReviewDueDate("2026-07-05"),
    completedBy: null,
    completedAt: null,
    audit: [],
    readOnly: false,
    originalDueDate: "2026-07-05",
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 0,
  }),

  // Completed (12)
  ...[
    "lrn-isla-bennett",
    "lrn-oscar-hayes",
    "lrn-amelia-frost",
    "lrn-harvey-cole",
    "lrn-freya-ward",
    "lrn-leo-griffin",
    "lrn-chloe-nash",
    "lrn-dylan-moore",
    "lrn-ellie-scott",
    "lrn-finley-brooks",
    "lrn-grace-powell",
    "lrn-harry-kent",
  ].map((apprenticeId, index) => {
    const l = apprentice(apprenticeId);
    return formal({
      reviewId: `rev-complete-${index + 1}`,
      requirementId: `req-complete-${index + 1}`,
      apprenticeId: l.apprenticeId,
      apprenticeName: l.displayName,
      employerId: l.employerId,
      employerName: l.employerName,
      programmeName: l.programmeName,
      mentorName: MENTOR_NAME,
      reviewDate: `2026-0${Math.max(1, 6 - Math.floor(index / 4))}-${String(28 - index).padStart(2, "0")}`,
      reviewType: "Progress review",
      previousReviewId: index === 0 ? null : `hist-${apprenticeId}`,
      stage: "completed",
      progressPercent: 100,
      lastEditedAt: "2026-06-28T12:00:00Z",
      lastEditedBy: MENTOR_NAME,
      missingSections: [],
      signOff: {
        apprenticeSigned: true,
        employerSigned: true,
        providerSigned: true,
        summaryIssued: true,
        amendmentRequested: false,
        reminderSent: false,
      },
      participants: [l.displayName, MENTOR_NAME, l.employerName],
      progressJudgement: index % 3 === 0 ? "Behind — recovering" : "On track",
      actionsCreated:
        apprenticeId === "lrn-isla-bennett" ? 3 : 1 + (index % 3),
      nextReviewDate: l.nextReviewDate,
      completedBy: MENTOR_NAME,
      completedAt: `2026-06-${String(20 + (index % 8)).padStart(2, "0")}`,
      audit: [
        {
          at: "2026-06-20T10:00:00Z",
          userId: MENTOR_ID,
          userName: MENTOR_NAME,
          action: "completed",
        },
      ],
      readOnly: true,
      originalDueDate: null,
      daysOverdue: null,
      escalationStatus: null,
      rearrangeCount: 0,
    });
  }),
];

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
