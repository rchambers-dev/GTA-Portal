import { MENTOR_NAME } from "../../data/mentor-caseload";
import { assessSmartto } from "./smartto";
import type { ActionRecord, ActionSourceType } from "./types";

function action(
  partial: Omit<
    ActionRecord,
    "smartto" | "priority" | "evidencePackId" | "signedOffBy" | "signedOffAt" | "signOffNote"
  > & {
    smartto?: ActionRecord["smartto"];
    priority?: ActionRecord["priority"];
    evidencePackId?: string | null;
    signedOffBy?: string | null;
    signedOffAt?: string | null;
    signOffNote?: string | null;
  },
): ActionRecord {
  const smartto =
    partial.smartto ??
    assessSmartto({
      title: partial.title,
      description: partial.description,
      successMeasure: partial.successMeasure,
      dueDate: partial.dueDate,
      checkpointDate: partial.checkpointDate,
      owner: partial.owner,
      evidenceRequirement: partial.evidenceRequirement,
    });
  let priority: ActionRecord["priority"] = partial.priority ?? "medium";
  if (partial.status === "escalated" || partial.escalationStatus) priority = "critical";
  else if (partial.status === "overdue") priority = "high";
  else if (partial.status === "checkpoint_due" || partial.dueDate === "2026-07-17") {
    priority = "high";
  }
  return {
    ...partial,
    smartto,
    priority,
    evidencePackId: partial.evidencePackId ?? null,
    signedOffBy: partial.signedOffBy ?? null,
    signedOffAt: partial.signedOffAt ?? null,
    signOffNote: partial.signOffNote ?? null,
  };
}

function srcLabel(type: ActionSourceType, id: string): string {
  switch (type) {
    case "review":
      return `Review ${id}`;
    case "intervention":
      return `Intervention ${id}`;
    case "employer_concern":
      return `Concern ${id}`;
    case "attendance":
      return "Attendance follow-up";
    case "evidence":
      return "Evidence gap";
    case "epa":
      return "EPA preparation";
    case "programme_recovery":
      return "Programme overdue recovery";
    case "quality":
      return "Quality finding";
    case "management":
      return "Management decision";
    case "support":
      return "Support activity";
    case "tutor":
      return "Tutor follow-up";
    default:
      return id;
  }
}

export let ACTION_RECORDS: ActionRecord[] = [];

export function getAction(actionId: string): ActionRecord | undefined {
  return ACTION_RECORDS.find((a) => a.actionId === actionId);
}

export function actionsForReview(reviewId: string): ActionRecord[] {
  return ACTION_RECORDS.filter(
    (a) => a.sourceType === "review" && a.sourceId === reviewId,
  );
}

export function previousActionsForApprentice(apprenticeId: string): ActionRecord[] {
  return ACTION_RECORDS.filter(
    (a) =>
      a.apprenticeId === apprenticeId &&
      a.status !== "cancelled" &&
      a.status !== "closed" &&
      a.status !== "draft",
  );
}

export function openActionsForApprentice(apprenticeId: string): ActionRecord[] {
  return ACTION_RECORDS.filter(
    (a) =>
      a.apprenticeId === apprenticeId &&
      ![
        "completed",
        "impact_confirmed",
        "cancelled",
        "closed",
        "draft",
      ].includes(a.status),
  );
}

export function addAction(record: ActionRecord): void {
  ACTION_RECORDS = [record, ...ACTION_RECORDS];
}

export function updateAction(
  actionId: string,
  patch: Partial<ActionRecord>,
): ActionRecord | undefined {
  const index = ACTION_RECORDS.findIndex((a) => a.actionId === actionId);
  if (index < 0) return undefined;
  const next = { ...ACTION_RECORDS[index], ...patch };
  ACTION_RECORDS = [
    ...ACTION_RECORDS.slice(0, index),
    next,
    ...ACTION_RECORDS.slice(index + 1),
  ];
  return next;
}

/** Mentor personally verifies evidence and signs the action off as completed. */
export function mentorSignOffAction(input: {
  actionId: string;
  mentorName: string;
  note: string;
  impact: string;
}): ActionRecord | undefined {
  const today = "2026-07-17";
  return updateAction(input.actionId, {
    status: "completed",
    evidenceState: "accepted",
    completionEvidence: "Verified against linked evidence pack",
    impact: input.impact,
    progressUpdate: input.note || "Mentor signed off after checking evidence",
    closedDate: today,
    closureReason: "Mentor signed off as completed",
    lastUpdate: today,
    signedOffBy: input.mentorName,
    signedOffAt: today,
    signOffNote: input.note,
    assignedToMe: false,
  });
}

export function toLegacyMentorAction(row: ActionRecord) {
  return {
    actionId: row.actionId,
    title: row.title,
    apprenticeId: row.apprenticeId ?? "",
    apprenticeName: row.apprenticeName ?? "",
    employerId: row.employerId ?? "",
    employerName: row.employerName ?? "",
    owner: row.owner,
    ownerType: (["apprentice", "employer", "tutor", "provider", "mentor"].includes(
      row.ownerType,
    )
      ? row.ownerType
      : "provider") as "apprentice" | "employer" | "tutor" | "provider" | "mentor",
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    createdAt: row.createdAt,
    dueDate: row.dueDate,
    checkpointDate: row.checkpointDate,
    successMeasure: row.successMeasure,
    evidenceRequirement: row.evidenceRequirement,
    status: (row.status === "escalated"
      ? "escalated"
      : row.status === "overdue"
        ? "overdue"
        : row.status === "awaiting_evidence"
          ? "awaiting_evidence"
          : row.status === "completed" || row.status === "impact_confirmed"
            ? "completed"
            : "open") as
      | "open"
      | "overdue"
      | "awaiting_evidence"
      | "escalated"
      | "completed",
    escalationStatus: row.escalationStatus,
    lastUpdate: row.lastUpdate,
    assignedToMe: row.assignedToMe,
    assignedByMe: row.assignedByMe,
  };
}
