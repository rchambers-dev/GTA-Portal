import { isTestLearner, TEST_LEARNER_ID } from "../../lib/learners.js";
import { writeLearnerAppointment } from "../../plan-locks.js";
import {
  isAwaitingActive,
  isTutorBlocked,
  lastReviewDateKey,
  normaliseAppointment,
  normaliseDateKey,
  planningPriority,
  readAppointment,
  startOfLocalDay,
  toDateKey,
  weekContaining,
} from "../../planner.js";
import { currentCyclePack, stampCycleBooked } from "../../reviews.js";

let hooks = null;

function reportUnbound() {
  console.error("Failed to run the planner:", "planner callbacks are not bound.");
}

function callHook(name, args, fallback) {
  const fn = hooks?.[name];
  if (typeof fn !== "function") {
    reportUnbound();
    return fallback;
  }
  return fn(...args);
}

function unboundState() {
  return new Proxy(
    {},
    {
      get() {
        reportUnbound();
        return undefined;
      },
      set() {
        reportUnbound();
        return true;
      },
    },
  );
}

// Placeholder until bindPlannerStatus. It must not be spread or serialised.
// After bind, this binding is the real app state object.
export let state = unboundState();

export function catalogueLearners(...args) {
  return callHook("catalogueLearners", args, []);
}

export function reviewDoneDateKeysForLearner(...args) {
  const fn = hooks?.reviewDoneDateKeysForLearner;
  if (typeof fn !== "function") {
    reportUnbound();
    return new Set();
  }
  return fn(...args);
}

export function rosterLearnerFromRecord(...args) {
  return callHook("rosterLearnerFromRecord", args, null);
}

export function clearAwaitingForLearner(...args) {
  return callHook("clearAwaitingForLearner", args, undefined);
}

export function touchLearner(...args) {
  return callHook("touchLearner", args, undefined);
}

export function bindPlannerStatus(next) {
  hooks = next || null;
  state = next?.state || unboundState();
}

function isLockedOnOrAfter(learner, fromKey) {
  const booked = normaliseAppointment(learner?.appointment)?.dateKey;
  if (booked && booked >= fromKey) return true;
  const id = learner?.id;
  if (!id) return false;
  const heldDate = (dateKey) => Boolean(dateKey && dateKey >= fromKey);
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    if (heldDate(dateKey) && (ids || []).includes(id)) return true;
  }
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    if (heldDate(dateKey) && (ids || []).includes(id)) return true;
  }
  for (const [dateKey, route] of Object.entries(state.acceptedRoutes || {})) {
    if (
      heldDate(dateKey) &&
      [...(route?.stops || []), ...(route?.phoneStops || [])].some(
        (stop) => stop.id === id,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function isLockedOnUpcomingPlan(learner, now = new Date()) {
  if (normaliseAppointment(learner?.appointment)) return true;
  const todayKey = toDateKey(startOfLocalDay(now));
  const weekStart = weekContaining(todayKey)?.startKey || todayKey;
  return isLockedOnOrAfter(learner, weekStart);
}

export function completedRouteIds(dateKey) {
  const entry = state.completedRoutes?.[dateKey];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : entry.ids || [];
}

function isRouteCompletedForLearner(learner, dateKey) {
  const id = learner?.id;
  if (!id || !dateKey) return false;
  return completedRouteIds(dateKey).includes(id);
}

export function markRouteCompleted(dateKey, ids, at = new Date().toISOString()) {
  if (!dateKey) return;
  if (!state.completedRoutes) state.completedRoutes = {};
  const prev = state.completedRoutes[dateKey];
  const prevIds = Array.isArray(prev) ? prev : prev?.ids || [];
  const nextIds = [...new Set([...prevIds, ...(ids || [])].filter(Boolean))];
  if (!nextIds.length) return;
  state.completedRoutes[dateKey] = {
    at: prev?.at || at,
    ids: nextIds,
  };
}

export function backfillCompletedRouteMarks(todayKey) {
  const weekStart = weekContaining(todayKey)?.startKey || todayKey;
  const byDate = new Map();
  const add = (dateKey, id) => {
    const key = normaliseDateKey(dateKey);
    if (!key || key >= weekStart || key === "2026-11-02" || !id) return;
    if (id === TEST_LEARNER_ID) return;
    const learner = catalogueLearners().find((item) => item.id === id);
    if (learner && isTestLearner(learner)) return;
    if (!byDate.has(key)) byDate.set(key, new Set());
    byDate.get(key).add(id);
  };
  for (const learner of catalogueLearners()) {
    if (!learner?.id || isTestLearner(learner)) continue;
    for (const key of reviewDoneDateKeysForLearner(learner)) add(key, learner.id);
  }
  for (const review of state.savedReviews || []) add(review.visitDateKey, review.learnerId);
  for (const [dateKey, route] of Object.entries(state.acceptedRoutes || {})) {
    for (const stop of [...(route?.stops || []), ...(route?.phoneStops || [])]) {
      add(dateKey, stop?.id);
    }
  }
  for (const [dateKey, ids] of byDate) {
    const existing = new Set(completedRouteIds(dateKey));
    const missing = [...ids].filter((id) => !existing.has(id));
    if (missing.length) markRouteCompleted(dateKey, missing);
  }
}

export function isPaperVisitDoneOnCompletedRoute(learner, now = new Date()) {
  const id = learner?.id;
  if (!id) return false;
  const todayKey = toDateKey(startOfLocalDay(now));
  const weekStart = weekContaining(todayKey)?.startKey || todayKey;
  for (const [dateKey, entry] of Object.entries(state.completedRoutes || {})) {
    if (!dateKey || dateKey < weekStart) continue;
    const ids = Array.isArray(entry) ? entry : entry?.ids || [];
    if (ids.includes(id)) return true;
  }
  return false;
}

function isVisitConfirmedOnOrAfter(learner, fromKey) {
  const id = learner?.id;
  const booked = readAppointment(learner?.appointment)?.dateKey;
  if (booked && booked >= fromKey && !isRouteCompletedForLearner(learner, booked)) {
    return true;
  }
  if (!id) return false;
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    if (!dateKey || dateKey < fromKey || !(ids || []).includes(id)) continue;
    if (isRouteCompletedForLearner(learner, dateKey)) continue;
    return true;
  }
  return false;
}

export function isVisitConfirmed(learner, now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  const weekStart = weekContaining(todayKey)?.startKey || todayKey;
  return isVisitConfirmedOnOrAfter(learner, weekStart);
}

function isBookedFromToday(learner, now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  return isVisitConfirmedOnOrAfter(learner, todayKey);
}

export function isReleasedToTutor(learner) {
  const pack = currentCyclePack(state, learner);
  return pack?.status === "tutor";
}

export function hasOpenUnbookedReview(learner) {
  const pack = currentCyclePack(state, learner);
  if (!pack || pack.status === "completed" || pack.status === "tutor") return false;
  return ["reviewer", "returned", "print"].includes(pack.status);
}

function hasCompletedCurrentReview(learner, now = new Date()) {
  if (hasOpenUnbookedReview(learner)) return false;
  const pack = currentCyclePack(state, learner);
  if (pack?.status === "completed") return true;
  const priority = planningPriority(learner, now);
  return Boolean(lastReviewDateKey(learner) && priority === "on-track");
}

export function plannerRosterLearners(now = new Date()) {
  const seen = new Set();
  const rows = [];
  for (const learner of state.learners || []) {
    if (!learner?.id || seen.has(learner.id) || !includeLearnerInPlanner(learner)) continue;
    seen.add(learner.id);
    rows.push(learner);
  }
  for (const item of state.followUps || []) {
    if (!item?.id || seen.has(item.id)) continue;
    if (!isLockedOnUpcomingPlan(item, now) && !isPaperVisitDoneOnCompletedRoute(item, now)) {
      continue;
    }
    seen.add(item.id);
    rows.push(rosterLearnerFromRecord(item));
  }
  return rows;
}

function hasUpcomingBooking(learner, now = new Date()) {
  const booked = normaliseAppointment(learner?.appointment)?.dateKey;
  return Boolean(booked && booked >= toDateKey(startOfLocalDay(now)));
}

export function activeAwaitingDateKey(learner, now = new Date()) {
  const id = learner?.id;
  if (!id || hasUpcomingBooking(learner, now)) return "";
  const todayKey = toDateKey(startOfLocalDay(now));
  let found = "";
  for (const [dateKey, entries] of Object.entries(state.awaitingReply || {})) {
    if (!dateKey || dateKey < todayKey) continue;
    if (!isAwaitingActive(entries?.[id], dateKey, now)) continue;
    if (!found || dateKey < found) found = dateKey;
  }
  return found;
}

export function planBookingLearners(now = new Date()) {
  const seen = new Set();
  const rows = [];
  for (const learner of [...(state.learners || []), ...(state.followUps || [])]) {
    if (!learner?.id || seen.has(learner.id) || !needsPlanBooking(learner, now)) continue;
    if (activeAwaitingDateKey(learner, now)) continue;
    seen.add(learner.id);
    rows.push(learner);
  }
  return rows;
}

export function stayPinnedOnDay(id, dateKey, now = new Date()) {
  if (!id || !dateKey) return false;
  if ((state.verifiedByDate?.[dateKey] || []).includes(id)) return true;
  const learner =
    (state.learners || []).find((item) => item.id === id) ||
    (state.followUps || []).find((item) => item.id === id);
  if (normaliseAppointment(learner?.appointment)?.dateKey === dateKey) return true;
  return isAwaitingActive(state.awaitingReply?.[dateKey]?.[id], dateKey, now);
}

export function isVerifiedFromToday(learnerOrId, now = new Date()) {
  const id = typeof learnerOrId === "string" ? learnerOrId : learnerOrId?.id;
  if (!id) return false;
  const todayKey = toDateKey(startOfLocalDay(now));
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    if (dateKey >= todayKey && (ids || []).includes(id)) return true;
  }
  return false;
}

function paperBookedLearners(now = new Date()) {
  const seen = new Set();
  const rows = [];
  for (const learner of [...(state.learners || []), ...(state.followUps || [])]) {
    if (!learner?.id || seen.has(learner.id)) continue;
    if (isTestLearner(learner)) continue;
    if (activeAwaitingDateKey(learner, now) && !isVerifiedFromToday(learner, now)) continue;
    if (!isBookedFromToday(learner, now)) continue;
    if (isPaperVisitDoneOnCompletedRoute(learner, now)) continue;
    seen.add(learner.id);
    rows.push(learner);
  }
  return rows;
}

function paperAwaitingLearners(now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  const seen = new Set();
  const rows = [];
  for (const [dateKey, entries] of Object.entries(state.awaitingReply || {})) {
    if (!dateKey || dateKey < todayKey) continue;
    for (const [id, entry] of Object.entries(entries || {})) {
      if (!id || seen.has(id) || !isAwaitingActive(entry, dateKey, now)) continue;
      const learner =
        (state.learners || []).find((item) => item.id === id) ||
        (state.followUps || []).find((item) => item.id === id);
      if (!learner || isTestLearner(learner) || hasUpcomingBooking(learner, now)) continue;
      if (isVerifiedFromToday(id, now)) continue;
      seen.add(id);
      rows.push(learner);
    }
  }
  return rows;
}

export function reviewWaitingLearners(now = new Date()) {
  const taken = new Set(
    [...planBookingLearners(now), ...paperBookedLearners(now), ...paperAwaitingLearners(now)].map(
      (learner) => learner.id,
    ),
  );
  const rows = [];
  for (const learner of [
    ...(state.learners || []),
    ...(state.followUps || []),
    ...(state.archive || []),
  ]) {
    if (!learner?.id || taken.has(learner.id) || isTestLearner(learner)) continue;
    taken.add(learner.id);
    rows.push(learner);
  }
  return rows;
}

export function planPaperSplit(now = new Date()) {
  const unbooked = planBookingLearners(now);
  const booked = paperBookedLearners(now);
  const awaiting = paperAwaitingLearners(now);
  const waiting = reviewWaitingLearners(now);
  return {
    unbooked,
    booked,
    awaiting,
    waiting,
    total: unbooked.length + booked.length + awaiting.length + waiting.length,
  };
}

export function needsPlanBooking(learner, now = new Date()) {
  if (!learner || isTestLearner(learner)) return false;
  if (isVisitConfirmed(learner, now)) return false;
  if (isPaperVisitDoneOnCompletedRoute(learner, now)) return false;
  if (
    isTutorBlocked(learner, state.settings.blockedTutors) &&
    !isHeldOnPlan(learner)
  ) {
    return false;
  }
  if (isReleasedToTutor(learner)) return false;
  if (learner.heldFromPlan) return false;
  if (hasOpenUnbookedReview(learner)) return true;
  if (hasCompletedCurrentReview(learner, now)) return false;
  return false;
}

function firstPlanDateFromToday(map, id, todayKey, matches) {
  let found = "";
  for (const [dateKey, value] of Object.entries(map || {})) {
    if (!dateKey || dateKey < todayKey || !matches(value, id)) continue;
    if (!found || dateKey < found) found = dateKey;
  }
  return found;
}

export function planPlacementStatus(learner, now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  const appointment = normaliseAppointment(learner?.appointment);
  if (appointment) return { kind: "booked", dateKey: appointment.dateKey };
  const awaitingKey = activeAwaitingDateKey(learner, now);
  if (awaitingKey) return { kind: "locked", dateKey: awaitingKey };
  const acceptedKey = firstPlanDateFromToday(
    state.acceptedRoutes,
    learner?.id,
    todayKey,
    (item, id) => item?.stops?.some((stop) => stop.id === id),
  );
  if (acceptedKey) return { kind: "locked", dateKey: acceptedKey };
  const verifiedKey = firstPlanDateFromToday(
    state.verifiedByDate,
    learner?.id,
    todayKey,
    (ids, id) => (ids || []).includes(id),
  );
  if (verifiedKey) return { kind: "verified", dateKey: verifiedKey };
  const pinKey = firstPlanDateFromToday(
    state.pinnedRoutes,
    learner?.id,
    todayKey,
    (ids, id) => (ids || []).includes(id),
  );
  if (pinKey) return { kind: "round", dateKey: pinKey };
  return { kind: "queue", dateKey: "" };
}

function isHeldOnPlan(learner, now = new Date()) {
  const kind = planPlacementStatus(learner, now).kind;
  return kind === "booked" || kind === "locked" || kind === "verified" || kind === "round";
}

export function promoteToBookFollowUps() {
  let moved = false;
  const want = new Set(planBookingLearners().map((learner) => learner.id));
  for (const item of [...(state.followUps || [])]) {
    if (!want.has(item.id)) continue;
    if (state.learners.some((learner) => learner.id === item.id)) continue;
    state.learners.push(rosterLearnerFromRecord(item));
    state.followUps = (state.followUps || []).filter((row) => row.id !== item.id);
    moved = true;
  }
  return moved;
}

export function takeFilledLearnersOffOtherDays(dateKey, extraIds) {
  if (!dateKey || !extraIds?.length) return false;
  const extras = new Set(extraIds);
  let changed = false;
  const keepOnOtherDay = (id, otherKey) => {
    if (!extras.has(id)) return true;
    if ((state.verifiedByDate?.[otherKey] || []).includes(id)) return true;
    if (state.acceptedRoutes?.[otherKey]) return true;
    const learner = state.learners.find((item) => item.id === id);
    return normaliseAppointment(learner?.appointment)?.dateKey === otherKey;
  };
  for (const [otherKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    if (otherKey === dateKey) continue;
    const next = (ids || []).filter((id) => keepOnOtherDay(id, otherKey));
    if (next.length === (ids || []).length) continue;
    if (next.length) state.pinnedRoutes[otherKey] = next;
    else delete state.pinnedRoutes[otherKey];
    changed = true;
  }
  for (const [otherKey, times] of Object.entries(state.frozenTimes || {})) {
    if (otherKey === dateKey || state.acceptedRoutes?.[otherKey]) continue;
    for (const id of extraIds) {
      if (!times?.[id] || keepOnOtherDay(id, otherKey)) continue;
      delete times[id];
      changed = true;
    }
    if (!Object.keys(times || {}).length) delete state.frozenTimes[otherKey];
  }
  return changed;
}

export function restoreAppointmentsFromFrozen(now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  let changed = false;
  for (const [dateKey, times] of Object.entries(state.frozenTimes || {})) {
    if (!dateKey || dateKey < todayKey) continue;
    for (const [id, freeze] of Object.entries(times || {})) {
      if (freeze?.arrive == null) continue;
      const learner =
        state.learners.find((item) => item.id === id) ||
        (state.followUps || []).find((item) => item.id === id);
      if (!learner || normaliseAppointment(learner.appointment)) continue;
      if (!freeze.booked) continue;
      if (learner.appointmentClearedAt) {
        times[id] = { ...freeze, booked: false };
        changed = true;
        continue;
      }
      writeLearnerAppointment(
        learner,
        normaliseAppointment({
          dateKey,
          arriveMinutes: freeze.arrive,
        }),
      );
      clearAwaitingForLearner(learner.id);
      if (!learner.appointment) continue;
      times[id] = { ...freeze, booked: true };
      touchLearner(learner);
      stampCycleBooked(state, learner);
      changed = true;
    }
  }
  return changed;
}

export function clearUnbookedFrozenTimes(dateKey) {
  const times = state.frozenTimes?.[dateKey];
  if (!dateKey || !times) return false;
  const verified = new Set(state.verifiedByDate?.[dateKey] || []);
  let changed = false;
  for (const id of Object.keys(times)) {
    const learner = state.learners.find((item) => item.id === id);
    const booked =
      times[id]?.booked ||
      normaliseAppointment(learner?.appointment)?.dateKey === dateKey;
    if (booked || verified.has(id)) continue;
    delete times[id];
    changed = true;
  }
  if (!Object.keys(times).length) delete state.frozenTimes[dateKey];
  return changed;
}

export function dropBlockedTutorsFromLoosePlan() {
  const blocked = state.settings.blockedTutors || [];
  const keepId = (id) => {
    const learner = state.learners.find((item) => item.id === id);
    return !learner || !isTutorBlocked(learner, blocked) || isHeldOnPlan(learner);
  };
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    const next = (ids || []).filter(keepId);
    if (next.length) state.pinnedRoutes[dateKey] = next;
    else delete state.pinnedRoutes[dateKey];
  }
  for (const [dateKey, map] of Object.entries(state.frozenTimes || {})) {
    for (const id of Object.keys(map || {})) {
      if (!keepId(id)) delete map[id];
    }
    if (!Object.keys(map || {}).length) delete state.frozenTimes[dateKey];
  }
}

export function includeLearnerInPlanner(learner) {
  if (isTestLearner(learner)) return false;
  return isHeldOnPlan(learner) || !isTutorBlocked(learner, state.settings.blockedTutors);
}
