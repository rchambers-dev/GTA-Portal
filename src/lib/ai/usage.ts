import type { AiUsageEvent } from "./types";

/**
 * In-memory usage log for the standalone shell.
 * Links AI calls across features for the same account.
 * Swap for a durable store on portal integration.
 */

const events: AiUsageEvent[] = [];

export function recordAiUsage(event: AiUsageEvent): void {
  events.push(event);
}

export function listAiUsage(filter?: {
  accountId?: string;
  feature?: AiUsageEvent["feature"];
  sinceIso?: string;
}): AiUsageEvent[] {
  return events.filter((event) => {
    if (filter?.accountId && event.accountId !== filter.accountId) return false;
    if (filter?.feature && event.feature !== filter.feature) return false;
    if (filter?.sinceIso && event.createdAt < filter.sinceIso) return false;
    return true;
  });
}

export function countAiUsageToday(accountId: string): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const sinceIso = start.toISOString();
  return listAiUsage({ accountId, sinceIso }).filter((e) => e.status === "ok").length;
}

export function summariseAiUsage(accountId?: string): {
  total: number;
  byFeature: Record<string, number>;
  byArea: Record<string, number>;
} {
  const rows = accountId ? listAiUsage({ accountId }) : listAiUsage();
  const byFeature: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  for (const row of rows) {
    if (row.status !== "ok") continue;
    byFeature[row.feature] = (byFeature[row.feature] ?? 0) + 1;
    byArea[row.area] = (byArea[row.area] ?? 0) + 1;
  }
  return {
    total: Object.values(byFeature).reduce((a, b) => a + b, 0),
    byFeature,
    byArea,
  };
}
