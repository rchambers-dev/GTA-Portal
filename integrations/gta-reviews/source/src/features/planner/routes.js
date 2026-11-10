import {
  uiState,
} from "../../app/ui-state.js";
import {
  scheduleStateSave,
} from "../../app/persist.js";
import {
  dayDetail,
  leftoverEl,
  planButton,
  routeActions,
} from "../../app/dom.js";
import {
  escapeHtml,
} from "../../lib/html.js";
import {
  formatDateKeyLabel,
  routeEmailStatus,
  routeMailtoHref,
} from "../../lib/format.js";
import {
  writeLearnerAppointment,
} from "../../plan-locks.js";
import {
  attendedFromStopKind,
  dateFromKey,
  formatShortDate,
  formatTime,
  isAwaitingActive,
  lastReviewDateKey,
  learnerProfileFrom,
  nextReviewDateKey,
  normaliseAppointment,
  normaliseCompany,
  normalisePhone,
  phoneReviewDay,
  planWeek,
  planningSignature,
  formatDuration,
  recordReview,
  snapshotDay,
  startOfLocalDay,
  toDateKey,
  verifiedIds,
  weekdayName,
} from "../../planner.js";
import {
  drivingMatrix,
  geocodePostcodes,
  googleMapsDirUrl,
  isLikelyUkPostcode,
  normalisePostcode,
} from "../../geo.js";
import {
  createSavedReview,
  currentCyclePack,
  setReviewHolder,
  stampCycleCompleted,
  updateSavedReview,
} from "../../reviews.js";
import {
  catchUpBeforeEdit as catchUpStateBeforeEdit,
  claimSessionStamp,
} from "../../storage.js";
import {
  state,
} from "./status.js";
import {
  clearUnbookedFrozenTimes,
  completedRouteIds,
  dropBlockedTutorsFromLoosePlan,
  hasOpenUnbookedReview,
  includeLearnerInPlanner,
  isLockedOnUpcomingPlan,
  isPaperVisitDoneOnCompletedRoute,
  isVerifiedFromToday,
  markRouteCompleted,
  planBookingLearners,
  plannerRosterLearners,
  promoteToBookFollowUps,
  restoreAppointmentsFromFrozen,
  stayPinnedOnDay,
  takeFilledLearnersOffOtherDays,
  touchLearner,
} from "./status.js";
import {
  learnerNoteText,
} from "./notes.js";

export function addLearnerToFollowUp(...args) {
  return callHook("addLearnerToFollowUp", args, undefined);
}
export function dedupePlacedLearners(...args) {
  return callHook("dedupePlacedLearners", args, false);
}
export function dropLearnerFromRoster(...args) {
  return callHook("dropLearnerFromRoster", args, undefined);
}
export function findSelectedPlanDay(...args) {
  return callHook("findSelectedPlanDay", args, null);
}
export function learnerPlaceMeta(...args) {
  return callHook("learnerPlaceMeta", args, "");
}
export function learnerTutorName(...args) {
  return callHook("learnerTutorName", args, undefined);
}
export function logAction(...args) {
  return callHook("logAction", args, undefined);
}
export function planDayLogLabel(...args) {
  return callHook("planDayLogLabel", args, "");
}
export function readSettingsIntoState(...args) {
  return callHook("readSettingsIntoState", args, undefined);
}
export function refreshRosterAfterDrop(...args) {
  return callHook("refreshRosterAfterDrop", args, undefined);
}
export function rememberSelectedDay(...args) {
  return callHook("rememberSelectedDay", args, undefined);
}
export function snapHoldMinutes(...args) {
  return callHook("snapHoldMinutes", args, 0);
}
export function stopIsValidated(...args) {
  return callHook("stopIsValidated", args, false);
}
export function syncAppointmentPins(...args) {
  return callHook("syncAppointmentPins", args, false);
}

export function findEditableLearner(...args) {
  return callHook("findEditableLearner", args, null);
}
export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}
export function currentPlannerSettings(...args) {
  return callHook("currentPlannerSettings", args, {});
}
export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}
export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}
export function renderPlan(...args) {
  return callHook("renderPlan", args, undefined);
}
export function reviewsDoneOnDate(...args) {
  return callHook("reviewsDoneOnDate", args, []);
}

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

export function bindPlannerRoutes(next) {
  hooks = next || null;
}

export async function planTheWeek({
  resetSelection = true,
  freshPack = false,
  fillGaps = false,
  render = true,
} = {}) {
  if (!state.learners.length) {
    setStatus("Add at least one learner first.");
    return false;
  }

  if (freshPack) {
    for (const dateKey of Object.keys(state.pinnedRoutes || {})) {
      if (!state.acceptedRoutes[dateKey]) delete state.pinnedRoutes[dateKey];
    }
  }

  readSettingsIntoState();
  dropBlockedTutorsFromLoosePlan();
  if (fillGaps && promoteToBookFollowUps()) scheduleStateSave();
  if (!isLikelyUkPostcode(state.settings.officePostcode)) {
    setStatus("Office postcode does not look valid.");
    return false;
  }

  planButton.disabled = true;
  setStatus("");
  leftoverEl.hidden = true;

  const settings = currentPlannerSettings();
  const plannerLearners = plannerRosterLearners();
  const allPostcodes = [
    settings.officePostcode,
    ...plannerLearners.map((learner) => learner.postcode),
  ];
  const geo = await geocodePostcodes(allPostcodes);
  const unlocatedLearners = [];

  const officeGeo = geo[normalisePostcode(settings.officePostcode)];
  if (!officeGeo) {
    planButton.disabled = false;
    setStatus(`Could not find the office postcode (${settings.officePostcode}).`);
    return false;
  }

  const locatedLearners = plannerLearners
    .filter((learner) => includeLearnerInPlanner(learner) || isLockedOnUpcomingPlan(learner) || isPaperVisitDoneOnCompletedRoute(learner))
    .map((learner) => {
      const point = geo[normalisePostcode(learner.postcode)];
      if (!point) {
        unlocatedLearners.push(learner);
        return null;
      }
      return {
        ...learner,
        postcode: point.formatted,
        lat: point.lat,
        lon: point.lon,
      };
    })
    .filter(Boolean);

  const points = [
    { lat: officeGeo.lat, lon: officeGeo.lon },
    ...locatedLearners.map((learner) => ({ lat: learner.lat, lon: learner.lon })),
  ];

  locatedLearners.forEach((learner, index) => {
    learner.matrixIndex = index + 1;
  });

  const matrix = await drivingMatrix(points);
  const office = {
    postcode: officeGeo.formatted,
    lat: officeGeo.lat,
    lon: officeGeo.lon,
  };
  uiState.planCache = {
    locatedLearners,
    unlocatedLearners,
    matrix,
    office,
    travelSource: matrix.source,
  };
  const fillDateKey =
    fillGaps ? uiState.selectedDateKey || state.settings.workingDates?.[0] || "" : "";
  const previousFillIds = fillDateKey
    ? [...(state.pinnedRoutes?.[fillDateKey] || [])]
    : [];
  applyCurrentPlan({
    resetSelection,
    updateStatus: false,
    refreshMap: true,
    fillGaps,
    render,
  });
  if (fillGaps) {
    applyCurrentPlan({
      resetSelection: false,
      updateStatus: false,
      refreshMap: true,
      fillGaps: true,
      relaxPinTimes: true,
      render,
    });
  }
  planButton.disabled = false;
  if (fillGaps && !unlocatedLearners.length) {
    const day = findSelectedPlanDay(uiState.planResult?.days);
    const count = day?.stops?.length || 0;
    const added = (state.pinnedRoutes?.[fillDateKey] || []).filter(
      (id) => !previousFillIds.includes(id),
    ).length;
    const label = day?.dateKey ? formatDateKeyLabel(day.dateKey) : "that day";
    const back = day?.returnArrive != null ? formatTime(day.returnArrive) : "";
    setStatus(
      added
        ? `Added ${added} visit${added === 1 ? "" : "s"} to ${label}.${back ? ` Back at the office ${back}.` : ""}`
        : count
          ? `${label} is already as full as the drive time and 16:45 return allow.`
          : "No visits fitted that day.",
    );
  }
  return true;
}

export function expiredAwaitingCount(now = new Date()) {
  let count = 0;
  for (const [dateKey, entries] of Object.entries(state.awaitingReply || {})) {
    for (const entry of Object.values(entries || {})) {
      if (entry && !isAwaitingActive(entry, dateKey, now)) count += 1;
    }
  }
  return count;
}

export function signatureExtras(now = new Date()) {
  return `${JSON.stringify(state.verifiedByDate)}|${JSON.stringify(state.callAnchors)}|${JSON.stringify(state.pinnedRoutes)}|${JSON.stringify(state.frozenTimes)}|${JSON.stringify(state.excludedFromDate)}|${JSON.stringify(state.awaitingReply || {})}|expired:${expiredAwaitingCount(now)}|${JSON.stringify(
    state.learners.map((learner) => learner.appointment || null),
  )}|${JSON.stringify(
    state.learners.map((learner) => learner.employer || null),
  )}`;
}

export function hydrateLocatedLearners() {
  if (!uiState.planCache) return { locatedLearners: [], unlocatedLearners: [] };
  const byId = new Map(plannerRosterLearners().map((item) => [item.id, item]));
  const keepPlannerLearner = (learner) =>
    Boolean(
      learner &&
        (includeLearnerInPlanner(learner) ||
          isLockedOnUpcomingPlan(learner) ||
          isPaperVisitDoneOnCompletedRoute(learner)),
    );
  const locatedLearners = [];
  const seen = new Set();
  for (const located of uiState.planCache.locatedLearners || []) {
    const current = byId.get(located.id);
    if (!keepPlannerLearner(current)) continue;
    locatedLearners.push({
      ...located,
      ...current,
      lat: located.lat,
      lon: located.lon,
      matrixIndex: located.matrixIndex,
      postcode: current.postcode || located.postcode,
    });
    seen.add(located.id);
  }
  for (const route of Object.values(state.acceptedRoutes || {})) {
    for (const stop of [...(route.stops || []), ...(route.phoneStops || [])]) {
      if (!stop?.id || seen.has(stop.id) || stop.lat == null || stop.lon == null) continue;
      const current = byId.get(stop.id);
      if (!keepPlannerLearner(current)) continue;
      locatedLearners.push({
        ...current,
        lat: stop.lat,
        lon: stop.lon,
        matrixIndex: stop.matrixIndex,
        postcode: current.postcode || stop.postcode,
      });
      seen.add(stop.id);
    }
  }
  uiState.planCache.locatedLearners = locatedLearners;
  const unlocatedLearners = (uiState.planCache.unlocatedLearners || []).filter((learner) =>
    byId.has(learner.id),
  );
  uiState.planCache.unlocatedLearners = unlocatedLearners;
  return { locatedLearners, unlocatedLearners };
}

export function applyCurrentPlan({
  resetSelection = false,
  updateStatus = false,
  refreshMap = true,
  fillGaps = false,
  relaxPinTimes = false,
  render = true,
} = {}) {
  if (!uiState.planCache) return;

  const now = new Date();
  const fillDateKey =
    fillGaps || relaxPinTimes
      ? uiState.selectedDateKey || state.settings.workingDates?.[0] || ""
      : "";
  const settings = {
    ...currentPlannerSettings(),
    fillGaps,
    relaxPinTimes,
    fillDateKey,
    fillLearnerIds: fillGaps
      ? planBookingLearners(now).map((learner) => learner.id)
      : undefined,
  };
  if (
    restoreAppointmentsFromFrozen(now) ||
    syncAppointmentPins(now) ||
    dedupePlacedLearners(now)
  ) {
    scheduleStateSave();
  }
  for (const dateKey of Object.keys(state.frozenTimes || {})) {
    if (state.acceptedRoutes?.[dateKey]) continue;
    if (clearUnbookedFrozenTimes(dateKey)) scheduleStateSave();
  }
  const { locatedLearners, unlocatedLearners } = hydrateLocatedLearners();
  const result = planWeek(
    locatedLearners,
    uiState.planCache.matrix,
    0,
    settings,
    now,
    state.acceptedRoutes,
    state.verifiedByDate,
    state.callAnchors,
    state.pinnedRoutes,
    state.frozenTimes,
    state.excludedFromDate,
  );

  const previousStops =
    findSelectedPlanDay(uiState.planResult?.days)
      ?.stops.map((stop) => stop.id)
      .join(",") || "";

  uiState.planResult = {
    ...result,
    office: uiState.planCache.office,
    settings,
    travelSource: uiState.planCache.travelSource,
    unlocated: unlocatedLearners,
  };

  if (
    resetSelection ||
    !result.days.some((day) =>
      uiState.selectedDateKey
        ? day.dateKey === uiState.selectedDateKey
        : day.day === uiState.selectedDay,
    )
  ) {
    const pick =
      result.days.find((day) => day.isTomorrow && (day.available || day.accepted)) ||
      result.days.find((day) => day.isToday && (day.available || day.accepted)) ||
      result.days.find((day) => day.accepted && hasDayWork(day)) ||
      result.days.find((day) => day.available && hasDayWork(day)) ||
      result.days.find((day) => day.available) ||
      result.days[0];
    rememberSelectedDay(pick);
  }

  const todayKey = toDateKey(now);
  const keep = new Set(result.days.map((day) => day.dateKey));
  const retainDate = (dateKey) =>
    Boolean(
      dateKey &&
        (dateKey >= todayKey ||
          reviewsDoneOnDate(dateKey).length ||
          state.acceptedRoutes?.[dateKey]?.stops?.length ||
          (state.pinnedRoutes?.[dateKey] || []).length ||
          (state.verifiedByDate?.[dateKey] || []).length),
    );
  for (const learner of state.learners) {
    const booked = normaliseAppointment(learner.appointment)?.dateKey;
    if (retainDate(booked)) keep.add(booked);
  }
  for (const bucket of [
    state.acceptedRoutes,
    state.verifiedByDate,
    state.callAnchors,
    state.pinnedRoutes,
    state.frozenTimes,
    state.excludedFromDate,
    state.awaitingReply,
  ]) {
    for (const dateKey of Object.keys(bucket || {})) {
      if (retainDate(dateKey)) keep.add(dateKey);
    }
  }
  let pruned = false;
  for (const dateKey of Object.keys(state.acceptedRoutes)) {
    if (!keep.has(dateKey)) {
      delete state.acceptedRoutes[dateKey];
      pruned = true;
    }
  }
  for (const dateKey of Object.keys(state.verifiedByDate)) {
    if (!keep.has(dateKey)) {
      delete state.verifiedByDate[dateKey];
      pruned = true;
    }
  }
  for (const dateKey of Object.keys(state.callAnchors)) {
    if (!keep.has(dateKey)) {
      delete state.callAnchors[dateKey];
      pruned = true;
    }
  }
  for (const dateKey of Object.keys(state.pinnedRoutes)) {
    if (!keep.has(dateKey)) {
      delete state.pinnedRoutes[dateKey];
      pruned = true;
    }
  }
  for (const dateKey of Object.keys(state.frozenTimes || {})) {
    if (!keep.has(dateKey)) {
      delete state.frozenTimes[dateKey];
      pruned = true;
    }
  }
  for (const dateKey of Object.keys(state.excludedFromDate || {})) {
    if (!keep.has(dateKey)) {
      delete state.excludedFromDate[dateKey];
      pruned = true;
    }
  }
  for (const dateKey of Object.keys(state.awaitingReply || {})) {
    if (!keep.has(dateKey)) {
      delete state.awaitingReply[dateKey];
      pruned = true;
    }
  }
  if (fillGaps && settleExpiredAwaiting(result.days, now)) pruned = true;
  if (captureFrozenTimes(result.days)) pruned = true;
  if (fillGaps) {
    for (const day of result.days) {
      if (!day.dateKey || !(day.available || day.accepted) || !day.stops.length) {
        continue;
      }
      if (day.accepted) continue;
      const ids = day.stops.map((stop) => stop.id);
      const previous = state.pinnedRoutes[day.dateKey] || [];
      const extra = previous.length
        ? ids.filter((id) => !previous.includes(id))
        : ids;
      const nextPins = [...ids];
      for (const id of previous) {
        if (nextPins.includes(id) || !stayPinnedOnDay(id, day.dateKey, now)) continue;
        nextPins.push(id);
      }
      if (nextPins.join(",") !== previous.join(",")) {
        state.pinnedRoutes[day.dateKey] = nextPins;
        claimSessionStamp(state);
        pruned = true;
      }
      if (clearUnbookedFrozenTimes(day.dateKey)) pruned = true;
      if (takeFilledLearnersOffOtherDays(day.dateKey, extra)) pruned = true;
    }
  }
  const today = result.days.find((day) => day.isToday);
  if (today?.callAnchor != null && state.callAnchors[today.dateKey] == null) {
    state.callAnchors[today.dateKey] = today.callAnchor;
    pruned = true;
  }
  if (pruned) scheduleStateSave(fillGaps);

  uiState.lastSignature = planningSignature(now, settings, signatureExtras(now));

  const nextStops =
    findSelectedPlanDay(result.days)
      ?.stops.map((stop) => stop.id)
      .join(",") || "";

  if (render) renderPlan({ refreshMap: refreshMap || previousStops !== nextStops });
  if (updateStatus) setStatus("");
}

function captureFrozenTimes(days) {
  if (!state.frozenTimes) state.frozenTimes = {};
  let changed = false;
  for (const day of days || []) {
    if (!day.dateKey || !day.stops?.length) continue;
    const verified = verifiedIds(state.verifiedByDate, day.dateKey);
    if (!state.frozenTimes[day.dateKey]) state.frozenTimes[day.dateKey] = {};
    for (const stop of day.stops) {
      const appointed =
        normaliseAppointment(
          state.learners.find((item) => item.id === stop.id)?.appointment,
        )?.dateKey === day.dateKey;
      if (!day.accepted && !verified.has(stop.id) && !appointed) continue;
      if (state.frozenTimes[day.dateKey][stop.id]) continue;
      state.frozenTimes[day.dateKey][stop.id] = {
        arrive: stop.arrive,
        leave: stop.leave,
        booked: appointed,
      };
      changed = true;
    }
  }
  return changed;
}

export function clearFrozenTime(dateKey, learnerId) {
  if (!state.frozenTimes?.[dateKey]) return;
  delete state.frozenTimes[dateKey][learnerId];
  if (!Object.keys(state.frozenTimes[dateKey]).length) {
    delete state.frozenTimes[dateKey];
  }
}

export function removeFrozenTimesForLearner(learnerId) {
  for (const dateKey of Object.keys(state.frozenTimes || {})) {
    clearFrozenTime(dateKey, learnerId);
  }
}

export function removeLearnerFromRoutes(learnerId, { keepDateKey = "" } = {}) {
  for (const [dateKey, route] of Object.entries(state.acceptedRoutes || {})) {
    if (dateKey === keepDateKey) continue;
    if (!route.stops?.some((stop) => stop.id === learnerId)) continue;
    route.stops = route.stops.filter((stop) => stop.id !== learnerId);
    if (!route.stops.length) delete state.acceptedRoutes[dateKey];
  }
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    if (dateKey === keepDateKey) continue;
    const next = (ids || []).filter((id) => id !== learnerId);
    if (next.length) state.pinnedRoutes[dateKey] = next;
    else delete state.pinnedRoutes[dateKey];
  }
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    if (dateKey === keepDateKey) continue;
    state.verifiedByDate[dateKey] = (ids || []).filter((id) => id !== learnerId);
  }
  for (const [dateKey, ids] of Object.entries(state.excludedFromDate || {})) {
    if (dateKey === keepDateKey) continue;
    const next = (ids || []).filter((id) => id !== learnerId);
    if (next.length) state.excludedFromDate[dateKey] = next;
    else delete state.excludedFromDate[dateKey];
  }
  clearAwaitingForLearner(learnerId);
  if (keepDateKey) {
    for (const dateKey of Object.keys(state.frozenTimes || {})) {
      if (dateKey === keepDateKey) continue;
      clearFrozenTime(dateKey, learnerId);
    }
    return;
  }
  removeFrozenTimesForLearner(learnerId);
}

function removeLearnerFromCompletedRoute(dateKey, learnerId) {
  const entry = state.completedRoutes?.[dateKey];
  if (!entry || !learnerId) return;
  if (Array.isArray(entry)) {
    const next = entry.filter((id) => id !== learnerId);
    if (next.length) state.completedRoutes[dateKey] = next;
    else delete state.completedRoutes[dateKey];
    return;
  }
  const next = (entry.ids || []).filter((id) => id !== learnerId);
  if (next.length) entry.ids = next;
  else delete state.completedRoutes[dateKey];
}

export function returnLearnerToBookingQueue(learner, dateKey) {
  if (!learner?.id) return;
  const appointment = normaliseAppointment(learner.appointment);
  if (appointment?.dateKey === dateKey) writeLearnerAppointment(learner, null);
  removeLearnerFromCompletedRoute(dateKey, learner.id);
  if (learner.heldFromPlan) learner.heldFromPlan = false;
  touchLearner(learner);
  let pack = currentCyclePack(state, learner);
  if (!hasOpenUnbookedReview(learner)) {
    if (!pack) {
      pack = createSavedReview(state, {
        learnerId: learner.id,
        dateKey: dateKey || toDateKey(startOfLocalDay(new Date())),
        source: "plan",
      }).review;
    }
    if (pack && !["reviewer", "returned", "print"].includes(pack.status)) {
      setReviewHolder(state, pack.id, "returned");
    }
  }
}

export function detachLearnerFromDay(day, learnerId) {
  const dateKey = day.dateKey || toDateKey(day.date);
  const current =
    state.pinnedRoutes[dateKey] || day.stops.map((stop) => stop.id);
  state.pinnedRoutes[dateKey] = current.filter((id) => id !== learnerId);
  if (!state.pinnedRoutes[dateKey].length) delete state.pinnedRoutes[dateKey];
  if (state.acceptedRoutes[dateKey]) {
    state.acceptedRoutes[dateKey].stops = (
      state.acceptedRoutes[dateKey].stops || []
    ).filter((stop) => stop.id !== learnerId);
    if (!state.acceptedRoutes[dateKey].stops.length) {
      delete state.acceptedRoutes[dateKey];
    }
  }
  if (state.verifiedByDate[dateKey]) {
    state.verifiedByDate[dateKey] = state.verifiedByDate[dateKey].filter(
      (id) => id !== learnerId,
    );
  }
  clearFrozenTime(dateKey, learnerId);
  clearAwaitingForLearner(learnerId);
  if (!state.excludedFromDate[dateKey]) state.excludedFromDate[dateKey] = [];
  if (!state.excludedFromDate[dateKey].includes(learnerId)) {
    state.excludedFromDate[dateKey].push(learnerId);
  }
  if (uiState.planResult) {
    for (const item of uiState.planResult.days) {
      if (item.dateKey !== dateKey) continue;
      item.stops = (item.stops || []).filter((stop) => stop.id !== learnerId);
      item.phoneStops = (item.phoneStops || []).filter((stop) => stop.id !== learnerId);
      item.reviewCount = item.stops.length + item.phoneStops.length;
    }
  }
}

export function acceptDay(day) {
  if (!hasDayWork(day)) return;
  const dateKey = toDateKey(day.date);
  const verified = verifiedIds(state.verifiedByDate, dateKey);
  if (
    day.stops?.length &&
    !day.stops.every((stop) => stopIsValidated(stop, dateKey, verified))
  ) {
    setStatus("Verify every learner on this day before accepting the route, unless they already have a booked time or are locked.");
    return;
  }
  state.acceptedRoutes[toDateKey(day.date)] = snapshotDay(day);
  scheduleStateSave();
  day.accepted = true;
  renderLearners();
  renderPlan();
  setStatus(
    `${day.day} is locked. Those learners will stay on this day if you plan again.`,
  );
}

export function toggleVerify(day, learnerId) {
  const dateKey = toDateKey(day.date);
  const current = new Set(state.verifiedByDate[dateKey] || []);
  if (current.has(learnerId)) {
    current.delete(learnerId);
    clearFrozenTime(dateKey, learnerId);
  } else {
    current.add(learnerId);
    const stop = day.stops.find((item) => item.id === learnerId);
    if (stop) {
      if (!state.frozenTimes[dateKey]) state.frozenTimes[dateKey] = {};
      state.frozenTimes[dateKey][learnerId] = {
        arrive: stop.arrive,
        leave: stop.leave,
      };
    }
    clearAwaitingForLearner(learnerId);
    const pinIds = (day.stops || []).map((item) => item.id);
    if (!pinIds.includes(learnerId)) pinIds.push(learnerId);
    if (pinIds.length) state.pinnedRoutes[dateKey] = pinIds;
  }
  state.verifiedByDate[dateKey] = [...current];
  scheduleStateSave();
  renderLearners();
  if (uiState.planCache) {
    applyCurrentPlan({ updateStatus: true, refreshMap: true });
  } else {
    refreshPlannedWeek({ rebuild: true });
  }
}

function rememberAwaitingCleared(learnerId, now = new Date()) {
  if (!learnerId) return;
  if (!state.awaitingClearedAt) state.awaitingClearedAt = {};
  state.awaitingClearedAt[learnerId] = now.toISOString();
}

export function pruneBookedAwaiting(now = new Date()) {
  if (!state.awaitingReply) return false;
  let changed = false;
  const todayKey = toDateKey(startOfLocalDay(now));
  for (const [dateKey, entries] of Object.entries(state.awaitingReply)) {
    for (const id of Object.keys(entries || {})) {
      const learner =
        (state.learners || []).find((item) => item.id === id) ||
        (state.followUps || []).find((item) => item.id === id);
      const booked = normaliseAppointment(learner?.appointment)?.dateKey;
      const verifiedOnBooking =
        Boolean(booked) &&
        booked >= todayKey &&
        (state.verifiedByDate?.[booked] || []).includes(id);
      const verifiedOnLock = (state.verifiedByDate?.[dateKey] || []).includes(id);
      if (!verifiedOnBooking && !verifiedOnLock && !isVerifiedFromToday(id, now)) continue;
      delete entries[id];
      rememberAwaitingCleared(id, now);
      changed = true;
    }
    if (!Object.keys(entries || {}).length) delete state.awaitingReply[dateKey];
  }
  return changed;
}

function clearAwaitingOnDate(dateKey, learnerId) {
  if (!state.awaitingReply?.[dateKey]?.[learnerId]) return;
  delete state.awaitingReply[dateKey][learnerId];
  if (!Object.keys(state.awaitingReply[dateKey]).length) {
    delete state.awaitingReply[dateKey];
  }
}

export function clearAwaitingForLearner(learnerId) {
  for (const dateKey of Object.keys(state.awaitingReply || {})) {
    clearAwaitingOnDate(dateKey, learnerId);
  }
  rememberAwaitingCleared(learnerId);
}

function settleExpiredAwaiting(days, now) {
  if (!state.awaitingReply) return false;
  let changed = false;
  for (const [dateKey, entries] of Object.entries(state.awaitingReply)) {
    const day = (days || []).find((item) => item.dateKey === dateKey);
    for (const [id, entry] of Object.entries(entries || {})) {
      if (isAwaitingActive(entry, dateKey, now)) continue;
      delete entries[id];
      changed = true;
      const stillOn = day?.stops?.some((stop) => stop.id === id);
      if (!stillOn) {
        if (!state.excludedFromDate[dateKey]) state.excludedFromDate[dateKey] = [];
        if (!state.excludedFromDate[dateKey].includes(id)) {
          state.excludedFromDate[dateKey].push(id);
        }
      }
    }
    if (!Object.keys(entries || {}).length) delete state.awaitingReply[dateKey];
  }
  return changed;
}

export function toggleAwaitingReply(day, learnerId) {
  const dateKey = toDateKey(day.date);
  const stop = day.stops.find((item) => item.id === learnerId);
  if (!stop) return;
  if (!state.awaitingReply) state.awaitingReply = {};
  const current = state.awaitingReply[dateKey]?.[learnerId];
  if (current && isAwaitingActive(current, dateKey, new Date())) {
    clearAwaitingForLearner(learnerId);
    uiState.openTimePickerId = "";
    scheduleStateSave();
    renderLearners();
    if (uiState.planCache) {
      applyCurrentPlan({ fillGaps: false, updateStatus: true, refreshMap: true });
    } else {
      refreshPlannedWeek({ rebuild: true, fillGaps: false });
    }
    setStatus(`${stop.name} is unlocked. Fill day selected can move that slot if needed.`);
    return;
  }
  if (!state.awaitingClearedAt) state.awaitingClearedAt = {};
  delete state.awaitingClearedAt[learnerId];
  if (!state.awaitingReply[dateKey]) state.awaitingReply[dateKey] = {};
  state.awaitingReply[dateKey][learnerId] = {
    untilMinutes: 23 * 60 + 45,
    arrive: stop.arrive,
    leave: stop.leave,
    lockedAt: new Date().toISOString(),
  };
  uiState.openTimePickerId = "";
  scheduleStateSave();
  renderLearners();
  if (uiState.planCache) {
    applyCurrentPlan({ fillGaps: false, updateStatus: true, refreshMap: true });
  } else {
    refreshPlannedWeek({ rebuild: true, fillGaps: false });
  }
  setStatus(`${stop.name} is locked on this round until you unlock them.`);
}

export function setAwaitingHoldPart(day, learnerId, { hour, minute, keepOpen = false } = {}) {
  if (!day || !learnerId) return;
  const dateKey = toDateKey(day.date);
  const stop = day.stops.find((item) => item.id === learnerId);
  const previous = state.awaitingReply?.[dateKey]?.[learnerId];
  if (!previous && !stop) return;
  const current = snapHoldMinutes(previous?.untilMinutes ?? 12 * 60);
  const nextHour = Number.isFinite(hour) ? hour : Math.floor(current / 60);
  const nextMinute = Number.isFinite(minute) ? minute : current % 60;
  const untilMinutes = snapHoldMinutes(nextHour * 60 + nextMinute);
  if (!state.awaitingReply) state.awaitingReply = {};
  if (!state.awaitingReply[dateKey]) state.awaitingReply[dateKey] = {};
  if (!state.awaitingClearedAt) state.awaitingClearedAt = {};
  delete state.awaitingClearedAt[learnerId];
  state.awaitingReply[dateKey][learnerId] = {
    untilMinutes,
    arrive: previous?.arrive ?? stop?.arrive,
    leave: previous?.leave ?? stop?.leave,
    lockedAt: previous?.lockedAt || new Date().toISOString(),
  };
  scheduleStateSave();
  uiState.openTimePickerId = keepOpen ? learnerId : "";
  const active = isAwaitingActive(
    state.awaitingReply[dateKey][learnerId],
    dateKey,
    new Date(),
  );
  if (!active && uiState.planCache) {
    applyCurrentPlan({ fillGaps: true, updateStatus: true, refreshMap: true });
  } else {
    renderPlan({ refreshMap: false });
  }
  setStatus(
    `Waiting until ${formatTime(untilMinutes)} for a reply. After that they wait, and the slot fills in priority order.`,
  );
}

export function dayRouteAccepted(dateKey) {
  return Boolean(dateKey && state.acceptedRoutes?.[dateKey]);
}

export function fillDayHidden(dateKey, { routeCompleted = false, renderedAccepted = false } = {}) {
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  return Boolean(
    routeCompleted ||
      renderedAccepted ||
      (dateKey && dateKey < todayKey) ||
      dayRouteAccepted(dateKey),
  );
}

export function syncFillDayControl(dateKey, options) {
  const hide = fillDayHidden(dateKey, options);
  const fillBox = planButton?.closest(".fill-day-action");
  if (fillBox) fillBox.hidden = hide;
  if (planButton) planButton.hidden = hide;
  return hide;
}

let fillDayClickBound = false;

export function mountFillDayButton({
  selectedWorkingDateKeys = () => [],
  updatePlanLabels = () => {},
  catchUpBeforeEdit = catchUpStateBeforeEdit,
  fillDay = () => planTheWeek({ resetSelection: false, fillGaps: true }),
} = {}) {
  if (!planButton || fillDayClickBound) return;
  fillDayClickBound = true;
  planButton.addEventListener("click", () => {
    if (planButton.disabled) return;
    const dateKey = uiState.selectedDateKey || selectedWorkingDateKeys()[0];
    if (dayRouteAccepted(dateKey)) return;
    planButton.disabled = true;
    Promise.resolve(catchUpBeforeEdit(state))
      .then(() => {
        if (dayRouteAccepted(dateKey)) {
          planButton.disabled = false;
          updatePlanLabels();
          return;
        }
        if (dateKey) {
          state.settings.workingDates = [dateKey];
          const date = dateFromKey(dateKey);
          if (date && !uiState.selectedDateKey) {
            rememberSelectedDay({ day: weekdayName(date), dateKey, date });
          }
        }
        const dayLabel = planDayLogLabel();
        return Promise.resolve(fillDay())
          .then((ok) => {
            if (!ok) {
              planButton.disabled = false;
              return;
            }
            logAction({ type: "planned", label: dayLabel });
            scheduleStateSave();
          })
          .catch((error) => {
            setStatus(error.message || "Could not fill the selected day.");
            planButton.disabled = false;
          });
      })
      .catch((error) => {
        setStatus(error.message || "Could not fill the selected day.");
        planButton.disabled = false;
      });
  });
}

export function mountRouteActions() {
  if (!routeActions) return;
  routeActions.replaceChildren();
  const actions = dayDetail?.querySelector(":scope > .day-actions");
  const completed = Boolean(actions?.hasAttribute("data-route-completed"));
  syncFillDayControl(uiState.selectedDateKey, {
    routeCompleted: completed,
    renderedAccepted: Boolean(actions?.querySelector("[data-email-route], [data-complete-route]")),
  });
  dayDetail?.classList.toggle("is-route-locked", completed);
  if (
    !actions?.querySelector(
      "[data-email-route], [data-accept-day], [data-complete-route], .route-completed-lock",
    )
  ) {
    return;
  }
  routeActions.append(actions);
}

function routeMapsUrl(day) {
  return googleMapsDirUrl(
    uiState.planResult.office.postcode,
    day.stops.map((stop) => stop.postcode),
    uiState.planResult.office.postcode,
  );
}

function buildRouteEmail(day) {
  const dateLabel = `${day.day} ${formatShortDate(day.date)}`;
  const mapsUrl = routeMapsUrl(day);
  const lines = [
    `${dateLabel} workplace review round`,
    "",
    "Google Maps route:",
    mapsUrl,
    "",
    `Leave office ${uiState.planResult.office.postcode} at ${formatTime(day.leaveMinutes ?? day.startMinutes)}`,
    ...(day.phoneStops || []).map(
      (stop) =>
        `Phone ${stop.name} ${formatTime(stop.arrive)}–${formatTime(stop.leave)} (${learnerPlaceMeta(stop)}, 20 min)`,
    ),
    ...day.stops.map(
      (stop, index) =>
        `${index + 1}. ${stop.name}${stop.company ? `, ${stop.company}` : ""}, ${stop.postcode}, arrive ${formatTime(stop.arrive)}, leave ${formatTime(stop.leave)}`,
    ),
    `Back at office ${formatTime(day.returnArrive)}`,
  ];
  return {
    subject: `${dateLabel} review round`,
    body: lines.join("\r\n"),
  };
}

export function emailDayRoute(day) {
  if (!hasDayWork(day) || !uiState.planResult) return;
  readSettingsIntoState();
  scheduleStateSave();
  const { subject, body } = buildRouteEmail(day);
  logAction({
    type: "emailed",
    label: planDayLogLabel(day.dateKey || toDateKey(day.date)),
  });
  scheduleStateSave();
  window.location.href = routeMailtoHref(subject, body, state.settings.email);
  setStatus(routeEmailStatus("route", state.settings.email));
}

function routePrintLearner(stop) {
  return (
    state.learners.find((item) => item.id === stop.id) ||
    (state.followUps || []).find((item) => item.id === stop.id) ||
    stop
  );
}

function routePrintStopHtml(stop, index) {
  const learner = routePrintLearner(stop);
  const tutor = learnerTutorName(learner);
  const contact = learnerProfileFrom(learner);
  const phone = normalisePhone(contact.contactNumber);
  const details = [
    normaliseCompany(learner.company),
    learner.postcode,
    learner.collegeDay ? `college ${learner.collegeDay}` : "",
    contact.employerContact ? `contact ${contact.employerContact}` : "",
    phone,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <article class="print-stop">
      <div class="print-when">${escapeHtml(formatTime(stop.arrive))}–${escapeHtml(formatTime(stop.leave))}</div>
      <div>
        <h2>${index + 1}. ${escapeHtml(stop.name || learner.name || "Learner")}</h2>
        <p>${escapeHtml(details || "No workplace details")}</p>
        <p>Tutor ${escapeHtml(tutor || "not set")}</p>
      </div>
    </article>
  `;
}

function buildRoutePrintHtml(day) {
  const dateLabel = `${day.day} ${formatShortDate(day.date)}`;
  const leaveMinutes = day.leaveMinutes ?? day.startMinutes;
  const phones = (day.phoneStops || [])
    .map((stop) => {
      const learner = routePrintLearner(stop);
      return `
        <article class="print-stop">
          <div class="print-when">${escapeHtml(formatTime(stop.arrive))}–${escapeHtml(formatTime(stop.leave))}</div>
          <div>
            <h2>Phone · ${escapeHtml(stop.name || learner.name || "Learner")}</h2>
            <p>${escapeHtml(learnerPlaceMeta(learner))}</p>
          </div>
        </article>
      `;
    })
    .join("");
  const visits = day.stops.map((stop, index) => routePrintStopHtml(stop, index)).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(dateLabel)} review round</title>
    <style>
      body { font: 13px/1.4 Calibri, Arial, sans-serif; color: #111; margin: 24px; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .lede { margin: 0 0 18px; color: #444; }
      .print-stop { display: grid; grid-template-columns: 92px 1fr; gap: 12px; padding: 10px 0; border-top: 1px solid #ccc; }
      .print-when { font-weight: 700; }
      h2 { font-size: 16px; margin: 0 0 4px; }
      p { margin: 0 0 2px; }
      .end { border-top: 1px solid #111; margin-top: 8px; padding-top: 10px; font-weight: 700; }
      @media print { body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(dateLabel)} workplace review round</h1>
    <p class="lede">
      Leave ${escapeHtml(uiState.planResult.office.postcode)} at ${escapeHtml(formatTime(leaveMinutes))}
      · ${day.stops.length} visit${day.stops.length === 1 ? "" : "s"}
      ${day.driveTotal ? ` · ${escapeHtml(formatDuration(day.driveTotal))} driving` : ""}
    </p>
    ${phones}
    ${visits}
    <p class="end">Back at ${escapeHtml(uiState.planResult.office.postcode)} at ${escapeHtml(formatTime(day.returnArrive))}</p>
  </body>
</html>`;
}

export function printDayRoute(day) {
  if (!hasDayWork(day) || !uiState.planResult) return;
  const popup = window.open("", "print-route");
  if (!popup) {
    setStatus("Allow pop-ups so the route can open for printing.");
    return;
  }
  popup.document.open();
  popup.document.write(buildRoutePrintHtml(day));
  popup.document.close();
  popup.focus();
  try {
    popup.print();
  } catch (error) {
    console.error("Could not open the print dialog:", error);
  }
  setStatus(`Print ${day.day} ${formatShortDate(day.date)} from the print window.`);
}

export function completeRoute(day, { onlyIds } = {}) {
  const phoneStops = day.phoneStops || [];
  if (!day?.stops?.length && !phoneStops.length) {
    setStatus("There is nobody on this route to mark as completed.");
    return;
  }
  const allStops = [...phoneStops, ...(day.stops || [])];
  const selectedIds = Array.isArray(onlyIds) && onlyIds.length ? new Set(onlyIds) : null;
  const completedDate = day.date || dateFromKey(day.dateKey);
  const completedLabel = `${day.day} ${completedDate ? formatShortDate(completedDate) : day.dateKey}`;
  const completedOn = day.dateKey || (completedDate ? toDateKey(completedDate) : "");
  const ids = [];
  for (const stop of allStops) {
    if (selectedIds && !selectedIds.has(stop.id)) continue;
    ids.push(stop.id);
    const learner = findEditableLearner(stop.id);
    const plannedDateKey = nextReviewDateKey(learner) || completedOn;
    if (learner) {
      recordReview(
        learner,
        {
          plannedDateKey,
          actualDateKey: completedOn,
          attended: attendedFromStopKind(stop.kind, learner),
        },
        "completed",
      );
      let pack = stampCycleCompleted(state, learner);
      if (!pack) {
        createSavedReview(state, {
          learnerId: learner.id,
          dateKey: plannedDateKey,
          source: "visit",
        });
        pack = stampCycleCompleted(state, learner);
      }
      if (pack) updateSavedReview(state, pack.id, { visitDateKey: completedOn });
      if (learner) {
        logAction({
          type: "completed",
          learner,
          reviewId: pack?.id || "",
        });
      }
    }
    addLearnerToFollowUp(
      {
        ...(learner || {}),
        id: stop.id,
        name: stop.name || learner?.name || "Learner",
        company: normaliseCompany(learner?.company || stop.company),
        postcode: stop.postcode || learner?.postcode || "",
        collegeDay: stop.collegeDay || learner?.collegeDay || "",
        priority: "normal",
        phoneReview: Boolean(learner?.phoneReview || stop.kind === "phone"),
        phoneReviewDay:
          phoneReviewDay(learner) ||
          (stop.kind === "phone" ? day.day : ""),
        lastReviewDate: lastReviewDateKey(learner) || completedOn,
        reviewHistory: learner?.reviewHistory || [],
        note: learnerNoteText(learner),
      },
      {
        completedOn,
        completedDay: day.day,
        completedLabel,
      },
    );
  }
  if (
    (!selectedIds || selectedIds.size === allStops.length) &&
    !state.acceptedRoutes[completedOn] &&
    (day.stops?.length || phoneStops.length)
  ) {
    state.acceptedRoutes[completedOn] = snapshotDay(day);
  }
  markRouteCompleted(completedOn, ids);
  for (const learnerId of ids) {
    dropLearnerFromRoster(learnerId, { keepDateKey: completedOn });
  }
  const message = `${completedLabel} is completed. ${ids.length} ${ids.length === 1 ? "review is" : "reviews are"} saved from that day.`;
  Promise.resolve(refreshRosterAfterDrop()).finally(() => setStatus(message));
}

export function hasDayWork(day) {
  return Boolean(
    day?.stops?.length ||
      day?.phoneStops?.length ||
      day?.completedReviews?.length ||
      day?.extraCompleted?.length,
  );
}

export function dayIsPermanentlyComplete(day) {
  const dateKey = day?.dateKey;
  if (!dateKey) return false;
  const people = [...(day.stops || []), ...(day.phoneStops || [])];
  const marked = new Set(completedRouteIds(dateKey));
  if (people.length && marked.size && people.every((stop) => marked.has(stop.id))) return true;
  const done = day.completedReviews || reviewsDoneOnDate(dateKey);
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  if (!people.length && dateKey < todayKey && done.length) return true;
  if (
    people.length &&
    dateKey < todayKey &&
    done.length &&
    people.every((stop) => done.some((item) => item.id === stop.id))
  ) {
    return true;
  }
  return Boolean(day.lookback && done.length && !people.length);
}
