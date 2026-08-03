import type {
  EvidenceRequirementRowDto,
  ApprenticeCardDto,
  LifecycleBoardDto,
  ApprenticeWorkspaceDto,
  BoardQuery,
  SummaryMetricDto,
  TimelineEventDto,
  OverallApprenticeStatus,
  ProgrammeStatus,
  PriorityTaskSummary,
} from "@/features/apprentice-lifecycle/types";
import type { ApprenticeLifecycleDataPort } from "@/features/apprentice-lifecycle/ports";
import { programmeWeekColumnLabel } from "@/features/apprentice-lifecycle/domain/programme-week-dates";
import { buildAdm14EvidenceRows } from "@/features/apprentice-lifecycle/domain/adm14-evidence-rows";
import {
  calculateProgrammeWeek,
  describeProgrammeTiming,
  formatDisplayDate,
  formatOverdueDuration,
  isProgrammeOverdue,
  startOfUtcDay,
} from "@/features/apprentice-lifecycle/domain/programme-week";

/** Fixed “today” for reproducible shell demos (UTC). Swap for `new Date()` when live. */
const BOARD_AS_OF = startOfUtcDay(new Date(Date.UTC(2026, 6, 16, 12, 0, 0)));

type ApprenticeSeed = {
  apprenticeId: string;
  displayName: string;
  initials: string;
  programmeName: string;
  employerName: string | null;
  /** ISO date YYYY-MM-DD — drives board placement */
  programmeStartDate: string | null;
  originalPlannedEndDate: string | null;
  programmeStatus: ProgrammeStatus;
  overallStatus: OverallApprenticeStatus;
  primaryPriority: PriorityTaskSummary | null;
  attendancePercent: number | null;
  nextReviewDate: string | null;
  openActionCount: number;
  missingMandatoryEvidenceCount: number;
  evidenceCheckedCount: number;
  evidenceTotalCount: number;
  mentorName: string | null;
  tutorName: string | null;
  intakeComplete: boolean;
  apprenticeReference: string | null;
};

function daysBefore(asOf: Date, days: number): string {
  const d = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function daysAfter(asOf: Date, days: number): string {
  const d = new Date(asOf.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed apprentices with real start/end dates.
 * Board week is calculated from start date — not hard-coded.
 */
const apprenticeSeeds: ApprenticeSeed[] = [
  {
    apprenticeId: "lrn-james-wilson",
    displayName: "James Wilson",
    initials: "JW",
    programmeName: "Plumbing Eng. L3",
    employerName: "Northline Services Ltd",
    programmeStartDate: daysBefore(BOARD_AS_OF, 14), // → week 3
    originalPlannedEndDate: daysAfter(BOARD_AS_OF, 700),
    programmeStatus: "on_programme",
    overallStatus: "on_track",
    primaryPriority: {
      title: "Upcoming progress review",
      ownerCategory: "gta",
      summary: "Review due in 9 days",
      dueDate: "2026-07-25",
    },
    attendancePercent: 96,
    nextReviewDate: "2026-07-25",
    openActionCount: 1,
    missingMandatoryEvidenceCount: 0,
    evidenceCheckedCount: 12,
    evidenceTotalCount: 28,
    mentorName: "Sarah Patel",
    tutorName: "Sarah Patel",
    intakeComplete: true,
    apprenticeReference: "GTA-2026-01001",
  },
  {
    apprenticeId: "lrn-ava-brooks",
    displayName: "Ava Brooks",
    initials: "AB",
    programmeName: "Motor Vehicle L3",
    employerName: "Riverside Autocare",
    programmeStartDate: daysBefore(BOARD_AS_OF, 13 * 7), // → week 14
    originalPlannedEndDate: daysAfter(BOARD_AS_OF, 600),
    programmeStatus: "on_programme",
    overallStatus: "monitoring",
    primaryPriority: {
      title: "Progress review overdue",
      ownerCategory: "gta",
      summary: "Review overdue by 4 days",
      dueDate: "2026-07-12",
    },
    attendancePercent: 91,
    nextReviewDate: "2026-07-12",
    openActionCount: 2,
    missingMandatoryEvidenceCount: 1,
    evidenceCheckedCount: 10,
    evidenceTotalCount: 28,
    mentorName: "Sarah Patel",
    tutorName: "Daniel Okoye",
    intakeComplete: true,
    apprenticeReference: "GTA-2026-01014",
  },
  {
    apprenticeId: "lrn-liam-anderson",
    displayName: "Liam Anderson",
    initials: "LA",
    programmeName: "Panel Technician L3",
    employerName: "Don Valley Bodyworks",
    programmeStartDate: daysBefore(BOARD_AS_OF, 17 * 7), // → week 18
    originalPlannedEndDate: daysAfter(BOARD_AS_OF, 550),
    programmeStatus: "on_programme",
    overallStatus: "monitoring",
    primaryPriority: {
      title: "Missing mandatory evidence",
      ownerCategory: "apprentice",
      summary: "Initial Assessment – BKSB Report missing",
      dueDate: null,
    },
    attendancePercent: 89,
    nextReviewDate: "2026-07-20",
    openActionCount: 3,
    missingMandatoryEvidenceCount: 2,
    evidenceCheckedCount: 9,
    evidenceTotalCount: 28,
    mentorName: "Ryan Chambers",
    tutorName: "Sarah Patel",
    intakeComplete: true,
    apprenticeReference: "GTA-2024-01842",
  },
  {
    apprenticeId: "lrn-mia-chen",
    displayName: "Mia Chen",
    initials: "MC",
    programmeName: "Business Admin L3",
    employerName: "Ashfield Logistics",
    programmeStartDate: daysBefore(BOARD_AS_OF, 29 * 7), // → week 30
    originalPlannedEndDate: daysAfter(BOARD_AS_OF, 500),
    programmeStatus: "on_programme",
    overallStatus: "priority_intervention",
    primaryPriority: {
      title: "Employer opportunity not delivered",
      ownerCategory: "employer",
      summary: "Primary cause: employer opportunity blocked",
      dueDate: "2026-07-18",
    },
    attendancePercent: 84,
    nextReviewDate: "2026-07-17",
    openActionCount: 5,
    missingMandatoryEvidenceCount: 0,
    evidenceCheckedCount: 15,
    evidenceTotalCount: 28,
    mentorName: "Sarah Patel",
    tutorName: "Priya Shah",
    intakeComplete: true,
    apprenticeReference: "GTA-2025-02030",
  },
  {
    apprenticeId: "lrn-noah-reid",
    displayName: "Noah Reid",
    initials: "NR",
    programmeName: "Electrical Install L3",
    employerName: "Peak Power Solutions",
    programmeStartDate: daysBefore(BOARD_AS_OF, 21 * 7), // → week 22
    originalPlannedEndDate: daysAfter(BOARD_AS_OF, 520),
    programmeStatus: "on_programme",
    overallStatus: "monitoring",
    primaryPriority: {
      title: "Attendance concern",
      ownerCategory: "apprentice",
      summary: "Attendance 72% — trend declining",
      dueDate: null,
    },
    attendancePercent: 72,
    nextReviewDate: "2026-07-19",
    openActionCount: 2,
    missingMandatoryEvidenceCount: 0,
    evidenceCheckedCount: 14,
    evidenceTotalCount: 28,
    mentorName: "Daniel Okoye",
    tutorName: "Sarah Patel",
    intakeComplete: true,
    apprenticeReference: "GTA-2025-02022",
  },
  {
    apprenticeId: "lrn-sofia-martinez",
    displayName: "Sofia Martinez",
    initials: "SM",
    programmeName: "Plumbing Eng. L3",
    employerName: null,
    programmeStartDate: daysAfter(BOARD_AS_OF, 21), // future → pre-start
    originalPlannedEndDate: null,
    programmeStatus: "pre_start",
    overallStatus: "pre_start",
    primaryPriority: {
      title: "Awaiting intake",
      ownerCategory: "gta",
      summary: "Intake and enrolment not yet complete",
      dueDate: null,
    },
    attendancePercent: null,
    nextReviewDate: null,
    openActionCount: 1,
    missingMandatoryEvidenceCount: 4,
    evidenceCheckedCount: 0,
    evidenceTotalCount: 28,
    mentorName: "Sarah Patel",
    tutorName: null,
    intakeComplete: false,
    apprenticeReference: null,
  },
  {
    apprenticeId: "lrn-ethan-clarke",
    displayName: "Ethan Clarke",
    initials: "EC",
    programmeName: "Motor Vehicle L3",
    employerName: "Hexthorpe Motors",
    programmeStartDate: daysBefore(BOARD_AS_OF, 109 * 7), // → week 110
    originalPlannedEndDate: daysBefore(BOARD_AS_OF, 45), // overdue
    programmeStatus: "on_programme",
    overallStatus: "programme_overdue",
    primaryPriority: {
      title: "Programme overdue",
      ownerCategory: "gta",
      summary: "Past planned end — gateway evidence outstanding",
      dueDate: "2026-05-01",
    },
    attendancePercent: 88,
    nextReviewDate: "2026-07-16",
    openActionCount: 4,
    missingMandatoryEvidenceCount: 3,
    evidenceCheckedCount: 20,
    evidenceTotalCount: 28,
    mentorName: "Sarah Patel",
    tutorName: "Daniel Okoye",
    intakeComplete: true,
    apprenticeReference: "GTA-2024-00910",
  },
  {
    apprenticeId: "lrn-isla-bennett",
    displayName: "Isla Bennett",
    initials: "IB",
    programmeName: "Panel Technician L3",
    employerName: "Don Valley Bodyworks",
    programmeStartDate: daysBefore(BOARD_AS_OF, 7 * 7), // → week 8
    originalPlannedEndDate: daysAfter(BOARD_AS_OF, 650),
    programmeStatus: "on_programme",
    overallStatus: "on_track",
    primaryPriority: {
      title: "Conditional evidence not required",
      ownerCategory: "gta",
      summary: "Small Employer Waiver marked not applicable with reason",
      dueDate: null,
    },
    attendancePercent: 98,
    nextReviewDate: "2026-08-01",
    openActionCount: 0,
    missingMandatoryEvidenceCount: 0,
    evidenceCheckedCount: 11,
    evidenceTotalCount: 28,
    mentorName: "Ryan Chambers",
    tutorName: "Sarah Patel",
    intakeComplete: true,
    apprenticeReference: "GTA-2026-01008",
  },
];

function toApprenticeCard(seed: ApprenticeSeed, asOf: Date): ApprenticeCardDto {
  const start = seed.programmeStartDate
    ? startOfUtcDay(new Date(`${seed.programmeStartDate}T12:00:00.000Z`))
    : null;
  const plannedEnd = seed.originalPlannedEndDate
    ? startOfUtcDay(new Date(`${seed.originalPlannedEndDate}T12:00:00.000Z`))
    : null;

  const programmeWeek =
    start && seed.programmeStatus !== "pre_start"
      ? calculateProgrammeWeek(start, asOf)
      : start
        ? calculateProgrammeWeek(start, asOf)
        : null;

  const overdue =
    plannedEnd != null &&
    isProgrammeOverdue(plannedEnd, asOf, seed.programmeStatus);

  const resolvedStatus: OverallApprenticeStatus = overdue
    ? "programme_overdue"
    : programmeWeek == null && seed.programmeStatus === "pre_start"
      ? "pre_start"
      : seed.overallStatus;

  return {
    apprenticeId: seed.apprenticeId,
    displayName: seed.displayName,
    initials: seed.initials,
    programmeName: seed.programmeName,
    employerName: seed.employerName,
    programmeWeek,
    programmeStatus:
      programmeWeek == null && start && asOf < start
        ? "pre_start"
        : seed.programmeStatus,
    overallStatus: resolvedStatus,
    primaryPriority: seed.primaryPriority,
    attendancePercent: seed.attendancePercent,
    nextReviewDate: seed.nextReviewDate,
    openActionCount: seed.openActionCount,
    missingMandatoryEvidenceCount: seed.missingMandatoryEvidenceCount,
    evidenceCheckedCount: seed.evidenceCheckedCount,
    evidenceTotalCount: seed.evidenceTotalCount,
    programmeOverdueLabel:
      overdue && plannedEnd ? formatOverdueDuration(plannedEnd, asOf) : null,
    /** Overdue apprentices stay in the pinned column, not their elapsed week column */
    boardWeek: overdue ? null : programmeWeek,
    mentorName: seed.mentorName,
    tutorName: seed.tutorName,
    intakeComplete: seed.intakeComplete,
  };
}

function getApprentices(asOf: Date = BOARD_AS_OF): ApprenticeCardDto[] {
  return apprenticeSeeds.map((seed) => toApprenticeCard(seed, asOf));
}

function getSeed(apprenticeId: string): ApprenticeSeed | undefined {
  return apprenticeSeeds.find((s) => s.apprenticeId === apprenticeId);
}

/** Search index for the blank apprentice pack entry page. */
export function listApprenticeSearchHits(): Array<{
  apprenticeId: string;
  displayName: string;
  employerName: string | null;
  programmeName: string;
  tutorName: string | null;
  apprenticeReference: string | null;
}> {
  return apprenticeSeeds.map((seed) => ({
    apprenticeId: seed.apprenticeId,
    displayName: seed.displayName,
    employerName: seed.employerName,
    programmeName: seed.programmeName,
    tutorName: seed.tutorName,
    apprenticeReference: seed.apprenticeReference,
  }));
}

const metrics: SummaryMetricDto[] = [
  {
    key: "active_apprentices",
    label: "Active Apprentices",
    value: 20,
    deltaLabel: "+2 this week",
    tone: "green",
    trend: "up",
    sparkline: [16, 17, 17, 18, 19, 19, 20],
    breakdown: ["16 on track", "4 needing attention"],
    actionLabel: "Open progress monitoring",
  },
  {
    key: "priority_intervention",
    label: "Priority Intervention",
    value: 5,
    deltaLabel: "+1 this week",
    tone: "red",
    trend: "up",
    sparkline: [2, 3, 3, 4, 4, 4, 5],
    breakdown: ["2 have no improving trend", "1 escalated this week"],
    actionLabel: "View interventions",
  },
  {
    key: "reviews_due",
    label: "Reviews Due This Week",
    value: 8,
    deltaLabel: "+2 this week",
    tone: "amber",
    trend: "up",
    sparkline: [5, 5, 6, 6, 7, 7, 8],
    breakdown: ["3 ready", "2 waiting for employer", "3 not prepared"],
    actionLabel: "Open review queue",
  },
  {
    key: "programme_overdue",
    label: "Programme Overdue",
    value: 1,
    deltaLabel: "stable",
    tone: "red",
    trend: "flat",
    sparkline: [1, 1, 1, 1, 1, 1, 1],
    breakdown: ["Gateway evidence outstanding"],
    actionLabel: "View apprentices",
  },
  {
    key: "employer_actions_overdue",
    label: "Employer Actions Overdue",
    value: 5,
    deltaLabel: "+1 this week",
    tone: "amber",
    trend: "up",
    sparkline: [3, 3, 4, 4, 4, 5, 5],
    breakdown: ["2 repeated misses", "1 employment-risk related"],
    actionLabel: "Open action centre",
  },
  {
    key: "missing_mandatory_evidence",
    label: "Missing Mandatory Evidence",
    value: 14,
    deltaLabel: "+3 this week",
    tone: "red",
    trend: "up",
    sparkline: [8, 9, 10, 11, 12, 13, 14],
    breakdown: ["4 apprentices with multiple gaps"],
    actionLabel: "Open progress monitoring",
  },
];

function yearWeekBounds(year: 1 | 2 | 3): { start: number; end: number } {
  if (year === 1) return { start: 1, end: 52 };
  if (year === 2) return { start: 53, end: 104 };
  return { start: 105, end: 156 };
}

function buildEvidenceRows(): EvidenceRequirementRowDto[] {
  return buildAdm14EvidenceRows();
}

function buildTimeline(): TimelineEventDto[] {
  return [
    {
      id: "tl-1",
      occurredAt: "2024-06-08T10:00:00Z",
      eventType: "Evidence checked",
      summary: "Initial Assessment – Knowledge testing record checked",
      actorName: "S. Patel",
    },
    {
      id: "tl-2",
      occurredAt: "2024-06-07T15:30:00Z",
      eventType: "Evidence received",
      summary: "Enrolment form received from apprentice",
      actorName: "System",
    },
    {
      id: "tl-3",
      occurredAt: "2024-06-06T09:00:00Z",
      eventType: "Review scheduled",
      summary: "Initial Review scheduled for 12/06/2024",
      actorName: "S. Patel",
    },
    {
      id: "tl-4",
      occurredAt: "2024-06-05T11:00:00Z",
      eventType: "Action created",
      summary: "Upload eSET test notes — assigned to apprentice",
      actorName: "S. Patel",
    },
    {
      id: "tl-5",
      occurredAt: "2024-06-02T09:00:00Z",
      eventType: "Apprentice enrolled",
      summary: "Programme started",
      actorName: "System",
    },
  ];
}

export const fictionalDataAdapter: ApprenticeLifecycleDataPort = {
  async getLifecycleBoard(query: BoardQuery): Promise<LifecycleBoardDto> {
    const asOf = BOARD_AS_OF;
    const { start, end } = yearWeekBounds(query.year);
    const from = start;
    const span = end - start + 1;
    const weeks = Array.from({ length: span }, (_, i) => from + i);
    const apprentices = getApprentices(asOf);

    const apprenticesById = Object.fromEntries(apprentices.map((l) => [l.apprenticeId, l]));

    const preStartIds = apprentices
      .filter((l) => l.programmeStatus === "pre_start" || l.boardWeek == null && l.overallStatus === "pre_start")
      .filter((l) => l.overallStatus !== "programme_overdue")
      .map((l) => l.apprenticeId);

    const columns = [
      {
        kind: "pre_start" as const,
        weekNumber: null,
        label: "PRE-START",
        sublabel: "Start date not yet reached",
        apprenticeIds: query.year === 1 ? preStartIds : [],
      },
      ...weeks.map((weekNumber) => ({
        kind: "week" as const,
        weekNumber,
        label: programmeWeekColumnLabel(weekNumber),
        /** No shared calendar dates — week is elapsed from each apprentice’s start date */
        sublabel: null as string | null,
        apprenticeIds: apprentices
          .filter((l) => l.boardWeek === weekNumber)
          .map((l) => l.apprenticeId),
      })),
    ];

    const overdueIds = apprentices
      .filter((l) => l.overallStatus === "programme_overdue")
      .map((l) => l.apprenticeId);

    return {
      query: { ...query, fromWeek: from, span },
      metrics,
      columns,
      overdueColumn: {
        kind: "overdue",
        weekNumber: null,
        label: "OVERDUE",
        sublabel: "Planned end date passed",
        apprenticeIds: overdueIds,
      },
      apprenticesById,
      viewingLabel: `Today ${formatDisplayDate(asOf)} · Year ${query.year} · Programme weeks ${from}–${end} of 156`,
    };
  },

  async getApprenticeWorkspace(apprenticeId: string): Promise<ApprenticeWorkspaceDto | null> {
    const asOf = BOARD_AS_OF;
    const seed = getSeed(apprenticeId);
    const card = getApprentices(asOf).find((l) => l.apprenticeId === apprenticeId);
    if (!seed || !card) return null;

    return {
      card,
      apprenticeReference: seed.apprenticeReference,
      programmeStartDate: seed.programmeStartDate,
      originalPlannedEndDate: seed.originalPlannedEndDate,
      currentWeekLabel: (() => {
        const timing = describeProgrammeTiming(
          seed.programmeStartDate,
          asOf,
        );
        if (!timing.hasStarted) return timing.weekLabel;
        return timing.timeOnProgramme
          ? `${timing.weekLabel} · ${timing.timeOnProgramme}`
          : timing.weekLabel;
      })(),
      progressStatus: card.intakeComplete ? "Monitoring" : null,
      attendanceStatus:
        card.attendancePercent != null ? `${card.attendancePercent}%` : null,
      complianceStatus: card.intakeComplete ? "Monitoring" : null,
      summaryNote: card.intakeComplete
        ? null
        : "Apprentice summary will populate from digital intake and enrolment.",
      evidenceRows: card.intakeComplete ? buildEvidenceRows() : [],
      timeline: card.intakeComplete ? buildTimeline() : [],
    };
  },
};
