import {
  ALEX_ATTENDANCE_BREAKDOWN,
  ALEX_ATTENDANCE_DAYS,
  ALEX_OTJ_ENTRIES,
  ALEX_PROFILE,
  ALEX_REVIEWS,
  canEmployerActOnOtj,
  isOtjCatchUpEntry,
  otjHours,
  summariseOtjHours,
  type ApprenticeAttendanceBreakdownItem,
  type ApprenticeAttendanceDay,
  type ApprenticeOtjEntry,
  type ApprenticeReviewSummary,
} from "@/features/apprentice-portal/domain/mock-apprentice";

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
  displayName: ALEX_PROFILE.employerContact,
  employerName: ALEX_PROFILE.employerName,
} as const;

function remapMissedHrefsForEmployer(
  days: ApprenticeAttendanceDay[],
): ApprenticeAttendanceDay[] {
  return days.map((day) => ({
    ...day,
    missedItems: day.missedItems?.map((item) => ({
      ...item,
      href: "/employer/progress",
    })),
  }));
}

/**
 * Second apprentice — lighter demo attendance so the apprentice switcher has
 * something distinct to show.
 */
const JORDAN_ATTENDANCE_DAYS: ApprenticeAttendanceDay[] = [
  {
    date: "2026-07-14",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "attended",
  },
  {
    date: "2026-07-13",
    dayName: "Monday",
    session: "Theory AM",
    status: "attended",
  },
  {
    date: "2026-07-07",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "attended",
  },
  {
    date: "2026-07-06",
    dayName: "Monday",
    session: "Theory AM",
    status: "late",
    note: "Arrived 15 minutes after start — bus delay.",
  },
  {
    date: "2026-06-30",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "authorised",
    note: "Authorised dental appointment — employer aware.",
    missedItems: [
      {
        id: "jb-miss-1",
        kind: "workshop",
        title: "Wheel bearing practical",
        detail: "Workshop demo — catch up with tutor notes.",
        moduleCode: "MV-102",
        href: "/employer/progress",
        catchUpStatus: "needed",
      },
    ],
  },
  {
    date: "2026-06-29",
    dayName: "Monday",
    session: "Theory AM",
    status: "attended",
  },
  {
    date: "2026-06-23",
    dayName: "Tuesday",
    session: "Workshop AM",
    status: "college_closed",
    note: "Staff development day — college closed to apprentices.",
  },
  {
    date: "2026-06-22",
    dayName: "Monday",
    session: "Theory AM",
    status: "unauthorised",
    note: "No contact received — employer notified.",
    missedItems: [
      {
        id: "jb-miss-2",
        kind: "module",
        title: "Steering geometry intro",
        detail: "Theory session missed — notes on portal.",
        moduleCode: "MV-102",
        href: "/employer/progress",
        catchUpStatus: "in_progress",
      },
      {
        id: "jb-miss-3",
        kind: "cea",
        title: "Steering evidence sheet",
        detail: "CEA task issued that morning.",
        moduleCode: "MV-102",
        href: "/employer/progress",
        catchUpStatus: "needed",
      },
    ],
  },
];

const JORDAN_ATTENDANCE_BREAKDOWN: ApprenticeAttendanceBreakdownItem[] = [
  {
    status: "attended",
    label: "Attended",
    count: 22,
    color: "var(--color-green-600)",
    countsTowardPercent: true,
  },
  {
    status: "late",
    label: "Late",
    count: 3,
    color: "var(--color-amber-500)",
    countsTowardPercent: true,
  },
  {
    status: "authorised",
    label: "Authorised absence",
    count: 2,
    color: "var(--color-navy-600)",
    countsTowardPercent: true,
  },
  {
    status: "unauthorised",
    label: "Unauthorised absence",
    count: 2,
    color: "var(--color-red-600)",
    countsTowardPercent: true,
  },
  {
    status: "absent",
    label: "Absent",
    count: 0,
    color: "var(--color-red-400)",
    countsTowardPercent: true,
  },
  {
    status: "college_closed",
    label: "College closed",
    count: 3,
    color: "var(--color-grey-600)",
    countsTowardPercent: false,
  },
];

function buildAlexApprentice(): EmployerApprentice {
  const otjSummary = summariseOtjHours(ALEX_OTJ_ENTRIES);
  return {
    apprenticeId: ALEX_PROFILE.apprenticeId,
    displayName: ALEX_PROFILE.displayName,
    initials: ALEX_PROFILE.initials,
    programmeName: ALEX_PROFILE.programmeName,
    programmeYear: ALEX_PROFILE.programmeYear,
    programmeWeek: ALEX_PROFILE.programmeWeek,
    attendancePercent: ALEX_PROFILE.attendancePercent,
    plannedProgressPercent: ALEX_PROFILE.plannedProgressPercent,
    actualProgressPercent: ALEX_PROFILE.actualProgressPercent,
    nextReviewDate: ALEX_PROFILE.nextReviewDate,
    collegeDays: ALEX_PROFILE.collegeDays,
    otjPendingCount: otjSummary.awaitingEmployerCount,
    otjPendingHours: otjSummary.awaitingEmployerHours,
    linked: true,
  };
}

/**
 * Second apprentice — lightweight demo record so the caseload feels real.
 */
const JORDAN_APPRENTICE: EmployerApprentice = {
  apprenticeId: "lrn-jordan-blake",
  displayName: "Jordan Blake",
  initials: "JB",
  programmeName: "Autocare Technician L2 · ST0499",
  programmeYear: 1,
  programmeWeek: 9,
  attendancePercent: 88,
  plannedProgressPercent: 20,
  actualProgressPercent: 18,
  nextReviewDate: "2026-09-02",
  collegeDays: "Monday & Tuesday",
  otjPendingCount: 0,
  otjPendingHours: 0,
  linked: false,
};

export function getEmployerCaseload(): EmployerApprentice[] {
  return [buildAlexApprentice(), JORDAN_APPRENTICE];
}

export function getEmployerAttendanceBundle(
  apprenticeId: string,
): EmployerAttendanceBundle | null {
  if (apprenticeId === ALEX_PROFILE.apprenticeId) {
    return {
      apprenticeId: ALEX_PROFILE.apprenticeId,
      displayName: ALEX_PROFILE.displayName,
      collegeDays: ALEX_PROFILE.collegeDays,
      attendancePercent: ALEX_PROFILE.attendancePercent,
      days: remapMissedHrefsForEmployer(ALEX_ATTENDANCE_DAYS),
      breakdown: ALEX_ATTENDANCE_BREAKDOWN,
    };
  }
  if (apprenticeId === JORDAN_APPRENTICE.apprenticeId) {
    return {
      apprenticeId: JORDAN_APPRENTICE.apprenticeId,
      displayName: JORDAN_APPRENTICE.displayName,
      collegeDays: JORDAN_APPRENTICE.collegeDays,
      attendancePercent: JORDAN_APPRENTICE.attendancePercent,
      days: JORDAN_ATTENDANCE_DAYS,
      breakdown: JORDAN_ATTENDANCE_BREAKDOWN,
    };
  }
  return null;
}

/** OTJ entries across the caseload that still need employer agreement. */
export function getEmployerPendingOtj(): ApprenticeOtjEntry[] {
  return ALEX_OTJ_ENTRIES.filter(canEmployerActOnOtj);
}

export function getEmployerPendingOtjTotals() {
  const pending = getEmployerPendingOtj();
  const hours =
    Math.round(pending.reduce((sum, e) => sum + otjHours(e), 0) * 100) / 100;
  const catchUp = pending.filter(isOtjCatchUpEntry);
  return {
    count: pending.length,
    hours,
    catchUpCount: catchUp.length,
  };
}

/** Reviews the employer is invited to across the caseload. */
export function getEmployerUpcomingReviews(): Array<
  ApprenticeReviewSummary & { apprenticeName: string }
> {
  return ALEX_REVIEWS.filter((r) => r.status === "upcoming").map((r) => ({
    ...r,
    apprenticeName: ALEX_PROFILE.displayName,
  }));
}

/** Employer-visible open cases (from the support/concerns workflow). */
export type EmployerCase = {
  id: string;
  title: string;
  apprenticeName: string;
  submittedAt: string;
  status: string;
};

export const EMPLOYER_OPEN_CASES: EmployerCase[] = [
  {
    id: "case-progress-alex",
    title: "Progress clarification",
    apprenticeName: ALEX_PROFILE.displayName,
    submittedAt: "2026-07-12",
    status: "With GTA",
  },
];
