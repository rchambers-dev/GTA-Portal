import type { CycleDueTone, CycleStepId, StepTone, TutorBand } from "./cycle";
import type { ProgressDraft, TutorFormDraft } from "./tutor-form-rules";

export type CycleStepView = {
  id: CycleStepId;
  label: string;
  tone: StepTone;
  detail: string;
};

export type CycleLearner = {
  gtaId: string;
  name: string;
  tutor: string;
  tutorId: string | null;
  company: string;
  postcode: string;
  programme: string;
  programmeId: string | null;
  managerId: string | null;
  managerName: string;
  collegeDay: string;
  stepId: CycleStepId;
  stepLabel: string;
  timing: string;
  dueChip: string;
  dueTone: CycleDueTone;
  late: boolean;
  daysLeft: number | null;
  reviewCount: number;
  reviewCountLabel: string;
  signedOn: string | null;
  signedLabel: string | null;
  steps: CycleStepView[];
  band: TutorBand;
  packId: string | null;
  packStage: string | null;
  editable: boolean;
  /** Percent of the saved form that is filled, using the Review Assistant checks. */
  fillPercent: number;
  /** Percent still to fill. */
  fillRemaining: number;
  fillStarted: boolean;
  /** Days until the two-week window opens. Null while a break pauses the cycle. */
  noticeDays: number | null;
  paperReturn: boolean;
  paperReturnedOn: string | null;
};

export type CyclePage = {
  today: string;
  learners: CycleLearner[];
  tutors: string[];
  loadError: string | null;
};

export type HistoryRow = {
  id: string;
  packId: string | null;
  number: number;
  reviewer: string;
  plannedOn: string;
  actualOn: string;
  method: string;
  status: string;
  paperReturn: boolean;
};

export type LearnerReviews = {
  gtaId: string;
  today: string;
  steps: CycleStepView[];
  nextDue: string;
  nextDueState: string;
  /** Overdue, Due soon, On track, or Not set. */
  dueLabel: string;
  dueTone: "overdue" | "soon" | "on-track" | "none";
  /** Open review's planned day, YYYY-MM-DD. Null when there is no open review. */
  plannedOn: string | null;
  lastActual: string;
  reviewerId: string | null;
  reviewerName: string;
  reviewers: { id: string; name: string }[];
  method: string | null;
  openReviewId: string | null;
  /** True when this apprentice already has any review, open or completed. */
  hasReview: boolean;
  booked: boolean;
  paperReturn: boolean;
  paperReturnedOn: string | null;
  inBreak: boolean;
  history: HistoryRow[];
  loadError: string | null;
};

/** The last completed review, shown read-only on the left of the tutor form. */
export type PreviousReviewSnapshot = {
  dateLabel: string;
  summary: string;
  comment: string;
  progress: ProgressDraft[];
};

export type DigitalReview = {
  packId: string;
  gtaId: string;
  name: string;
  stage: string;
  editable: boolean;
  intervalWeeks: number;
  today: string;
  section1: { label: string; value: string }[];
  form: TutorFormDraft;
  paperReturnedOn: string | null;
  reviewerNote: string;
  previousReview: PreviousReviewSnapshot | null;
  savedAt: string | null;
  loadError: string | null;
};

export function peersFor(learner: CycleLearner, learners: CycleLearner[]): CycleLearner[] {
  if (!learner.managerId || !learner.programmeId) return [];
  return learners.filter(
    (other) =>
      other.gtaId !== learner.gtaId &&
      other.managerId === learner.managerId &&
      other.programmeId === learner.programmeId,
  );
}
