import { activeBookingCounts } from "./bookings";
import type { BookingRecord, CentreOption, OpenDayRecord } from "./types";

export const EXAMPLE_CENTRES: CentreOption[] = [
  { id: "example-centre-doncaster", code: "doncaster", name: "Doncaster" },
  { id: "example-centre-sheffield", code: "sheffield", name: "Sheffield" },
];

const SUMMER = "example-open-day-summer";
const SHEFFIELD = "example-open-day-sheffield";
const AUTUMN = "example-open-day-autumn";
const SPRING = "example-open-day-spring";

function vehicle(
  id: string,
  registration: string,
  extra: Partial<Omit<BookingRecord["vehicles"][number], "id" | "registration">> = {},
): BookingRecord["vehicles"][number] {
  return {
    id,
    make: extra.make ?? null,
    model: extra.model ?? null,
    yearText: extra.yearText ?? null,
    registration,
    category: extra.category ?? null,
    carClub: extra.carClub ?? null,
    sortOrder: extra.sortOrder ?? 1,
  };
}

function booking(
  partial: Pick<BookingRecord, "id" | "openDayId" | "bookingType" | "status" | "firstName" | "lastName" | "email" | "phone" | "submittedAt"> &
    Partial<BookingRecord>,
): BookingRecord {
  return {
    companyName: null,
    businessType: null,
    spacePackageId: null,
    vehicleRegs: null,
    insuranceConfirmed: null,
    riskAssessmentConfirmed: null,
    staffNotes: null,
    vehicles: [],
    ...partial,
  };
}

export const EXAMPLE_BOOKINGS: BookingRecord[] = [
  booking({
    id: "example-booking-alex",
    openDayId: SUMMER,
    bookingType: "exhibitor",
    status: "confirmed",
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex.morgan@example.test",
    phone: "07700 900111",
    submittedAt: "2026-07-02T09:15:00.000Z",
    staffNotes: "Arriving with a second driver. Example note only.",
    vehicles: [
      vehicle("example-vehicle-escort", "ABC123A", {
        make: "Ford",
        model: "Escort Mk2",
        yearText: "1978",
        category: "Classic",
        carClub: "Doncaster Classic Club",
        sortOrder: 1,
      }),
      vehicle("example-vehicle-golf", "YK19GTA", {
        make: "Volkswagen",
        model: "Golf GTI",
        yearText: "2019",
        category: "Modern",
        sortOrder: 2,
      }),
    ],
  }),
  booking({
    id: "example-booking-priya",
    openDayId: SUMMER,
    bookingType: "exhibitor",
    status: "pending",
    firstName: "Priya",
    lastName: "Shah",
    email: "priya.shah@example.test",
    phone: "07700 900222",
    submittedAt: "2026-07-04T14:40:00.000Z",
    vehicles: [
      vehicle("example-vehicle-civic", "FN04GTA", {
        make: "Honda",
        model: "Civic Type R",
        yearText: "2004",
        category: "Modified",
        carClub: "South Yorkshire Civics",
      }),
    ],
  }),
  booking({
    id: "example-booking-jordan",
    openDayId: SUMMER,
    bookingType: "exhibitor",
    status: "checked_in",
    firstName: "Jordan",
    lastName: "Blake",
    email: "jordan.blake@example.test",
    phone: "07700 900333",
    submittedAt: "2026-07-06T08:05:00.000Z",
    vehicles: [
      vehicle("example-vehicle-defender", "J920GTA", {
        make: "Land Rover",
        model: "Defender",
        yearText: "1992",
        category: "Commercial",
      }),
    ],
  }),
  booking({
    id: "example-booking-sam",
    openDayId: SUMMER,
    bookingType: "exhibitor",
    status: "cancelled",
    firstName: "Sam",
    lastName: "Oldfield",
    email: "sam.oldfield@example.test",
    phone: "07700 900444",
    submittedAt: "2026-06-20T11:00:00.000Z",
    vehicles: [
      vehicle("example-vehicle-mini", "SAM64M", {
        make: "Mini",
        model: "Cooper",
        yearText: "1964",
        category: "Classic",
      }),
    ],
  }),
  booking({
    id: "example-booking-diane",
    openDayId: SUMMER,
    bookingType: "trade_stand",
    status: "confirmed",
    firstName: "Diane",
    lastName: "Copeland",
    email: "diane.copeland@example.test",
    phone: "07700 900555",
    companyName: "Northbridge Motors",
    businessType: "Body repair",
    spacePackageId: "1v_6x3",
    vehicleRegs: "YK70 NBM",
    insuranceConfirmed: true,
    riskAssessmentConfirmed: true,
    submittedAt: "2026-07-01T10:30:00.000Z",
  }),
  booking({
    id: "example-booking-lee",
    openDayId: SUMMER,
    bookingType: "trade_stand",
    status: "waitlist",
    firstName: "Lee",
    lastName: "Hart",
    email: "lee.hart@example.test",
    phone: "07700 900666",
    companyName: "Hart Detailing",
    businessType: "Detailing",
    spacePackageId: "1v_3x3",
    vehicleRegs: "LE70 HRT",
    insuranceConfirmed: true,
    riskAssessmentConfirmed: true,
    submittedAt: "2026-07-08T16:20:00.000Z",
    staffNotes: "Asked for a corner pitch if a space opens. Example note only.",
  }),
  booking({
    id: "example-booking-old-stand",
    openDayId: SUMMER,
    bookingType: "trade_stand",
    status: "cancelled",
    firstName: "Pat",
    lastName: "Rowe",
    email: "pat.rowe@example.test",
    phone: "07700 900777",
    companyName: "Old Stand Co",
    businessType: "Tools",
    spacePackageId: "2v_6x3",
    vehicleRegs: "OS21 GTA",
    insuranceConfirmed: true,
    riskAssessmentConfirmed: true,
    submittedAt: "2026-06-18T09:00:00.000Z",
  }),
  booking({
    id: "example-booking-sheffield",
    openDayId: SHEFFIELD,
    bookingType: "exhibitor",
    status: "confirmed",
    firstName: "Riley",
    lastName: "Khan",
    email: "riley.khan@example.test",
    phone: "07700 900888",
    submittedAt: "2026-08-01T12:00:00.000Z",
    vehicles: [
      vehicle("example-vehicle-mx5", "R19 MX5", {
        make: "Mazda",
        model: "MX-5",
        yearText: "2019",
        category: "Modern",
      }),
    ],
  }),
  booking({
    id: "example-booking-autumn-stand",
    openDayId: AUTUMN,
    bookingType: "trade_stand",
    status: "confirmed",
    firstName: "Morgan",
    lastName: "Ellis",
    email: "morgan.ellis@example.test",
    phone: "07700 900999",
    companyName: "Ellis Paint",
    businessType: "Refinishing",
    spacePackageId: "1v_6x3",
    vehicleRegs: "EL68 PNT",
    insuranceConfirmed: true,
    riskAssessmentConfirmed: true,
    submittedAt: "2026-08-12T09:45:00.000Z",
  }),
  booking({
    id: "example-booking-autumn-cancelled",
    openDayId: AUTUMN,
    bookingType: "exhibitor",
    status: "cancelled",
    firstName: "Casey",
    lastName: "Nguyen",
    email: "casey.nguyen@example.test",
    phone: "07700 900121",
    submittedAt: "2026-08-02T15:10:00.000Z",
    vehicles: [
      vehicle("example-vehicle-bike", "CN22 GTA", {
        make: "Triumph",
        model: "Bonneville",
        yearText: "2022",
        category: "Motorcycle",
      }),
    ],
  }),
];

const EXAMPLE_DAY_BASES: OpenDayRecord[] = [
  {
    id: SUMMER,
    slug: "summer-open-day-2026-08-15",
    title: "Summer open day",
    dateLabel: "Saturday 15 August 2026",
    dateOn: "2026-08-15",
    startTime: "10:00",
    endTime: "15:00",
    centreId: "example-centre-doncaster",
    centreName: "Doncaster",
    locationName: null,
    address: null,
    description:
      "Example open day for the Doncaster centre. This text is sample data until the Open Days tables exist.",
    heroImageUrl: "/images/brand/gta-logo.png",
    status: "published",
    bookingsOpen: true,
    bookingsOpenFrom: "2026-06-01T08:00:00.000Z",
    bookingsOpenUntil: "2026-08-14T17:00:00.000Z",
    capacityTradeStands: 12,
    exhibitorCount: 0,
    tradeStandCount: 0,
  },
  {
    id: SHEFFIELD,
    slug: "sheffield-taster-2026-09-12",
    title: "Sheffield taster morning",
    dateLabel: null,
    dateOn: "2026-09-12",
    startTime: "09:30",
    endTime: "12:30",
    centreId: null,
    centreName: null,
    locationName: "Sheffield City Centre",
    address: "Example Street, Sheffield S1 1AA",
    description: "Example draft held at a free-text location, not a GTA centre.",
    heroImageUrl: null,
    status: "draft",
    bookingsOpen: false,
    bookingsOpenFrom: null,
    bookingsOpenUntil: null,
    capacityTradeStands: null,
    exhibitorCount: 0,
    tradeStandCount: 0,
  },
  {
    id: AUTUMN,
    slug: "autumn-showcase-2026-10-03",
    title: "Autumn trade showcase",
    dateLabel: "Saturday 3 October 2026",
    dateOn: "2026-10-03",
    startTime: "10:00",
    endTime: "16:00",
    centreId: "example-centre-doncaster",
    centreName: "Doncaster",
    locationName: null,
    address: null,
    description: "Example closed open day. The website can still list it, but new bookings are refused.",
    heroImageUrl: null,
    status: "closed",
    bookingsOpen: false,
    bookingsOpenFrom: "2026-08-01T08:00:00.000Z",
    bookingsOpenUntil: "2026-09-20T17:00:00.000Z",
    capacityTradeStands: 8,
    exhibitorCount: 0,
    tradeStandCount: 0,
  },
  {
    id: SPRING,
    slug: "spring-open-day-2026-04-18",
    title: "Spring open day",
    dateLabel: null,
    dateOn: "2026-04-18",
    startTime: "10:00",
    endTime: "14:00",
    centreId: "example-centre-sheffield",
    centreName: "Sheffield",
    locationName: null,
    address: null,
    description: "Example cancelled open day. Cancelled days stay off the public website.",
    heroImageUrl: null,
    status: "cancelled",
    bookingsOpen: false,
    bookingsOpenFrom: null,
    bookingsOpenUntil: null,
    capacityTradeStands: 6,
    exhibitorCount: 0,
    tradeStandCount: 0,
  },
];

function withCounts(day: OpenDayRecord): OpenDayRecord {
  const counts = activeBookingCounts(EXAMPLE_BOOKINGS.filter((row) => row.openDayId === day.id));
  return { ...day, exhibitorCount: counts.exhibitors, tradeStandCount: counts.tradeStands };
}

export function exampleOpenDays(): OpenDayRecord[] {
  return EXAMPLE_DAY_BASES.map(withCounts).sort((a, b) => a.dateOn.localeCompare(b.dateOn) || a.title.localeCompare(b.title));
}

export function exampleBookingsFor(openDayId: string): BookingRecord[] {
  return EXAMPLE_BOOKINGS.filter((row) => row.openDayId === openDayId).sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
}

export function exampleOpenDay(id: string): OpenDayRecord | null {
  return exampleOpenDays().find((day) => day.id === id) ?? null;
}
