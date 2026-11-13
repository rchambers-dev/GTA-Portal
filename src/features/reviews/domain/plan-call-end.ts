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
