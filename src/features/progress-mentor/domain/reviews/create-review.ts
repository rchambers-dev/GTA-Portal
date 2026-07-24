import { MENTOR_ID, MENTOR_LEARNERS, MENTOR_NAME } from "../../data/mentor-caseload";
import { canCreateReview } from "./readiness";
import { buildReviewNarrative } from "./review-content";
import { buildSignOffState } from "./sign-off";
import {
  addFormalReview,
  getRequirement,
  snapshotFromLearner,
  updateRequirement,
} from "./mock-store";
import type { FormalReview, SoftOverride } from "./types";

export type CreateReviewResult =
  | { ok: true; reviewId: string }
  | { ok: false; error: string; blocking: string[] };

/**
 * Create a formal review from a ready requirement.
 * Snapshots preparation evidence; does not mutate live learner progress.
 */
export function createFormalReviewFromRequirement(
  requirementId: string,
  opts?: {
    overrideReason?: string;
    softOverrides?: SoftOverride[];
  },
): CreateReviewResult {
  const requirement = getRequirement(requirementId);
  if (!requirement) {
    return { ok: false, error: "Review requirement not found.", blocking: [] };
  }
  if (requirement.formalReviewId) {
    return {
      ok: false,
      error: "A formal review already exists for this requirement.",
      blocking: [],
    };
  }

  const checklist = requirement.checklist.map((item) => {
    const override = opts?.softOverrides?.find((o) => o.itemKey === item.key);
    if (override && !item.hard) {
      return { ...item, state: "overridden" as const, reason: override.reason };
    }
    return item;
  });

  const gate = canCreateReview(checklist);
  if (!gate.allowed) {
    return {
      ok: false,
      error: "Hard preparation requirements are incomplete.",
      blocking: gate.blocking,
    };
  }

  if (gate.warnings.length > 0 && !opts?.overrideReason) {
    return {
      ok: false,
      error:
        "Soft warnings remain. Provide an override reason to create with warnings.",
      blocking: gate.warnings,
    };
  }

  const learner = MENTOR_LEARNERS.find((l) => l.learnerId === requirement.learnerId);
  if (!learner) {
    return { ok: false, error: "Learner not found.", blocking: [] };
  }

  const reviewId = `rev-created-${requirement.requirementId}`;
  const now = new Date().toISOString();
  const updatedRequirement = {
    ...requirement,
    checklist,
    overrides: [
      ...requirement.overrides,
      ...(opts?.softOverrides ?? []).map((o) => ({
        ...o,
        reason: opts?.overrideReason ?? o.reason,
      })),
    ],
  };

  const narrative = buildReviewNarrative(learner, updatedRequirement);

  const review: FormalReview = {
    reviewId,
    requirementId: requirement.requirementId,
    learnerId: requirement.learnerId,
    learnerName: requirement.learnerName,
    employerId: requirement.employerId,
    employerName: requirement.employerName,
    programmeName: requirement.programmeName,
    mentorName: requirement.mentorName,
    tutorName: learner.tutorName,
    reviewDate: requirement.plannedReviewDate,
    reviewType: requirement.reviewType,
    previousReviewId: requirement.previousReviewId,
    stage: "created",
    progressPercent: 5,
    lastEditedAt: now,
    lastEditedBy: MENTOR_NAME,
    missingSections: ["Discussion", "Actions", "Judgement", "Sign-off"],
    signOff: buildSignOffState({
      learner,
      tutorName: learner.tutorName,
      reviewDate: requirement.plannedReviewDate,
      stage: "created",
    }),
    snapshot: snapshotFromLearner(learner, updatedRequirement),
    liveProgress: {
      plannedProgressPercent: learner.plannedProgressPercent,
      actualProgressPercent: learner.actualProgressPercent,
      attendancePercent: learner.attendancePercent,
    },
    participants: [
      requirement.learnerName,
      MENTOR_NAME,
      requirement.employerName,
      learner.tutorName,
    ],
    progressJudgement: null,
    discussionNotes: narrative.discussionNotes,
    barriersNotes: narrative.barriersNotes,
    wellbeingNotes: narrative.wellbeingNotes,
    learningFocus: narrative.learningFocus,
    employerWorkplaceNotes: narrative.employerWorkplaceNotes,
    actionsCreated: 0,
    nextReviewDate: null,
    completedBy: null,
    completedAt: null,
    audit: [
      {
        at: now,
        userId: MENTOR_ID,
        userName: MENTOR_NAME,
        action: "created",
        detail: opts?.overrideReason
          ? `Created with soft-warning override: ${opts.overrideReason}`
          : "Created from ready requirement",
      },
      ...(opts?.softOverrides ?? []).map((o) => ({
        at: o.at,
        userId: o.userId,
        userName: o.userName,
        action: "soft_override",
        detail: `${o.itemKey}: ${o.reason}`,
      })),
    ],
    readOnly: false,
    originalDueDate: requirement.plannedReviewDate,
    daysOverdue: null,
    escalationStatus: null,
    rearrangeCount: 0,
  };

  addFormalReview(review);
  updateRequirement(requirementId, {
    formalReviewId: reviewId,
    checklist,
    overrides: updatedRequirement.overrides,
    queueTab: "needs_creating",
  });

  return { ok: true, reviewId };
}
