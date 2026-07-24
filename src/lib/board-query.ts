import type { BoardQuery, MetricKey } from "@/features/learner-lifecycle/types";

const METRIC_KEYS: MetricKey[] = [
  "active_learners",
  "priority_intervention",
  "reviews_due",
  "programme_overdue",
  "employer_actions_overdue",
  "missing_mandatory_evidence",
];

const WEEKS_PER_YEAR = 52;

export function yearStartWeek(year: 1 | 2 | 3): number {
  if (year === 1) return 1;
  if (year === 2) return 53;
  return 105;
}

export function parseBoardQuery(
  searchParams: Record<string, string | string[] | undefined>,
): BoardQuery {
  const yearRaw = Number(first(searchParams.year) ?? "1");
  const year = (yearRaw === 2 || yearRaw === 3 ? yearRaw : 1) as 1 | 2 | 3;
  const defaultFrom = yearStartWeek(year);
  const metricRaw = first(searchParams.metric);
  const metric =
    metricRaw && METRIC_KEYS.includes(metricRaw as MetricKey)
      ? (metricRaw as MetricKey)
      : null;

  return {
    year,
    fromWeek: defaultFrom,
    span: WEEKS_PER_YEAR,
    mineOnly: first(searchParams.mine) === "1",
    metric,
    programmeId: first(searchParams.programme) ?? null,
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
