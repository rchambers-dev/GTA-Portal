export const COLLEGE_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export type CollegeWeekday = (typeof COLLEGE_WEEKDAYS)[number];

const COLLEGE_DAY_ALIASES: Record<string, CollegeWeekday> = {
  monday: "Monday",
  mon: "Monday",
  tuesday: "Tuesday",
  tue: "Tuesday",
  tues: "Tuesday",
  wednesday: "Wednesday",
  wed: "Wednesday",
  thursday: "Thursday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  friday: "Friday",
  fri: "Friday",
};

export function parseCollegeDays(value: string): CollegeWeekday[] {
  if (!value.trim()) return [];
  const selected = new Set<CollegeWeekday>();
  for (const token of value.split(/[,&/|]+/)) {
    const key = token.trim().toLowerCase().replace(/\.$/, "");
    const day = COLLEGE_DAY_ALIASES[key];
    if (day) selected.add(day);
  }
  return COLLEGE_WEEKDAYS.filter((day) => selected.has(day));
}

export function formatCollegeDays(days: readonly string[]): string {
  return COLLEGE_WEEKDAYS.filter((day) => days.includes(day)).join(", ");
}

/** Short labels for cohort names, e.g. "Mon, Tue". */
export function formatCollegeDaysShort(value: string): string {
  return parseCollegeDays(value)
    .map((day) => day.slice(0, 3))
    .join(", ");
}

/** True when two college-day strings share any weekday. */
export function collegeDaysOverlap(a: string, b: string): boolean {
  const left = new Set(parseCollegeDays(a));
  if (left.size === 0) return false;
  return parseCollegeDays(b).some((day) => left.has(day));
}

export function toggleCollegeDay(value: string, day: CollegeWeekday): string {
  const current = parseCollegeDays(value);
  const next = current.includes(day)
    ? current.filter((d) => d !== day)
    : [...current, day];
  return formatCollegeDays(next);
}
