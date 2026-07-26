/**
 * Progressive pack item model for the Learners page.
 *
 * Intake stays personal-details only. Everything here is entered and amended
 * on Learners as the apprentice moves through the programme.
 *
 * Field schemas are starter shapes — refine with ops as real forms land.
 */

import {
  ADM14_REQUIREMENTS,
  type Adm14RequirementDefinition,
} from "./adm14-checklist";
import type { EvidenceRequirementStatus } from "../types";

export type PackEvidenceKind = "form" | "document" | "hybrid";

export type PackFieldType = "text" | "textarea" | "date" | "number";

export type PackFieldDef = {
  key: string;
  label: string;
  type: PackFieldType;
  placeholder?: string;
};

/** Editable payload stored per learner + ADM14 reference. */
export type PackItemRecord = {
  status: EvidenceRequirementStatus;
  notes: string;
  dateReceived: string;
  checkedBy: string;
  dateChecked: string;
  /** Free-text stand-in until file upload lands. */
  evidenceLabel: string;
  fields: Record<string, string>;
  /** Staff ruled this conditional item out — status becomes not_applicable. */
  notApplicable: boolean;
  updatedAt: string;
};

export type PackItemSchema = {
  reference: string;
  kind: PackEvidenceKind;
  fields: PackFieldDef[];
};

const DOCUMENT_FIELDS: PackFieldDef[] = [
  {
    key: "documentTitle",
    label: "Document title / description",
    type: "text",
    placeholder: "e.g. Signed training agreement PDF",
  },
  {
    key: "source",
    label: "Source",
    type: "text",
    placeholder: "e.g. Employer email, learner upload…",
  },
];

function formFields(...fields: PackFieldDef[]): PackFieldDef[] {
  return fields;
}

/** Per-reference schemas. Unknown refs fall back to document defaults. */
const SCHEMA_BY_REF: Record<string, PackItemSchema> = {
  "1.1": {
    reference: "1.1",
    kind: "form",
    fields: formFields(
      {
        key: "ilrReference",
        label: "ILR learner reference",
        type: "text",
      },
      { key: "fundingStream", label: "Funding stream", type: "text" },
      { key: "recordedDate", label: "Recorded date", type: "date" },
    ),
  },
  "1.2": {
    reference: "1.2",
    kind: "form",
    fields: formFields(
      {
        key: "previousSchool",
        label: "Previous school / provider",
        type: "text",
      },
      {
        key: "eligibilityConfirmed",
        label: "Eligibility confirmation notes",
        type: "textarea",
      },
      { key: "formCompletedDate", label: "Form completed", type: "date" },
    ),
  },
  "1.3": {
    reference: "1.3",
    kind: "form",
    fields: formFields(
      { key: "interviewDate", label: "Interview date", type: "date" },
      { key: "interviewer", label: "Interviewed by", type: "text" },
      {
        key: "outcomeNotes",
        label: "Outcome / notes",
        type: "textarea",
      },
    ),
  },
  "1.4": {
    reference: "1.4",
    kind: "document",
    fields: DOCUMENT_FIELDS,
  },
  "1.5": {
    reference: "1.5",
    kind: "form",
    fields: formFields(
      { key: "assessmentDate", label: "Assessment date", type: "date" },
      { key: "assessor", label: "Assessor", type: "text" },
      {
        key: "resultSummary",
        label: "Result summary",
        type: "textarea",
      },
    ),
  },
  "1.6": {
    reference: "1.6",
    kind: "document",
    fields: DOCUMENT_FIELDS,
  },
  "1.7": {
    reference: "1.7",
    kind: "hybrid",
    fields: formFields(
      {
        key: "supportNeeded",
        label: "Support identified",
        type: "textarea",
      },
      { key: "assessmentDate", label: "Assessment date", type: "date" },
      ...DOCUMENT_FIELDS,
    ),
  },
  "2.1": {
    reference: "2.1",
    kind: "form",
    fields: formFields(
      { key: "employerName", label: "Employer", type: "text" },
      {
        key: "trainingNeedsSummary",
        label: "Training needs summary",
        type: "textarea",
      },
      { key: "completedDate", label: "Completed", type: "date" },
    ),
  },
  "2.2": {
    reference: "2.2",
    kind: "document",
    fields: DOCUMENT_FIELDS,
  },
  "2.3": {
    reference: "2.3",
    kind: "document",
    fields: DOCUMENT_FIELDS,
  },
  "2.4": {
    reference: "2.4",
    kind: "hybrid",
    fields: formFields(
      { key: "auditDate", label: "Audit date", type: "date" },
      { key: "auditor", label: "Auditor", type: "text" },
      { key: "outcome", label: "Outcome", type: "textarea" },
      ...DOCUMENT_FIELDS,
    ),
  },
  "3.1": {
    reference: "3.1",
    kind: "document",
    fields: formFields(
      { key: "signedDate", label: "Signed date", type: "date" },
      { key: "signatories", label: "Signatories", type: "text" },
      ...DOCUMENT_FIELDS,
    ),
  },
  "4.1": {
    reference: "4.1",
    kind: "form",
    fields: formFields(
      {
        key: "plannedOtjHours",
        label: "Planned OTJ hours",
        type: "number",
        placeholder: "e.g. 334",
      },
      {
        key: "deliveryModel",
        label: "Delivery model",
        type: "text",
        placeholder: "e.g. Day release Mon–Tue",
      },
      { key: "planStart", label: "Plan start date", type: "date" },
      { key: "planEnd", label: "Plan end date", type: "date" },
      {
        key: "planNotes",
        label: "Plan notes",
        type: "textarea",
      },
    ),
  },
  "4.2": {
    reference: "4.2",
    kind: "document",
    fields: formFields(
      { key: "signedDate", label: "Signed date", type: "date" },
      ...DOCUMENT_FIELDS,
    ),
  },
  "5.1": {
    reference: "5.1",
    kind: "form",
    fields: formFields(
      { key: "inductionDate", label: "Induction date", type: "date" },
      { key: "deliveredBy", label: "Delivered by", type: "text" },
      {
        key: "topicsCovered",
        label: "Topics covered",
        type: "textarea",
      },
    ),
  },
  "6.1": {
    reference: "6.1",
    kind: "form",
    fields: formFields(
      { key: "completionDate", label: "Completion date", type: "date" },
      {
        key: "completionNotes",
        label: "Completion notes",
        type: "textarea",
      },
    ),
  },
  "6.2": { reference: "6.2", kind: "document", fields: DOCUMENT_FIELDS },
  "6.3": { reference: "6.3", kind: "document", fields: DOCUMENT_FIELDS },
  "6.4": { reference: "6.4", kind: "document", fields: DOCUMENT_FIELDS },
  "6.5": { reference: "6.5", kind: "document", fields: DOCUMENT_FIELDS },
  "6.6": { reference: "6.6", kind: "document", fields: DOCUMENT_FIELDS },
  "6.7": { reference: "6.7", kind: "document", fields: DOCUMENT_FIELDS },
  "7.1": {
    reference: "7.1",
    kind: "form",
    fields: formFields(
      { key: "period", label: "Period covered", type: "text" },
      { key: "progressSummary", label: "Progress summary", type: "textarea" },
      { key: "recordedDate", label: "Recorded date", type: "date" },
    ),
  },
  "7.2": {
    reference: "7.2",
    kind: "form",
    fields: formFields(
      { key: "period", label: "Period covered", type: "text" },
      { key: "otjHoursLogged", label: "OTJ hours logged", type: "number" },
      { key: "recordedDate", label: "Recorded date", type: "date" },
    ),
  },
  "7.3": {
    reference: "7.3",
    kind: "document",
    fields: formFields(
      { key: "period", label: "Period covered", type: "text" },
      ...DOCUMENT_FIELDS,
    ),
  },
  "7.4": {
    reference: "7.4",
    kind: "form",
    fields: formFields(
      { key: "reviewDate", label: "Review date", type: "date" },
      { key: "reviewer", label: "Reviewer", type: "text" },
      { key: "reviewNotes", label: "Review notes", type: "textarea" },
    ),
  },
  "7.5": { reference: "7.5", kind: "document", fields: DOCUMENT_FIELDS },
  "7.6": { reference: "7.6", kind: "document", fields: DOCUMENT_FIELDS },
  "7.7": { reference: "7.7", kind: "document", fields: DOCUMENT_FIELDS },
  "7.8": {
    reference: "7.8",
    kind: "hybrid",
    fields: formFields(
      { key: "month", label: "Month", type: "text" },
      { key: "supportSummary", label: "Support summary", type: "textarea" },
      ...DOCUMENT_FIELDS,
    ),
  },
  "8.1": {
    reference: "8.1",
    kind: "hybrid",
    fields: formFields(
      { key: "itemDescription", label: "Item description", type: "textarea" },
      ...DOCUMENT_FIELDS,
    ),
  },
};

export function schemaForReference(reference: string): PackItemSchema {
  return (
    SCHEMA_BY_REF[reference] ?? {
      reference,
      kind: "document" as const,
      fields: DOCUMENT_FIELDS,
    }
  );
}

export function requirementMeta(
  reference: string,
): Adm14RequirementDefinition | undefined {
  return ADM14_REQUIREMENTS.find((r) => r.reference === reference);
}

export function emptyPackItem(
  reference: string,
  endOfProgramme: boolean,
): PackItemRecord {
  return {
    status: endOfProgramme ? "future_requirement" : "missing",
    notes: "",
    dateReceived: "",
    checkedBy: "",
    dateChecked: "",
    evidenceLabel: "",
    fields: {},
    notApplicable: false,
    updatedAt: new Date().toISOString(),
  };
}

function fieldFilled(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * Status is derived from what staff entered — never picked from a dropdown.
 *
 * - Conditional + marked N/A → not_applicable
 * - End-of-programme with no data yet → future_requirement
 * - All schema inputs (and evidence for documents) filled → checked_and_accepted
 * - Anything entered → received
 * - Otherwise → missing
 */
export function derivePackItemStatus(input: {
  endOfProgramme: boolean;
  kind: PackEvidenceKind;
  fields: PackFieldDef[];
  values: Record<string, string>;
  evidenceLabel: string;
  dateReceived: string;
  notes: string;
  notApplicable: boolean;
}): EvidenceRequirementStatus {
  if (input.notApplicable) return "not_applicable";

  const schemaComplete = input.fields.every((field) =>
    fieldFilled(input.values[field.key]),
  );
  const needsEvidence = input.kind === "document" || input.kind === "hybrid";
  const evidenceOk = !needsEvidence || fieldFilled(input.evidenceLabel);
  const anyInput =
    fieldFilled(input.evidenceLabel) ||
    fieldFilled(input.dateReceived) ||
    fieldFilled(input.notes) ||
    Object.values(input.values).some(fieldFilled);

  if (input.endOfProgramme && !anyInput) return "future_requirement";

  if (schemaComplete && evidenceOk && anyInput) {
    return "checked_and_accepted";
  }
  if (anyInput) return "received";
  return "missing";
}

export function kindLabel(kind: PackEvidenceKind): string {
  switch (kind) {
    case "form":
      return "Form data";
    case "document":
      return "Document evidence";
    case "hybrid":
      return "Form + document";
  }
}
