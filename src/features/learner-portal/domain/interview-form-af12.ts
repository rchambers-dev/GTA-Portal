/**
 * AF1.2 Apprentice Interview Form 25-26 v1.1 (Series 3)
 * Maps to ADM14.0 reference 1.3 — Learner Interview Form.
 * Completed by the GTA interviewer (Part 1); Parts 2–4 are referral requests.
 */

import { useCallback, useEffect, useState } from "react";

export const AF12_FORM_CODE = "AF1.2";
export const AF12_FORM_VERSION = "v1.1";
export const AF12_FORM_TITLE = "Apprentice Interview Form";
export const AF12_ACADEMIC_YEAR = "25-26";
export const AF12_SERIES = "Series 3";
export const AF12_ADM14_REFERENCE = "1.3";

const STORAGE_KEY = "gta-af12-interview-form-v1";
const CHANGE_EVENT = "gta-af12-interview-changed";

export type YesNo = "yes" | "no" | "";
export type Score1to4 = 0 | 1 | 2 | 3 | 4;

export type InterviewOutcome =
  | ""
  | "proceed"
  | "conditional"
  | "reinterview"
  | "not_suitable"
  | "deferred";

export type InterviewFormAf12State = {
  // Header
  interviewDate: string;
  reinterviewDate: string;
  interviewerName: string;
  reinterviewReasons: string;

  // 1. Candidate
  candidateName: string;
  apprenticeshipRoute: string;

  // 1.1 Employer
  employerApplicable: YesNo;
  employerName: string;
  employerContactName: string;
  employerAddress: string;
  employerHsInspectionRequired: YesNo;

  // 2. Eligibility
  enrolmentFormCompleteSignedRtw: YesNo;
  ageEligible16Plus: YesNo;
  identityEvidenceLastFour: string;
  identityPrimarySources: string;
  identitySecondarySources: string;
  residencyRightToWorkComments: string;

  // 3. Professional discussion
  attendedSecondarySchool: YesNo;
  attendedLinkedProgramme: YesNo;
  previousGtaApprenticeship: YesNo;
  previousEducationDetails: string;
  progressFileCertificatesNotes: string;
  healthLearningBarriersNotes: string;
  challengeOvercameNotes: string;

  // 4. Apprenticeship questions (scored)
  q41HowFoundGta: string;
  q41Score: Score1to4;
  q42WhyWantApprenticeship: string;
  q42Score: Score1to4;
  q43Challenges: string;
  q43Score: Score1to4;
  q44ExpectedTasks: string;
  q44Score: Score1to4;
  q45TravelArrangements: string;
  q45Score: Score1to4;
  q46Punctuality: string;
  q46Score: Score1to4;

  // 5. About them (5.1–5.5 scored; 5.6 comments)
  q51InterestsSkills: string;
  q51Score: Score1to4;
  q52GreatestStrength: string;
  q52Score: Score1to4;
  q53DevelopmentArea: string;
  q53Score: Score1to4;
  q54Motivation: string;
  q54Score: Score1to4;
  q55StressResponse: string;
  q55Score: Score1to4;
  q56LearningStyle: string;

  // 6. Interviewer observation (scored)
  q61Confidence: string;
  q61Score: Score1to4;
  q62Attitude: string;
  q62Score: Score1to4;
  q63Appearance: string;
  q63Score: Score1to4;
  q64Conversation: string;
  q64Score: Score1to4;
  q65Aspirations: string;
  q65Score: Score1to4;

  // 7. Initial & diagnostic
  mathsScore: string;
  englishScore: string;
  followingInstructionsScore: string;
  diagnosticTotal: string;

  // 8. RPL
  rpleRelevantPrior: YesNo;
  rpleDetails: string;
  mathsExemptionMet: YesNo;
  mathsExemptionDetails: string;
  englishExemptionMet: YesNo;
  englishExemptionDetails: string;
  highestPriorAttainment: string;
  rplePotentialConfirmation: YesNo;
  rpleConfirmationNotes: string;

  // 9. LLDD
  needsAlsAssessment: YesNo;
  needsHsRiskAssessment: YesNo;

  // 10. Evaluation / outcome
  interviewOutcome: InterviewOutcome;
  summaryNextSteps: string;
  interviewerDeclarationConfirmed: boolean;
  interviewerSignatureName: string;
  signedAt: string | null;
  lastSavedAt: string | null;
};

export const INTERVIEW_OUTCOME_OPTIONS: {
  value: Exclude<InterviewOutcome, "">;
  label: string;
}[] = [
  { value: "proceed", label: "Proceed / offer pathway" },
  { value: "conditional", label: "Conditional — actions required" },
  { value: "reinterview", label: "Re-interview required" },
  { value: "not_suitable", label: "Not suitable at this time" },
  { value: "deferred", label: "Deferred" },
];

export function createEmptyInterviewForm(
  seed?: Partial<
    Pick<
      InterviewFormAf12State,
      | "candidateName"
      | "apprenticeshipRoute"
      | "employerName"
      | "interviewerName"
    >
  >,
): InterviewFormAf12State {
  return {
    interviewDate: "",
    reinterviewDate: "",
    interviewerName: seed?.interviewerName ?? "",
    reinterviewReasons: "",
    candidateName: seed?.candidateName ?? "",
    apprenticeshipRoute: seed?.apprenticeshipRoute ?? "",
    employerApplicable: "",
    employerName: seed?.employerName ?? "",
    employerContactName: "",
    employerAddress: "",
    employerHsInspectionRequired: "",
    enrolmentFormCompleteSignedRtw: "",
    ageEligible16Plus: "",
    identityEvidenceLastFour: "",
    identityPrimarySources: "",
    identitySecondarySources: "",
    residencyRightToWorkComments: "",
    attendedSecondarySchool: "",
    attendedLinkedProgramme: "",
    previousGtaApprenticeship: "",
    previousEducationDetails: "",
    progressFileCertificatesNotes: "",
    healthLearningBarriersNotes: "",
    challengeOvercameNotes: "",
    q41HowFoundGta: "",
    q41Score: 0,
    q42WhyWantApprenticeship: "",
    q42Score: 0,
    q43Challenges: "",
    q43Score: 0,
    q44ExpectedTasks: "",
    q44Score: 0,
    q45TravelArrangements: "",
    q45Score: 0,
    q46Punctuality: "",
    q46Score: 0,
    q51InterestsSkills: "",
    q51Score: 0,
    q52GreatestStrength: "",
    q52Score: 0,
    q53DevelopmentArea: "",
    q53Score: 0,
    q54Motivation: "",
    q54Score: 0,
    q55StressResponse: "",
    q55Score: 0,
    q56LearningStyle: "",
    q61Confidence: "",
    q61Score: 0,
    q62Attitude: "",
    q62Score: 0,
    q63Appearance: "",
    q63Score: 0,
    q64Conversation: "",
    q64Score: 0,
    q65Aspirations: "",
    q65Score: 0,
    mathsScore: "",
    englishScore: "",
    followingInstructionsScore: "",
    diagnosticTotal: "",
    rpleRelevantPrior: "",
    rpleDetails: "",
    mathsExemptionMet: "",
    mathsExemptionDetails: "",
    englishExemptionMet: "",
    englishExemptionDetails: "",
    highestPriorAttainment: "",
    rplePotentialConfirmation: "",
    rpleConfirmationNotes: "",
    needsAlsAssessment: "",
    needsHsRiskAssessment: "",
    interviewOutcome: "",
    summaryNextSteps: "",
    interviewerDeclarationConfirmed: false,
    interviewerSignatureName: "",
    signedAt: null,
    lastSavedAt: null,
  };
}

function sumScores(scores: Score1to4[]) {
  return scores.reduce<number>((n, s) => n + (s || 0), 0);
}

export function interviewSectionScores(state: InterviewFormAf12State) {
  const section4 = sumScores([
    state.q41Score,
    state.q42Score,
    state.q43Score,
    state.q44Score,
    state.q45Score,
    state.q46Score,
  ]);
  const section5 = sumScores([
    state.q51Score,
    state.q52Score,
    state.q53Score,
    state.q54Score,
    state.q55Score,
  ]);
  const section6 = sumScores([
    state.q61Score,
    state.q62Score,
    state.q63Score,
    state.q64Score,
    state.q65Score,
  ]);
  return {
    section4,
    section5,
    section6,
    interviewTotal: section4 + section5 + section6,
    max4: 24,
    max5: 20,
    max6: 20,
    maxInterview: 64,
  };
}

export type InterviewFormProgress = {
  status: "not_started" | "in_progress" | "complete";
  percent: number;
};

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

export function getInterviewFormProgress(
  state: InterviewFormAf12State,
): InterviewFormProgress {
  if (state.signedAt) {
    return { status: "complete", percent: 100 };
  }
  const checks = [
    hasText(state.interviewDate),
    hasText(state.interviewerName),
    hasText(state.candidateName),
    hasText(state.apprenticeshipRoute),
    state.enrolmentFormCompleteSignedRtw !== "",
    state.ageEligible16Plus !== "",
    hasText(state.identityPrimarySources) ||
      hasText(state.identitySecondarySources),
    state.interviewOutcome !== "",
    state.interviewerDeclarationConfirmed,
    hasText(state.interviewerSignatureName),
  ];
  const filled = checks.filter(Boolean).length;
  const percent = Math.round((filled / checks.length) * 100);
  return {
    status: filled === 0 ? "not_started" : "in_progress",
    percent,
  };
}

export function canSubmitInterviewForm(state: InterviewFormAf12State): boolean {
  return (
    hasText(state.interviewDate) &&
    hasText(state.interviewerName) &&
    hasText(state.candidateName) &&
    hasText(state.apprenticeshipRoute) &&
    state.enrolmentFormCompleteSignedRtw !== "" &&
    state.ageEligible16Plus !== "" &&
    state.interviewOutcome !== "" &&
    state.interviewerDeclarationConfirmed &&
    hasText(state.interviewerSignatureName) &&
    !state.signedAt
  );
}

export function getStoredInterviewForm(): InterviewFormAf12State | null {
  return readStored();
}

function readStored(): InterviewFormAf12State | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InterviewFormAf12State;
  } catch {
    return null;
  }
}

function writeStored(state: InterviewFormAf12State) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeAf12InterviewStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getAf12InterviewSnapshot(): string {
  if (typeof window === "undefined") return "server";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function seedInterviewFormForAlex(): InterviewFormAf12State {
  return createEmptyInterviewForm({
    candidateName: "Alex Morgan",
    apprenticeshipRoute: "Auto-Care Technician Level 2",
    employerName: "Riverside Autocare",
    interviewerName: "Reiss Chambers",
  });
}

export function useInterviewFormAf12State(seed?: InterviewFormAf12State) {
  const [state, setState] = useState<InterviewFormAf12State>(
    () => seed ?? seedInterviewFormForAlex(),
  );

  useEffect(() => {
    const stored = readStored();
    if (stored) setState(stored);
  }, []);

  const patch = useCallback((partial: Partial<InterviewFormAf12State>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const persist = useCallback(() => {
    setState((prev) => {
      const withStamp = {
        ...prev,
        lastSavedAt: new Date().toISOString(),
      };
      writeStored(withStamp);
      return withStamp;
    });
  }, []);

  const submit = useCallback(() => {
    setState((prev) => {
      if (!canSubmitInterviewForm(prev)) return prev;
      const signed: InterviewFormAf12State = {
        ...prev,
        signedAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
      };
      writeStored(signed);
      return signed;
    });
  }, []);

  return {
    state,
    patch,
    persist,
    submit,
    progress: getInterviewFormProgress(state),
    scores: interviewSectionScores(state),
  };
}

export function getAf12DocumentsStatus():
  | "not_started"
  | "in_progress"
  | "complete" {
  const stored = readStored();
  if (!stored) return "not_started";
  return getInterviewFormProgress(stored).status;
}
