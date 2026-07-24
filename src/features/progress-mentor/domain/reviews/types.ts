/**
 * Review requirement ≠ formal review ≠ action.
 * Requirements represent that a learner is due a review; formal reviews are created only when ready.
 */

export type ReadinessStatus =
  | "not_started"
  | "preparation_in_progress"
  | "blocked"
  | "waiting_for_responses"
  | "ready_with_warnings"
  | "ready_to_create"
  | "overdue";

export type DueStatus = "on_track" | "due_soon" | "overdue" | "rearranged";

export type ChecklistItemState =
  | "complete"
  | "missing"
  | "requested"
  | "not_applicable"
  | "unavailable"
  | "overridden";

export type ChecklistItemKey =
  | "learner_identity"
  | "employer_contact"
  | "review_date_scheduled"
  | "assigned_mentor"
  | "previous_review_loaded"
  | "previous_actions_loaded"
  | "previous_actions_reviewed"
  | "apprentice_reflection_requested"
  | "apprentice_reflection_received"
  | "employer_feedback_requested"
  | "employer_feedback_received"
  | "tutor_evidence_requested"
  | "tutor_evidence_received"
  | "attendance_available"
  | "planned_progress"
  | "actual_progress"
  | "progress_variance"
  | "off_the_job"
  | "mandatory_evidence"
  | "open_interventions"
  | "support_information"
  | "epa_readiness"
  | "safeguarding_prompts";

export type ChecklistItem = {
  key: ChecklistItemKey;
  label: string;
  /** Hard requirements block Create Review when incomplete. */
  hard: boolean;
  state: ChecklistItemState;
  reason?: string | null;
  requiresManagementOverride?: boolean;
};

export type SoftOverride = {
  itemKey: ChecklistItemKey;
  reason: string;
  userId: string;
  userName: string;
  at: string;
  managementAuthorised: boolean;
};

export type ReviewRequirement = {
  requirementId: string;
  learnerId: string;
  learnerName: string;
  employerId: string;
  employerName: string;
  programmeId: string;
  programmeName: string;
  tutorName: string;
  mentorId: string;
  mentorName: string;
  plannedReviewDate: string;
  reviewCycle: string;
  reviewType: string;
  previousReviewId: string | null;
  lastReviewDate: string | null;
  preparationOpenedAt: string | null;
  readinessStatus: ReadinessStatus;
  readinessPercent: number;
  missingItems: string[];
  dueStatus: DueStatus;
  generatedAt: string;
  formalReviewId: string | null;
  isFirstReview: boolean;
  checklist: ChecklistItem[];
  overrides: SoftOverride[];
  /** Queue placement when no formal review yet, or after creation for completed history. */
  queueTab:
    | "needs_creating"
    | "ready_to_create"
    | "upcoming"
    | "overdue_requirement";
};

export type FormalReviewStage =
  | "created"
  | "preparation_continuing"
  | "in_progress"
  | "paused"
  | "awaiting_apprentice"
  | "awaiting_employer"
  | "awaiting_provider"
  | "returned_for_amendment"
  | "awaiting_sign_off"
  | "completed";

export type SignOffParty = {
  role: "apprentice" | "employer" | "provider";
  printedName: string;
  organisation: string | null;
  signed: boolean;
  signedAt: string | null;
  /** Display-only signature mark for the demo record. */
  signatureMark: string | null;
};

export type SignOffState = {
  apprenticeSigned: boolean;
  employerSigned: boolean;
  providerSigned: boolean;
  summaryIssued: boolean;
  amendmentRequested: boolean;
  reminderSent: boolean;
  parties: SignOffParty[];
  summaryIssuedAt: string | null;
};

export type ReviewSnapshot = {
  plannedProgressPercent: number;
  actualProgressPercent: number;
  variancePercent: number;
  attendancePercent: number | null;
  attendanceUnavailableReason: string | null;
  offTheJobHours: number | null;
  missingMandatoryEvidence: number;
  openInterventionIds: string[];
  previousActionIds: string[];
  apprenticeContribution: string | null;
  employerContribution: string | null;
  providerContribution: string | null;
  sourceTimestamps: Record<string, string>;
  capturedAt: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number | null;
  modules: ReviewModuleSnapshot[];
  modulesCompleted: number;
  modulesRemaining: number;
  modulesInProgress: number;
  modulesVisibleTotal: number;
  currentYearModulesTotal: number;
  currentYearModulesCompleted: number;
  currentYearModulesRemaining: number;
  attendanceDetail: ReviewAttendanceSnapshot;
};

export type ReviewModuleSnapshot = {
  moduleId: string;
  code: string;
  title: string;
  year: 1 | 2 | 3;
  status: "completed" | "in_progress" | "remaining";
  completedAt: string | null;
  evidenceNote: string | null;
};

export type ReviewAttendanceSnapshot = {
  overallPercent: number | null;
  trendLabel: string;
  lastTwelveWeeks: number[];
  months: Array<{
    month: string;
    percent: number;
    sessionsAttended: number;
    sessionsExpected: number;
    note: string | null;
  }>;
  /** Individual college attendance days in the review period. */
  collegeDays: Array<{
    date: string;
    dayName: string;
    status: "attended" | "absent" | "late" | "authorised";
    session: string;
    note: string | null;
  }>;
  daysAttended: number;
  daysExpected: number;
  daysAbsent: number;
  daysLate: number;
  concern: string | null;
};

export type ReviewAuditEntry = {
  at: string;
  userId: string;
  userName: string;
  action: string;
  detail?: string;
};

export type FormalReview = {
  reviewId: string;
  requirementId: string;
  learnerId: string;
  learnerName: string;
  employerId: string;
  employerName: string;
  programmeName: string;
  mentorName: string;
  tutorName: string;
  reviewDate: string;
  reviewType: string;
  previousReviewId: string | null;
  stage: FormalReviewStage;
  progressPercent: number;
  lastEditedAt: string;
  lastEditedBy: string;
  missingSections: string[];
  signOff: SignOffState;
  snapshot: ReviewSnapshot;
  /** Live values for comparison after create (demo). */
  liveProgress?: {
    plannedProgressPercent: number;
    actualProgressPercent: number;
    attendancePercent: number | null;
  };
  participants: string[];
  progressJudgement: string | null;
  discussionNotes: string | null;
  barriersNotes: string | null;
  wellbeingNotes: string | null;
  learningFocus: string | null;
  employerWorkplaceNotes: string | null;
  actionsCreated: number;
  nextReviewDate: string | null;
  completedBy: string | null;
  completedAt: string | null;
  audit: ReviewAuditEntry[];
  readOnly: boolean;
  originalDueDate: string | null;
  daysOverdue: number | null;
  escalationStatus: string | null;
  rearrangeCount: number;
};

export type ReviewsTabId =
  | "needs_creating"
  | "ready_to_create"
  | "open"
  | "awaiting_sign_off"
  | "upcoming"
  | "overdue"
  | "completed";

export type PrimaryPrepAction =
  | "start_preparation"
  | "continue_preparation"
  | "request_apprentice_reflection"
  | "request_employer_feedback"
  | "request_tutor_evidence"
  | "resolve_data_issue"
  | "review_previous_actions"
  | "create_review"
  | "open_review"
  | "resume_review"
  | "send_reminder"
  | "view_schedule";
