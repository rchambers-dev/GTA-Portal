/**
 * Programme-week column date ranges.
 *
 * Board columns are programme weeks (1–156), not a single shared calendar for every
 * learner. Until cohort/programme filters drive the anchor, dates are week-commencing
 * (Monday–Sunday) from a configurable Week 1 Monday.
 *
 * Prefer Mon–Sun over Mon–Mon: staff read “13–19 Jun” as a full week more easily
 * than an exclusive end date of the following Monday.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Default Week 1 Monday for fictional / shell board calendar (UTC noon avoids DST shifts). */
export const DEFAULT_PROGRAMME_WEEK_1_MONDAY = new Date(Date.UTC(2024, 5, 3, 12, 0, 0));

export function startOfUtcMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

export function programmeWeekDateRange(
  weekNumber: number,
  week1Monday: Date = DEFAULT_PROGRAMME_WEEK_1_MONDAY,
): { start: Date; end: Date } {
  const monday = startOfUtcMonday(week1Monday);
  const start = new Date(monday.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
  const end = new Date(start.getTime() + 6 * MS_PER_DAY);
  return { start, end };
}

const MONTHS_SHORT = [
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

/** e.g. "3 – 9 Jun 2024" or "28 Jun – 4 Jul 2024" or "29 Dec 2025 – 4 Jan 2026" */
export function formatWeekDateRangeLabel(start: Date, end: Date): string {
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS_SHORT[start.getUTCMonth()];
  const endMonth = MONTHS_SHORT[end.getUTCMonth()];
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  }
  return `${startDay} – ${endDay} ${startMonth} ${startYear}`;
}

export function programmeWeekColumnLabel(weekNumber: number): string {
  return `Week ${weekNumber}`;
}

export function programmeWeekColumnSublabel(
  weekNumber: number,
  week1Monday: Date = DEFAULT_PROGRAMME_WEEK_1_MONDAY,
): string {
  const { start, end } = programmeWeekDateRange(weekNumber, week1Monday);
  return formatWeekDateRangeLabel(start, end);
}

/** Week immediately before programme Week 1 (Mon–Sun). */
export function preStartColumnSublabel(
  week1Monday: Date = DEFAULT_PROGRAMME_WEEK_1_MONDAY,
): string {
  const monday = startOfUtcMonday(week1Monday);
  const start = new Date(monday.getTime() - 7 * MS_PER_DAY);
  const end = new Date(monday.getTime() - MS_PER_DAY);
  return formatWeekDateRangeLabel(start, end);
}
