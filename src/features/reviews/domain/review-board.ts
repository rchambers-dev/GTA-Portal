import { addDays, weekStartMonday } from "./plan-due";

export type BoardStage = "waiting" | "with_tutor" | "to_book" | "booked" | "other";

export type BoardCard = {
  gtaId: string;
  name: string;
  employer: string;
  tutor: string;
  plannedOn: string | null;
  /** Most recent completed review's actual date, or null when none is completed. */
  lastOn: string | null;
  stage: BoardStage;
  stageLabel: string;
  hold: boolean;
  concern: boolean;
};

export type BoardWeek = {
  index: number;
  start: string;
  end: string;
  label: string;
  range: string;
  cards: BoardCard[];
};

export type ReviewBoard = {
  today: string;
  weekStart: string;
  overdue: BoardCard[];
  weeks: BoardWeek[];
  laterCount: number;
  undatedCount: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function boardDayLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? ""}`.trim();
}

/** Compact label for the last completed review. Uses the actual date, never the planned date. */
export function lastReviewLabel(actualOn: string | null): string {
  const day = actualOn?.slice(0, 10) || "";
  return day ? `Last: ${boardDayLabel(day)}` : "Last: none";
}

/** Latest actual_on per learner among completed reviews. */
export function latestCompletedOn(rows: { gtaId: string; actualOn: string | null }[]): Map<string, string> {
  const last = new Map<string, string>();
  for (const row of rows) {
    const day = row.actualOn?.slice(0, 10) || "";
    if (!day) continue;
    const current = last.get(row.gtaId);
    if (!current || day > current) last.set(row.gtaId, day);
  }
  return last;
}

export function stagePresentation(stage: string | null): { stage: BoardStage; label: string } {
  if (stage === "with_tutor") return { stage: "with_tutor", label: "With tutor" };
  if (stage === "to_book") return { stage: "to_book", label: "To book" };
  if (stage === "booked") return { stage: "booked", label: "Booked" };
  if (stage === "waiting" || !stage) return { stage: "waiting", label: "Waiting" };
  return { stage: "other", label: stage.replaceAll("_", " ") };
}

function byDateThenName(a: BoardCard, b: BoardCard): number {
  const date = String(a.plannedOn || "").localeCompare(String(b.plannedOn || ""));
  if (date) return date;
  return a.name.localeCompare(b.name, "en-GB");
}

/** Ten Monday weeks from the London week that contains today, plus an overdue strip. */
export function buildReviewBoard(cards: BoardCard[], today: string): ReviewBoard {
  const weekStart = weekStartMonday(today);
  const horizon = addDays(weekStart, 70);
  const overdue: BoardCard[] = [];
  const buckets: BoardCard[][] = Array.from({ length: 10 }, () => []);
  let laterCount = 0;
  let undatedCount = 0;
  for (const card of cards) {
    if (!card.plannedOn) {
      undatedCount += 1;
      continue;
    }
    if (card.plannedOn < weekStart) {
      overdue.push(card);
      continue;
    }
    if (card.plannedOn >= horizon) {
      laterCount += 1;
      continue;
    }
    const start = weekStartMonday(card.plannedOn);
    const index = Math.round(
      (Date.parse(`${start}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000 / 7,
    );
    if (index >= 0 && index < 10) buckets[index]?.push(card);
    else laterCount += 1;
  }
  overdue.sort(byDateThenName);
  const weeks = buckets.map((list, index) => {
    const start = addDays(weekStart, index * 7);
    const end = addDays(start, 6);
    list.sort(byDateThenName);
    return {
      index: index + 1,
      start,
      end,
      label: `w/c ${boardDayLabel(start)}`,
      range: `${boardDayLabel(start)} – ${boardDayLabel(end)}`,
      cards: list,
    };
  });
  return { today, weekStart, overdue, weeks, laterCount, undatedCount };
}
