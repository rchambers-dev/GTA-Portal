import type { MentorLearnerRow, MentorReviewRow } from "../data/mentor-caseload";
import {
  MENTOR_ACTIONS,
  MENTOR_INTERVENTIONS,
  MENTOR_REVIEWS,
  variance,
} from "../data/mentor-work-items";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

const FROM_PM = "from=progress-monitoring";

function learnerTabHref(learnerId: string, tab: string): string {
  return `/learners/${learnerId}?tab=${tab}&${FROM_PM}`;
}

export type PriorityBand =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "on_track";

export type NextActionKey =
  | "create_intervention"
  | "review_intervention"
  | "prepare_review"
  | "contact_employer"
  | "request_evidence"
  | "attendance_follow_up"
  | "recover_programme"
  | "epa_readiness"
  | "monitor"
  | "no_action";

export type ReasonTone = "critical" | "warning" | "info" | "positive";

export type PriorityReason = {
  label: string;
  tone: ReasonTone;
  /** Permission required to action this factor; when the user lacks it the chip is not a link. */
  permission?: string;
  /** Destination for the responsible team to action this factor. */
  href?: string;
};

export type AttendanceTrend = "falling" | "stable" | "rising" | "unknown";

export type ReviewColumnStatus =
  | "ready"
  | "preparation"
  | "awaiting_employer"
  | "overdue"
  | "completed"
  | "none";

export type ProgressLearnerView = {
  learner: MentorLearnerRow;
  variance: number;
  priorityScore: number;
  priorityBand: PriorityBand;
  reasons: PriorityReason[];
  nextAction: NextActionKey;
  nextActionLabel: string;
  reviewStatus: ReviewColumnStatus;
  reviewId: string | null;
  interventionStatus: string | null;
  interventionId: string | null;
  employerActionsOverdue: number;
  concernCaseId: string | null;
  attendanceTrend: AttendanceTrend;
  programmeShort: string;
};

const BAND_ORDER: Record<PriorityBand, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  on_track: 4,
};

export function priorityBandLabel(band: PriorityBand): string {
  switch (band) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "on_track":
      return "On Track";
  }
}

export function priorityBandTone(
  band: PriorityBand,
): "red" | "orange" | "amber" | "green" | "blue" | "neutral" {
  switch (band) {
    case "critical":
      return "red";
    case "high":
      return "orange";
    case "medium":
      return "amber";
    case "low":
      return "blue";
    case "on_track":
      return "green";
  }
}

export function scoreToBand(score: number): PriorityBand {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "on_track";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function programmeShortName(name: string): string {
  return name
    .replace(/\bLevel\b/gi, "L")
    .replace(/\bTechnician\b/gi, "Tech")
    .replace(/\bEngineering\b/gi, "Eng")
    .replace(/\bApprenticeship\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function reviewForLearner(learnerId: string): MentorReviewRow | undefined {
  const reviews = MENTOR_REVIEWS.filter((r) => r.learnerId === learnerId);
  if (reviews.length === 0) return undefined;
  const overdue = reviews.find((r) => r.view === "overdue");
  if (overdue) return overdue;
  const prep = reviews.find((r) => r.view === "preparation");
  if (prep) return prep;
  const awaiting = reviews.find((r) => r.view.startsWith("awaiting"));
  if (awaiting) return awaiting;
  const ready = reviews.find((r) => r.view === "ready");
  if (ready) return ready;
  return reviews[0];
}

function mapReviewStatus(view: MentorReviewRow["view"] | undefined): ReviewColumnStatus {
  if (!view) return "none";
  if (view === "overdue") return "overdue";
  if (view === "preparation") return "preparation";
  if (view === "ready") return "ready";
  if (view === "completed") return "completed";
  if (view.startsWith("awaiting")) return "awaiting_employer";
  return "preparation";
}

function attendanceTrendFor(learner: MentorLearnerRow): AttendanceTrend {
  if (learner.attendancePercent == null) return "unknown";
  if (learner.attendancePercent < 85) return "falling";
  if (learner.attendancePercent >= 95) return "stable";
  if (learner.riskStatus === "slightly_behind") return "falling";
  return "rising";
}

function nextActionFor(input: {
  learner: MentorLearnerRow;
  variance: number;
  reviewStatus: ReviewColumnStatus;
  interventionStatus: string | null;
  employerActionsOverdue: number;
}): { key: NextActionKey; label: string } {
  const { learner, variance, reviewStatus, interventionStatus, employerActionsOverdue } =
    input;

  if (learner.programmeOverdue) {
    return { key: "recover_programme", label: "Recover programme" };
  }
  if (learner.employerConcernStatus === "urgent") {
    return { key: "contact_employer", label: "Contact employer" };
  }
  if (reviewStatus === "overdue") {
    return { key: "prepare_review", label: "Prepare review" };
  }
  if (learner.missingMandatoryEvidence > 0) {
    return { key: "request_evidence", label: "Request evidence" };
  }
  if (
    learner.attendancePercent != null &&
    learner.attendancePercent < 85
  ) {
    return { key: "attendance_follow_up", label: "Attendance follow-up" };
  }
  if (
    interventionStatus === "escalated" ||
    interventionStatus === "due_checkpoint"
  ) {
    return { key: "review_intervention", label: "Review intervention" };
  }
  if (
    variance <= -10 &&
    !learner.interventionId
  ) {
    return { key: "create_intervention", label: "Create intervention" };
  }
  if (reviewStatus === "preparation" || reviewStatus === "ready") {
    return { key: "prepare_review", label: "Prepare review" };
  }
  if (employerActionsOverdue > 0 || learner.employerConcernStatus === "open") {
    return { key: "contact_employer", label: "Contact employer" };
  }
  if (learner.epaApproaching) {
    return { key: "epa_readiness", label: "EPA readiness" };
  }
  if (learner.riskStatus === "on_track" && variance >= -2) {
    return { key: "no_action", label: "No action required" };
  }
  return { key: "monitor", label: "Monitor" };
}

/**
 * Weighted operational priority score (0–100).
 * Higher = needs attention first.
 */
export function calculatePriorityScore(learner: MentorLearnerRow): {
  score: number;
  reasons: PriorityReason[];
} {
  let score = 0;
  const reasons: PriorityReason[] = [];
  const v = variance(learner.plannedProgressPercent, learner.actualProgressPercent);
  const id = learner.learnerId;

  if (learner.programmeOverdue) {
    score += 25;
    reasons.push({
      label: "Programme overdue",
      tone: "critical",
      permission: PERMISSIONS.INTERVENTIONS_MANAGE,
      href: learnerTabHref(id, "interventions"),
    });
  }

  if (v < 0) {
    const variancePoints = clamp(Math.round(Math.abs(v) * 1.2), 0, 20);
    score += variancePoints;
    reasons.push({
      label: `${Math.abs(v)}% behind planned progress`,
      tone: v <= -10 ? "critical" : "warning",
      permission: PERMISSIONS.INTERVENTIONS_MANAGE,
      href: learnerTabHref(id, "progress"),
    });
  } else if (v > 3) {
    reasons.push({ label: `${v}% ahead of plan`, tone: "positive" });
  }

  if (learner.attendancePercent != null) {
    if (learner.attendancePercent < 70) {
      score += 15;
      reasons.push({
        label: `Attendance ${learner.attendancePercent}%`,
        tone: "critical",
        permission: PERMISSIONS.ATTENDANCE_CONCERNS_VIEW,
        href: learnerTabHref(id, "attendance"),
      });
    } else if (learner.attendancePercent < 85) {
      score += 10;
      reasons.push({
        label: `Attendance ${learner.attendancePercent}%`,
        tone: "warning",
        permission: PERMISSIONS.ATTENDANCE_CONCERNS_VIEW,
        href: learnerTabHref(id, "attendance"),
      });
    } else if (learner.attendancePercent < 90) {
      score += 4;
    }
  }

  if (learner.missingMandatoryEvidence > 0) {
    score += clamp(learner.missingMandatoryEvidence * 5, 0, 15);
    reasons.push({
      label: `Mandatory evidence gaps: ${learner.missingMandatoryEvidence}`,
      tone: learner.missingMandatoryEvidence >= 3 ? "critical" : "warning",
      permission: PERMISSIONS.LEARNER_WORKSPACE_VIEW,
      href: learnerTabHref(id, "evidence"),
    });
  }

  const intervention = MENTOR_INTERVENTIONS.find(
    (i) => i.learnerId === learner.learnerId && i.status !== "completed",
  );
  if (intervention) {
    const href = `/interventions/${intervention.interventionId}?${FROM_PM}`;
    if (intervention.status === "escalated") {
      score += 12;
      reasons.push({
        label: `${intervention.type} — escalated`,
        tone: "critical",
        permission: PERMISSIONS.INTERVENTIONS_MANAGE,
        href,
      });
    } else if (intervention.status === "due_checkpoint") {
      score += 10;
      reasons.push({
        label: `${intervention.type} — checkpoint due`,
        tone: "warning",
        permission: PERMISSIONS.INTERVENTIONS_MANAGE,
        href,
      });
    } else {
      score += 5;
      reasons.push({
        label: `${intervention.type} active`,
        tone: intervention.status === "improving" ? "positive" : "info",
        permission: PERMISSIONS.INTERVENTIONS_MANAGE,
        href,
      });
    }
  } else if (v <= -10 || learner.programmeOverdue) {
    score += 8;
    reasons.push({
      label: "No intervention recorded",
      tone: "critical",
      permission: PERMISSIONS.INTERVENTIONS_MANAGE,
      href: learnerTabHref(id, "interventions"),
    });
  }

  const review = reviewForLearner(learner.learnerId);
  if (review?.view === "overdue") {
    score += 12;
    reasons.push({
      label: "Review overdue",
      tone: "critical",
      permission: PERMISSIONS.REVIEWS_MANAGE,
      href: `/reviews/${review.reviewId}?${FROM_PM}`,
    });
  } else if (review?.view === "preparation") {
    score += 5;
    reasons.push({
      label: "Review preparation required",
      tone: "warning",
      permission: PERMISSIONS.REVIEWS_MANAGE,
      href: `/reviews/${review.reviewId}?${FROM_PM}`,
    });
  }

  if (learner.employerConcernStatus === "urgent") {
    score += 15;
    reasons.push({
      label: "Urgent employer concern",
      tone: "critical",
      permission: PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
      href: `/employer-concerns?${FROM_PM}&learner=${id}`,
    });
  } else if (learner.employerConcernStatus === "open") {
    score += 10;
    reasons.push({
      label: "Open employer concern",
      tone: "warning",
      permission: PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
      href: `/employer-concerns?${FROM_PM}&learner=${id}`,
    });
  } else if (learner.employerConcernStatus === "monitoring") {
    score += 5;
    reasons.push({
      label: "Employer concern monitoring",
      tone: "info",
      permission: PERMISSIONS.EMPLOYER_CONCERNS_MANAGE,
      href: `/employer-concerns?${FROM_PM}&learner=${id}`,
    });
  }

  if (learner.epaApproaching) {
    score += 8;
    reasons.push({
      label: "EPA approaching",
      tone: "info",
      permission: PERMISSIONS.LEARNER_WORKSPACE_VIEW,
      href: learnerTabHref(id, "epa"),
    });
  }

  const employerOverdue = MENTOR_ACTIONS.filter(
    (a) =>
      a.learnerId === learner.learnerId &&
      a.ownerType === "employer" &&
      a.status === "overdue",
  ).length;
  if (employerOverdue > 0) {
    score += clamp(employerOverdue * 5, 0, 10);
    reasons.push({
      label: `Employer actions overdue: ${employerOverdue}`,
      tone: "warning",
      permission: PERMISSIONS.ACTIONS_MANAGE,
      href: `/actions?${FROM_PM}&learner=${id}`,
    });
  }

  if (learner.status === "pre_start") {
    score = Math.max(score - 15, 5);
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    reasons: reasons.slice(0, 6),
  };
}

export function buildProgressLearnerViews(
  learners: MentorLearnerRow[],
): ProgressLearnerView[] {
  return learners.map((learner) => {
    const v = variance(
      learner.plannedProgressPercent,
      learner.actualProgressPercent,
    );
    const { score, reasons } = calculatePriorityScore(learner);
    const band = scoreToBand(score);
    const review = reviewForLearner(learner.learnerId);
    const reviewStatus = mapReviewStatus(review?.view);
    const intervention = MENTOR_INTERVENTIONS.find(
      (i) => i.learnerId === learner.learnerId && i.status !== "completed",
    );
    const employerActionsOverdue = MENTOR_ACTIONS.filter(
      (a) =>
        a.learnerId === learner.learnerId &&
        a.ownerType === "employer" &&
        a.status === "overdue",
    ).length;
    const action = nextActionFor({
      learner,
      variance: v,
      reviewStatus,
      interventionStatus: intervention?.status ?? null,
      employerActionsOverdue,
    });

    return {
      learner,
      variance: v,
      priorityScore: score,
      priorityBand: band,
      reasons,
      nextAction: action.key,
      nextActionLabel: action.label,
      reviewStatus,
      reviewId: review?.reviewId ?? null,
      interventionStatus: intervention?.status ?? null,
      interventionId: intervention?.interventionId ?? learner.interventionId,
      employerActionsOverdue,
      concernCaseId:
        learner.employerConcernStatus !== "none"
          ? `concern-${learner.learnerId}`
          : null,
      attendanceTrend: attendanceTrendFor(learner),
      programmeShort: programmeShortName(learner.programmeName),
    };
  });
}

export function sortByOperationalPriority(
  rows: ProgressLearnerView[],
): ProgressLearnerView[] {
  return [...rows].sort((a, b) => {
    const bandDiff = BAND_ORDER[a.priorityBand] - BAND_ORDER[b.priorityBand];
    if (bandDiff !== 0) return bandDiff;
    return b.priorityScore - a.priorityScore;
  });
}

export function nextActionHref(
  row: ProgressLearnerView,
): string {
  const id = row.learner.learnerId;
  const from = "from=progress-monitoring";
  switch (row.nextAction) {
    case "prepare_review":
      return row.reviewId
        ? `/reviews/${row.reviewId}?${from}`
        : `/learners/${id}?tab=reviews&${from}`;
    case "review_intervention":
    case "create_intervention":
    case "recover_programme":
      return row.interventionId
        ? `/interventions/${row.interventionId}?${from}`
        : `/learners/${id}?tab=interventions&${from}`;
    case "contact_employer":
      return row.concernCaseId
        ? `/employer-concerns/${row.concernCaseId}?${from}`
        : `/learners/${id}?tab=employer&${from}`;
    case "request_evidence":
      return `/learners/${id}?tab=evidence&${from}`;
    case "attendance_follow_up":
      return `/learners/${id}?tab=attendance&${from}`;
    case "epa_readiness":
      return `/learners/${id}?tab=epa&${from}`;
    default:
      return `/learners/${id}?tab=progress&${from}`;
  }
}

export function learnerOpenHref(row: ProgressLearnerView): string {
  const id = row.learner.learnerId;
  if (row.learner.missingMandatoryEvidence > 0) {
    return `/learners/${id}?tab=evidence&from=progress-monitoring`;
  }
  if (
    row.learner.attendancePercent != null &&
    row.learner.attendancePercent < 85
  ) {
    return `/learners/${id}?tab=attendance&from=progress-monitoring`;
  }
  if (row.reviewStatus === "overdue" || row.reviewStatus === "preparation") {
    return `/learners/${id}?tab=reviews&from=progress-monitoring`;
  }
  return `/learners/${id}?from=progress-monitoring`;
}
