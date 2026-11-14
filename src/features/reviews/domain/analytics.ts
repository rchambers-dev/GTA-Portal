import { GTA_TUTORS } from "./gta-tutors";
import { CYCLE_STEPS, cycleStepFromStage, tutorDueBand, type CycleStepId } from "./cycle";
import { addDays, reviewDueLabel, weekStartMonday } from "./plan-due";

export const ANALYTICS_RANGES = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "4", label: "Last 4 weeks" },
  { id: "12", label: "Last 12 weeks" },
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]["id"];

export type AnalyticsLearner = {
  gtaId: string;
  name: string;
  programmeId: string | null;
  programme: string;
  employerId: string | null;
  employer: string;
  tutorId: string | null;
  tutor: string;
};

export type AnalyticsReview = {
  id: string;
  gtaId: string;
  status: string;
  plannedOn: string | null;
  actualOn: string | null;
  method: string | null;
};

export type AnalyticsPack = {
  id: string;
  gtaId: string;
  stage: string;
  stageSince: string | null;
};

export type AnalyticsEvent = {
  packId: string;
  gtaId: string;
  type: string;
  at: string;
  actorName: string;
  actorRole: string;
  detail: string;
};

export type AnalyticsFilters = {
  range: AnalyticsRange;
  tutorId: string;
  programmeId: string;
  employerId: string;
};

export type AnalyticsSource = {
  today: string;
  learners: AnalyticsLearner[];
  reviews: AnalyticsReview[];
  packs: AnalyticsPack[];
  events: AnalyticsEvent[];
  activeSignoffs: string[];
  reversedSignoffs: string[];
  openConcerns: string[];
  resolvedConcerns: string[];
  openBreaks: string[];
};

const CLOSED = new Set(["completed", "withdrawn", "archived", "left", "removed"]);

export function isLiveApprentice(status: string | null, isTest: boolean | null): boolean {
  if (isTest) return false;
  if (status && CLOSED.has(status)) return false;
  return true;
}

export function rangeWindow(range: AnalyticsRange, today: string): { start: string | null; end: string } {
  if (range === "all") return { start: null, end: today };
  if (range === "week") return { start: weekStartMonday(today), end: today };
  if (range === "4") return { start: addDays(today, -27), end: today };
  return { start: addDays(today, -83), end: today };
}

function inWindow(date: string | null, window: { start: string | null; end: string }): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  if (day > window.end) return false;
  if (window.start && day < window.start) return false;
  return true;
}

function daysBetween(today: string, target: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${target.slice(0, 10)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function weekdayName(iso: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(`${iso}T00:00:00Z`).getUTCDay()
  ];
}

function monthDay(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(iso.slice(8, 10))} ${months[Number(iso.slice(5, 7)) - 1]}`;
}

/** Needed-each-day quota for a 10-week cycle, matching dailyReviewQuota. */
export function neededEachDay(learnerCount: number, completedThisCycle: number, weekdaysLeft: number): number {
  const remaining = Math.max(0, learnerCount - completedThisCycle);
  if (!remaining) return 0;
  return Math.max(1, weekdaysLeft ? Math.ceil(remaining / weekdaysLeft) : remaining);
}

export function countWeekdays(start: string, end: string): number {
  if (end < start) return 0;
  let count = 0;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const day = new Date(`${cursor}T00:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

function cycleBounds(today: string, earliest: string | null): { start: string; end: string } {
  const origin = earliest && earliest < today ? earliest : today;
  const elapsed = Math.max(0, daysBetween(origin, today));
  const index = Math.floor(elapsed / 70);
  const start = addDays(origin, index * 70);
  return { start, end: addDays(start, 69) };
}

export type RiskId = "overdue" | "due-this-week" | "booking" | "with-tutor" | "on-track";

const RISK_LABELS: { id: RiskId; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "due-this-week", label: "Due later this week" },
  { id: "booking", label: "Needs booking over 7 days" },
  { id: "with-tutor", label: "Still with tutor over 7 days" },
  { id: "on-track", label: "On track" },
];

export function buildAnalytics(source: AnalyticsSource, filters: AnalyticsFilters) {
  const window = rangeWindow(filters.range, source.today);
  const learners = source.learners.filter((learner) => {
    if (filters.tutorId !== "all" && learner.tutorId !== filters.tutorId) return false;
    if (filters.programmeId !== "all" && learner.programmeId !== filters.programmeId) return false;
    if (filters.employerId !== "all" && learner.employerId !== filters.employerId) return false;
    return true;
  });
  const ids = new Set(learners.map((learner) => learner.gtaId));
  const reviews = source.reviews.filter((review) => ids.has(review.gtaId));
  const packs = source.packs.filter((pack) => ids.has(pack.gtaId));
  const events = source.events.filter((event) => ids.has(event.gtaId));
  const packByGta = new Map<string, AnalyticsPack>();
  for (const pack of packs) {
    const current = packByGta.get(pack.gtaId);
    if (!current || (pack.stageSince || "") > (current.stageSince || "")) packByGta.set(pack.gtaId, pack);
  }
  const openReview = new Map<string, AnalyticsReview>();
  const completedByLearner = new Map<string, AnalyticsReview[]>();
  for (const review of reviews) {
    if (review.status === "open" && !openReview.has(review.gtaId)) openReview.set(review.gtaId, review);
    if (review.status === "completed") {
      const list = completedByLearner.get(review.gtaId) || [];
      list.push(review);
      completedByLearner.set(review.gtaId, list);
    }
  }
  for (const list of completedByLearner.values()) {
    list.sort((a, b) => String(b.actualOn).localeCompare(String(a.actualOn)));
  }

  const flow = CYCLE_STEPS.map((step) => ({ id: step.id, label: step.label, count: 0 }));
  const stepOf = new Map<string, CycleStepId>();
  for (const learner of learners) {
    const step = cycleStepFromStage(packByGta.get(learner.gtaId)?.stage ?? null);
    stepOf.set(learner.gtaId, step);
    const slot = flow.find((item) => item.id === step);
    if (slot) slot.count += 1;
  }

  const datedEvents = events.filter((event) => inWindow(event.at, window));
  const countType = (type: string) => datedEvents.filter((event) => event.type === type).length;

  let visits = 0;
  let calls = 0;
  let teams = 0;
  for (const learner of learners) {
    const step = stepOf.get(learner.gtaId);
    if (step !== "waiting" && step !== "archived") continue;
    const latest = completedByLearner.get(learner.gtaId)?.[0];
    if (!latest || !inWindow(latest.actualOn, window)) continue;
    if (latest.method === "phone") calls += 1;
    else if (latest.method === "teams") teams += 1;
    else if (latest.method) visits += 1;
  }

  const completedInRange = reviews.filter(
    (review) => review.status === "completed" && inWindow(review.actualOn, window),
  );
  const earliest = completedInRange.map((review) => review.actualOn || "").filter(Boolean).sort()[0] || null;
  const bounds = cycleBounds(source.today, earliest);
  const completedThisCycle = new Set(
    reviews
      .filter(
        (review) =>
          review.status === "completed" &&
          review.actualOn &&
          review.actualOn.slice(0, 10) >= bounds.start &&
          review.actualOn.slice(0, 10) <= source.today,
      )
      .map((review) => review.gtaId),
  );
  const weekdaysLeft = countWeekdays(source.today, bounds.end);
  const quota = neededEachDay(learners.length, completedThisCycle.size, weekdaysLeft);

  const thisMonday = weekStartMonday(source.today);
  const lastMonday = addDays(thisMonday, -7);
  const weekCount = (start: string, type: string) =>
    events.filter((event) => {
      const day = event.at.slice(0, 10);
      return event.type === type && day >= start && day <= addDays(start, 4) && inWindow(event.at, window);
    }).length;
  const visitWeek = (start: string) =>
    reviews.filter((review) => {
      const day = review.actualOn?.slice(0, 10) || "";
      return review.status === "completed" && review.method === "in_person" && day >= start && day <= addDays(start, 4) && inWindow(review.actualOn, window);
    }).length;
  const weekOnWeek = [
    { label: "Released", now: weekCount(thisMonday, "released"), previous: weekCount(lastMonday, "released") },
    { label: "Received", now: weekCount(thisMonday, "submitted"), previous: weekCount(lastMonday, "submitted") },
    { label: "Completed", now: weekCount(thisMonday, "completed"), previous: weekCount(lastMonday, "completed") },
    { label: "Visits", now: visitWeek(thisMonday), previous: visitWeek(lastMonday) },
  ].map((item) => ({ ...item, delta: item.now - item.previous }));

  const trendStart = window.start || addDays(source.today, -77);
  const trend: { label: string; current: boolean; released: number; received: number; completed: number; visits: number }[] = [];
  for (let monday = weekStartMonday(trendStart); monday <= source.today; monday = addDays(monday, 7)) {
    const friday = addDays(monday, 4);
    const inWeek = (type: string) =>
      events.filter((event) => event.type === type && event.at.slice(0, 10) >= monday && event.at.slice(0, 10) <= friday).length;
    trend.push({
      label: monthDay(monday),
      current: monday === thisMonday,
      released: inWeek("released"),
      received: inWeek("submitted"),
      completed: inWeek("completed"),
      visits: reviews.filter((review) => {
        const day = review.actualOn?.slice(0, 10) || "";
        return review.status === "completed" && review.method === "in_person" && day >= monday && day <= friday;
      }).length,
    });
  }
  const trendWeeks = trend.slice(-16);

  const perWeek = new Map<string, { label: string; total: number; current: boolean; monday: string }>();
  for (const review of completedInRange) {
    const day = review.actualOn!.slice(0, 10);
    if (weekdayName(day) === "Saturday" || weekdayName(day) === "Sunday") continue;
    const monday = weekStartMonday(day);
    const row = perWeek.get(monday) || { label: monthDay(monday), total: 0, current: monday === thisMonday, monday };
    row.total += 1;
    perWeek.set(monday, row);
  }
  const reviewsPerWeek = [...perWeek.values()].sort((a, b) => a.monday.localeCompare(b.monday)).slice(-16);

  const weekday = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({
    label: day,
    total: completedInRange.filter((review) => weekdayName(review.actualOn!.slice(0, 10)) === day).length,
    today: weekdayName(source.today) === day,
  }));

  const risk = Object.fromEntries(RISK_LABELS.map((item) => [item.id, 0])) as Record<RiskId, number>;
  const overdueByTutor = new Map<string, number>();
  for (const learner of learners) {
    const planned = openReview.get(learner.gtaId)?.plannedOn?.slice(0, 10) || null;
    const due = reviewDueLabel({ today: source.today, nextDate: planned, intervalWeeks: 10 });
    const step = stepOf.get(learner.gtaId);
    const since = packByGta.get(learner.gtaId)?.stageSince?.slice(0, 10) || null;
    const age = since ? daysBetween(since, source.today) : 0;
    const friday = addDays(thisMonday, 4);
    let bucket: RiskId = "on-track";
    if (due.state === "overdue") bucket = "overdue";
    else if (planned && planned >= source.today && planned <= friday) bucket = "due-this-week";
    else if (step === "booking" && age >= 7) bucket = "booking";
    else if (step === "released" && age >= 7) bucket = "with-tutor";
    risk[bucket] += 1;
    if (bucket === "overdue") overdueByTutor.set(learner.tutor, (overdueByTutor.get(learner.tutor) || 0) + 1);
  }

  const gaps = (from: string, to: string) => {
    const values: number[] = [];
    const byPack = new Map<string, AnalyticsEvent[]>();
    for (const event of events) {
      const list = byPack.get(event.packId) || [];
      list.push(event);
      byPack.set(event.packId, list);
    }
    for (const list of byPack.values()) {
      const start = list.find((event) => event.type === from && inWindow(event.at, window));
      const end = list.find((event) => event.type === to && inWindow(event.at, window));
      if (!start || !end) continue;
      const days = daysBetween(start.at.slice(0, 10), end.at.slice(0, 10));
      if (days >= 0) values.push(days);
    }
    return { median: median(values), average: average(values), count: values.length };
  };

  const allReviews = reviews.length;
  const completedReviews = reviews.filter((review) => review.status === "completed").length;
  const openReviews = reviews.filter((review) => review.status === "open").length;

  const tradeOf = new Map(GTA_TUTORS.map((tutor) => [tutor.name, tutor.trade]));
  const tutorRows = new Map<string, { name: string; trade: string; learners: number; visits: number; bands: Record<string, number> }>();
  const ensure = (name: string) => {
    const row = tutorRows.get(name) || {
      name,
      trade: tradeOf.get(name) || "",
      learners: 0,
      visits: 0,
      bands: { "need-doing": 0, "coming-up": 0, "not-due": 0, "sent-back": 0 },
    };
    tutorRows.set(name, row);
    return row;
  };
  for (const tutor of GTA_TUTORS) ensure(tutor.name);
  for (const learner of learners) {
    const row = ensure(learner.tutor || "No tutor set");
    row.learners += 1;
    const pack = packByGta.get(learner.gtaId);
    const planned = openReview.get(learner.gtaId)?.plannedOn?.slice(0, 10) || null;
    const band = tutorDueBand({
      today: source.today,
      plannedOn: planned,
      intervalWeeks: 10,
      stage: pack?.stage ?? null,
      inBreak: false,
    }).band;
    row.bands[band] = (row.bands[band] || 0) + 1;
    row.visits += (completedByLearner.get(learner.gtaId) || []).filter((review) => review.method === "in_person").length;
  }
  const tutors = [...tutorRows.values()].filter((row) => row.learners > 0);

  const programmes = new Map<string, number>();
  for (const learner of learners) programmes.set(learner.programme || "No programme", (programmes.get(learner.programme || "No programme") || 0) + 1);

  const active = new Set(source.activeSignoffs.filter((id) => ids.has(id)));
  const reversed = new Set(source.reversedSignoffs.filter((id) => ids.has(id) && !active.has(id)));
  const openConcerns = source.openConcerns.filter((id) => ids.has(id)).length;
  const resolvedConcerns = source.resolvedConcerns.filter((id) => ids.has(id)).length;
  const openBreaks = source.openBreaks.filter((id) => ids.has(id)).length;

  const log = [...events]
    .filter((event) => inWindow(event.at, window))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 80)
    .map((event) => ({
      learner: learners.find((learner) => learner.gtaId === event.gtaId)?.name || event.gtaId,
      detail: event.detail || eventLabel(event.type),
      pill: eventLabel(event.type),
      actor: event.actorName || "Reviewer",
      role: roleLabel(event.actorRole),
      at: event.at,
    }));

  return {
    learners: learners.length,
    flow,
    overall: {
      neededEachDay: quota,
      released: countType("released"),
      received: countType("submitted"),
      completed: countType("reviewed"),
      archived: countType("completed"),
      visits,
      calls,
      teams,
    },
    weekOnWeek,
    reviewsPerWeek,
    weekday,
    trend: trendWeeks,
    risk: RISK_LABELS.map((item) => ({ ...item, count: risk[item.id] })),
    overdueByTutor: [...overdueByTutor.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    completion: {
      allTime: allReviews ? completedReviews / allReviews : null,
      currentCycle: learners.length ? completedThisCycle.size / learners.length : null,
      inFlight: learners.length ? openReviews / learners.length : null,
      releaseToReceived: gaps("released", "submitted"),
      receivedToCompleted: gaps("submitted", "completed"),
    },
    safeguarding: {
      active: active.size,
      without: Math.max(0, learners.length - active.size),
      reversed: reversed.size,
      live: learners.length,
    },
    concerns: { open: openConcerns, resolved: resolvedConcerns, breaks: openBreaks },
    programmes: [...programmes.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    tutors: tutors.sort((a, b) => b.learners - a.learners || a.name.localeCompare(b.name)),
    log,
    options: {
      tutors: unique(source.learners.map((learner) => ({ id: learner.tutorId || "", name: learner.tutor })).filter((item) => item.id)),
      programmes: unique(source.learners.map((learner) => ({ id: learner.programmeId || "", name: learner.programme })).filter((item) => item.id)),
      employers: unique(source.learners.map((learner) => ({ id: learner.employerId || "", name: learner.employer })).filter((item) => item.id)),
    },
  };
}

function unique(items: { id: string; name: string }[]) {
  const seen = new Map<string, string>();
  for (const item of items) if (!seen.has(item.id)) seen.set(item.id, item.name);
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function eventLabel(type: string): string {
  if (type === "released") return "Released";
  if (type === "submitted") return "Received";
  if (type === "booked") return "Booked";
  if (type === "reviewed") return "Completed";
  if (type === "completed") return "Archived";
  if (type === "recalled") return "Recalled";
  if (type === "draft_saved") return "Draft saved";
  return type.replaceAll("_", " ");
}

function roleLabel(role: string): string {
  if (!role) return "Reviewer";
  if (role.toLowerCase() === "tutor") return "Tutor";
  if (role.toLowerCase().includes("admin")) return "Administration";
  return role;
}

export function percent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function londonStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
