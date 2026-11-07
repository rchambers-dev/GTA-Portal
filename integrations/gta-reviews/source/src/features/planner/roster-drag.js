import {
  uiState,
  } from "../../app/ui-state.js";
import {
  scheduleStateSave,
  } from "../../app/persist.js";
import {
  dayDetail,
  learnerList,
  planDrop,
  rosterDropHint,
  } from "../../app/dom.js";
import {
  escapeHtml,
  } from "../../lib/html.js";
import { cssEscape } from "../../lib/html.js";
import {
  formatDateKeyLabel,
  formatDriveLeg,
  } from "../../lib/format.js";
import {
  writeLearnerAppointment,
  } from "../../plan-locks.js";
import {
  appendFitLearners,
  dateFromKey,
  driveBetween,
  employerAllowsDay,
  formatTime,
  isPhoneReview,
  normaliseAppointment,
  sameWorkplace,
  toDateKey,
  verifiedIds,
  weekdayName,
  } from "../../planner.js";
import {
  drivingMatrix,
  geocodePostcodes,
  normalisePostcode,
  } from "../../geo.js";
import { state,
} from "./status.js";
import {
  planPlacementStatus,
  promoteToBookFollowUps,
} from "./status.js";
import {
  readOpenNote,
} from "./notes.js";

import {
  applyCurrentPlan,
  clearFrozenTime,
  dayIsPermanentlyComplete,
  detachLearnerFromDay,
  planTheWeek,
  removeLearnerFromRoutes,
  returnLearnerToBookingQueue,
} from "./routes.js";

export function alreadyPlanned(...args) {
  return callHook("alreadyPlanned", args, false);
}
export function findSelectedPlanDay(...args) {
  return callHook("findSelectedPlanDay", args, null);
}
export function learnerCouldJoinDay(...args) {
  return callHook("learnerCouldJoinDay", args, false);
}
export function refreshLivePlan(...args) {
  return callHook("refreshLivePlan", args, undefined);
}
export function snapshotLearner(...args) {
  return callHook("snapshotLearner", args, null);
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
export function selectedWorkingDateKeys(...args) {
  return callHook("selectedWorkingDateKeys", args, []);
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

export function bindRosterDrag(next) {
  hooks = next || null;
}

function clearRosterUndo() {
  uiState.rosterUndo = null;
  clearInterval(uiState.rosterUndoTimer);
  uiState.rosterUndoTimer = null;
}

function armRosterUndo(learnerId, dateKey) {
  clearRosterUndo();
  if (!learnerId || !dateKey) return;
  uiState.rosterUndo = { learnerId, dateKey, until: Date.now() + 10000 };
  uiState.rosterUndoTimer = setInterval(() => {
    if (!uiState.rosterUndo) {
      clearRosterUndo();
      return;
    }
    const left = Math.max(0, Math.ceil((uiState.rosterUndo.until - Date.now()) / 1000));
    const count = document.querySelector("[data-roster-undo-count]");
    if (count) count.textContent = `${left}s`;
    if (left > 0) return;
    clearRosterUndo();
    renderPlan({ refreshMap: false });
  }, 250);
}

export function rosterUndoRowHtml(learnerId, dateKey) {
  if (!uiState.rosterUndo || uiState.rosterUndo.learnerId !== learnerId || uiState.rosterUndo.dateKey !== dateKey) return "";
  const left = Math.max(1, Math.ceil((uiState.rosterUndo.until - Date.now()) / 1000));
  return `<div class="roster-undo-row"><button type="button" class="roster-undo" data-roster-undo="${escapeHtml(learnerId)}" aria-label="Undo adding this learner"><span>Undo</span><span class="roster-undo-count" data-roster-undo-count>${left}s</span></button></div>`;
}

export function undoRecentRosterDrop(day, learnerId) {
  const dateKey = day?.dateKey || toDateKey(day?.date);
  const active = uiState.rosterUndo;
  if (!active || active.learnerId !== learnerId || active.dateKey !== dateKey) return;
  if (Date.now() > active.until) {
    clearRosterUndo();
    renderPlan({ refreshMap: false });
    return;
  }
  clearRosterUndo();
  const learner = findEditableLearner(learnerId);
  const current = state.pinnedRoutes?.[dateKey] || (day.stops || []).map((stop) => stop.id);
  const next = current.filter((id) => id !== learnerId);
  if (!state.pinnedRoutes) state.pinnedRoutes = {};
  if (next.length) state.pinnedRoutes[dateKey] = next;
  else delete state.pinnedRoutes[dateKey];
  clearFrozenTime(dateKey, learnerId);
  if (state.verifiedByDate?.[dateKey]) {
    state.verifiedByDate[dateKey] = state.verifiedByDate[dateKey].filter((id) => id !== learnerId);
  }
  const appointment = normaliseAppointment(learner?.appointment);
  if (appointment?.dateKey === dateKey) writeLearnerAppointment(learner, null);
  scheduleStateSave(true);
  if (uiState.planCache) {
    applyCurrentPlan({ fillGaps: false, updateStatus: false, refreshMap: true });
  } else {
    refreshPlannedWeek({ rebuild: true, fillGaps: false });
  }
  renderLearners();
  setStatus("");
}

export function takeOffRound(day, learnerId) {
  const learner = findEditableLearner(learnerId);
  detachLearnerFromDay(day, learnerId);
  returnLearnerToBookingQueue(learner, day.dateKey || toDateKey(day.date));
  scheduleStateSave(true);
  if (uiState.planCache) {
    applyCurrentPlan({
      fillGaps: false,
      updateStatus: false,
      refreshMap: true,
    });
  } else {
    refreshPlannedWeek({ rebuild: true, fillGaps: false });
  }
  renderLearners();
  setStatus("");
}

function moveRouteIds(ids, fromId, toId) {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.filter((id) => id !== fromId);
  const insertAt = next.indexOf(toId) + (from < to ? 1 : 0);
  next.splice(insertAt, 0, fromId);
  return next;
}

export function routeDragHandleHtml(stop) {
  return `<button type="button" class="stop-drag" data-stop-drag="${escapeHtml(stop.id)}" draggable="true" aria-label="Move ${escapeHtml(stop.name)} earlier or later in this route">
    <svg viewBox="0 0 12 16" aria-hidden="true"><circle cx="4" cy="3" r="1.35"/><circle cx="8" cy="3" r="1.35"/><circle cx="4" cy="8" r="1.35"/><circle cx="8" cy="8" r="1.35"/><circle cx="4" cy="13" r="1.35"/><circle cx="8" cy="13" r="1.35"/></svg>
  </button>`;
}

export function findRosterLearner(id) {
  return (
    (state.learners || []).find((item) => item.id === id) ||
    (state.followUps || []).find((item) => item.id === id) ||
    null
  );
}

export function beginPointerRosterDrag(pointer, event) {
  pointer.started = true;
  uiState.rosterDragId = pointer.id;
  uiState.rosterDragMoved = true;
  uiState.rosterFitPreview = null;
  uiState.rosterDropOver = pointerOverPlan(event.clientX, event.clientY);
  startRosterDragGhost(pointer.row, event);
  pointer.row.classList.add("is-drag-source");
  document.body.classList.add("is-roster-dragging");
  setStatus("");
  updateRosterDropVisual();
  beginRosterFitPreview(pointer.id);
}

export function pointerOverPlan(x, y) {
  if (!planDrop) return false;
  const rect = planDrop.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function finishPointerRosterDrag(event) {
  if (!uiState.rosterPointer || event.pointerId !== uiState.rosterPointer.pointerId) return;
  const pointer = uiState.rosterPointer;
  uiState.rosterPointer = null;
  document.body.classList.remove("is-roster-dragging");
  if (!pointer.started) return;
  if (pointerOverPlan(event.clientX, event.clientY)) {
    void applyRosterDrop(pointer.id);
    return;
  }
  uiState.rosterDragId = "";
  uiState.rosterFitToken += 1;
  uiState.rosterFitPreview = null;
  clearRosterDropUi();
}

export function clearRosterDropUi() {
  uiState.rosterDropOver = false;
  uiState.rosterDragMeta = null;
  planDrop?.classList.remove("is-drop-target", "is-drop-ok", "is-drop-blocked");
  dayDetail?.classList.remove("is-drop-target", "is-drop-ok", "is-drop-blocked");
  document.querySelector(".roster-drop-slot")?.remove();
  removeRosterDragGhost();
  for (const item of learnerList?.querySelectorAll(".is-drag-source") || []) {
    item.classList.remove("is-drag-source");
  }
  if (rosterDropHint) {
    rosterDropHint.hidden = true;
    rosterDropHint.textContent = "";
    rosterDropHint.classList.remove("is-ok", "is-blocked");
  }
}

export function blankDragCanvas() {
  if (!uiState.blankDragImage) {
    uiState.blankDragImage = document.createElement("canvas");
    uiState.blankDragImage.width = 1;
    uiState.blankDragImage.height = 1;
  }
  return uiState.blankDragImage;
}

export function startRosterDragGhost(row, event) {
  removeRosterDragGhost();
  const rect = row.getBoundingClientRect();
  uiState.rosterDragSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
  uiState.rosterDragMeta = {
    id: row.dataset.rosterRow || "",
    name: row.querySelector("strong")?.textContent || "",
    college: row.querySelector(".roster-college-day")?.textContent || "",
  };
  const ghost = row.cloneNode(true);
  ghost.classList.remove("is-dragging", "is-drag-source");
  ghost.removeAttribute("draggable");
  ghost.classList.add("roster-drag-ghost");
  ghost.style.width = `${uiState.rosterDragSize.width}px`;
  ghost.style.height = `${uiState.rosterDragSize.height}px`;
  document.body.append(ghost);
  uiState.rosterDragGhost = ghost;
  placeRosterDragGhost(event.clientX, event.clientY);
}

export function placeRosterDragGhost(x, y) {
  if (!uiState.rosterDragGhost || uiState.rosterSnapping) return;
  uiState.rosterDragGhost.style.left = `${x - uiState.rosterDragSize.width / 2}px`;
  uiState.rosterDragGhost.style.top = `${y - uiState.rosterDragSize.height / 2}px`;
}

export function onRosterDragMove(event) {
  if (!uiState.rosterDragId || uiState.rosterSnapping) return;
  if (!event.clientX && !event.clientY) return;
  placeRosterDragGhost(event.clientX, event.clientY);
}

function removeRosterDragGhost() {
  document.removeEventListener("dragover", onRosterDragMove);
  uiState.rosterDragGhost?.remove();
  uiState.rosterDragGhost = null;
}

function snapRosterGhost(slot) {
  const ghost = uiState.rosterDragGhost;
  if (!ghost || !slot) return Promise.resolve();
  const rect = slot.getBoundingClientRect();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    ghost.style.transform = "rotate(0deg)";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    return Promise.resolve();
  }
  ghost.style.transition =
    "left 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)";
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    ghost.addEventListener("transitionend", (event) => {
      if (event.target === ghost && event.propertyName === "transform") finish();
    });
    requestAnimationFrame(() => {
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.transform = "rotate(0deg)";
    });
    window.setTimeout(finish, 320);
  });
}

export function syncRosterDropSlot() {
  const existing = document.querySelector(".roster-drop-slot");
  const preview = uiState.rosterFitPreview;
  if (!uiState.rosterDragId || (preview && !preview.ok)) {
    existing?.remove();
    return;
  }
  const meta = uiState.rosterDragMeta;
  const learnerId = preview?.added?.id || meta?.id || uiState.rosterDragId;
  const slot = existing || document.createElement("div");
  const created = !existing;
  if (slot.dataset.learnerId !== learnerId) {
    const name = meta?.name || preview?.added?.name || "";
    const college = meta?.college || "";
    slot.className = "roster-drop-slot";
    slot.dataset.learnerId = learnerId;
    slot.innerHTML = `<span class="roster-drop-slot-name">${escapeHtml(name)}</span>${college ? `<span class="roster-drop-slot-day">${escapeHtml(college)}</span>` : ""}`;
  }
  slot.style.width = `${uiState.rosterDragSize.width}px`;
  slot.style.height = `${uiState.rosterDragSize.height}px`;
  const host = dayDetail?.querySelector(".timeline") || dayDetail;
  if (!host) return;
  const stops = preview?.ok ? preview.fitted?.stops || [] : [];
  const index = stops.findIndex((stop) => stop.id === learnerId);
  const next = stops
    .slice(Math.max(index, 0) + 1)
    .map((stop) => host.querySelector(`[data-route-stop="${cssEscape(stop.id)}"]`))
    .find(Boolean);
  if (next) next.before(slot);
  else {
    const back = [...host.querySelectorAll(".stop")].reverse().find((el) => !el.dataset.routeStop);
    if (back) back.before(slot);
    else host.append(slot);
  }
  if (created) slot.scrollIntoView({ block: "nearest" });
}

function showRosterDropHint(text, tone = "") {
  if (!rosterDropHint) return;
  rosterDropHint.hidden = !text;
  rosterDropHint.textContent = text || "";
  rosterDropHint.classList.toggle("is-ok", tone === "ok");
  rosterDropHint.classList.toggle("is-blocked", tone === "blocked");
}

export function updateRosterDropVisual() {
  const preview = uiState.rosterFitPreview;
  const dragging = Boolean(uiState.rosterDragId);
  const ok = Boolean(preview?.ok);
  const blocked = Boolean(preview && !preview.ok);
  planDrop?.classList.remove("is-drop-target", "is-drop-ok", "is-drop-blocked");
  if (dayDetail) {
    dayDetail.classList.toggle("is-drop-target", dragging && !blocked);
    dayDetail.classList.toggle("is-drop-ok", dragging && ok);
    dayDetail.classList.toggle("is-drop-blocked", dragging && blocked);
  }
  showRosterDropHint("");
  if (!dragging) {
    document.querySelector(".roster-drop-slot")?.remove();
    return;
  }
  syncRosterDropSlot();
}

function selectedDropDay() {
  const day = findSelectedPlanDay(uiState.planResult?.days);
  if (day) return day;
  const dateKey = uiState.selectedDateKey || selectedWorkingDateKeys()[0] || "";
  if (!dateKey) return null;
  const date = dateFromKey(dateKey);
  return {
    day: date ? weekdayName(date) : uiState.selectedDay,
    dateKey,
    date,
    stops: [],
    accepted: Boolean(state.acceptedRoutes?.[dateKey]),
  };
}

function rosterDriveLegs(located, day) {
  const last = [...(day.stops || [])]
    .filter((stop) => stop.id !== located.id)
    .sort((a, b) => (a.leave ?? 0) - (b.leave ?? 0))
    .at(-1);
  const fromIndex =
    (last &&
      uiState.planCache?.locatedLearners.find((item) => item.id === last.id)?.matrixIndex) ??
    0;
  const sameSite = Boolean(last && sameWorkplace(last, located));
  const inbound = sameSite
    ? { minutes: 0, metres: 0, sameSite: true }
    : { ...(driveBetween(uiState.planCache.matrix, fromIndex, located.matrixIndex) || {}), sameSite: false };
  const home = driveBetween(uiState.planCache.matrix, located.matrixIndex, 0);
  return { inbound, home, fromName: last?.name || "the office" };
}

function assessRosterDrop(located) {
  const learner = findRosterLearner(located.id) || located;
  const day = selectedDropDay();
  const label = day?.dateKey
    ? `${day.day} ${formatDateKeyLabel(day.dateKey)}`
    : "that day";
  if (!day?.dateKey) {
    return { ok: false, message: "Pick a day on the calendar first." };
  }
  if (dayIsPermanentlyComplete(day)) {
    return {
      ok: false,
      day,
      message: `${label} is completed and locked.`,
    };
  }
  if (day.accepted) {
    return {
      ok: false,
      day,
      message: `${label} is locked.`,
    };
  }
  if (isPhoneReview(learner)) {
    return {
      ok: false,
      day,
      message: `${learner.name} is a phone review, so they stay off the driving round.`,
    };
  }
  if (!learnerCouldJoinDay(learner, day)) {
    if (learner.collegeDay === day.day) {
      return { ok: false, day, message: `${learner.name} is at college on ${day.day}.` };
    }
    if (!employerAllowsDay(learner, day.day)) {
      return {
        ok: false,
        day,
        message: `${learner.name} cannot be visited on ${day.day}.`,
      };
    }
    const booked = normaliseAppointment(learner.appointment)?.dateKey;
    if (booked && booked !== day.dateKey) {
      return {
        ok: false,
        day,
        message: `${learner.name} is already booked on ${formatDateKeyLabel(booked)}.`,
      };
    }
    return { ok: false, day, message: `${learner.name} cannot join ${label}.` };
  }
  if ((state.excludedFromDate?.[day.dateKey] || []).includes(learner.id)) {
    return { ok: false, day, message: `${learner.name} is left off ${label}.` };
  }
  const alreadyOn =
    (day.stops || []).some((stop) => stop.id === learner.id) ||
    (state.pinnedRoutes?.[day.dateKey] || []).includes(learner.id);
  if (alreadyOn) {
    return { ok: false, day, message: `${learner.name} is already on ${label}.` };
  }
  const placement = planPlacementStatus(learner);
  if (
    (placement.kind === "booked" ||
      placement.kind === "locked" ||
      placement.kind === "verified") &&
    placement.dateKey &&
    placement.dateKey !== day.dateKey
  ) {
    return {
      ok: false,
      day,
      message: `${learner.name} is already held on ${formatDateKeyLabel(placement.dateKey)}.`,
    };
  }
  if (!uiState.planCache?.matrix || located.matrixIndex == null) {
    return {
      ok: false,
      day,
      message: `Could not find a location for ${learner.name}.`,
    };
  }
  const settings = currentPlannerSettings();
  const frozenById = {};
  for (const stop of day.stops || []) {
    if (stop.arrive == null) continue;
    frozenById[stop.id] = {
      arrive: stop.arrive,
      leave: stop.leave,
      booked: Boolean(stop.booked),
    };
  }
  const currentLearners = (day.stops || [])
    .map((stop) => {
      const located = uiState.planCache.locatedLearners.find((item) => item.id === stop.id);
      if (located) return located;
      if (stop.lat == null || stop.matrixIndex == null) return null;
      return {
        id: stop.id,
        name: stop.name,
        company: stop.company,
        postcode: stop.postcode,
        lat: stop.lat,
        lon: stop.lon,
        matrixIndex: stop.matrixIndex,
      };
    })
    .filter(Boolean);
  if (currentLearners.length !== (day.stops || []).length) {
    return {
      ok: false,
      day,
      message: `Could not check drive time for ${learner.name} on ${label} yet.`,
    };
  }
  const current = {
    stops: day.stops || [],
    driveTotal: day.driveTotal || 0,
    returnTravel: day.returnTravel || 0,
    returnArrive: day.returnArrive,
  };
  const fitted = appendFitLearners(
    current,
    currentLearners,
    [located],
    uiState.planCache.matrix,
    0,
    { ...settings, callMinutes: 0 },
    frozenById,
  );
  const added = fitted.stops.find((stop) => stop.id === located.id);
  const legs = rosterDriveLegs(located, day);
  const inbound = formatDriveLeg(legs.inbound);
  const home = formatDriveLeg(legs.home);
  const travel =
    inbound && home
      ? `${inbound} from ${legs.fromName}, then ${home} back`
      : inbound || home;
  if (!added) {
    return {
      ok: false,
      day,
      message: travel
        ? `No space for ${learner.name} on ${label} — ${travel} would get you back after ${formatTime(settings.returnBy)}.`
        : `No space for ${learner.name} on ${label}. Adding them would get you back after ${formatTime(settings.returnBy)}.`,
    };
  }
  return {
    ok: true,
    day,
    fitted,
    added,
    message: `Drop to add ${learner.name}: ${travel}. Back by ${formatTime(fitted.returnArrive ?? added.leave)}.`,
    successMessage: `Added ${learner.name} to ${label}. ${travel}. Back by ${formatTime(fitted.returnArrive ?? added.leave)}.`,
  };
}

async function ensurePlanCache() {
  if (uiState.planCache) return true;
  if (!uiState.planCacheReady) {
    uiState.planCacheReady = planTheWeek({ resetSelection: false, fillGaps: false }).finally(() => {
      uiState.planCacheReady = null;
    });
  }
  return uiState.planCacheReady;
}

export async function ensureLearnerLocated(learner) {
  promoteToBookFollowUps();
  const current = findRosterLearner(learner.id) || learner;
  if (!uiState.planCache) {
    const ok = await ensurePlanCache();
    if (!ok && !uiState.planCache) return null;
  }
  const cached = (uiState.planCache.locatedLearners || []).find((item) => item.id === current.id);
  if (cached?.matrixIndex != null && cached.lat != null) {
    return {
      ...cached,
      ...current,
      lat: cached.lat,
      lon: cached.lon,
      matrixIndex: cached.matrixIndex,
    };
  }
  const geo = await geocodePostcodes([
    current.postcode,
    uiState.planCache.office?.postcode || state.settings.officePostcode,
  ]);
  const point = geo[normalisePostcode(current.postcode)];
  if (!point) return null;
  const existing = (uiState.planCache.locatedLearners || []).filter((item) => item.id !== current.id);
  const next = [
    ...existing,
    {
      ...current,
      postcode: point.formatted,
      lat: point.lat,
      lon: point.lon,
    },
  ];
  const points = [
    { lat: uiState.planCache.office.lat, lon: uiState.planCache.office.lon },
    ...next.map((item) => ({ lat: item.lat, lon: item.lon })),
  ];
  next.forEach((item, index) => {
    item.matrixIndex = index + 1;
  });
  const matrix = await drivingMatrix(points);
  uiState.planCache.locatedLearners = next;
  uiState.planCache.matrix = matrix;
  uiState.planCache.travelSource = matrix.source;
  uiState.planCache.unlocatedLearners = (uiState.planCache.unlocatedLearners || []).filter(
    (item) => item.id !== current.id,
  );
  return next.find((item) => item.id === current.id) || null;
}

async function checkRosterFit(id) {
  const learner = findRosterLearner(id);
  if (!learner) return { ok: false, message: "That learner is no longer on the list." };
  const located = await ensureLearnerLocated(learner);
  if (!located) {
    return {
      ok: false,
      message: `Could not find a location for ${learner.name}. Check the postcode.`,
    };
  }
  return assessRosterDrop(located);
}

export async function beginRosterFitPreview(id) {
  const token = ++uiState.rosterFitToken;
  updateRosterDropVisual();
  try {
    const fit = await checkRosterFit(id);
    if (token !== uiState.rosterFitToken) return uiState.rosterFitPreview;
    uiState.rosterFitPreview = fit;
    updateRosterDropVisual();
    return fit;
  } catch (error) {
    if (token !== uiState.rosterFitToken) return uiState.rosterFitPreview;
    uiState.rosterFitPreview = {
      ok: false,
      message: error.message || "Could not check drive time for that drop.",
    };
    updateRosterDropVisual();
    return uiState.rosterFitPreview;
  }
}

export async function applyRosterDrop(id) {
  if (uiState.rosterDropBusy) return;
  uiState.rosterDropBusy = true;
  uiState.rosterSnapping = true;
  try {
    const fit = await checkRosterFit(id);
    if (!fit?.ok) {
      setStatus(fit?.message || "There is no space for that visit.");
      return;
    }
    uiState.rosterFitPreview = fit;
    uiState.rosterDropOver = true;
    syncRosterDropSlot();
    const slot = dayDetail?.querySelector(".roster-drop-slot");
    if (slot) await snapRosterGhost(slot);
    const dateKey = fit.day.dateKey;
    if (!state.pinnedRoutes) state.pinnedRoutes = {};
    if (!state.pinnedRoutes[dateKey]) state.pinnedRoutes[dateKey] = [];
    if (!state.pinnedRoutes[dateKey].includes(id)) {
      state.pinnedRoutes[dateKey] = [...state.pinnedRoutes[dateKey], id];
    }
    removeLearnerFromRoutes(id, { keepDateKey: dateKey });
    armRosterUndo(id, dateKey);
    scheduleStateSave();
    applyCurrentPlan({ fillGaps: false, refreshMap: true, updateStatus: false });
    renderLearners();
    setStatus("");
  } finally {
    uiState.rosterDropBusy = false;
    uiState.rosterSnapping = false;
    uiState.rosterDragId = "";
    uiState.rosterFitPreview = null;
    clearRosterDropUi();
    for (const item of learnerList.querySelectorAll("[data-roster-row]")) {
      item.classList.remove("is-dragging", "is-drag-source");
    }
  }
}

export function reorderRouteStop(day, draggedId, targetId) {
  if (!day || draggedId === targetId) return;
  const dragged = (day.stops || []).find((stop) => stop.id === draggedId);
  const target = (day.stops || []).find((stop) => stop.id === targetId);
  if (!dragged || !target || dragged.booked) return;
  const dateKey = toDateKey(day.date);
  const ids = [...day.stops]
    .sort((a, b) => a.arrive - b.arrive || a.leave - b.leave)
    .map((stop) => stop.id);
  const next = moveRouteIds(ids, draggedId, targetId);
  if (next.join(",") === ids.join(",")) return;
  state.pinnedRoutes[dateKey] = next;
  if (state.acceptedRoutes[dateKey]?.stops?.length) {
    const byId = new Map(
      state.acceptedRoutes[dateKey].stops.map((stop) => [stop.id, stop]),
    );
    state.acceptedRoutes[dateKey].stops = next
      .map((id) => byId.get(id))
      .filter(Boolean);
  }
  const verified = verifiedIds(state.verifiedByDate, dateKey);
  if (verified.has(draggedId)) clearFrozenTime(dateKey, draggedId);
  scheduleStateSave();
  uiState.routeDragMoved = true;
  if (uiState.planCache) {
    applyCurrentPlan({
      fillGaps: false,
      updateStatus: false,
      refreshMap: true,
    });
  } else {
    refreshPlannedWeek({ rebuild: true, fillGaps: false });
  }
  const who = dragged.name || "That visit";
  const place = next.indexOf(draggedId) + 1;
  setStatus(
    verified.has(draggedId)
      ? `${who} was moved to stop ${place}. Their visit time was updated to match.`
      : `${who} was moved to stop ${place}. Verified times on this round were left as they are.`,
  );
}

export function dropLearnerFromRoster(learnerId, { keepDateKey = "" } = {}) {
  removeLearnerFromRoutes(learnerId, { keepDateKey });
  uiState.openRecordsLearnerIds.delete(learnerId);
  state.learners = state.learners.filter((learner) => learner.id !== learnerId);
  if (uiState.planCache && !keepDateKey) {
    uiState.planCache.locatedLearners = uiState.planCache.locatedLearners.filter(
      (learner) => learner.id !== learnerId,
    );
  }
  if (uiState.planResult) {
    for (const day of uiState.planResult.days) {
      if (day.dateKey === keepDateKey) continue;
      day.stops = (day.stops || []).filter((stop) => stop.id !== learnerId);
      day.phoneStops = (day.phoneStops || []).filter((stop) => stop.id !== learnerId);
      day.reviewCount = day.stops.length + day.phoneStops.length;
    }
  }
}

export function addLearnerToFollowUp(learner, extras = {}) {
  const record = snapshotLearner(learner, extras);
  if (!record) return;
  if (!state.followUps) state.followUps = [];
  if (state.followUps.some((item) => item.id === record.id)) return;
  state.followUps.push(record);
  state.archive = (state.archive || []).filter((item) => item.id !== record.id);
}

export function refreshRosterAfterDrop() {
  scheduleStateSave(true);
  renderLearners();
  if (state.learners.length && alreadyPlanned()) {
    return refreshPlannedWeek({ rebuild: true, resetSelection: false });
  }
  if (!state.learners.length) {
    uiState.planCache = null;
    uiState.planResult = null;
    uiState.lastSignature = "";
    renderPlan();
    return Promise.resolve();
  }
  refreshLivePlan();
  return Promise.resolve();
}

export function moveLearnerToFollowUp(learnerId) {
  const learner = state.learners.find((item) => item.id === learnerId);
  if (!learner) return;
  const typed = readOpenNote(learnerId);
  if (typed != null) learner.note = typed;
  addLearnerToFollowUp(learner);
  dropLearnerFromRoster(learnerId);
  uiState.noteEditorId = "";
  uiState.appointmentEditorId = "";
  uiState.phoneEditorId = "";
  uiState.reviewEditorId = "";
  uiState.detailsEditorId = "";
  refreshRosterAfterDrop();
  setStatus(
    learner.note
      ? `${learner.name} was moved to Book next review, with the note kept.`
      : `${learner.name} was moved to Book next review.`,
  );
}
