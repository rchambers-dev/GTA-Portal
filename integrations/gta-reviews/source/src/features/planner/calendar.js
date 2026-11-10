import { calendarEl, calendarGrid, calendarTitle, skipTodayInput } from "../../app/dom.js";
import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import {
  addDays,
  dateFromKey,
  isWeekdayDate,
  startOfLocalDay,
  toDateKey,
  weekdayName,
} from "../../planner.js";
import { state } from "./status.js";

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

export function selectedWorkingDateKeys(...args) {
  return callHook("selectedWorkingDateKeys", args, []);
}

export function reviewsDoneOnDate(...args) {
  return callHook("reviewsDoneOnDate", args, []);
}

export function confirmedReviewCount(...args) {
  return callHook("confirmedReviewCount", args, 0);
}

export function updatePlanLabels(...args) {
  return callHook("updatePlanLabels", args, undefined);
}

export function renderPlan(...args) {
  return callHook("renderPlan", args, undefined);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function displayPlanDay(...args) {
  return callHook("displayPlanDay", args, null);
}

export function drawMap(...args) {
  return callHook("drawMap", args, undefined);
}

export function bindPlannerCalendar(next) {
  hooks = next || null;
}

export function mountCalendar() {
  calendarEl?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const dayButton = event.target.closest("[data-cal-day]");
    if (!dayButton || dayButton.disabled) return;
    uiState.calendarPointerDay = dayButton.dataset.calDay;
    selectCalendarDate(uiState.calendarPointerDay);
  });
  calendarEl?.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-cal-day]");
    if (dayButton && !dayButton.disabled) {
      if (dayButton.dataset.calDay === uiState.calendarPointerDay) {
        uiState.calendarPointerDay = "";
        return;
      }
      selectCalendarDate(dayButton.dataset.calDay);
      return;
    }
    uiState.calendarPointerDay = "";
    if (event.target.closest("[data-cal-prev]")) {
      uiState.calendarMonth = new Date(uiState.calendarMonth.getFullYear(), uiState.calendarMonth.getMonth() - 1, 1);
      renderCalendar();
      return;
    }
    if (event.target.closest("[data-cal-next]")) {
      uiState.calendarMonth = new Date(uiState.calendarMonth.getFullYear(), uiState.calendarMonth.getMonth() + 1, 1);
      renderCalendar();
    }
  });
}

export function renderCalendar() {
  if (!calendarGrid || !calendarTitle) return;
  const now = new Date();
  const todayKey = toDateKey(startOfLocalDay(now));
  const selected = new Set(selectedWorkingDateKeys(now));
  calendarTitle.textContent = uiState.calendarMonth.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const monthStart = new Date(uiState.calendarMonth.getFullYear(), uiState.calendarMonth.getMonth(), 1);
  const weekday = monthStart.getDay();
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const gridStart = addDays(monthStart, -mondayOffset);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const cells = labels.map((label) => `<div class="cal-dow">${label}</div>`);

  for (let week = 0; week < 6; week += 1) {
    const weekDays = [0, 1, 2, 3, 4].map((weekday) =>
      addDays(gridStart, week * 7 + weekday),
    );
    if (!weekDays.some((date) => date.getMonth() === uiState.calendarMonth.getMonth())) {
      continue;
    }
    for (const date of weekDays) {
      if (date.getMonth() !== uiState.calendarMonth.getMonth()) {
        cells.push(`<div class="cal-cell empty" aria-hidden="true"></div>`);
        continue;
      }
      const key = toDateKey(date);
      const past = key < todayKey;
      const doneCount = reviewsDoneOnDate(key).length;
      const isSelected = selected.has(key);
      const isToday = key === todayKey;
      const isViewing = Boolean(uiState.selectedDateKey) && key === uiState.selectedDateKey;
      const isBooked = confirmedReviewCount(key) > 0;
      const skipped = isToday && skipTodayInput.checked;
      const classes = [
        "cal-cell",
        past && !doneCount ? "muted" : "",
        isSelected ? "selected" : "",
        isViewing ? "viewing" : "",
        isToday ? "today" : "",
        isBooked ? "booked" : "",
        doneCount ? "done" : "",
        skipped && isSelected ? "skipped" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cells.push(
        `<button type="button" class="${classes}" data-cal-day="${key}">${date.getDate()}</button>`,
      );
    }
  }
  calendarGrid.innerHTML = cells.join("");
}

function paintCalendarSelection() {
  if (!calendarGrid) return;
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  const selected = new Set(selectedWorkingDateKeys());
  const skippedToday = Boolean(skipTodayInput?.checked);
  const buttons = calendarGrid.querySelectorAll("[data-cal-day]");
  if (!buttons.length) {
    renderCalendar();
    return;
  }
  for (const button of buttons) {
    const key = button.dataset.calDay;
    const isSelected = selected.has(key);
    button.classList.toggle("selected", isSelected);
    button.classList.toggle("viewing", Boolean(uiState.selectedDateKey) && key === uiState.selectedDateKey);
    button.classList.toggle("skipped", key === todayKey && skippedToday && isSelected);
  }
}

function showSelectedPlanDay(monthChanged = false) {
  updatePlanLabels();
  if (monthChanged) renderCalendar();
  else paintCalendarSelection();
  renderPlan({ refreshMap: false });
}

function scheduleSelectedDayWork(replan) {
  clearTimeout(uiState.selectedDayPlanTimer);
  uiState.selectedDayPlanTimer = setTimeout(() => {
    uiState.selectedDayPlanTimer = 0;
    if (replan) {
      refreshPlannedWeek({ resetSelection: false });
      return;
    }
    const day = displayPlanDay(uiState.selectedDateKey);
    if (uiState.planResult && day && !day.lookback && day.stops?.length) drawMap(day);
    else if (uiState.planResult) drawMap({ stops: [] });
  }, 0);
}

function selectCalendarDate(dateKey) {
  const date = dateFromKey(dateKey);
  if (!isWeekdayDate(date)) return;
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  uiState.selectedDay = weekdayName(date);
  uiState.selectedDateKey = dateKey;
  const monthChanged =
    date.getMonth() !== uiState.calendarMonth.getMonth() ||
    date.getFullYear() !== uiState.calendarMonth.getFullYear();
  if (monthChanged) uiState.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  let replan = false;
  if (dateKey >= todayKey) {
    const current = state.settings.workingDates || [];
    replan = !(current.length === 1 && current[0] === dateKey);
    if (replan) {
      state.settings.workingDates = [dateKey];
      scheduleStateSave();
    }
  }
  showSelectedPlanDay(monthChanged);
  scheduleSelectedDayWork(replan);
}

