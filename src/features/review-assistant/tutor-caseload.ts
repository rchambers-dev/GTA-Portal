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

type KeyOf = (value: string) => string;

function learnersFor(state: ReviewState, tutorKey: string, keyOf: KeyOf) {
  return (state.learners || []).filter((learner) => keyOf(String(learner.tutor || "")) === tutorKey);
}

export function filterStateForTutor(state: ReviewState, tutorKey: string, keyOf: KeyOf): ReviewState {
  const learners = learnersFor(state, tutorKey, keyOf);
  const learnerIds = new Set(learners.map((learner) => learner.id).filter(Boolean));
  const sameTutor = (learner: Record<string, unknown>) =>
    keyOf(String(learner.tutor || "")) === tutorKey;
  return {
    ...state,
    learners,
    savedReviews: (state.savedReviews || []).filter((review) => learnerIds.has(review.learnerId)),
    followUps: (state.followUps || []).filter(sameTutor),
    archive: (state.archive || []).filter(sameTutor),
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

function learnerIdsForTutor(state: ReviewState, tutorKey: string, keyOf: KeyOf) {
  const ids = new Set<unknown>();
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const learner of list || []) {
      if (learner?.id && keyOf(String(learner.tutor || "")) === tutorKey) ids.add(learner.id);
    }
  }
  return ids;
}

export function mergeTutorReviewUpdates(
  fullState: ReviewState,
  updates: ReviewState,
  tutorKey: string,
  keyOf: KeyOf,
  allowAttachment: (id: string, learnerId: string) => boolean = () => false,
) {
  const learnerIds = learnerIdsForTutor(fullState, tutorKey, keyOf);
  if (!updates.savedReviews) return fullState;
  const reviewsById = new Map((fullState.savedReviews || []).map((review) => [review.id, review]));
  for (const update of updates.savedReviews) {
    if (!update.id) continue;
    const existing = reviewsById.get(update.id);
    if (!existing || !learnerIds.has(existing.learnerId)) continue;
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
    if (returned?.id && !allowAttachment(returned.id, String(existing.learnerId || ""))) {
      const error = new Error("That attachment is not bound to this learner.");
      (error as Error & { status: number }).status = 403;
      throw error;
    }
    reviewsById.set(update.id, { ...existing, ...validated });
  }
  return { ...fullState, savedReviews: Array.from(reviewsById.values()) };
}

export function learnerAssignedToTutor(
  state: ReviewState,
  tutorKey: string,
  learnerId: string,
  keyOf: KeyOf,
) {
  if (!tutorKey || !learnerId) return false;
  for (const list of [state.learners, state.followUps, state.archive]) {
    const learner = (list || []).find((item) => item?.id === learnerId);
    if (!learner) continue;
    return keyOf(String(learner.tutor || "")) === tutorKey;
  }
  return false;
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
  state: ReviewState,
  tutorKey: string,
  attachmentId: string,
  keyOf: KeyOf,
  binding: { learnerId?: string; actorId?: string } | null,
) {
  if (!binding?.learnerId) return false;
  if (!learnerAssignedToTutor(state, tutorKey, binding.learnerId, keyOf)) return false;
  return reviewsReferencingAttachment(state, attachmentId).every(
    (review) => review.learnerId === binding.learnerId,
  );
}
