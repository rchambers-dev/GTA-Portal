/** Due pill for a review, matching the Review Assistant's week rules. */

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

export function weekStartMonday(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  return addDays(iso, -delta);
}

export function formatWeeksAndDays(totalDays: number): string {
  const days = Math.max(0, Math.round(Math.abs(Number(totalDays) || 0)));
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const weekLabel = weeks === 1 ? "1 week" : `${weeks} weeks`;
  const dayLabel = rest === 1 ? "1 day" : `${rest} days`;
  if (!weeks && !rest) return "0 days";
  if (!weeks) return dayLabel;
  if (!rest) return weekLabel;
  return `${weekLabel} ${dayLabel}`;
}

export type DueState = "overdue" | "due-soon" | "ok" | "unknown";

export function reviewDueLabel(input: {
  today: string;
  nextDate: string | null;
  intervalWeeks: number;
}): { state: DueState; label: string; daysUntil: number; nextDate: string | null } {
  if (!input.nextDate) {
    return { state: "unknown", label: "Not set", daysUntil: Number.POSITIVE_INFINITY, nextDate: null };
  }
  const start = weekStartMonday(input.nextDate);
  const end = addDays(start, 6);
  const untilEnd = daysFrom(input.today, end);
  const untilStart = daysFrom(input.today, start);
  if (untilEnd < 0) {
    return {
      state: "overdue",
      label: `Overdue · ${formatWeeksAndDays(untilEnd)}`,
      daysUntil: untilEnd,
      nextDate: input.nextDate,
    };
  }
  if (untilStart <= 0) {
    return { state: "due-soon", label: "Due this week", daysUntil: untilEnd, nextDate: input.nextDate };
  }
  return {
    state: "ok",
    label: `Within ${input.intervalWeeks} weeks`,
    daysUntil: untilEnd,
    nextDate: input.nextDate,
  };
}

export function formatShortNumericDate(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day}/${month}/${String(year).slice(-2)}`;
}

export function planDateParts(iso: string): { day: number; ordinal: string; month: string } {
  const day = Number(iso.slice(8, 10));
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
  const teen = day % 100;
  const ordinal = teen >= 11 && teen <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] || "th";
  return { day, ordinal, month };
}

function daysFrom(today: string, target: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${target}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function nextReviewDate(input: {
  lastActual: string | null;
  planned: string | null;
  intervalWeeks: number;
}): string | null {
  if (input.lastActual) return addDays(input.lastActual, input.intervalWeeks * 7);
  return input.planned;
}

export function minutesToTime(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "";
  const whole = Math.round(minutes);
  const hour = Math.floor(whole / 60);
  const minute = whole % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
}

export function methodLabel(method: string | null): string {
  if (method === "teams") return "Teams";
  if (method === "phone") return "Phone call";
  return "In person";
}

export function formatPlanDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
