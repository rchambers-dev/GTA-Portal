/** Mirrors the SQL helpers in 20261124140000_closed_days_sites_weekly_limit.sql. */

export type ClosureSpan = {
  name: string;
  startsOn: string;
  endsOn: string;
};

export type OpenOverride = { dayOn: string };

export function isoDow(iso: string): number {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function addIsoDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekStartMonday(iso: string): string {
  return addIsoDays(iso.slice(0, 10), 1 - isoDow(iso));
}

export function closureName(iso: string, closures: ClosureSpan[]): string | null {
  const day = iso.slice(0, 10);
  const hit = closures.find((row) => day >= row.startsOn && day <= row.endsOn);
  return hit?.name ?? null;
}

export function isOpenDay(
  iso: string,
  closures: ClosureSpan[],
  openWeekdays: number[] = [1, 2, 3, 4, 5],
): boolean {
  const day = iso.slice(0, 10);
  if (!openWeekdays.includes(isoDow(day))) return false;
  return closureName(day, closures) == null;
}

export function weekOpenDayCount(weekStart: string, closures: ClosureSpan[], openWeekdays: number[] = [1, 2, 3, 4, 5]): number {
  let count = 0;
  for (let i = 0; i < 7; i += 1) {
    if (isOpenDay(addIsoDays(weekStart, i), closures, openWeekdays)) count += 1;
  }
  return count;
}

export function weekIsExcluded(weekStart: string, closures: ClosureSpan[], openWeekdays: number[] = [1, 2, 3, 4, 5]): boolean {
  return weekOpenDayCount(weekStart, closures, openWeekdays) < 3;
}

export function nextOpenDay(iso: string, closures: ClosureSpan[], openWeekdays: number[] = [1, 2, 3, 4, 5]): string | null {
  for (let i = 1; i <= 370; i += 1) {
    const day = addIsoDays(iso, i);
    if (isOpenDay(day, closures, openWeekdays)) return day;
  }
  return null;
}

export function previousOpenDay(iso: string, closures: ClosureSpan[], openWeekdays: number[] = [1, 2, 3, 4, 5]): string | null {
  for (let i = 1; i <= 370; i += 1) {
    const day = addIsoDays(iso, -i);
    if (isOpenDay(day, closures, openWeekdays)) return day;
  }
  return null;
}

function lastOpenDayOfWeek(weekStart: string, closures: ClosureSpan[], openWeekdays: number[]): string | null {
  let last: string | null = null;
  for (let i = 0; i < 7; i += 1) {
    const day = addIsoDays(weekStart, i);
    if (isOpenDay(day, closures, openWeekdays)) last = day;
  }
  return last;
}

/** Computed planned dates only. First reviews are not passed through here. */
export function rollPlannedOn(iso: string, closures: ClosureSpan[], openWeekdays: number[] = [1, 2, 3, 4, 5]): string {
  const day = iso.slice(0, 10);
  const week = weekStartMonday(day);
  if (weekIsExcluded(week, closures, openWeekdays)) {
    let cursor = addIsoDays(week, -7);
    for (let i = 0; i < 60; i += 1) {
      if (!weekIsExcluded(cursor, closures, openWeekdays)) {
        return lastOpenDayOfWeek(cursor, closures, openWeekdays) ?? day;
      }
      cursor = addIsoDays(cursor, -7);
    }
    return day;
  }
  if (isOpenDay(day, closures, openWeekdays)) return day;
  if (day === week) {
    for (let i = 1; i < 7; i += 1) {
      const next = addIsoDays(week, i);
      if (isOpenDay(next, closures, openWeekdays)) return next;
    }
  }
  for (let i = 1; i < 7; i += 1) {
    const earlier = addIsoDays(day, -i);
    if (weekStartMonday(earlier) !== week) break;
    if (isOpenDay(earlier, closures, openWeekdays)) return earlier;
  }
  let cursor = addIsoDays(week, -7);
  for (let i = 0; i < 60; i += 1) {
    if (!weekIsExcluded(cursor, closures, openWeekdays)) {
      return lastOpenDayOfWeek(cursor, closures, openWeekdays) ?? day;
    }
    cursor = addIsoDays(cursor, -7);
  }
  return day;
}

export function closedDaysInWeek(weekStart: string, closures: ClosureSpan[]): { date: string; name: string }[] {
  const found: { date: string; name: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addIsoDays(weekStart, i);
    const name = closureName(date, closures);
    if (name) found.push({ date, name });
  }
  return found;
}

export const DONCASTER_WEEKDAYS = [1, 2, 3, 4, 5];
export const SHEFFIELD_WEEKDAYS = [1, 2];
