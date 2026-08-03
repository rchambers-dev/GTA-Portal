export type ActionOwnerType =
  | "apprentice"
  | "employer"
  | "tutor"
  | "mentor"
  | "administrator"
  | "manager"
  | "quality"
  | "provider"
  | "other";

export type ActionSourceType =
  | "review"
  | "intervention"
  | "employer_concern"
  | "support"
  | "attendance"
  | "evidence"
  | "tutor"
  | "epa"
  | "quality"
  | "management"
  | "programme_recovery";

export type ActionStatus =
  | "draft"
  | "agreed"
  | "not_started"
  | "in_progress"
  | "awaiting_evidence"
  | "checkpoint_due"
  | "completed"
  | "impact_confirmed"
  | "overdue"
  | "escalated"
  | "cancelled"
  | "closed";

export type EvidenceState =
  | "required"
  | "submitted"
  | "accepted"
  | "rejected"
  | "more_required";

export type SmarttoDimension =
  | "specific"
  | "measurable"
  | "achievable"
  | "relevant"
  | "timely"
  | "trackable"
  | "owned";

export type SmarttoAssessment = {
  scores: Record<SmarttoDimension, boolean>;
  quality: "strong" | "needs_improvement";
  guidance: string[];
};

export type ActionRecord = {
  actionId: string;
  title: string;
  description: string;
  apprenticeId: string | null;
  apprenticeName: string | null;
  employerId: string | null;
  employerName: string | null;
  owner: string;
  ownerType: ActionOwnerType;
  createdBy: string;
  sourceType: ActionSourceType;
  sourceId: string;
  sourceLabel: string;
  createdAt: string;
  startDate: string;
  dueDate: string;
  checkpointDate: string;
  successMeasure: string;
  evidenceRequirement: string;
  evidenceState: EvidenceState;
  challengeLevel: "standard" | "stretch" | "foundational";
  status: ActionStatus;
  progressUpdate: string | null;
  completionEvidence: string | null;
  impact: string | null;
  escalationStatus: string | null;
  escalationLevel: number | null;
  closedDate: string | null;
  closureReason: string | null;
  lastUpdate: string;
  assignedToMe: boolean;
  assignedByMe: boolean;
  smartto: SmarttoAssessment;
  missedTargetCount: number;
  priority: "critical" | "high" | "medium" | "low";
  /** Link to validating evidence in the mock “database”. */
  evidencePackId: string | null;
  /** Mentor personally confirmed completion against evidence. */
  signedOffBy: string | null;
  signedOffAt: string | null;
  signOffNote: string | null;
};

export type ActionsTabId =
  | "assigned_to_me"
  | "assigned_by_me"
  | "due_today"
  | "upcoming"
  | "overdue"
  | "employer_commitments"
  | "apprentice_targets"
  | "awaiting_evidence"
  | "escalated"
  | "completed";
