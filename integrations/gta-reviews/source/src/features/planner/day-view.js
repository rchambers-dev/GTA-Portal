import {
  uiState,
  } from "../../app/ui-state.js";
import {
  beginRebookHold,
  } from "../../app/persist.js";
import {
  dayDetail,
  leftoverEl,
  statusEl,
  } from "../../app/dom.js";
import {
  escapeHtml,
  } from "../../lib/html.js";
import {
  writeLearnerAppointment,
  } from "../../plan-locks.js";
import {
  applyRebookChoice,
  captureRebookTouch,
  describeRebookDay,
  focusRebookToggle,
  isRebookBusy,
  rebookBlockLabel,
  rebookChoiceError,
  rebookErrorBoxHtml,
  rebookFormSelector,
  rebookUnavailableCode,
  rebookWorkingDays,
  restoreRebookTouch,
  setRebookFormBusy,
  showRebookPanelError,
  } from "../../plan/rebook-panel.js";
import {
  DEFAULT_SETTINGS,
  REVIEW_INTERVAL_WEEKS,
  addDays,
  applyLearnerProfile,
  dateFromKey,
  formatDuration,
  formatShortDate,
  formatTime,
  formatUkDateKey,
  isAwaitingActive,
  isConfirmedStop,
  isWeekdayDate,
  learnerProfileFrom,
  normaliseAppointment,
  normalisePriority,
  parseTimeToMinutes,
  startOfLocalDay,
  toDateKey,
  verifiedIds,
  weekdayName,
  } from "../../planner.js";
import {
  peekSessionSavedAt,
  restoreLocalCopy,
  saveState,
  } from "../../storage.js";
import {
  outPageEnabled,
  } from "../out-round.js";
import { state,
} from "./status.js";
import {
  completedRouteIds,
  touchLearner,
} from "./status.js";
import {
  learnerNoteText,
  renderPlanNotes,
} from "./notes.js";
import {
  clashForRequestedTime,
  clashStatus,
  slotPreviewShell,
  updateRequestedFit,
} from "./appointments.js";
import {
  renderCalendar,
} from "./calendar.js";
import {
  applyCurrentPlan,
  clearAwaitingForLearner,
  clearFrozenTime,
  dayIsPermanentlyComplete,
  detachLearnerFromDay,
  hasDayWork,
  mountRouteActions,
} from "./routes.js";
import {
  rosterUndoRowHtml,
  routeDragHandleHtml,
  syncRosterDropSlot,
} from "./roster-drag.js";
import {
  drawMap,
} from "./map.js";

export function findSelectedPlanDay(...args) {
  return callHook("findSelectedPlanDay", args, null);
}
export function isLearnerSheetOpen(...args) {
  return callHook("isLearnerSheetOpen", args, false);
}
export function learnerPlaceMeta(...args) {
  return callHook("learnerPlaceMeta", args, "");
}
export function lockIconMarkup(...args) {
  return callHook("lockIconMarkup", args, "");
}
export function planCardOpeningClass(...args) {
  return callHook("planCardOpeningClass", args, "");
}
export function planStopActions(...args) {
  return callHook("planStopActions", args, "");
}
export function plannerStopLearner(...args) {
  return callHook("plannerStopLearner", args, null);
}
export function plannerStopLearnerPanel(...args) {
  return callHook("plannerStopLearnerPanel", args, "");
}
export function playPlanCardOpening(...args) {
  return callHook("playPlanCardOpening", args, undefined);
}
export function revealOpenTimePicker(...args) {
  return callHook("revealOpenTimePicker", args, undefined);
}
export function safeguardingPill(...args) {
  return callHook("safeguardingPill", args, "");
}
export function stopContactLine(...args) {
  return callHook("stopContactLine", args, "");
}
export function stopFoundClass(...args) {
  return callHook("stopFoundClass", args, "");
}
export function stopPriorityLabel(...args) {
  return callHook("stopPriorityLabel", args, "");
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
export function placeAppointmentOnPlan(...args) {
  return callHook("placeAppointmentOnPlan", args, undefined);
}
export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}
export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}
export function displayPlanDay(...args) {
  return callHook("displayPlanDay", args, null);
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

export function bindDayView(next) {
  hooks = next || null;
}

function rebookVisitDateLabel(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date || !isWeekdayDate(date)) return "";
  return `${weekdayName(date)} ${formatShortDate(date)}`;
}

function rebookWeekdayLabel(date) {
  const name = weekdayName(date);
  if (name) return name;
  return date.getDay() === 0 ? "Sunday" : "Saturday";
}

function rebookMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function rebookMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function rebookMonthBounds() {
  const today = startOfLocalDay(new Date());
  const end = addDays(today, REVIEW_INTERVAL_WEEKS * 7);
  return {
    start: rebookMonthStart(today),
    end: rebookMonthStart(end),
  };
}

function rebookReturnByMinutes(settings = currentPlannerSettings()) {
  const minutes = Number(settings?.returnBy);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_SETTINGS.returnBy;
}

function rebookDateIsCompleted(dateKey) {
  if (!dateKey) return false;
  if (completedRouteIds(dateKey).length) return true;
  const planned = (uiState.planResult?.days || []).find(
    (item) => (item.dateKey || toDateKey(item.date)) === dateKey,
  );
  return Boolean(planned && dayIsPermanentlyComplete(planned));
}

function rebookPlaces() {
  return {
    pinnedRoutes: state.pinnedRoutes,
    verifiedByDate: state.verifiedByDate,
    acceptedRoutes: state.acceptedRoutes,
    frozenTimes: state.frozenTimes,
  };
}

export function rebookPanelLearner(learnerId) {
  if (!learnerId) return null;
  return (
    (state.learners || []).find((item) => item.id === learnerId) ||
    (state.followUps || []).find((item) => item.id === learnerId) ||
    (state.archive || []).find((item) => item.id === learnerId) ||
    null
  );
}

export function describeRebookDate(date, key, missedKey, now = new Date(), learner = null) {
  const settings = currentPlannerSettings();
  const today = startOfLocalDay(now);
  return describeRebookDay({
    key,
    weekday: isWeekdayDate(date),
    missedKey,
    todayKey: toDateKey(today),
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    skipToday: settings.skipToday !== false,
    returnBy: rebookReturnByMinutes(settings),
    windowEndKey: toDateKey(addDays(today, REVIEW_INTERVAL_WEEKS * 7)),
    accepted: Boolean(state.acceptedRoutes?.[key]),
    completed: rebookDateIsCompleted(key),
    unavailable: rebookUnavailableCode(
      learner,
      weekdayName(date),
      key,
      missedKey,
      rebookPlaces(),
    ),
  });
}

export function rebookCalendarCells(day, monthDate, selectedKey, learner = null) {
  const missedKey = day?.date ? toDateKey(day.date) : "";
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = monthStart.getDay();
  const lead = startWeekday === 0 || startWeekday === 6 ? 0 : startWeekday - 1;
  const label = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const cells = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    .map((name) => `<span class="rebook-dow">${name}</span>`)
    .join("");
  let days = "";
  for (let blank = 0; blank < lead; blank += 1) {
    days += `<span class="rebook-day is-empty" aria-hidden="true"></span>`;
  }
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
    const date = new Date(year, month, dayNum);
    if (!isWeekdayDate(date)) continue;
    const key = toDateKey(date);
    const described = describeRebookDate(date, key, missedKey, new Date(), learner);
    const canBook = described.bookable;
    const on = canBook && key === selectedKey;
    const reason = canBook ? "" : described.reason;
    const learnerBlocked = Boolean(described.blocked);
    const label = reason ? rebookBlockLabel(reason) : "";
    const spoken = `${rebookWeekdayLabel(date)} ${formatShortDate(date)}${label ? `, ${label}` : ""}`;
    days += `<button type="button" class="rebook-day${on ? " is-on" : ""}${learnerBlocked ? " is-unavailable" : ""}" data-rebook-day="${escapeHtml(key)}" aria-pressed="${on ? "true" : "false"}" aria-disabled="${canBook ? "false" : "true"}" aria-label="${escapeHtml(spoken)}"${label ? ` title="${escapeHtml(label)}"` : ""}>${dayNum}</button>`;
  }
  return { label, value: rebookMonthKey(monthStart), cells: `${cells}${days}` };
}

export function paintRebookMonth(form, monthDate) {
  const day = findSelectedPlanDay();
  const cal = form?.querySelector("[data-rebook-cal]");
  if (!day || !cal) return;
  const learner = rebookPanelLearner(form.dataset.rebookForm);
  const selected = form.querySelector("[data-rebook-date]")?.value || "";
  const built = rebookCalendarCells(day, monthDate, selected, learner);
  cal.innerHTML = built.cells;
  cal.setAttribute("aria-label", `Days in ${built.label}`);
  cal.dataset.rebookShown = built.value;
  const label = form.querySelector("[data-rebook-month-label]");
  if (label) label.textContent = built.label;
  const bounds = rebookMonthBounds();
  const prev = form.querySelector("[data-rebook-month='-1']");
  const next = form.querySelector("[data-rebook-month='1']");
  if (prev) prev.disabled = monthDate.getTime() <= bounds.start.getTime();
  if (next) next.disabled = monthDate.getTime() >= bounds.end.getTime();
}

export function shiftRebookMonth(form, delta) {
  const shown = form?.querySelector("[data-rebook-cal]")?.dataset.rebookShown || "";
  const match = /^(\d{4})-(\d{2})$/.exec(shown);
  if (!match || !Number.isFinite(delta) || delta === 0) return;
  const day = findSelectedPlanDay();
  if (!day) return;
  const bounds = rebookMonthBounds();
  const next = new Date(Number(match[1]), Number(match[2]) - 1 + delta, 1);
  if (next < bounds.start || next > bounds.end) return;
  paintRebookMonth(form, next);
}

export function rebookWorkingDayKeys(day, now = new Date(), learner = null) {
  const settings = currentPlannerSettings();
  const missedKey = day?.date ? toDateKey(day.date) : "";
  const places = rebookPlaces();
  const { bookableKeys } = rebookWorkingDays({
    now,
    missedKey,
    skipToday: settings.skipToday !== false,
    returnBy: rebookReturnByMinutes(settings),
    isAccepted: (key) => Boolean(state.acceptedRoutes?.[key]),
    isCompleted: (key) => rebookDateIsCompleted(key),
    unavailable: (key) =>
      rebookUnavailableCode(learner, weekdayName(dateFromKey(key)), key, missedKey, places),
  });
  return bookableKeys;
}

export function showRebookError(formEl, message) {
  uiState.rebookErrorText = message || "";
  if (uiState.rebookErrorText) formEl?.querySelector("[data-rebook-summary]")?.removeAttribute("role");
  showRebookPanelError(formEl, uiState.rebookErrorText);
}

async function revealRebookFailure(learnerId, message, picks = {}) {
  uiState.rebookErrorText = message || "";
  uiState.rebookDraft = {
    learnerId,
    dateKey: picks.dateKey || "",
    timeValue: picks.timeValue || "",
  };
  if (learnerId) uiState.rebookStopId = learnerId;
  renderLearners();
  renderPlan({ refreshMap: false });
  const form = dayDetail.querySelector(rebookFormSelector(learnerId));
  if (!form) {
    setStatus(uiState.rebookErrorText);
    return;
  }
  applyRebookChoice(form, uiState.rebookDraft);
  try {
    await updateRequestedFit(form, { keepError: true });
  } catch (error) {
    console.error("Failed to refresh rebook times:", error?.message || error);
  }
  showRebookPanelError(form, uiState.rebookErrorText);
}

function finishRebookClose(learnerId, message) {
  uiState.rebookStopId = "";
  uiState.rebookErrorText = "";
  uiState.rebookDraft = null;
  renderLearners();
  renderPlan({ refreshMap: false });
  const toggle = focusRebookToggle(dayDetail, learnerId);
  setStatus(message);
  if (!toggle && statusEl) {
    statusEl.tabIndex = -1;
    statusEl.focus();
  }
}

async function saveRebookState() {
  try {
    const result = await saveState(state, { quiet: true, conflictPrompt: true });
    const sessionSavedAt = peekSessionSavedAt();
    if (result?.refreshed) {
      return { ok: false, conflict: true, status: 409, refreshed: true, sessionSavedAt };
    }
    if (result?.ok === false) return { ...result, sessionSavedAt };
    if (!result?.ok) return { ok: false, conflict: false, status: 0, sessionSavedAt };
    return { ...result, sessionSavedAt };
  } catch (error) {
    return {
      ok: false,
      conflict: error?.status === 409,
      status: Number(error?.status) || 0,
      sessionSavedAt: peekSessionSavedAt(),
    };
  }
}

function cloneRebookData(value) {
  if (value == null) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function rebookMissedKey(day) {
  return day?.dateKey || (day?.date ? toDateKey(day.date) : "");
}

function captureRebookSnapshot(scope = {}) {
  const missedKey = scope.missedKey || rebookMissedKey(scope.day);
  return {
    touch: captureRebookTouch(state, {
      learnerId: scope.learnerId || "",
      missedKey,
      dateKey: scope.dateKey || "",
      planResult: uiState.planResult,
    }),
    selectedDateKey: uiState.selectedDateKey,
    selectedDay: uiState.selectedDay,
    calendarTime: uiState.calendarMonth.getTime(),
    highlightedStopId: uiState.highlightedStopId,
    workingDates: cloneRebookData(state.settings?.workingDates || []),
    savedAt: state.savedAt || "",
    baseSavedAt: state.baseSavedAt || "",
    sessionSavedAt: peekSessionSavedAt(),
  };
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function restoreRebookSnapshot(before, applied, meta = {}) {
  if (!before?.touch) return { restored: false };
  const outcome = restoreRebookTouch(state, before.touch, applied?.touch || null, uiState.planResult);
  if (!outcome.restored) return outcome;
  if (!applied || uiState.selectedDateKey === applied.selectedDateKey) {
    uiState.selectedDateKey = before.selectedDateKey;
    uiState.selectedDay = before.selectedDay;
    uiState.calendarMonth = new Date(before.calendarTime);
    uiState.highlightedStopId = before.highlightedStopId;
  }
  if (!state.settings) state.settings = {};
  if (!applied || sameJson(state.settings.workingDates, applied.workingDates)) {
    state.settings.workingDates = cloneRebookData(before.workingDates);
  }
  const stampNow = peekSessionSavedAt();
  const resetStamp = !meta.sessionSavedAt || stampNow === meta.sessionSavedAt;
  if (resetStamp) {
    state.savedAt = before.savedAt;
    state.baseSavedAt = before.baseSavedAt;
    restoreLocalCopy(state, before.sessionSavedAt);
  } else {
    restoreLocalCopy(state, stampNow);
  }
  renderCalendar();
  return outcome;
}

function keepMissedDayExclusion(missedKey, learnerId) {
  if (!missedKey || !learnerId) return;
  if (!state.excludedFromDate[missedKey]) state.excludedFromDate[missedKey] = [];
  if (!state.excludedFromDate[missedKey].includes(learnerId)) {
    state.excludedFromDate[missedKey].push(learnerId);
  }
}

export function syncRebookChrome(form, { dateKey = "", timeValue = "", fit = null, checking = false } = {}) {
  if (!form?.dataset?.rebookForm) return;
  const when = rebookVisitDateLabel(dateKey);
  const dateLabel = (() => {
    const date = dateFromKey(dateKey);
    if (!date || Number.isNaN(date.getTime())) return "";
    const weekday = weekdayName(date);
    return weekday ? `${weekday} ${formatShortDate(date)}` : formatShortDate(date);
  })();
  const keepsDate = Boolean(dateKey) && dateKey !== uiState.selectedDateKey;
  const timeLabel = timeValue ? formatTime(parseTimeToMinutes(timeValue)) : "";
  const booking = when && timeLabel ? `${when} at ${timeLabel}` : "";
  form.querySelectorAll("[data-rebook-day]").forEach((button) => {
    const on = button.dataset.rebookDay === dateKey;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const summary = form.querySelector("[data-rebook-summary]");
  const save = form.querySelector("[data-rebook-save]");
  const queue = form.querySelector("[data-rebook-queue]");
  const queueNote = form.querySelector("[data-rebook-queue-note]");
  const preview = form.querySelector("[data-slot-preview]");
  if (preview) preview.setAttribute("aria-busy", checking ? "true" : "false");
  if (queue) queue.textContent = "Back To Queue";
  if (queueNote) {
    queueNote.textContent = !dateKey
      ? "No date is kept. This visit is left empty and they go back in the queue to plan."
      : keepsDate
        ? `Keeps ${dateLabel} as the preferred date. No arrival time is booked, and this visit is left empty.`
        : "This visit is left empty. That day is the one they missed, so it is not kept as a preferred date.";
  }
  if (save) {
    save.textContent = "Book Appointment";
    const detail = booking ? ` for ${booking}` : when ? ` for ${when}` : "";
    save.setAttribute("aria-label", `Book appointment${detail}`);
  }
  if (!summary) return;
  summary.classList.remove("is-ok", "is-blocked");
  if (checking) {
    summary.textContent = booking ? `Checking ${booking}…` : "Pick a day to see who is already on it.";
    return;
  }
  if (!dateKey) {
    summary.textContent = "Pick a new day. This visit stays empty either way.";
    return;
  }
  if (dateKey === uiState.selectedDateKey) {
    summary.textContent = "That is the visit they missed. Pick a different day.";
    summary.classList.add("is-blocked");
    return;
  }
  if (!when) {
    summary.textContent = "Pick a weekday. Reviews are not booked on Saturday or Sunday.";
    summary.classList.add("is-blocked");
    return;
  }
  if (!timeLabel) {
    summary.textContent = `${when} is selected. Tap a time that fits.`;
    return;
  }
  if (fit?.ok) {
    summary.textContent = `Books them for ${booking}. This visit stays empty.`;
    summary.classList.add("is-ok");
    return;
  }
  if (fit && !fit.ok) {
    summary.textContent = "That time does not fit. Tap one of the times below.";
    summary.classList.add("is-blocked");
    return;
  }
  summary.textContent = booking ? `Checking ${booking}…` : "Pick a day and a time.";
}

export function rebookFormHtml(stop, day) {
  if (uiState.rebookStopId !== stop.id) return "";
  const learner = plannerStopLearner(stop) || rebookPanelLearner(stop.id) || stop;
  const name = learner.name || stop.name || "This learner";
  const panelId = `rebook-panel-${stop.id}`;
  const titleId = `rebook-title-${stop.id}`;
  const summaryId = `rebook-summary-${stop.id}`;
  const errorId = `rebook-error-${stop.id}`;
  const queueNoteId = `rebook-queue-note-${stop.id}`;
  const dayKeys = rebookWorkingDayKeys(day, new Date(), learner);
  const drafted = uiState.rebookDraft?.learnerId === stop.id ? uiState.rebookDraft : null;
  const dateValue = drafted?.dateKey || dayKeys[0] || "";
  const timeValue = drafted?.timeValue || "";
  const when = rebookVisitDateLabel(dateValue);
  const bounds = rebookMonthBounds(day);
  const visible = dateValue ? rebookMonthStart(dateFromKey(dateValue)) : bounds.start;
  const calendar = rebookCalendarCells(day, visible, dateValue, learner);
  const atStart = visible.getTime() <= bounds.start.getTime();
  const atEnd = visible.getTime() >= bounds.end.getTime();
  return `
    <form class="appointment-form book-time-form rebook-panel" id="${escapeHtml(panelId)}" data-rebook-form="${escapeHtml(stop.id)}" data-rebook-panel aria-labelledby="${escapeHtml(titleId)}">
      <h3 id="${escapeHtml(titleId)}" class="visually-hidden" data-rebook-title tabindex="-1">Rebook ${escapeHtml(name)}</h3>
      <fieldset class="rebook-when">
        <legend class="visually-hidden">Working day</legend>
        <div class="rebook-month">
          <button type="button" class="btn ghost cal-nav" data-rebook-month="-1" aria-label="Previous month"${atStart ? " disabled" : ""}>‹</button>
          <strong data-rebook-month-label>${escapeHtml(calendar.label)}</strong>
          <button type="button" class="btn ghost cal-nav" data-rebook-month="1" aria-label="Next month"${atEnd ? " disabled" : ""}>›</button>
        </div>
        <div class="rebook-cal" data-rebook-cal data-rebook-shown="${escapeHtml(calendar.value)}" role="group" aria-label="${escapeHtml(`Days in ${calendar.label}`)}">${calendar.cells}</div>
        <input type="hidden" data-rebook-date value="${escapeHtml(dateValue)}" />
      </fieldset>
      ${slotPreviewShell({ live: false })}
      <input type="hidden" data-rebook-time value="${escapeHtml(timeValue)}" />
      <p class="rebook-summary" id="${escapeHtml(summaryId)}" data-rebook-summary${uiState.rebookErrorText ? "" : ' role="status"'}>${when ? `Checking ${escapeHtml(when)}…` : "Pick a working day."}</p>
      ${rebookErrorBoxHtml({ id: errorId, message: uiState.rebookErrorText, escapeHtml })}
      <div class="appointment-form-actions rebook-actions">
        <button type="submit" class="btn pill rebook-book" data-rebook-save data-rebook-bookable="${timeValue ? "pending" : "false"}" aria-describedby="${escapeHtml(summaryId)}" aria-label="${when ? `Book appointment for ${escapeHtml(when)}` : "Book appointment"}"${isRebookBusy() || !timeValue ? " disabled" : ""}>Book Appointment</button>
      </div>
      <div class="rebook-queue">
        <button type="button" class="btn pill ghost" data-rebook-queue="${escapeHtml(stop.id)}" aria-describedby="${escapeHtml(queueNoteId)}"${isRebookBusy() ? " disabled" : ""}>Back To Queue</button>
        <p class="visually-hidden" id="${escapeHtml(queueNoteId)}" data-rebook-queue-note>${when ? `Keeps ${escapeHtml(when)} as the preferred date. No arrival time is booked, and this visit is left empty.` : "This visit is left empty and they go back in the queue to plan."}</p>
      </div>
    </form>
  `;
}

export function rebookBookingProblem(day, { dateKey = "", timeValue = "", recheck = false, learner = null } = {}) {
  if (!recheck && !timeValue) return "Tap a time that fits.";
  const missedKey = toDateKey(day.date);
  const date = dateFromKey(dateKey);
  const described = date
    ? describeRebookDate(date, dateKey, missedKey, new Date(), learner)
    : { bookable: false, reason: "not a working day" };
  if (!described.bookable) return rebookChoiceError(described.reason);
  if (recheck) return "";
  const arriveMinutes = parseTimeToMinutes(timeValue);
  const startMinutes = parseTimeToMinutes(state.settings.startTime || "10:00");
  const returnBy = rebookReturnByMinutes();
  const stay = Number(state.settings.stayMinutes) || 30;
  if (
    !Number.isFinite(arriveMinutes) ||
    arriveMinutes < startMinutes ||
    arriveMinutes + stay > returnBy
  ) {
    return `Arrival needs to be during the working day (${formatTime(startMinutes)}–${formatTime(returnBy - stay)}).`;
  }
  return "";
}

export async function rebookClashProblem(learner, { dateKey = "", timeValue = "" } = {}) {
  const date = dateFromKey(dateKey);
  const arriveMinutes = parseTimeToMinutes(timeValue);
  const settings = currentPlannerSettings();
  const clash = await clashForRequestedTime(learner, dateKey, arriveMinutes, settings);
  if (clash === false) {
    const message = statusEl?.textContent || "Could not check that time against the round.";
    setStatus("");
    return { message };
  }
  if (!clash) return null;
  return {
    message: clashStatus({
      date,
      arriveMinutes,
      withName: clash.learner?.name || "a locked visit",
      withArrive: clash.arrive,
      withLeave: clash.leave,
      reason: clash.reason,
    }),
  };
}

async function applyRebookBooking({ learner, day, learnerId, dateKey, timeValue }) {
  const date = dateFromKey(dateKey);
  const arriveMinutes = parseTimeToMinutes(timeValue);
  const missedKey = toDateKey(day.date);
  detachLearnerFromDay(day, learnerId);
  if (state.excludedFromDate[dateKey]) {
    state.excludedFromDate[dateKey] = state.excludedFromDate[dateKey].filter((id) => id !== learnerId);
    if (!state.excludedFromDate[dateKey].length) delete state.excludedFromDate[dateKey];
  }
  writeLearnerAppointment(learner, normaliseAppointment({ dateKey, arriveMinutes }));
  clearAwaitingForLearner(learner.id);
  touchLearner(learner);
  try {
    return await placeAppointmentOnPlan(learner, dateKey, date, "", {
      fillGaps: false,
      announce: false,
      render: false,
    });
  } finally {
    keepMissedDayExclusion(missedKey, learnerId);
  }
}

async function applyRebookQueue({ learner, day, learnerId, dateKey }) {
  const missedKey = toDateKey(day.date);
  detachLearnerFromDay(day, learnerId);
  if (normaliseAppointment(learner.appointment)?.dateKey === missedKey) {
    writeLearnerAppointment(learner, null);
    touchLearner(learner);
    clearFrozenTime(missedKey, learnerId);
  }
  if (dateKey && dateKey !== missedKey) {
    applyLearnerProfile(learner, {
      ...learnerProfileFrom(learner),
      plannedReviewDate: dateKey,
    });
  }
  keepMissedDayExclusion(missedKey, learnerId);
  if (uiState.planCache) {
    applyCurrentPlan({
      fillGaps: false,
      updateStatus: false,
      refreshMap: false,
      render: false,
    });
    return;
  }
  await refreshPlannedWeek({ rebuild: true, fillGaps: false, render: false });
}

export function rebookDeps() {
  return {
    findLearner(learnerId) {
      return rebookPanelLearner(learnerId);
    },
    formFor(learnerId) {
      return dayDetail.querySelector(rebookFormSelector(learnerId));
    },
    readChoice(form) {
      return {
        dateKey: form?.querySelector("[data-rebook-date]")?.value || "",
        timeValue: form?.querySelector("[data-rebook-time]")?.value || "",
      };
    },
    validateBooking(input) {
      return rebookBookingProblem(input.day, input);
    },
    checkClash(input) {
      return rebookClashProblem(input.learner, input);
    },
    capture: captureRebookSnapshot,
    restore: restoreRebookSnapshot,
    holdPersist(on) {
      if (on) beginRebookHold();
    },
    applyBooking: applyRebookBooking,
    applyQueue: applyRebookQueue,
    save: saveRebookState,
    revealFailure: revealRebookFailure,
    finish: finishRebookClose,
    showError(form, message) {
      showRebookError(form, message);
    },
    setBusy: setRebookFormBusy,
    bookedMessage({ learner, dateKey, timeValue }) {
      const date = dateFromKey(dateKey);
      const arriveMinutes = parseTimeToMinutes(timeValue);
      return `${learner.name} was not there, so this visit was left empty and they are rebooked ${weekdayName(date)} ${formatShortDate(date)} at ${formatTime(arriveMinutes)}.`;
    },
    queuedMessage({ learner, day, dateKey }) {
      const missedKey = toDateKey(day.date);
      const kept = dateKey && dateKey !== missedKey ? ` The ${formatUkDateKey(dateKey)} date is kept.` : "";
      return `${learner.name} is back in the queue to plan.${kept} This visit was left empty.`;
    },
    reportError(error) {
      console.error("Failed to rebook visit:", error?.message || error);
    },
  };
}

export function stopIsValidated(stop, dateKey, verified, now = new Date()) {
  if (isConfirmedStop(stop, verified)) return true;
  const learner =
    (state.learners || []).find((item) => item.id === stop?.id) ||
    (state.followUps || []).find((item) => item.id === stop?.id);
  if (normaliseAppointment(learner?.appointment)?.dateKey === dateKey) return true;
  return isAwaitingActive(state.awaitingReply?.[dateKey]?.[stop?.id], dateKey, now);
}

export function renderPlan({ refreshMap = true } = {}) {
  const viewing = displayPlanDay(uiState.selectedDateKey);
  if (!uiState.planResult && !viewing) {
    dayDetail.innerHTML =
      '<p class="empty">Add your learners, then plan the week to see arrival and departure times.</p>';
    mountRouteActions();
    return;
  }

  const unlocated = uiState.planResult?.unlocated || [];
  const leftoverNotes = [];
  if (unlocated.length) {
    leftoverNotes.push(
      `Could not find: ${unlocated
        .map((learner) => `${learner.name} (${learner.postcode})`)
        .join(", ")}`,
    );
  }
  if ((uiState.planResult?.days || []).some((day) => day.droppedUnverified)) {
    leftoverNotes.push(
      "Unverified learners were moved after the call window.",
    );
  }
  if (leftoverNotes.length) {
    leftoverEl.hidden = false;
    leftoverEl.textContent = leftoverNotes.join(" ");
  } else {
    leftoverEl.hidden = true;
  }

  const day = viewing || displayPlanDay(uiState.selectedDateKey);
  dayDetail.innerHTML = renderDay(day);
  mountRouteActions();
  revealOpenTimePicker();
  playPlanCardOpening();
  if (uiState.rosterDragId) syncRosterDropSlot();
  if (refreshMap) {
    if (uiState.planResult && day && !day.lookback && day.stops?.length) drawMap(day);
    else if (uiState.planResult) drawMap({ stops: [] });
  }
  renderPlanNotes();
}

function completedLearnerPills(learner) {
  return `
    <span class="priority-tag on-track">On track</span>
    ${safeguardingPill(learner)}
    <span class="verified-tag">Review done</span>
  `;
}

export function completedLearnerActions(learner) {
  if (!learner?.id) return "";
  const noteLabel = learnerNoteText(learner) ? "Edit note" : "Add note";
  return `<div class="stop-action-grid">
    <button type="button" class="btn blue ${isLearnerSheetOpen("details", learner.id) ? "on" : ""}" data-edit-details="${escapeHtml(learner.id)}">Edit details</button>
    <button type="button" class="btn grey ${learnerNoteText(learner) || isLearnerSheetOpen("note", learner.id) ? "on" : ""}" data-note="${escapeHtml(learner.id)}">${noteLabel}</button>
  </div>`;
}

function completedRouteChrome() {
  return `
    <div class="day-actions" data-route-completed="true">
      <span class="route-completed-lock">${lockIconMarkup(true)} Route completed</span>
    </div>
    <p class="route-lock-note">This day is locked. The visits can’t be changed.</p>
  `;
}

function completedReviewStopHtml(learner, dateKey) {
  const frozen = state.frozenTimes?.[dateKey]?.[learner.id];
  const accepted = (state.acceptedRoutes?.[dateKey]?.stops || []).find(
    (stop) => stop.id === learner.id,
  );
  const arrive = frozen?.arrive ?? accepted?.arrive;
  const leave = frozen?.leave ?? accepted?.leave;
  const when =
    arrive != null && leave != null
      ? `${formatTime(arrive)}–${formatTime(leave)}`
      : "Done";
  const open = uiState.openStopContactId === learner.id;
  return `
    <div class="stop plan-card${open ? ` is-open${planCardOpeningClass(learner.id)}` : " is-closed"}" data-stop-contact="${escapeHtml(learner.id)}">
      <div class="when">${when}</div>
      <div class="stop-body">
        <div class="stop-head">
          <strong class="stop-name">${escapeHtml(learner.name || "Learner")}</strong>
          <div class="stop-pills">
            ${completedLearnerPills(learner)}
          </div>
        </div>
        ${stopContactLine(learner)}
        <div class="stop-extra">
          <div class="meta">${escapeHtml(learnerPlaceMeta(learner))}</div>
          ${completedLearnerActions(learner)}
          ${plannerStopLearnerPanel(learner, { routeCompleted: true })}
        </div>
      </div>
    </div>
  `;
}

function renderDay(day) {
  if (!day) {
    return '<p class="empty">Choose a day to see the round.</p>';
  }

  const completed = day.completedReviews || reviewsDoneOnDate(day.dateKey);
  const extraCompleted = day.extraCompleted || [];
  const completedIds = day.completedIds || new Set(completed.map((item) => item.id));
  const isLookback =
    !day.accepted &&
    !(day.stops?.length || day.phoneStops?.length) &&
    (Boolean(day.lookback) ||
      (day.dateKey < toDateKey(startOfLocalDay(new Date())) &&
        !day.available &&
        completed.length));

  if (isLookback) {
    if (!completed.length) {
      return `<p class="empty">No reviews recorded on ${day.day} ${formatShortDate(day.date)}.</p>`;
    }
    return `
      ${completedRouteChrome()}
      <div class="timeline">${completed
        .map((learner) => completedReviewStopHtml(learner, day.dateKey))
        .join("")}</div>
    `;
  }

  if (!day.accepted && !day.available && day.skipReason === "skipped") {
    return `<p class="empty">Skipping ${day.day} ${formatShortDate(day.date)} so you can book tomorrow. Uncheck “Skip today” if you need a round today.</p>`;
  }

  if (!day.accepted && !day.available && day.skipReason === "passed" && !completed.length) {
    return `<p class="empty">${day.day} ${formatShortDate(day.date)} has already passed. Reviews are planned from today onwards.</p>`;
  }

  const planSettings = uiState.planResult?.settings || currentPlannerSettings();
  const planOffice = uiState.planResult?.office || {
    postcode: state.settings?.officePostcode || "",
  };
  const dayStops = day.stops || [];

  if (!day.accepted && !day.available && day.skipReason === "too-late" && !completed.length) {
    return `<p class="empty">It's too late to start a round today and still be back by ${formatTime(planSettings.returnBy)}.</p>`;
  }

  if (!hasDayWork(day) && !completed.length) {
    return `<p class="empty">No visits on ${day.day} ${formatShortDate(day.date)}. Either everyone is in college, or they already fit on remaining days.</p>`;
  }

  const rows = [];
  const callMinutes = planSettings.callMinutes || 0;
  const callStart = day.callStart ?? day.startMinutes;
  const callEnd = day.callEnd ?? day.leaveMinutes ?? day.startMinutes;
  const leaveMinutes = day.leaveMinutes ?? callEnd;
  const phoneStops = day.phoneStops || [];
  const routeCompleted = dayIsPermanentlyComplete(day);

  for (const stop of phoneStops) {
    const open =
      uiState.openStopContactId === stop.id ||
      (!routeCompleted &&
        (uiState.appointmentEditorId === stop.id || uiState.phoneEditorId === stop.id)) ||
      uiState.noteEditorId === stop.id;
    const phoneLearner = findEditableLearner(stop.id) || stop;
    rows.push(`
      <div class="stop plan-card phone-stop${stopFoundClass(stop.id)}${open ? ` is-open${planCardOpeningClass(stop.id)}` : " is-closed"}" data-stop-contact="${escapeHtml(stop.id)}">
        <div class="when">${formatTime(stop.arrive)}–${formatTime(stop.leave)}</div>
        <div class="stop-body">
          <div class="stop-head">
            <strong class="stop-name">${escapeHtml(stop.name)}</strong>
            <div class="stop-pills">
              ${
                routeCompleted
                  ? completedLearnerPills(phoneLearner)
                  : `<span class="pill status-chip round">Phone review</span>
              ${safeguardingPill(phoneLearner)}
              <span class="priority-tag ${normalisePriority(stop.priority)}">${escapeHtml(stopPriorityLabel(stop))}</span>`
              }
            </div>
          </div>
          ${stopContactLine(stop)}
          <div class="stop-extra">
            <div class="meta">${escapeHtml(learnerPlaceMeta(stop))} · 20 minutes from the office · no driving</div>
            ${routeCompleted ? completedLearnerActions(phoneLearner) : ""}
            ${plannerStopLearnerPanel(stop, { routeCompleted })}
          </div>
        </div>
      </div>
    `);
  }

  if (dayStops.length && callMinutes && callEnd > callStart) {
    rows.push(`
      <div class="stop">
        <div class="when">${formatTime(callStart)}–${formatTime(callEnd)}</div>
        <div>
          <strong>Confirmation calls</strong>
          <div class="meta">${escapeHtml(planOffice.postcode)} · ${callMinutes} minutes for anyone not yet verified. Then set off at ${formatTime(leaveMinutes)}.</div>
        </div>
      </div>
    `);
  }

  if (dayStops.length) {
    rows.push(`
    <div class="stop">
      <div class="when">${formatTime(leaveMinutes)}</div>
      <div>
        <strong>Leave office</strong>
        <div class="meta">${escapeHtml(planOffice.postcode)}</div>
      </div>
    </div>
  `);
  }

  const verified = verifiedIds(state.verifiedByDate, toDateKey(day.date));
  const dateKey = toDateKey(day.date);
  const now = new Date();
  const canDragStops =
    !routeCompleted &&
    Boolean(dayStops.length > 1) &&
    Boolean(day.available || day.accepted) &&
    !isLookback;

  const routeStops = [...dayStops].sort(
    (a, b) => a.arrive - b.arrive || a.leave - b.leave,
  );
  routeStops.forEach((stop, index) => {
    const next = routeStops[index + 1];
    const crossesLunch =
      stop.leave <= planSettings.lunchStart &&
      ((next &&
        next.arrive >= stop.leave &&
        next.arrive >= planSettings.lunchEnd) ||
        (!next && day.returnArrive >= planSettings.lunchEnd));
    const stopLearner =
      (state.learners || []).find((item) => item.id === stop.id) ||
      (state.followUps || []).find((item) => item.id === stop.id);
    const isBooked =
      Boolean(stop.booked) ||
      normaliseAppointment(stopLearner?.appointment)?.dateKey === dateKey;
    const canDrag = canDragStops && !isBooked;
    const isVerified =
      day.accepted || isBooked || verified.has(stop.id);
    const awaiting = state.awaitingReply?.[dateKey]?.[stop.id];
    const waitingActive = isAwaitingActive(awaiting, dateKey, now);
    const actions = planStopActions(stop, {
      isBooked,
      verifiedOnDay: verified.has(stop.id),
      waitingActive,
      dayAccepted: Boolean(day.accepted),
      routeCompleted,
    });

    const open =
      uiState.openStopContactId === stop.id ||
      (!routeCompleted &&
        (uiState.appointmentEditorId === stop.id ||
          uiState.phoneEditorId === stop.id ||
          uiState.rebookStopId === stop.id)) ||
      uiState.noteEditorId === stop.id;
    const undoRow = routeCompleted ? "" : rosterUndoRowHtml(stop.id, dateKey);
    rows.push(`
      <div class="stop plan-card${stopFoundClass(stop.id)}${open ? ` is-open${planCardOpeningClass(stop.id)}` : " is-closed"}${canDrag ? " can-drag" : ""}${undoRow ? " has-roster-undo" : ""}" data-stop-contact="${escapeHtml(stop.id)}" data-route-stop="${escapeHtml(stop.id)}" data-route-booked="${isBooked ? "true" : "false"}">
        <div class="when">
          <span class="arrive">${formatTime(stop.arrive)}</span><span class="until">–${formatTime(stop.leave)}</span>
        </div>
        <div class="stop-body">
          <div class="stop-head">
            <strong class="stop-name">
              ${canDrag ? routeDragHandleHtml(stop) : ""}
              <span class="stop-num" aria-hidden="true">${index + 1}</span>
              ${escapeHtml(stop.name)}
            </strong>
            <div class="stop-pills">
              ${
                routeCompleted
                  ? completedLearnerPills(stopLearner || stop)
                  : `<span class="priority-tag ${normalisePriority(stop.priority)}">${escapeHtml(stopPriorityLabel(stop))}</span>
              ${safeguardingPill(stopLearner || stop)}
              ${completedIds.has(stop.id) ? '<span class="verified-tag">Review done</span>' : isBooked ? '<span class="verified-tag">Booked time</span>' : isVerified ? '<span class="verified-tag">Verified</span>' : ""}
              ${waitingActive ? '<span class="waiting-tag">Locked</span>' : ""}`
              }
            </div>
          </div>
          ${stopContactLine(stopLearner)}
          ${undoRow}
          <div class="stop-extra">
            <div class="meta">${escapeHtml(learnerPlaceMeta(stop))}</div>
            ${actions}
            ${plannerStopLearnerPanel(stop, { routeCompleted })}
            ${routeCompleted ? "" : rebookFormHtml(stop, day)}
          </div>
        </div>
      </div>
    `);

    if (crossesLunch) {
      rows.push(`
        <div class="lunch-block">
          Lunch ${formatTime(planSettings.lunchStart)}–${formatTime(planSettings.lunchEnd)}. No reviews in this window.
        </div>
      `);
    }
  });

  if (dayStops.length) {
  rows.push(`
    <div class="stop">
      <div class="when">${formatTime(day.returnArrive)}</div>
      <div>
        <strong>Back at office</strong>
        <div class="meta">${escapeHtml(planOffice.postcode)} · ${formatDuration(day.returnTravel)} drive</div>
      </div>
    </div>
  `);
  }

  const verifiedCount = dayStops.filter((stop) =>
    stopIsValidated(stop, dateKey, verified, now),
  ).length;
  const allVerified =
    !dayStops.length ||
    (Boolean(dayStops.length) && verifiedCount === dayStops.length);
  const acceptButton = `<button type="button" class="btn accept route-accept" data-accept-day ${allVerified ? "" : "disabled"}>Accept Route</button>`;
  const completeButton = `<button type="button" class="btn accept route-accept" data-complete-route>Mark route completed</button>`;

  if (routeCompleted) {
    return `
      ${completedRouteChrome()}
      <div class="timeline">${rows.join("")}${
        extraCompleted.length
          ? extraCompleted
              .map((learner) => completedReviewStopHtml(learner, day.dateKey))
              .join("")
          : ""
      }</div>
    `;
  }

  return `
    <div class="day-actions">
      ${outPageEnabled() ? `<button type="button" class="btn ghost" data-open-out>Open Out</button>` : ""}
      ${day.accepted ? `<button type="button" class="btn blue" data-email-route>Email this route</button>` : ""}
      ${day.accepted ? `<button type="button" class="btn blue" data-print-route>Print this route</button>` : ""}
      ${day.accepted ? completeButton : acceptButton}
    </div>
    ${day.accepted ? '<p class="accept-note">This day’s learners will not be moved if you plan the week again.</p>' : ""}
    ${day.droppedUnverified ? `<p class="leftover">The ${callMinutes || 60}-minute call window ended. Anyone not verified has been moved to a later day.</p>` : ""}
    <div class="timeline">${rows.join("")}${
      extraCompleted.length
        ? extraCompleted
            .map((learner) => completedReviewStopHtml(learner, day.dateKey))
            .join("")
        : ""
    }</div>
  `;
}
