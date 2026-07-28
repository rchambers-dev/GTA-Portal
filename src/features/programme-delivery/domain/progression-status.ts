/**
 * Learner completion RAG (red / amber / green) and management progression BRAG
 * (blue / green / amber / red) — inspired by MBB brag_methods.php, clarified.
 *
 * Learners never see Blue (no fast-track signal). Blue is management-only:
 * finished the block before the cohort window ended.
 *
 * Gateway / EPA milestones use RAG (green / amber / red) — separate from
 * training-block Blue so early-finish Blue never applies to gateways.
 */

import {
  cohortDateForProgrammeWeek,
} from "./rpl-funding-calc";
import type { ProgrammeBlockDef } from "./autocare-blocks";
import { AUTOCARE_BLOCKS } from "./autocare-blocks";
import type { PracticalTaskDef } from "./task-schema";
import type { TaskSubmissionStatus } from "./task-submission-store";
import { getTaskSubmission } from "./task-submission-store";
import { startOfUtcDay } from "@/features/learner-lifecycle/domain/programme-week";

export type LearnerRag = "red" | "amber" | "green" | "neutral";
export type ProgressionBrag = "blue" | "green" | "amber" | "red";
/** Gateway / EPA only — not the training BRAG scale. */
export type MilestoneStatus = "complete" | "on_track" | "behind" | "not_due";

export type BlockCompletionSummary = {
  total: number;
  verified: number;
  inFlight: number;
  notStarted: number;
  complete: boolean;
  /** ISO date when the block became complete, if known. */
  completedAt: string | null;
};

const BRAG_RANK: Record<ProgressionBrag, number> = {
  blue: 0,
  green: 1,
  amber: 2,
  red: 3,
};

/** Near end of window ≈ last 4% of the block duration (MBB threshold). */
const AMBER_REMAINING_FRACTION = 0.04;

export function summariseBlockCompletion(
  tasks: PracticalTaskDef[],
  learnerId: string,
): BlockCompletionSummary {
  let verified = 0;
  let inFlight = 0;
  let notStarted = 0;
  let completedAt: string | null = null;

  for (const task of tasks) {
    const sub = getTaskSubmission(task.id, learnerId);
    if (sub.status === "verified") {
      verified += 1;
      const stamp = sub.trainerSignedAt ?? sub.updatedAt;
      if (stamp && (!completedAt || stamp > completedAt)) completedAt = stamp;
    } else if (sub.status === "not_started") {
      notStarted += 1;
    } else {
      inFlight += 1;
    }
  }

  const total = tasks.length;
  const complete = total > 0 && verified === total;
  return {
    total,
    verified,
    inFlight,
    notStarted,
    complete,
    completedAt: complete ? completedAt : null,
  };
}

/**
 * Learner task colour: complete=green, in progress=amber, needs doing=red.
 * Locked tasks stay neutral (not a call-to-action yet).
 */
export function learnerTaskRag(
  status: TaskSubmissionStatus,
  locked: boolean,
): LearnerRag {
  if (locked) return "neutral";
  switch (status) {
    case "verified":
      return "green";
    case "in_progress":
    case "awaiting_mentor":
    case "awaiting_trainer":
      return "amber";
    case "returned":
    case "referred":
    case "not_started":
      return "red";
    default:
      return "red";
  }
}

export function learnerTaskRagLabel(
  status: TaskSubmissionStatus,
  locked: boolean,
): string {
  if (locked) return "Locked";
  switch (status) {
    case "verified":
      return "Complete";
    case "in_progress":
      return "In progress";
    case "awaiting_mentor":
      return "Awaiting mentor";
    case "awaiting_trainer":
      return "Awaiting trainer";
    case "returned":
      return "Returned";
    case "referred":
      return "Referred";
    case "not_started":
      return "Needs completing";
    default:
      return "Needs completing";
  }
}

/**
 * Learner block colour from task completion (not dates).
 * Locked = neutral · all verified = green · any progress = amber · none = red.
 */
export function learnerBlockRag(
  summary: BlockCompletionSummary,
  locked: boolean,
): LearnerRag {
  if (locked) return "neutral";
  if (summary.total === 0) return "neutral";
  if (summary.complete) return "green";
  if (summary.verified > 0 || summary.inFlight > 0) return "amber";
  return "red";
}

export function learnerBlockRagLabel(
  rag: LearnerRag,
  summary: BlockCompletionSummary,
): string {
  switch (rag) {
    case "green":
      return "Complete";
    case "amber":
      return `In progress · ${summary.verified}/${summary.total}`;
    case "red":
      return `Needs completing · ${summary.verified}/${summary.total}`;
    default:
      return "Locked";
  }
}

export function blockCohortWindowDates(
  block: ProgrammeBlockDef,
  cohortStartIso: string,
): { startIso: string; endIso: string } | null {
  if (block.weekStart == null || block.weekEnd == null) return null;
  return {
    startIso: cohortDateForProgrammeWeek(cohortStartIso, block.weekStart),
    endIso: cohortDateForProgrammeWeek(cohortStartIso, block.weekEnd),
  };
}

/**
 * @deprecated Prefer `gatewayMilestoneDueIso` from `gateways.ts` (GW1 / GW2 / EPA).
 * Kept for any callers expecting end of last dated training block.
 */
export function gatewayDueDateIso(cohortStartIso: string): string | null {
  const training = AUTOCARE_BLOCKS.filter(
    (b) => b.kind === "training" && b.weekEnd != null,
  );
  const last = training[training.length - 1];
  if (!last?.weekEnd) return null;
  return cohortDateForProgrammeWeek(cohortStartIso, last.weekEnd);
}

/**
 * Management progression BRAG for training blocks (cohort calendar).
 * Incomplete blocks that have not started yet are null ("not due") — never Green.
 * Gateway / EPA milestones must not use this helper.
 */
export function calculateBlockProgressionBrag(args: {
  windowStartIso: string | null;
  windowEndIso: string | null;
  complete: boolean;
  completedAtIso: string | null;
  asOfIso?: string;
}): ProgressionBrag | null {
  const { windowStartIso, windowEndIso, complete, completedAtIso } = args;
  if (!windowStartIso || !windowEndIso) {
    return null;
  }

  const start = startOfUtcDay(new Date(`${windowStartIso}T12:00:00.000Z`));
  const end = startOfUtcDay(new Date(`${windowEndIso}T12:00:00.000Z`));
  const asOf = startOfUtcDay(
    new Date(`${(args.asOfIso ?? new Date().toISOString().slice(0, 10))}T12:00:00.000Z`),
  );

  const totalMs = end.getTime() - start.getTime();
  const totalDays = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));

  if (!complete) {
    if (asOf < start) return null; // not due yet — do not show Green
    if (asOf > end) return "red";
    const remainingMs = end.getTime() - asOf.getTime();
    const remainingDays = Math.max(
      0,
      Math.round(remainingMs / (24 * 60 * 60 * 1000)),
    );
    const remainingFraction = remainingDays / totalDays;
    if (remainingFraction <= AMBER_REMAINING_FRACTION) return "amber";
    return "green";
  }

  if (completedAtIso) {
    const completed = startOfUtcDay(new Date(completedAtIso));
    if (completed < end && asOf <= end) return "blue";
  }
  return "green";
}

/**
 * Gateway / EPA milestone status — RAG scale (not training BRAG Blue).
 * Due dates come from `gatewayMilestoneDueIso` (after Block 5 / 10 / delivery end).
 */
export function calculateMilestoneStatus(args: {
  kind: "gateway" | "epa";
  complete: boolean;
  dueIso: string | null;
  asOfIso?: string;
}): MilestoneStatus {
  if (args.complete) return "complete";
  if (!args.dueIso) return "not_due";

  const due = startOfUtcDay(new Date(`${args.dueIso}T12:00:00.000Z`));
  const asOf = startOfUtcDay(
    new Date(`${(args.asOfIso ?? new Date().toISOString().slice(0, 10))}T12:00:00.000Z`),
  );

  if (asOf > due) return "behind";
  return "on_track";
}

export function milestoneChipTone(
  status: MilestoneStatus,
): "green" | "amber" | "red" | "neutral" {
  switch (status) {
    case "complete":
      return "green";
    case "on_track":
      return "amber";
    case "behind":
      return "red";
    default:
      return "neutral";
  }
}

export function milestoneLabel(
  name: string,
  status: MilestoneStatus,
): string {
  switch (status) {
    case "complete":
      return `${name} complete`;
    case "on_track":
      return `${name} on track`;
    case "behind":
      return `${name} behind`;
    default:
      return `${name} date TBC`;
  }
}

export function milestoneShortLabel(status: MilestoneStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "on_track":
      return "On track";
    case "behind":
      return "Behind";
    default:
      return "Date TBC";
  }
}

/** Worst BRAG among training blocks that are due or complete. */
export function rollUpProgressionBrag(
  rows: Array<{
    brag: ProgressionBrag | null;
    windowEndIso: string | null;
    complete: boolean;
  }>,
  asOfIso?: string,
): ProgressionBrag | null {
  const asOf = startOfUtcDay(
    new Date(`${(asOfIso ?? new Date().toISOString().slice(0, 10))}T12:00:00.000Z`),
  );

  const considered: ProgressionBrag[] = [];
  for (const row of rows) {
    if (!row.brag) continue;
    if (row.complete) {
      considered.push(row.brag);
      continue;
    }
    if (!row.windowEndIso) continue;
    const end = startOfUtcDay(new Date(`${row.windowEndIso}T12:00:00.000Z`));
    if (end <= asOf) considered.push(row.brag);
  }

  if (considered.length === 0) return null;

  let worst: ProgressionBrag = "blue";
  for (const brag of considered) {
    if (BRAG_RANK[brag] > BRAG_RANK[worst]) worst = brag;
  }
  return worst;
}

export function bragLabel(brag: ProgressionBrag): string {
  switch (brag) {
    case "blue":
      return "Blue — finished early";
    case "green":
      return "Green — on track";
    case "amber":
      return "Amber — near deadline";
    case "red":
      return "Red — overdue";
  }
}

export function bragShortLabel(brag: ProgressionBrag): string {
  switch (brag) {
    case "blue":
      return "Early";
    case "green":
      return "On track";
    case "amber":
      return "At risk";
    case "red":
      return "Overdue";
  }
}
