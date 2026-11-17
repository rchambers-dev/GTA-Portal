const LONDON = "Europe/London";

function parts(instant: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
}

function part(list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(list.find((item) => item.type === type)?.value ?? "0");
}

/** Minutes to add to UTC to get the Europe/London clock at this instant. */
function londonOffsetMinutes(instant: Date): number {
  const list = parts(instant);
  const asUtc = Date.UTC(
    part(list, "year"),
    part(list, "month") - 1,
    part(list, "day"),
    part(list, "hour"),
    part(list, "minute"),
    part(list, "second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** datetime-local value entered as Europe/London, stored as an ISO instant. */
export function londonLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = londonOffsetMinutes(new Date(utcGuess));
  const corrected = utcGuess - londonOffsetMinutes(new Date(utcGuess - firstOffset * 60_000)) * 60_000;
  const result = new Date(corrected);
  if (Number.isNaN(result.getTime())) return null;
  return result.toISOString();
}

export function isoToLondonLocal(iso: string | null): string {
  if (!iso) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const list = parts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    list.find((item) => item.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}
