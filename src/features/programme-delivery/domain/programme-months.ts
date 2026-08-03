/**
 * Calendar-month programme dating for groups-spine trackers (MV personal tracking).
 * Blocks use programme weeks; groups use month brackets from the sheet.
 */

import { startOfUtcDay } from "@/features/apprentice-lifecycle/domain/programme-week";

function parseIsoDay(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfUtcDay(new Date(`${value}T12:00:00.000Z`));
  }
  return startOfUtcDay(new Date(value));
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add whole calendar months to an ISO date (day-of-month clamped). */
export function addCalendarMonthsIso(startIso: string, months: number): string {
  const start = parseIsoDay(startIso);
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1, 12, 0, 0));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return toIsoDay(target);
}

/**
 * Whole months elapsed since programme start (0 on start month day).
 * Uses calendar month difference, then clamps by day-of-month.
 */
export function programmeMonthsElapsed(
  programmeStartIso: string,
  asOfIso?: string,
): number {
  const start = parseIsoDay(programmeStartIso);
  const asOf = parseIsoDay(asOfIso ?? new Date().toISOString().slice(0, 10));
  if (asOf < start) return -1;

  let months =
    (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - start.getUTCMonth());

  if (asOf.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * Window for a tracker month bracket.
 * Examples: 0–6 → start … +6m; 7–12 → +6m … +12m; 13–24 → +12m … +24m.
 */
export function groupsPhaseWindowDates(input: {
  programmeStartIso: string;
  monthStart: number | null;
  monthEnd: number | null;
}): { startIso: string; endIso: string } | null {
  const { programmeStartIso, monthStart, monthEnd } = input;
  if (monthEnd == null || !Number.isFinite(monthEnd)) return null;
  const endIso = addCalendarMonthsIso(programmeStartIso, monthEnd);
  const startIso =
    monthStart == null || monthStart <= 0
      ? parseIsoDay(programmeStartIso).toISOString().slice(0, 10)
      : addCalendarMonthsIso(programmeStartIso, monthStart - 1);
  return { startIso, endIso };
}
