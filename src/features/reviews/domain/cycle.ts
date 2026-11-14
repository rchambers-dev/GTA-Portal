import { addDays, formatWeeksAndDays, reviewDueLabel, weekStartMonday, type DueState } from "./plan-due";

/** The six Review Assistant steps, in the order the cycle page groups them. */
export const CYCLE_STEPS = [
  { id: "released", label: "Review released", stage: "with_tutor" },
  { id: "booking", label: "Needs booking", stage: "to_book" },
  { id: "booked", label: "Review booked", stage: "booked" },
  { id: "completed", label: "Review completed", stage: "reviewed" },
  { id: "archived", label: "Archived", stage: "completed" },
  { id: "waiting", label: "Waiting", stage: "waiting" },
] as const;

export type CycleStepId = (typeof CYCLE_STEPS)[number]["id"];

const STAGE_TO_STEP: Record<string, CycleStepId> = {
  with_tutor: "released",
  to_book: "booking",
  booked: "booked",
  reviewed: "completed",
  completed: "archived",
  waiting: "waiting",
};

export function cycleStepFromStage(stage: string | null): CycleStepId {
  if (!stage) return "waiting";
  return STAGE_TO_STEP[stage] ?? "waiting";
}

export function cycleStepLabel(id: CycleStepId): string {
  return CYCLE_STEPS.find((step) => step.id === id)?.label ?? "Waiting";
}

export type StepTone = "done" | "current" | "late" | "idle";

export function stepTone(stepId: CycleStepId, currentId: CycleStepId, late: boolean): StepTone {
  const currentIndex = CYCLE_STEPS.findIndex((step) => step.id === currentId);
  const index = CYCLE_STEPS.findIndex((step) => step.id === stepId);
  if (index < currentIndex) return "done";
  if (index === currentIndex) return late ? "late" : "current";
  return "idle";
}

export function reviewCountLabel(completed: number): string {
  if (completed <= 0) return "No review yet";
  if (completed === 1) return "1 review";
  return `${completed} reviews`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type CycleDueTone = "neutral" | "soon" | "overdue";

function dayMonth(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${SHORT_MONTHS[Number(month) - 1] ?? ""}`.trim();
}

/**
 * Due chip on the review cycle row. Overdue keeps the existing
 * "Overdue · X weeks Y days" wording. Upcoming dates count calendar days
 * to the same next-review date.
 */
export function cycleDueChip(input: {
  today: string;
  dueOn: string | null;
  inBreak: boolean;
  overdueLabel: string | null;
}): { label: string; tone: CycleDueTone } {
  if (input.inBreak) return { label: "Paused in break", tone: "neutral" };
  if (!input.dueOn) return { label: "No due date", tone: "neutral" };
  if (input.overdueLabel) return { label: input.overdueLabel, tone: "overdue" };
  const days = daysBetween(input.today, input.dueOn);
  if (days < 0) return { label: `Overdue · ${formatWeeksAndDays(days)}`, tone: "overdue" };
  const when = dayMonth(input.dueOn);
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  if (days < 14) return { label: `Due in ${days} days · ${when}`, tone: "soon" };
  const weeks = Math.floor(days / 7);
  const weeksLabel = weeks === 1 ? "1 week" : `${weeks} weeks`;
  return {
    label: `Due in ${weeksLabel} · ${when}`,
    tone: days <= 14 ? "soon" : "neutral",
  };
}

export function daysBetween(today: string, target: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${target}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** Two weeks before the Monday of the week the review is needed. */
export function tutorNoticeDate(plannedOn: string): string {
  return addDays(weekStartMonday(plannedOn), -14);
}

export type TutorBand = "need-doing" | "coming-up" | "not-due" | "sent-back";

export function tutorDueBand(input: {
  today: string;
  plannedOn: string | null;
  intervalWeeks: number;
  stage: string | null;
  inBreak: boolean;
}): { band: TutorBand; due: ReturnType<typeof reviewDueLabel> } {
  const due = input.inBreak
    ? { state: "ok" as DueState, label: "Paused in break", daysUntil: Number.POSITIVE_INFINITY, nextDate: null }
    : reviewDueLabel({
        today: input.today,
        nextDate: input.plannedOn,
        intervalWeeks: input.intervalWeeks,
      });
  const stage = input.stage;
  if (stage === "to_book" || stage === "booked" || stage === "reviewed") {
    return { band: "sent-back", due };
  }
  if (!input.plannedOn || input.inBreak) {
    return { band: "not-due", due };
  }
  const untilNotice = daysBetween(input.today, tutorNoticeDate(input.plannedOn));
  const windowOpen = due.state === "overdue" || due.state === "due-soon" || untilNotice <= 0;
  if (windowOpen) return { band: "need-doing", due };
  if (untilNotice <= 14) return { band: "coming-up", due };
  return { band: "not-due", due };
}

export const TUTOR_BANDS: { id: TutorBand; label: string }[] = [
  { id: "need-doing", label: "Need doing" },
  { id: "coming-up", label: "Coming up" },
  { id: "not-due", label: "Not due yet" },
  { id: "sent-back", label: "Sent back" },
];

export function currentStepDetail(late: boolean, daysLeft: number | null): string {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return "Left · —";
  const days = Math.abs(Math.round(daysLeft));
  const unit = days === 1 ? "1 day" : `${days} days`;
  if (late || daysLeft < 0) return `Overdue · ${unit}`;
  return `Left · ${unit}`;
}
