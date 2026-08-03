import {
  describeProgrammeTiming,
  formatDisplayDate,
  formatOverdueDuration,
  isProgrammeOverdue,
  startOfUtcDay,
} from "@/features/apprentice-lifecycle/domain/programme-week";
import {
  formatProgressStatusLabel,
} from "@/features/apprentice-lifecycle/domain/progress-framing";
import {
  preStartColumnSublabel,
  programmeWeekColumnLabel,
  programmeWeekColumnSublabel,
} from "@/features/apprentice-lifecycle/domain/programme-week-dates";
import type {
  BoardColumnDto,
  BoardQuery,
  ApprenticeCardDto,
  ApprenticeWorkspaceDto,
  LifecycleBoardDto,
  SummaryMetricDto,
} from "@/features/apprentice-lifecycle/types";
import type { ApprenticeLifecycleDataPort } from "@/features/apprentice-lifecycle/ports";
import { buildBlankPackRows } from "@/features/apprentice-lifecycle/domain/pack-store";
import { createSupabaseServerClient } from "./client";

type JoinedRow<T> = T | T[] | null;

type ApprenticeRow = {
  id: string;
  display_name: string;
  apprentice_reference: string | null;
};

type ApprenticeProgrammeRow = {
  id: string;
  apprentice_id: string | null;
  programme_id: string | null;
  programme_name: string;
  standard_code: string | null;
  employer_name: string | null;
  workplace_contact: string | null;
  mentor_name: string | null;
  tutor_name: string | null;
  college_days: string | null;
  teaching_group_id: string | null;
  programme_week: number | null;
  attendance_percent: number | null;
  start_date: string;
  original_planned_end_date: string;
  status: string;
  actual_progress_percent: number | null;
  notes: string | null;
  apprentices: JoinedRow<ApprenticeRow>;
};

function firstJoined<T>(value: JoinedRow<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toProgrammeStatus(
  status: string,
  hasStarted: boolean,
): ApprenticeCardDto["programmeStatus"] {
  switch (status) {
    case "completed":
    case "withdrawn":
      return status;
    case "draft":
    case "pending_start":
      return hasStarted ? "on_programme" : "pre_start";
    default:
      return "on_programme";
  }
}

function toOverallStatus(
  row: ApprenticeProgrammeRow,
  hasStarted: boolean,
): ApprenticeCardDto["overallStatus"] {
  if (row.status === "completed") return "completed";
  if (row.status === "withdrawn") return "unknown";
  const plannedEnd = new Date(`${row.original_planned_end_date}T12:00:00Z`);
  if (isProgrammeOverdue(plannedEnd, new Date(), row.status)) return "programme_overdue";
  if (!hasStarted) return "pre_start";
  return "on_track";
}

function initialsFromName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "LL";
}

function buildColumns(query: BoardQuery): BoardColumnDto[] {
  const weekColumns: BoardColumnDto[] = [
    {
      kind: "pre_start",
      weekNumber: null,
      label: "Pre-start",
      sublabel: preStartColumnSublabel(),
      apprenticeIds: [],
    },
  ];

  for (let week = query.fromWeek; week < query.fromWeek + query.span; week += 1) {
    weekColumns.push({
      kind: "week",
      weekNumber: week,
      label: programmeWeekColumnLabel(week),
      sublabel: programmeWeekColumnSublabel(week),
      apprenticeIds: [],
    });
  }

  return weekColumns;
}

function buildMetrics(rows: ApprenticeProgrammeRow[]): SummaryMetricDto[] {
  const overdue = rows.filter((row) =>
    isProgrammeOverdue(new Date(row.original_planned_end_date), new Date(), row.status),
  ).length;
  const active = rows.filter((row) => row.status === "active").length;
  const preStart = rows.filter(
    (row) => row.status === "draft" || row.status === "pending_start",
  ).length;

  return [
    {
      key: "active_apprentices",
      label: "Active apprentices",
      value: active,
      deltaLabel: null,
      tone: "neutral",
      sparkline: [],
      trend: "flat",
      breakdown: preStart ? [`${preStart} pre-start`] : undefined,
    },
    {
      key: "priority_intervention",
      label: "Priority intervention",
      value: 0,
      deltaLabel: null,
      tone: "neutral",
      sparkline: [],
      trend: "flat",
    },
    {
      key: "reviews_due",
      label: "Reviews due",
      value: 0,
      deltaLabel: null,
      tone: "neutral",
      sparkline: [],
      trend: "flat",
    },
    {
      key: "programme_overdue",
      label: "Programme overdue",
      value: overdue,
      deltaLabel: null,
      tone: overdue ? "amber" : "green",
      sparkline: [],
      trend: "flat",
    },
    {
      key: "employer_actions_overdue",
      label: "Employer actions overdue",
      value: 0,
      deltaLabel: null,
      tone: "neutral",
      sparkline: [],
      trend: "flat",
    },
    {
      key: "missing_mandatory_evidence",
      label: "Missing mandatory evidence",
      value: 0,
      deltaLabel: null,
      tone: "neutral",
      sparkline: [],
      trend: "flat",
    },
  ];
}

function toApprenticeCard(row: ApprenticeProgrammeRow): ApprenticeCardDto | null {
  const apprentice = firstJoined(row.apprentices);
  if (!apprentice) return null;

  const today = startOfUtcDay(new Date());
  const plannedEnd = new Date(`${row.original_planned_end_date}T12:00:00Z`);
  const timing = describeProgrammeTiming(row.start_date, today);
  const programmeWeek = timing.week;
  const programmeStatus = toProgrammeStatus(row.status, timing.hasStarted);
  const overallStatus = toOverallStatus(row, timing.hasStarted);
  const overdue = isProgrammeOverdue(plannedEnd, today, row.status);
  const blankPack = buildBlankPackRows();
  const missingMandatory = blankPack.filter(
    (r) =>
      r.requirementKind === "mandatory" &&
      r.status !== "future_requirement" &&
      r.status === "missing",
  ).length;

  return {
    apprenticeId: apprentice.id,
    displayName: apprentice.display_name,
    initials: initialsFromName(apprentice.display_name),
    programmeName: row.programme_name,
    employerName: row.employer_name || null,
    programmeWeek,
    programmeStatus,
    overallStatus,
    primaryPriority: null,
    attendancePercent: row.attendance_percent,
    nextReviewDate: null,
    openActionCount: 0,
    missingMandatoryEvidenceCount: missingMandatory,
    evidenceCheckedCount: 0,
    evidenceTotalCount: blankPack.length,
    programmeOverdueLabel: overdue ? formatOverdueDuration(plannedEnd, today) : null,
    // Place on the live week column once the start date has passed.
    boardWeek: overdue || programmeWeek == null ? null : programmeWeek,
    mentorName: row.mentor_name?.trim() || null,
    tutorName: row.tutor_name?.trim() || null,
    intakeComplete: true,
  };
}

async function readApprenticeProgrammes(): Promise<ApprenticeProgrammeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("apprentice_programmes").select(`
      id,
      apprentice_id,
      programme_id,
      programme_name,
      standard_code,
      employer_name,
      workplace_contact,
      mentor_name,
      tutor_name,
      college_days,
      teaching_group_id,
      programme_week,
      attendance_percent,
      start_date,
      original_planned_end_date,
      status,
      actual_progress_percent,
      notes,
      apprentices:apprentices(id, display_name, apprentice_reference)
    `);

  if (error) {
    if (error.code === "42P01") {
      return [];
    }
    throw new Error(`Unable to load apprentice programmes: ${error.message}`);
  }

  return (data ?? []) as ApprenticeProgrammeRow[];
}

export const supabaseApprenticeDataAdapter: ApprenticeLifecycleDataPort = {
  async getLifecycleBoard(query: BoardQuery): Promise<LifecycleBoardDto> {
    const rows = await readApprenticeProgrammes();
    const columns = buildColumns(query);
    const overdueColumn: BoardColumnDto = {
      kind: "overdue",
      weekNumber: null,
      label: "Programme overdue",
      sublabel: "Past planned end date",
      apprenticeIds: [],
    };

    const apprenticesById: Record<string, ApprenticeCardDto> = {};

    for (const row of rows) {
      const card = toApprenticeCard(row);
      if (!card) continue;
      apprenticesById[card.apprenticeId] = card;

      if (card.programmeOverdueLabel) {
        overdueColumn.apprenticeIds.push(card.apprenticeId);
        continue;
      }

      if (card.boardWeek == null) {
        columns[0]?.apprenticeIds.push(card.apprenticeId);
        continue;
      }

      const column = columns.find(
        (candidate) => candidate.kind === "week" && candidate.weekNumber === card.boardWeek,
      );
      if (column) {
        column.apprenticeIds.push(card.apprenticeId);
      }
    }

    return {
      query,
      metrics: buildMetrics(rows),
      columns,
      overdueColumn,
      apprenticesById,
      viewingLabel: "Live apprentice data",
    };
  },

  async getApprenticeWorkspace(apprenticeId: string): Promise<ApprenticeWorkspaceDto | null> {
    const rows = await readApprenticeProgrammes();
    const row = rows.find((entry) => entry.apprentice_id === apprenticeId);
    const card = row ? toApprenticeCard(row) : null;
    const apprentice = row ? firstJoined(row.apprentices) : null;
    if (!row || !card || !apprentice) return null;

    const evidenceRows = buildBlankPackRows();
    const missingMandatory = evidenceRows.filter(
      (r) =>
        r.requirementKind === "mandatory" &&
        r.status !== "future_requirement" &&
        r.status === "missing",
    ).length;

    return {
      card: {
        ...card,
        missingMandatoryEvidenceCount: missingMandatory,
        evidenceTotalCount: evidenceRows.length,
      },
      apprenticeReference: apprentice.apprentice_reference ?? null,
      programmeStartDate: row.start_date,
      originalPlannedEndDate: row.original_planned_end_date,
      currentWeekLabel: (() => {
        const timing = describeProgrammeTiming(row.start_date);
        if (!timing.hasStarted) return timing.weekLabel;
        return timing.timeOnProgramme
          ? `${timing.weekLabel} · ${timing.timeOnProgramme}`
          : timing.weekLabel;
      })(),
      progressStatus: (() => {
        const progress = formatProgressStatusLabel({
          programmeStatus: card.programmeStatus,
          startDate: row.start_date,
          originalPlannedEndDate: row.original_planned_end_date,
          actualProgressPercent: row.actual_progress_percent,
        });
        return `${progress.badge} · ${progress.detail}`;
      })(),
      attendanceStatus:
        row.attendance_percent != null
          ? `${row.attendance_percent}%`
          : "Not entered",
      complianceStatus:
        missingMandatory > 0
          ? `${missingMandatory} mandatory missing`
          : "Pack clear",
      summaryNote:
        [
          row.workplace_contact?.trim()
            ? `Workplace contact: ${row.workplace_contact.trim()}`
            : null,
          row.college_days?.trim()
            ? `College days: ${row.college_days.trim()}`
            : null,
          row.notes?.trim() || null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      evidenceRows,
      timeline: [
        {
          id: `${row.id}-created`,
          occurredAt: row.start_date,
          eventType: "apprentice_programme.created",
          summary: `Apprentice staged onto ${card.programmeName}`,
          actorName: null,
        },
        {
          id: `${row.id}-planned-end`,
          occurredAt: row.original_planned_end_date,
          eventType: "apprentice_programme.planned_end",
          summary: `Planned end ${formatDisplayDate(new Date(row.original_planned_end_date))}`,
          actorName: null,
        },
      ],
    };
  },
};
