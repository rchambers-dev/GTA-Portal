import {
  ALEX_OTJ_ENTRIES,
  ALEX_PROFILE,
  ALEX_REVIEWS,
  canEmployerActOnOtj,
  isOtjCatchUpEntry,
  otjHours,
  summariseOtjHours,
  type LearnerOtjEntry,
  type LearnerReviewSummary,
} from "@/features/learner-portal/domain/mock-learner";

/** A single apprentice as seen from the employer workspace. */
export type EmployerApprentice = {
  learnerId: string;
  displayName: string;
  initials: string;
  programmeName: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number;
  attendancePercent: number;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  nextReviewDate: string;
  /** OTJ entries waiting for employer agreement. */
  otjPendingCount: number;
  otjPendingHours: number;
  /** Whether this apprentice has fully modelled detail behind links. */
  linked: boolean;
};

/** The employer signed into the workspace (workplace contact for the account). */
export const EMPLOYER_VIEWER = {
  displayName: ALEX_PROFILE.employerContact,
  employerName: ALEX_PROFILE.employerName,
} as const;

function buildAlexApprentice(): EmployerApprentice {
  const otjSummary = summariseOtjHours(ALEX_OTJ_ENTRIES);
  return {
    learnerId: ALEX_PROFILE.learnerId,
    displayName: ALEX_PROFILE.displayName,
    initials: ALEX_PROFILE.initials,
    programmeName: ALEX_PROFILE.programmeName,
    programmeYear: ALEX_PROFILE.programmeYear,
    programmeWeek: ALEX_PROFILE.programmeWeek,
    attendancePercent: ALEX_PROFILE.attendancePercent,
    plannedProgressPercent: ALEX_PROFILE.plannedProgressPercent,
    actualProgressPercent: ALEX_PROFILE.actualProgressPercent,
    nextReviewDate: ALEX_PROFILE.nextReviewDate,
    otjPendingCount: otjSummary.awaitingEmployerCount,
    otjPendingHours: otjSummary.awaitingEmployerHours,
    linked: true,
  };
}

/**
 * Second apprentice — lightweight demo record so the caseload feels real.
 * Detail screens are not wired for this learner yet.
 */
const JORDAN_APPRENTICE: EmployerApprentice = {
  learnerId: "lrn-jordan-blake",
  displayName: "Jordan Blake",
  initials: "JB",
  programmeName: "Autocare Technician L2 · ST0499",
  programmeYear: 1,
  programmeWeek: 9,
  attendancePercent: 88,
  plannedProgressPercent: 20,
  actualProgressPercent: 18,
  nextReviewDate: "2026-09-02",
  otjPendingCount: 0,
  otjPendingHours: 0,
  linked: false,
};

export function getEmployerCaseload(): EmployerApprentice[] {
  return [buildAlexApprentice(), JORDAN_APPRENTICE];
}

/** OTJ entries across the caseload that still need employer agreement. */
export function getEmployerPendingOtj(): LearnerOtjEntry[] {
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
  LearnerReviewSummary & { learnerName: string }
> {
  return ALEX_REVIEWS.filter((r) => r.status === "upcoming").map((r) => ({
    ...r,
    learnerName: ALEX_PROFILE.displayName,
  }));
}

/** Employer-visible open cases (from the support/concerns workflow). */
export type EmployerCase = {
  id: string;
  title: string;
  learnerName: string;
  submittedAt: string;
  status: string;
};

export const EMPLOYER_OPEN_CASES: EmployerCase[] = [
  {
    id: "case-progress-alex",
    title: "Progress clarification",
    learnerName: ALEX_PROFILE.displayName,
    submittedAt: "2026-07-12",
    status: "With GTA",
  },
];
