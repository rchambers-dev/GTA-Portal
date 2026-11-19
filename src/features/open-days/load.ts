import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { activeBookingCounts } from "./domain/bookings";
import {
  EXAMPLE_CENTRES,
  exampleBookingsFor,
  exampleOpenDay,
  exampleOpenDays,
} from "./domain/example";
import { errorMode, exampleMode, liveMode, openDaysFeatureOff, tablesMissing } from "./domain/missing";
import type {
  BookingRecord,
  BookingStatus,
  BookingType,
  CentreOption,
  OpenDayDetailModel,
  OpenDayRecord,
  OpenDayStatus,
  OpenDaysListModel,
  VehicleRecord,
} from "./domain/types";

const DAY_COLUMNS = `
  id, slug, title, date_label, date_on, start_time, end_time, centre_id,
  location_name, address, description, hero_image_url, status, bookings_open,
  bookings_open_from, bookings_open_until, capacity_trade_stands,
  candidate_centres ( id, code, name )
`;

const LIST_COLUMNS = `
  ${DAY_COLUMNS},
  open_day_bookings ( id, booking_type, status )
`;

const BOOKING_COLUMNS = `
  id, open_day_id, booking_type, status, first_name, last_name, email, phone,
  company_name, business_type, space_package_id, vehicle_regs,
  insurance_confirmed, risk_assessment_confirmed, staff_notes, submitted_at,
  open_day_booking_vehicles (
    id, make, model, year_text, registration, category, car_club, sort_order
  )
`;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function clock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

function whole(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function flag(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

function isStatus(value: unknown): value is OpenDayStatus {
  return value === "draft" || value === "published" || value === "closed" || value === "cancelled";
}

function isBookingType(value: unknown): value is BookingType {
  return value === "exhibitor" || value === "trade_stand";
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "waitlist" ||
    value === "cancelled" ||
    value === "checked_in"
  );
}

function centreOf(value: unknown): { id: string; name: string } | null {
  const row = Array.isArray(value) ? record(value[0]) : record(value);
  if (!row || typeof row.id !== "string" || typeof row.name !== "string") return null;
  return { id: row.id, name: row.name };
}

function mapCentres(value: unknown): CentreOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== "string" || typeof row.name !== "string") return [];
    return [{ id: row.id, code: typeof row.code === "string" ? row.code : "", name: row.name }];
  });
}

function mapVehicles(value: unknown): VehicleRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const row = record(item);
      if (!row || typeof row.id !== "string" || typeof row.registration !== "string") return [];
      return [
        {
          id: row.id,
          make: text(row.make),
          model: text(row.model),
          yearText: text(row.year_text),
          registration: row.registration,
          category: text(row.category),
          carClub: text(row.car_club),
          sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
        },
      ];
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function mapDay(value: unknown, counts?: { exhibitors: number; tradeStands: number }): OpenDayRecord | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.title !== "string" || typeof row.date_on !== "string") {
    return null;
  }
  if (!isStatus(row.status)) return null;
  const centre = centreOf(row.candidate_centres);
  const nested = counts ?? activeBookingCounts(mapBookingCounts(row.open_day_bookings));
  return {
    id: row.id,
    slug: text(row.slug),
    title: row.title,
    dateLabel: text(row.date_label),
    dateOn: row.date_on.slice(0, 10),
    startTime: clock(row.start_time),
    endTime: clock(row.end_time),
    centreId: text(row.centre_id) ?? centre?.id ?? null,
    centreName: centre?.name ?? null,
    locationName: text(row.location_name),
    address: text(row.address),
    description: text(row.description),
    heroImageUrl: text(row.hero_image_url),
    status: row.status,
    bookingsOpen: row.bookings_open === true,
    bookingsOpenFrom: text(row.bookings_open_from),
    bookingsOpenUntil: text(row.bookings_open_until),
    capacityTradeStands: whole(row.capacity_trade_stands),
    exhibitorCount: nested.exhibitors,
    tradeStandCount: nested.tradeStands,
  };
}

function mapBookingCounts(value: unknown): { bookingType: BookingType; status: BookingStatus }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = record(item);
    if (!row || !isBookingType(row.booking_type) || !isBookingStatus(row.status)) return [];
    return [{ bookingType: row.booking_type, status: row.status }];
  });
}

function mapBooking(value: unknown): BookingRecord | null {
  const row = record(value);
  if (!row || typeof row.id !== "string" || typeof row.open_day_id !== "string") return null;
  if (!isBookingType(row.booking_type) || !isBookingStatus(row.status)) return null;
  if (typeof row.first_name !== "string" || typeof row.last_name !== "string") return null;
  if (typeof row.email !== "string" || typeof row.phone !== "string" || typeof row.submitted_at !== "string") {
    return null;
  }
  return {
    id: row.id,
    openDayId: row.open_day_id,
    bookingType: row.booking_type,
    status: row.status,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    companyName: text(row.company_name),
    businessType: text(row.business_type),
    spacePackageId: text(row.space_package_id),
    vehicleRegs: text(row.vehicle_regs),
    insuranceConfirmed: flag(row.insurance_confirmed),
    riskAssessmentConfirmed: flag(row.risk_assessment_confirmed),
    staffNotes: text(row.staff_notes),
    submittedAt: row.submitted_at,
    vehicles: mapVehicles(row.open_day_booking_vehicles),
  };
}

function isMissing(error: { message?: string; code?: string } | null): boolean {
  return Boolean(error && tablesMissing(error.message, error.code));
}

function emptyList(message: string): OpenDaysListModel {
  return { mode: errorMode(message), days: [], centres: [] };
}

function exampleList(reason: "tables" | "flag"): OpenDaysListModel {
  return { mode: exampleMode(reason), days: exampleOpenDays(), centres: EXAMPLE_CENTRES };
}

function exampleDetail(id: string, reason: "tables" | "flag"): OpenDayDetailModel {
  const day = exampleOpenDay(id);
  return {
    mode: exampleMode(reason),
    day,
    bookings: day ? exampleBookingsFor(day.id) : [],
    centres: EXAMPLE_CENTRES,
    missing: !day,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function envMissing(message: string): boolean {
  return /Missing NEXT_PUBLIC_SUPABASE/.test(message);
}

export async function loadOpenDaysList(): Promise<OpenDaysListModel> {
  if (openDaysFeatureOff()) return exampleList("flag");
  try {
    const supabase = await createSupabaseServerClient();
    const [daysResult, centresResult] = await Promise.all([
      supabase.from("open_days").select(LIST_COLUMNS).order("date_on", { ascending: true }).order("title"),
      supabase
        .from("candidate_centres")
        .select("id, code, name")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (isMissing(daysResult.error)) return exampleList("tables");
    if (daysResult.error) return emptyList(daysResult.error.message);
    return {
      mode: liveMode(),
      days: (Array.isArray(daysResult.data) ? daysResult.data : [])
        .map((row) => mapDay(row))
        .filter((day): day is OpenDayRecord => Boolean(day)),
      centres: centresResult.error ? [] : mapCentres(centresResult.data),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message) || envMissing(message)) return exampleList("tables");
    return emptyList(message || "Open Days could not be loaded.");
  }
}

export async function loadOpenDayDetail(id: string): Promise<OpenDayDetailModel> {
  if (openDaysFeatureOff()) return exampleDetail(id, "flag");
  try {
    const supabase = await createSupabaseServerClient();
    if (!isUuid(id)) {
      const probe = await supabase.from("open_days").select("id").limit(1);
      if (isMissing(probe.error)) return exampleDetail(id, "tables");
      if (probe.error) {
        return { mode: errorMode(probe.error.message), day: null, bookings: [], centres: [], missing: false };
      }
      return { mode: liveMode(), day: null, bookings: [], centres: [], missing: true };
    }

    const [dayResult, bookingsResult, centresResult] = await Promise.all([
      supabase.from("open_days").select(DAY_COLUMNS).eq("id", id).maybeSingle(),
      supabase
        .from("open_day_bookings")
        .select(BOOKING_COLUMNS)
        .eq("open_day_id", id)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("candidate_centres")
        .select("id, code, name")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);
    if (isMissing(dayResult.error) || isMissing(bookingsResult.error)) return exampleDetail(id, "tables");
    if (dayResult.error) {
      return { mode: errorMode(dayResult.error.message), day: null, bookings: [], centres: [], missing: false };
    }
    if (bookingsResult.error) {
      return { mode: errorMode(bookingsResult.error.message), day: null, bookings: [], centres: [], missing: false };
    }
    const bookings = (Array.isArray(bookingsResult.data) ? bookingsResult.data : [])
      .map((row) => mapBooking(row))
      .filter((row): row is BookingRecord => Boolean(row));
    const counts = activeBookingCounts(bookings);
    const day = mapDay(dayResult.data, counts);
    return {
      mode: liveMode(),
      day,
      bookings,
      centres: centresResult.error ? [] : mapCentres(centresResult.data),
      missing: !day,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (tablesMissing(message) || envMissing(message)) return exampleDetail(id, "tables");
    return {
      mode: errorMode(message || "This open day could not be loaded."),
      day: null,
      bookings: [],
      centres: [],
      missing: false,
    };
  }
}
