import type { ReviewState } from "./state-store";

/** Fields a tutor may change on a review they already hold. Matches api/tutor-state.js. */
export const TUTOR_WRITABLE_REVIEW_FIELDS = [
  "status",
  "targets",
  "progress",
  "evidence",
  "achievedHours",
  "otjHours",
  "notPresent",
  "notPresentReason",
  "returnedAttachment",
  "tutorNotes",
  "tutorSignature",
  "tutorSignedAt",
] as const;

function allowedLearner(id: unknown, allowedIds: ReadonlySet<string>) {
  return allowedIds.has(String(id || ""));
}

/** Visibility follows canonical apprentice ids. The tutor name on a row is not permission. */
export function filterStateForTutor(state: ReviewState, allowedIds: ReadonlySet<string>): ReviewState {
  const learners = (state.learners || []).filter((learner) => allowedLearner(learner.id, allowedIds));
  const learnerIds = new Set(learners.map((learner) => learner.id).filter(Boolean));
  const sameCaseload = (learner: Record<string, unknown>) => allowedLearner(learner.id, allowedIds);
  return {
    ...state,
    learners,
    savedReviews: (state.savedReviews || []).filter((review) => learnerIds.has(review.learnerId)),
    followUps: (state.followUps || []).filter(sameCaseload),
    archive: (state.archive || []).filter(sameCaseload),
    analyticsEvents: (state.analyticsEvents || []).filter((event) =>
      learnerIds.has(event.learnerId),
    ),
    settings: {
      ...(state.settings || {}),
      email: "",
      officePostcode: "",
      workingDates: [],
      plannedDatesCleared: false,
      blockedTutors: [],
      customTutors: [],
    },
    acceptedRoutes: {},
    verifiedByDate: {},
    callAnchors: {},
    pinnedRoutes: {},
    frozenTimes: {},
    excludedFromDate: {},
    completedRoutes: {},
    awaitingReply: {},
    awaitingClearedAt: {},
    visitDays: {},
    tutorFeedback: [],
  };
}

export async function mergeTutorReviewUpdates(
  fullState: ReviewState,
  updates: ReviewState,
  allowedIds: ReadonlySet<string>,
  allowAttachment: (id: string, learnerId: string) => boolean | Promise<boolean> = () => false,
) {
  if (!updates.savedReviews) return fullState;
  const reviewsById = new Map((fullState.savedReviews || []).map((review) => [review.id, review]));
  for (const update of updates.savedReviews) {
    if (!update.id) continue;
    const existing = reviewsById.get(update.id);
    if (!existing || !allowedIds.has(String(existing.learnerId || ""))) continue;
    const validated: Record<string, unknown> = {};
    for (const field of TUTOR_WRITABLE_REVIEW_FIELDS) {
      if (field in update) validated[field] = update[field];
    }
    if (Object.keys(validated).length === 0) {
      const error = new Error("No valid fields to update.");
      (error as Error & { status: number }).status = 400;
      throw error;
    }
    const returned = validated.returnedAttachment as { id?: string } | undefined;
    if (returned?.id && !(await allowAttachment(returned.id, String(existing.learnerId || "")))) {
      const error = new Error("That attachment is not bound to this learner.");
      (error as Error & { status: number }).status = 403;
      throw error;
    }
    reviewsById.set(update.id, { ...existing, ...validated });
  }
  return { ...fullState, savedReviews: Array.from(reviewsById.values()) };
}

export function learnerAssignedToTutor(allowedIds: ReadonlySet<string>, learnerId: string) {
  return Boolean(learnerId) && allowedIds.has(learnerId);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * A tutor save may change reviews for their canonical apprentices only.
 * Every other learner and review in the shared document must stay as stored.
 */
export function tutorScopeError(
  before: ReviewState,
  after: ReviewState,
  allowedIds: ReadonlySet<string>,
) {
  for (const listName of ["learners", "followUps", "archive"] as const) {
    const previous = before[listName] || [];
    const next = after[listName] || [];
    for (const item of previous) {
      if (allowedIds.has(String(item?.id || ""))) continue;
      const found = next.find((candidate) => candidate?.id === item?.id);
      if (!sameJson(found, item)) return "You can only update reviews for your assigned apprentices.";
    }
    for (const item of next) {
      if (allowedIds.has(String(item?.id || ""))) continue;
      if (!previous.some((candidate) => candidate?.id === item?.id)) {
        return "Choose a Portal apprentice. This screen does not create one.";
      }
    }
  }
  const previousReviews = new Map((before.savedReviews || []).map((review) => [review.id, review]));
  for (const review of after.savedReviews || []) {
    const prior = previousReviews.get(review.id);
    if (!prior) {
      if (!allowedIds.has(String(review.learnerId || ""))) {
        return "Choose a Portal apprentice. This screen does not create one.";
      }
      continue;
    }
    if (!sameJson(prior, review) && !allowedIds.has(String(prior.learnerId || ""))) {
      return "You can only update reviews for your assigned apprentices.";
    }
  }
  for (const review of before.savedReviews || []) {
    if (allowedIds.has(String(review.learnerId || ""))) continue;
    const next = (after.savedReviews || []).find((item) => item.id === review.id);
    if (!sameJson(next, review)) return "You can only update reviews for your assigned apprentices.";
  }
  return null;
}

const ATTACHMENT_FIELDS = ["attachment", "previousAttachment", "returnedAttachment"] as const;

export function reviewsReferencingAttachment(state: ReviewState, attachmentId: string) {
  return (state.savedReviews || []).filter((item) =>
    ATTACHMENT_FIELDS.some((field) => {
      const attachment = item[field] as { id?: string } | undefined;
      return attachment?.id === attachmentId;
    }),
  );
}

export function tutorMayReadAttachment(
  allowedIds: ReadonlySet<string>,
  binding: { learnerId?: string; portalApprenticeId?: string | null } | null,
) {
  if (!binding?.learnerId && !binding?.portalApprenticeId) return false;
  const canonical = String(binding.portalApprenticeId || "");
  const reviewLearnerId = String(binding.learnerId || "");
  return (
    (canonical && allowedIds.has(canonical)) ||
    (reviewLearnerId && allowedIds.has(reviewLearnerId))
  );
}
