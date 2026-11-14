import type { CycleStepId, StepTone, TutorBand } from "./cycle";
import type { TutorFormDraft } from "./tutor-form-rules";

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
};

export type LearnerReviews = {
  gtaId: string;
  today: string;
  steps: CycleStepView[];
  nextDue: string;
  nextDueState: string;
  lastActual: string;
  reviewerId: string | null;
  reviewerName: string;
  reviewers: { id: string; name: string }[];
  method: string | null;
  openReviewId: string | null;
  booked: boolean;
  inBreak: boolean;
  history: HistoryRow[];
  loadError: string | null;
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
