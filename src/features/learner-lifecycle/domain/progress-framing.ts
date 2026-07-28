/**
 * Planned progress and slippage from enrolment dates.
 *
 * planned% ≈ elapsed days / planned duration (capped 0–100)
 * variance / slippage ≈ actual − planned
 */

import { startOfUtcDay } from "./programme-week";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ProgressFraming = {
  plannedProgressPercent: number;
  actualProgressPercent: number | null;
  variancePercent: number | null;
  /** Negative variance means behind plan (slippage). */
  slippagePercent: number | null;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculatePlannedProgressPercent(
  startDate: Date | string,
  originalPlannedEndDate: Date | string,
  asOfDate: Date = new Date(),
): number {
  const start = startOfUtcDay(
    typeof startDate === "string" ? new Date(`${startDate}T12:00:00Z`) : startDate,
  );
  const end = startOfUtcDay(
    typeof originalPlannedEndDate === "string"
      ? new Date(`${originalPlannedEndDate}T12:00:00Z`)
      : originalPlannedEndDate,
  );
  const asOf = startOfUtcDay(asOfDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (asOf < start) return 0;

  const totalDays = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY),
  );
  const elapsedDays = Math.floor((asOf.getTime() - start.getTime()) / MS_PER_DAY);
  return clampPercent((elapsedDays / totalDays) * 100);
}

export function calculateProgressFraming(input: {
  startDate: Date | string;
  originalPlannedEndDate: Date | string;
  actualProgressPercent?: number | null;
  asOfDate?: Date;
}): ProgressFraming {
  const plannedProgressPercent = calculatePlannedProgressPercent(
    input.startDate,
    input.originalPlannedEndDate,
    input.asOfDate,
  );
  const actual =
    input.actualProgressPercent == null || !Number.isFinite(input.actualProgressPercent)
      ? null
      : clampPercent(Number(input.actualProgressPercent));
  const variancePercent =
    actual == null ? null : actual - plannedProgressPercent;

  return {
    plannedProgressPercent,
    actualProgressPercent: actual,
    variancePercent,
    slippagePercent: variancePercent,
  };
}

export function formatProgressVariance(variancePercent: number | null): string {
  if (variancePercent == null) return "Actual progress not entered yet";
  if (variancePercent === 0) return "On planned progress";
  if (variancePercent > 0) return `${variancePercent}% ahead of plan`;
  return `${Math.abs(variancePercent)}% behind plan`;
}
