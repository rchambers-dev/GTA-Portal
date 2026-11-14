import { GTA_TUTORS } from "./gta-tutors";
import { tutorDueBand } from "./cycle";
import { addDays, weekStartMonday } from "./plan-due";

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
  startedOn?: string | null;
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
  cycle?: number | null;
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
  recentSignoffs: string[];
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
  const start = Date.parse(`${londonDay(today)}T00:00:00Z`);
  const end = Date.parse(`${londonDay(target)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** Calendar day in Europe/London. Date-only values stay as written. */
export function londonDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type NowStepId = "released" | "booking" | "booked" | "waiting";

const NOW_STEPS: { id: NowStepId; label: string }[] = [
  { id: "released", label: "Review released" },
  { id: "booking", label: "Needs booking" },
  { id: "booked", label: "Review booked" },
  { id: "waiting", label: "Waiting" },
];

export type Urgency = "red" | "amber" | "green" | "neutral";
export type Pace = "on-pace" | "slightly-behind" | "behind";

/**
 * The Portal rests on four steps. A finished pack is Waiting once the next
 * window is shut, and Review released when that window is open.
 */
export function analyticsNowStep(stage: string | null, windowOpen: boolean): NowStepId {
  if (stage === "with_tutor") return "released";
  if (stage === "to_book") return "booking";
  if (stage === "booked") return "booked";
  if ((stage === "completed" || stage === "reviewed") && windowOpen) return "released";
  return "waiting";
}

const STAGE_ENTRY_EVENTS: Record<string, string[]> = {
  with_tutor: ["released", "recalled"],
  to_book: ["submitted", "booking_cleared"],
  booked: ["booked"],
  reviewed: ["reviewed"],
  completed: ["completed"],
  waiting: ["created"],
};

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
export function cyclePace(done: number, expected: number, perDay: number): Pace {
  if (done >= expected) return "on-pace";
  if (expected - done < Math.max(perDay, 1)) return "slightly-behind";
  return "behind";
}

export function rateTone(value: number | null): Urgency {
  if (value == null) return "neutral";
  if (value >= 0.8) return "green";
  if (value >= 0.5) return "amber";
  return "red";
}

/** Coverage of a cycle: 100% is green, 90 to 99% is amber, under 90% is red. */
export function coverageTone(share: number | null): Urgency {
  if (share == null) return "neutral";
  if (share >= 1) return "green";
  if (share >= 0.9) return "amber";
  return "red";
}

export type CycleWindow = { number: number; start: string; end: string; current: boolean };

/** Ten-week blocks from the first review day through the cycle that contains today. */
export function listCycles(origin: string, today: string): CycleWindow[] {
  const cycles: CycleWindow[] = [];
  let start = origin;
  let number = 1;
  while (start <= today && number < 40) {
    const end = addDays(start, 69);
    cycles.push({ number, start, end, current: today >= start && today <= end });
    start = addDays(end, 1);
    number += 1;
  }
  return cycles;
}

function riskTone(id: RiskId): Urgency {
  if (id === "overdue" || id === "booking") return "red";
  if (id === "due-this-week" || id === "with-tutor") return "amber";
  if (id === "on-track") return "green";
  return "neutral";
}

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
  const anchor = source.reviews
    .map((review) => (review.status === "completed" ? review.actualOn?.slice(0, 10) || "" : ""))
    .filter(Boolean)
    .sort()[0] || null;
  const cycles = anchor ? listCycles(anchor, source.today) : [];
  const selected = filters.cycle ? cycles.find((cycle) => cycle.number === filters.cycle) || null : null;
  const window = selected
    ? { start: selected.start, end: selected.end < source.today ? selected.end : source.today }
    : rangeWindow(filters.range, source.today);
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

  const flow = NOW_STEPS.map((step) => ({ ...step, count: 0, tone: "neutral" as Urgency }));
  const stepOf = new Map<string, NowStepId>();
  for (const learner of learners) {
    const pack = packByGta.get(learner.gtaId);
    const last = completedByLearner.get(learner.gtaId)?.[0]?.actualOn?.slice(0, 10) || null;
    const planned = openReview.get(learner.gtaId)?.plannedOn?.slice(0, 10) || (last ? addDays(last, 70) : null);
    const windowOpen = tutorDueBand({
      today: source.today,
      plannedOn: planned,
      intervalWeeks: 10,
      stage: pack?.stage ?? null,
      inBreak: false,
    }).band === "need-doing";
    const step = analyticsNowStep(pack?.stage ?? null, windowOpen);
    stepOf.set(learner.gtaId, step);
    const slot = flow.find((item) => item.id === step);
    if (slot) slot.count += 1;
  }
  const waitingNow = flow.find((step) => step.id === "waiting")?.count || 0;

  const datedEvents = events.filter((event) => inWindow(event.at, window));
  const countType = (type: string) => datedEvents.filter((event) => event.type === type).length;

  let visits = 0;
  let calls = 0;
  let teams = 0;
  for (const review of reviews) {
    if (review.status !== "completed" || !inWindow(review.actualOn, window)) continue;
    if (review.method === "phone") calls += 1;
    else if (review.method === "teams") teams += 1;
    else if (review.method) visits += 1;
  }

  const completedReviews = reviews.filter((review) => review.status === "completed");
  const completedInRange = completedReviews.filter((review) => inWindow(review.actualOn, window));
  const bounds = cycleBounds(source.today, anchor);
  const countedFrom = firstWeekday(source.today);
  const doneThisCycle = new Set(
    completedReviews
      .filter((review) => {
        const day = review.actualOn?.slice(0, 10) || "";
        return day >= bounds.start && day <= bounds.end && day <= source.today;
      })
      .map((review) => review.gtaId),
  );
  const weekdaysLeft = countWeekdays(countedFrom, bounds.end);
  const quota = neededEachDay(learners.length, doneThisCycle.size, weekdaysLeft);
  const elapsed = source.today < countedFrom ? 0 : countWeekdays(countedFrom, source.today);
  const expected = quota * elapsed;
  const completedTotal = filters.range === "all" && !selected ? completedReviews.length : countType("completed");

  const thisMonday = weekStartMonday(source.today);
  const lastMonday = addDays(thisMonday, -7);
  const weekCount = (start: string, type: string) =>
    events.filter((event) => {
      const day = event.at.slice(0, 10);
      return event.type === type && day >= start && day <= addDays(start, 4) && inWindow(event.at, window);
    }).length;
  const methodWeek = (start: string, method: string) =>
    reviews.filter((review) => {
      const day = review.actualOn?.slice(0, 10) || "";
      return review.status === "completed" && review.method === method && day >= start && day <= addDays(start, 4) && inWindow(review.actualOn, window);
    }).length;
  const visitWeek = (start: string) => methodWeek(start, "in_person");
  const weekOnWeek = [
    { label: "Released", now: weekCount(thisMonday, "released"), previous: weekCount(lastMonday, "released") },
    { label: "Received", now: weekCount(thisMonday, "submitted"), previous: weekCount(lastMonday, "submitted") },
    { label: "Completed", now: weekCount(thisMonday, "completed"), previous: weekCount(lastMonday, "completed") },
    { label: "Visits", now: visitWeek(thisMonday), previous: visitWeek(lastMonday) },
    { label: "Calls", now: methodWeek(thisMonday, "phone"), previous: methodWeek(lastMonday, "phone") },
    { label: "Teams", now: methodWeek(thisMonday, "teams"), previous: methodWeek(lastMonday, "teams") },
  ].map((item) => ({ ...item, delta: item.now - item.previous }));

  const trend = lastFiveWeeks(thisMonday).map((monday) => {
    const friday = addDays(monday, 4);
    const inWeek = (day: string) => day >= monday && day <= friday;
    const completed = events.filter((event) => event.type === "completed" && inWeek(londonDay(event.at))).length;
    const start = countedFrom > monday ? countedFrom : monday;
    const end = source.today < friday ? source.today : friday;
    const weekExpected = end < start ? 0 : quota * countWeekdays(start, end);
    return {
      label: monthDay(monday),
      current: monday === thisMonday,
      released: events.filter((event) => event.type === "released" && inWeek(londonDay(event.at))).length,
      received: events.filter((event) => event.type === "submitted" && inWeek(londonDay(event.at))).length,
      completed,
      visits: reviews.filter((review) => review.status === "completed" && review.method === "in_person" && inWeek(review.actualOn?.slice(0, 10) || "")).length,
      callsTeams: reviews.filter((review) => review.status === "completed" && (review.method === "phone" || review.method === "teams") && inWeek(review.actualOn?.slice(0, 10) || "")).length,
      behind: monday === thisMonday && completed < weekExpected,
    };
  });

  const reviewsPerWeek = lastFiveWeeks(thisMonday).map((monday) => {
    const friday = addDays(monday, 4);
    const total = completedInRange.filter((review) => {
      const day = review.actualOn!.slice(0, 10);
      return day >= monday && day <= friday && weekdayName(day) !== "Saturday" && weekdayName(day) !== "Sunday";
    }).length;
    return { label: monthDay(monday), total, current: monday === thisMonday, monday };
  });

  const weekday = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({
    label: day,
    total: completedInRange.filter((review) => weekdayName(review.actualOn!.slice(0, 10)) === day).length,
    today: weekdayName(source.today) === day,
  }));

  const risk = Object.fromEntries(RISK_LABELS.map((item) => [item.id, 0])) as Record<RiskId, number>;
  const overdueByTutor = new Map<string, number>();
  const overdueLearners: { gtaId: string; name: string; tutor: string; plannedOn: string; days: number }[] = [];
  for (const learner of learners) {
    const planned = openReview.get(learner.gtaId)?.plannedOn?.slice(0, 10) || null;
    const step = stepOf.get(learner.gtaId);
    const pack = packByGta.get(learner.gtaId);
    const since = stageEnteredAt(pack, events) || pack?.stageSince || null;
    const age = since ? daysBetween(since, source.today) : 0;
    const friday = addDays(thisMonday, 4);
    const datePassed = Boolean(planned && planned < source.today);
    const dueThisWeek = Boolean(planned && planned >= source.today && planned <= friday);
    const bookingLate = step === "booking" && age > 7;
    const tutorLate = step === "released" && age > 7;
    if (datePassed && planned) {
      risk.overdue += 1;
      overdueByTutor.set(learner.tutor, (overdueByTutor.get(learner.tutor) || 0) + 1);
      overdueLearners.push({
        gtaId: learner.gtaId,
        name: learner.name,
        tutor: learner.tutor,
        plannedOn: planned,
        days: Math.max(0, daysBetween(planned, source.today)),
      });
    }
    if (dueThisWeek) risk["due-this-week"] += 1;
    if (bookingLate) risk.booking += 1;
    if (tutorLate) risk["with-tutor"] += 1;
    if (!datePassed && !dueThisWeek && !bookingLate && !tutorLate) risk["on-track"] += 1;
  }
  for (const step of flow) {
    if (step.id === "booking") step.tone = risk.booking > 0 ? "red" : step.count > 0 ? "amber" : "neutral";
    else if (step.id === "released") step.tone = risk["with-tutor"] > 0 ? "amber" : "neutral";
    else if (step.id === "booked") step.tone = step.count > 0 ? "green" : "neutral";
  }
  const waitingNowCount = flow.find((step) => step.id === "waiting")?.count || 0;

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

  const releasedPacks = new Set(events.filter((event) => event.type === "released" && inWindow(event.at, window)).map((event) => event.packId));
  const completedPacks = new Set(events.filter((event) => event.type === "completed" && inWindow(event.at, window)).map((event) => event.packId));

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
  const optionLearners = (skip: "tutor" | "programme" | "employer") =>
    source.learners.filter((learner) => {
      if (skip !== "tutor" && filters.tutorId !== "all" && learner.tutorId !== filters.tutorId) return false;
      if (skip !== "programme" && filters.programmeId !== "all" && learner.programmeId !== filters.programmeId) return false;
      if (skip !== "employer" && filters.employerId !== "all" && learner.employerId !== filters.employerId) return false;
      return true;
    });

  const active = new Set(source.activeSignoffs.filter((id) => ids.has(id)));
  const recent = new Set(source.recentSignoffs.filter((id) => ids.has(id)));
  const reversed = new Set(source.reversedSignoffs.filter((id) => ids.has(id) && !active.has(id)));
  const openConcerns = source.openConcerns.filter((id) => ids.has(id)).length;
  const resolvedConcerns = source.resolvedConcerns.filter((id) => ids.has(id)).length;
  const openBreaks = source.openBreaks.filter((id) => ids.has(id)).length;

  const log = [...events]
    .filter((event) => event.type !== "created" && inWindow(event.at, window))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => ({
      learner: learners.find((learner) => learner.gtaId === event.gtaId)?.name || event.gtaId,
      detail: event.detail,
      pill: eventLabel(event.type),
      actor: event.actorName || "System",
      role: event.actorName ? roleLabel(event.actorRole) : "System",
      at: event.at,
    }));

  return {
    learners: learners.length,
    flow,
    history: cycleHistory(cycles, learners, reviews, events, source.today, cyclePace(doneThisCycle.size, expected, quota)),
    weekend: weekdayName(source.today) === "Saturday" || weekdayName(source.today) === "Sunday",
    cycle: {
      done: doneThisCycle.size,
      needed: learners.length,
      expected,
      pace: cyclePace(doneThisCycle.size, expected, quota),
      lastDone: waitingNowCount,
      countedFrom,
      dates: `${longDate(bounds.start)} to ${longDate(bounds.end)}`,
    },
    overall: {
      neededEachDay: quota,
      cycleNote: `${longDate(bounds.start)} to ${longDate(bounds.end)}, counted from ${countedFromLabel(countedFrom)}`,
      rangeLabel: selected
        ? `Cycle ${selected.number}`
        : filters.range === "week"
          ? "This week"
          : filters.range === "4"
            ? "Last 4 weeks"
            : filters.range === "12"
              ? "Last 12 weeks"
              : "All time",
      released: countType("released"),
      received: countType("submitted"),
      completed: completedTotal,
      visits,
      calls,
      teams,
    },
    weekOnWeek,
    reviewsPerWeek,
    weekday,
    trend,
    risk: RISK_LABELS.map((item) => ({ ...item, count: risk[item.id], tone: riskTone(item.id) })),
    overdueByTutor: [...overdueByTutor.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    mostOverdue: overdueLearners
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name))
      .slice(0, 5),
    completion: {
      allTime: releasedPacks.size ? completedPacks.size / releasedPacks.size : null,
      allTimeTone: rateTone(releasedPacks.size ? completedPacks.size / releasedPacks.size : null),
      currentCycle: learners.length ? waitingNow / learners.length : null,
      currentCycleTone: rateTone(learners.length ? waitingNow / learners.length : null),
      inFlight: Math.max(0, learners.length - waitingNow),
      releaseToReceived: gaps("released", "submitted"),
      receivedToCompleted: gaps("submitted", "completed"),
    },
    safeguarding: {
      active: active.size,
      recent: recent.size,
      without: Math.max(0, learners.length - active.size),
      reversed: reversed.size,
      live: learners.length,
      tone: rateTone(learners.length ? recent.size / learners.length : null),
    },
    concerns: { open: openConcerns, resolved: resolvedConcerns, breaks: openBreaks },
    programmes: [...programmes.entries()]
      .map(([name, count]) => ({ name, count, share: learners.length ? count / learners.length : 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    tutors: tutors.sort((a, b) => b.learners - a.learners || a.name.localeCompare(b.name)),
    log,
    options: {
      tutors: countedOptions(optionLearners("tutor"), (learner) => learner.tutorId, (learner) => learner.tutor),
      programmes: countedOptions(optionLearners("programme"), (learner) => learner.programmeId, (learner) => learner.programme),
      employers: countedOptions(optionLearners("employer"), (learner) => learner.employerId, (learner) => learner.employer),
    },
  };
}

function stageEnteredAt(pack: AnalyticsPack | undefined, events: AnalyticsEvent[]): string | null {
  if (!pack) return null;
  const types = STAGE_ENTRY_EVENTS[pack.stage] || [];
  const matches = events
    .filter((event) => event.packId === pack.id && types.includes(event.type))
    .sort((a, b) => b.at.localeCompare(a.at));
  return matches[0]?.at || null;
}

function countedOptions(
  learners: AnalyticsLearner[],
  idOf: (learner: AnalyticsLearner) => string | null,
  nameOf: (learner: AnalyticsLearner) => string,
) {
  const seen = new Map<string, { name: string; count: number }>();
  for (const learner of learners) {
    const id = idOf(learner) || "";
    if (!id) continue;
    const row = seen.get(id) || { name: nameOf(learner), count: 0 };
    row.count += 1;
    seen.set(id, row);
  }
  return [...seen.entries()]
    .map(([id, row]) => ({ id, name: row.name, count: row.count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function lastFiveWeeks(thisMonday: string): string[] {
  return [4, 3, 2, 1, 0].map((ago) => addDays(thisMonday, -7 * ago));
}

function firstWeekday(day: string): string {
  let cursor = londonDay(day);
  while (weekdayName(cursor) === "Saturday" || weekdayName(cursor) === "Sunday") cursor = addDays(cursor, 1);
  return cursor;
}

function inCycle(date: string | null, cycle: CycleWindow, today: string): boolean {
  const day = date?.slice(0, 10) || "";
  return Boolean(day) && day >= cycle.start && day <= cycle.end && day <= today;
}

function cycleHistory(
  cycles: CycleWindow[],
  learners: AnalyticsLearner[],
  reviews: AnalyticsReview[],
  events: AnalyticsEvent[],
  today: string,
  pace: Pace,
): {
  number: number;
  start: string;
  end: string;
  dates: string;
  current: boolean;
  due: number;
  reviewed: number;
  coverage: number | null;
  tone: Urgency;
  missed: number | null;
  missedLearners: { gtaId: string; name: string; tutor: string; employer: string }[];
  byTutor: { name: string; count: number }[];
  pace: Pace | null;
  releaseToCompleted: number | null;
  visits: number;
  calls: number;
  teams: number;
}[] {
  const byPack = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const list = byPack.get(event.packId) || [];
    list.push(event);
    byPack.set(event.packId, list);
  }
  return [...cycles].reverse().map((cycle) => {
    const dueLearners = learners.filter((learner) => !learner.startedOn || learner.startedOn.slice(0, 10) <= cycle.end);
    const dueIds = new Set(dueLearners.map((learner) => learner.gtaId));
    const reviewed = new Set<string>();
    let visits = 0;
    let calls = 0;
    let teams = 0;
    for (const review of reviews) {
      if (review.status !== "completed" || !dueIds.has(review.gtaId) || !inCycle(review.actualOn, cycle, today)) continue;
      reviewed.add(review.gtaId);
      if (review.method === "phone") calls += 1;
      else if (review.method === "teams") teams += 1;
      else if (review.method) visits += 1;
    }
    const gaps: number[] = [];
    for (const list of byPack.values()) {
      const completed = list.filter((event) => event.type === "completed" && inCycle(londonDay(event.at), cycle, today));
      for (const done of completed) {
        const released = list
          .filter((event) => event.type === "released" && event.at <= done.at)
          .sort((a, b) => b.at.localeCompare(a.at))[0];
        if (!released) continue;
        const days = daysBetween(londonDay(released.at), londonDay(done.at));
        if (days >= 0) gaps.push(days);
      }
    }
    const coverage = dueLearners.length ? reviewed.size / dueLearners.length : null;
    const missedLearners = cycle.current
      ? []
      : dueLearners
          .filter((learner) => !reviewed.has(learner.gtaId))
          .map((learner) => ({ gtaId: learner.gtaId, name: learner.name, tutor: learner.tutor, employer: learner.employer }))
          .sort((a, b) => a.name.localeCompare(b.name) || a.gtaId.localeCompare(b.gtaId));
    const tutorCounts = new Map<string, number>();
    for (const learner of missedLearners) tutorCounts.set(learner.tutor, (tutorCounts.get(learner.tutor) || 0) + 1);
    return {
      number: cycle.number,
      start: cycle.start,
      end: cycle.end,
      dates: `${longDate(cycle.start)} to ${longDate(cycle.end)}`,
      current: cycle.current,
      due: dueLearners.length,
      reviewed: reviewed.size,
      coverage,
      tone: coverageTone(coverage),
      missed: cycle.current ? null : missedLearners.length,
      missedLearners,
      byTutor: [...tutorCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      pace: cycle.current ? pace : null,
      releaseToCompleted: average(gaps),
      visits,
      calls,
      teams,
    };
  });
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

function countedFromLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  return `${weekday} ${day}`;
}

export function eventLabel(type: string): string {
  if (type === "released") return "Released";
  if (type === "submitted") return "Received";
  if (type === "booked") return "Booked";
  if (type === "reviewed" || type === "completed") return "Completed";
  if (type === "undone") return "Undone";
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
  return `${Math.round(value * 1000) / 10}%`;
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
