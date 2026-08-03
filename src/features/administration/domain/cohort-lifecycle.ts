import type { AdminCohortRecord } from "./types";

/** Intake has begun — Skills England standardVersion must not change. */
export function isCohortStarted(
  cohort: Pick<AdminCohortRecord, "status" | "startDate">,
  onDate: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (cohort.status === "active" || cohort.status === "completed") return true;
  return Boolean(cohort.startDate && cohort.startDate <= onDate);
}

export const COHORT_LOCKED_MESSAGE =
  "This cohort is locked. Unlock it first if you need to change details, groups, or placements.";

export const COHORT_VERSION_FROZEN_MESSAGE =
  "Standard version and delivery spine cannot change once this cohort has started.";
