export type ApprenticePortalProfile = {
  accountId: string;
  apprenticeId: string;
  displayName: string;
  initials: string;
  programmeName: string;
  programmeYear: 1 | 2 | 3;
  programmeWeek: number;
  employerName: string;
  employerContact: string;
  mentorName: string;
  mentorId: string;
  tutorName: string;
  tutorId: string;
  plannedProgressPercent: number;
  actualProgressPercent: number;
  attendancePercent: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  openActionCount: number;
  collegeDays: string;
  /** Cohort / programme start (ISO) — apprentice calendar weeks map from this, not RPL. */
  programmeStartDate: string;
  /** Cohort Skills England version, e.g. 1.2 */
  standardVersion?: string | null;
  /** Cohort delivery spine — groups (CEA) or blocks (programme tasks). */
  deliverySpine?: "groups" | "blocks";
  cohortName?: string | null;
};

/** Blank profile template — live data comes from /api/apprentice/me. */
export const BLANK_APPRENTICE_PROFILE: ApprenticePortalProfile = {
  accountId: "",
  apprenticeId: "",
  displayName: "Apprentice",
  initials: "AP",
  programmeName: "Programme",
  programmeYear: 1,
  programmeWeek: 1,
  employerName: "",
  employerContact: "",
  mentorName: "",
  mentorId: "contact-mentor",
  tutorName: "",
  tutorId: "contact-tutor",
  plannedProgressPercent: 0,
  actualProgressPercent: 0,
  attendancePercent: 0,
  nextReviewDate: "",
  lastReviewDate: null,
  openActionCount: 0,
  collegeDays: "",
  programmeStartDate: "",
  standardVersion: null,
  deliverySpine: "groups",
  cohortName: null,
};

export type ApprenticeModuleRow = {
  id: string;
  code: string;
  title: string;
  year: 1 | 2 | 3;
  status: "completed" | "in_progress" | "remaining";
  /** Tutor has released this module for the apprentice to open. */
  released: boolean;
  releasedAt: string | null;
  releasedBy: string | null;
};

export type ModuleTopicStatus = "covered" | "in_progress" | "upcoming";

export type ModuleSignOffRole =
  | "Tutor"
  | "Learning & Progress Mentor"
  | "Employer mentor"
  | "Workplace supervisor";

export type ModuleTopic = {
  id: string;
  title: string;
  status: ModuleTopicStatus;
  coveredAt: string | null;
  note?: string;
  /** Who delivered / signed off this outcome for the apprentice. */
  signedOffBy: string | null;
  signedOffRole: ModuleSignOffRole | null;
  method?: string;
  evidenceSummary?: string;
};

export type ApprenticeModuleDetail = ApprenticeModuleRow & {
  summary: string;
  tutorFocus: string;
  /** Outcomes signed off in this module (current / recent). */
  covered: ModuleTopic[];
  /** Outcomes already done earlier in the module or carried from prior modules. */
  previouslyCovered: ModuleTopic[];
  /** Not yet taught or assessed. */
  upcoming: ModuleTopic[];
};

export type ApprenticeReviewSummary = {
  id: string;
  reviewDate: string;
  type: string;
  status: "upcoming" | "completed" | "awaiting_sign_off";
  judgement?: string;
  href?: string;
};

export type ApprenticeReviewStat = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "navy" | "green" | "amber" | "red" | "blue";
  href?: string;
};

export type ApprenticeReviewContribution = {
  id: string;
  fromLabel: string;
  roleLabel: string;
  body: string;
};

export type ApprenticeReviewAction = {
  id: string;
  title: string;
  owner: string;
  status: "open" | "done" | "due_soon";
};

/** Apprentice-readable review record (notes + the statistics used in the meeting). */
export type ApprenticeReviewDetail = ApprenticeReviewSummary & {
  mentorName: string;
  programmeName: string;
  employerName: string;
  /** Short headline under the title. */
  summary: string;
  discussionSummary: string;
  learningFocus: string;
  workplaceNotes?: string;
  barriersNotes?: string;
  wellbeingNotes?: string;
  nextSteps: string[];
  actionsFromReview: ApprenticeReviewAction[];
  contributions: ApprenticeReviewContribution[];
  /** Progress / attendance / OTJ figures discussed or snapshotted for this review. */
  statsUsed: ApprenticeReviewStat[];
  statsNote: string;
  /** Prep destination for upcoming reviews. */
  prepareHref?: string;
};

/** College-session outcomes that can appear on an apprentice attendance record. */
export type ApprenticeAttendanceStatus =
  | "attended"
  | "late"
  | "authorised"
  | "unauthorised"
  | "absent"
  | "college_closed";

export type ApprenticeAttendanceDay = {
  date: string;
  dayName: string;
  session: string;
  status: ApprenticeAttendanceStatus;
  /** Optional short note (e.g. reason for absence or closure). */
  note?: string;
  /** Module topics / tasks / workshop slots missed when the apprentice was away. */
  missedItems?: ApprenticeMissedLearningItem[];
};

export type ApprenticeMissedLearningKind = "module" | "cea" | "workshop";

export type ApprenticeMissedLearningItem = {
  id: string;
  kind: ApprenticeMissedLearningKind;
  title: string;
  detail: string;
  moduleCode?: string;
  href: string;
  catchUpStatus: "needed" | "in_progress" | "done";
};

export type ApprenticeMissedLearningSlice = {
  kind: ApprenticeMissedLearningKind;
  label: string;
  count: number;
  color: string;
};

const MISSED_KIND_META: Record<
  ApprenticeMissedLearningKind,
  { label: string; color: string }
> = {
  module: {
    label: "Module topics",
    color: "var(--color-navy-600)",
  },
  cea: {
    label: "Tracking tasks",
    color: "var(--color-amber-500)",
  },
  workshop: {
    label: "Workshop practicals",
    color: "var(--color-red-500)",
  },
};

export function collectMissedLearningItems(
  days: ApprenticeAttendanceDay[] = BLANK_ATTENDANCE_DAYS,
): ApprenticeMissedLearningItem[] {
  return days.flatMap((day) => day.missedItems ?? []);
}

export function summariseMissedLearning(
  days: ApprenticeAttendanceDay[] = BLANK_ATTENDANCE_DAYS,
): {
  items: ApprenticeMissedLearningItem[];
  slices: ApprenticeMissedLearningSlice[];
  total: number;
  stillNeeded: number;
} {
  const items = collectMissedLearningItems(days);
  const counts: Record<ApprenticeMissedLearningKind, number> = {
    module: 0,
    cea: 0,
    workshop: 0,
  };
  for (const item of items) {
    counts[item.kind] += 1;
  }
  const slices: ApprenticeMissedLearningSlice[] = (
    Object.keys(MISSED_KIND_META) as ApprenticeMissedLearningKind[]
  )
    .map((kind) => ({
      kind,
      label: MISSED_KIND_META[kind].label,
      color: MISSED_KIND_META[kind].color,
      count: counts[kind],
    }))
    .filter((slice) => slice.count > 0);

  return {
    items,
    slices,
    total: items.length,
    stillNeeded: items.filter((item) => item.catchUpStatus !== "done").length,
  };
}

export type ApprenticeAttendanceBreakdownItem = {
  status: ApprenticeAttendanceStatus;
  label: string;
  count: number;
  /** CSS colour token used by the pie chart / legend. */
  color: string;
  /** Whether this status counts toward the attendance % denominator. */
  countsTowardPercent: boolean;
};

/**
 * Year-to-date session mix.
 * Attendance % = (attended + late) / sessions that count toward percent.
 * College-closed days are shown on the chart but excluded from the %.
 */
export const BLANK_ATTENDANCE_BREAKDOWN: ApprenticeAttendanceBreakdownItem[] = [];

export function summariseAttendanceBreakdown(
  breakdown: ApprenticeAttendanceBreakdownItem[] = BLANK_ATTENDANCE_BREAKDOWN,
) {
  const expected = breakdown
    .filter((b) => b.countsTowardPercent)
    .reduce((sum, b) => sum + b.count, 0);
  const present = breakdown
    .filter((b) => b.status === "attended" || b.status === "late")
    .reduce((sum, b) => sum + b.count, 0);
  const catalogued = breakdown.reduce((sum, b) => sum + b.count, 0);
  const percent =
    expected === 0 ? 0 : Math.round((present / expected) * 100);
  return { expected, present, catalogued, percent };
}

export type LearningPlanItemKind =
  | "college"
  | "workplace"
  | "cea"
  | "otj"
  | "review";

export type LearningPlanItem = {
  id: string;
  title: string;
  detail: string;
  kind: LearningPlanItemKind;
  /** Where to go to finish this item in the portal. */
  href: string;
  hrefLabel: string;
};

export type LearningFocus = {
  /** One-line purpose of the plan for this week. */
  purpose: string;
  /** Mentor/tutor narrative for the current focus period. */
  notes: string;
  /** Programme week this plan applies to. */
  weekLabel: string;
  /** Modules the apprentice should be working in right now. */
  activeModuleIds: string[];
  thisWeek: LearningPlanItem[];
  lookingAhead: LearningPlanItem[];
};

/** Full Motor Vehicle L3 catalogue — tutors release modules as the cohort reaches them. */
export const BLANK_MODULES: ApprenticeModuleRow[] = [];

export function getModulesByYear(): Array<{
  year: 1 | 2 | 3;
  label: string;
  modules: ApprenticeModuleRow[];
}> {
  const years: Array<1 | 2 | 3> = [1, 2, 3];
  return years.map((year) => ({
    year,
    label:
      year === BLANK_APPRENTICE_PROFILE.programmeYear
        ? `Year ${year} · current`
        : year < BLANK_APPRENTICE_PROFILE.programmeYear
          ? `Year ${year} · completed year`
          : `Year ${year} · later`,
    modules: BLANK_MODULES.filter((m) => m.year === year),
  }));
}

const MODULE_DETAILS: Record<string, Omit<ApprenticeModuleDetail, keyof ApprenticeModuleRow>> = {};

export function getModuleDetail(moduleId: string): ApprenticeModuleDetail | null {
  const row = BLANK_MODULES.find((m) => m.id === moduleId);
  const detail = MODULE_DETAILS[moduleId];
  if (!row || !detail) return null;
  return { ...row, ...detail };
}

export function getModuleTopic(
  moduleId: string,
  topicId: string,
): { module: ApprenticeModuleDetail; topic: ModuleTopic; section: "covered" | "previouslyCovered" | "upcoming" } | null {
  const moduleItem = getModuleDetail(moduleId);
  if (!moduleItem) return null;

  const covered = moduleItem.covered.find((t) => t.id === topicId);
  if (covered) return { module: moduleItem, topic: covered, section: "covered" };

  const previouslyCovered = moduleItem.previouslyCovered.find((t) => t.id === topicId);
  if (previouslyCovered) {
    return { module: moduleItem, topic: previouslyCovered, section: "previouslyCovered" };
  }

  const upcoming = moduleItem.upcoming.find((t) => t.id === topicId);
  if (upcoming) return { module: moduleItem, topic: upcoming, section: "upcoming" };

  return null;
}

export function formatModuleDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T09:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type TutorSignOffQueueStatus =
  | "needs_doing"
  | "awaiting_sign_off"
  | "signed_off";

export type TutorSignOffItem = {
  id: string;
  apprenticeId: string;
  apprenticeName: string;
  programmeName: string;
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  topicId: string;
  topicTitle: string;
  section: "covered" | "previouslyCovered" | "upcoming";
  queueStatus: TutorSignOffQueueStatus;
  signedOffBy: string | null;
  signedOffRole: ModuleSignOffRole | null;
  coveredAt: string | null;
  note: string | null;
  method: string | null;
  evidenceSummary: string | null;
};

/**
 * Flatten apprentice module outcomes into a tutor sign-off queue.
 * Caseload-wide outcomes once live module data is wired.
 */
export function getTutorSignOffQueue(): TutorSignOffItem[] {
  const items: TutorSignOffItem[] = [];

  for (const row of BLANK_MODULES) {
    const detail = getModuleDetail(row.id);
    if (!detail) continue;

    const push = (
      topic: ModuleTopic,
      section: TutorSignOffItem["section"],
    ) => {
      let queueStatus: TutorSignOffQueueStatus = "needs_doing";
      if (topic.status === "covered" && topic.signedOffBy) {
        queueStatus = "signed_off";
      } else if (topic.status === "in_progress" || (topic.status === "covered" && !topic.signedOffBy)) {
        queueStatus = "awaiting_sign_off";
      } else if (topic.status === "upcoming") {
        queueStatus = "needs_doing";
      }

      items.push({
        id: `${row.id}:${topic.id}`,
        apprenticeId: BLANK_APPRENTICE_PROFILE.apprenticeId,
        apprenticeName: BLANK_APPRENTICE_PROFILE.displayName,
        programmeName: BLANK_APPRENTICE_PROFILE.programmeName,
        moduleId: row.id,
        moduleCode: row.code,
        moduleTitle: row.title,
        topicId: topic.id,
        topicTitle: topic.title,
        section,
        queueStatus,
        signedOffBy: topic.signedOffBy,
        signedOffRole: topic.signedOffRole,
        coveredAt: topic.coveredAt,
        note: topic.note ?? null,
        method: topic.method ?? null,
        evidenceSummary: topic.evidenceSummary ?? null,
      });
    };

    for (const t of detail.covered) push(t, "covered");
    for (const t of detail.previouslyCovered) push(t, "previouslyCovered");
    for (const t of detail.upcoming) push(t, "upcoming");
  }

  return items;
}

export type OtjPartyStatus = "not_ready" | "pending" | "agreed" | "returned";

/**
 * Approval order is fixed:
 * 1. Apprentice submits
 * 2. Employer agrees the entry is true
 * 3. Tutor / teacher confirms last (cannot act before employer)
 */
export type OtjApprovalStep = "apprentice" | "employer" | "tutor" | "complete";

export function otjCurrentStep(entry: ApprenticeOtjEntry): OtjApprovalStep {
  if (entry.employerStatus === "returned" || entry.tutorStatus === "returned") {
    return "apprentice";
  }
  if (entry.employerStatus !== "agreed") return "employer";
  if (entry.tutorStatus !== "agreed") return "tutor";
  return "complete";
}

export function canEmployerActOnOtj(entry: ApprenticeOtjEntry): boolean {
  return entry.employerStatus === "pending";
}

export function canTutorActOnOtj(entry: ApprenticeOtjEntry): boolean {
  return entry.employerStatus === "agreed" && entry.tutorStatus === "pending";
}

/** After employer agrees, unlock tutor for final confirmation. */
export function unlockTutorAfterEmployerAgree(
  entry: ApprenticeOtjEntry,
  employerName: string,
): ApprenticeOtjEntry {
  return {
    ...entry,
    employerStatus: "agreed",
    employerName,
    employerDecidedAt: new Date().toISOString(),
    employerNote: entry.employerNote,
    tutorStatus: "pending",
  };
}

export function returnOtjByEmployer(
  entry: ApprenticeOtjEntry,
  employerName: string,
  note: string,
): ApprenticeOtjEntry {
  return {
    ...entry,
    employerStatus: "returned",
    employerName,
    employerDecidedAt: new Date().toISOString(),
    employerNote: note,
    tutorStatus: "not_ready",
    tutorName: null,
    tutorDecidedAt: null,
    tutorNote: null,
  };
}

/** Digital OTJ training-type codes (modernised from the paper Generic Log). */
export type OtjTrainingTypeCode =
  | "RP"
  | "SE"
  | "OL"
  | "MT"
  | "PS"
  | "PM"
  | "IV"
  | "CC"
  | "LS"
  | "OTHER";

export const OTJ_TRAINING_TYPES: Array<{
  code: OtjTrainingTypeCode;
  label: string;
  group: "theory" | "practical" | "support" | "other";
}> = [
  { code: "RP", label: "Role playing", group: "theory" },
  { code: "SE", label: "Simulation exercise", group: "theory" },
  { code: "OL", label: "Online learning", group: "theory" },
  { code: "MT", label: "Manufacturer / equipment training", group: "theory" },
  { code: "PS", label: "Practical — shadowing", group: "practical" },
  { code: "PM", label: "Practical — mentoring", group: "practical" },
  { code: "IV", label: "Industry visit", group: "practical" },
  { code: "CC", label: "Competition", group: "practical" },
  { code: "LS", label: "Learning support / writing assessments", group: "support" },
  { code: "OTHER", label: "Other (describe below)", group: "other" },
];

export function otjTrainingTypeLabel(code: OtjTrainingTypeCode): string {
  const match = OTJ_TRAINING_TYPES.find((t) => t.code === code);
  return match ? `${code} · ${match.label}` : code;
}

export type ApprenticeOtjEntry = {
  id: string;
  /** Sequential entry number on the apprentice's OTJ log. */
  entryNumber: number;
  /** Short name of the training activity. */
  activityName: string;
  /** Start (or single) date the training was completed (ISO date or datetime). */
  activityDate: string;
  /**
   * Optional end date when this is a catch-up / period claim (one entry covering
   * many weeks). Null for normal single-day logs.
   */
  activityDateEnd: string | null;
  /** Duration in minutes (paper form used 30 / 60 / other; catch-ups may be large). */
  durationMinutes: number;
  trainingType: OtjTrainingTypeCode;
  trainingTypeOther: string | null;
  comments: string;
  submittedAt: string;
  /**
   * Apprentice marked this as a catch-up / backfill block (culturally common:
   * one entry for a long period rather than weekly lines).
   */
  isCatchUp: boolean;
  /** Apprentice confirmed the OTJ definition / paid-time statement. */
  apprenticeConfirmed: boolean;
  employerStatus: OtjPartyStatus;
  employerName: string | null;
  employerDecidedAt: string | null;
  employerNote: string | null;
  tutorStatus: OtjPartyStatus;
  tutorName: string | null;
  tutorDecidedAt: string | null;
  tutorNote: string | null;
};

/** Hours to 2 decimal places from minutes. */
export function otjHours(entry: Pick<ApprenticeOtjEntry, "durationMinutes">): number {
  return Math.round((entry.durationMinutes / 60) * 100) / 100;
}

export function formatOtjDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Date-only label (no time) for activity periods. */
export function formatOtjDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Single day or "12 May – 10 Jul 2026" for catch-up periods. */
export function formatOtjActivityPeriod(
  entry: Pick<ApprenticeOtjEntry, "activityDate" | "activityDateEnd">,
): string {
  const start = formatOtjDateShort(entry.activityDate);
  if (!entry.activityDateEnd) return start;
  const end = formatOtjDateShort(entry.activityDateEnd);
  if (start === end) return start;
  return `${start} – ${end}`;
}

/** Jon's threshold: alert after 1 empty week or 1 empty month without a submission. */
export const OTJ_LOGGING_GAP_THRESHOLD = 1;

/** Duration at/above this (hours) is treated as a catch-up block even if unchecked. */
export const OTJ_CATCH_UP_HOURS_HINT = 8;

export function isOtjCatchUpEntry(
  entry: Pick<
    ApprenticeOtjEntry,
    "isCatchUp" | "durationMinutes" | "activityDate" | "activityDateEnd"
  >,
): boolean {
  if (entry.isCatchUp) return true;
  if (entry.durationMinutes >= OTJ_CATCH_UP_HOURS_HINT * 60) return true;
  if (entry.activityDateEnd) {
    const start = new Date(
      entry.activityDate.includes("T")
        ? entry.activityDate
        : `${entry.activityDate}T12:00:00`,
    );
    const end = new Date(
      entry.activityDateEnd.includes("T")
        ? entry.activityDateEnd
        : `${entry.activityDateEnd}T12:00:00`,
    );
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end.getTime() > start.getTime()
    ) {
      return true;
    }
  }
  return false;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

export type OtjLoggingHealth = {
  lastSubmittedAt: string | null;
  daysSinceLastSubmit: number | null;
  emptyWeeks: number;
  emptyMonths: number;
  /** True when empty weeks or months ≥ OTJ_LOGGING_GAP_THRESHOLD. */
  alert: boolean;
  alertKind: "none" | "never" | "week" | "month";
  /** Staff-facing summary. */
  message: string | null;
  /** Softer apprentice-facing nudge. */
  apprenticeNudge: string | null;
};

/**
 * Logging cadence health from `submittedAt` (when they logged), not activity dates.
 * Catch-up dumps are allowed; we only flag rolling past empty weeks/months.
 */
export function buildOtjLoggingHealth(
  entries: ApprenticeOtjEntry[],
  asOf: Date = new Date(),
): OtjLoggingHealth {
  const threshold = OTJ_LOGGING_GAP_THRESHOLD;
  if (entries.length === 0) {
    return {
      lastSubmittedAt: null,
      daysSinceLastSubmit: null,
      emptyWeeks: threshold,
      emptyMonths: threshold,
      alert: true,
      alertKind: "never",
      message: "No OTJ hours submitted yet.",
      apprenticeNudge: "Log your first OTJ entry when you can — catch-up blocks are fine.",
    };
  }

  const lastSubmittedAt = entries.reduce((latest, e) => {
    return new Date(e.submittedAt).getTime() > new Date(latest).getTime()
      ? e.submittedAt
      : latest;
  }, entries[0].submittedAt);

  const last = startOfLocalDay(new Date(lastSubmittedAt));
  const today = startOfLocalDay(asOf);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceLastSubmit = Math.max(
    0,
    Math.floor((today.getTime() - last.getTime()) / msPerDay),
  );
  const emptyWeeks = Math.floor(daysSinceLastSubmit / 7);
  const emptyMonths = Math.max(0, monthsBetween(last, today));

  const monthAlert = emptyMonths >= threshold;
  const weekAlert = emptyWeeks >= threshold;
  const alert = weekAlert || monthAlert;

  let alertKind: OtjLoggingHealth["alertKind"] = "none";
  let message: string | null = null;
  let apprenticeNudge: string | null = null;

  if (monthAlert) {
    alertKind = "month";
    message = `No OTJ submitted for ${emptyMonths} calendar ${emptyMonths === 1 ? "month" : "months"} (threshold ${threshold}). Catch-up blocks are allowed — review when they arrive.`;
    apprenticeNudge = `You have not logged OTJ for ${emptyMonths} ${emptyMonths === 1 ? "month" : "months"}. A single catch-up entry covering the period is OK — please submit when you can.`;
  } else if (weekAlert) {
    alertKind = "week";
    message = `No OTJ submitted for ${emptyWeeks} ${emptyWeeks === 1 ? "week" : "weeks"} (threshold ${threshold}). Catch-up blocks are allowed — review when they arrive.`;
    apprenticeNudge = `You have not logged OTJ for ${emptyWeeks} ${emptyWeeks === 1 ? "week" : "weeks"}. A catch-up block is fine if you need to backfill.`;
  }

  return {
    lastSubmittedAt,
    daysSinceLastSubmit,
    emptyWeeks,
    emptyMonths,
    alert,
    alertKind,
    message,
    apprenticeNudge,
  };
}

export const BLANK_OTJ_ENTRIES: ApprenticeOtjEntry[] = [];

export function summariseOtjHours(entries: ApprenticeOtjEntry[]) {
  const fullyAgreed = entries.filter(
    (e) => e.employerStatus === "agreed" && e.tutorStatus === "agreed",
  );
  const awaitingEmployer = entries.filter((e) => e.employerStatus === "pending");
  const awaitingTutor = entries.filter(
    (e) => e.employerStatus === "agreed" && e.tutorStatus === "pending",
  );
  const returned = entries.filter(
    (e) => e.employerStatus === "returned" || e.tutorStatus === "returned",
  );
  const sumHours = (list: ApprenticeOtjEntry[]) =>
    Math.round(list.reduce((total, e) => total + otjHours(e), 0) * 100) / 100;

  return {
    totalHours: sumHours(entries),
    agreedHours: sumHours(fullyAgreed),
    awaitingEmployerHours: sumHours(awaitingEmployer),
    awaitingTutorHours: sumHours(awaitingTutor),
    returnedCount: returned.length,
    fullyAgreedCount: fullyAgreed.length,
    awaitingEmployerCount: awaitingEmployer.length,
    awaitingTutorCount: awaitingTutor.length,
  };
}

/** Programme minimum OTJ hours (from Generic Log guidance). */
export const OTJ_MINIMUM_HOURS = 40;

/**
 * Previous-fortnight OTJ baseline for trend stats.
 * Live totals will replace this once OTJ history is stored.
 */
export const OTJ_PREVIOUS_FORTNIGHT = {
  agreedHours: 0,
  awaitingEmployerHours: 0,
  awaitingTutorHours: 0,
  returnedCount: 0,
};

export type OtjTrendDirection = "up" | "down" | "flat";

export type OtjStatCard = {
  id: "agreed" | "employer" | "teacher" | "returned";
  label: string;
  value: string;
  hint: string;
  tone: "green" | "amber" | "blue" | "red";
  trendDirection: OtjTrendDirection;
  /** e.g. "↑ 11% vs last fortnight" or "On track" */
  trendLabel: string;
  /** Whether up is good for this metric (waiting/returned: down is good). */
  trendIsGood: boolean;
};

export type OtjHealthStatus = "ahead" | "on_track" | "behind" | "attention";

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return Math.round(((current - previous) / previous) * 100);
}

function trendFromChange(
  change: number | null,
): { direction: OtjTrendDirection; label: string } {
  if (change === null) {
    return { direction: "up", label: "New this period" };
  }
  if (change === 0) {
    return { direction: "flat", label: "No change vs last fortnight" };
  }
  const arrow = change > 0 ? "↑" : "↓";
  return {
    direction: change > 0 ? "up" : "down",
    label: `${arrow} ${Math.abs(change)}% vs last fortnight`,
  };
}

/**
 * Expected agreed hours by current programme week toward the 40h minimum
 * (linear plan across a typical 52-week year-1 window for demo purposes).
 */
export function expectedOtjHoursByWeek(programmeWeek: number): number {
  const plannedWeeks = 52;
  const expected =
    (Math.min(Math.max(programmeWeek, 0), plannedWeeks) / plannedWeeks) *
    OTJ_MINIMUM_HOURS;
  return Math.round(expected * 10) / 10;
}

export function buildOtjDashboardStats(
  entries: ApprenticeOtjEntry[],
  programmeWeek: number = BLANK_APPRENTICE_PROFILE.programmeWeek,
) {
  const summary = summariseOtjHours(entries);
  const previous = OTJ_PREVIOUS_FORTNIGHT;
  const expected = expectedOtjHoursByWeek(programmeWeek);
  const progressPercent = Math.min(
    100,
    Math.round((summary.agreedHours / OTJ_MINIMUM_HOURS) * 100),
  );

  let health: OtjHealthStatus = "on_track";
  if (summary.returnedCount > 0) health = "attention";
  else if (summary.agreedHours >= expected + 1) health = "ahead";
  else if (summary.agreedHours + 1 < expected) health = "behind";

  const healthLabel =
    health === "ahead"
      ? `Ahead of plan (+${Math.round((summary.agreedHours - expected) * 10) / 10}h)`
      : health === "behind"
        ? `Behind plan (−${Math.round((expected - summary.agreedHours) * 10) / 10}h)`
        : health === "attention"
          ? "Needs attention — returned entries"
          : "On track vs programme plan";

  const agreedChange = percentChange(summary.agreedHours, previous.agreedHours);
  const employerChange = percentChange(
    summary.awaitingEmployerHours,
    previous.awaitingEmployerHours,
  );
  const teacherChange = percentChange(
    summary.awaitingTutorHours,
    previous.awaitingTutorHours,
  );
  const returnedChange = percentChange(
    summary.returnedCount,
    previous.returnedCount,
  );

  const agreedTrend = trendFromChange(agreedChange);
  const employerTrend = trendFromChange(employerChange);
  const teacherTrend = trendFromChange(teacherChange);
  const returnedTrend = trendFromChange(returnedChange);

  const cards: OtjStatCard[] = [
    {
      id: "agreed",
      label: "Fully agreed",
      value: `${summary.agreedHours}h`,
      hint: `${summary.fullyAgreedCount} ${summary.fullyAgreedCount === 1 ? "entry" : "entries"} · employer + teacher`,
      tone: "green",
      trendDirection: agreedTrend.direction,
      trendLabel: agreedTrend.label,
      trendIsGood:
        agreedTrend.direction === "up" || agreedTrend.direction === "flat",
    },
    {
      id: "employer",
      label: "Awaiting employer",
      value: `${summary.awaitingEmployerHours}h`,
      hint: `${summary.awaitingEmployerCount} with ${BLANK_APPRENTICE_PROFILE.employerContact}`,
      tone: "amber",
      trendDirection: employerTrend.direction,
      trendLabel: employerTrend.label,
      trendIsGood:
        employerTrend.direction === "down" || employerTrend.direction === "flat",
    },
    {
      id: "teacher",
      label: "Awaiting teacher",
      value: `${summary.awaitingTutorHours}h`,
      hint: `${summary.awaitingTutorCount} with ${BLANK_APPRENTICE_PROFILE.tutorName} (final)`,
      tone: "blue",
      trendDirection: teacherTrend.direction,
      trendLabel: teacherTrend.label,
      trendIsGood:
        teacherTrend.direction === "down" || teacherTrend.direction === "flat",
    },
    {
      id: "returned",
      label: "Returned",
      value: String(summary.returnedCount),
      hint:
        summary.returnedCount === 0 ? "None need your update" : "Needs your update",
      tone: "red",
      trendDirection: returnedTrend.direction,
      trendLabel: returnedTrend.label,
      trendIsGood:
        returnedTrend.direction === "down" ||
        (returnedTrend.direction === "flat" && summary.returnedCount === 0),
    },
  ];

  return {
    summary,
    cards,
    minimumHours: OTJ_MINIMUM_HOURS,
    expectedHours: expected,
    progressPercent,
    health,
    healthLabel,
  };
}

export function nextOtjEntryNumber(entries: ApprenticeOtjEntry[]): number {
  if (entries.length === 0) return 1;
  return Math.max(...entries.map((e) => e.entryNumber)) + 1;
}

export function otjPipelineLabel(entry: ApprenticeOtjEntry): string {
  if (entry.employerStatus === "returned" || entry.tutorStatus === "returned") {
    return "Returned — needs update";
  }
  if (entry.employerStatus === "pending") return "1/3 Awaiting employer";
  if (entry.tutorStatus === "not_ready") return "1/3 Awaiting employer";
  if (entry.tutorStatus === "pending") return "2/3 Awaiting teacher";
  return "3/3 Fully agreed";
}

export const BLANK_REVIEW_DETAILS: ApprenticeReviewDetail[] = [];

export const BLANK_REVIEWS: ApprenticeReviewSummary[] = BLANK_REVIEW_DETAILS.map(
  ({
    id,
    reviewDate,
    type,
    status,
    judgement,
    href,
  }) => ({
    id,
    reviewDate,
    type,
    status,
    judgement,
    href,
  }),
);

export function getReviewDetail(reviewId: string): ApprenticeReviewDetail | null {
  return BLANK_REVIEW_DETAILS.find((review) => review.id === reviewId) ?? null;
}

export const BLANK_ATTENDANCE_DAYS: ApprenticeAttendanceDay[] = [];

export const BLANK_LEARNING: LearningFocus = {
  purpose: "",
  notes: "",
  weekLabel: "Week 1",
  activeModuleIds: [],
  thisWeek: [],
  lookingAhead: [],
};




export function learningKindLabel(kind: LearningPlanItemKind): string {
  switch (kind) {
    case "college":
      return "College";
    case "workplace":
      return "Workplace";
    case "cea":
      return "Tracking";
    case "otj":
      return "OTJ";
    case "review":
      return "Review";
  }
}

export type ApprenticeOpenTarget = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: string;
  href: string;
  hrefLabel: string;
};

export const BLANK_OPEN_TARGETS: ApprenticeOpenTarget[] = [];

export function getBlankApprenticeProfile(): ApprenticePortalProfile {
  return BLANK_APPRENTICE_PROFILE;
}
