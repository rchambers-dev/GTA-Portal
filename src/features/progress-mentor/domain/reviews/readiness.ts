import type {
  ChecklistItem,
  ChecklistItemKey,
  ReadinessStatus,
  SoftOverride,
} from "./types";

export const CHECKLIST_LABELS: Record<ChecklistItemKey, string> = {
  apprentice_identity: "Apprentice identity confirmed",
  employer_contact: "Employer and workplace contact confirmed",
  review_date_scheduled: "Review date scheduled",
  assigned_mentor: "Assigned mentor confirmed",
  previous_review_loaded: "Previous review loaded",
  previous_actions_loaded: "Previous actions loaded",
  previous_actions_reviewed: "Previous actions reviewed",
  apprentice_reflection_requested: "Apprentice reflection requested",
  apprentice_reflection_received: "Apprentice reflection received",
  employer_feedback_requested: "Employer feedback requested",
  employer_feedback_received: "Employer feedback received",
  tutor_evidence_requested: "Tutor or provider evidence requested",
  tutor_evidence_received: "Tutor or provider evidence received",
  attendance_available: "Attendance data available",
  planned_progress: "Planned progress calculated",
  actual_progress: "Actual progress calculated",
  progress_variance: "Progress variance calculated",
  off_the_job: "Off-the-job record available",
  mandatory_evidence: "Mandatory evidence position available",
  open_interventions: "Open interventions loaded",
  support_information: "Support information loaded",
  epa_readiness: "EPA readiness data loaded",
  safeguarding_prompts: "Safeguarding and wellbeing prompts available",
};

const HARD_KEYS: ChecklistItemKey[] = [
  "apprentice_identity",
  "employer_contact",
  "review_date_scheduled",
  "assigned_mentor",
  "previous_review_loaded",
  "previous_actions_loaded",
  "planned_progress",
  "actual_progress",
  "attendance_available",
  "apprentice_reflection_requested",
  "employer_feedback_requested",
  "tutor_evidence_requested",
];

export function isHardKey(key: ChecklistItemKey, isFirstReview: boolean): boolean {
  if (key === "previous_review_loaded" && isFirstReview) return false;
  return HARD_KEYS.includes(key);
}

export function itemSatisfied(item: ChecklistItem): boolean {
  return (
    item.state === "complete" ||
    item.state === "not_applicable" ||
    item.state === "overridden" ||
    (item.key === "attendance_available" && item.state === "unavailable")
  );
}

export function hardItemsIncomplete(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => item.hard && !itemSatisfied(item));
}

export function softItemsIncomplete(checklist: ChecklistItem[]): ChecklistItem[] {
  return checklist.filter((item) => !item.hard && !itemSatisfied(item));
}

export function readinessPercent(checklist: ChecklistItem[]): number {
  if (checklist.length === 0) return 0;
  const done = checklist.filter(itemSatisfied).length;
  return Math.round((done / checklist.length) * 100);
}

export function missingLabels(checklist: ChecklistItem[]): string[] {
  return checklist.filter((i) => !itemSatisfied(i)).map((i) => i.label);
}

export function canCreateReview(
  checklist: ChecklistItem[],
  overrides: SoftOverride[] = [],
): { allowed: boolean; blocking: string[]; warnings: string[] } {
  void overrides;
  const hard = hardItemsIncomplete(checklist);
  const soft = softItemsIncomplete(checklist);
  // Hard items cannot be overridden without being marked overridden on the item itself
  const stillBlocking = hard.filter((i) => i.state !== "overridden").map((i) => i.label);
  return {
    allowed: stillBlocking.length === 0,
    blocking: stillBlocking,
    warnings: soft.map((i) => i.label),
  };
}

export function deriveReadinessStatus(input: {
  checklist: ChecklistItem[];
  dueStatus: "on_track" | "due_soon" | "overdue" | "rearranged";
  preparationOpenedAt: string | null;
}): ReadinessStatus {
  const { checklist, dueStatus, preparationOpenedAt } = input;
  const hard = hardItemsIncomplete(checklist);
  const soft = softItemsIncomplete(checklist);
  const gate = canCreateReview(checklist);

  if (dueStatus === "overdue" && !gate.allowed) return "overdue";

  if (!preparationOpenedAt) {
    const anyWork = checklist.some(
      (i) =>
        i.state === "requested" ||
        i.state === "complete" ||
        i.state === "overridden",
    );
    if (!anyWork) return "not_started";
  }

  if (hard.length > 0) {
    const waiting = hard.some((i) => i.state === "requested");
    if (waiting) return "waiting_for_responses";
    const blocked = hard.some(
      (i) => i.state === "missing" || i.state === "unavailable",
    );
    if (blocked) return "blocked";
    return "preparation_in_progress";
  }

  if (soft.length > 0) return "ready_with_warnings";
  return "ready_to_create";
}

export function primaryActionForRequirement(input: {
  readinessStatus: ReadinessStatus;
  checklist: ChecklistItem[];
  formalReviewId: string | null;
}): { key: string; label: string } {
  if (input.formalReviewId) {
    return { key: "open_review", label: "Open review" };
  }
  const gate = canCreateReview(input.checklist);
  if (gate.allowed) {
    return { key: "create_review", label: "Create review" };
  }
  const items = input.checklist;
  const reflection = items.find((i) => i.key === "apprentice_reflection_requested");
  const employer = items.find((i) => i.key === "employer_feedback_requested");
  const tutor = items.find((i) => i.key === "tutor_evidence_requested");
  const actions = items.find((i) => i.key === "previous_actions_reviewed");
  const dataIssue = items.find(
    (i) =>
      (i.key === "planned_progress" || i.key === "actual_progress") &&
      (i.state === "missing" || i.state === "unavailable"),
  );

  if (dataIssue) return { key: "resolve_data_issue", label: "Resolve data issue" };
  if (actions && !itemSatisfied(actions)) {
    return { key: "review_previous_actions", label: "Review previous actions" };
  }
  if (reflection?.state === "missing") {
    return {
      key: "request_apprentice_reflection",
      label: "Request apprentice reflection",
    };
  }
  if (employer?.state === "missing") {
    return {
      key: "request_employer_feedback",
      label: "Request employer feedback",
    };
  }
  if (tutor?.state === "missing") {
    return { key: "request_tutor_evidence", label: "Request tutor evidence" };
  }
  if (input.readinessStatus === "not_started") {
    return { key: "start_preparation", label: "Start preparation" };
  }
  return { key: "continue_preparation", label: "Continue preparation" };
}

export function makeChecklistItem(
  key: ChecklistItemKey,
  state: ChecklistItem["state"],
  opts?: {
    isFirstReview?: boolean;
    reason?: string | null;
    requiresManagementOverride?: boolean;
  },
): ChecklistItem {
  return {
    key,
    label: CHECKLIST_LABELS[key],
    hard: isHardKey(key, opts?.isFirstReview ?? false),
    state,
    reason: opts?.reason ?? null,
    requiresManagementOverride: opts?.requiresManagementOverride,
  };
}

export function readinessStatusLabel(status: ReadinessStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "preparation_in_progress":
      return "Preparation in progress";
    case "blocked":
      return "Blocked";
    case "waiting_for_responses":
      return "Waiting for responses";
    case "ready_with_warnings":
      return "Ready with warnings";
    case "ready_to_create":
      return "Ready to create";
    case "overdue":
      return "Overdue";
    default:
      return status;
  }
}

export function checklistStateLabel(state: ChecklistItem["state"]): string {
  switch (state) {
    case "complete":
      return "Complete";
    case "missing":
      return "Missing";
    case "requested":
      return "Requested";
    case "not_applicable":
      return "Not applicable";
    case "unavailable":
      return "Unavailable";
    case "overridden":
      return "Overridden";
    default:
      return state;
  }
}
