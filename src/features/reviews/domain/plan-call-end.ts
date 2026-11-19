/**
 * Call end is the day's start (the call anchor, otherwise the plan start time).
 * A start that falls inside lunch moves to the end of lunch, matching scheduleOfficeCalls.
 */
export function callEndMinutes(input: {
  startMinutes: number;
  lunchStart: number;
  lunchEnd: number;
  callAnchorMinutes?: number | null;
}): number {
  const start = input.callAnchorMinutes ?? input.startMinutes;
  if (start >= input.lunchStart && start < input.lunchEnd) return input.lunchEnd;
  return start;
}

export function londonClock(now = new Date()): { today: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const today = year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10);
  return { today, minutes: (hour === 24 ? 0 : hour) * 60 + minute };
}

/** 10:00 Europe/London on the calendar day after the lock was set. DST-safe: 10:00 is not the UK changeover hour. */
export function lockExpiry(lockedAtIso: string, now = new Date()): { active: boolean; label: string } {
  const set = new Date(lockedAtIso);
  if (Number.isNaN(set.getTime())) return { active: false, label: "" };
  const setDay = londonClock(set).today;
  const [year, month, day] = setDay.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDay = next.toISOString().slice(0, 10);
  const expires = londonWallTime(nextDay, 10, 0);
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(expires);
  return { active: now.getTime() < expires.getTime(), label: `Locked until ${when}` };
}

function londonWallTime(date: string, hour: number, minute: number): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const hourPart = value("hour") === 24 ? 0 : value("hour");
  const asLondon = Date.UTC(value("year"), value("month") - 1, value("day"), hourPart, value("minute"), value("second"));
  return new Date(guess.getTime() - (asLondon - guess.getTime()));
}

export type CallEndStop = {
  verified: boolean;
  completed: boolean;
  accepted: boolean;
  appointmentOn: string | null;
};

/** True when this stop is today's unverified, unbooked visit and London time is at or after call end. */
export function heldPastCallEnd(
  stop: CallEndStop,
  when: { date: string; today: string; nowMinutes: number; callEnd: number },
): boolean {
  if (when.date !== when.today || when.nowMinutes < when.callEnd) return false;
  if (stop.verified || stop.completed || stop.accepted) return false;
  if (stop.appointmentOn === when.date) return false;
  return true;
}
