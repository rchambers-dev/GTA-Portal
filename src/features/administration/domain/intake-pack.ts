/**
 * Evidence pack model for the Apprentice Intake funnel.
 *
 * Reuses the canonical ADM14.0 checklist (the same sections shown on the
 * shared Apprentices pack page). Each apprentice carries a per-item status map;
 * items not yet touched default to "missing" (or "future" for end-of-
 * programme items), so the pack fills up over the apprentice's lifecycle
 * rather than being keyed all at once on day one.
 */

import {
  ADM14_REQUIREMENTS,
  type Adm14RequirementDefinition,
} from "@/features/apprentice-lifecycle/domain/adm14-checklist";
import type { AdminApprenticeRecord, AdminPackItemStatus } from "./types";

export type { Adm14RequirementDefinition };

/**
 * PROVISIONAL — items that must be in place before an apprentice can be moved
 * onto a programme.
 *
 * GTA admin team are highlighting the definitive per-section list (expected
 * Monday). Until then Intake only gates on personal details (name / DOB /
 * email). Keep this array as the single place to drop Monday's list into —
 * enrolment / Apprentices pack gating can then use it without a redesign.
 */
export const PRE_START_REQUIRED_REFERENCES: string[] = [
  "1.1", // ILR
  "1.2", // Apprentice Enrolment Form
  "1.3", // Apprentice Interview Form
  "1.4", // Initial Assessment – BKSB Report
  "1.5", // Initial Assessment – KSB Testing Record
  "1.6", // Initial Assessment – PLR Report
  "2.1", // Employer TNA
  "2.2", // Employer Recruit an Apprentice Declaration
  "3.1", // Apprenticeship Agreement
  "4.1", // Training Plan
  "4.2", // Contract for Services
];

export type PackSection = {
  key: string;
  title: string;
  bookletSection: string;
  items: Adm14RequirementDefinition[];
};

/** ADM14 sections in booklet order, each with its items. */
export const PACK_SECTIONS: PackSection[] = ADM14_REQUIREMENTS.reduce(
  (sections, item) => {
    const existing = sections.find((s) => s.key === item.sectionKey);
    if (existing) {
      existing.items.push(item);
    } else {
      sections.push({
        key: item.sectionKey,
        title: item.sectionTitle,
        bookletSection: item.originalBookletSection,
        items: [item],
      });
    }
    return sections;
  },
  [] as PackSection[],
);

export function requirementFor(
  reference: string,
): Adm14RequirementDefinition | undefined {
  return ADM14_REQUIREMENTS.find((r) => r.reference === reference);
}

export function isPreStartRequired(reference: string): boolean {
  return PRE_START_REQUIRED_REFERENCES.includes(reference);
}

/** Effective status for an item, applying defaults for untouched entries. */
export function packItemStatus(
  apprentice: AdminApprenticeRecord,
  item: Adm14RequirementDefinition,
): AdminPackItemStatus | "future" {
  const stored = apprentice.pack[item.reference];
  if (stored) return stored;
  return item.endOfProgramme ? "future" : "missing";
}

/** An item counts as "in place" once received or checked, or ruled N/A. */
export function packItemSatisfied(
  status: AdminPackItemStatus | "future",
): boolean {
  return (
    status === "received" || status === "checked" || status === "not_applicable"
  );
}

export type PackSectionProgress = {
  section: PackSection;
  satisfied: number;
  total: number;
  /** Pre-start required items in this section still outstanding. */
  requiredOutstanding: number;
};

export function packSectionProgress(
  apprentice: AdminApprenticeRecord,
): PackSectionProgress[] {
  return PACK_SECTIONS.map((section) => {
    let satisfied = 0;
    let requiredOutstanding = 0;
    for (const item of section.items) {
      const status = packItemStatus(apprentice, item);
      const done = packItemSatisfied(status);
      if (done) satisfied += 1;
      if (!done && isPreStartRequired(item.reference)) requiredOutstanding += 1;
    }
    return {
      section,
      satisfied,
      total: section.items.length,
      requiredOutstanding,
    };
  });
}

export type PackTotals = {
  satisfied: number;
  total: number;
  requiredOutstanding: number;
};

export function packTotals(apprentice: AdminApprenticeRecord): PackTotals {
  return packSectionProgress(apprentice).reduce<PackTotals>(
    (totals, entry) => ({
      satisfied: totals.satisfied + entry.satisfied,
      total: totals.total + entry.total,
      requiredOutstanding:
        totals.requiredOutstanding + entry.requiredOutstanding,
    }),
    { satisfied: 0, total: 0, requiredOutstanding: 0 },
  );
}

/** Identity fields intake can't finish without. */
export function missingPersonalFields(apprentice: AdminApprenticeRecord): string[] {
  const missing: string[] = [];
  if (!apprentice.displayName.trim()) missing.push("full name");
  if (!apprentice.dateOfBirth) missing.push("date of birth");
  if (!apprentice.email.trim()) missing.push("email");
  if (!apprentice.uln.trim()) missing.push("ULN");
  if (!apprentice.addressLine1.trim() || !apprentice.postcode.trim()) {
    missing.push("address");
  }
  if (!apprentice.emergencyContactName.trim()) missing.push("emergency contact");
  return missing;
}

/**
 * Everything still stopping intake from being signed off.
 * Progressive pack documents are chased on Apprentices — not here.
 */
export function intakeCompletionBlockers(
  apprentice: AdminApprenticeRecord,
): string[] {
  return missingPersonalFields(apprentice).filter((field) =>
    ["full name", "date of birth", "email"].includes(field),
  );
}

/**
 * Everything still blocking this apprentice from being moved onto a programme.
 * Intake sign-off covers the document detail, so this stays coarse.
 */
export function enrolmentBlockers(apprentice: AdminApprenticeRecord): string[] {
  const blockers: string[] = [];
  if (apprentice.intakeStatus !== "ready") {
    blockers.push("intake still in progress");
  }
  if (!apprentice.dateOfBirth) blockers.push("date of birth");
  if (!apprentice.email) blockers.push("email");
  return blockers;
}

/** Ready apprentices who haven't been put on a programme yet. */
export function awaitingEnrolment(
  apprentices: AdminApprenticeRecord[],
  enrolledApprenticeIds: Array<string | null>,
): AdminApprenticeRecord[] {
  return apprentices.filter(
    (apprentice) =>
      apprentice.intakeStatus === "ready" &&
      !enrolledApprenticeIds.includes(apprentice.id),
  );
}

export function isReadyToStart(apprentice: AdminApprenticeRecord): boolean {
  return enrolmentBlockers(apprentice).length === 0;
}
