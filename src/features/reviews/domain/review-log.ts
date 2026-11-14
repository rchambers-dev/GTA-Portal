import { eventLabel, londonDay } from "./analytics";
import { addDays, weekStartMonday } from "./plan-due";

export const LOG_PAGE_SIZE = 20;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const STAGE_LABELS: Record<string, string> = {
  waiting: "Waiting",
  with_tutor: "Review released",
  to_book: "Needs booking",
  booked: "Review booked",
  reviewed: "Review completed",
  completed: "Completed",
};

export type LogRange = "all" | "week" | "4" | "12";

export type ReviewLogEvent = {
  id: string;
  gtaId: string;
  learner: string;
  tutorId: string | null;
  tutor: string;
  type: string;
  fromStage: string | null;
  toStage: string | null;
  at: string;
  actor: string;
  role: string;
  detail: string;
  undoes: string | null;
  /** The review day (review_days.date_on) when this event completed that day's plan. */
  dayOn: string | null;
};

export type DayUndoPlan = {
  date: string;
  completedAt: string;
  learners: { gtaId: string; name: string }[];
};

export type ReviewLogFilters = {
  query: string;
  learnerId: string;
  tutorId: string;
  eventType: string;
  range: LogRange;
  page: number;
};

export function stageLabel(stage: string | null): string {
  if (!stage) return "the same stage";
  return STAGE_LABELS[stage] || stage;
}

const SINGLE_UNDO_TYPES = new Set(["released", "submitted", "booked"]);

/** A stage-changing pack event. Safeguarding signatures, pack creation and undo rows are never undoable. */
export function isUndoableType(event: Pick<ReviewLogEvent, "type" | "fromStage" | "toStage">): boolean {
  if (event.type === "undone" || event.type === "created" || event.type === "signature_recorded") return false;
  if (!event.fromStage || !event.toStage) return false;
  return event.fromStage !== event.toStage;
}

/** Released, received and booked can be undone one event at a time. A completion cannot. */
export function isSingleUndoType(event: Pick<ReviewLogEvent, "type" | "fromStage" | "toStage">): boolean {
  return SINGLE_UNDO_TYPES.has(event.type) && isUndoableType(event);
}

export function withinUndoWindow(at: string, now: Date): boolean {
  const then = Date.parse(at);
  if (Number.isNaN(then)) return false;
  const age = now.getTime() - then;
  return age >= 0 && age <= SEVEN_DAYS_MS;
}

export function undoneIds(events: ReviewLogEvent[]): Set<string> {
  return new Set(events.map((event) => event.undoes).filter((id): id is string => Boolean(id)));
}

/** The newest released, received or booked event per learner. A later completion blocks it. */
export function latestUndoableIds(events: ReviewLogEvent[], now: Date): Set<string> {
  const undone = undoneIds(events);
  const newest = new Map<string, ReviewLogEvent>();
  for (const event of events) {
    if (!isUndoableType(event) || undone.has(event.id) || !withinUndoWindow(event.at, now)) continue;
    const current = newest.get(event.gtaId);
    if (!current || event.at > current.at) newest.set(event.gtaId, event);
  }
  return new Set([...newest.values()].filter((event) => isSingleUndoType(event)).map((event) => event.id));
}

/** Every learner on that day's plan, when this completion row can undo the whole day. */
export function dayUndoLearners(
  event: ReviewLogEvent,
  day: DayUndoPlan | undefined,
  events: ReviewLogEvent[],
  now: Date,
): { gtaId: string; name: string }[] | null {
  if (event.type !== "completed" || !event.dayOn || !day || day.date !== event.dayOn) return null;
  if (!day.learners.some((learner) => learner.gtaId === event.gtaId)) return null;
  if (undoneIds(events).has(event.id)) return null;
  if (!withinUndoWindow(day.completedAt, now)) return null;
  return day.learners;
}

export function undoSummary(event: ReviewLogEvent): string {
  return `Undo ${eventLabel(event.type)} for ${event.learner}. The pack goes back from ${stageLabel(event.toStage)} to ${stageLabel(event.fromStage)}. The original event stays in the log.`;
}

export function dayUndoSummary(date: string): string {
  return `Undo the completion of ${date} for every learner on that day's plan. Each learner stays on the route, in the same order, with the same times and method. Each pack goes back to Review booked, each review reopens with the same plan, reviewer and method, and the next cycle's waiting pack is voided. Safeguarding sign-offs stay. Nothing is deleted.`;
}

export function rangeStart(range: LogRange, today: string): string | null {
  if (range === "all") return null;
  if (range === "week") return weekStartMonday(today);
  if (range === "4") return addDays(today, -27);
  return addDays(today, -83);
}

export function filterLog(events: ReviewLogEvent[], filters: ReviewLogFilters, today: string): ReviewLogEvent[] {
  const start = rangeStart(filters.range, today);
  const query = filters.query.trim().toLowerCase();
  return events
    .filter((event) => event.type !== "created")
    .filter((event) => {
      const day = londonDay(event.at);
      if (start && day < start) return false;
      if (day > today) return false;
      if (filters.learnerId !== "all" && event.gtaId !== filters.learnerId) return false;
      if (filters.tutorId !== "all" && event.tutorId !== filters.tutorId) return false;
      if (filters.eventType !== "all" && event.type !== filters.eventType) return false;
      if (!query) return true;
      const haystack = `${event.learner} ${event.detail} ${event.actor} ${eventLabel(event.type)}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

export function pageOf<T>(rows: T[], page: number, size = LOG_PAGE_SIZE): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), page: current, pages };
}
