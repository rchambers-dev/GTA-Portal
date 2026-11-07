import {
  addDays,
  dailyReviewQuota,
  dateFromKey,
  DEFAULT_GTA_REVIEWER,
  formatUkDateKey,
  isWeekdayDate,
  lastReviewDateKey,
  normaliseAttended,
  reviewAttendedFor,
  normaliseDateKey,
  planningPriority,
  reviewTiming,
  toDateKey,
  weekContaining,
} from "./planner.js";
import {
  REVIEW_FLOW_STEPS,
  TUTOR_DUE_BANDS,
  formatCycleStamp,
  reviewFlowState,
  reviewLearner,
  tutorDueBand,
} from "./reviews.js";
import { GTA_TUTORS, canonTutorName } from "./tutors.js";
import { escapeHtml } from "./lib/html.js";
import { daysBetween, startOfLocalDay } from "./lib/dates.js";
import { allLearners, isReportTestLearner } from "./lib/learners.js";

export const ANALYTICS_RANGES = [
  { id: "all", label: "All time", weeks: null },
];

function calendarKey(year, monthIndex, day) {
  return toDateKey(new Date(year, monthIndex, day));
}

function reportPeriodWindow(period) {
  if (!period?.startKey || !period?.endKey) return null;
  return {
    id: period.id,
    label: period.label,
    startKey: period.startKey,
    endKey: period.endKey,
    weeks: weekCount(period.startKey, period.endKey),
    weekdays: countWeekdays(period.startKey, period.endKey),
  };
}

function lastFridayOnOrBefore(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return "";
  const day = date.getDay();
  const back = day >= 5 ? day - 5 : day + 2;
  return toDateKey(addDays(date, -back));
}

export function earliestReviewDateKey(state) {
  return (
    completedVisitItems(state)
      .map((item) => item.dateKey)
      .filter(Boolean)
      .sort()[0] || ""
  );
}

function fridayPeriod(base, { sinceKey = "", today = "" } = {}) {
  const endKey = lastFridayOnOrBefore(base.calendarEndKey);
  if (!endKey || (today && endKey > today)) return null;
  if (sinceKey && endKey < sinceKey) return null;
  if (!base.startKey || base.startKey > endKey) return null;
  return { ...base, startKey: base.startKey, endKey };
}

export function completedReportPeriods(now = new Date(), { sinceKey = "" } = {}) {
  const today = toDateKey(now);
  const periods = [];
  const currentYear = now.getFullYear();
  const first = sinceKey ? dateFromKey(sinceKey) : new Date(currentYear - 2, 0, 1);

  for (let year = currentYear; year >= (first?.getFullYear?.() || currentYear - 2); year -= 1) {
    const period = fridayPeriod(
      {
        id: `year-${year}`,
        kind: "year",
        year,
        label: `Year ${year}`,
        startKey: calendarKey(year, 0, 1),
        calendarEndKey: calendarKey(year, 12, 0),
      },
      { sinceKey, today },
    );
    if (period) periods.push(period);
  }

  for (let year = currentYear; year >= (first?.getFullYear?.() || currentYear - 1); year -= 1) {
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const startMonth = (quarter - 1) * 3;
      const period = fridayPeriod(
        {
          id: `q${quarter}-${year}`,
          kind: "quarter",
          quarter,
          year,
          label: `Q${quarter} ${year}`,
          startKey: calendarKey(year, startMonth, 1),
          calendarEndKey: calendarKey(year, startMonth + 3, 0),
        },
        { sinceKey, today },
      );
      if (period) periods.push(period);
    }
  }

  const startMonth = first
    ? new Date(first.getFullYear(), first.getMonth(), 1)
    : new Date(currentYear, now.getMonth() - 18, 1);
  for (
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    cursor >= startMonth;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
  ) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const period = fridayPeriod(
      {
        id: `month-${year}-${String(month + 1).padStart(2, "0")}`,
        kind: "month",
        year,
        month,
        label: cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        startKey: calendarKey(year, month, 1),
        calendarEndKey: calendarKey(year, month + 1, 0),
      },
      { sinceKey, today },
    );
    if (period) periods.push(period);
  }

  periods.sort((a, b) => String(b.endKey).localeCompare(String(a.endKey)));
  return periods;
}

export function findCompletedReportPeriod(rangeId, now = new Date(), options = {}) {
  return completedReportPeriods(now, options).find((item) => item.id === rangeId) || null;
}

export function reportIsFinished(report, now = new Date()) {
  if (!report?.endKey) return false;
  const end = dateFromKey(report.endKey);
  if (!end || end.getDay() !== 5) return false;
  return report.endKey <= toDateKey(now);
}

function reportJustEnded(period, now = new Date()) {
  const end = dateFromKey(period?.endKey);
  if (!end || end.getDay() !== 5) return false;
  const days = (startOfLocalDay(now).getTime() - end.getTime()) / 86400000;
  return days >= 0 && days <= 14;
}

export function inProgressReportPeriods(now = new Date(), { sinceKey = "" } = {}) {
  const today = toDateKey(now);
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const candidates = [
    {
      label: now.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      startKey: calendarKey(year, month, 1),
      calendarEndKey: calendarKey(year, month + 1, 0),
    },
    {
      label: `Q${quarter} ${year}`,
      startKey: calendarKey(year, (quarter - 1) * 3, 1),
      calendarEndKey: calendarKey(year, quarter * 3, 0),
    },
    {
      label: `Year ${year}`,
      startKey: calendarKey(year, 0, 1),
      calendarEndKey: calendarKey(year, 12, 0),
    },
  ];
  return candidates
    .map((item) => {
      const availableFrom = lastFridayOnOrBefore(item.calendarEndKey);
      if (!availableFrom || availableFrom <= today) return null;
      if (sinceKey && item.calendarEndKey < sinceKey) return null;
      return { ...item, availableFrom };
    })
    .filter(Boolean);
}

export function makeAnalyticsReport(state, period, now = new Date()) {
  const stats = buildReviewAnalytics(state, { rangeId: period.id, now });
  return {
    id: `rep-${period.id}`,
    periodId: period.id,
    kind: period.kind,
    label: period.label,
    startKey: period.startKey,
    endKey: period.endKey,
    createdAt: now.toISOString(),
    emailedAt: "",
    html: analyticsReportHtml(stats),
    summary: {
      learners: stats.learners,
      completed: stats.completed?.total || 0,
      visits: stats.visits?.total || 0,
      calls: stats.calls?.total || 0,
      teams: stats.teams?.total || 0,
    },
  };
}

export function ensureAnalyticsReports(state, now = new Date()) {
  if (!state || typeof state !== "object") return { created: [], changed: false };
  if (!Array.isArray(state.analyticsReports)) state.analyticsReports = [];
  const sinceKey = earliestReviewDateKey(state);
  const periods = completedReportPeriods(now, { sinceKey });
  const allowed = new Set(periods.map((item) => item.id));
  const created = [];
  let changed = false;
  const kept = [];
  for (const item of state.analyticsReports) {
    if (!allowed.has(item.periodId)) {
      changed = true;
      continue;
    }
    kept.push(item);
  }
  state.analyticsReports = kept;
  for (const period of periods) {
    const existing = state.analyticsReports.find((item) => item.periodId === period.id);
    const report = makeAnalyticsReport(state, period, now);
    if (existing) {
      report.id = existing.id;
      report.emailedAt = existing.emailedAt || "";
      const same =
        existing.startKey === report.startKey &&
        existing.endKey === report.endKey &&
        existing.html === report.html;
      if (same) continue;
      Object.assign(existing, report);
      changed = true;
      continue;
    }
    state.analyticsReports.push(report);
    created.push(report);
    changed = true;
  }
  state.analyticsReports.sort((a, b) => String(b.endKey).localeCompare(String(a.endKey)));
  return { created, changed };
}

export function analyticsReportEmailText(report) {
  const summary = report?.summary || {};
  return [
    `Review Assistant report: ${report.label}`,
    `${formatUkDateKey(report.startKey)} to ${formatUkDateKey(report.endKey)}`,
    "",
    `Reviews completed: ${summary.completed || 0}`,
    `Visits done: ${summary.visits || 0}`,
    `Calls done: ${summary.calls || 0}`,
    `Teams done: ${summary.teams || 0}`,
    "",
    "Open Reports in Review Assistant to view the full saved copy.",
  ].join("\r\n");
}

export function reportsToEmail(created, now = new Date()) {
  return (created || []).filter(
    (item) => reportJustEnded({ endKey: item.endKey }, now) && !item.emailedAt,
  );
}

export function analyticsReportsEmailText(reports) {
  const list = reports || [];
  if (list.length === 1) return analyticsReportEmailText(list[0]);
  return list.map(analyticsReportEmailText).join("\r\n\r\n----\r\n\r\n");
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function analyticsLearner(state, learnerId) {
  const learner = reviewLearner(state, learnerId);
  if (isReportTestLearner(learner, learnerId)) return null;
  return learner;
}

function average(values) {
  const rows = values.filter((item) => Number.isFinite(item));
  if (!rows.length) return null;
  return rows.reduce((sum, item) => sum + item, 0) / rows.length;
}

function median(values) {
  const rows = values.filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

function formatAverage(value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (value === 0) return "0";
  if (value >= 10) return String(Math.round(value));
  return value.toFixed(1).replace(/\.0$/, "");
}

// eslint-disable-next-line no-unused-vars
function formatDays(value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (value < 0) return "—";
  if (value < 1) {
    const hours = Math.max(1, Math.round(value * 24));
    return hours === 1 ? "about an hour" : `${hours} hours`;
  }
  if (value < 1.5) return "1 day";
  return `${formatAverage(value)} days`;
}

function countWeekdays(startKey, endKey) {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (!start || !end || start > end) return 0;
  let count = 0;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (isWeekdayDate(date)) count += 1;
  }
  return count;
}

function weekCount(startKey, endKey) {
  const start = weekContaining(startKey);
  const end = weekContaining(endKey);
  if (!start || !end) return 1;
  const days =
    (dateFromKey(end.startKey).getTime() - dateFromKey(start.startKey).getTime()) /
    86400000;
  return Math.max(1, Math.round(days / 7) + 1);
}

function eachWeek(startKey, endKey) {
  const start = weekContaining(startKey);
  const end = weekContaining(endKey);
  if (!start || !end) return [];
  const weeks = [];
  let cursor = start.startKey;
  while (cursor <= end.startKey) {
    const week = weekContaining(cursor);
    weeks.push(week);
    cursor = toDateKey(addDays(dateFromKey(week.startKey), 7));
  }
  return weeks;
}

function inRange(dateKey, window) {
  if (!dateKey) return false;
  if (window.startKey && dateKey < window.startKey) return false;
  if (window.endKey && dateKey > window.endKey) return false;
  return true;
}

function findRange(rangeId) {
  return ANALYTICS_RANGES.find((item) => item.id === rangeId) || ANALYTICS_RANGES[0];
}

function rangeWindow(rangeId, now, earliestKey) {
  const today = toDateKey(now);
  const thisWeek = weekContaining(today);
  const period = findCompletedReportPeriod(rangeId, now, { sinceKey: earliestKey || "" });
  if (period) return reportPeriodWindow(period);
  const range = findRange(rangeId);
  if (!range.weeks) {
    const startKey = earliestKey || thisWeek.startKey;
    return {
      id: range.id,
      label: range.label,
      startKey,
      endKey: today,
      weeks: weekCount(startKey, today),
      weekdays: countWeekdays(startKey, today),
    };
  }
  const startKey = toDateKey(addDays(dateFromKey(thisWeek.startKey), -(range.weeks - 1) * 7));
  return {
    id: range.id,
    label: range.label,
    startKey,
    endKey: today,
    weeks: range.weeks,
    weekdays: countWeekdays(startKey, today),
  };
}

// eslint-disable-next-line no-unused-vars
function learnerName(state, learnerId) {
  return analyticsLearner(state, learnerId)?.name || "Unknown learner";
}

export const ANALYTICS_EVENT_BY_STATUS = {
  tutor: "sent",
  returned: "returned",
  completed: "completed",
};

const REVIEW_LOG_TYPES = [
  "sent",
  "returned",
  "booked",
  "completed",
  "added",
  "restored",
  "archived-off",
  "planned",
  "emailed",
  "downloaded",
  "edited",
  "arrived",
  "left",
  "visit-review",
];
const CYCLE_ONCE_TYPES = ["sent", "returned", "booked", "completed"];

function newEventId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `an-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ensureAnalyticsState(state, now = new Date()) {
  if (!state || typeof state !== "object") return state;
  if (!Array.isArray(state.analyticsEvents)) state.analyticsEvents = [];
  if (!state.analyticsSince) state.analyticsSince = toDateKey(now);
  return state;
}

export function recordAnalyticsEvent(
  state,
  { type, learnerId, reviewId, at, actor, label: eventLabelText } = {},
  now = new Date(),
) {
  ensureAnalyticsState(state, now);
  if (!REVIEW_LOG_TYPES.includes(type)) return null;
  const label = String(eventLabelText || "").trim();
  if (!learnerId && !label) return null;
  const when = at ? new Date(at) : now;
  if (Number.isNaN(when.getTime())) return null;
  const dateKey = toDateKey(when);
  if (state.analyticsSince && dateKey < state.analyticsSince) return null;
  const already =
    CYCLE_ONCE_TYPES.includes(type) &&
    (state.analyticsEvents || []).some(
      (item) => item.type === type && item.reviewId && item.reviewId === (reviewId || ""),
    );
  if (already) return null;
  const event = {
    id: newEventId(),
    type,
    at: when.toISOString(),
    dateKey,
    learnerId: learnerId || "",
    reviewId: reviewId || "",
    label,
    actorName: String(actor?.name || "").trim(),
    actorEmail: String(actor?.email || "").trim(),
    actorRole: String(actor?.role || "").trim(),
  };
  state.analyticsEvents = [...(state.analyticsEvents || []), event];
  return event;
}

function collectLearnersById(state) {
  const map = new Map();
  for (const learner of allLearners(state, (item) => isReportTestLearner(item, item.id))) map.set(learner.id, learner);
  return map;
}

function eventActor(item, learner) {
  const stored = String(item?.actorName || "").trim();
  if (stored) {
    return {
      name: stored,
      email: String(item.actorEmail || "").trim(),
      role: String(item.actorRole || "").trim(),
    };
  }
  if (item?.type === "returned") {
    const tutor = canonTutorName(learner?.tutor);
    if (tutor) return { name: tutor, role: "tutor" };
  }
  return { name: DEFAULT_GTA_REVIEWER, role: "reviewer" };
}

function eventAttended(state, item, learner) {
  const pack = (state.savedReviews || []).find((review) => review.id === item.reviewId);
  return reviewAttendedFor(learner, pack?.attended || "");
}

function collectEvents(state) {
  ensureAnalyticsState(state);
  const since = state.analyticsSince || "";
  const events = [];
  for (const item of state.analyticsEvents || []) {
    if (!REVIEW_LOG_TYPES.includes(item.type)) continue;
    if (since && item.dateKey && item.dateKey < since) continue;
    const learner = item.learnerId ? reviewLearner(state, item.learnerId) : null;
    if (item.learnerId && !learner) continue;
    const actor = eventActor(item, learner);
    events.push({
      type: item.type,
      at: item.at,
      dateKey: item.dateKey,
      learnerId: item.learnerId,
      learnerName: learner?.name || (item.type === "edited" ? "Learner" : item.label) || "Review Assistant",
      reviewId: item.reviewId || "",
      plannedDateKey: "",
      attended: eventAttended(state, item, learner),
      actorName: actor.name,
      actorRole: actor.role,
      detail: item.type === "edited" ? item.label || "" : "",
    });
  }
  const visits = events
    .filter((item) => item.type === "completed")
    .map((item) => ({
      ...item,
      timing: { id: "unknown", label: "Timing not set" },
    }));
  events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  visits.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { events, visits };
}

function rateFor(items, window) {
  const count = items.length;
  const activeDays = new Set(items.map((item) => item.dateKey)).size;
  const activeWeeks = new Set(
    items
      .map((item) => weekContaining(item.dateKey)?.startKey)
      .filter(Boolean),
  ).size;
  return {
    total: count,
    perWeek: activeWeeks ? count / activeWeeks : 0,
    perWeekday: count / Math.max(1, window.weekdays),
    perActiveDay: activeDays ? count / activeDays : 0,
    activeDays,
    activeWeeks,
  };
}

function targetOutcomeCounts(reviews) {
  const counts = {
    met: 0,
    partly: 0,
    "not-met": 0,
    "carry-forward": 0,
    open: 0,
  };
  for (const review of reviews) {
    if (!["returned", "print", "completed"].includes(review.status)) continue;
    for (const item of review.previousTargets || []) {
      if (!item.action) continue;
      if (counts[item.status] == null) counts.open += 1;
      else counts[item.status] += 1;
    }
  }
  return counts;
}

function latestEventByReview(events) {
  const latest = new Map();
  for (const item of [...events].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    if (item.reviewId) latest.set(item.reviewId, item);
  }
  return latest;
}

function eventTimesByReview(events, type) {
  const times = new Map();
  for (const item of events) {
    if (item.type !== type || !item.reviewId) continue;
    if (!times.has(item.reviewId)) times.set(item.reviewId, item.at);
  }
  return times;
}

function completedRouteVisits(state) {
  const visits = [];
  for (const [dateKey, route] of Object.entries(state.acceptedRoutes || {})) {
    const key = normaliseDateKey(dateKey);
    if (!key) continue;
    for (const stop of route.stops || []) {
      if (!stop?.id || isReportTestLearner(null, stop.id)) continue;
      visits.push({
        dateKey: key,
        learnerId: stop.id,
        learnerName: stop.name || "Unknown learner",
        attended: "in-person",
      });
    }
    for (const stop of route.phoneStops || []) {
      if (!stop?.id || isReportTestLearner(null, stop.id)) continue;
      visits.push({
        dateKey: key,
        learnerId: stop.id,
        learnerName: stop.name || "Unknown learner",
        attended: "phone",
      });
    }
  }
  return visits;
}

function addVisitItem(byPair, dateKey, learnerId, learnerName, attended) {
  const key = normaliseDateKey(dateKey);
  if (!key || !learnerId || isReportTestLearner(null, learnerId)) return;
  const pair = `${key}:${learnerId}`;
  const method = normaliseAttended(attended);
  const existing = byPair.get(pair);
  if (existing) {
    if (method && !existing.attended) existing.attended = method;
    return;
  }
  byPair.set(pair, {
    dateKey: key,
    learnerId,
    learnerName: learnerName || "Unknown learner",
    attended: method,
  });
}

function completedVisitItems(state) {
  const byPair = new Map();
  for (const learner of allLearners(state, (item) => isReportTestLearner(item, item.id))) {
    for (const entry of learner.reviewHistory || []) {
      addVisitItem(
        byPair,
        entry?.actualDateKey,
        learner.id,
        learner.name,
        entry?.attended,
      );
    }
  }
  for (const item of completedRouteVisits(state)) {
    addVisitItem(byPair, item.dateKey, item.learnerId, item.learnerName, item.attended);
  }
  for (const learner of allLearners(state, (item) => isReportTestLearner(item, item.id))) {
    addVisitItem(byPair, lastReviewDateKey(learner), learner.id, learner.name, "");
  }
  for (const review of state.savedReviews || []) {
    const learner = analyticsLearner(state, review.learnerId);
    addVisitItem(
      byPair,
      review.visitDateKey,
      review.learnerId,
      learner?.name,
      review.attended,
    );
  }
  for (const item of byPair.values()) {
    item.attended = reviewAttendedFor(
      analyticsLearner(state, item.learnerId),
      item.attended,
    );
  }
  return [...byPair.values()];
}

function workWeekContaining(dateKey) {
  const week = weekContaining(dateKey);
  if (!week) return null;
  return {
    startKey: week.startKey,
    endKey: toDateKey(addDays(dateFromKey(week.startKey), 4)),
  };
}

function eachWorkWeek(startKey, endKey) {
  const start = workWeekContaining(startKey);
  const end = workWeekContaining(endKey);
  if (!start || !end) return [];
  const weeks = [];
  let cursor = start.startKey;
  while (cursor <= end.startKey) {
    const week = workWeekContaining(cursor);
    weeks.push(week);
    cursor = toDateKey(addDays(dateFromKey(week.startKey), 7));
  }
  return weeks;
}

function workWeekRangeLabel(startKey, endKey) {
  const start = dateFromKey(startKey);
  const end = dateFromKey(endKey);
  if (!start || !end) return "";
  const startMonth = start.toLocaleDateString("en-GB", { month: "short" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "short" });
  if (startMonth === endMonth) {
    return `${start.getDate()}–${end.getDate()} ${endMonth}`;
  }
  return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth}`;
}

function weeklyChartWindow(rangeId, now, earliestVisit) {
  const today = toDateKey(now);
  const thisWeek = workWeekContaining(today);
  const lastWeekStart = toDateKey(addDays(dateFromKey(thisWeek.startKey), -7));
  const completed = findCompletedReportPeriod(rangeId, now, { sinceKey: earliestVisit || "" });
  if (completed) {
    return {
      startKey: workWeekContaining(completed.startKey)?.startKey || completed.startKey,
      endKey: workWeekContaining(completed.endKey)?.endKey || completed.endKey,
    };
  }
  const range = findRange(rangeId);
  let startKey = lastWeekStart;
  const firstVisitWeek = workWeekContaining(earliestVisit || lastWeekStart)?.startKey;
  if (firstVisitWeek && firstVisitWeek < startKey) {
    if (!range.weeks) startKey = firstVisitWeek;
    else {
      const rangeStart = toDateKey(addDays(dateFromKey(thisWeek.startKey), -(range.weeks - 1) * 7));
      startKey = firstVisitWeek < rangeStart ? rangeStart : firstVisitWeek;
    }
  }
  return { startKey, endKey: thisWeek.endKey };
}

export function buildReviewAnalytics(state, { rangeId = "all", now = new Date(), sinceKey = "" } = {}) {
  ensureAnalyticsState(state, now);
  const learnersById = collectLearnersById(state);
  const learners = [...learnersById.values()];
  const { events, visits } = collectEvents(state);
  const trackedFrom = sinceKey || state.analyticsSince || toDateKey(now);
  const onCycle = new Set(
    [...(state.learners || []), ...(state.followUps || [])]
      .map((item) => item?.id)
      .filter(Boolean),
  );
  const quota = dailyReviewQuota(
    learners.filter((item) => onCycle.has(item.id)),
    {
      now,
      skipToday: state.settings?.skipToday !== false,
      sinceKey: earliestReviewDateKey(state) || trackedFrom,
    },
  );
  const reportPeriod = findCompletedReportPeriod(rangeId, now);
  const window = rangeWindow(rangeId, now, trackedFrom);
  if (!reportPeriod && window.startKey < trackedFrom) {
    window.startKey = trackedFrom;
    window.weeks = weekCount(window.startKey, window.endKey);
    window.weekdays = countWeekdays(window.startKey, window.endKey);
  }
  const rangedEvents = events.filter((item) => inRange(item.dateKey, window));
  const visitItems = completedVisitItems(state);
  const earliestVisit = visitItems.map((item) => item.dateKey).filter(Boolean).sort()[0];
  const visitWindow = reportPeriod
    ? reportPeriodWindow(reportPeriod)
    : rangeWindow(rangeId, now, earliestVisit || trackedFrom);
  const done = visitItems.filter((item) => inRange(item.dateKey, visitWindow));

  const sentTimes = eventTimesByReview(rangedEvents, "sent");
  const returnedTimes = eventTimesByReview(rangedEvents, "returned");
  const printedTimes = eventTimesByReview(rangedEvents, "printed");
  const turnaround = [...returnedTimes.entries()]
    .map(([reviewId, at]) => daysBetween(sentTimes.get(reviewId), at))
    .filter((item) => item != null && item >= 0);
  const printLag = [...printedTimes.entries()]
    .map(([reviewId, at]) => daysBetween(returnedTimes.get(reviewId), at))
    .filter((item) => item != null && item >= 0);

  const latest = latestEventByReview(events);
  const waiting = [...latest.values()]
    .filter((item) => item.type === "sent")
    .map((item) => ({
      learnerName: item.learnerName,
      sentAt: item.at,
      dateKey: item.dateKey,
      days: daysBetween(item.at, now.toISOString()) ?? 0,
    }))
    .sort((a, b) => b.days - a.days);

  const weekdayCounts = Object.fromEntries(WEEKDAY_LABELS.map((label) => [label, 0]));
  for (const visit of done) {
    const date = dateFromKey(visit.dateKey);
    if (!date) continue;
    weekdayCounts[WEEKDAY_LABELS[date.getDay()]] += 1;
  }
  const todayWeekday = WEEKDAY_LABELS[now.getDay()];
  const chartWeekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
    (day) => ({
      id: day,
      title: day,
      total: weekdayCounts[day] || 0,
      kind: day === todayWeekday ? "current" : "past",
    }),
  );
  const busiestWeekday = Object.entries(weekdayCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || WEEKDAY_LABELS.indexOf(a[0]) - WEEKDAY_LABELS.indexOf(b[0]))[0];

  const todayKey = toDateKey(now);
  const thisWeek = workWeekContaining(todayKey);
  const lastWeekStart = toDateKey(addDays(dateFromKey(thisWeek.startKey), -7));
  const lastWeekEnd = toDateKey(addDays(dateFromKey(thisWeek.startKey), -3));
  const visitsThisWeek = visitItems.filter((item) => item.dateKey >= thisWeek.startKey && item.dateKey <= thisWeek.endKey).length;
  const visitsLastWeek = visitItems.filter((item) => item.dateKey >= lastWeekStart && item.dateKey <= lastWeekEnd).length;
  const chartWindow = weeklyChartWindow(rangeId, now, earliestVisit);
  const chartWeeks = eachWorkWeek(chartWindow.startKey, chartWindow.endKey)
    .map((week) => {
      const doneCount = visitItems.filter(
        (item) => item.dateKey >= week.startKey && item.dateKey <= week.endKey,
      ).length;
      const isCurrent = week.startKey === thisWeek.startKey;
      return {
        startKey: week.startKey,
        endKey: week.endKey,
        done: doneCount,
        planned: 0,
        total: doneCount,
        kind: isCurrent ? "current" : week.startKey > thisWeek.startKey ? "future" : "past",
        title: workWeekRangeLabel(week.startKey, week.endKey),
      };
    })
    .filter((week) => week.total > 0);
  const currentWeekLabel = workWeekRangeLabel(thisWeek.startKey, thisWeek.endKey);

  const due = { overdue: 0, "due-this-week": 0, "on-track": 0 };
  for (const learner of learners) {
    const priority = planningPriority(learner, now);
    if (due[priority] != null) due[priority] += 1;
    else due["on-track"] += 1;
  }

  const flowNow = REVIEW_FLOW_STEPS.map((step) => ({
    ...step,
    count: 0,
    late: 0,
  }));
  const completedNow = [];
  for (const learner of learners) {
    const current = reviewFlowState(state, learner, now).current;
    const slot = flowNow.find((step) => step.id === current?.id);
    if (!slot) continue;
    slot.count += 1;
    if (current.tone === "late") slot.late += 1;
    if (current.id === "waiting" || current.id === "archived") completedNow.push(learner);
  }

  const completedIds = new Set(
    events.filter((item) => item.type === "completed" && item.reviewId).map((item) => item.reviewId),
  );
  const trackedReviews = (state.savedReviews || []).filter((item) => completedIds.has(item.id));
  const timing = { early: 0, "on-time": 0, overdue: 0, unknown: 0 };
  for (const review of trackedReviews) {
    const visit = visits.find((item) => item.reviewId === review.id);
    const stamp = reviewTiming(visit?.dateKey, review.dateKey);
    timing[stamp.id] = (timing[stamp.id] || 0) + 1;
  }

  const sending = flowNow.find((step) => step.id === "sent")?.count || 0;
  const sentTotal = reportPeriod ? done.length : learners.length;
  const returnedTotal = reportPeriod
    ? done.length
    : Math.max(0, learners.length - sending);

  const weeks = eachWeek(visitWindow.startKey, visitWindow.endKey).map((week) => {
    const inWeek = (list) =>
      list.filter((item) => item.dateKey >= week.startKey && item.dateKey <= week.endKey).length;
    return {
      startKey: week.startKey,
      endKey: week.endKey,
      label: formatUkDateKey(week.startKey),
      sent: 0,
      returned: 0,
      printed: 0,
      done: inWeek(done),
    };
  });

  const completionRate = sentTotal
    ? done.length / sentTotal
    : null;

  const emptyBands = () =>
    Object.fromEntries(TUTOR_DUE_BANDS.map((band) => [band.id, 0]));
  const tutorRows = GTA_TUTORS.map((tutor) => ({
    name: tutor.name,
    trade: tutor.trade,
    learners: 0,
    visits: 0,
    bands: emptyBands(),
  }));
  const tutorByName = new Map(tutorRows.map((row) => [row.name, row]));
  const extraTutorRows = [];
  const noTutor = {
    name: "No tutor set",
    trade: "",
    learners: 0,
    visits: 0,
    bands: emptyBands(),
  };
  const officialTutorNames = new Set(GTA_TUTORS.map((tutor) => tutor.name));
  const customTutorNames = new Set(
    (state.settings?.customTutors || []).map((name) => canonTutorName(name)).filter(Boolean),
  );
  const ensureTutorRow = (name) => {
    const key = canonTutorName(name);
    if (!key) return noTutor;
    let row = tutorByName.get(key);
    if (row) return row;
    row = {
      name: key,
      trade: "",
      learners: 0,
      visits: 0,
      bands: emptyBands(),
    };
    tutorByName.set(key, row);
    extraTutorRows.push(row);
    return row;
  };
  for (const name of customTutorNames) ensureTutorRow(name);
  const visitsByLearner = new Map();
  for (const item of done) {
    visitsByLearner.set(item.learnerId, (visitsByLearner.get(item.learnerId) || 0) + 1);
  }
  if (reportPeriod) {
    for (const item of done) {
      const learner = analyticsLearner(state, item.learnerId);
      const row = ensureTutorRow(learner?.tutor);
      if (!row._seen) {
        row._seen = new Set();
        row.calls = 0;
        row.teams = 0;
      }
      if (!row._seen.has(item.learnerId)) {
        row._seen.add(item.learnerId);
        row.learners += 1;
      }
      if (item.attended === "phone") row.calls += 1;
      else if (item.attended === "teams") row.teams += 1;
      else row.visits += 1;
    }
  } else {
    for (const learner of learners) {
      const row = ensureTutorRow(learner.tutor);
      row.learners += 1;
      const band = tutorDueBand(state, learner, now);
      if (row.bands[band] != null) row.bands[band] += 1;
      row.visits += visitsByLearner.get(learner.id) || 0;
    }
  }
  extraTutorRows.sort((a, b) => a.name.localeCompare(b.name));
  const tutors = [...tutorRows, ...extraTutorRows, ...(noTutor.learners ? [noTutor] : [])]
    .filter((row) => {
      if (reportPeriod) return row.learners > 0 || row.visits > 0;
      if (row.name === noTutor.name) return row.learners > 0;
      return (
        officialTutorNames.has(row.name) ||
        customTutorNames.has(row.name) ||
        row.learners > 0 ||
        row.visits > 0
      );
    })
    .map(({ _seen, ...row }) => row);

  const doneByLearner = new Map();
  for (const item of done) {
    const prev = doneByLearner.get(item.learnerId);
    if (!prev || String(item.dateKey) > String(prev.dateKey)) {
      doneByLearner.set(item.learnerId, item);
    }
  }
  const visitDone = reportPeriod
    ? done
    : completedNow.map((learner) => {
        const item = doneByLearner.get(learner.id);
        const attended = reviewAttendedFor(learner, item?.attended);
        return item
          ? { ...item, attended }
          : {
              dateKey: "",
              learnerId: learner.id,
              learnerName: learner.name,
              attended,
            };
      });

  return {
    window: visitWindow,
    trackedFrom,
    learners: learners.length,
    quota,
    flowNow,
    due,
    sent: { total: sentTotal, perWeek: 0, perWeekday: 0, perActiveDay: 0, activeDays: 0, activeWeeks: 0 },
    returned: { total: returnedTotal, perWeek: 0, perWeekday: 0, perActiveDay: 0, activeDays: 0, activeWeeks: 0 },
    printed: rateFor([], visitWindow),
    visits: rateFor(visitDone.filter((item) => item.attended === "in-person"), visitWindow),
    calls: rateFor(visitDone.filter((item) => item.attended === "phone"), visitWindow),
    teams: rateFor(visitDone.filter((item) => item.attended === "teams"), visitWindow),
    completed: { total: reportPeriod ? done.length : completedNow.length },
    archived: {
      total: reportPeriod ? done.length : completedNow.length,
    },
    historicVisits: 0,
    turnaround: {
      average: average(turnaround),
      median: median(turnaround),
      count: turnaround.length,
    },
    printLag: {
      average: average(printLag),
      median: median(printLag),
      count: printLag.length,
    },
    waiting,
    weekdayCounts,
    chartWeekdays,
    busiestWeekday: busiestWeekday
      ? { label: busiestWeekday[0], count: busiestWeekday[1] }
      : null,
    thisWeek: visitsThisWeek,
    lastWeek: visitsLastWeek,
    chartWeeks,
    currentWeekLabel,
    timing,
    targets: targetOutcomeCounts(trackedReviews),
    weeks,
    recent: rangedEvents.slice(0, 100),
    completionRate,
    tutors,
  };
}

function statCard(label, value) {
  return `
    <article class="analytics-stat">
      <p class="analytics-stat-label">${escapeHtml(label)}</p>
      <p class="analytics-stat-value">${escapeHtml(value)}</p>
    </article>
  `;
}

function eventLabel(type, attended = "") {
  if (type === "sent") return "Released";
  if (type === "returned") return "Received";
  if (type === "booked") return "Booked";
  if (type === "added") return "Added";
  if (type === "restored") return "Restored";
  if (type === "archived-off") return "Archived";
  if (type === "planned") return "Planned";
  if (type === "emailed") return "Emailed";
  if (type === "downloaded") return "Downloaded";
  if (type === "edited") return "Edited";
  if (type === "arrived") return "Arrived";
  if (type === "left") return "Left";
  if (type === "visit-review") return "Review signed";
  if (type === "completed" || type === "done") {
    const method = normaliseAttended(attended);
    if (method === "phone") return "Call completed";
    if (method === "teams") return "Teams completed";
    return "Visit completed";
  }
  return type;
}

function eventPillKind(type) {
  if (
    type === "completed" ||
    type === "done" ||
    type === "sent" ||
    type === "added" ||
    type === "restored" ||
    type === "planned" ||
    type === "downloaded" ||
    type === "edited" ||
    type === "arrived" ||
    type === "left" ||
    type === "visit-review"
  ) {
    return "next";
  }
  return "overdue";
}

function logStamp(item) {
  return formatCycleStamp(item?.at) || formatUkDateKey(item?.dateKey) || "";
}

function actorRoleLabel(role) {
  if (role === "tutor") return "Tutor";
  if (role === "office") return "Administration";
  return "Reviewer";
}

function flowTone(step) {
  if (!step.count) return "idle";
  if (step.late) return "late";
  if (step.id === "waiting" || step.id === "archived") return "done";
  return "current";
}

function timingPill(kind, label) {
  return `<span class="archive-timing is-${escapeHtml(kind)}">${escapeHtml(label)}</span>`;
}

function movementListHtml(stats) {
  if (!stats.recent.length) {
    return `<p class="empty">No review log yet.</p>`;
  }
  return `
    <div class="analytics-activity">
      ${stats.recent
        .map(
          (item) => `
        <article class="analytics-row analytics-log${item.detail ? " is-edit" : ""}">
          <strong>${escapeHtml(item.learnerName)}${
            item.detail ? ` · ${escapeHtml(item.detail)}` : ""
          }</strong>
          ${timingPill(eventPillKind(item.type), eventLabel(item.type, item.attended))}
          <span class="analytics-log-who">${escapeHtml(item.actorName || DEFAULT_GTA_REVIEWER)}</span>
          <span class="analytics-log-role">${escapeHtml(actorRoleLabel(item.actorRole))}</span>
          <time datetime="${escapeHtml(item.at || item.dateKey || "")}">${escapeHtml(logStamp(item))}</time>
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function nowFlowHtml(stats) {
  return (stats.flowNow || [])
    .map(
      (step) => `
        <li class="review-flow-step is-${flowTone(step)}">
          <strong>${escapeHtml(step.label)}</strong>
          <span>${step.count}</span>
        </li>`,
    )
    .join("");
}

function periodStatsHtml(stats) {
  return `
    <div class="analytics-grid analytics-overall">
      ${statCard("Needed each day", String(stats.quota?.perDay ?? 0))}
      ${statCard("Released reviews", String(stats.sent.total))}
      ${statCard("Reviews received", String(stats.returned.total))}
      ${statCard("Reviews completed", String(stats.completed?.total || 0))}
      ${statCard("Reviews archived", String(stats.archived?.total || 0))}
      ${statCard("Visits done", String(stats.visits.total))}
      ${statCard("Calls done", String(stats.calls?.total || 0))}
      ${statCard("Teams done", String(stats.teams?.total || 0))}
    </div>
  `;
}

function reviewsBarChartHtml(rows, { currentLabel, ariaLabel } = {}) {
  const list = rows || [];
  if (!list.length) {
    return `<p class="empty">No reviews to show yet.</p>`;
  }
  const max = Math.max(1, ...list.map((row) => row.total));
  return `
    <div class="analytics-weeks" role="img" aria-label="${escapeHtml(ariaLabel || "Reviews")}">
      ${list
        .map((row) => {
          const pct = row.total ? Math.max(8, Math.round((row.total / max) * 100)) : 0;
          const current = row.kind === "current";
          return `
            <div class="analytics-week is-${escapeHtml(row.kind || "past")}">
              <span class="analytics-week-dates">${escapeHtml(row.title)}</span>
              <span class="analytics-week-mark">${
                current ? timingPill("overdue", currentLabel || "Now") : ""
              }</span>
              <div class="analytics-week-track" aria-hidden="true">
                <span class="analytics-week-fill" style="width: ${pct}%"></span>
              </div>
              <span class="analytics-week-count">${row.total}</span>
            </div>`;
        })
        .join("")}
    </div>
  `;
}

function reviewsWeekChartHtml(weeks) {
  return reviewsBarChartHtml(weeks, {
    currentLabel: "This week",
    ariaLabel: "Reviews done each Monday to Friday week",
  });
}

function reviewsWeekdayChartHtml(days) {
  return reviewsBarChartHtml(days, {
    currentLabel: "Today",
    ariaLabel: "Reviews done Monday to Friday",
  });
}

function tutorBandKind(id) {
  if (id === "need-doing") return "late";
  if (id === "coming-up") return "overdue";
  if (id === "done") return "next";
  return "next";
}

function tutorsHtml(stats) {
  const rows = stats.tutors || [];
  if (!rows.length) return `<p class="empty">No tutors to show yet.</p>`;
  return `
    <div class="analytics-tutor-list">
      ${rows
        .map((tutor) => {
          const pills = [
            ...TUTOR_DUE_BANDS.map(
              (band) =>
                `${timingPill(tutorBandKind(band.id), `${band.label} · ${tutor.bands[band.id] || 0}`)}`,
            ),
            timingPill("next", `Visits · ${tutor.visits}`),
          ].join("");
          return `
            <article class="analytics-row analytics-tutor">
              <div class="tutor-learner-row">
                <strong>${escapeHtml(tutor.name)}</strong>
                <span class="analytics-row-date">${
                  tutor.trade ? `${escapeHtml(tutor.trade)} · ` : ""
                }${tutor.learners} learner${tutor.learners === 1 ? "" : "s"}</span>
              </div>
              <div class="tutor-learner-pills">${pills}</div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function analyticsPageHtml(stats, { view = "summary", side = "reviews" } = {}) {
  if (view === "movement") return movementListHtml(stats);
  if (side === "tutors") {
    return `
      <section class="analytics-block">
        <h3 class="reviews-day-heading">Tutors · ${stats.tutors?.length || 0}</h3>
        ${tutorsHtml(stats)}
      </section>
    `;
  }

  return `
    <section class="analytics-block">
      <h3 class="reviews-day-heading">Now · ${stats.learners}</h3>
      <ol class="review-flow analytics-now-flow">${nowFlowHtml(stats)}</ol>
    </section>

    <section class="analytics-block">
      <h3 class="reviews-day-heading">Overall</h3>
      ${periodStatsHtml(stats)}
    </section>

    <div class="analytics-split">
      <section class="analytics-block">
        <h3 class="reviews-day-heading">Reviews per week</h3>
        ${reviewsWeekChartHtml(stats.chartWeeks)}
      </section>
      <section class="analytics-block">
        <h3 class="reviews-day-heading">Reviews by day</h3>
        ${reviewsWeekdayChartHtml(stats.chartWeekdays)}
      </section>
    </div>
  `;
}

export function analyticsReportHtml(stats) {
  const from = formatUkDateKey(stats.window.startKey);
  const to = formatUkDateKey(stats.window.endKey);
  const weekdayRows = (stats.chartWeekdays || [])
    .map(
      (day) =>
        `<tr><td>${escapeHtml(day.title)}</td><td>${day.total}</td></tr>`,
    )
    .join("");
  const tutorRows = (stats.tutors || [])
    .map(
      (tutor) => `
        <tr>
          <td>${escapeHtml(tutor.name)}</td>
          <td>${escapeHtml(tutor.trade || "—")}</td>
          <td>${tutor.learners}</td>
          <td>${tutor.visits || 0}</td>
          <td>${tutor.calls || 0}</td>
          <td>${tutor.teams || 0}</td>
        </tr>
      `,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Review Assistant ${escapeHtml(stats.window.label)} report</title>
    <style>
      body { font: 13px/1.45 Calibri, Arial, sans-serif; color: #111; margin: 24px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 22px 0 8px; }
      .lede { margin: 0 0 18px; color: #444; }
      .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .stats p { margin: 0; padding: 10px 12px; border: 1px solid #ccc; border-radius: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
      th { font-size: 12px; color: #444; }
      @media print { body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <h1>Review Assistant report</h1>
    <p class="lede">${escapeHtml(stats.window.label)} · ${escapeHtml(from)} to ${escapeHtml(to)}</p>
    <h2>During this period</h2>
    <div class="stats">
      <p><strong>${stats.sent.total}</strong><br>Released reviews</p>
      <p><strong>${stats.returned.total}</strong><br>Reviews received</p>
      <p><strong>${stats.completed?.total || 0}</strong><br>Reviews completed</p>
      <p><strong>${stats.archived?.total || 0}</strong><br>Reviews archived</p>
      <p><strong>${stats.visits.total}</strong><br>Visits done</p>
      <p><strong>${stats.calls?.total || 0}</strong><br>Calls done</p>
      <p><strong>${stats.teams?.total || 0}</strong><br>Teams done</p>
    </div>
    <h2>Reviews per week</h2>
    <table>
      <thead>
        <tr>
          <th>Week</th>
          <th>Reviews</th>
        </tr>
      </thead>
      <tbody>
        ${(stats.chartWeeks || [])
          .map(
            (week) =>
              `<tr><td>${escapeHtml(week.title)}</td><td>${week.total}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <h2>Reviews by day</h2>
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th>Reviews</th>
        </tr>
      </thead>
      <tbody>${weekdayRows}</tbody>
    </table>
    <h2>Tutors</h2>
    <table>
      <thead>
        <tr>
          <th>Tutor</th>
          <th>Trade</th>
          <th>Learners</th>
          <th>Visits</th>
          <th>Calls</th>
          <th>Teams</th>
        </tr>
      </thead>
      <tbody>${tutorRows || `<tr><td colspan="6">No reviews in this period.</td></tr>`}</tbody>
    </table>
  </body>
</html>`;
}

// The saved report used to print itself from an inline script. The viewer
// adds an external script instead, so the dialog still opens under script-src 'self'.
export function analyticsReportViewHtml(html) {
  const text = String(html || "");
  const tag = '<script src="/report-print.js"></script>';
  if (text.includes("/report-print.js")) return text;
  if (text.includes("</body>")) return text.replace("</body>", `${tag}</body>`);
  return `${text}${tag}`;
}
