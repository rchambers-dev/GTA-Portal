export const OPEN_DAY_STATUSES = ["draft", "published", "closed", "cancelled"] as const;
export type OpenDayStatus = (typeof OPEN_DAY_STATUSES)[number];

export const BOOKING_TYPES = ["exhibitor", "trade_stand"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "waitlist",
  "cancelled",
  "checked_in",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const SPACE_PACKAGES = ["1v_3x3", "1v_6x3", "2v_6x3"] as const;
export type SpacePackage = (typeof SPACE_PACKAGES)[number];

export const VEHICLE_CATEGORIES = [
  "Classic",
  "Modern",
  "Modified",
  "Commercial",
  "Motorcycle",
  "Other",
] as const;

export type CentreOption = {
  id: string;
  code: string;
  name: string;
};

export type OpenDayRecord = {
  id: string;
  slug: string | null;
  title: string;
  dateLabel: string | null;
  dateOn: string;
  startTime: string | null;
  endTime: string | null;
  centreId: string | null;
  centreName: string | null;
  locationName: string | null;
  address: string | null;
  description: string | null;
  heroImageUrl: string | null;
  status: OpenDayStatus;
  bookingsOpen: boolean;
  bookingsOpenFrom: string | null;
  bookingsOpenUntil: string | null;
  capacityTradeStands: number | null;
  exhibitorCount: number;
  tradeStandCount: number;
};

export type VehicleRecord = {
  id: string;
  make: string | null;
  model: string | null;
  yearText: string | null;
  registration: string;
  category: string | null;
  carClub: string | null;
  sortOrder: number;
};

export type BookingRecord = {
  id: string;
  openDayId: string;
  bookingType: BookingType;
  status: BookingStatus;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string | null;
  businessType: string | null;
  spacePackageId: string | null;
  vehicleRegs: string | null;
  insuranceConfirmed: boolean | null;
  riskAssessmentConfirmed: boolean | null;
  staffNotes: string | null;
  submittedAt: string;
  vehicles: VehicleRecord[];
};

export type OpenDayFormInput = {
  id: string | null;
  title: string;
  dateLabel: string;
  dateOn: string;
  startTime: string;
  endTime: string;
  locationMode: "centre" | "other";
  centreId: string;
  locationName: string;
  address: string;
  description: string;
  heroImageUrl: string;
  status: string;
  bookingsOpen: boolean;
  bookingsOpenFrom: string;
  bookingsOpenUntil: string;
  capacityTradeStands: string;
};

export type OpenDaysMode = {
  example: boolean;
  banner: string | null;
  savingMessage: string | null;
  error: string | null;
};

export type OpenDaysListModel = {
  mode: OpenDaysMode;
  days: OpenDayRecord[];
  centres: CentreOption[];
};

export type OpenDayDetailModel = {
  mode: OpenDaysMode;
  day: OpenDayRecord | null;
  bookings: BookingRecord[];
  centres: CentreOption[];
  missing: boolean;
};

export type OpenDayMutationResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Partial<Record<string, string>> };

export type BookingMutationResult =
  | { ok: true }
  | { ok: false; message: string };
