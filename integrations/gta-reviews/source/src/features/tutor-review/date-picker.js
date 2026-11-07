import { escapeHtml } from "../../lib/html.js";
import {
  addDays,
  dateFromKey,
  formatUkDateKey,
  normaliseDateKey,
  startOfLocalDay,
  toDateKey,
} from "../../planner.js";
import { markTutorCardTouched, reviewsTodayKey, tutorTargetDateWindow } from "./validation.js";

function tutorDateLabel(value) {
  const key = normaliseDateKey(value);
  const date = key ? dateFromKey(key) : null;
  if (!date || Number.isNaN(date.getTime())) return "Choose a date";
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  return `${weekday} ${formatUkDateKey(key)}`;
}

function tutorDateMonthKey(value) {
  return (normaliseDateKey(value) || reviewsTodayKey() || "").slice(0, 7);
}

function tutorDateMonthTitle(monthKey) {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);
  if (!year || !month) return "";
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function shiftTutorDateMonth(monthKey, delta) {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);
  const date = new Date(year || 2026, (month || 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function tutorDateShortcuts() {
  const today = startOfLocalDay(new Date());
  return [0, 2, 4, 6, 8, 10].map((weeks) => ({
    key: toDateKey(addDays(today, weeks * 7)),
    label: weeks === 0 ? "Today" : `${weeks} weeks`,
  }));
}

function tutorDateGridHtml(selected, monthKey) {
  const { min, max } = tutorTargetDateWindow();
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);
  const start = new Date(year, month - 1, 1);
  const first = (start.getDay() + 6) % 7;
  const last = new Date(year, month, 0).getDate();
  const cells = [];
  for (let index = 0; index < first; index += 1) {
    cells.push(`<span class="tutor-date-cell is-empty"></span>`);
  }
  for (let day = 1; day <= last; day += 1) {
    const key = toDateKey(new Date(year, month - 1, day));
    const allowed = key >= min && key <= max;
    const on = key === selected;
    const today = key === min;
    cells.push(
      `<button type="button" class="tutor-date-cell${on ? " is-selected" : ""}${today ? " is-today" : ""}${allowed ? " is-open" : " is-off"}" data-date-day="${key}"${allowed ? "" : " disabled"}>${day}</button>`,
    );
  }
  return cells.join("");
}

function tutorDateMenuHtml(selected, monthKey) {
  const { min, max } = tutorTargetDateWindow();
  const month = monthKey || tutorDateMonthKey(selected);
  return `
    <div class="tutor-date-popup" data-date-popup>
      <button type="button" class="tutor-date-backdrop" data-date-dismiss aria-label="Close date picker"></button>
      <div class="tutor-date-menu" role="dialog" aria-label="Choose a target date">
        <p class="tutor-date-window">Pick a date between ${escapeHtml(formatUkDateKey(min))} and ${escapeHtml(formatUkDateKey(max))}.</p>
        <div class="tutor-date-shortcuts">
          ${tutorDateShortcuts()
            .map(
              (item) =>
                `<button type="button" class="tutor-date-shortcut${item.key === selected ? " is-selected" : ""}" data-date-day="${item.key}">${escapeHtml(item.label)}</button>`,
            )
            .join("")}
        </div>
        <div class="tutor-date-cal">
          <div class="tutor-date-cal-head">
            <button type="button" class="btn ghost tutor-date-nav" data-date-month-shift="-1" aria-label="Previous month">‹</button>
            <strong data-date-month-title>${escapeHtml(tutorDateMonthTitle(month))}</strong>
            <button type="button" class="btn ghost tutor-date-nav" data-date-month-shift="1" aria-label="Next month">›</button>
          </div>
          <div class="tutor-date-dows">
            ${["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => `<span>${day}</span>`).join("")}
          </div>
          <div class="tutor-date-grid" data-date-grid>${tutorDateGridHtml(selected, month)}</div>
        </div>
        <p class="tutor-date-legend"><span class="tutor-date-swatch"></span> Green days can be picked</p>
      </div>
    </div>
  `;
}

export function tutorDatePickerHtml(current = "", { disabled = false } = {}) {
  const value = normaliseDateKey(current) || "";
  const month = tutorDateMonthKey(value);
  return `
    <div class="tutor-date-picker${value ? "" : " is-empty"}${disabled ? " is-locked" : ""}" data-date-picker data-date-month="${month}">
      <input type="hidden" data-target-field="target-date" value="${escapeHtml(value)}" />
      <button type="button" class="tutor-select tutor-date-trigger" aria-haspopup="dialog" aria-expanded="false"${disabled ? " disabled" : ""}>
        <span data-date-label>${escapeHtml(tutorDateLabel(value))}</span>
      </button>
      ${disabled ? "" : tutorDateMenuHtml(value, month)}
    </div>
  `;
}

export function closeTutorDatePickers(except) {
  document.querySelectorAll("[data-date-picker].open").forEach((picker) => {
    if (picker === except) return;
    picker.classList.remove("open");
    picker.querySelector(".tutor-date-trigger")?.setAttribute("aria-expanded", "false");
  });
  document.body.classList.toggle(
    "tutor-date-open",
    Boolean(document.querySelector("[data-date-picker].open")),
  );
}

export function refreshTutorDateMenu(picker) {
  if (!picker) return;
  const selected = picker.querySelector('[data-target-field="target-date"]')?.value || "";
  const month = picker.dataset.dateMonth || tutorDateMonthKey(selected);
  picker.dataset.dateMonth = month;
  const title = picker.querySelector("[data-date-month-title]");
  const grid = picker.querySelector("[data-date-grid]");
  if (title) title.textContent = tutorDateMonthTitle(month);
  if (grid) grid.innerHTML = tutorDateGridHtml(selected, month);
  picker.querySelectorAll("[data-date-day]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.dateDay === selected);
  });
}

export function setTutorTargetDate(field, value) {
  const picker = field?.closest?.("[data-date-picker]") || field;
  if (!picker?.querySelector) return;
  const next = normaliseDateKey(value) || "";
  const input = picker.querySelector('[data-target-field="target-date"]');
  if (input) input.value = next;
  const label = picker.querySelector("[data-date-label]");
  if (label) label.textContent = tutorDateLabel(next);
  picker.classList.toggle("is-empty", !next);
  picker.closest("label")?.classList.remove("is-missing");
  if (next) picker.dataset.dateMonth = tutorDateMonthKey(next);
  refreshTutorDateMenu(picker);
  markTutorCardTouched(picker);
}

export function closeTutorOwnerPickers(except) {
  document.querySelectorAll("[data-owner-picker].open").forEach((picker) => {
    if (picker === except) return;
    picker.classList.remove("open");
    picker.querySelector(".tutor-owner-trigger")?.setAttribute("aria-expanded", "false");
  });
}

export function setTutorOwnerSelect(field, value) {
  const picker = field?.closest?.("[data-owner-picker]") || field;
  if (!picker?.querySelector) return;
  const next = String(value || "").trim();
  const input = picker.querySelector('[data-target-field="owner"]');
  if (input) input.value = next;
  const label = picker.querySelector("[data-owner-label]");
  if (label) label.textContent = next || "Apprentice, employer or tutor";
  picker.classList.toggle("is-empty", !next);
  picker.closest("label")?.classList.remove("is-missing");
  markTutorCardTouched(picker);
  picker.querySelectorAll("[data-owner-option]").forEach((button) => {
    const on = (button.dataset.ownerOption || "") === next;
    button.classList.toggle("is-selected", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  });
}
