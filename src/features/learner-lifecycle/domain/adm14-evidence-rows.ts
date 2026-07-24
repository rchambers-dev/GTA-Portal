import type {
  EvidenceRequirementRowDto,
  EvidenceRequirementStatus,
} from "../types";
import { ADM14_REQUIREMENTS } from "./adm14-checklist";

type SeedOverride = {
  status: EvidenceRequirementStatus;
  dateReceived?: string | null;
  checkedBy?: string | null;
  dateChecked?: string | null;
  notes?: string | null;
  evidenceCount?: number;
};

/**
 * Demo status overlays keyed by ADM14 reference.
 * Missing keys default to future/missing depending on section.
 */
const DEMO_OVERRIDES: Record<string, SeedOverride> = {
  "1.1": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-03",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-04",
    evidenceCount: 1,
  },
  "1.2": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-02",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-04",
    evidenceCount: 1,
  },
  "1.3": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-02",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-04",
    evidenceCount: 1,
  },
  "1.4": { status: "missing", evidenceCount: 0 },
  "1.5": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-07",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-08",
    evidenceCount: 1,
  },
  "1.6": {
    status: "received",
    dateReceived: "2024-06-07",
    evidenceCount: 1,
  },
  "1.7": {
    status: "not_applicable",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-08",
    notes: "No ALS need identified at initial assessment",
    evidenceCount: 0,
  },
  "2.1": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-05",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-06",
    evidenceCount: 1,
  },
  "2.2": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-05",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-06",
    evidenceCount: 1,
  },
  "2.3": {
    status: "not_applicable",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-06",
    notes: "Employer headcount above waiver threshold",
    evidenceCount: 0,
  },
  "2.4": {
    status: "due_for_review",
    dateReceived: "2024-06-05",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-08",
    notes: "Annual review due",
    evidenceCount: 1,
  },
  "3.1": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-10",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-10",
    evidenceCount: 1,
  },
  "4.1": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-10",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-11",
    evidenceCount: 1,
  },
  "4.2": {
    status: "awaiting_check",
    dateReceived: "2024-06-10",
    evidenceCount: 1,
  },
  "5.1": {
    status: "checked_and_accepted",
    dateReceived: "2024-06-12",
    checkedBy: "S. Patel",
    dateChecked: "2024-06-12",
    evidenceCount: 1,
  },
  "7.1": {
    status: "received",
    dateReceived: "2024-09-01",
    evidenceCount: 3,
  },
  "7.2": {
    status: "received",
    dateReceived: "2024-09-01",
    evidenceCount: 3,
  },
  "7.3": {
    status: "due_for_review",
    dateReceived: "2024-09-01",
    checkedBy: "R. Chambers",
    dateChecked: "2024-09-05",
    notes: "OTJ hours trailing planned profile",
    evidenceCount: 4,
  },
  "7.4": {
    status: "due_for_review",
    dateReceived: "2024-09-12",
    checkedBy: "S. Patel",
    dateChecked: "2024-09-12",
    notes: "5 records — next review due shortly",
    evidenceCount: 5,
  },
  "7.5": { status: "not_applicable", evidenceCount: 0 },
  "7.6": { status: "not_applicable", evidenceCount: 0 },
  "7.7": { status: "not_applicable", evidenceCount: 0 },
  "7.8": { status: "not_applicable", evidenceCount: 0 },
  "8.1": { status: "not_applicable", evidenceCount: 0 },
};

/**
 * Build the full ADM14 checklist for a learner workspace.
 * End-of-programme (Section 6) items stay as future requirements until relevant.
 */
export function buildAdm14EvidenceRows(options?: {
  includeEndOfProgrammeAsFuture?: boolean;
}): EvidenceRequirementRowDto[] {
  const includeEndAsFuture = options?.includeEndOfProgrammeAsFuture ?? true;

  return ADM14_REQUIREMENTS.map((def) => {
    const override = DEMO_OVERRIDES[def.reference];
    const defaultStatus: EvidenceRequirementStatus =
      def.endOfProgramme && includeEndAsFuture
        ? "future_requirement"
        : "missing";

    const status = override?.status ?? defaultStatus;

    return {
      id: `req-${def.reference}`,
      sectionKey: def.sectionKey,
      sectionTitle: def.sectionTitle,
      originalBookletSection: def.originalBookletSection,
      reference: def.reference,
      requirementKind: def.requirementKind,
      title: def.title,
      applicability: def.applicability,
      status,
      dateReceived: override?.dateReceived ?? null,
      checkedBy: override?.checkedBy ?? null,
      dateChecked: override?.dateChecked ?? null,
      notes: override?.notes ?? null,
      evidenceCount: override?.evidenceCount ?? 0,
      isRecurring: def.isRecurring,
    };
  });
}
