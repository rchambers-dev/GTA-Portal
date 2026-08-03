/**
 * ADM14.0 Apprenticeship Evidence Pack checklist (From August 2022) v2.1.
 * Source form: ADM14.0_Apprenticeship_File_Checklist_v2.1
 * This is the canonical document list for the shared apprentice file pack page
 * and the apprentice / employer Documents portals.
 */

export type Adm14RequirementKind = "mandatory" | "conditional";

/** Who can see this row on the apprentice / employer Documents portals. */
export type Adm14PortalRole = "apprentice" | "employer";

export type Adm14RequirementDefinition = {
  reference: string;
  sectionKey: string;
  sectionTitle: string;
  originalBookletSection: string;
  requirementKind: Adm14RequirementKind;
  title: string;
  /** Form notes / applicability */
  applicability: string;
  isRecurring: boolean;
  /** Section 6 items typically apply once the apprenticeship has ended */
  endOfProgramme: boolean;
  /**
   * Portal visibility. Staff ADM14 pack always sees every item.
   * Empty = staff / accounts only (hidden on apprentice & employer Documents).
   */
  portalVisibility: Adm14PortalRole[];
};

export type Adm14SectionDefinition = {
  key: string;
  title: string;
  bookletSection: string;
  /** Short blurb for Documents hub cards */
  summary: string;
};

export const ADM14_FORM_CODE = "ADM14.0";
export const ADM14_FORM_TITLE =
  "Apprenticeship Evidence Pack Form (From August 2022)";

/** Booklet sections in order — one Documents page per section. */
export const ADM14_SECTIONS: Adm14SectionDefinition[] = [
  {
    key: "eligibility",
    title: "Programme Eligibility",
    bookletSection: "Section 1",
    summary: "ILR, enrolment, interview, and initial assessment evidence.",
  },
  {
    key: "employer",
    title: "Employer Enrolment",
    bookletSection: "Section 2",
    summary: "Employer TNA, recruit declaration, waiver, and H&S audit.",
  },
  {
    key: "agreement",
    title: "Apprenticeship Agreement",
    bookletSection: "Section 3",
    summary: "Signed apprenticeship agreement between the parties.",
  },
  {
    key: "contract",
    title: "Contract",
    bookletSection: "Section 4",
    summary: "Training plan and contract for services.",
  },
  {
    key: "induction",
    title: "Apprenticeship Induction",
    bookletSection: "Section 5",
    summary: "Induction record completed at programme start.",
  },
  {
    key: "ended",
    title: "Apprenticeship Ended",
    bookletSection: "Section 6",
    summary: "Completion pack, EPA booking, results, and EPAO evidence.",
  },
  {
    key: "otj",
    title: "Off-The-Job Training",
    bookletSection: "Section 7",
    summary: "PDR, OTJ log, progress reviews, and related records.",
  },
  {
    key: "misc",
    title: "Miscellaneous Items",
    bookletSection: "Section 8",
    summary: "Additional evidence required by individual circumstances.",
  },
];

const APPRENTICE: Adm14PortalRole[] = ["apprentice"];
const EMPLOYER: Adm14PortalRole[] = ["employer"];
const BOTH: Adm14PortalRole[] = ["apprentice", "employer"];
const STAFF_ONLY: Adm14PortalRole[] = [];

export const ADM14_REQUIREMENTS: Adm14RequirementDefinition[] = [
  // Section 1 — Programme Eligibility
  {
    reference: "1.1",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "mandatory",
    title: "Individual Learning Record (ILR)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "1.2",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "mandatory",
    title: "Apprentice Enrolment Form (AF1.1)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },
  {
    reference: "1.3",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "mandatory",
    title: "Apprentice Interview Form (AF1.2)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },
  {
    reference: "1.4",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "mandatory",
    title: "Initial Assessment – BKSB Report",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },
  {
    reference: "1.5",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "mandatory",
    title: "Initial Assessment – KSB / RPLE Assessment (AF1.30–35)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },
  {
    reference: "1.6",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "mandatory",
    title: "Initial Assessment – PLR Report (LRS)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },
  {
    reference: "1.7",
    sectionKey: "eligibility",
    sectionTitle: "Programme Eligibility",
    originalBookletSection: "Section 1",
    requirementKind: "conditional",
    title: "Initial Assessment – Additional Learning Support / LLDD (AF1.2 Parts 2–4)",
    applicability: "Where ALS is identified",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },

  // Section 2 — Employer Enrolment
  {
    reference: "2.1",
    sectionKey: "employer",
    sectionTitle: "Employer Enrolment",
    originalBookletSection: "Section 2",
    requirementKind: "mandatory",
    title: "Employer Training Needs Analysis (TNA)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: EMPLOYER,
  },
  {
    reference: "2.2",
    sectionKey: "employer",
    sectionTitle: "Employer Enrolment",
    originalBookletSection: "Section 2",
    requirementKind: "mandatory",
    title: "Employer Recruit an Apprentice Declaration",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: EMPLOYER,
  },
  {
    reference: "2.3",
    sectionKey: "employer",
    sectionTitle: "Employer Enrolment",
    originalBookletSection: "Section 2",
    requirementKind: "conditional",
    title: "Small Employer Waiver Evidence",
    applicability: "Where applicable",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: EMPLOYER,
  },
  {
    reference: "2.4",
    sectionKey: "employer",
    sectionTitle: "Employer Enrolment",
    originalBookletSection: "Section 2",
    requirementKind: "mandatory",
    title: "Employer Health and Safety Audit",
    applicability: "All programmes — tick each inspection when completed",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: EMPLOYER,
  },

  // Section 3 — App Agreement
  {
    reference: "3.1",
    sectionKey: "agreement",
    sectionTitle: "Apprenticeship Agreement",
    originalBookletSection: "Section 3",
    requirementKind: "mandatory",
    title: "Apprenticeship Agreement",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },

  // Section 4 — Contract
  {
    reference: "4.1",
    sectionKey: "contract",
    sectionTitle: "Contract",
    originalBookletSection: "Section 4",
    requirementKind: "mandatory",
    title: "Training Plan",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "4.2",
    sectionKey: "contract",
    sectionTitle: "Contract",
    originalBookletSection: "Section 4",
    requirementKind: "mandatory",
    title: "Contract for Services (Training Agreement)",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },

  // Section 5 — App Induction
  {
    reference: "5.1",
    sectionKey: "induction",
    sectionTitle: "Apprenticeship Induction",
    originalBookletSection: "Section 5",
    requirementKind: "mandatory",
    title: "Apprenticeship Induction Record",
    applicability: "All programmes",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },

  // Section 6 — Apprenticeship Ended
  {
    reference: "6.1",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "Apprentice Completion Pack Record Form",
    applicability: "Once the apprenticeship has ended",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: BOTH,
  },
  {
    reference: "6.2",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "Tri-Party agreement for End-Point Assessment",
    applicability: "Once the apprenticeship has ended / EPA pathway",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: BOTH,
  },
  {
    reference: "6.3",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "Booking Confirmation Email with EPAO Evidence",
    applicability: "Once EPA is booked",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: BOTH,
  },
  {
    reference: "6.4",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "Results Confirmation Email from EPAO Evidence",
    applicability: "Once EPA results are issued",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: BOTH,
  },
  {
    reference: "6.5",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "Feedback Achievement Report from EPAO Evidence",
    applicability: "Once EPA feedback is issued",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: BOTH,
  },
  {
    reference: "6.6",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "EPAO Invoice Evidence (see accounts dept.)",
    applicability: "Accounts — once EPA invoiced",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: STAFF_ONLY,
  },
  {
    reference: "6.7",
    sectionKey: "ended",
    sectionTitle: "Apprenticeship Ended",
    originalBookletSection: "Section 6",
    requirementKind: "mandatory",
    title: "GTA Contract with EPAO Evidence (see accounts dept.)",
    applicability: "Accounts — EPAO contract evidence",
    isRecurring: false,
    endOfProgramme: true,
    portalVisibility: STAFF_ONLY,
  },

  // Section 7 — Off-The-Job Training
  {
    reference: "7.1",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "mandatory",
    title: "PDR Apprentice Progress Record",
    applicability: "All programmes",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "7.2",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "mandatory",
    title: "PDR Apprentice Off-The-Job Training Record",
    applicability: "All programmes",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "7.3",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "mandatory",
    title: "Off-The-Job Training Log Evidence",
    applicability: "All programmes",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "7.4",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "mandatory",
    title: "Apprentice Progress Reviews",
    applicability: "All programmes",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "7.5",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "conditional",
    title: "Apprentice Concern Report Evidence",
    applicability: "Where a concern is raised",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "7.6",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "conditional",
    title: "Break in Learning Evidence",
    applicability: "Where a break in learning occurs",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
  {
    reference: "7.7",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "conditional",
    title: "Employer Redundancy Evidence",
    applicability: "Where redundancy affects the apprenticeship",
    isRecurring: false,
    endOfProgramme: false,
    portalVisibility: EMPLOYER,
  },
  {
    reference: "7.8",
    sectionKey: "otj",
    sectionTitle: "Off-The-Job Training",
    originalBookletSection: "Section 7",
    requirementKind: "conditional",
    title: "ALS Support Monthly Record and Associated Evidence",
    applicability: "Where ALS support is in place",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: APPRENTICE,
  },

  // Section 8 — Misc. Items
  {
    reference: "8.1",
    sectionKey: "misc",
    sectionTitle: "Miscellaneous Items",
    originalBookletSection: "Section 8",
    requirementKind: "conditional",
    title: "Miscellaneous Items",
    applicability: "As required by individual circumstances",
    isRecurring: true,
    endOfProgramme: false,
    portalVisibility: BOTH,
  },
];

export function adm14SectionByKey(
  sectionKey: string,
): Adm14SectionDefinition | undefined {
  return ADM14_SECTIONS.find((s) => s.key === sectionKey);
}

export function adm14RequirementByReference(
  reference: string,
): Adm14RequirementDefinition | undefined {
  return ADM14_REQUIREMENTS.find((r) => r.reference === reference);
}

export function adm14RequirementsForSection(
  sectionKey: string,
): Adm14RequirementDefinition[] {
  return ADM14_REQUIREMENTS.filter((r) => r.sectionKey === sectionKey);
}

export function adm14VisibleToPortal(
  item: Adm14RequirementDefinition,
  role: Adm14PortalRole,
): boolean {
  return item.portalVisibility.includes(role);
}
