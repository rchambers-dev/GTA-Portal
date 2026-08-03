/**
 * Progress Mentor caseload types.
 * Live caseload will load from Supabase — no fictional apprentices here.
 */

export const MENTOR_ID = "reiss-chambers";
export const MENTOR_NAME = "Reiss Chambers";

export type MentorApprenticeRow = {
  apprenticeId: string;
  displayName: string;
  initials: string;
  employerId: string;
  employerName: string;
  programmeId: string;
  programmeName: string;
  tutorName: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number | null;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  attendancePercent: number | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  openActionCount: number;
  interventionId: string | null;
  interventionType: string | null;
  employerConcernStatus: "none" | "open" | "urgent" | "monitoring";
  riskStatus:
    | "on_track"
    | "slightly_behind"
    | "significantly_behind"
    | "priority"
    | "overdue"
    | "pre_start";
  lastContactDate: string | null;
  missingMandatoryEvidence: number;
  epaApproaching: boolean;
  programmeOverdue: boolean;
  status: "active" | "pre_start" | "completed";
};

export type MentorReviewRow = {
  reviewId: string;
  apprenticeId: string;
  apprenticeName: string;
  employerName: string;
  programmeName: string;
  reviewDate: string;
  reviewType: string;
  preparationStatus: string;
  apprenticeReflection: string;
  employerFeedback: string;
  previousActionsChecked: boolean;
  evidenceReadiness: string;
  reviewStatus: string;
  signOffStatus: string;
  view:
    | "upcoming"
    | "preparation"
    | "ready"
    | "in_progress"
    | "awaiting_apprentice"
    | "awaiting_employer"
    | "awaiting_provider"
    | "completed"
    | "overdue"
    | "rearranged";
};

export type MentorActionRow = {
  actionId: string;
  title: string;
  apprenticeId: string;
  apprenticeName: string;
  employerId: string;
  employerName: string;
  owner: string;
  ownerType: "apprentice" | "employer" | "tutor" | "provider" | "mentor";
  sourceType: string;
  sourceId: string;
  createdAt: string;
  dueDate: string;
  checkpointDate: string;
  successMeasure: string;
  evidenceRequirement: string;
  status: "open" | "overdue" | "awaiting_evidence" | "escalated" | "completed";
  escalationStatus: string | null;
  lastUpdate: string;
  assignedToMe: boolean;
  assignedByMe: boolean;
};

export type MentorEmployerRow = {
  employerId: string;
  name: string;
  mainContact: string;
  activeApprentices: number;
  programmes: string[];
  lastContact: string | null;
  nextContact: string | null;
  reviewAttendanceRate: number;
  openCommitments: number;
  overdueCommitments: number;
  openConcerns: number;
  engagementStatus: "strong" | "steady" | "low" | "at_risk";
  lastFeedback: string | null;
};

export type MentorConcernRow = {
  caseId: string;
  caseReference: string;
  employerId: string;
  employerName: string;
  apprenticeId: string;
  apprenticeName: string;
  programmeName: string;
  concernType: string;
  priority: "normal" | "urgent";
  dateRaised: string;
  employmentRisk: boolean;
  welfareImpact: boolean;
  assignedStaff: string;
  status:
    | "new"
    | "urgent"
    | "awaiting_triage"
    | "investigating"
    | "awaiting_employer"
    | "awaiting_internal"
    | "action_agreed"
    | "monitoring"
    | "resolved"
    | "closed";
  lastUpdate: string;
  nextAction: string;
};

export type MentorInterventionRow = {
  interventionId: string;
  apprenticeId: string;
  apprenticeName: string;
  type: string;
  reason: string;
  desiredOutcome: string;
  owner: string;
  startDate: string;
  nextCheckpoint: string;
  reviewDate: string;
  currentImpact: string;
  status:
    | "proposed"
    | "active"
    | "due_checkpoint"
    | "improving"
    | "no_improvement"
    | "escalated"
    | "completed"
    | "closed";
  priority: "normal" | "high";
};

export type MentorMessageRow = {
  messageId: string;
  conversationType: string;
  subject: string;
  linkedType: string | null;
  linkedId: string | null;
  linkedLabel: string | null;
  lastMessageAt: string;
  unread: boolean;
  participants: string;
};

export const MENTOR_EMPLOYERS: MentorEmployerRow[] = [];
export const MENTOR_APPRENTICES: MentorApprenticeRow[] = [];
