import type { BookingStatus, BookingType, OpenDayRecord, OpenDayStatus, SpacePackage } from "./types";

export const OPEN_DAY_STATUS_LABELS: Record<OpenDayStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  waitlist: "Waitlist",
  cancelled: "Cancelled",
  checked_in: "Checked in",
};

export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  exhibitor: "Exhibitor",
  trade_stand: "Trade stand",
};

export const SPACE_PACKAGE_LABELS: Record<SpacePackage, string> = {
  "1v_3x3": "1 vehicle, 3×3 m",
  "1v_6x3": "1 vehicle, 6×3 m",
  "2v_6x3": "2 vehicles, 6×3 m",
};

export function isOpenDayStatus(value: string): value is OpenDayStatus {
  return value === "draft" || value === "published" || value === "closed" || value === "cancelled";
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "waitlist" ||
    value === "cancelled" ||
    value === "checked_in"
  );
}

export function spacePackageLabel(value: string | null): string {
  if (!value) return "";
  if (value === "1v_3x3" || value === "1v_6x3" || value === "2v_6x3") return SPACE_PACKAGE_LABELS[value];
  return value;
}

export function formatUkDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatSubmitted(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/London",
  }).format(date);
}

export function formatClock(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : value;
}

export function formatTimeRange(start: string | null, end: string | null): string {
  const from = formatClock(start);
  const to = formatClock(end);
  if (from && to) return `${from}–${to}`;
  if (from) return `Starts ${from}`;
  if (to) return `Ends ${to}`;
  return "Time not set";
}

export function openDayLocation(day: Pick<OpenDayRecord, "centreName" | "locationName" | "address">): string {
  const place = day.centreName || day.locationName || "Location not set";
  if (day.address && day.address !== place) return `${place}, ${day.address}`;
  return place;
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function bookingCountSummary(
  day: { exhibitorCount: number; tradeStandCount: number; capacityTradeStands?: number | null },
  includeCapacity = false,
): string {
  const parts = [
    countLabel(day.exhibitorCount, "exhibitor booking", "exhibitor bookings"),
    countLabel(day.tradeStandCount, "trade stand booking", "trade stand bookings"),
  ];
  if (includeCapacity && typeof day.capacityTradeStands === "number") {
    parts.push(`${day.capacityTradeStands} trade stand spaces`);
  }
  return `${parts.join(" · ")}. Cancelled bookings are not included.`;
}

export function openDaySlug(title: string, dateOn: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "open-day"}-${dateOn}`;
}

export function bookingName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function vehicleSummary(vehicle: {
  yearText: string | null;
  make: string | null;
  model: string | null;
  registration: string;
}): string {
  const name = [vehicle.yearText, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return name ? `${name} · ${vehicle.registration}` : vehicle.registration;
}

export function openDaysPath(workspace: "administration" | "management", ...parts: string[]): string {
  const base = `/${workspace}/marketing/open-days`;
  if (parts.length === 0) return base;
  return `${base}/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}
