/**
 * Funding / RPL calculator for Autocare blocks (management only).
 *
 * GTA does not fast-track delivery. These figures adjust planned OTJ hours and
 * a funding-compliant expected finish for Jon — apprentices keep cohort weeks.
 *
 * Formula (matches live MBB Autocare weights):
 *   aplFactor = (0.30×K + 0.50×S + 0.20×B) / 100
 *   deduction = min(otj × maxPct, otj × aplFactor)
 *   adjusted  = otj − deduction
 */

import {
  AUTOCARE_BLOCKS,
  AUTOCARE_STANDARD,
  type ProgrammeBlockDef,
} from "./autocare-blocks";
import {
  formatDisplayDate,
  startOfUtcDay,
} from "@/features/apprentice-lifecycle/domain/programme-week";

export const RPL_WEIGHT_K = 0.3;
export const RPL_WEIGHT_S = 0.5;
export const RPL_WEIGHT_B = 0.2;
/** Max fraction of a block's OTJ that RPL may remove. */
export const RPL_MAX_DEDUCTION = 0.3;
/** UI steppers move in 10% increments (SOW decisions). */
export const RPL_STEP = 10;
/** Training hours per college day — Autocare default. */
export const TRAINING_HOURS_PER_DAY = 6;
/**
 * Days between training sessions from weeks_per_calendar_year ≈ 46.4,
 * 1 training day/week: (7×52) / 46.4 ≈ 7.84 → round per session index.
 */
export const DAYS_PER_SESSION_STEP = (7 * 52) / 46.4;

export type BlockRplInput = {
  knowledgePct: number;
  skillsPct: number;
  behavioursPct: number;
};

export type BlockFundingRow = {
  blockId: number;
  name: string;
  kind: ProgrammeBlockDef["kind"];
  plannedOtjHours: number;
  knowledgePct: number;
  skillsPct: number;
  behavioursPct: number;
  aplFactor: number;
  deductionHours: number;
  adjustedOtjHours: number;
  sessions: number;
  /** Funding calendar (RPL-compressed). Null when block has no OTJ sessions. */
  fundingStartDate: string | null;
  fundingEndDate: string | null;
};

export type ApprenticeFundingPlan = {
  cohortStartDate: string;
  deliveryExpectedEndDate: string | null;
  plannedOtjHours: number;
  adjustedOtjHours: number;
  programmeRplPercent: number;
  /** Indicative funding finish from compressed session calendar (Jon only). */
  fundingExpectedFinishDate: string | null;
  /** Rough funding band hint after programme RPL (not full DfE engine). */
  indicativeFundingGbp: number;
  blocks: BlockFundingRow[];
};

export function emptyBlockRpl(): BlockRplInput {
  return { knowledgePct: 0, skillsPct: 0, behavioursPct: 0 };
}

export function clampRplPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const stepped = Math.round(value / RPL_STEP) * RPL_STEP;
  return Math.min(100, Math.max(0, stepped));
}

export function aplFactorFromKsb(input: BlockRplInput): number {
  const k = clampRplPct(input.knowledgePct);
  const s = clampRplPct(input.skillsPct);
  const b = clampRplPct(input.behavioursPct);
  return (RPL_WEIGHT_K * k + RPL_WEIGHT_S * s + RPL_WEIGHT_B * b) / 100;
}

export function adjustBlockOtj(
  plannedOtjHours: number,
  input: BlockRplInput,
): { aplFactor: number; deductionHours: number; adjustedOtjHours: number } {
  const aplFactor = aplFactorFromKsb(input);
  if (plannedOtjHours <= 0) {
    return { aplFactor, deductionHours: 0, adjustedOtjHours: 0 };
  }
  const uncapped = plannedOtjHours * aplFactor;
  const capped = plannedOtjHours * RPL_MAX_DEDUCTION;
  const deductionHours = Math.min(uncapped, capped);
  const adjustedOtjHours = Math.max(0, plannedOtjHours - deductionHours);
  return {
    aplFactor,
    deductionHours: round1(deductionHours),
    adjustedOtjHours: round1(adjustedOtjHours),
  };
}

export function sessionsForHours(hours: number): number {
  if (hours <= 0) return 0;
  return Math.ceil(hours / TRAINING_HOURS_PER_DAY);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function addDaysIso(startIso: string, days: number): string {
  const start = startOfUtcDay(new Date(`${startIso}T12:00:00.000Z`));
  const next = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

/**
 * Cohort delivery window for a programme week (no RPL). Week 1 starts on cohort start.
 */
export function cohortDateForProgrammeWeek(
  cohortStartIso: string,
  week: number,
): string {
  const weekIndex = Math.max(1, week) - 1;
  return addDaysIso(cohortStartIso, weekIndex * 7);
}

export function formatCohortBlockWindow(
  cohortStartIso: string,
  weekStart: number | null,
  weekEnd: number | null,
): string | null {
  if (weekStart == null || weekEnd == null) return null;
  const start = cohortDateForProgrammeWeek(cohortStartIso, weekStart);
  const end = cohortDateForProgrammeWeek(cohortStartIso, weekEnd);
  return `${formatDisplayDate(new Date(`${start}T12:00:00.000Z`))} – ${formatDisplayDate(new Date(`${end}T12:00:00.000Z`))}`;
}

/**
 * Build per-block funding calendar from cohort start using adjusted OTJ sessions.
 * Blocks with 0 OTJ (gateway/EPA) keep null funding dates — delivery still cohort-based.
 */
export function buildApprenticeFundingPlan(args: {
  cohortStartDate: string;
  deliveryExpectedEndDate?: string | null;
  rplByBlock: Record<number, BlockRplInput>;
  blocks?: ProgrammeBlockDef[];
}): ApprenticeFundingPlan {
  const blocks = args.blocks ?? AUTOCARE_BLOCKS;
  const rows: BlockFundingRow[] = [];
  let sessionCursor = 0;
  let plannedOtjHours = 0;
  let adjustedOtjHours = 0;
  let weightedDeduction = 0;

  for (const block of blocks) {
    const input = args.rplByBlock[block.id] ?? emptyBlockRpl();
    const { aplFactor, deductionHours, adjustedOtjHours: adjusted } =
      adjustBlockOtj(block.plannedOtjHours, input);
    const sessions = sessionsForHours(adjusted);
    plannedOtjHours += block.plannedOtjHours;
    adjustedOtjHours += adjusted;
    weightedDeduction += deductionHours;

    let fundingStartDate: string | null = null;
    let fundingEndDate: string | null = null;
    if (sessions > 0) {
      const startOffset = Math.round(sessionCursor * DAYS_PER_SESSION_STEP);
      const endOffset = Math.round(
        (sessionCursor + sessions - 1) * DAYS_PER_SESSION_STEP,
      );
      fundingStartDate = addDaysIso(args.cohortStartDate, startOffset);
      fundingEndDate = addDaysIso(args.cohortStartDate, endOffset);
      sessionCursor += sessions;
    }

    rows.push({
      blockId: block.id,
      name: block.name,
      kind: block.kind,
      plannedOtjHours: block.plannedOtjHours,
      knowledgePct: clampRplPct(input.knowledgePct),
      skillsPct: clampRplPct(input.skillsPct),
      behavioursPct: clampRplPct(input.behavioursPct),
      aplFactor: round1(aplFactor * 100) / 100,
      deductionHours,
      adjustedOtjHours: adjusted,
      sessions,
      fundingStartDate,
      fundingEndDate,
    });
  }

  const programmeRplPercent =
    plannedOtjHours > 0
      ? round1((weightedDeduction / plannedOtjHours) * 100)
      : 0;

  const lastFundingEnd = [...rows]
    .reverse()
    .find((r) => r.fundingEndDate)?.fundingEndDate;

  const indicativeFundingGbp = Math.round(
    AUTOCARE_STANDARD.fundingBandGbp * (1 - programmeRplPercent / 100),
  );

  return {
    cohortStartDate: args.cohortStartDate,
    deliveryExpectedEndDate: args.deliveryExpectedEndDate ?? null,
    plannedOtjHours: round1(plannedOtjHours),
    adjustedOtjHours: round1(adjustedOtjHours),
    programmeRplPercent,
    fundingExpectedFinishDate: lastFundingEnd ?? null,
    indicativeFundingGbp,
    blocks: rows,
  };
}
