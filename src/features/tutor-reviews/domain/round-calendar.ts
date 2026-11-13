export type RoundWindow = { label: string; opensOn: string; closesOn: string };

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function format(date: Date): string {
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Monday is 1 in both JavaScript and the date math below. Sunday is 0. */
function daysUntilMonday(weekday: number): number {
  return (1 - weekday + 7) % 7;
}

export function juneRound(year: number): RoundWindow {
  const start = utcDate(year, 6, 7);
  const opens = shiftDays(start, daysUntilMonday(start.getUTCDay()));
  return { label: `June ${year}`, opensOn: format(opens), closesOn: format(shiftDays(opens, 18)) };
}

export function decemberRound(year: number): RoundWindow {
  const start = utcDate(year, 12, 1);
  const opens = shiftDays(start, daysUntilMonday(start.getUTCDay()));
  let closes = shiftDays(opens, 18);
  const christmas = utcDate(year, 12, 25);
  if (closes >= christmas) closes = shiftDays(closes, -7);
  return { label: `December ${year}`, opensOn: format(opens), closesOn: format(closes) };
}

export function upcomingRoundWindows(today: string): RoundWindow[] {
  const year = Number(today.slice(0, 4));
  const windows: RoundWindow[] = [];
  for (let offset = -1; offset <= 2; offset += 1) {
    windows.push(juneRound(year + offset), decemberRound(year + offset));
  }
  return windows
    .filter((window) => window.closesOn >= today)
    .sort((a, b) => a.opensOn.localeCompare(b.opensOn))
    .slice(0, 2);
}

export function roundsToCreate(today: string, existingLabels: string[]): RoundWindow[] {
  const existing = new Set(existingLabels);
  return upcomingRoundWindows(today).filter((window) => !existing.has(window.label));
}
