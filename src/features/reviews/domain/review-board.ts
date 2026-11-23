import { addDays, weekStartMonday } from "./plan-due";

export type BoardStage = "waiting" | "with_tutor" | "to_book" | "booked" | "locked" | "other";

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

export type WaitingChip = {
  gtaId: string;
  name: string;
  sentOn: string | null;
  daysWaiting: number | null;
};

export type WaitingTutorGroup = {
  tutor: string;
  count: number;
  apprentices: WaitingChip[];
};

export type ReviewBoard = {
  today: string;
  weekStart: string;
  overdue: BoardCard[];
  weeks: BoardWeek[];
  laterCount: number;
  undatedCount: number;
  waiting: WaitingTutorGroup[];
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

export function daysWaiting(sentOn: string | null, today: string): number | null {
  const sent = sentOn?.slice(0, 10) || "";
  const start = Date.parse(`${sent}T00:00:00Z`);
  const end = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (!sent || Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function sentLabel(sentOn: string | null, days: number | null): string {
  const sent = sentOn?.slice(0, 10) ? `sent ${boardDayLabel(sentOn.slice(0, 10))}` : "sent —";
  return days == null ? sent : `${sent} · ${days}d`;
}

/** with_tutor packs only. Tutors by count, apprentices oldest sent first. */
export function waitingOnTutors(
  people: { gtaId: string; name: string; tutor: string; stage: string | null; sentOn: string | null }[],
  today: string,
): WaitingTutorGroup[] {
  const groups = new Map<string, WaitingChip[]>();
  for (const person of people) {
    if (person.stage !== "with_tutor") continue;
    const list = groups.get(person.tutor) ?? [];
    list.push({
      gtaId: person.gtaId,
      name: person.name,
      sentOn: person.sentOn?.slice(0, 10) || null,
      daysWaiting: daysWaiting(person.sentOn, today),
    });
    groups.set(person.tutor, list);
  }
  return [...groups.entries()]
    .map(([tutor, apprentices]) => ({
      tutor,
      count: apprentices.length,
      apprentices: apprentices.sort((a, b) => {
        const date = String(a.sentOn || "9999-99-99").localeCompare(String(b.sentOn || "9999-99-99"));
        return date || a.name.localeCompare(b.name, "en-GB");
      }),
    }))
    .sort((a, b) => b.count - a.count || a.tutor.localeCompare(b.tutor, "en-GB"));
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

export type PlanBoardPillInput = {
  counter: string | null;
  stage: string | null;
  appointmentOn: string | null;
  nextBookedOn: string | null;
  awaitingDate: string | null;
};

/** Plan roster status. Pack stage is only the fallback when plan_counters has no row. */
export function planBoardPill(input: PlanBoardPillInput | null): { stage: BoardStage; label: string } {
  if (!input?.counter) return stagePresentation(input?.stage ?? null);
  const stage = input.stage;
  if (input.counter === "locked") {
    const day = input.awaitingDate?.slice(0, 10) || "";
    return { stage: "locked", label: day ? `Locked ${boardDayLabel(day)}` : "Locked" };
  }
  if (input.counter === "booked") {
    const day = (input.appointmentOn || input.nextBookedOn || "").slice(0, 10);
    return { stage: "booked", label: day ? `Booked ${boardDayLabel(day)}` : "Booked" };
  }
  if (input.counter === "to_book") {
    if (stage === "reviewed") return { stage: "to_book", label: "Reviewed / awaiting return" };
    return { stage: "to_book", label: "To book" };
  }
  if (input.counter === "waiting") {
    if (stage === "with_tutor") return { stage: "with_tutor", label: "With tutor" };
    if (stage === "reviewed") return { stage: "waiting", label: "Reviewed / awaiting return" };
    return { stage: "waiting", label: "Waiting" };
  }
  return stagePresentation(stage);
}

export type BoardStop = {
  gtaId: string;
  dateOn: string;
  verified: boolean;
  completed: boolean;
};

/** Earliest verified, unfinished stop from today. Matches plan_counters, which does not drop excluded stops. */
export function earliestBookedOn(stops: BoardStop[], today: string): Map<string, string> {
  const next = new Map<string, string>();
  for (const stop of stops) {
    const day = stop.dateOn.slice(0, 10);
    if (!day || day < today || !stop.verified || stop.completed) continue;
    const current = next.get(stop.gtaId);
    if (!current || day < current) next.set(stop.gtaId, day);
  }
  return next;
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
  return { today, weekStart, overdue, weeks, laterCount, undatedCount, waiting: [] };
}
