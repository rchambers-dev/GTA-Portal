/**
 * Programme week calculation from apprentice start date.
 *
 * Board column = elapsed programme week for that apprentice (not a shared cohort calendar).
 * Break-in-learning rules are not applied yet (see Q17).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_PROGRAMME_WEEK = 156;
const WEEKS_PER_PROGRAMME_YEAR = 52;

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0),
  );
}

function parseProgrammeDate(value: Date | string): Date {
  if (value instanceof Date) return startOfUtcDay(value);
  // ISO date-only → noon UTC to avoid DST/edge shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfUtcDay(new Date(`${value}T12:00:00Z`));
  }
  return startOfUtcDay(new Date(value));
}

/**
 * Programme week 1 = the UTC week containing programmeStartDate.
 * Day 0–6 → week 1, 7–13 → week 2, etc. Null when still before start.
 */
export function calculateProgrammeWeek(
  programmeStartDate: Date | string,
  asOfDate: Date | string = new Date(),
): number | null {
  const start = parseProgrammeDate(programmeStartDate);
  const asOf = parseProgrammeDate(asOfDate);

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

/** Programme year 1–3 from elapsed week (≈52 weeks per year). */
export function calculateProgrammeYear(programmeWeek: number | null): number | null {
  if (programmeWeek == null || programmeWeek < 1) return null;
  return Math.min(3, Math.ceil(programmeWeek / WEEKS_PER_PROGRAMME_YEAR));
}

/** Whole days since start (0 on start day). Null before start. */
export function calculateDaysOnProgramme(
  programmeStartDate: Date | string,
  asOfDate: Date | string = new Date(),
): number | null {
  const start = parseProgrammeDate(programmeStartDate);
  const asOf = parseProgrammeDate(asOfDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(asOf.getTime())) return null;
  if (asOf < start) return null;
  return Math.floor((asOf.getTime() - start.getTime()) / MS_PER_DAY);
}

/** Days until start when still in the future. Null once started / invalid. */
export function calculateDaysUntilStart(
  programmeStartDate: Date | string,
  asOfDate: Date | string = new Date(),
): number | null {
  const start = parseProgrammeDate(programmeStartDate);
  const asOf = parseProgrammeDate(asOfDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(asOf.getTime())) return null;
  if (asOf >= start) return null;
  return Math.floor((start.getTime() - asOf.getTime()) / MS_PER_DAY);
}

/**
 * Human duration on programme, e.g. "1 year 7 months", "3 weeks", "Started today".
 * Null before start.
 */
export function formatTimeOnProgramme(
  programmeStartDate: Date | string,
  asOfDate: Date | string = new Date(),
): string | null {
  const days = calculateDaysOnProgramme(programmeStartDate, asOfDate);
  if (days == null) return null;
  if (days === 0) return "Started today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;

  const weeks = Math.floor(days / 7);
  if (weeks < 8) {
    const remDays = days % 7;
    if (remDays === 0) return `${weeks} week${weeks === 1 ? "" : "s"}`;
    return `${weeks} week${weeks === 1 ? "" : "s"} ${remDays} day${remDays === 1 ? "" : "s"}`;
  }

  const months = Math.floor(days / 30.4375);
  if (months < 12) {
    const remWeeks = Math.floor((days - Math.floor(months * 30.4375)) / 7);
    if (remWeeks === 0) return `${months} month${months === 1 ? "" : "s"}`;
    return `${months} month${months === 1 ? "" : "s"} ${remWeeks} week${remWeeks === 1 ? "" : "s"}`;
  }

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${remMonths} month${remMonths === 1 ? "" : "s"}`;
}

export function formatProgrammeWeekLabel(
  programmeWeek: number | null,
  programmeYear: number | null = calculateProgrammeYear(programmeWeek),
): string {
  if (programmeWeek == null) return "Pre-start";
  if (programmeYear != null) return `Y${programmeYear} · Week ${programmeWeek}`;
  return `Week ${programmeWeek}`;
}

/** Live timing snapshot used by packs, boards, and search. */
export function describeProgrammeTiming(
  programmeStartDate: Date | string | null | undefined,
  asOfDate: Date | string = new Date(),
): {
  week: number | null;
  year: number | null;
  weekLabel: string;
  timeOnProgramme: string | null;
  daysUntilStart: number | null;
  hasStarted: boolean;
} {
  if (!programmeStartDate) {
    return {
      week: null,
      year: null,
      weekLabel: "Pre-start",
      timeOnProgramme: null,
      daysUntilStart: null,
      hasStarted: false,
    };
  }

  const week = calculateProgrammeWeek(programmeStartDate, asOfDate);
  const year = calculateProgrammeYear(week);
  const daysUntilStart = calculateDaysUntilStart(programmeStartDate, asOfDate);
  const timeOnProgramme = formatTimeOnProgramme(programmeStartDate, asOfDate);

  return {
    week,
    year,
    weekLabel:
      week == null && daysUntilStart != null
        ? daysUntilStart === 0
          ? "Starts today"
          : `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`
        : formatProgrammeWeekLabel(week, year),
    timeOnProgramme,
    daysUntilStart,
    hasStarted: week != null,
  };
}

export function isProgrammeOverdue(
  originalPlannedEndDate: Date | string,
  asOfDate: Date | string = new Date(),
  programmeStatus?: string,
): boolean {
  if (programmeStatus === "completed" || programmeStatus === "withdrawn") {
    return false;
  }
  const end = parseProgrammeDate(originalPlannedEndDate);
  const asOf = parseProgrammeDate(asOfDate);
  return asOf > end;
}

export function formatOverdueDuration(
  originalPlannedEndDate: Date | string,
  asOfDate: Date | string = new Date(),
): string {
  const end = parseProgrammeDate(originalPlannedEndDate);
  const asOf = parseProgrammeDate(asOfDate);
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
