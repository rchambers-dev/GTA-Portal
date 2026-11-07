import { planNotesCount, planNotesMenu, planNotesToggle } from "../../app/dom.js";
import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { formatDateKeyLabel } from "../../lib/format.js";
import { escapeHtml } from "../../lib/html.js";
import { cssEscape } from "../../lib/html.js";
import { isTestLearner } from "../../lib/learners.js";
import { addDays, normaliseDateKey, startOfLocalDay, toDateKey } from "../../planner.js";
import { state, touchLearner } from "./status.js";

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

export function findEditableLearner(...args) {
  return callHook("findEditableLearner", args, null);
}

export function learnerFormEl(...args) {
  return callHook("learnerFormEl", args, null);
}

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function closeLearnerSheet(...args) {
  return callHook("closeLearnerSheet", args, undefined);
}

export function refreshLearnerSurfaces(...args) {
  return callHook("refreshLearnerSurfaces", args, undefined);
}

export function bindPlannerNotes(next) {
  hooks = next || null;
}

export function learnerNoteText(item) {
  return String(item?.note || "").trim();
}

export function noteUntilKey(item) {
  return normaliseDateKey(item?.noteUntil);
}

function noteUntilPresets(now = new Date()) {
  const today = startOfLocalDay(now);
  const weekday = today.getDay();
  const friday = addDays(today, (5 - weekday + 7) % 7);
  return {
    today: toDateKey(today),
    week: toDateKey(friday),
    fortnight: toDateKey(addDays(today, 14)),
    month: toDateKey(addDays(today, 28)),
  };
}

function defaultNoteUntil(item, now = new Date()) {
  return noteUntilKey(item) || noteUntilPresets(now).week;
}

function noteUntilState(item, now = new Date()) {
  const until = noteUntilKey(item);
  const today = toDateKey(startOfLocalDay(now));
  if (!until) return { until: "", overdue: true, label: "Add an end date so this is not forgotten" };
  if (until < today) {
    return { until, overdue: true, label: `Check this — ended ${formatDateKeyLabel(until)}` };
  }
  if (until === today) return { until, overdue: false, label: "Until today" };
  return { until, overdue: false, label: `Until ${formatDateKeyLabel(until)}` };
}

function planNoteItems(now = new Date()) {
  return [...(state.learners || []), ...(state.followUps || [])]
    .filter((item) => learnerNoteText(item) && !isTestLearner(item))
    .map((item) => ({ item, until: noteUntilState(item, now) }))
    .sort(
      (a, b) =>
        Number(b.until.overdue) - Number(a.until.overdue) ||
        String(a.until.until || "").localeCompare(String(b.until.until || "")) ||
        a.item.name.localeCompare(b.item.name),
    );
}

export function setPlanNotesOpen(open) {
  uiState.planNotesOpen = Boolean(open);
  if (planNotesToggle) planNotesToggle.setAttribute("aria-expanded", uiState.planNotesOpen ? "true" : "false");
  if (planNotesMenu) {
    planNotesMenu.hidden = !uiState.planNotesOpen;
    planNotesMenu.classList.toggle("is-open", uiState.planNotesOpen);
  }
}

export function renderPlanNotes() {
  if (!planNotesToggle || !planNotesMenu || !planNotesCount) return;
  const items = planNoteItems();
  const due = items.filter((row) => row.until.overdue).length;
  planNotesCount.textContent = String(items.length);
  planNotesToggle.classList.toggle("has-notes", items.length > 0);
  planNotesToggle.classList.toggle("is-due", due > 0);
  planNotesToggle.setAttribute(
    "aria-label",
    due
      ? `${items.length} note${items.length === 1 ? "" : "s"}, ${due} need checking`
      : `${items.length} note${items.length === 1 ? "" : "s"}`,
  );
  planNotesMenu.innerHTML = items.length
    ? items
        .map(
          ({ item, until }) => `
            <button type="button" class="plan-notes-item${until.overdue ? " is-due" : ""}" data-plan-note="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(learnerNoteText(item))}</span>
              <em>${escapeHtml(until.label)}</em>
            </button>
          `,
        )
        .join("")
    : '<p class="empty">No notes at the moment.</p>';
  if (!items.length) uiState.planNotesOpen = false;
  setPlanNotesOpen(uiState.planNotesOpen);
}

export function notePreview(item) {
  const note = learnerNoteText(item);
  if (!note) return "";
  const until = noteUntilState(item);
  return `
    <div class="stop-note-box${until.overdue ? " is-due" : ""}" data-note="${escapeHtml(item.id)}">
      <p class="learner-note">${escapeHtml(note)}</p>
      <p class="meta">${escapeHtml(until.label)}</p>
    </div>
  `;
}

export function noteEditor(item) {
  if (uiState.noteEditorId !== item.id) return "";
  const until = defaultNoteUntil(item);
  const presets = noteUntilPresets();
  const chips = [
    ["today", "Today", presets.today],
    ["week", "This week", presets.week],
    ["fortnight", "2 weeks", presets.fortnight],
    ["month", "1 month", presets.month],
  ]
    .map(
      ([id, label, value]) =>
        `<button type="button" class="btn pill ${until === value ? "on" : "ghost"}" data-note-until-preset="${id}" aria-pressed="${until === value ? "true" : "false"}">${label}</button>`,
    )
    .join("");
  return `
    <form class="note-form" data-note-form="${escapeHtml(item.id)}">
      <label>
        Note
        <textarea data-note-text rows="4" placeholder="e.g. Off sick, doctor's note">${escapeHtml(item.note || "")}</textarea>
      </label>
      <p class="meta">Keep this note until</p>
      <div class="employer-days">${chips}</div>
      <label>
        End date
        <input type="date" data-note-until min="${escapeHtml(presets.today)}" value="${escapeHtml(until)}" />
      </label>
      <div class="appointment-form-actions">
        <button type="button" class="btn pill ghost on" data-note-save="${escapeHtml(item.id)}">Save note</button>
        ${learnerNoteText(item) ? `<button type="button" class="btn pill danger" data-note-clear="${escapeHtml(item.id)}">Clear</button>` : ""}
      </div>
    </form>
  `;
}

export function applyNoteUntilPreset(button) {
  const formEl = button.closest("[data-note-form]");
  const field = formEl?.querySelector("[data-note-until]");
  const presets = noteUntilPresets();
  const next = presets[button.dataset.noteUntilPreset];
  if (!formEl || !field || !next) return;
  field.value = next;
  formEl.querySelectorAll("[data-note-until-preset]").forEach((item) => {
    const on = item === button;
    item.setAttribute("aria-pressed", on ? "true" : "false");
    item.classList.toggle("on", on);
    item.classList.toggle("ghost", !on);
  });
}

export function readOpenNote(itemId) {
  const formEl = learnerFormEl(`[data-note-form="${cssEscape(itemId)}"]`);
  const typed = formEl?.querySelector("[data-note-text]")?.value;
  return typed == null ? null : typed.trim();
}

function readOpenNoteUntil(itemId) {
  const formEl = learnerFormEl(`[data-note-form="${cssEscape(itemId)}"]`);
  return normaliseDateKey(formEl?.querySelector("[data-note-until]")?.value || "");
}

function writeLearnerNote(learner, text) {
  const note = String(text || "").trim();
  learner.note = note;
  learner.noteUntil = note ? readOpenNoteUntil(learner.id) || noteUntilPresets().week : "";
  touchLearner(learner);
  return learner;
}

export function saveLearnerNote(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  const typed = readOpenNote(learnerId);
  writeLearnerNote(learner, typed == null ? learnerNoteText(learner) : typed);
  uiState.noteEditorId = "";
  scheduleStateSave();
  closeLearnerSheet({ silent: true });
  refreshLearnerSurfaces();
  renderPlanNotes();
  setStatus(
    learner.note
      ? `Saved note for ${learner.name}${learner.noteUntil ? ` until ${formatDateKeyLabel(learner.noteUntil)}` : ""}.`
      : `Cleared the note for ${learner.name}.`,
  );
}

export function clearLearnerNote(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  learner.note = "";
  learner.noteUntil = "";
  touchLearner(learner);
  uiState.noteEditorId = "";
  scheduleStateSave();
  closeLearnerSheet({ silent: true });
  refreshLearnerSurfaces();
  renderPlanNotes();
  setStatus(`Cleared the note for ${learner.name}.`);
}

export function saveFollowUpNote(itemId) {
  saveLearnerNote(itemId);
}

export function clearFollowUpNote(itemId) {
  clearLearnerNote(itemId);
}
