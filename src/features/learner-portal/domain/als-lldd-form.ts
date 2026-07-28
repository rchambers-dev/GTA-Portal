/**
 * AF1.2 attached LLDD / ALS pack (Parts 2–4) — lives on ADM14 1.7,
 * not on the interview form (AF1.2 Part 1 / ADM14 1.3).
 *
 * Part 2: Learning Assessment Request (LLDD / ALS)
 * Part 3: Employer Health and Safety visit request
 * Part 4: H&S Risk Assessment Request (LLDD)
 * (Guidance page from the PDF is omitted.)
 */

import { useCallback, useEffect, useState } from "react";
import { getStoredEnrolmentForm } from "./enrolment-form-af11";
import { getStoredInterviewForm } from "./interview-form-af12";

export const ALS_LLDD_ADM14_REFERENCE = "1.7";
export const ALS_LLDD_FORM_CODE = "AF1.2 Parts 2–4";
export const ALS_LLDD_FORM_TITLE =
  "Learners with Learning Difficulties and/or Disabilities (LLDD) / ALS";

const STORAGE_KEY = "gta-als-lldd-assessment-v1";
const CHANGE_EVENT = "gta-als-lldd-changed";

export type YesNo = "yes" | "no" | "";

export const ALS_INTERVIEW_AREAS = [
  "Section 2: Learner Eligibility",
  "Section 3: Professional Discussion",
  "Section 4: Questions about the Apprenticeship",
  "Section 5: Questions about Them",
  "Section 6: Questions for the Interviewer",
  "Section 7: Initial Assessment",
] as const;

export const ALS_SOFT_SKILLS = [
  "Collaboration and Teamwork",
  "Creativity",
  "Problem Solving",
  "Critical Thinking and Decision Making",
  "Leadership and Citizenship",
  "Aiming High",
  "Listening",
  "Speaking",
  "Staying Positive",
] as const;

export type AlsLlddState = {
  candidateName: string;
  apprenticeshipRoute: string;
  /** Driven from interview 9.1 / enrolment LLDD */
  requiresAlsAssessment: YesNo;
  requiresHsRiskAssessment: YesNo;
  requiresEmployerHsVisit: YesNo;

  // Part 2 — ALS referral
  alsReferralInterviewAreas: string[];
  alsReferralDetails: string;
  alsSupportActionPlan: string;
  alsSoftSkills: string[];
  alsNotes: string;
  alsRequiresFullAssessment: YesNo;
  alsCanDeliverAlongside: YesNo;
  alsReferralOutcome: string;
  alsAssessorSignature: string;
  alsAssessorDate: string;
  alsRaisedBy: string;
  alsRaisedDate: string;

  // Part 3 — Employer H&S visit
  part3RaisedBy: string;
  part3RaisedDate: string;
  part3EmployerName: string;
  part3EmployerContact: string;
  part3EmployerAddress: string;

  // Part 4 — H&S risk assessment (LLDD)
  part4RaisedBy: string;
  part4RaisedDate: string;
  part4EmployerName: string;
  part4EmployerContact: string;
  part4EmployerAddress: string;

  signatureName: string;
  signedAt: string | null;
  lastSavedAt: string | null;
};

export function createEmptyAlsLlddState(): AlsLlddState {
  return {
    candidateName: "",
    apprenticeshipRoute: "",
    requiresAlsAssessment: "",
    requiresHsRiskAssessment: "",
    requiresEmployerHsVisit: "",
    alsReferralInterviewAreas: [],
    alsReferralDetails: "",
    alsSupportActionPlan: "",
    alsSoftSkills: [],
    alsNotes: "",
    alsRequiresFullAssessment: "",
    alsCanDeliverAlongside: "",
    alsReferralOutcome: "",
    alsAssessorSignature: "",
    alsAssessorDate: "",
    alsRaisedBy: "",
    alsRaisedDate: "",
    part3RaisedBy: "",
    part3RaisedDate: "",
    part3EmployerName: "",
    part3EmployerContact: "",
    part3EmployerAddress: "",
    part4RaisedBy: "",
    part4RaisedDate: "",
    part4EmployerName: "",
    part4EmployerContact: "",
    part4EmployerAddress: "",
    signatureName: "",
    signedAt: null,
    lastSavedAt: null,
  };
}

export function prefillAlsLlddFromPriorDocs(): AlsLlddState {
  const base = createEmptyAlsLlddState();
  const enrolment = getStoredEnrolmentForm();
  const interview = getStoredInterviewForm();

  const candidateName =
    [enrolment?.firstName, enrolment?.surname].filter(Boolean).join(" ") ||
    interview?.candidateName ||
    "Alex Morgan";

  const apprenticeshipRoute =
    interview?.apprenticeshipRoute ||
    (enrolment?.apprenticeshipProgramme === "autocare_l2"
      ? "Auto-Care Technician Level 2"
      : "") ||
    "";

  return {
    ...base,
    candidateName,
    apprenticeshipRoute,
    requiresAlsAssessment: interview?.needsAlsAssessment || "",
    requiresHsRiskAssessment: interview?.needsHsRiskAssessment || "",
    requiresEmployerHsVisit: interview?.employerHsInspectionRequired || "",
    part3EmployerName:
      interview?.employerName || enrolment?.employerName || "",
    part3EmployerContact: interview?.employerContactName || "",
    part3EmployerAddress:
      interview?.employerAddress || enrolment?.employerAddress || "",
    part4EmployerName:
      interview?.employerName || enrolment?.employerName || "",
    part4EmployerContact: interview?.employerContactName || "",
    part4EmployerAddress:
      interview?.employerAddress || enrolment?.employerAddress || "",
    alsRaisedBy: interview?.interviewerName || "",
    part3RaisedBy: interview?.interviewerName || "",
    part4RaisedBy: interview?.interviewerName || "",
  };
}

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

export function getAlsLlddProgress(state: AlsLlddState): {
  status: "not_started" | "in_progress" | "complete" | "not_applicable";
  percent: number;
} {
  const anyRequired =
    state.requiresAlsAssessment === "yes" ||
    state.requiresHsRiskAssessment === "yes" ||
    state.requiresEmployerHsVisit === "yes";

  if (
    state.requiresAlsAssessment === "no" &&
    state.requiresHsRiskAssessment === "no" &&
    state.requiresEmployerHsVisit !== "yes"
  ) {
    return { status: "not_applicable", percent: 100 };
  }

  if (state.signedAt) return { status: "complete", percent: 100 };

  const checks = [
    hasText(state.candidateName),
    state.requiresAlsAssessment !== "" ||
      state.requiresHsRiskAssessment !== "",
    state.requiresAlsAssessment !== "yes" ||
      hasText(state.alsReferralDetails) ||
      state.alsReferralInterviewAreas.length > 0,
    state.requiresHsRiskAssessment !== "yes" ||
      hasText(state.part4RaisedBy),
    hasText(state.signatureName),
  ];
  const filled = checks.filter(Boolean).length;
  if (!anyRequired && filled <= 1) {
    return { status: "not_started", percent: 0 };
  }
  return {
    status: filled === 0 ? "not_started" : "in_progress",
    percent: Math.round((filled / checks.length) * 100),
  };
}

export function canSubmitAlsLldd(state: AlsLlddState): boolean {
  if (state.signedAt) return false;
  return (
    hasText(state.candidateName) &&
    hasText(state.signatureName) &&
    (state.requiresAlsAssessment === "yes" ||
      state.requiresHsRiskAssessment === "yes" ||
      state.requiresEmployerHsVisit === "yes")
  );
}

function readStored(): AlsLlddState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AlsLlddState;
  } catch {
    return null;
  }
}

function writeStored(state: AlsLlddState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeAlsLlddStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getAlsLlddSnapshot(): string {
  if (typeof window === "undefined") return "server";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function getAlsLlddDocumentsStatus():
  | "not_started"
  | "in_progress"
  | "complete"
  | "not_applicable" {
  const stored = readStored();
  if (!stored) {
    const interview = getStoredInterviewForm();
    if (
      interview?.needsAlsAssessment === "no" &&
      interview?.needsHsRiskAssessment === "no"
    ) {
      return "not_applicable";
    }
    if (
      interview?.needsAlsAssessment === "yes" ||
      interview?.needsHsRiskAssessment === "yes"
    ) {
      return "not_started";
    }
    return "not_applicable";
  }
  return getAlsLlddProgress(stored).status;
}

export function useAlsLlddState() {
  const [state, setState] = useState<AlsLlddState>(() =>
    createEmptyAlsLlddState(),
  );

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setState(stored);
      return;
    }
    setState(prefillAlsLlddFromPriorDocs());
  }, []);

  const patch = useCallback((partial: Partial<AlsLlddState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const persist = useCallback(() => {
    setState((prev) => {
      const withStamp = { ...prev, lastSavedAt: new Date().toISOString() };
      writeStored(withStamp);
      return withStamp;
    });
  }, []);

  const submit = useCallback(() => {
    setState((prev) => {
      if (!canSubmitAlsLldd(prev)) return prev;
      const signed = {
        ...prev,
        signedAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
      };
      writeStored(signed);
      return signed;
    });
  }, []);

  const refreshFromPrior = useCallback(() => {
    setState((prev) => {
      if (prev.signedAt) return prev;
      const prefill = prefillAlsLlddFromPriorDocs();
      const next = {
        ...prev,
        candidateName: prefill.candidateName || prev.candidateName,
        apprenticeshipRoute:
          prefill.apprenticeshipRoute || prev.apprenticeshipRoute,
        requiresAlsAssessment:
          prefill.requiresAlsAssessment || prev.requiresAlsAssessment,
        requiresHsRiskAssessment:
          prefill.requiresHsRiskAssessment || prev.requiresHsRiskAssessment,
        requiresEmployerHsVisit:
          prefill.requiresEmployerHsVisit || prev.requiresEmployerHsVisit,
        part3EmployerName: prefill.part3EmployerName || prev.part3EmployerName,
        part3EmployerContact:
          prefill.part3EmployerContact || prev.part3EmployerContact,
        part3EmployerAddress:
          prefill.part3EmployerAddress || prev.part3EmployerAddress,
        part4EmployerName: prefill.part4EmployerName || prev.part4EmployerName,
        part4EmployerContact:
          prefill.part4EmployerContact || prev.part4EmployerContact,
        part4EmployerAddress:
          prefill.part4EmployerAddress || prev.part4EmployerAddress,
        alsRaisedBy: prefill.alsRaisedBy || prev.alsRaisedBy,
        part3RaisedBy: prefill.part3RaisedBy || prev.part3RaisedBy,
        part4RaisedBy: prefill.part4RaisedBy || prev.part4RaisedBy,
      };
      writeStored(next);
      return next;
    });
  }, []);

  return {
    state,
    patch,
    persist,
    submit,
    refreshFromPrior,
    progress: getAlsLlddProgress(state),
  };
}
