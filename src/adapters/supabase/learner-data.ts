import {
  calculateProgrammeWeek,
  formatDisplayDate,
  formatOverdueDuration,
  isProgrammeOverdue,
  startOfUtcDay,
} from "@/features/learner-lifecycle/domain/programme-week";
import {
  calculateProgressFraming,
  formatProgressVariance,
} from "@/features/learner-lifecycle/domain/progress-framing";
import {
  preStartColumnSublabel,
  programmeWeekColumnLabel,
  programmeWeekColumnSublabel,
} from "@/features/learner-lifecycle/domain/programme-week-dates";
import type {
  BoardColumnDto,
  BoardQuery,
  LearnerCardDto,
  LearnerWorkspaceDto,
  LifecycleBoardDto,
  SummaryMetricDto,
} from "@/features/learner-lifecycle/types";
import type { LearnerLifecycleDataPort } from "@/features/learner-lifecycle/ports";
import { createSupabaseServerClient } from "./client";

type JoinedRow<T> = T | T[] | null;

type LearnerRow = {
  id: string;
  display_name: string;
  learner_reference: string | null;
};

type LearnerProgrammeRow = {
  id: string;
  learner_id: string | null;
  programme_id: string | null;
  programme_name: string;
  standard_code: string | null;
  employer_name: string | null;
  start_date: string;
  original_planned_end_date: string;
  status: string;
  actual_progress_percent: number | null;
  notes: string | null;
  learners: JoinedRow<LearnerRow>;
};

function firstJoined<T>(value: JoinedRow<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toProgrammeStatus(status: string): LearnerCardDto["programmeStatus"] {
  switch (status) {
    case "completed":
    case "withdrawn":
      return status;
    case "draft":
    case "pending_start":
      return "pre_start";
    default:
      return "on_programme";
  }
}

function toOverallStatus(row: LearnerProgrammeRow): LearnerCardDto["overallStatus"] {
  if (row.status === "completed") return "completed";
  if (row.status === "withdrawn") return "unknown";
  const plannedEnd = new Date(row.original_planned_end_date);
  if (isProgrammeOverdue(plannedEnd, new Date(), row.status)) return "programme_overdue";
  if (row.status === "draft" || row.status === "pending_start") return "pre_start";
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
      learnerIds: [],
    },
  ];

  for (let week = query.fromWeek; week < query.fromWeek + query.span; week += 1) {
    weekColumns.push({
      kind: "week",
      weekNumber: week,
      label: programmeWeekColumnLabel(week),
      sublabel: programmeWeekColumnSublabel(week),
      learnerIds: [],
    });
  }

  return weekColumns;
}

function buildMetrics(rows: LearnerProgrammeRow[]): SummaryMetricDto[] {
  const overdue = rows.filter((row) =>
    isProgrammeOverdue(new Date(row.original_planned_end_date), new Date(), row.status),
  ).length;
  const active = rows.filter((row) => row.status === "active").length;
  const preStart = rows.filter(
    (row) => row.status === "draft" || row.status === "pending_start",
  ).length;

  return [
    {
      key: "active_learners",
      label: "Active learners",
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

function toLearnerCard(row: LearnerProgrammeRow): LearnerCardDto | null {
  const learner = firstJoined(row.learners);
  if (!learner) return null;

  const today = startOfUtcDay(new Date());
  const startDate = new Date(row.start_date);
  const plannedEnd = new Date(row.original_planned_end_date);
  const programmeWeek = calculateProgrammeWeek(startDate, today);
  const overallStatus = toOverallStatus(row);
  const overdue = isProgrammeOverdue(plannedEnd, today, row.status);

  return {
    learnerId: learner.id,
    displayName: learner.display_name,
    initials: initialsFromName(learner.display_name),
    programmeName: row.programme_name,
    employerName: row.employer_name || null,
    programmeWeek,
    programmeStatus: toProgrammeStatus(row.status),
    overallStatus,
    primaryPriority: null,
    attendancePercent: null,
    nextReviewDate: null,
    openActionCount: 0,
    missingMandatoryEvidenceCount: 0,
    evidenceCheckedCount: 0,
    evidenceTotalCount: 0,
    programmeOverdueLabel: overdue ? formatOverdueDuration(plannedEnd, today) : null,
    boardWeek: overdue || programmeWeek == null ? null : programmeWeek,
    mentorName: null,
    tutorName: null,
    intakeComplete: true,
  };
}

async function readLearnerProgrammes(): Promise<LearnerProgrammeRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("learner_programmes").select(`
      id,
      learner_id,
      programme_id,
      programme_name,
      standard_code,
      employer_name,
      start_date,
      original_planned_end_date,
      status,
      actual_progress_percent,
      notes,
      learners:learners(id, display_name, learner_reference)
    `);

  if (error) {
    if (error.code === "42P01") {
      return [];
    }
    throw new Error(`Unable to load learner programmes: ${error.message}`);
  }

  return (data ?? []) as LearnerProgrammeRow[];
}

export const supabaseLearnerDataAdapter: LearnerLifecycleDataPort = {
  async getLifecycleBoard(query: BoardQuery): Promise<LifecycleBoardDto> {
    const rows = await readLearnerProgrammes();
    const columns = buildColumns(query);
    const overdueColumn: BoardColumnDto = {
      kind: "overdue",
      weekNumber: null,
      label: "Programme overdue",
      sublabel: "Past planned end date",
      learnerIds: [],
    };

    const learnersById: Record<string, LearnerCardDto> = {};

    for (const row of rows) {
      const card = toLearnerCard(row);
      if (!card) continue;
      learnersById[card.learnerId] = card;

      if (card.programmeOverdueLabel) {
        overdueColumn.learnerIds.push(card.learnerId);
        continue;
      }

      if (card.boardWeek == null) {
        columns[0]?.learnerIds.push(card.learnerId);
        continue;
      }

      const column = columns.find(
        (candidate) => candidate.kind === "week" && candidate.weekNumber === card.boardWeek,
      );
      if (column) {
        column.learnerIds.push(card.learnerId);
      }
    }

    return {
      query,
      metrics: buildMetrics(rows),
      columns,
      overdueColumn,
      learnersById,
      viewingLabel: "Live learner data",
    };
  },

  async getLearnerWorkspace(learnerId: string): Promise<LearnerWorkspaceDto | null> {
    const rows = await readLearnerProgrammes();
    const row = rows.find((entry) => entry.learner_id === learnerId);
    const card = row ? toLearnerCard(row) : null;
    const learner = row ? firstJoined(row.learners) : null;
    if (!row || !card || !learner) return null;

    return {
      card,
      learnerReference: learner.learner_reference ?? null,
      programmeStartDate: row.start_date,
      originalPlannedEndDate: row.original_planned_end_date,
      currentWeekLabel: card.programmeWeek ? `Week ${card.programmeWeek}` : "Pre-start",
      progressStatus: (() => {
        const framing = calculateProgressFraming({
          startDate: row.start_date,
          originalPlannedEndDate: row.original_planned_end_date,
          actualProgressPercent: row.actual_progress_percent,
        });
        const actualLabel =
          framing.actualProgressPercent == null
            ? "actual not entered"
            : `actual ${framing.actualProgressPercent}%`;
        return `Planned ${framing.plannedProgressPercent}% · ${actualLabel} · ${formatProgressVariance(framing.variancePercent)}`;
      })(),
      attendanceStatus: "Attendance not entered yet",
      complianceStatus: "Evidence pack not loaded yet",
      summaryNote: row.notes?.trim() || null,
      evidenceRows: [],
      timeline: [
        {
          id: `${row.id}-created`,
          occurredAt: row.start_date,
          eventType: "learner_programme.created",
          summary: `Learner staged onto ${card.programmeName}`,
          actorName: null,
        },
        {
          id: `${row.id}-planned-end`,
          occurredAt: row.original_planned_end_date,
          eventType: "learner_programme.planned_end",
          summary: `Planned end ${formatDisplayDate(new Date(row.original_planned_end_date))}`,
          actorName: null,
        },
      ],
    };
  },
};
