/**
 * Assumed staff employment file checklist.
 *
 * PLACEHOLDER — replace with the real GTA staff employment form once
 * confirmed (expected Monday). Items below are a reasonable UK training-
 * provider starter set so the Staff page can be shaped like Apprentices.
 */

export type StaffDocRequirementKind = "mandatory" | "conditional";

export type StaffDocRequirement = {
  reference: string;
  sectionKey: string;
  sectionTitle: string;
  requirementKind: StaffDocRequirementKind;
  title: string;
  applicability: string;
};

export const STAFF_EMPLOYMENT_FORM_CODE = "STAFF-EMP";
export const STAFF_EMPLOYMENT_FORM_TITLE =
  "Staff Employment File (assumed — pending real form)";

export const STAFF_EMPLOYMENT_REQUIREMENTS: StaffDocRequirement[] = [
  // Section 1 — Identity & right to work
  {
    reference: "1.1",
    sectionKey: "identity",
    sectionTitle: "Identity & right to work",
    requirementKind: "mandatory",
    title: "Photo ID (passport or driving licence)",
    applicability: "All staff",
  },
  {
    reference: "1.2",
    sectionKey: "identity",
    sectionTitle: "Identity & right to work",
    requirementKind: "mandatory",
    title: "Right to work check",
    applicability: "All staff",
  },
  {
    reference: "1.3",
    sectionKey: "identity",
    sectionTitle: "Identity & right to work",
    requirementKind: "mandatory",
    title: "National Insurance number",
    applicability: "All staff",
  },
  {
    reference: "1.4",
    sectionKey: "identity",
    sectionTitle: "Identity & right to work",
    requirementKind: "conditional",
    title: "Visa / immigration evidence",
    applicability: "Where right to work requires it",
  },

  // Section 2 — Vetting & safeguarding
  {
    reference: "2.1",
    sectionKey: "vetting",
    sectionTitle: "Vetting & safeguarding",
    requirementKind: "mandatory",
    title: "DBS check (enhanced where required)",
    applicability: "All staff with apprentice contact",
  },
  {
    reference: "2.2",
    sectionKey: "vetting",
    sectionTitle: "Vetting & safeguarding",
    requirementKind: "mandatory",
    title: "Safeguarding declaration",
    applicability: "All staff",
  },
  {
    reference: "2.3",
    sectionKey: "vetting",
    sectionTitle: "Vetting & safeguarding",
    requirementKind: "mandatory",
    title: "Employment references (×2)",
    applicability: "All staff",
  },
  {
    reference: "2.4",
    sectionKey: "vetting",
    sectionTitle: "Vetting & safeguarding",
    requirementKind: "conditional",
    title: "Prohibition / barred list check",
    applicability: "Teaching / training roles",
  },

  // Section 3 — Contract & HR
  {
    reference: "3.1",
    sectionKey: "contract",
    sectionTitle: "Contract & HR",
    requirementKind: "mandatory",
    title: "Signed contract / offer letter",
    applicability: "All staff",
  },
  {
    reference: "3.2",
    sectionKey: "contract",
    sectionTitle: "Contract & HR",
    requirementKind: "mandatory",
    title: "Job description",
    applicability: "All staff",
  },
  {
    reference: "3.3",
    sectionKey: "contract",
    sectionTitle: "Contract & HR",
    requirementKind: "mandatory",
    title: "Emergency contact details",
    applicability: "All staff",
  },
  {
    reference: "3.4",
    sectionKey: "contract",
    sectionTitle: "Contract & HR",
    requirementKind: "mandatory",
    title: "Bank details / payroll form",
    applicability: "All paid staff",
  },

  // Section 4 — Induction & compliance
  {
    reference: "4.1",
    sectionKey: "induction",
    sectionTitle: "Induction & compliance",
    requirementKind: "mandatory",
    title: "Data protection / GDPR acknowledgment",
    applicability: "All staff",
  },
  {
    reference: "4.2",
    sectionKey: "induction",
    sectionTitle: "Induction & compliance",
    requirementKind: "mandatory",
    title: "Health & safety induction",
    applicability: "All staff",
  },
  {
    reference: "4.3",
    sectionKey: "induction",
    sectionTitle: "Induction & compliance",
    requirementKind: "mandatory",
    title: "Mandatory safeguarding training",
    applicability: "All staff",
  },
  {
    reference: "4.4",
    sectionKey: "induction",
    sectionTitle: "Induction & compliance",
    requirementKind: "conditional",
    title: "Equality, diversity & inclusion briefing",
    applicability: "All staff (timing may vary)",
  },
];
