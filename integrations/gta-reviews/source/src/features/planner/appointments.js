import { planButton } from "../../app/dom.js";
import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { formatDriveLeg } from "../../lib/format.js";
import { escapeHtml } from "../../lib/html.js";
import { cssEscape } from "../../lib/html.js";
import { writeLearnerAppointment } from "../../plan-locks.js";
import { rebookEmptyFitState, rebookEmptyTimesNote } from "../../plan/rebook-panel.js";
import {
  TIME_WINDOWS,
  WEEKDAYS,
  addDays,
  addTravel,
  allowedVisitDays,
  dateFromKey,
  driveBetween,
  employerAllowsArrive,
  employerAllowsDay,
  employerLabel,
  findBestEmployerSlot,
  findLockedTimeClash,
  formatShortDate,
  formatTime,
  isPhoneReview,
  isWeekdayDate,
  nextReviewDateKey,
  normaliseAppointment,
  normaliseEmployer,
  parseTimeToMinutes,
  startOfLocalDay,
  toDateKey,
  weekdayName,
} from "../../planner.js";
import { canBookReview } from "../../reviews.js";
import { clearAwaitingForLearner, state, touchLearner } from "./status.js";

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

export function learnerFormEl(...args) {
  return callHook("learnerFormEl", args, null);
}

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function placeAppointmentOnPlan(...args) {
  return callHook("placeAppointmentOnPlan", args, undefined);
}

export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function findEditableLearner(...args) {
  return callHook("findEditableLearner", args, null);
}

export function removeFrozenTimesForLearner(...args) {
  return callHook("removeFrozenTimesForLearner", args, undefined);
}

export function logCycleBooked(...args) {
  return callHook("logCycleBooked", args, undefined);
}

export function currentPlannerSettings(...args) {
  return callHook("currentPlannerSettings", args, {});
}

export function planTheWeek(...args) {
  return callHook("planTheWeek", args, Promise.resolve(false));
}

export function hydrateLocatedLearners(...args) {
  return callHook("hydrateLocatedLearners", args, undefined);
}

export function ensureLearnerLocated(...args) {
  return callHook("ensureLearnerLocated", args, Promise.resolve(null));
}

export function findRosterLearner(...args) {
  return callHook("findRosterLearner", args, null);
}

export function syncRebookChrome(...args) {
  return callHook("syncRebookChrome", args, undefined);
}

export function bindPlannerAppointments(next) {
  hooks = next || null;
}

function defaultBookDate(learner) {
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  const live = normaliseAppointment(learner.appointment);
  if (uiState.selectedDateKey && uiState.selectedDateKey >= todayKey) {
    const date = dateFromKey(uiState.selectedDateKey);
    const dayName = weekdayName(date);
    if (
      date &&
      isWeekdayDate(date) &&
      dayName !== learner.collegeDay &&
      employerAllowsDay(learner, dayName)
    ) {
      return uiState.selectedDateKey;
    }
  }
  if (live?.dateKey) return live.dateKey;
  const nextDue = nextReviewDateKey(learner);
  const nextDate = nextDue ? dateFromKey(nextDue) : null;
  if (!nextDate) return "";
  for (let offset = 0; offset < 14; offset++) {
    const candidate = addDays(nextDate, offset);
    const key = toDateKey(candidate);
    if (key < todayKey) continue;
    if (!isWeekdayDate(candidate)) continue;
    if (weekdayName(candidate) === learner.collegeDay) continue;
    if (!employerAllowsDay(learner, weekdayName(candidate))) continue;
    return key;
  }
  return "";
}

export function appointmentEditor(learner) {
  if (uiState.appointmentEditorId !== learner.id) return "";
  if (!canBookReview(state, learner) && !normaliseAppointment(learner.appointment)) {
    return `<div class="appointment-form"><p class="meta">Wait until the tutor has sent this review back. Then this visit can be booked.</p></div>`;
  }
  const appointment = normaliseAppointment(learner.appointment);
  const employer = normaliseEmployer(learner.employer);
  const blocked = new Set(employer?.blockedDays || []);
  const window = employer?.window || "any";
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  const dateValue = defaultBookDate(learner);
  const storedArrive = Number(learner.appointment?.arriveMinutes);
  const timeValue = Number.isFinite(storedArrive)
    ? formatTime(storedArrive)
    : appointment
      ? formatTime(appointment.arriveMinutes)
      : "";
  const days = WEEKDAYS.map((day) => {
    const college = day === learner.collegeDay;
    const allowed = !college && !blocked.has(day);
    return `<button type="button" class="btn pill ${allowed ? "on" : "ghost"}" data-employer-day="${day}" aria-pressed="${allowed ? "true" : "false"}" ${college ? "disabled" : ""}>${day.slice(0, 3)}${college ? " college" : ""}</button>`;
  }).join("");
  const windows = TIME_WINDOWS.map(
    (item) =>
      `<button type="button" class="btn pill ${item.id === window ? "on" : "ghost"}" data-employer-window="${item.id}" aria-pressed="${item.id === window ? "true" : "false"}">${item.label}</button>`,
  ).join("");
  return `
    <form class="appointment-form book-time-form" data-appointment-form="${escapeHtml(learner.id)}">
      <p class="meta">Tick the days the employer can do a visit. Book time picks a free slot around your round so it does not overlap verified, booked or held visits.</p>
      <div class="employer-days">${days}</div>
      <p class="meta">Time of day</p>
      <div class="employer-days">${windows}</div>
      <label>
        Specific date
        <input type="date" data-appointment-date min="${escapeHtml(todayKey)}" value="${escapeHtml(dateValue)}" />
      </label>
      <label>
        Arrive
        <input type="time" data-appointment-time value="${timeValue}" />
      </label>
      ${slotPreviewShell()}
      <p class="meta book-time-hint">Leave the time blank and Book time will choose a free slot. Or pick a day and tap a time that fits.</p>
      <div class="appointment-form-actions">
        <button type="submit" class="btn pill primary" data-appointment-save="${escapeHtml(learner.id)}">Book time</button>
        ${appointment ? `<button type="button" class="btn pill ghost" data-roll-next-week="${escapeHtml(learner.id)}">Roll to next week</button>` : ""}
        ${appointment || employer ? `<button type="button" class="btn pill danger" data-appointment-clear="${escapeHtml(learner.id)}">Clear</button>` : ""}
      </div>
    </form>
  `;
}

function readEmployerFromForm(learner) {
  const formEl = learnerFormEl(`[data-appointment-form="${cssEscape(learner.id)}"]`);
  if (!formEl) return normaliseEmployer(learner.employer);
  const blockedDays = WEEKDAYS.filter((day) => {
    if (day === learner.collegeDay) return false;
    const button = formEl.querySelector(`[data-employer-day="${cssEscape(day)}"]`);
    return button && button.getAttribute("aria-pressed") !== "true";
  });
  const windowBtn = formEl.querySelector(
    "[data-employer-window][aria-pressed='true']",
  );
  return normaliseEmployer({
    blockedDays,
    window: windowBtn?.dataset.employerWindow || "any",
  });
}

export async function saveLearnerAppointment(learnerId) {
  const learner =
    state.learners.find((item) => item.id === learnerId) ||
    (state.followUps || []).find((item) => item.id === learnerId);
  const formEl = learnerFormEl(`[data-appointment-form="${cssEscape(learnerId)}"]`);
  if (!learner || !formEl) return;
  if (!canBookReview(state, learner)) {
    setStatus("Wait until the tutor has sent this review back before booking.");
    return;
  }
  const employer = readEmployerFromForm(learner);
  if (employer && !allowedVisitDays({ ...learner, employer }).length) {
    setStatus("Leave at least one weekday open besides college.");
    return;
  }
  learner.employer = employer;
  learner.phoneReview = false;
  learner.phoneReviewDay = "";
  scheduleStateSave();

  const dateKey = formEl.querySelector("[data-appointment-date]")?.value || "";
  const timeValue = formEl.querySelector("[data-appointment-time]")?.value || "";
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  if (dateKey && dateKey < todayKey) {
    setStatus("That date has already passed. Pick the day you are planning, from today onwards.");
    return;
  }
  if (timeValue && !dateKey) {
    setStatus("Pick a date as well, or clear the arrival time and Book time will choose a free slot.");
    return;
  }
  if (dateKey && !timeValue) {
    const date = dateFromKey(dateKey);
    if (!date || !isWeekdayDate(date)) {
      setStatus("Pick a weekday if you want Book time to stay on that date.");
      return;
    }
    if (!employerAllowsDay({ ...learner, employer }, weekdayName(date))) {
      setStatus("That date is not one of the days the employer can do.");
      return;
    }
  }
  if (dateKey && timeValue) {
    const date = dateFromKey(dateKey);
    if (!date || !isWeekdayDate(date)) {
      setStatus("Pick a weekday for the site visit.");
      return;
    }
    if (!employerAllowsDay({ ...learner, employer }, weekdayName(date))) {
      setStatus("That date is not one of the days the employer can do.");
      return;
    }
    const arriveMinutes = parseTimeToMinutes(timeValue);
    const startMinutes = parseTimeToMinutes(state.settings.startTime || "10:00");
    const returnBy = parseTimeToMinutes(state.settings.returnBy || "16:45");
    const stay = Number(state.settings.stayMinutes) || 30;
    const settings = currentPlannerSettings();
    if (arriveMinutes < startMinutes || arriveMinutes + stay > returnBy) {
      setStatus(
        `Arrival needs to be during the working day (${formatTime(startMinutes)}–${formatTime(returnBy - stay)}).`,
      );
      return;
    }
    const clash = await clashForRequestedTime(learner, dateKey, arriveMinutes, settings);
    if (clash === false) return;
    if (clash) {
      setStatus(
        clashStatus({
          date,
          arriveMinutes,
          withName: clash.learner?.name || "a locked visit",
          withArrive: clash.arrive,
          withLeave: clash.leave,
          reason: clash.reason,
        }),
      );
      return;
    }
    const lunchStart = settings.lunchStart;
    if (employer?.window === "afternoon" && arriveMinutes < lunchStart) {
      learner.employer = normaliseEmployer({ ...employer, window: "any" });
    }
    if (employer?.window === "morning" && arriveMinutes + stay > lunchStart) {
      learner.employer = normaliseEmployer({ ...employer, window: "any" });
    }
    writeLearnerAppointment(learner, normaliseAppointment({ dateKey, arriveMinutes }));
    clearAwaitingForLearner(learner.id);
    touchLearner(learner);
    logCycleBooked(learner);
    uiState.appointmentEditorId = "";
    scheduleStateSave();
    renderLearners();
    await placeAppointmentOnPlan(
      learner,
      dateKey,
      date,
      `${learner.name} is booked on site ${formatShortDate(date)} at ${formatTime(arriveMinutes)}.`,
    );
    return;
  }

  await bookBestAvailableTime(learner, { preferDateKey: dateKey });
}

export async function clashForRequestedTime(learner, dateKey, arriveMinutes, settings) {
  try {
    if (!uiState.planCache) {
      await planTheWeek({ resetSelection: false, fillGaps: true });
    }
  } catch (error) {
    setStatus(error.message || "Could not check that time against the round.");
    planButton.disabled = false;
    return false;
  }
  hydrateLocatedLearners();
  const located = uiState.planCache?.locatedLearners.find((item) => item.id === learner.id);
  const pool = located
    ? uiState.planCache.locatedLearners.map((item) =>
        item.id === learner.id
          ? {
              ...located,
              employer: learner.employer,
              collegeDay: learner.collegeDay,
              appointment: learner.appointment,
            }
          : item,
      )
    : state.learners;
  return findLockedTimeClash(
    located || learner,
    arriveMinutes,
    dateKey,
    pool,
    uiState.planCache?.matrix || { durations: [] },
    settings,
    new Date(),
    state.acceptedRoutes,
    state.awaitingReply,
    state.frozenTimes,
  );
}

export function slotPreviewShell({ live = true } = {}) {
  const liveAttr = live ? ' role="status"' : "";
  return `
    <div class="slot-preview" data-slot-preview>
      <div data-slot-day><p class="meta">Pick a day to see who is already on it and which times fit.</p></div>
      <div data-slot-choices></div>
      <p class="roster-drop-hint" data-slot-fit${liveAttr} hidden></p>
    </div>
  `;
}

function earliestLeaveMinutes(dateKey, settings) {
  const start = Number(settings.startMinutes) || 10 * 60;
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  if (dateKey !== todayKey) return start;
  const now = new Date();
  return Math.max(start, now.getHours() * 60 + now.getMinutes());
}

function matrixIndexForStop(stop) {
  if (Number.isFinite(stop?.matrixIndex)) return stop.matrixIndex;
  const located = uiState.planCache?.locatedLearners?.find((item) => item.id === stop?.id);
  return located?.matrixIndex ?? null;
}

function knownDayVisits(dateKey, exceptId) {
  const planned = (uiState.planResult?.days || []).find(
    (day) => (day.dateKey || toDateKey(day.date)) === dateKey,
  );
  const fromPlan = (planned?.stops || [])
    .filter((stop) => stop?.id && stop.id !== exceptId && Number.isFinite(stop.arrive))
    .map((stop) => ({
      id: stop.id,
      name: stop.name || "Visit",
      arrive: stop.arrive,
      leave: Number.isFinite(stop.leave) ? stop.leave : stop.arrive,
      matrixIndex: stop.matrixIndex,
    }));
  if (planned) return fromPlan.sort((a, b) => a.arrive - b.arrive || a.leave - b.leave);
  const stay = Number(currentPlannerSettings().stayMinutes) || 30;
  const rows = [];
  for (const learner of [...(state.learners || []), ...(state.followUps || [])]) {
    if (!learner?.id || learner.id === exceptId) continue;
    const appointment = normaliseAppointment(learner.appointment);
    if (appointment?.dateKey !== dateKey) continue;
    rows.push({
      id: learner.id,
      name: learner.name,
      arrive: appointment.arriveMinutes,
      leave: appointment.arriveMinutes + stay,
      matrixIndex: uiState.planCache?.locatedLearners?.find((item) => item.id === learner.id)?.matrixIndex,
    });
  }
  return rows.sort((a, b) => a.arrive - b.arrive || a.leave - b.leave);
}

function visitOverlapsLunch(arrive, leave, settings) {
  return arrive < settings.lunchEnd && leave > settings.lunchStart;
}

function scoreVisit(learner, located, dateKey, arriveMinutes, settings) {
  const date = dateFromKey(dateKey);
  const dayName = date ? weekdayName(date) : "";
  if (!learner) return { ok: false, message: "That learner is no longer on the list." };
  if (!date || !isWeekdayDate(date)) return { ok: false, message: "Pick a weekday." };
  if (learner.collegeDay === dayName) {
    return { ok: false, message: `${learner.name} is at college on ${dayName}.` };
  }
  if (!employerAllowsDay(learner, dayName)) {
    return { ok: false, message: `${learner.name} cannot be visited on ${dayName}.` };
  }
  const startMinutes = Number(settings.startMinutes) || 10 * 60;
  const stay = Number(settings.stayMinutes) || 30;
  const returnBy = settings.returnBy;
  const leave = arriveMinutes + stay;
  if (!Number.isFinite(arriveMinutes) || arriveMinutes < startMinutes || leave > returnBy) {
    return {
      ok: false,
      message: `Pick a time between ${formatTime(startMinutes)} and ${formatTime(returnBy - stay)}.`,
    };
  }
  if (visitOverlapsLunch(arriveMinutes, leave, settings)) {
    return {
      ok: false,
      message: `That runs into lunch (${formatTime(settings.lunchStart)}–${formatTime(settings.lunchEnd)}).`,
    };
  }
  if (!employerAllowsArrive(learner, arriveMinutes, leave, settings)) {
    const windowLabel = employerLabel(learner);
    return {
      ok: false,
      message: windowLabel
        ? `The employer can only do ${windowLabel}.`
        : "That time is outside the times the employer can do.",
    };
  }
  if (!located || located.matrixIndex == null || !uiState.planCache?.matrix) {
    return { ok: false, message: "Could not check the drive for that time." };
  }
  const clash = findLockedTimeClash(
    located,
    arriveMinutes,
    dateKey,
    uiState.planCache.locatedLearners || [],
    uiState.planCache.matrix,
    settings,
    new Date(),
    state.acceptedRoutes,
    state.awaitingReply,
    state.frozenTimes,
  );
  if (clash) {
    const who = clash.learner?.name || "another visit";
    const window = `${formatTime(clash.arrive)}–${formatTime(clash.leave)}`;
    return {
      ok: false,
      message:
        clash.reason === "too-close"
          ? `Not free. ${formatTime(arriveMinutes)} does not leave enough drive time around ${who} (${window}).`
          : `Not free. ${formatTime(arriveMinutes)} overlaps ${who} (${window}).`,
    };
  }
  const stops = knownDayVisits(dateKey, learner.id);
  const overlap = stops.find((stop) => arriveMinutes < stop.leave && leave > stop.arrive);
  if (overlap) {
    return {
      ok: false,
      message: `Not free. ${formatTime(arriveMinutes)} overlaps ${overlap.name} (${formatTime(overlap.arrive)}–${formatTime(overlap.leave)}).`,
    };
  }
  const previous = [...stops].reverse().find((stop) => stop.leave <= arriveMinutes);
  const next = stops.find((stop) => stop.arrive >= leave);
  let inbound = null;
  let inboundFrom = "the office";
  if (previous) {
    const fromIndex = matrixIndexForStop(previous);
    inbound = fromIndex == null ? null : driveBetween(uiState.planCache.matrix, fromIndex, located.matrixIndex);
    const minutes = fromIndex === located.matrixIndex ? 0 : inbound?.minutes;
    if (minutes == null) return { ok: false, message: "Could not check the drive from the previous visit." };
    const reach = addTravel(previous.leave, minutes, settings.lunchStart, settings.lunchEnd);
    if (reach > arriveMinutes + 0.5) {
      return {
        ok: false,
        message: `Not free. After ${previous.name} (${formatTime(previous.leave)}) it is ${formatDriveLeg(inbound) || `${Math.round(minutes)} min`}, so the earliest you can arrive is ${formatTime(reach)}.`,
      };
    }
    inboundFrom = previous.name;
  } else {
    inbound = driveBetween(uiState.planCache.matrix, 0, located.matrixIndex);
    if (inbound?.minutes == null) return { ok: false, message: "Could not check the drive from the office." };
    const reach = addTravel(
      earliestLeaveMinutes(dateKey, settings),
      inbound.minutes,
      settings.lunchStart,
      settings.lunchEnd,
    );
    if (reach > arriveMinutes + 0.5) {
      return {
        ok: false,
        message: `Not free. ${formatDriveLeg(inbound)} from the office, so the earliest arrival is ${formatTime(reach)}.`,
      };
    }
  }
  if (next) {
    const toIndex = matrixIndexForStop(next);
    const onward = toIndex == null ? null : driveBetween(uiState.planCache.matrix, located.matrixIndex, toIndex);
    const minutes = toIndex === located.matrixIndex ? 0 : onward?.minutes;
    if (minutes == null) return { ok: false, message: `Could not check the drive on to ${next.name}.` };
    const reach = addTravel(leave, minutes, settings.lunchStart, settings.lunchEnd);
    if (reach > next.arrive + 0.5) {
      return {
        ok: false,
        message: `Not free. ${formatDriveLeg(onward) || `${Math.round(minutes)} min`} on to ${next.name} would arrive at ${formatTime(reach)}, after their ${formatTime(next.arrive)} visit.`,
      };
    }
  }
  const home = driveBetween(uiState.planCache.matrix, located.matrixIndex, 0);
  if (home?.minutes == null) return { ok: false, message: "Could not check the drive back to the office." };
  const back = addTravel(leave, home.minutes, settings.lunchStart, settings.lunchEnd);
  if (back > returnBy + 0.5) {
    return {
      ok: false,
      message: `Not free. ${formatDriveLeg(home)} back to the office would get you in at ${formatTime(back)}, after ${formatTime(returnBy)}.`,
    };
  }
  const inboundText = formatDriveLeg(inbound) || "the drive";
  return {
    ok: true,
    message: `Free at ${formatTime(arriveMinutes)} on ${dayName} ${formatShortDate(date)}. ${inboundText} from ${inboundFrom}. ${formatDriveLeg(home)} back, in the office at ${formatTime(back)} (before ${formatTime(returnBy)}).`,
  };
}

function fittingArrivals(learner, located, dateKey, settings) {
  const stay = Number(settings.stayMinutes) || 30;
  const latest = settings.returnBy - stay;
  const start = Number(settings.startMinutes) || 10 * 60;
  const fits = [];
  for (let minute = start; minute <= latest; minute += 15) {
    if (scoreVisit(learner, located, dateKey, minute, settings).ok) fits.push(minute);
  }
  const stops = knownDayVisits(dateKey, learner.id);
  const extras = [];
  for (const previous of [null, ...stops]) {
    const from = previous ? Math.ceil(previous.leave) : start;
    for (let minute = from; minute <= latest; minute += 1) {
      if (scoreVisit(learner, located, dateKey, minute, settings).ok) {
        extras.push(minute);
        break;
      }
    }
  }
  const merged = [...new Set([...extras, ...fits])].sort((a, b) => a - b);
  const spaced = [];
  for (const minute of merged) {
    if (extras.includes(minute) || !spaced.length || minute - spaced[spaced.length - 1] >= 30) {
      spaced.push(minute);
    }
  }
  return spaced.slice(0, 12);
}

function renderSlotDay(dateKey, exceptId) {
  const date = dateFromKey(dateKey);
  const label = date ? `${weekdayName(date)} ${formatShortDate(date)}` : "that day";
  const planned = (uiState.planResult?.days || []).find(
    (day) => (day.dateKey || toDateKey(day.date)) === dateKey,
  );
  const stops = knownDayVisits(dateKey, exceptId);
  const back =
    planned && stops.length && Number.isFinite(planned.returnArrive)
      ? `<p class="meta">As that day stands, you are back at the office at ${formatTime(planned.returnArrive)}.</p>`
      : "";
  if (!stops.length) return `<p class="meta">Nobody is booked on ${escapeHtml(label)} yet.</p>`;
  const items = stops
    .map(
      (stop) =>
        `<li><span>${formatTime(stop.arrive)}–${formatTime(stop.leave)}</span><strong>${escapeHtml(stop.name)}</strong></li>`,
    )
    .join("");
  return `<p class="meta">Already on ${escapeHtml(label)}</p><ul class="slot-day-list">${items}</ul>${back}`;
}

function renderSlotChoices(minutes, selected, returnBy, { forRebook = false } = {}) {
  if (!minutes.length) {
    if (forRebook) return rebookEmptyTimesNote(formatTime(returnBy), escapeHtml);
    return `<p class="meta">No arrival on this day fits the drive and a return by ${formatTime(returnBy)}.</p>`;
  }
  const buttons = minutes
    .map((minute) => {
      const on = selected === minute;
      return `<button type="button" class="slot-choice${on ? " is-on" : ""}" data-slot-choice="${minute}" aria-pressed="${on ? "true" : "false"}" aria-label="Arrive at ${formatTime(minute)}">${formatTime(minute)}</button>`;
    })
    .join("");
  return `<p class="meta slot-choice-label">Times that fit — tap one</p><div class="slot-choice-row">${buttons}</div>`;
}

let requestedFitToken = 0;

export function onRequestedTimeInput(event) {
  const form = event.target.closest("[data-rebook-form], [data-appointment-form]");
  if (!form) return;
  if (
    !event.target.matches(
      "[data-rebook-date], [data-rebook-time], [data-appointment-date], [data-appointment-time]",
    )
  ) {
    return;
  }
  updateRequestedFit(form);
}

export async function updateRequestedFit(form, { keepError = false } = {}) {
  const token = ++requestedFitToken;
  const hint = form.querySelector("[data-slot-fit]");
  const dayBox = form.querySelector("[data-slot-day]");
  const choiceBox = form.querySelector("[data-slot-choices]");
  const save = form.querySelector("[type=submit]");
  const markSave = (enabled) => {
    if (!save) return;
    save.disabled = !enabled;
    if (save.hasAttribute("data-rebook-save")) {
      save.setAttribute("data-rebook-bookable", enabled ? "true" : "false");
    }
  };
  if (!hint) return;
  const learnerId = form.dataset.rebookForm || form.dataset.appointmentForm;
  const dateKey =
    form.querySelector("[data-rebook-date], [data-appointment-date]")?.value || "";
  const timeValue =
    form.querySelector("[data-rebook-time], [data-appointment-time]")?.value || "";
  const required = Boolean(form.dataset.rebookForm);
  const settings = currentPlannerSettings();
  const errorBox = form.querySelector("[data-rebook-error]");
  if (!keepError) {
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = "";
    }
    if (form.dataset.rebookForm) {
      uiState.rebookErrorText = "";
      form.querySelector("[data-rebook-summary]")?.setAttribute("role", "status");
    }
  }
  if (form.dataset.rebookForm) {
    uiState.rebookDraft = {
      learnerId: form.dataset.rebookForm,
      dateKey,
      timeValue,
    };
  }
  const sync = (extra) => syncRebookChrome(form, { dateKey, timeValue, ...extra });
  if (!dateKey) {
    if (dayBox) {
      dayBox.innerHTML = `<p class="meta">Pick a day to see who is already on it and which times fit.</p>`;
    }
    if (choiceBox) choiceBox.innerHTML = "";
    hint.hidden = !required;
    hint.textContent = required ? "Pick a day and a time to see if it is free." : "";
    hint.classList.remove("is-ok", "is-blocked");
    markSave(!required);
    sync({});
    return;
  }
  if (dayBox) dayBox.innerHTML = `<p class="meta">Checking who is on that day…</p>`;
  if (choiceBox) choiceBox.innerHTML = "";
  hint.hidden = false;
  hint.textContent = `Checking the drive and whether you are back by ${formatTime(settings.returnBy)}…`;
  hint.classList.remove("is-ok", "is-blocked");
  markSave(false);
  sync({ checking: true });
  const learner = findEditableLearner(learnerId) || findRosterLearner(learnerId);
  const located = learner ? await ensureLearnerLocated(learner) : null;
  if (token !== requestedFitToken) return;
  const sameMissedDay = required && dateKey === uiState.selectedDateKey;
  if (dayBox) dayBox.innerHTML = renderSlotDay(dateKey, learnerId);
  if (sameMissedDay) {
    if (choiceBox) choiceBox.innerHTML = "";
    hint.hidden = true;
    hint.textContent = "";
    hint.classList.remove("is-ok", "is-blocked");
    markSave(false);
    sync({ fit: { ok: false } });
    return;
  }
  const choices = learner ? fittingArrivals(learner, located, dateKey, settings) : [];
  const selected = timeValue ? parseTimeToMinutes(timeValue) : null;
  const shownChoices =
    learner && Number.isFinite(selected) && !choices.includes(selected) &&
    scoreVisit(learner, located, dateKey, selected, settings).ok
      ? [...choices, selected].sort((a, b) => a - b)
      : choices;
  if (choiceBox) {
    choiceBox.innerHTML = renderSlotChoices(shownChoices, selected, settings.returnBy, {
      forRebook: required,
    });
  }
  if (!timeValue) {
    if (required && !choices.length) {
      const empty = rebookEmptyFitState(formatTime(settings.returnBy), escapeHtml);
      hint.hidden = empty.hintHidden;
      hint.textContent = empty.hintText;
      hint.classList.remove("is-ok", "is-blocked");
      if (choiceBox) choiceBox.innerHTML = empty.choicesHtml;
      markSave(empty.saveEnabled);
      sync({});
      return;
    }
    hint.hidden = false;
    hint.textContent = choices.length
      ? required
        ? "Tap a time that fits."
        : "Tap a time that fits, or type one. The line below says if that exact time is free."
      : `No arrival on this day fits the drive and a return by ${formatTime(settings.returnBy)}.`;
    hint.classList.remove("is-ok", "is-blocked");
    markSave(!(required || !choices.length));
    sync({});
    return;
  }
  const fit = scoreVisit(learner, located, dateKey, selected, settings);
  hint.hidden = false;
  hint.textContent = fit.message;
  hint.classList.toggle("is-ok", Boolean(fit.ok));
  hint.classList.toggle("is-blocked", !fit.ok);
  markSave(Boolean(fit.ok));
  sync({ fit });
}

export function clashStatus(rejected, alternative = "") {
  const wanted = `${formatTime(rejected.arriveMinutes)} on ${formatShortDate(rejected.date)}`;
  const locked = `${rejected.withName} (${formatTime(rejected.withArrive)}–${formatTime(rejected.withLeave)})`;
  const verb = rejected.reason === "too-close" ? "is too close to" : "overlaps";
  if (alternative) {
    return `${wanted} ${verb} ${locked}, so that time was not booked. ${alternative}`;
  }
  return `${wanted} ${verb} ${locked}, and no other free slot could be booked without moving verified, booked or held learners.`;
}

async function bookBestAvailableTime(learner, {
  preferDateKey = "",
  preferArriveMinutes = null,
  rejected = null,
} = {}) {
  if (isPhoneReview(learner)) {
    setStatus("Turn off phone review first if they need a site visit.");
    return;
  }
  setStatus(
    rejected
      ? `That time is not free. Looking for the nearest slot for ${learner.name}…`
      : `Looking for the best free slot for ${learner.name}…`,
  );
  try {
    if (!uiState.planCache) {
      await planTheWeek({ resetSelection: false, fillGaps: true });
    }
    const located = uiState.planCache?.locatedLearners.find((item) => item.id === learner.id);
    if (!located) {
      setStatus(
        rejected
          ? clashStatus(rejected)
          : `Could not look up ${learner.name}’s postcode, so a slot could not be booked.`,
      );
      return;
    }
    located.employer = learner.employer;
    located.collegeDay = learner.collegeDay;
    located.appointment = learner.appointment;
    const settings = currentPlannerSettings();
    const pool = uiState.planCache.locatedLearners.map((item) =>
      item.id === learner.id ? located : item,
    );
    let slot = findBestEmployerSlot(
      located,
      pool,
      uiState.planCache.matrix,
      0,
      settings,
      new Date(),
      state.acceptedRoutes,
      state.verifiedByDate,
      state.awaitingReply,
      state.frozenTimes,
      state.excludedFromDate,
      preferDateKey,
      preferArriveMinutes,
      state.pinnedRoutes,
    );
    if (!slot) {
      setStatus(
        rejected
          ? clashStatus(rejected)
          : preferDateKey
            ? `${learner.name} could not be fitted on that date without moving verified, booked or held learners.`
            : `${learner.name} could not be fitted on an allowed day without moving verified, booked or held learners.`,
      );
      return;
    }
    writeLearnerAppointment(
      learner,
      normaliseAppointment({
        dateKey: slot.dateKey,
        arriveMinutes: slot.arriveMinutes,
      }),
    );
    clearAwaitingForLearner(learner.id);
    touchLearner(learner);
    logCycleBooked(learner);
    uiState.appointmentEditorId = "";
    scheduleStateSave();
    renderLearners();
    const booked = `${learner.name} is booked ${slot.day} ${formatShortDate(slot.date)} at ${formatTime(slot.arriveMinutes)}${rejected ? " instead" : ""}.`;
    await placeAppointmentOnPlan(
      learner,
      slot.dateKey,
      slot.date,
      rejected
        ? clashStatus(rejected, booked)
        : `${learner.name} is booked ${slot.day} ${formatShortDate(slot.date)} at ${formatTime(slot.arriveMinutes)}, in a free slot that does not overlap verified, booked or held visits.`,
    );
  } catch (error) {
    setStatus(error.message || "Could not book a time.");
    planButton.disabled = false;
  }
}

export function clearLearnerAppointment(learnerId) {
  const learner =
    findEditableLearner(learnerId) ||
    state.learners.find((item) => item.id === learnerId);
  if (!learner) return;
  writeLearnerAppointment(learner, null);
  learner.employer = null;
  touchLearner(learner);
  removeFrozenTimesForLearner(learnerId);
  uiState.appointmentEditorId = "";
  scheduleStateSave();
  renderLearners();
  refreshPlannedWeek({ rebuild: true, fillGaps: true });
  setStatus(`${learner.name} no longer has a booked site time.`);
}

export async function rollAppointmentToNextWeek(learnerId) {
  const learner = state.learners.find((item) => item.id === learnerId);
  const appointment = normaliseAppointment(learner?.appointment);
  if (!learner || !appointment) {
    setStatus("Book a site time first, then you can roll it to the same day next week.");
    return;
  }
  const currentDate = dateFromKey(appointment.dateKey);
  const nextDate = addDays(currentDate, 7);
  const dateKey = toDateKey(nextDate);
  if (!isWeekdayDate(nextDate)) {
    setStatus("That booking does not fall on a weekday, so it was not moved.");
    return;
  }
  if (weekdayName(nextDate) === learner.collegeDay) {
    setStatus(
      `${learner.name} is at college on ${weekdayName(nextDate)}s, so the booking was left on ${formatShortDate(currentDate)}.`,
    );
    return;
  }
  if (!employerAllowsDay(learner, weekdayName(nextDate))) {
    setStatus("The employer cannot do that weekday, so the booking was not moved.");
    return;
  }
  const settings = currentPlannerSettings();
  const clash = await clashForRequestedTime(
    learner,
    dateKey,
    appointment.arriveMinutes,
    settings,
  );
  if (clash === false) return;
  if (clash) {
    setStatus(
      `${formatTime(appointment.arriveMinutes)} on ${formatShortDate(nextDate)} overlaps ${clash.learner?.name || "a locked visit"} (${formatTime(clash.arrive)}–${formatTime(clash.leave)}). The booking was left on ${formatShortDate(currentDate)}.`,
    );
    return;
  }
  writeLearnerAppointment(
    learner,
    normaliseAppointment({
      dateKey,
      arriveMinutes: appointment.arriveMinutes,
    }),
  );
  clearAwaitingForLearner(learner.id);
  touchLearner(learner);
  uiState.appointmentEditorId = "";
  scheduleStateSave();
  renderLearners();
  await placeAppointmentOnPlan(
    learner,
    dateKey,
    nextDate,
    `${learner.name} was rolled to ${weekdayName(nextDate)} ${formatShortDate(nextDate)} at ${formatTime(appointment.arriveMinutes)}.`,
  );
}
