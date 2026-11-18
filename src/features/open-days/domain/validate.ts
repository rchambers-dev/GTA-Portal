import { openDaySlug } from "./format";
import { isoToLondonLocal, londonLocalToIso } from "./time";
import {
  OPEN_DAY_STATUSES,
  type CentreOption,
  type OpenDayFormInput,
  type OpenDayRecord,
  type OpenDayStatus,
} from "./types";

export type OpenDayField =
  | "title"
  | "dateOn"
  | "startTime"
  | "endTime"
  | "centreId"
  | "locationName"
  | "heroImageUrl"
  | "status"
  | "bookingsOpenFrom"
  | "bookingsOpenUntil"
  | "capacityTradeStands";

export type OpenDayFieldErrors = Partial<Record<OpenDayField, string>>;

export type ValidOpenDay = {
  title: string;
  dateLabel: string | null;
  dateOn: string;
  startTime: string | null;
  endTime: string | null;
  locationMode: "centre" | "other";
  centreId: string | null;
  locationName: string | null;
  address: string | null;
  description: string | null;
  heroImageUrl: string | null;
  status: OpenDayStatus;
  bookingsOpen: boolean;
  bookingsOpenFrom: string | null;
  bookingsOpenUntil: string | null;
  capacityTradeStands: number | null;
  slug: string;
};

function blank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateOpenDay(
  input: OpenDayFormInput,
  centres: Pick<CentreOption, "id">[],
): { ok: true; value: ValidOpenDay } | { ok: false; fieldErrors: OpenDayFieldErrors } {
  const fieldErrors: OpenDayFieldErrors = {};
  const title = input.title.trim();
  const dateOn = input.dateOn.trim();
  const startTime = input.startTime.trim();
  const endTime = input.endTime.trim();
  const status = input.status.trim();

  if (!title) fieldErrors.title = "Enter a title.";
  if (!validDate(dateOn)) fieldErrors.dateOn = "Enter the open day date.";

  const startMinutes = startTime ? clockMinutes(startTime) : null;
  const endMinutes = endTime ? clockMinutes(endTime) : null;
  if (startTime && startMinutes === null) fieldErrors.startTime = "Enter a start time.";
  if (endTime && endMinutes === null) fieldErrors.endTime = "Enter an end time.";
  if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
    fieldErrors.endTime = "End time must be after the start time.";
  }

  if (!OPEN_DAY_STATUSES.includes(status as OpenDayStatus)) {
    fieldErrors.status = "Choose a status.";
  }

  let centreId: string | null = null;
  let locationName: string | null = null;
  let address: string | null = null;
  if (input.locationMode === "other") {
    locationName = blank(input.locationName);
    address = blank(input.address);
    if (!locationName) fieldErrors.locationName = "Enter a location name.";
  } else {
    centreId = input.centreId.trim() || null;
    if (!centreId || !centres.some((centre) => centre.id === centreId)) {
      fieldErrors.centreId = "Choose Doncaster or Sheffield.";
    }
  }

  const hero = blank(input.heroImageUrl);
  if (hero && !validHttpUrl(hero)) fieldErrors.heroImageUrl = "Enter a full http or https image address.";

  const fromRaw = input.bookingsOpenFrom.trim();
  const untilRaw = input.bookingsOpenUntil.trim();
  const bookingsOpenFrom = fromRaw ? londonLocalToIso(fromRaw) : null;
  const bookingsOpenUntil = untilRaw ? londonLocalToIso(untilRaw) : null;
  if (fromRaw && !bookingsOpenFrom) fieldErrors.bookingsOpenFrom = "Enter a valid opening time.";
  if (untilRaw && !bookingsOpenUntil) fieldErrors.bookingsOpenUntil = "Enter a valid closing time.";
  if (
    bookingsOpenFrom &&
    bookingsOpenUntil &&
    Date.parse(bookingsOpenUntil) <= Date.parse(bookingsOpenFrom)
  ) {
    fieldErrors.bookingsOpenUntil = "Bookings must close after they open.";
  }

  const capacityRaw = input.capacityTradeStands.trim();
  let capacityTradeStands: number | null = null;
  if (capacityRaw) {
    if (!/^\d+$/.test(capacityRaw)) {
      fieldErrors.capacityTradeStands = "Enter a whole number, or leave capacity blank.";
    } else {
      capacityTradeStands = Number(capacityRaw);
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !title || !validDate(dateOn)) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      title,
      dateLabel: blank(input.dateLabel),
      dateOn,
      startTime: startMinutes === null ? null : startTime,
      endTime: endMinutes === null ? null : endTime,
      locationMode: input.locationMode === "other" ? "other" : "centre",
      centreId,
      locationName,
      address,
      description: blank(input.description),
      heroImageUrl: hero,
      status: status as OpenDayStatus,
      bookingsOpen: input.bookingsOpen,
      bookingsOpenFrom,
      bookingsOpenUntil,
      capacityTradeStands,
      slug: openDaySlug(title, dateOn),
    },
  };
}

export function formFromOpenDay(day: OpenDayRecord | null, centres: CentreOption[]): OpenDayFormInput {
  const defaultCentre = centres.find((centre) => centre.code === "doncaster") ?? centres[0];
  if (!day) {
    return {
      id: null,
      title: "",
      dateLabel: "",
      dateOn: "",
      startTime: "",
      endTime: "",
      locationMode: "centre",
      centreId: defaultCentre?.id ?? "",
      locationName: "",
      address: "",
      description: "",
      heroImageUrl: "",
      status: "draft",
      bookingsOpen: true,
      bookingsOpenFrom: "",
      bookingsOpenUntil: "",
      capacityTradeStands: "",
    };
  }
  return {
    id: day.id,
    title: day.title,
    dateLabel: day.dateLabel ?? "",
    dateOn: day.dateOn,
    startTime: day.startTime ?? "",
    endTime: day.endTime ?? "",
    locationMode: day.centreId ? "centre" : "other",
    centreId: day.centreId ?? defaultCentre?.id ?? "",
    locationName: day.locationName ?? "",
    address: day.address ?? "",
    description: day.description ?? "",
    heroImageUrl: day.heroImageUrl ?? "",
    status: day.status,
    bookingsOpen: day.bookingsOpen,
    bookingsOpenFrom: isoToLondonLocal(day.bookingsOpenFrom),
    bookingsOpenUntil: isoToLondonLocal(day.bookingsOpenUntil),
    capacityTradeStands: day.capacityTradeStands === null ? "" : String(day.capacityTradeStands),
  };
}
