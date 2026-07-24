/**
 * Programme week calculation from learner start date.
 *
 * Board column = elapsed programme week for that learner (not a shared cohort calendar).
 * Break-in-learning rules are not applied yet (see Q17).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_PROGRAMME_WEEK = 156;

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0),
  );
}

/**
 * Programme week 1 = the UTC week containing programmeStartDate (Mon–Sun aligned
 * via whole days from start). Day 0–6 → week 1, 7–13 → week 2, etc.
 */
export function calculateProgrammeWeek(
  programmeStartDate: Date,
  asOfDate: Date = new Date(),
): number | null {
  const start = startOfUtcDay(programmeStartDate);
  const asOf = startOfUtcDay(asOfDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(asOf.getTime())) {
    return null;
  }

  if (asOf < start) {
    return null; // still pre-start
  }

  const daysElapsed = Math.floor((asOf.getTime() - start.getTime()) / MS_PER_DAY);
  const week = Math.floor(daysElapsed / 7) + 1;
  return Math.min(week, MAX_PROGRAMME_WEEK);
}

export function isProgrammeOverdue(
  originalPlannedEndDate: Date,
  asOfDate: Date = new Date(),
  programmeStatus?: string,
): boolean {
  if (programmeStatus === "completed" || programmeStatus === "withdrawn") {
    return false;
  }
  const end = startOfUtcDay(originalPlannedEndDate);
  const asOf = startOfUtcDay(asOfDate);
  return asOf > end;
}

export function formatOverdueDuration(
  originalPlannedEndDate: Date,
  asOfDate: Date = new Date(),
): string {
  const end = startOfUtcDay(originalPlannedEndDate);
  const asOf = startOfUtcDay(asOfDate);
  const days = Math.max(0, Math.floor((asOf.getTime() - end.getTime()) / MS_PER_DAY));

  if (days === 0) return "Overdue today";
  if (days < 7) return `Overdue by ${days} day${days === 1 ? "" : "s"}`;

  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  if (weeks < 8) {
    if (remDays === 0) return `Overdue by ${weeks} week${weeks === 1 ? "" : "s"}`;
    return `Overdue by ${weeks} week${weeks === 1 ? "" : "s"} and ${remDays} day${remDays === 1 ? "" : "s"}`;
  }

  const months = Math.floor(days / 30);
  const remAfterMonths = days % 30;
  const remWeeks = Math.floor(remAfterMonths / 7);
  if (remWeeks === 0) return `Overdue by ${months} month${months === 1 ? "" : "s"}`;
  return `Overdue by ${months} month${months === 1 ? "" : "s"} and ${remWeeks} week${remWeeks === 1 ? "" : "s"}`;
}

export function formatDisplayDate(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ] as const;
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
