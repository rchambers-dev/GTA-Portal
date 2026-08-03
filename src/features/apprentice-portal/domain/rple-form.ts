/**
 * Programme-specific RPLE assessments (AF1.30–AF1.35).
 * Maps to ADM14.0 reference 1.5 — KSB / RPLE testing record.
 * Template is auto-selected from AF1.1 apprenticeship programme choice.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import catalogJson from "./rple/rple-catalog.json";
import {
  APPRENTICESHIP_OPTIONS,
  getStoredEnrolmentForm,
  type ApprenticeshipProgrammeOption,
  type EnrolmentFormAf11State,
} from "./enrolment-form-af11";
import { getStoredInterviewForm } from "./interview-form-af12";

export const RPLE_ADM14_REFERENCE = "1.5";

export type RpleScore = 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;

export const RPLE_SCORE_OPTIONS: { value: RpleScore; label: string }[] = [
  { value: 0, label: "0%" },
  { value: 0.1, label: "10%" },
  { value: 0.2, label: "20%" },
  { value: 0.3, label: "30%" },
  { value: 0.4, label: "40%" },
  { value: 0.5, label: "50%" },
  { value: 0.6, label: "60%" },
  { value: 0.7, label: "70%" },
  { value: 0.8, label: "80%" },
  { value: 0.9, label: "90%" },
  { value: 1, label: "100%" },
];

export type EmployerFundingType =
  | ""
  | "levy"
  | "co_investment"
  | "government_ff"
  | "government_ff_ehcp";

export const EMPLOYER_FUNDING_OPTIONS: {
  value: Exclude<EmployerFundingType, "">;
  label: string;
}[] = [
  { value: "levy", label: "Levy Funded (L)" },
  {
    value: "co_investment",
    label: "Government-Employer Co-investment Funded (CF)",
  },
  { value: "government_ff", label: "Government Funded (FF)" },
  {
    value: "government_ff_ehcp",
    label: "Government Funded 19-24 EHCP (FFEHC)",
  },
];

export type RpleCatalogItem = {
  code: string;
  kind: string;
  text: string;
};

export type RpleCatalogGroup = {
  id: string;
  title: string;
  items: RpleCatalogItem[];
};

export type RpleProgrammeDefinition = {
  programmeKey: string;
  formCode: string;
  formVersion: string;
  academicYear: string;
  sourceFile: string | null;
  available: boolean;
  layout: "flat_ksb" | "grouped_scan" | "stub";
  standardTitle: string;
  standardRef: string;
  standardVersion: string;
  funding: {
    maxBand: number | null;
    totalKsbRequired: number | null;
    otjHoursRequired: number | null;
  };
  eligibilityQuestions: {
    id: string;
    question: string;
    defaultAnswer: string;
    defaultComment: string;
  }[];
  assessmentQuestions: {
    id: string;
    question: string;
    defaultAnswer: string;
    defaultComment: string;
  }[];
  supportQuestions: {
    id: string;
    question: string;
    defaultAnswer: string;
    defaultComment: string;
  }[];
  groups: RpleCatalogGroup[];
  itemCount: number;
  stubNote?: string;
};

export type RpleCatalog = {
  generatedAt: string;
  programmes: Record<string, RpleProgrammeDefinition>;
};

export const RPLE_CATALOG = catalogJson as RpleCatalog;

const STORAGE_KEY = "gta-rple-assessment-v1";
const CHANGE_EVENT = "gta-rple-assessment-changed";

export type RpleYesNoAnswer = {
  answer: "yes" | "no" | "";
  comment: string;
};

export type RpleAssessmentState = {
  programmeKey: ApprenticeshipProgrammeOption | "";
  apprenticeName: string;
  dateOfBirth: string;
  employerName: string;
  employerAddress: string;
  employerType: EmployerFundingType;
  lineManagerName: string;
  discussionDate: string;
  assessorName: string;
  eligibility: Record<string, RpleYesNoAnswer>;
  assessment: Record<string, RpleYesNoAnswer>;
  support: Record<string, RpleYesNoAnswer>;
  /** Scores keyed by `${groupId}::${code}` */
  scores: Record<string, RpleScore>;
  comments: Record<string, string>;
  employerDiscussionNotes: string;
  rpleIdentified: "yes" | "no" | "";
  rpleJustification: string;
  signatureName: string;
  signedAt: string | null;
  lastSavedAt: string | null;
  /** Snapshot of which template the scores belong to */
  lockedProgrammeKey: ApprenticeshipProgrammeOption | "";
};

export function scoreKey(groupId: string, code: string) {
  return `${groupId}::${code}`;
}

export function getRpleProgramme(
  key: string | null | undefined,
): RpleProgrammeDefinition | null {
  if (!key) return null;
  return RPLE_CATALOG.programmes[key] ?? null;
}

export function programmeLabel(key: string): string {
  const opt = APPRENTICESHIP_OPTIONS.find((o) => o.value === key);
  if (opt) return opt.label;
  return getRpleProgramme(key)?.standardTitle ?? key;
}

/**
 * Resolve programme for RPLE: AF1.1 course choice first, then AF1.2 route text.
 */
export function resolveRpleProgrammeKey(
  enrolment?: EnrolmentFormAf11State | null,
): ApprenticeshipProgrammeOption | "" {
  const fromEnrolment =
    enrolment?.apprenticeshipProgramme ||
    getStoredEnrolmentForm()?.apprenticeshipProgramme ||
    "";
  if (fromEnrolment) return fromEnrolment;

  const interview = getStoredInterviewForm();
  const route = (interview?.apprenticeshipRoute ?? "").toLowerCase();
  if (!route) return "";

  if (route.includes("autocare") || route.includes("auto-care"))
    return "autocare_l2";
  if (route.includes("light vehicle") || route.includes("lvsmt"))
    return "lvsmt_l3";
  if (route.includes("business admin")) return "business_admin_l3";
  if (route.includes("heavy vehicle") || route.includes("hvsmt"))
    return "hvsmt_l3";
  if (route.includes("paint")) return "paint_l3";
  if (route.includes("panel")) return "panel_l3";
  if (route.includes("customer service specialist"))
    return "customer_specialist_l3";
  if (route.includes("customer service")) return "customer_services_l2";
  return "other";
}

function emptyAnswers(
  questions: { id: string; defaultAnswer?: string; defaultComment?: string }[],
): Record<string, RpleYesNoAnswer> {
  const out: Record<string, RpleYesNoAnswer> = {};
  for (const q of questions) {
    const answer =
      q.defaultAnswer?.toLowerCase() === "yes"
        ? "yes"
        : q.defaultAnswer?.toLowerCase() === "no"
          ? "no"
          : "";
    out[q.id] = { answer, comment: q.defaultComment ?? "" };
  }
  return out;
}

export function buildPrefillFromPriorDocuments(
  programmeKey: ApprenticeshipProgrammeOption | "",
): Partial<RpleAssessmentState> {
  const enrolment = getStoredEnrolmentForm();
  const interview = getStoredInterviewForm();
  const programme = getRpleProgramme(programmeKey);

  const apprenticeName =
    [enrolment?.firstName, enrolment?.surname].filter(Boolean).join(" ") ||
    interview?.candidateName ||
    "";

  return {
    programmeKey,
    lockedProgrammeKey: programmeKey,
    apprenticeName,
    dateOfBirth: enrolment?.dateOfBirth ?? "",
    employerName:
      enrolment?.employerName || interview?.employerName || "",
    employerAddress:
      enrolment?.employerAddress || interview?.employerAddress || "",
    employerType: "",
    lineManagerName: enrolment?.lineManager || interview?.employerContactName || "",
    discussionDate: interview?.interviewDate || "",
    assessorName:
      interview?.interviewerName || interview?.interviewerSignatureName || "",
    eligibility: emptyAnswers(programme?.eligibilityQuestions ?? []),
    assessment: emptyAnswers(programme?.assessmentQuestions ?? []),
    support: emptyAnswers(programme?.supportQuestions ?? []),
    scores: {},
    comments: {},
    employerDiscussionNotes: interview?.rpleDetails || "",
    rpleIdentified:
      interview?.rplePotentialConfirmation === "yes"
        ? "yes"
        : interview?.rplePotentialConfirmation === "no"
          ? "no"
          : "",
    rpleJustification: interview?.rpleConfirmationNotes || "",
    signatureName: "",
    signedAt: null,
    lastSavedAt: null,
  };
}

export function createEmptyRpleState(
  programmeKey: ApprenticeshipProgrammeOption | "" = "",
): RpleAssessmentState {
  const prefill = buildPrefillFromPriorDocuments(programmeKey);
  return {
    programmeKey: prefill.programmeKey ?? "",
    lockedProgrammeKey: prefill.lockedProgrammeKey ?? "",
    apprenticeName: prefill.apprenticeName ?? "",
    dateOfBirth: prefill.dateOfBirth ?? "",
    employerName: prefill.employerName ?? "",
    employerAddress: prefill.employerAddress ?? "",
    employerType: prefill.employerType ?? "",
    lineManagerName: prefill.lineManagerName ?? "",
    discussionDate: prefill.discussionDate ?? "",
    assessorName: prefill.assessorName ?? "",
    eligibility: prefill.eligibility ?? {},
    assessment: prefill.assessment ?? {},
    support: prefill.support ?? {},
    scores: prefill.scores ?? {},
    comments: prefill.comments ?? {},
    employerDiscussionNotes: prefill.employerDiscussionNotes ?? "",
    rpleIdentified: prefill.rpleIdentified ?? "",
    rpleJustification: prefill.rpleJustification ?? "",
    signatureName: prefill.signatureName ?? "",
    signedAt: null,
    lastSavedAt: null,
  };
}

export function averageRpleScore(state: RpleAssessmentState): number {
  const values = Object.values(state.scores);
  if (!values.length) return 0;
  return values.reduce<number>((n, v) => n + v, 0) / values.length;
}

export function scoredItemCount(state: RpleAssessmentState): number {
  return Object.values(state.scores).filter((v) => v > 0 || v === 0).length;
}

export type RpleProgress = {
  status: "not_started" | "in_progress" | "complete" | "awaiting_programme" | "stub";
  percent: number;
};

export function getRpleProgress(
  state: RpleAssessmentState,
  programme: RpleProgrammeDefinition | null,
): RpleProgress {
  if (!state.programmeKey) {
    return { status: "awaiting_programme", percent: 0 };
  }
  if (programme && !programme.available) {
    return { status: "stub", percent: 0 };
  }
  if (state.signedAt) return { status: "complete", percent: 100 };

  const totalItems = programme?.itemCount ?? 0;
  const scored = Object.keys(state.scores).length;
  const headerBits = [
    Boolean(state.apprenticeName.trim()),
    Boolean(state.assessorName.trim()),
    Boolean(state.discussionDate),
    state.rpleIdentified !== "",
  ].filter(Boolean).length;

  const denom = Math.max(1, totalItems + 4);
  const percent = Math.round(((scored + headerBits) / denom) * 100);
  return {
    status: scored + headerBits === 0 ? "not_started" : "in_progress",
    percent: Math.min(99, percent),
  };
}

export function canSubmitRple(
  state: RpleAssessmentState,
  programme: RpleProgrammeDefinition | null,
): boolean {
  if (!programme?.available) return false;
  if (state.signedAt) return false;
  return (
    Boolean(state.apprenticeName.trim()) &&
    Boolean(state.assessorName.trim()) &&
    Boolean(state.discussionDate) &&
    state.rpleIdentified !== "" &&
    Boolean(state.signatureName.trim()) &&
    (state.rpleIdentified === "yes" ||
      Boolean(state.rpleJustification.trim()))
  );
}

function readStored(): RpleAssessmentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RpleAssessmentState;
  } catch {
    return null;
  }
}

function writeStored(state: RpleAssessmentState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeRpleStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getRpleSnapshot(): string {
  if (typeof window === "undefined") return "server";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function getRpleDocumentsStatus():
  | "not_started"
  | "in_progress"
  | "complete"
  | "awaiting_document" {
  const stored = readStored();
  if (!stored?.programmeKey) {
    const key = resolveRpleProgrammeKey();
    const programme = getRpleProgramme(key);
    if (key && programme && !programme.available) return "awaiting_document";
    return "not_started";
  }
  const programme = getRpleProgramme(stored.programmeKey);
  if (programme && !programme.available) return "awaiting_document";
  const progress = getRpleProgress(stored, programme);
  if (progress.status === "complete") return "complete";
  if (progress.status === "in_progress") return "in_progress";
  return "not_started";
}

export function useRpleAssessmentState() {
  const resolvedKey = resolveRpleProgrammeKey();
  const [state, setState] = useState<RpleAssessmentState>(() =>
    createEmptyRpleState(resolvedKey),
  );

  useEffect(() => {
    const stored = readStored();
    const key = resolveRpleProgrammeKey();
    if (stored) {
      // If enrolment course changed after a draft, realign template and keep answers where possible.
      if (key && stored.programmeKey && key !== stored.programmeKey && !stored.signedAt) {
        const next = {
          ...createEmptyRpleState(key),
          apprenticeName: stored.apprenticeName,
          dateOfBirth: stored.dateOfBirth,
          employerName: stored.employerName,
          employerAddress: stored.employerAddress,
          lineManagerName: stored.lineManagerName,
          discussionDate: stored.discussionDate,
          assessorName: stored.assessorName,
        };
        setState(next);
        writeStored(next);
        return;
      }
      setState(stored);
      return;
    }
    setState(createEmptyRpleState(key));
  }, []);

  const programme = useMemo(
    () => getRpleProgramme(state.programmeKey),
    [state.programmeKey],
  );

  const patch = useCallback((partial: Partial<RpleAssessmentState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const setScore = useCallback(
    (groupId: string, code: string, value: RpleScore) => {
      setState((prev) => ({
        ...prev,
        scores: {
          ...prev.scores,
          [scoreKey(groupId, code)]: value,
        },
      }));
    },
    [],
  );

  const setItemComment = useCallback(
    (groupId: string, code: string, comment: string) => {
      setState((prev) => ({
        ...prev,
        comments: {
          ...prev.comments,
          [scoreKey(groupId, code)]: comment,
        },
      }));
    },
    [],
  );

  const setYesNo = useCallback(
    (
      section: "eligibility" | "assessment" | "support",
      id: string,
      answer: RpleYesNoAnswer,
    ) => {
      setState((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [id]: answer,
        },
      }));
    },
    [],
  );

  const persist = useCallback(() => {
    setState((prev) => {
      const withStamp = { ...prev, lastSavedAt: new Date().toISOString() };
      writeStored(withStamp);
      return withStamp;
    });
  }, []);

  const submit = useCallback(() => {
    setState((prev) => {
      const prog = getRpleProgramme(prev.programmeKey);
      if (!canSubmitRple(prev, prog)) return prev;
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
      const key = resolveRpleProgrammeKey() || prev.programmeKey;
      const prefill = buildPrefillFromPriorDocuments(key);
      const next = {
        ...prev,
        ...prefill,
        scores: prev.scores,
        comments: prev.comments,
        signatureName: prev.signatureName,
        signedAt: prev.signedAt,
      };
      writeStored(next);
      return next;
    });
  }, []);

  return {
    state,
    programme,
    resolvedKey,
    patch,
    setScore,
    setItemComment,
    setYesNo,
    persist,
    submit,
    refreshFromPrior,
    progress: getRpleProgress(state, programme),
    averageScore: averageRpleScore(state),
  };
}
