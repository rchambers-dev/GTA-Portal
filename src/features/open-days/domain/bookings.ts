import { bookingName, BOOKING_STATUS_LABELS, formatSubmitted, spacePackageLabel, vehicleSummary } from "./format";
import type { BookingRecord, BookingStatus, BookingType } from "./types";

export type BookingTab = "all" | BookingType;

export function activeBookingCounts(rows: Pick<BookingRecord, "bookingType" | "status">[]): {
  exhibitors: number;
  tradeStands: number;
} {
  let exhibitors = 0;
  let tradeStands = 0;
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    if (row.bookingType === "exhibitor") exhibitors += 1;
    if (row.bookingType === "trade_stand") tradeStands += 1;
  }
  return { exhibitors, tradeStands };
}

export function filterBookings(
  rows: BookingRecord[],
  input: { tab: BookingTab; query: string; status: BookingStatus | "all" },
): BookingRecord[] {
  const query = input.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (input.tab !== "all" && row.bookingType !== input.tab) return false;
    if (input.status !== "all" && row.status !== input.status) return false;
    if (!query) return true;
    const haystack = [
      bookingName(row.firstName, row.lastName),
      row.email,
      row.phone,
      row.companyName,
      row.businessType,
      row.vehicleRegs,
      row.staffNotes,
      ...row.vehicles.flatMap((vehicle) => [
        vehicle.make,
        vehicle.model,
        vehicle.yearText,
        vehicle.registration,
        vehicle.category,
        vehicle.carClub,
      ]),
    ]
      .filter((part): part is string => Boolean(part))
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function yesNo(value: boolean | null): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

export function bookingsToCsv(rows: BookingRecord[]): string {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Type",
    "Status",
    "Submitted",
    "Vehicles",
    "Company",
    "Business type",
    "Space package",
    "Vehicle regs",
    "Insurance confirmed",
    "Risk assessment confirmed",
    "Staff notes",
  ];
  const lines = rows.map((row) => {
    const vehicles = [...row.vehicles]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((vehicle) => {
        const club = vehicle.carClub ? `, ${vehicle.carClub}` : "";
        const category = vehicle.category ? `, ${vehicle.category}` : "";
        return `${vehicleSummary(vehicle)}${category}${club}`;
      })
      .join("; ");
    return [
      bookingName(row.firstName, row.lastName),
      row.email,
      row.phone,
      row.bookingType === "trade_stand" ? "Trade stand" : "Exhibitor",
      BOOKING_STATUS_LABELS[row.status],
      formatSubmitted(row.submittedAt),
      vehicles,
      row.companyName ?? "",
      row.businessType ?? "",
      spacePackageLabel(row.spacePackageId),
      row.vehicleRegs ?? "",
      yesNo(row.insuranceConfirmed),
      yesNo(row.riskAssessmentConfirmed),
      row.staffNotes ?? "",
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...lines].join("\r\n");
}
