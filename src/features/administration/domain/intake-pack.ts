/**
 * Evidence pack model for the learner intake funnel.
 *
 * Reuses the canonical ADM14.0 checklist (the same sections shown on the
 * shared Learners pack page). Each learner carries a per-item status map;
 * items not yet touched default to "missing" (or "future" for end-of-
 * programme items), so the pack fills up over the learner's lifecycle
 * rather than being keyed all at once on day one.
 */

import {
  ADM14_REQUIREMENTS,
  type Adm14RequirementDefinition,
} from "@/features/learner-lifecycle/domain/adm14-checklist";
import type { AdminLearnerRecord, AdminPackItemStatus } from "./types";

export type { Adm14RequirementDefinition };

/**
 * PROVISIONAL — items that must be in place before a learner can be moved
 * onto a programme. The GTA admin team are highlighting the definitive
 * per-section list (expected Monday); update this array when that lands.
 */
export const PRE_START_REQUIRED_REFERENCES: string[] = [
  "1.1", // ILR
  "1.2", // Learner Enrolment Form
  "1.3", // Learner Interview Form
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
  learner: AdminLearnerRecord,
  item: Adm14RequirementDefinition,
): AdminPackItemStatus | "future" {
  const stored = learner.pack[item.reference];
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
  learner: AdminLearnerRecord,
): PackSectionProgress[] {
  return PACK_SECTIONS.map((section) => {
    let satisfied = 0;
    let requiredOutstanding = 0;
    for (const item of section.items) {
      const status = packItemStatus(learner, item);
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

export function packTotals(learner: AdminLearnerRecord): PackTotals {
  return packSectionProgress(learner).reduce<PackTotals>(
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
export function missingPersonalFields(learner: AdminLearnerRecord): string[] {
  const missing: string[] = [];
  if (!learner.displayName.trim()) missing.push("full name");
  if (!learner.dateOfBirth) missing.push("date of birth");
  if (!learner.email.trim()) missing.push("email");
  if (!learner.uln.trim()) missing.push("ULN");
  if (!learner.addressLine1.trim() || !learner.postcode.trim()) {
    missing.push("address");
  }
  if (!learner.emergencyContactName.trim()) missing.push("emergency contact");
  return missing;
}

/**
 * Everything still stopping intake from being signed off: identity fields
 * plus the pre-start required pack items walked through during intake.
 */
export function intakeCompletionBlockers(
  learner: AdminLearnerRecord,
): string[] {
  const blockers = missingPersonalFields(learner);
  for (const reference of PRE_START_REQUIRED_REFERENCES) {
    const item = requirementFor(reference);
    if (!item) continue;
    if (!packItemSatisfied(packItemStatus(learner, item))) {
      blockers.push(`${item.reference} ${item.title}`);
    }
  }
  return blockers;
}

/**
 * Everything still blocking this learner from being moved onto a programme.
 * Intake sign-off covers the document detail, so this stays coarse.
 */
export function enrolmentBlockers(learner: AdminLearnerRecord): string[] {
  const blockers: string[] = [];
  if (learner.intakeStatus !== "ready") {
    blockers.push("intake still in progress");
  }
  if (!learner.dateOfBirth) blockers.push("date of birth");
  if (!learner.email) blockers.push("email");
  return blockers;
}

/** Ready learners who haven't been put on a programme yet. */
export function awaitingEnrolment(
  learners: AdminLearnerRecord[],
  enrolledLearnerIds: Array<string | null>,
): AdminLearnerRecord[] {
  return learners.filter(
    (learner) =>
      learner.intakeStatus === "ready" &&
      !enrolledLearnerIds.includes(learner.id),
  );
}

export function isReadyToStart(learner: AdminLearnerRecord): boolean {
  return enrolmentBlockers(learner).length === 0;
}
