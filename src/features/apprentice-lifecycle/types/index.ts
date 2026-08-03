/**
 * Feature DTOs — portable contracts for Kanban, workspace, and evidence.
 * Null / unknown fields must display as honest empty states, never as positive RAG.
 */

export type ProgrammeStatus =
  | "pre_start"
  | "on_programme"
  | "gateway"
  | "epa"
  | "completed"
  | "withdrawn"
  | "break_in_learning";

export type OverallApprenticeStatus =
  | "pre_start"
  | "on_track"
  | "monitoring"
  | "behind_recovering"
  | "priority_intervention"
  | "gateway_preparation"
  | "epa"
  | "programme_overdue"
  | "completed"
  | "unknown";

export type PriorityOwnerCategory = "apprentice" | "employer" | "gta" | "unknown";

export type EvidenceRequirementStatus =
  | "future_requirement"
  | "not_applicable"
  | "missing"
  | "requested"
  | "received"
  | "awaiting_check"
  | "checked_and_accepted"
  | "checked_with_discrepancy"
  | "correction_required"
  | "disputed"
  | "due_for_review"
  | "expired"
  | "superseded"
  | "archived";

export type RequirementKind = "mandatory" | "conditional";

export type MetricKey =
  | "active_apprentices"
  | "priority_intervention"
  | "reviews_due"
  | "programme_overdue"
  | "employer_actions_overdue"
  | "missing_mandatory_evidence";

export type AppRole =
  | "administrator"
  | "senior_manager"
  | "mentor"
  | "tutor"
  | "reviewer"
  | "employer"
  | "apprentice"
  | "support"
  | "auditor";

export type SessionUser = {
  id: string;
  displayName: string;
  email: string;
  roles: AppRole[];
  /** Primary role shown in chrome */
  primaryRoleLabel: string;
};

export type PriorityTaskSummary = {
  title: string;
  ownerCategory: PriorityOwnerCategory;
  /** Display-safe; never includes safeguarding detail */
  summary: string;
  dueDate: string | null;
};

export type ApprenticeCardDto = {
  apprenticeId: string;
  displayName: string;
  initials: string;
  programmeName: string;
  employerName: string | null;
  programmeWeek: number | null;
  programmeStatus: ProgrammeStatus;
  overallStatus: OverallApprenticeStatus;
  primaryPriority: PriorityTaskSummary | null;
  attendancePercent: number | null;
  nextReviewDate: string | null;
  openActionCount: number;
  missingMandatoryEvidenceCount: number;
  evidenceCheckedCount: number;
  evidenceTotalCount: number;
  /** ISO duration summary when programme overdue; null otherwise */
  programmeOverdueLabel: string | null;
  /** Week column placement; null if in overdue/workflow column only */
  boardWeek: number | null;
  mentorName: string | null;
  tutorName: string | null;
  /** Honest placeholder when intake incomplete */
  intakeComplete: boolean;
};

export type SummaryMetricDto = {
  key: MetricKey;
  label: string;
  value: number;
  deltaLabel: string | null;
  tone: "neutral" | "amber" | "red" | "green";
  /** Recent weekly values for the miniature trend chart (oldest → newest) */
  sparkline: number[];
  trend: "up" | "down" | "flat";
  /** Operational breakdown lines under the value */
  breakdown?: string[];
  /** CTA label under the card */
  actionLabel?: string;
};

export type BoardQuery = {
  year: 1 | 2 | 3;
  fromWeek: number;
  span: number;
  mineOnly: boolean;
  metric: MetricKey | null;
  programmeId: string | null;
};

export type BoardColumnDto = {
  kind: "pre_start" | "week" | "overdue";
  weekNumber: number | null;
  label: string;
  sublabel: string | null;
  apprenticeIds: string[];
};

export type LifecycleBoardDto = {
  query: BoardQuery;
  metrics: SummaryMetricDto[];
  columns: BoardColumnDto[];
  overdueColumn: BoardColumnDto;
  apprenticesById: Record<string, ApprenticeCardDto>;
  viewingLabel: string;
};

export type EvidenceRequirementRowDto = {
  id: string;
  sectionKey: string;
  sectionTitle: string;
  originalBookletSection: string;
  reference: string;
  requirementKind: RequirementKind;
  title: string;
  applicability: string;
  status: EvidenceRequirementStatus;
  dateReceived: string | null;
  checkedBy: string | null;
  dateChecked: string | null;
  notes: string | null;
  evidenceCount: number;
  isRecurring: boolean;
};

export type TimelineEventDto = {
  id: string;
  occurredAt: string;
  eventType: string;
  summary: string;
  actorName: string | null;
};

export type ApprenticeWorkspaceDto = {
  card: ApprenticeCardDto;
  apprenticeReference: string | null;
  programmeStartDate: string | null;
  originalPlannedEndDate: string | null;
  currentWeekLabel: string | null;
  progressStatus: string | null;
  attendanceStatus: string | null;
  complianceStatus: string | null;
  summaryNote: string | null;
  evidenceRows: EvidenceRequirementRowDto[];
  timeline: TimelineEventDto[];
};
