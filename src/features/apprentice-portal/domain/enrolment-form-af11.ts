/**
 * AF1.1 Apprentice Apprenticeship Enrolment Form 25-26 v1.1
 * Maps to ADM14.0 reference 1.2 — Apprentice Enrolment Form.
 */

import { useCallback, useEffect, useState } from "react";

export const AF11_FORM_CODE = "AF1.1";
export const AF11_FORM_VERSION = "v1.1";
export const AF11_FORM_TITLE = "Apprenticeship Enrolment Form";
export const AF11_ACADEMIC_YEAR = "25-26";
export const AF11_ADM14_REFERENCE = "1.2";

const STORAGE_KEY = "gta-af11-enrolment-form-v1";

export type YesNo = "yes" | "no" | "";

export type ApprenticeshipProgrammeOption =
  | "autocare_l2"
  | "lvsmt_l3"
  | "business_admin_l3"
  | "hvsmt_l3"
  | "customer_services_l2"
  | "paint_l3"
  | "customer_specialist_l3"
  | "panel_l3"
  | "other";

export type ResidencyEligibilityOption =
  | "uk_national_3y"
  | "right_of_abode_3y"
  | "eea_settled_3y"
  | "non_uk_permission_3y"
  | "";

export type EmploymentStatusOption =
  | "employed"
  | "self_employed"
  | "voluntary"
  | "unemployed"
  | "sole_trader"
  | "";

export type ContractTypeOption = "permanent" | "temporary" | "";

export type SexOption = "male" | "female" | "prefer_not" | "";

export type UnemployedDurationOption =
  | "lt_6"
  | "6_12"
  | "12_23"
  | "24_35"
  | "over_36"
  | "";

export type ContactMethod =
  | "post"
  | "email"
  | "mobile"
  | "text";

export type HeardAboutOption =
  | "website"
  | "schools"
  | "social"
  | "google"
  | "word_of_mouth"
  | "leaflet"
  | "prospectus"
  | "other"
  | "";

export type QualificationRow = {
  id: string;
  qualification: string;
  grade: string;
  achievementDate: string;
};

export type PreviousEmploymentRow = {
  id: string;
  companyName: string;
  jobRole: string;
  dates: string;
};

export type EnrolmentFormAf11State = {
  // Section 1 — Applicant
  title: string;
  firstName: string;
  middleNames: string;
  middleNamesOnCertificate: YesNo;
  surname: string;
  addressPostcode: string;
  yearsAtAddress: string;
  previousAddresses: string;
  homeTelephone: string;
  email: string;
  mobile: string;
  dateOfBirth: string;
  nationalInsuranceNo: string;
  /** Unique Apprentice Number — required for LRS PLR retrieval */
  uln: string;
  age: string;

  // Section 1a — Next of kin
  nokTitle: string;
  nokFirstName: string;
  nokSurname: string;
  nokRelationship: string;
  nokEmail: string;
  nokMobile: string;

  // Section 2
  apprenticeshipProgramme: ApprenticeshipProgrammeOption | "";
  apprenticeshipOtherNotes: string;

  // Section 3 — Eligibility
  residencyEligibility: ResidencyEligibilityOption;
  countryOfBirth: string;
  ukResidencyStartDate: string;
  residencyRestrictions: YesNo;
  residencyRestrictionsDetails: string;
  rightToWorkRestrictions: YesNo;
  rightToWorkRestrictionsDetails: string;

  // Section 4 — Education
  currentlyOnOtherCourse: YesNo;
  otherCourseDetails: string;
  leftSchool: YesNo;
  plannedEndDateCurrentCourse: string;
  qualifications: QualificationRow[];
  confirmNotOnOtherApprenticeship: boolean;
  confirmNotAebConflict: boolean;
  confirmNotOtherDfeFunding: boolean;
  confirmNotSandwichPlacement: boolean;
  priorApprenticeshipLast6Months: string;

  // Section 5 — Employment
  employmentStatus: EmploymentStatusOption;
  hasEmploymentContract: YesNo;
  contractedWeeklyHours: string;
  contractType: ContractTypeOption;
  temporaryContractExpiry: string;
  work50PercentEngland: YesNo;
  employmentStartDate: string;
  workEnglandDetails: string;
  employerName: string;
  lineManager: string;
  employerAddress: string;
  employerTelephone: string;
  jobRole: string;
  employerEmail: string;
  unemployedDuration: UnemployedDurationOption;
  previousEmployment: PreviousEmploymentRow[];

  // Section 6 — Confidential
  sex: SexOption;
  ethnicityCode: string;
  llddCodes: string[];
  primaryLlddCode: string;
  healthSupportDetails: string;
  knownToYouthJustice: YesNo;
  hasEhcp: YesNo;
  shareDetailsWithEmployer: YesNo;
  careLeaverBursary: boolean;
  preferredContactMethods: ContactMethod[];
  heardAboutGta: HeardAboutOption;

  // Declaration
  declarePrivacyUnderstood: boolean;
  declareInformationAccurate: boolean;
  declareConsentProcessing: boolean;
  declareResidencyEligible: boolean;
  declareRightToWork: boolean;
  signatureName: string;
  signedAt: string | null;
  lastSavedAt: string | null;
};

export const APPRENTICESHIP_OPTIONS: {
  value: ApprenticeshipProgrammeOption;
  label: string;
}[] = [
  { value: "autocare_l2", label: "Auto-Care Technician Level 2" },
  {
    value: "lvsmt_l3",
    label: "Light Vehicle Service Maintenance Technician L3",
  },
  { value: "business_admin_l3", label: "Business Administrator Level 3" },
  {
    value: "hvsmt_l3",
    label: "Heavy Vehicle Service Maintenance Technician L3",
  },
  {
    value: "customer_services_l2",
    label: "Customer Services Practitioner Level 2",
  },
  {
    value: "paint_l3",
    label: "Vehicle Damage Paint Technician Level 3",
  },
  {
    value: "customer_specialist_l3",
    label: "Customer Service Specialist Level 3",
  },
  {
    value: "panel_l3",
    label: "Vehicle Damage Panel Technician Level 3",
  },
  {
    value: "other",
    label: "Other (e.g. MET L3 / Motorcycle L3 — discuss with admin)",
  },
];

export const RESIDENCY_OPTIONS: {
  value: Exclude<ResidencyEligibilityOption, "">;
  label: string;
}[] = [
  {
    value: "uk_national_3y",
    label:
      "A UK national who has been ordinarily resident in the UK/EEA/Switzerland for at least 3 years prior to the start of the apprenticeship",
  },
  {
    value: "right_of_abode_3y",
    label:
      "Have the right of abode in the UK and have been ordinarily resident in the UK for at least 3 years prior to the start of the apprenticeship",
  },
  {
    value: "eea_settled_3y",
    label:
      "An EEA/Switzerland National who has obtained pre-settled or settled status under the EU settlement scheme and has been ordinarily resident in the UK/EEA/Switzerland for at least 3 years prior to the start of the apprenticeship",
  },
  {
    value: "non_uk_permission_3y",
    label:
      "A non-UK national with permission from the UK government to live in the UK (not for educational purposes) and have been ordinarily resident in the UK for at least 3 years prior to the start of the apprenticeship",
  },
];

export const EMPLOYMENT_STATUS_OPTIONS: {
  value: Exclude<EmploymentStatusOption, "">;
  label: string;
  part: "A" | "B";
}[] = [
  { value: "employed", label: "Employed", part: "A" },
  { value: "self_employed", label: "Self Employed", part: "A" },
  { value: "voluntary", label: "Working Voluntarily", part: "A" },
  { value: "sole_trader", label: "Sole Trader", part: "A" },
  { value: "unemployed", label: "Unemployed", part: "B" },
];

export const ETHNICITY_OPTIONS: { code: string; label: string; group: string }[] =
  [
    {
      code: "31",
      label: "English / Welsh / Scottish / Northern Irish / British",
      group: "White",
    },
    { code: "32", label: "Irish", group: "White" },
    { code: "33", label: "Gypsy or Irish Traveller", group: "White" },
    { code: "34", label: "Any other White background", group: "White" },
    {
      code: "35",
      label: "White and Black Caribbean",
      group: "Mixed/multiple ethnic groups",
    },
    {
      code: "36",
      label: "White and Black African",
      group: "Mixed/multiple ethnic groups",
    },
    {
      code: "37",
      label: "White and Asian",
      group: "Mixed/multiple ethnic groups",
    },
    {
      code: "38",
      label: "Any other Mixed/multiple ethnic background",
      group: "Mixed/multiple ethnic groups",
    },
    { code: "39", label: "Indian", group: "Asian / Asian British" },
    { code: "40", label: "Pakistani", group: "Asian / Asian British" },
    { code: "41", label: "Bangladeshi", group: "Asian / Asian British" },
    { code: "42", label: "Chinese", group: "Asian / Asian British" },
    {
      code: "43",
      label: "Any other Asian background",
      group: "Asian / Asian British",
    },
    {
      code: "44",
      label: "African",
      group: "Black / African / Caribbean / Black British",
    },
    {
      code: "45",
      label: "Caribbean",
      group: "Black / African / Caribbean / Black British",
    },
    {
      code: "46",
      label: "Any other Black / African / Caribbean background",
      group: "Black / African / Caribbean / Black British",
    },
    { code: "47", label: "Arab", group: "Other ethnic group" },
    { code: "98", label: "Any other ethnic group", group: "Other ethnic group" },
  ];

export const LLDD_OPTIONS: { code: string; label: string }[] = [
  { code: "4", label: "Vision Impairment" },
  { code: "5", label: "Hearing Impairment" },
  { code: "6", label: "Disability Affecting Mobility" },
  { code: "7", label: "Profound complex disabilities" },
  { code: "8", label: "Social and emotional difficulties" },
  { code: "9", label: "Mental Health Difficulty" },
  { code: "10", label: "Moderate learning difficulties" },
  { code: "11", label: "Severe learning difficulties" },
  { code: "12", label: "Dyslexia" },
  { code: "13", label: "Dyscalculia" },
  { code: "14", label: "Autism spectrum disorder" },
  { code: "15", label: "Asperger's Syndrome" },
  {
    code: "16",
    label: "Temporary disability after illness (e.g. post viral) or accident",
  },
  { code: "17", label: "Speech, Language & Communication Needs" },
  { code: "93", label: "Other physical disability" },
  {
    code: "94",
    label: "Other specific learning difficulty (e.g. Dyspraxia)",
  },
  {
    code: "95",
    label: "Other medical condition (e.g. epilepsy, asthma, diabetes)",
  },
  { code: "96", label: "Other learning difficulty" },
  { code: "97", label: "Other disability" },
  { code: "98", label: "Prefer not to say" },
  { code: "99", label: "Not provided" },
];

export const CONTACT_METHOD_OPTIONS: { value: ContactMethod; label: string }[] =
  [
    { value: "post", label: "Post" },
    { value: "email", label: "Email" },
    { value: "mobile", label: "Mobile Phone" },
    { value: "text", label: "Text Message" },
  ];

export const HEARD_ABOUT_OPTIONS: {
  value: Exclude<HeardAboutOption, "">;
  label: string;
}[] = [
  { value: "website", label: "Website" },
  { value: "schools", label: "Schools career event" },
  { value: "social", label: "Social media" },
  { value: "google", label: "Google" },
  { value: "word_of_mouth", label: "Word of Mouth" },
  { value: "leaflet", label: "Leaflet / Flyer" },
  { value: "prospectus", label: "GTA Prospectus" },
  { value: "other", label: "Other" },
];

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyQualificationRow(): QualificationRow {
  return {
    id: newId("qual"),
    qualification: "",
    grade: "",
    achievementDate: "",
  };
}

export function emptyEmploymentRow(): PreviousEmploymentRow {
  return {
    id: newId("emp"),
    companyName: "",
    jobRole: "",
    dates: "",
  };
}

export function createEmptyEnrolmentForm(
  seed?: Partial<Pick<EnrolmentFormAf11State, "firstName" | "surname" | "email" | "employerName" | "jobRole" | "apprenticeshipProgramme">>,
): EnrolmentFormAf11State {
  return {
    title: "",
    firstName: seed?.firstName ?? "",
    middleNames: "",
    middleNamesOnCertificate: "",
    surname: seed?.surname ?? "",
    addressPostcode: "",
    yearsAtAddress: "",
    previousAddresses: "",
    homeTelephone: "",
    email: seed?.email ?? "",
    mobile: "",
    dateOfBirth: "",
    nationalInsuranceNo: "",
    uln: "",
    age: "",
    nokTitle: "",
    nokFirstName: "",
    nokSurname: "",
    nokRelationship: "",
    nokEmail: "",
    nokMobile: "",
    apprenticeshipProgramme: seed?.apprenticeshipProgramme ?? "",
    apprenticeshipOtherNotes: "",
    residencyEligibility: "",
    countryOfBirth: "",
    ukResidencyStartDate: "",
    residencyRestrictions: "",
    residencyRestrictionsDetails: "",
    rightToWorkRestrictions: "",
    rightToWorkRestrictionsDetails: "",
    currentlyOnOtherCourse: "",
    otherCourseDetails: "",
    leftSchool: "",
    plannedEndDateCurrentCourse: "",
    qualifications: [
      emptyQualificationRow(),
      emptyQualificationRow(),
      emptyQualificationRow(),
    ],
    confirmNotOnOtherApprenticeship: false,
    confirmNotAebConflict: false,
    confirmNotOtherDfeFunding: false,
    confirmNotSandwichPlacement: false,
    priorApprenticeshipLast6Months: "",
    employmentStatus: "",
    hasEmploymentContract: "",
    contractedWeeklyHours: "",
    contractType: "",
    temporaryContractExpiry: "",
    work50PercentEngland: "",
    employmentStartDate: "",
    workEnglandDetails: "",
    employerName: seed?.employerName ?? "",
    lineManager: "",
    employerAddress: "",
    employerTelephone: "",
    jobRole: seed?.jobRole ?? "",
    employerEmail: "",
    unemployedDuration: "",
    previousEmployment: [emptyEmploymentRow()],
    sex: "",
    ethnicityCode: "",
    llddCodes: [],
    primaryLlddCode: "",
    healthSupportDetails: "",
    knownToYouthJustice: "",
    hasEhcp: "",
    shareDetailsWithEmployer: "",
    careLeaverBursary: false,
    preferredContactMethods: [],
    heardAboutGta: "",
    declarePrivacyUnderstood: false,
    declareInformationAccurate: false,
    declareConsentProcessing: false,
    declareResidencyEligible: false,
    declareRightToWork: false,
    signatureName: "",
    signedAt: null,
    lastSavedAt: null,
  };
}

export type EnrolmentFormProgress = {
  status: "not_started" | "in_progress" | "complete";
  filledRequiredApprox: number;
  requiredApprox: number;
  percent: number;
};

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

export function getEnrolmentFormProgress(
  state: EnrolmentFormAf11State,
): EnrolmentFormProgress {
  if (state.signedAt) {
    return {
      status: "complete",
      filledRequiredApprox: 1,
      requiredApprox: 1,
      percent: 100,
    };
  }

  const checks: boolean[] = [
    hasText(state.firstName),
    hasText(state.surname),
    hasText(state.addressPostcode),
    hasText(state.email),
    hasText(state.mobile),
    hasText(state.dateOfBirth),
    hasText(state.nationalInsuranceNo),
    hasText(state.apprenticeshipProgramme),
    hasText(state.residencyEligibility),
    hasText(state.employmentStatus),
    state.confirmNotOnOtherApprenticeship,
    state.declarePrivacyUnderstood,
    state.declareInformationAccurate,
    state.declareConsentProcessing,
    state.declareResidencyEligible,
    state.declareRightToWork,
    hasText(state.signatureName),
  ];

  const filled = checks.filter(Boolean).length;
  const required = checks.length;
  const percent = Math.round((filled / required) * 100);

  return {
    status: filled === 0 ? "not_started" : "in_progress",
    filledRequiredApprox: filled,
    requiredApprox: required,
    percent,
  };
}

export function canSubmitEnrolmentForm(state: EnrolmentFormAf11State): boolean {
  return (
    hasText(state.firstName) &&
    hasText(state.surname) &&
    hasText(state.email) &&
    hasText(state.dateOfBirth) &&
    hasText(state.apprenticeshipProgramme) &&
    hasText(state.residencyEligibility) &&
    hasText(state.employmentStatus) &&
    state.confirmNotOnOtherApprenticeship &&
    state.declarePrivacyUnderstood &&
    state.declareInformationAccurate &&
    state.declareConsentProcessing &&
    state.declareResidencyEligible &&
    state.declareRightToWork &&
    hasText(state.signatureName) &&
    !state.signedAt
  );
}

export function getStoredEnrolmentForm(): EnrolmentFormAf11State | null {
  return readStored();
}

function readStored(): EnrolmentFormAf11State | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EnrolmentFormAf11State;
  } catch {
    return null;
  }
}

function writeStored(state: EnrolmentFormAf11State) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("gta-af11-enrolment-changed"));
  // When identity fields are ready, auto-request PLR from LRS (mock or SOAP).
  void import("./plr-store")
    .then((mod) => mod.ensurePlrAutoFetched())
    .catch(() => {
      /* ignore */
    });
}

export function subscribeAf11EnrolmentStore(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("gta-af11-enrolment-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("gta-af11-enrolment-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

export function getAf11EnrolmentSnapshot(): string {
  if (typeof window === "undefined") return "server";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function useEnrolmentFormAf11State(seed?: EnrolmentFormAf11State) {
  const [state, setState] = useState<EnrolmentFormAf11State>(
    () => seed ?? createEmptyEnrolmentForm(),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    if (stored) setState(stored);
    setHydrated(true);
  }, []);

  const saveDraft = useCallback((next: EnrolmentFormAf11State) => {
    const withStamp = {
      ...next,
      lastSavedAt: new Date().toISOString(),
    };
    setState(withStamp);
    writeStored(withStamp);
    return withStamp;
  }, []);

  const patch = useCallback(
    (partial: Partial<EnrolmentFormAf11State>) => {
      setState((prev) => {
        const next = { ...prev, ...partial };
        return next;
      });
    },
    [],
  );

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
      if (!canSubmitEnrolmentForm(prev)) return prev;
      const signed: EnrolmentFormAf11State = {
        ...prev,
        signedAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
      };
      writeStored(signed);
      return signed;
    });
  }, []);

  const resetForm = useCallback(() => {
    const fresh = createEmptyEnrolmentForm();
    setState(fresh);
    writeStored(fresh);
  }, []);

  return {
    state,
    hydrated,
    patch,
    setState,
    saveDraft,
    persist,
    submit,
    resetForm,
    progress: getEnrolmentFormProgress(state),
  };
}

/** Live status for Documents hub/row when AF1.1 is the backing form for 1.2. */
export function getAf11DocumentsStatus():
  | "not_started"
  | "in_progress"
  | "complete" {
  const stored = readStored();
  if (!stored) return "not_started";
  return getEnrolmentFormProgress(stored).status;
}
