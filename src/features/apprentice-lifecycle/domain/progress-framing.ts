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
  if (variancePercent == null) return "Actual not entered";
  if (variancePercent === 0) return "On planned progress";
  if (variancePercent > 0) return `${variancePercent}% ahead of plan`;
  return `${Math.abs(variancePercent)}% behind plan`;
}

/** Short side-panel progress copy (avoids redundant “not entered” wording). */
export function formatProgressStatusLabel(input: {
  programmeStatus?: string | null;
  startDate: Date | string;
  originalPlannedEndDate: Date | string;
  actualProgressPercent?: number | null;
  asOfDate?: Date;
}): { badge: string; detail: string; tone: "on_track" | "monitoring" | "priority" | "neutral" } {
  const asOf = input.asOfDate ?? new Date();
  const start =
    typeof input.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate)
      ? new Date(`${input.startDate}T12:00:00Z`)
      : new Date(input.startDate);
  const startDay = startOfUtcDay(start);
  const asOfDay = startOfUtcDay(asOf);

  // Only treat as pre-start when the calendar start has not arrived yet.
  if (!Number.isNaN(startDay.getTime()) && asOfDay < startDay) {
    return {
      badge: "Pre-start",
      detail: "Progress tracking starts when the programme begins",
      tone: "neutral",
    };
  }

  const framing = calculateProgressFraming({
    startDate: input.startDate,
    originalPlannedEndDate: input.originalPlannedEndDate,
    actualProgressPercent: input.actualProgressPercent,
    asOfDate: asOf,
  });

  if (framing.actualProgressPercent == null) {
    return {
      badge: "Actual not entered",
      detail: `Planned ${framing.plannedProgressPercent}%`,
      tone: "monitoring",
    };
  }

  const variance = framing.variancePercent ?? 0;
  if (variance < -5) {
    return {
      badge: `${Math.abs(variance)}% behind`,
      detail: `Planned ${framing.plannedProgressPercent}% · Actual ${framing.actualProgressPercent}%`,
      tone: "priority",
    };
  }
  if (variance > 5) {
    return {
      badge: `${variance}% ahead`,
      detail: `Planned ${framing.plannedProgressPercent}% · Actual ${framing.actualProgressPercent}%`,
      tone: "on_track",
    };
  }
  return {
    badge: "On track",
    detail: `Planned ${framing.plannedProgressPercent}% · Actual ${framing.actualProgressPercent}%`,
    tone: "on_track",
  };
}
