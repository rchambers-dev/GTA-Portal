import type {
  ApprenticeAttendanceBreakdownItem,
  ApprenticeAttendanceDay,
  ApprenticeOtjEntry,
  ApprenticeReviewSummary,
} from "@/features/apprentice-portal/domain/apprentice-profile";

/** A single apprentice as seen from the employer workspace. */
export type EmployerApprentice = {
  apprenticeId: string;
  displayName: string;
  initials: string;
  programmeName: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number;
  attendancePercent: number;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  nextReviewDate: string;
  collegeDays: string;
  /** OTJ entries waiting for employer agreement. */
  otjPendingCount: number;
  otjPendingHours: number;
  /** Whether this apprentice has fully modelled detail behind links. */
  linked: boolean;
};

/** Attendance bundle shown on the shared Attendance page for one apprentice. */
export type EmployerAttendanceBundle = {
  apprenticeId: string;
  displayName: string;
  collegeDays: string;
  attendancePercent: number;
  days: ApprenticeAttendanceDay[];
  breakdown: ApprenticeAttendanceBreakdownItem[];
};

/** The employer signed into the workspace (workplace contact for the account). */
export const EMPLOYER_VIEWER = {
  displayName: "Employer contact",
  employerName: "Employer",
} as const;

/** Live employer caseload — empty until linked apprentices load from Supabase. */
export function getEmployerCaseload(): EmployerApprentice[] {
  return [];
}

export function getEmployerAttendanceBundle(
  _apprenticeId: string,
): EmployerAttendanceBundle | null {
  return null;
}

/** OTJ entries across the caseload that still need employer agreement. */
export function getEmployerPendingOtj(): ApprenticeOtjEntry[] {
  return [];
}

export function getEmployerPendingOtjTotals() {
  return {
    count: 0,
    hours: 0,
    catchUpCount: 0,
  };
}

/** Reviews the employer is invited to across the caseload. */
export function getEmployerUpcomingReviews(): Array<
  ApprenticeReviewSummary & { apprenticeName: string }
> {
  return [];
}

/** Employer-visible open cases (from the support/concerns workflow). */
export type EmployerCase = {
  id: string;
  title: string;
  apprenticeName: string;
  submittedAt: string;
  status: string;
};

export const EMPLOYER_OPEN_CASES: EmployerCase[] = [];
