import type {
  EvidenceRequirementStatus,
  OverallApprenticeStatus,
} from "../types";
import type { StatusTone } from "@/components/ui/StatusBadge";

export function overallStatusLabel(status: OverallApprenticeStatus): string {
  const labels: Record<OverallApprenticeStatus, string> = {
    pre_start: "Pre-start",
    on_track: "On track",
    monitoring: "Monitoring",
    behind_recovering: "Behind but recovering",
    priority_intervention: "Priority intervention",
    gateway_preparation: "Gateway preparation",
    epa: "EPA",
    programme_overdue: "Programme overdue",
    completed: "Completed",
    unknown: "Unknown",
  };
  return labels[status];
}

export function overallStatusTone(status: OverallApprenticeStatus): StatusTone {
  switch (status) {
    case "on_track":
    case "completed":
      return "on_track";
    case "monitoring":
    case "behind_recovering":
    case "gateway_preparation":
      return "monitoring";
    case "priority_intervention":
    case "programme_overdue":
      return "priority";
    default:
      return "neutral";
  }
}

export function evidenceStatusLabel(status: EvidenceRequirementStatus): string {
  const labels: Record<EvidenceRequirementStatus, string> = {
    future_requirement: "Future requirement",
    not_applicable: "Not applicable",
    missing: "Missing",
    requested: "Requested",
    received: "Received",
    awaiting_check: "Awaiting check",
    checked_and_accepted: "Checked",
    checked_with_discrepancy: "Checked with discrepancy",
    correction_required: "Correction required",
    disputed: "Disputed",
    due_for_review: "Due for review",
    expired: "Expired",
    superseded: "Superseded",
    archived: "Archived",
  };
  return labels[status];
}

export function evidenceStatusTone(status: EvidenceRequirementStatus): StatusTone {
  switch (status) {
    case "checked_and_accepted":
      return "checked";
    case "missing":
    case "correction_required":
    case "disputed":
      return "missing";
    case "due_for_review":
    case "awaiting_check":
    case "received":
      return "review";
    default:
      return "neutral";
  }
}
