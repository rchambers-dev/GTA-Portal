import { getFormalReview } from "../reviews/mock-store";
import type { ActionRecord } from "./types";

export type CycleOutcome = "yes" | "no" | "in_progress";

export type ActionCycleReview = {
  action: ActionRecord;
  outcome: CycleOutcome;
  outcomeLabel: string;
  why: string;
  bringUpAtNextReview: boolean;
};

const DONE = new Set(["completed", "impact_confirmed"]);
const CLOSED_OUT = new Set(["cancelled", "closed"]);

/**
 * Did this action meet its target before / at the next review?
 */
export function cycleOutcome(action: ActionRecord): {
  outcome: CycleOutcome;
  outcomeLabel: string;
  why: string;
  bringUpAtNextReview: boolean;
} {
  if (DONE.has(action.status)) {
    return {
      outcome: "yes",
      outcomeLabel: "Yes — completed",
      why:
        action.impact ??
        action.closureReason ??
        action.completionEvidence ??
        "Target met and recorded.",
      bringUpAtNextReview: false,
    };
  }

  if (CLOSED_OUT.has(action.status)) {
    return {
      outcome: "no",
      outcomeLabel: "No — closed without completion",
      why: action.closureReason ?? "Closed without meeting the success measure.",
      bringUpAtNextReview: true,
    };
  }

  if (
    action.status === "overdue" ||
    action.status === "escalated" ||
    action.missedTargetCount > 0
  ) {
    return {
      outcome: "no",
      outcomeLabel: "No — not met",
      why:
        action.escalationStatus ??
        action.progressUpdate ??
        (action.missedTargetCount > 0
          ? `Missed target ${action.missedTargetCount} time(s).`
          : "Past due without completion — discuss why and what happens next."),
      bringUpAtNextReview: true,
    };
  }

  return {
    outcome: "in_progress",
    outcomeLabel: "Not yet — still open",
    why:
      action.progressUpdate ??
      "Still in progress. Confirm status at the next review before agreeing new targets.",
    bringUpAtNextReview: true,
  };
}

/**
 * Human-readable source for Action Centre rows.
 * e.g. "Progress review · 28 Jun 2026 · Isla Bennett"
 */
export function humanSourceLabel(action: ActionRecord): string {
  if (action.sourceType === "review") {
    const review = getFormalReview(action.sourceId);
    if (review) {
      const date = formatShortDate(review.reviewDate);
      return `${review.reviewType} · ${date} · ${review.apprenticeName}`;
    }
    if (
      action.sourceLabel &&
      !action.sourceLabel.startsWith("Review rev-") &&
      action.sourceLabel !== `Review ${action.sourceId}`
    ) {
      return action.apprenticeName
        ? `${action.sourceLabel} · ${action.apprenticeName}`
        : action.sourceLabel;
    }
    return action.apprenticeName
      ? `Progress review · ${action.apprenticeName}`
      : "Progress review";
  }

  const typeLabel: Record<ActionRecord["sourceType"], string> = {
    review: "Review",
    intervention: "Intervention",
    employer_concern: "Employer concern",
    support: "Support",
    attendance: "Attendance",
    evidence: "Evidence gap",
    tutor: "Tutor follow-up",
    epa: "EPA preparation",
    quality: "Quality finding",
    management: "Management",
    programme_recovery: "Programme recovery",
  };

  const base = typeLabel[action.sourceType] ?? action.sourceType;
  if (action.apprenticeName) return `${base} · ${action.apprenticeName}`;
  return action.sourceLabel || base;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Actions from earlier reviews / sources that this meeting should open with.
 * Excludes actions created in the current review.
 */
export function lastCycleActionsForReview(input: {
  apprenticeId: string;
  reviewId: string;
  reviewDate: string;
  actions: ActionRecord[];
}): ActionCycleReview[] {
  return input.actions
    .filter((a) => a.apprenticeId === input.apprenticeId)
    .filter((a) => a.sourceId !== input.reviewId)
    .filter((a) => {
      // Prefer actions that existed by this review date
      if (a.createdAt && a.createdAt > input.reviewDate) return false;
      return true;
    })
    .map((action) => {
      const result = cycleOutcome(action);
      return { action, ...result };
    })
    .sort((a, b) => {
      // Bring-ups first, then incomplete, then done
      const rank = (row: ActionCycleReview) => {
        if (row.bringUpAtNextReview && row.outcome === "no") return 0;
        if (row.bringUpAtNextReview) return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
}
