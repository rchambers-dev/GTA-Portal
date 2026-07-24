import type { MentorReviewRow } from "../../data/mentor-caseload";
import { FORMAL_REVIEWS, REVIEW_REQUIREMENTS } from "./mock-store";
import type { FormalReview, ReviewRequirement } from "./types";

/**
 * Compatibility adapter so Progress Monitoring and priority scoring can keep
 * using MentorReviewRow without a big-bang rewrite.
 */
export function requirementToMentorReviewRow(
  req: ReviewRequirement,
): MentorReviewRow {
  const formal = req.formalReviewId
    ? FORMAL_REVIEWS.find((f) => f.reviewId === req.formalReviewId)
    : undefined;

  let view: MentorReviewRow["view"] = "preparation";
  if (formal) {
    view = formalStageToView(formal);
  } else if (req.queueTab === "ready_to_create") {
    view = "ready";
  } else if (req.queueTab === "upcoming") {
    view = "upcoming";
  } else if (req.queueTab === "overdue_requirement" || req.dueStatus === "overdue") {
    view = "overdue";
  } else if (req.readinessStatus === "ready_to_create") {
    view = "ready";
  } else if (req.readinessStatus === "not_started") {
    view = "upcoming";
  }

  const reflection = req.checklist.find(
    (c) => c.key === "apprentice_reflection_received",
  );
  const employer = req.checklist.find(
    (c) => c.key === "employer_feedback_received",
  );

  return {
    reviewId: req.formalReviewId ?? req.requirementId,
    learnerId: req.learnerId,
    learnerName: req.learnerName,
    employerName: req.employerName,
    programmeName: req.programmeName,
    reviewDate: req.plannedReviewDate,
    reviewType: req.reviewType,
    preparationStatus: readinessToPrep(req),
    apprenticeReflection: stateToContribution(reflection?.state),
    employerFeedback: stateToContribution(employer?.state),
    previousActionsChecked:
      req.checklist.find((c) => c.key === "previous_actions_reviewed")?.state ===
      "complete",
    evidenceReadiness: req.missingItems.length === 0 ? "Ready" : "Gaps",
    reviewStatus: formal?.stage
      ? formalStageLabel(formal.stage)
      : readinessToPrep(req),
    signOffStatus: formal ? signOffLabel(formal) : "Not started",
    view,
  };
}

function formalStageToView(formal: FormalReview): MentorReviewRow["view"] {
  switch (formal.stage) {
    case "completed":
      return "completed";
    case "awaiting_sign_off":
    case "awaiting_employer":
      return "awaiting_employer";
    case "awaiting_apprentice":
      return "awaiting_apprentice";
    case "awaiting_provider":
      return "awaiting_provider";
    case "in_progress":
    case "created":
    case "preparation_continuing":
    case "paused":
    case "returned_for_amendment":
      return "in_progress";
    default:
      return "in_progress";
  }
}

function readinessToPrep(req: ReviewRequirement): string {
  switch (req.readinessStatus) {
    case "ready_to_create":
      return "Ready";
    case "ready_with_warnings":
      return "Ready with warnings";
    case "waiting_for_responses":
      return "Waiting for responses";
    case "blocked":
      return "Blocked";
    case "overdue":
      return "Overdue";
    case "not_started":
      return "Not started";
    default:
      return "In progress";
  }
}

function stateToContribution(state: string | undefined): string {
  switch (state) {
    case "complete":
      return "Received";
    case "requested":
      return "Requested";
    case "missing":
      return "Missing";
    case "overridden":
      return "Overridden";
    default:
      return "Not requested";
  }
}

function formalStageLabel(stage: FormalReview["stage"]): string {
  return stage.replace(/_/g, " ");
}

function signOffLabel(formal: FormalReview): string {
  const { signOff } = formal;
  if (signOff.apprenticeSigned && signOff.employerSigned && signOff.providerSigned) {
    return "Complete";
  }
  if (signOff.amendmentRequested) return "Amendment requested";
  if (!signOff.employerSigned) return "Awaiting employer";
  if (!signOff.apprenticeSigned) return "Awaiting apprentice";
  if (!signOff.providerSigned) return "Awaiting provider";
  return "In progress";
}

/** Active review signal per learner for priority scoring (prefer open formal, else requirement). */
export function buildMentorReviewsAdapter(): MentorReviewRow[] {
  const byLearner = new Map<string, MentorReviewRow>();

  for (const formal of FORMAL_REVIEWS) {
    if (formal.stage === "completed") continue;
    byLearner.set(formal.learnerId, {
      reviewId: formal.reviewId,
      learnerId: formal.learnerId,
      learnerName: formal.learnerName,
      employerName: formal.employerName,
      programmeName: formal.programmeName,
      reviewDate: formal.reviewDate,
      reviewType: formal.reviewType,
      preparationStatus: "In progress",
      apprenticeReflection: "Received",
      employerFeedback: formal.stage.includes("employer") ? "Waiting" : "Received",
      previousActionsChecked: true,
      evidenceReadiness: "Partial",
      reviewStatus: formalStageLabel(formal.stage),
      signOffStatus: signOffLabel(formal),
      view: formalStageToView(formal),
    });
  }

  for (const req of REVIEW_REQUIREMENTS) {
    if (req.formalReviewId) continue;
    if (byLearner.has(req.learnerId)) continue;
    byLearner.set(req.learnerId, requirementToMentorReviewRow(req));
  }

  // Include one completed per learner history for completed view consumers
  for (const formal of FORMAL_REVIEWS) {
    if (formal.stage !== "completed") continue;
    if (byLearner.has(formal.learnerId)) continue;
    byLearner.set(formal.learnerId, {
      reviewId: formal.reviewId,
      learnerId: formal.learnerId,
      learnerName: formal.learnerName,
      employerName: formal.employerName,
      programmeName: formal.programmeName,
      reviewDate: formal.reviewDate,
      reviewType: formal.reviewType,
      preparationStatus: "Complete",
      apprenticeReflection: "Received",
      employerFeedback: "Received",
      previousActionsChecked: true,
      evidenceReadiness: "Ready",
      reviewStatus: "Completed",
      signOffStatus: "Complete",
      view: "completed",
    });
  }

  return [...byLearner.values()];
}
