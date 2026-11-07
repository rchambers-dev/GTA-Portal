import {
  DEFAULT_SETTINGS,
  REVIEW_INTERVAL_WEEKS,
  addDays,
  employerAllowsDay,
  isWeekdayDate,
  normaliseAppointment,
  startOfLocalDay,
  toDateKey,
} from "../planner.js";
import { settleRebookHold } from "../app/persist.js";
import { cssEscape } from "../lib/html.js";

export const REBOOK_CONFLICT_MESSAGE =
  "Could not save this rebook. Someone else changed this plan. The visit was left as it was.";

export const REBOOK_SAVE_FAILED_MESSAGE =
  "Could not save this rebook. The visit was left as it was.";

export const REBOOK_OVERLAP_MESSAGE =
  "Could not save this rebook. This visit was changed again while saving, so those newer changes were kept.";

export const REBOOK_PLACE_FAILED_MESSAGE =
  "The visit was moved, but that day’s route could not be refreshed.";

// One description drives the calendar, the block reason, and the save-time check.
export function describeRebookDay({
  key = "",
  weekday = true,
  missedKey = "",
  todayKey = "",
  nowMinutes = 0,
  skipToday = true,
  returnBy = DEFAULT_SETTINGS.returnBy,
  windowEndKey = "",
  accepted = false,
  completed = false,
  unavailable = "",
} = {}) {
  if (key && missedKey && key === missedKey) {
    return { key, bookable: false, reason: "the visit they missed", blocked: "" };
  }
  if (todayKey && key < todayKey) {
    return { key, bookable: false, reason: "already passed", blocked: "" };
  }
  if (!weekday) {
    return { key, bookable: false, reason: "not a working day", blocked: "" };
  }
  if (completed) {
    return { key, bookable: false, reason: "route already completed", blocked: "" };
  }
  if (accepted) {
    return { key, bookable: false, reason: "route already accepted", blocked: "" };
  }
  const blockedReason = {
    college: "at college",
    employer: "the employer can't do this day",
    booked: "already booked",
  }[unavailable];
  if (blockedReason) {
    return { key, bookable: false, reason: blockedReason, blocked: unavailable };
  }
  if (key === todayKey && skipToday) {
    return { key, bookable: false, reason: "skipped for today", blocked: "" };
  }
  const latest = Number(returnBy);
  const endBy = Number.isFinite(latest) && latest > 0 ? latest : DEFAULT_SETTINGS.returnBy;
  if (key === todayKey && nowMinutes >= endBy) {
    return { key, bookable: false, reason: "too late to start a round", blocked: "" };
  }
  if (windowEndKey && key > windowEndKey) {
    return { key, bookable: false, reason: "outside the days you can book", blocked: "" };
  }
  return { key, bookable: true, reason: "", blocked: "" };
}

export function committedRebookDateKeys(learner, missedKey = "", places = {}) {
  const keys = new Set();
  if (!learner?.id) return keys;
  const booked = normaliseAppointment(learner.appointment)?.dateKey;
  if (booked && booked !== missedKey) keys.add(booked);
  const listed = (bucket) => {
    for (const [dateKey, ids] of Object.entries(bucket || {})) {
      if (!dateKey || dateKey === missedKey) continue;
      if ((ids || []).includes(learner.id)) keys.add(dateKey);
    }
  };
  listed(places.pinnedRoutes);
  listed(places.verifiedByDate);
  for (const [dateKey, route] of Object.entries(places.acceptedRoutes || {})) {
    if (!dateKey || dateKey === missedKey) continue;
    const stops = [...(route?.stops || []), ...(route?.phoneStops || [])];
    if (stops.some((stop) => stop?.id === learner.id)) keys.add(dateKey);
  }
  for (const [dateKey, byId] of Object.entries(places.frozenTimes || {})) {
    if (dateKey && dateKey !== missedKey && byId?.[learner.id]) keys.add(dateKey);
  }
  return keys;
}

export function rebookUnavailableCode(learner, dayName, key, missedKey = "", places = {}) {
  if (!learner) return "";
  if (dayName && learner.collegeDay && dayName === learner.collegeDay) return "college";
  if (dayName && !employerAllowsDay(learner, dayName)) return "employer";
  if (key && committedRebookDateKeys(learner, missedKey, places).has(key)) return "booked";
  return "";
}

export function rebookEmptyFitState(returnByLabel, escapeHtml) {
  return {
    hintHidden: true,
    hintText: "",
    choicesHtml: rebookEmptyTimesNote(returnByLabel, escapeHtml),
    saveEnabled: false,
  };
}

export function rebookWorkingDays({
  now = new Date(),
  missedKey = "",
  skipToday = true,
  returnBy = DEFAULT_SETTINGS.returnBy,
  isAccepted = () => false,
  isCompleted = () => false,
  unavailable = () => "",
} = {}) {
  const today = startOfLocalDay(now);
  const todayKey = toDateKey(today);
  const end = addDays(today, REVIEW_INTERVAL_WEEKS * 7);
  const windowEndKey = toDateKey(end);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const days = [];
  for (let date = today; date <= end; date = addDays(date, 1)) {
    const key = toDateKey(date);
    days.push(
      describeRebookDay({
        key,
        weekday: isWeekdayDate(date),
        missedKey,
        todayKey,
        nowMinutes,
        skipToday,
        returnBy,
        windowEndKey,
        accepted: Boolean(isAccepted(key)),
        completed: Boolean(isCompleted(key)),
        unavailable: unavailable(key) || "",
      }),
    );
  }
  return {
    todayKey,
    windowEndKey,
    days,
    bookableKeys: days.filter((day) => day.bookable).map((day) => day.key),
  };
}

export function rebookChoiceError(reason) {
  switch (reason) {
    case "the visit they missed":
      return "Pick a different day — this is the visit they missed.";
    case "already passed":
      return "Pick a new weekday from today onwards.";
    case "not a working day":
      return "Pick a weekday for the new visit.";
    case "route already accepted":
      return "That route is already accepted. Pick a different day.";
    case "route already completed":
      return "That route is already completed. Pick a different day.";
    case "at college":
      return "That day is college. Pick a different day.";
    case "the employer can't do this day":
      return "The employer can't do that day. Pick a different day.";
    case "already booked":
      return "They are already booked that day. Pick a different day.";
    case "skipped for today":
      return "Today is skipped. Pick a later working day.";
    case "too late to start a round":
      return "It's too late to start a round today. Pick a later working day.";
    default:
      return "Pick an upcoming working day.";
  }
}

export function rebookBlockLabel(reason) {
  switch (reason) {
    case "at college":
      return "At college";
    case "the employer can't do this day":
      return "Employer can't do this day";
    case "already booked":
      return "Already booked";
    default:
      return reason;
  }
}

export function rebookEmptyTimesNote(returnByLabel, escapeHtml) {
  const text = `No arrival on this day fits the drive and a return by ${returnByLabel}.`;
  return `<p class="visually-hidden">${escapeHtml(text)}</p>`;
}

export function rebookSaveErrorMessage(result) {
  if (result?.conflict || result?.status === 409) return REBOOK_CONFLICT_MESSAGE;
  return REBOOK_SAVE_FAILED_MESSAGE;
}

export function rebookFormSelector(id) {
  return `[data-rebook-form="${cssEscape(id)}"]`;
}

export function rebookDayClickBlocked(button) {
  if (!button) return true;
  if (button.disabled) return true;
  return button.getAttribute("aria-disabled") === "true";
}

export function rebookSaveAllowed(formEl) {
  const time = formEl?.querySelector("[data-rebook-time]")?.value?.trim() || "";
  const save = formEl?.querySelector("[data-rebook-save]");
  if (!time) return false;
  return save?.getAttribute("data-rebook-bookable") !== "false";
}

export function setRebookFormBusy(formEl, busy) {
  if (!formEl) return;
  formEl.setAttribute("aria-busy", busy ? "true" : "false");
  for (const button of formEl.querySelectorAll("[data-rebook-save], [data-rebook-queue]")) {
    if (busy) {
      if (!button.hasAttribute("data-rebook-was-disabled")) {
        button.setAttribute("data-rebook-was-disabled", button.disabled ? "true" : "false");
      }
      button.disabled = true;
      continue;
    }
    if (button.hasAttribute("data-rebook-save")) {
      button.disabled = !rebookSaveAllowed(formEl);
    } else {
      const was = button.getAttribute("data-rebook-was-disabled");
      button.disabled = was === "true";
    }
    button.removeAttribute("data-rebook-was-disabled");
  }
}

// The error box is the panel alert. Callers must not copy the same text into
// another live region.
export function showRebookPanelError(formEl, message) {
  const box = formEl?.querySelector("[data-rebook-error]");
  if (!box) return null;
  const text = message || "";
  box.setAttribute("role", "alert");
  box.hidden = !text;
  box.textContent = text;
  if (text && typeof box.focus === "function") box.focus();
  return box;
}

export function rebookErrorBoxHtml({ id, message = "", escapeHtml }) {
  const text = message || "";
  return `<p class="form-error" id="${escapeHtml(id)}" data-rebook-error role="alert" tabindex="-1"${text ? "" : " hidden"}>${escapeHtml(text)}</p>`;
}

export function applyRebookChoice(form, picks = {}) {
  if (!form) return;
  const dateInput = form.querySelector("[data-rebook-date]");
  const timeInput = form.querySelector("[data-rebook-time]");
  if (dateInput && picks.dateKey) dateInput.value = picks.dateKey;
  if (timeInput && picks.timeValue != null) timeInput.value = picks.timeValue;
}

export function focusRebookToggle(root, id) {
  if (!root || id == null || id === "") return null;
  const toggle = root.querySelector(`[data-rebook="${cssEscape(id)}"]`);
  if (typeof toggle?.focus === "function") toggle.focus();
  return toggle || null;
}

export function closeRebookFromEscape(event, { openId = "", root = null, closePanel } = {}) {
  if (!event || event.key !== "Escape" || !openId || !root) return "";
  const target = event.target;
  if (!target || typeof target.closest !== "function") return "";
  if (!target.closest("[data-rebook-form], [data-rebook]")) return "";
  event.preventDefault();
  if (typeof closePanel === "function") closePanel();
  focusRebookToggle(root, openId);
  return openId;
}

function cloneRebookValue(value) {
  if (value == null) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

const LEARNER_LISTS = ["learners", "followUps", "archive"];

function findRebookLearner(state, learnerId) {
  for (const list of LEARNER_LISTS) {
    const rows = state?.[list];
    if (!Array.isArray(rows)) continue;
    const index = rows.findIndex((item) => item?.id === learnerId);
    if (index >= 0) return { list, index };
  }
  return { list: "", index: -1 };
}

function idList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function learnerIdIndex(ids, learnerId) {
  return idList(ids).indexOf(learnerId);
}

function datesTouching(state, learnerId, dateKeys) {
  const dates = new Set(dateKeys.filter(Boolean));
  for (const bucket of [state?.pinnedRoutes, state?.excludedFromDate, state?.verifiedByDate]) {
    for (const [dateKey, ids] of Object.entries(bucket || {})) {
      if (idList(ids).includes(learnerId)) dates.add(dateKey);
    }
  }
  for (const [dateKey, byId] of Object.entries(state?.awaitingReply || {})) {
    if (byId?.[learnerId]) dates.add(dateKey);
  }
  for (const [dateKey, byId] of Object.entries(state?.frozenTimes || {})) {
    if (byId?.[learnerId]) dates.add(dateKey);
  }
  for (const [dateKey, route] of Object.entries(state?.acceptedRoutes || {})) {
    if ((route?.stops || []).some((stop) => stop?.id === learnerId)) dates.add(dateKey);
    if ((route?.phoneStops || []).some((stop) => stop?.id === learnerId)) dates.add(dateKey);
  }
  return [...dates].sort();
}

function capturePlanStops(planResult, learnerId) {
  if (!planResult?.days) return [];
  return planResult.days.map((day) => ({
    dateKey: day.dateKey || "",
    stop: cloneRebookValue((day.stops || []).find((stop) => stop?.id === learnerId) || null),
    phoneStop: cloneRebookValue((day.phoneStops || []).find((stop) => stop?.id === learnerId) || null),
  }));
}

function putBackId(ids, learnerId, index) {
  const next = idList(ids).filter((id) => id !== learnerId);
  if (index == null || index < 0) return next;
  next.splice(Math.min(index, next.length), 0, learnerId);
  return next;
}

function writeIdList(bucket, dateKey, ids) {
  if (!ids.length) {
    if (bucket) delete bucket[dateKey];
    return;
  }
  bucket[dateKey] = ids;
}

// Snapshot only the learner and the route fields a rebook changes.
export function captureRebookTouch(state, { learnerId = "", missedKey = "", dateKey = "", planResult = null } = {}) {
  const found = findRebookLearner(state, learnerId);
  const learner = found.index >= 0 ? state[found.list][found.index] : null;
  const dateKeys = datesTouching(state, learnerId, [missedKey, dateKey]);
  const pins = {};
  const excluded = {};
  const verified = {};
  const awaiting = {};
  const frozen = {};
  const accepted = {};
  for (const key of dateKeys) {
    pins[key] = learnerIdIndex(state?.pinnedRoutes?.[key], learnerId);
    excluded[key] = learnerIdIndex(state?.excludedFromDate?.[key], learnerId);
    verified[key] = learnerIdIndex(state?.verifiedByDate?.[key], learnerId);
    awaiting[key] = cloneRebookValue(state?.awaitingReply?.[key]?.[learnerId] ?? null);
    frozen[key] = cloneRebookValue(state?.frozenTimes?.[key]?.[learnerId] ?? null);
    const route = state?.acceptedRoutes?.[key];
    accepted[key] = {
      stop: cloneRebookValue((route?.stops || []).find((stop) => stop?.id === learnerId) || null),
      phoneStop: cloneRebookValue((route?.phoneStops || []).find((stop) => stop?.id === learnerId) || null),
    };
  }
  return {
    learnerId,
    missedKey,
    dateKey,
    list: found.list,
    index: found.index,
    learner: cloneRebookValue(learner),
    clearedAt: cloneRebookValue(state?.awaitingClearedAt?.[learnerId] ?? null),
    dateKeys,
    pins,
    excluded,
    verified,
    awaiting,
    frozen,
    accepted,
    planStops: capturePlanStops(planResult, learnerId),
  };
}

function touchCompareKey(touch) {
  if (!touch) return "";
  return JSON.stringify({
    learner: touch.learner,
    clearedAt: touch.clearedAt,
    pins: touch.pins,
    excluded: touch.excluded,
    verified: touch.verified,
    awaiting: touch.awaiting,
    frozen: touch.frozen,
    accepted: touch.accepted,
  });
}

function restoreIdMembership(bucket, learnerId, indexes) {
  const dates = new Set([
    ...Object.keys(indexes || {}),
    ...Object.keys(bucket || {}).filter((key) => idList(bucket[key]).includes(learnerId)),
  ]);
  for (const key of dates) {
    writeIdList(bucket, key, putBackId(bucket?.[key], learnerId, indexes?.[key]));
  }
}

function restoreLearnerRecord(state, touch) {
  if (!touch?.learner || !touch.list || touch.index < 0) return;
  const rows = state[touch.list];
  if (!Array.isArray(rows)) return;
  const currentIndex = rows.findIndex((item) => item?.id === touch.learnerId);
  if (currentIndex >= 0) rows[currentIndex] = cloneRebookValue(touch.learner);
  else if (rows[touch.index]) rows.splice(touch.index, 0, cloneRebookValue(touch.learner));
  else rows.push(cloneRebookValue(touch.learner));
}

function restoreNestedLearner(bucket, learnerId, savedByDate) {
  for (const [dateKey, byId] of Object.entries(bucket || {})) {
    if (!byId?.[learnerId]) continue;
    delete byId[learnerId];
    if (!Object.keys(byId).length) delete bucket[dateKey];
  }
  for (const [dateKey, value] of Object.entries(savedByDate || {})) {
    if (value == null) continue;
    if (!bucket[dateKey]) bucket[dateKey] = {};
    bucket[dateKey][learnerId] = cloneRebookValue(value);
  }
}

function restoreAcceptedStops(state, learnerId, accepted) {
  if (!state.acceptedRoutes) state.acceptedRoutes = {};
  for (const route of Object.values(state.acceptedRoutes)) {
    if (route?.stops) route.stops = route.stops.filter((stop) => stop?.id !== learnerId);
    if (route?.phoneStops) route.phoneStops = route.phoneStops.filter((stop) => stop?.id !== learnerId);
  }
  for (const [dateKey, saved] of Object.entries(accepted || {})) {
    if (!saved?.stop && !saved?.phoneStop) continue;
    if (!state.acceptedRoutes[dateKey]) {
      state.acceptedRoutes[dateKey] = { stops: [], phoneStops: [] };
    }
    const route = state.acceptedRoutes[dateKey];
    if (saved.stop) {
      route.stops = [...(route.stops || []).filter((stop) => stop?.id !== learnerId), cloneRebookValue(saved.stop)];
    }
    if (saved.phoneStop) {
      route.phoneStops = [
        ...(route.phoneStops || []).filter((stop) => stop?.id !== learnerId),
        cloneRebookValue(saved.phoneStop),
      ];
    }
  }
}

function restorePlanStops(planResult, learnerId, planStops) {
  if (!planResult?.days) return;
  for (const day of planResult.days) {
    day.stops = (day.stops || []).filter((stop) => stop?.id !== learnerId);
    day.phoneStops = (day.phoneStops || []).filter((stop) => stop?.id !== learnerId);
    const saved = (planStops || []).find((item) => item.dateKey === day.dateKey);
    if (saved?.stop) day.stops.push(cloneRebookValue(saved.stop));
    if (saved?.phoneStop) day.phoneStops.push(cloneRebookValue(saved.phoneStop));
  }
}

export function restoreRebookTouch(state, before, applied, planResult = null) {
  if (!before?.learnerId || !state) return { restored: false };
  if (applied && touchCompareKey(captureRebookTouch(state, before)) !== touchCompareKey(applied)) {
    return { restored: false, overlap: true };
  }
  const learnerId = before.learnerId;
  restoreLearnerRecord(state, before);
  if (!state.pinnedRoutes) state.pinnedRoutes = {};
  if (!state.excludedFromDate) state.excludedFromDate = {};
  if (!state.verifiedByDate) state.verifiedByDate = {};
  if (!state.awaitingReply) state.awaitingReply = {};
  if (!state.frozenTimes) state.frozenTimes = {};
  if (!state.awaitingClearedAt) state.awaitingClearedAt = {};
  restoreIdMembership(state.pinnedRoutes, learnerId, before.pins);
  restoreIdMembership(state.excludedFromDate, learnerId, before.excluded);
  restoreIdMembership(state.verifiedByDate, learnerId, before.verified);
  restoreNestedLearner(state.awaitingReply, learnerId, before.awaiting);
  restoreNestedLearner(state.frozenTimes, learnerId, before.frozen);
  if (before.clearedAt == null) delete state.awaitingClearedAt[learnerId];
  else state.awaitingClearedAt[learnerId] = before.clearedAt;
  restoreAcceptedStops(state, learnerId, before.accepted);
  restorePlanStops(planResult, learnerId, before.planStops);
  return { restored: true };
}

let rebookBusy = false;

export function isRebookBusy() {
  return rebookBusy;
}

export function resetRebookFlow() {
  rebookBusy = false;
}

function choiceFrom(deps, form) {
  const choice = deps.readChoice?.(form) || {};
  return {
    dateKey: choice.dateKey || "",
    timeValue: choice.timeValue || "",
  };
}

function picksFrom(choice) {
  return { dateKey: choice.dateKey || "", timeValue: choice.timeValue || "" };
}

function rebookPersistOutcome(result) {
  if (result?.ok) return "success";
  if (result?.conflict || result?.refreshed || result?.status === 409) return "conflict";
  return "fail";
}

async function runRebookAction(learnerId, deps, work) {
  if (!deps || rebookBusy) return { ok: false, busy: true };
  const learner = deps.findLearner(learnerId);
  const formEl = deps.formFor(learnerId);
  if (!learner || !formEl) return { ok: false, missing: true };
  rebookBusy = true;
  deps.setBusy(formEl, true);
  let outcome = "fail";
  try {
    const result = await work({ learner, formEl });
    outcome = rebookPersistOutcome(result);
    return result;
  } catch (error) {
    deps.reportError?.(error);
    outcome = "fail";
    return { ok: false, thrown: true };
  } finally {
    rebookBusy = false;
    settleRebookHold(outcome);
    deps.holdPersist?.(false);
    deps.setBusy(deps.formFor(learnerId), false);
  }
}

function rebookScope(day, learnerId, choice) {
  return {
    learnerId,
    day,
    missedKey: day?.dateKey || "",
    dateKey: choice?.dateKey || "",
  };
}

async function saveAndReveal(deps, before, applied, learnerId, picks) {
  let saved;
  try {
    saved = await deps.save();
  } catch (error) {
    deps.reportError?.(error);
    saved = { ok: false, conflict: error?.status === 409, status: Number(error?.status) || 0 };
  }
  if (saved?.refreshed) {
    await deps.revealFailure(learnerId, rebookSaveErrorMessage(saved), picks);
    return { ok: false, conflict: true, refreshed: true };
  }
  if (!saved?.ok) {
    const outcome = await deps.restore(before, applied, { sessionSavedAt: saved.sessionSavedAt });
    const message = outcome?.overlap ? REBOOK_OVERLAP_MESSAGE : rebookSaveErrorMessage(saved);
    await deps.revealFailure(learnerId, message, picks);
    return {
      ok: false,
      rolledBack: outcome?.restored !== false,
      overlap: Boolean(outcome?.overlap),
      conflict: Boolean(saved?.conflict || saved?.status === 409),
    };
  }
  return { ok: true };
}

export async function saveRebookedReview(day, learnerId, deps) {
  return runRebookAction(learnerId, deps, async ({ learner, formEl }) => {
    const choice = choiceFrom(deps, formEl);
    const problem = deps.validateBooking({ day, learner, learnerId, ...choice });
    if (problem) {
      deps.showError(formEl, problem);
      return { ok: false, invalid: true };
    }
    const clash = await deps.checkClash({ learner, day, ...choice });
    const openForm = deps.formFor(learnerId) || formEl;
    if (clash?.message) {
      deps.showError(openForm, clash.message);
      return { ok: false, invalid: true };
    }
    const again = deps.validateBooking({ day, learner, learnerId, ...choice, recheck: true });
    if (again) {
      deps.showError(openForm, again);
      return { ok: false, invalid: true };
    }
    const scope = rebookScope(day, learnerId, choice);
    const before = deps.capture(scope);
    const picks = picksFrom(choice);
    deps.holdPersist(true);
    let placed = false;
    try {
      placed = await deps.applyBooking({ learner, day, learnerId, ...choice });
    } catch (error) {
      placed = false;
      deps.reportError?.(error);
    } finally {
      deps.holdPersist(false);
    }
    const applied = deps.capture(scope);
    const saved = await saveAndReveal(deps, before, applied, learnerId, picks);
    if (!saved.ok) return saved;
    if (placed === false) {
      await deps.revealFailure(learnerId, REBOOK_PLACE_FAILED_MESSAGE, picks);
      return { ok: false, placed: false };
    }
    deps.finish(learnerId, deps.bookedMessage({ learner, day, ...choice }));
    return { ok: true };
  });
}

export async function queueMissedReview(day, learnerId, deps) {
  return runRebookAction(learnerId, deps, async ({ learner, formEl }) => {
    const choice = choiceFrom(deps, formEl);
    const scope = rebookScope(day, learnerId, choice);
    const before = deps.capture(scope);
    const picks = picksFrom(choice);
    deps.holdPersist(true);
    try {
      await deps.applyQueue({ learner, day, learnerId, ...choice });
    } catch (error) {
      deps.holdPersist(false);
      const applied = deps.capture(scope);
      const outcome = await deps.restore(before, applied);
      deps.reportError?.(error);
      await deps.revealFailure(
        learnerId,
        outcome?.overlap ? REBOOK_OVERLAP_MESSAGE : rebookSaveErrorMessage({ ok: false }),
        picks,
      );
      return { ok: false, rolledBack: outcome?.restored !== false, overlap: Boolean(outcome?.overlap) };
    } finally {
      deps.holdPersist(false);
    }
    const applied = deps.capture(scope);
    const saved = await saveAndReveal(deps, before, applied, learnerId, picks);
    if (!saved.ok) return saved;
    deps.finish(learnerId, deps.queuedMessage({ learner, day, ...choice }));
    return { ok: true };
  });
}
