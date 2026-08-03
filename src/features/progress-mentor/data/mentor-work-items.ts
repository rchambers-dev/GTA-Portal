import {
  MENTOR_APPRENTICES,
  type MentorActionRow,
  type MentorConcernRow,
  type MentorInterventionRow,
  type MentorMessageRow,
  type MentorReviewRow,
} from "./mentor-caseload";
import { buildMentorReviewsAdapter } from "../domain/reviews/adapter";
import {
  ACTION_RECORDS,
  toLegacyMentorAction,
} from "../domain/actions/mock-store";

/** Compatibility view over ReviewRequirement + FormalReview for Progress Monitoring. */
export const MENTOR_REVIEWS: MentorReviewRow[] = buildMentorReviewsAdapter();

export const MENTOR_ACTIONS: MentorActionRow[] = ACTION_RECORDS.map(
  toLegacyMentorAction,
);

/** Live caseload will populate these — no fictional people. */
export const MENTOR_INTERVENTIONS: MentorInterventionRow[] = [];
export const MENTOR_CONCERNS: MentorConcernRow[] = [];
export const MENTOR_MESSAGES: MentorMessageRow[] = [];

export function getApprenticeById(id: string) {
  return MENTOR_APPRENTICES.find((l) => l.apprenticeId === id);
}

export function variance(planned: number, actual: number): number {
  return actual - planned;
}
