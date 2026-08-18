/**
 * Cohort / intake helpers.
 *
 * A cohort is an administrative intake grouping (programme + Skills England
 * version + intake start). It does not own an apprentice's individual timeline.
 */

import { formatCohortProductLabel, type DeliverySpine } from "./cohort-products";
import { enrolmentOpensFromIntakeStart } from "./programme-duration";
import type { AdminCohortRecord, AdminProgrammeRecord } from "./types";

const INTAKE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatIntakeMonthYear(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${INTAKE_MONTHS[monthIndex]} ${year}`;
}

function formatVersionLabel(version: string): string | null {
  const trimmed = version.trim().replace(/^v/i, "");
  if (!trimmed) return null;
  return `v${trimmed}`;
}

/** "Autocare Level 2" → "Autocare L2" */
export function programmeShortLabel(name: string): string {
  return name
    .replace(/\bLevel\s+(\d+)\b/gi, "L$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Intake identity — programme, Skills England product, intake month/year.
 * Does not include a shared expected-end date.
 */
export function buildCohortName(input: {
  programmeName: string;
  standardCode?: string;
  standardVersion?: string;
  deliverySpine?: DeliverySpine | string;
  startDate: string;
}): string {
  const programme = programmeShortLabel(input.programmeName);
  const when = formatIntakeMonthYear(input.startDate);
  if (!programme || !when) return "";

  const code = input.standardCode?.trim().toUpperCase() ?? "";
  const programmePart = code ? `${programme} (${code})` : programme;
  const parts = [programmePart];

  const product = formatCohortProductLabel(
    input.standardVersion ?? "",
    input.deliverySpine,
  );
  if (product) {
    parts.push(product);
  } else {
    const version = formatVersionLabel(input.standardVersion ?? "");
    if (version) parts.push(version);
  }

  parts.push(`${when} Intake`);
  return parts.join(" · ");
}

export type CompatibleCohort = Pick<
  AdminCohortRecord,
  "id" | "standardCode" | "standardVersion" | "startDate" | "status"
>;

export type CohortSuggestion = {
  cohort: CompatibleCohort | null;
  reason: "matched" | "review";
  message: string;
};

function compatibleCohorts(
  cohorts: CompatibleCohort[],
  standardCode: string,
): CompatibleCohort[] {
  const code = standardCode.trim().toUpperCase();
  return cohorts
    .filter(
      (c) =>
        c.standardCode.toUpperCase() === code &&
        Boolean(c.startDate) &&
        c.status !== "completed",
    )
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Suggest the intake whose window contains the learner's apprenticeship start.
 *
 * Window: this cohort's Intake Start until the next compatible cohort's Intake
 * Start (exclusive). The last cohort's window is open-ended.
 *
 * Does not use record creation date, employer, teaching group, or expected end.
 * Does not invent a cohort when no window matches.
 */
export function suggestCohortForLearnerStart(args: {
  cohorts: CompatibleCohort[];
  standardCode: string;
  apprenticeshipStartDate: string;
}): CohortSuggestion {
  const start = args.apprenticeshipStartDate.slice(0, 10);
  if (!start || !args.standardCode.trim()) {
    return {
      cohort: null,
      reason: "review",
      message: "Choose an apprenticeship and apprenticeship start date first.",
    };
  }

  const eligible = compatibleCohorts(args.cohorts, args.standardCode);
  if (eligible.length === 0) {
    return {
      cohort: null,
      reason: "review",
      message:
        "No compatible intake exists for this apprenticeship. Assign a cohort manually, or create one first.",
    };
  }

  const earliest = eligible[0];
  if (start < earliest.startDate) {
    return {
      cohort: null,
      reason: "review",
      message: `This start date is before the earliest compatible intake (${earliest.startDate}). Do not assign them to a later intake automatically — review placement.`,
    };
  }

  for (let i = 0; i < eligible.length; i += 1) {
    const current = eligible[i];
    const next = eligible[i + 1];
    const inWindow =
      start >= current.startDate && (!next || start < next.startDate);
    if (!inWindow) continue;

    const sameStart = eligible.filter((c) => c.startDate === current.startDate);
    if (sameStart.length > 1) {
      return {
        cohort: null,
        reason: "review",
        message:
          "More than one compatible intake starts on this date. Staff must confirm which intake applies.",
      };
    }

    return {
      cohort: current,
      reason: "matched",
      message: `Suggested intake from apprenticeship start ${start}.`,
    };
  }

  return {
    cohort: null,
    reason: "review",
    message:
      "No compatible intake window contains this apprenticeship start date. Staff must confirm placement.",
  };
}

/** True when the learner's own start date has been reached. */
export function hasApprenticeshipStarted(
  startDate: string,
  onDate: string = new Date().toISOString().slice(0, 10),
): boolean {
  return Boolean(startDate && startDate.slice(0, 10) <= onDate);
}

/**
 * Fields that may follow a cohort assignment.
 * Never includes learner start, planned end, week/year, tutor, or college days.
 */
export function cohortAssignmentPatch(
  cohort: Pick<
    AdminCohortRecord,
    "id" | "programmeId" | "programmeName" | "standardCode"
  > | null,
  programmes: Pick<AdminProgrammeRecord, "id" | "name">[] = [],
): {
  cohortId: string | null;
  programmeName?: string;
  standardCode?: string;
} {
  if (!cohort) return { cohortId: null };
  const programme = programmes.find((p) => p.id === cohort.programmeId);
  return {
    cohortId: cohort.id,
    programmeName: programme?.name ?? cohort.programmeName,
    standardCode: cohort.standardCode,
  };
}

export { enrolmentOpensFromIntakeStart };
