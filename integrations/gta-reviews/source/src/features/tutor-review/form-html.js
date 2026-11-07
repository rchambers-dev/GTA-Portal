import { reviewsCount, reviewsList, reviewsSearch, reviewsTitle } from "../../app/dom.js";
import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { escapeHtml } from "../../lib/html.js";
import {
  formatUkDateKey,
  formatWeeksAndDays,
  lastReviewDateKey,
  learnerProfileFrom,
  nextReviewDateKey,
  reviewDueStatus,
  startOfLocalDay,
  toDateKey,
} from "../../planner.js";
import { section1Values } from "../../review-pdf.js";
import {
  REVIEW_TARGET_SLOTS,
  TUTOR_DUE_BANDS,
  TUTOR_FIELD_LIMITS,
  TUTOR_PROGRESS_ROWS,
  clipToTutorLimit,
  countWords,
  createSavedReview,
  currentWorkflowReview,
  emptyTarget,
  emptyTutorForm,
  ensureReviewCycles,
  otjTrackFromHours,
  padTargets,
  previousSavedReview,
  refreshCarriedTargets,
  repairCycleReleaseDates,
  reviewsForLearner,
  setReviewHolder,
  tutorDueBand,
  tutorWindowOpen,
  updateSavedReview,
} from "../../reviews.js";
import { tutorReviewLabel } from "../review-workflow/attachments.js";
import { setTutorOwnerSelect, setTutorTargetDate, tutorDatePickerHtml } from "./date-picker.js";
import { tutorHelpButton, tutorHelpPopupHtml } from "./help.js";
import {
  learnersAssignedToSignedInTutor,
  refreshTutorCardStates,
  signedInTutor,
  state,
  tutorReviewFillProgress,
  tutorTargetDateError,
} from "./validation.js";

export function cycleTimingLabel(learner) {
  const due = reviewDueStatus(learner);
  const days = due.daysUntilNeeded ?? due.daysUntilStart ?? due.daysUntil;
  if (days == null) return { kind: "next", label: "No date yet" };
  if (due.window === "behind" || due.state === "overdue") {
    return { kind: "overdue", label: `Overdue · ${formatWeeksAndDays(due.daysUntil ?? days)}` };
  }
  if (due.state === "due-soon" || days <= 0) {
    return { kind: "soon", label: "Due this week" };
  }
  return { kind: days < 7 ? "soon" : "next", label: `in ${formatWeeksAndDays(days)}` };
}

function tutorLearnerCardHtml(learner) {
  const profile = learnerProfileFrom(learner || {});
  const pack = tutorReviewPack(learner);
  const returned = pack?.status === "returned" || pack?.status === "print" || pack?.status === "completed";
  const fill = tutorReviewFillProgress(pack);
  const open = uiState.expandedTutorLearnerIds.has(learner.id);
  const windowOpen = tutorWindowOpen(learner);
  const due = reviewDueStatus(learner);
  const timing = cycleTimingLabel(learner);
  const fillLabel = returned
    ? "Sent back"
    : !windowOpen
      ? "Not due yet"
      : fill.started
        ? "Started"
        : "Need doing";
  const leftLabel = returned
    ? "Sent back to the reviewer"
    : !windowOpen
      ? due.daysUntilNotice > 0
        ? `Opens in ${formatWeeksAndDays(due.daysUntilNotice)}`
        : "Not due yet"
      : fill.remaining === 0
        ? "Ready to send back"
        : fill.started
          ? `${fill.remaining}% left to fill`
          : "Fill this review";
  const chipClass = returned ? "sent" : fill.started ? "started" : windowOpen ? "idle" : "idle";
  const bar = windowOpen && !returned
    ? `<span class="tutor-fill-bar" aria-hidden="true"><span style="width:${100 - fill.remaining}%"></span></span>`
    : "";
  const action = returned
    ? `<button type="button" class="btn" data-open-tutor-review="${escapeHtml(learner.id)}">Open review</button>`
    : windowOpen
      ? `<button type="button" class="btn primary" data-open-tutor-review="${escapeHtml(learner.id)}">${fill.started ? "Fill review" : "Start review"}</button>`
      : `<button type="button" class="btn ghost" disabled>Opens in ${escapeHtml(formatWeeksAndDays(due.daysUntilNotice || 0))}</button>`;
  return `
    <article class="tutor-learner${open ? " is-open" : " is-min"}" data-learner-id="${escapeHtml(learner.id)}">
      <div class="tutor-learner-row">
        <button type="button" class="tutor-learner-toggle" data-toggle-tutor-learner aria-expanded="${open ? "true" : "false"}" aria-label="${open ? "Hide learner details" : "Show learner details"}">
          <span aria-hidden="true"></span>
        </button>
        <strong>${escapeHtml(learner?.name || "Unnamed learner")}</strong>
        <span class="archive-timing is-${escapeHtml(timing.kind)}">${escapeHtml(timing.label)}</span>
        <span class="tutor-fill-chip is-${chipClass}">${escapeHtml(fillLabel)}</span>
        ${action}
      </div>
      <div class="tutor-learner-details"${open ? "" : " inert"}>
        <div>
          <p class="meta">${escapeHtml(learner?.company || "No company")} · ${escapeHtml(learner?.postcode || "No postcode")}</p>
          <p class="meta">${escapeHtml(profile.apprenticeship || "Apprenticeship not set")}${learner?.collegeDay ? ` · college ${escapeHtml(learner.collegeDay)}` : ""}</p>
          <p class="tutor-learner-fill">
            <span>${escapeHtml(leftLabel)}</span>
          </p>
          ${bar}
        </div>
      </div>
    </article>
  `;
}

export function tutorReviewPack(learner) {
  const packs = reviewsForLearner(state, learner.id);
  return (
    packs.find((item) => item.status === "tutor") ||
    currentWorkflowReview(state, learner) ||
    packs.filter((item) => item.status !== "completed").at(-1) ||
    null
  );
}

function ensureTutorReviewPack(learner) {
  const existing = tutorReviewPack(learner);
  if (existing) {
    const cleaned = refreshCarriedTargets(state, learner.id);
    if (existing.status === "reviewer") {
      setReviewHolder(state, existing.id, "tutor");
      scheduleStateSave();
    } else if (cleaned) {
      scheduleStateSave();
    }
    return (state.savedReviews || []).find((item) => item.id === existing.id) || existing;
  }
  const dateKey =
    nextReviewDateKey(learner) ||
    lastReviewDateKey(learner) ||
    toDateKey(startOfLocalDay(new Date()));
  const { review } = createSavedReview(state, {
    learnerId: learner.id,
    dateKey,
    source: "tutor",
  });
  setReviewHolder(state, review.id, "tutor");
  refreshCarriedTargets(state, learner.id);
  scheduleStateSave();
  return (state.savedReviews || []).find((item) => item.id === review.id) || review;
}

function previousTutorReview(learner, pack) {
  return previousSavedReview(state, learner.id, pack?.dateKey || "") || null;
}

function tutorLimitAttrs(limit, extra = "") {
  const words = limit?.words || 0;
  const chars = limit?.chars || 0;
  return [
    extra,
    words ? `data-word-limit="${words}"` : "",
    chars ? `data-char-limit="${chars}" maxlength="${chars}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function tutorLimitLabel(value, limit) {
  if (!limit) return "";
  const words = countWords(value);
  const over = (limit.words && words >= limit.words) || (limit.chars && String(value || "").length >= limit.chars);
  const text = limit.words
    ? `${words} / ${limit.words} words`
    : `${String(value || "").length} / ${limit.chars} characters`;
  return `<span class="tutor-limit${over ? " is-limit" : ""}" data-word-count>${text}</span>`;
}

export function updateTutorFieldLimit(el) {
  if (!el) return;
  const limit = {
    words: Number(el.dataset.wordLimit || 0) || 0,
    chars: Number(el.dataset.charLimit || 0) || 0,
  };
  if (!limit.words && !limit.chars) return;
  const next = clipToTutorLimit(el.value, limit);
  if (next !== el.value) el.value = next;
  const meta = el.closest("label")?.querySelector("[data-word-count]");
  if (!meta) return;
  const words = countWords(el.value);
  meta.textContent = limit.words
    ? `${words} / ${limit.words} words`
    : `${el.value.length} / ${limit.chars} characters`;
  meta.classList.toggle(
    "is-limit",
    Boolean((limit.words && words >= limit.words) || (limit.chars && el.value.length >= limit.chars)),
  );
}

function refreshTutorFieldLimits(root = reviewsList) {
  root
    ?.querySelectorAll("[data-word-limit], [data-char-limit]")
    .forEach((el) => updateTutorFieldLimit(el));
}

function tutorAiButton(kind) {
  return `
    <button type="button" class="tutor-ai-btn" data-tutor-ai="${escapeHtml(kind)}" aria-label="Improve wording">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.2l.9 3.3L12 5.4l-3.1.9L8 9.6l-.9-3.3L4 5.4l3.1-.9L8 1.2zm4.6 6.4l.5 1.8 1.8.5-1.8.5-.5 1.8-.5-1.8-1.8-.5 1.8-.5.5-1.8z"/></svg>
      AI
    </button>
  `;
}

function tutorBoxedField(controlHtml, aiKind = "") {
  return `<div class="tutor-field-box">${controlHtml}${aiKind ? tutorAiButton(aiKind) : ""}</div>`;
}

function tutorWriteField(label, name, value, rows = 3, { readonly = false, limit, ai = "", help = "" } = {}) {
  const attrs = tutorLimitAttrs(limit, readonly ? "readonly" : `name="${escapeHtml(name)}"`);
  const helpBtn = !readonly && help ? tutorHelpButton(help, `How to fill ${label}`) : "";
  const card = !readonly && (help || name) ? ` data-tutor-card="${escapeHtml(help || name)}"` : "";
  return `
    <div class="tutor-write-block"${card}>
      ${helpBtn}
      <div class="tutor-write-head">
        <span>${escapeHtml(label)}</span>
      </div>
      <label class="tutor-write-field">
        ${tutorBoxedField(`<textarea ${attrs} rows="${rows}">${escapeHtml(value)}</textarea>`, readonly ? "" : ai)}
        ${tutorLimitLabel(value, limit)}
      </label>
    </div>
  `;
}

function tutorTargetFieldsHtml(target, { previous = false } = {}) {
  const actionLimit = previous ? TUTOR_FIELD_LIMITS.previousAction : TUTOR_FIELD_LIMITS.newAction;
  const measureLimit = previous ? TUTOR_FIELD_LIMITS.previousMeasure : TUTOR_FIELD_LIMITS.newMeasure;
  const lock = previous ? " readonly tabindex=\"-1\"" : "";
  return `
      <label>Action / target
        ${tutorBoxedField(
          `<textarea ${tutorLimitAttrs(actionLimit, `data-target-field="action"${lock}`)} rows="2"${previous ? "" : ' placeholder="What needs to happen?"'}>${escapeHtml(target.action)}</textarea>`,
          previous ? "" : "action",
        )}
        ${tutorLimitLabel(target.action, actionLimit)}
      </label>
      <div class="tutor-target-grid">
        <label>Owner
          ${tutorOwnerSelectHtml(target.owner, { disabled: previous })}
        </label>
        <label>Target date
          ${tutorDatePickerHtml(target.targetDate, { disabled: previous })}
        </label>
      </div>
      <label>Success measure / support
        ${tutorBoxedField(
          `<textarea ${tutorLimitAttrs(measureLimit, `data-target-field="measure"${lock}`)} rows="2">${escapeHtml(target.measure)}</textarea>`,
          previous ? "" : "measure",
        )}
        ${tutorLimitLabel(target.measure, measureLimit)}
      </label>
  `;
}

function previousTargetReadHtml(target, index) {
  const hasTarget = Boolean(target.action);
  return `
    <article class="tutor-target-edit" data-tutor-card="previous-target" data-target-row="previous" data-target-id="${escapeHtml(target.id)}">
      <p class="meta">Target ${index + 1}</p>
      ${tutorTargetFieldsHtml(target, { previous: true })}
      <div class="tutor-target-actions">
        ${tutorStatusButtons(target, { disabled: !hasTarget })}
      </div>
      <p class="meta" data-target-carry-note ${target.status === "carry-forward" ? "" : "hidden"}>This target is copied into the current targets on the right.</p>
      <input type="hidden" data-target-field="status" value="${escapeHtml(target.status || "open")}" />
    </article>
  `;
}

function tutorOtjTrackHtml(current, { readonly = false } = {}) {
  const track = otjTrackFromHours(current.targetHours, current.currentHours);
  const lock = readonly ? "readonly" : "";
  return `
    <div class="tutor-otj-track${track.rag ? ` is-${track.rag}` : ""}" data-otj-track>
      <div class="tutor-otj-hours">
        <label>Target hours
          <input type="number" min="0" step="0.5" inputmode="decimal" data-otj-hours="target" value="${escapeHtml(current.targetHours || "")}" ${lock} />
        </label>
        <label>Current hours
          <input type="number" min="0" step="0.5" inputmode="decimal" data-otj-hours="current" value="${escapeHtml(current.currentHours || "")}" ${lock} />
        </label>
      </div>
      <div class="tutor-otj-meter" aria-hidden="true">
        <span class="tutor-otj-bar" data-otj-bar style="width:${track.bar}%"></span>
      </div>
      <p class="tutor-otj-status${track.rag ? ` is-${track.rag}` : ""}" data-otj-status>
        <strong data-otj-label>${escapeHtml(track.label)}</strong>
        <span data-otj-detail>${escapeHtml(track.detail)}</span>
      </p>
      <input type="hidden" data-progress-rag="off_the_job" value="${escapeHtml(track.rag)}" />
    </div>
  `;
}

export function updateOtjTrackStatus(rowEl) {
  if (!rowEl) return;
  const target = rowEl.querySelector('[data-otj-hours="target"]')?.value;
  const current = rowEl.querySelector('[data-otj-hours="current"]')?.value;
  const track = otjTrackFromHours(target, current);
  const wrap = rowEl.querySelector("[data-otj-track]");
  const status = rowEl.querySelector("[data-otj-status]");
  const label = rowEl.querySelector("[data-otj-label]");
  const detail = rowEl.querySelector("[data-otj-detail]");
  const bar = rowEl.querySelector("[data-otj-bar]");
  const hidden = rowEl.querySelector("[data-progress-rag]");
  const tone = track.rag ? ` is-${track.rag}` : "";
  if (wrap) wrap.className = `tutor-otj-track${tone}`;
  if (status) status.className = `tutor-otj-status${tone}`;
  if (label) label.textContent = track.label;
  if (detail) detail.textContent = track.detail;
  if (bar) bar.style.width = `${track.bar}%`;
  if (hidden) hidden.value = track.rag;
}

function tutorRagButtons(row, current, { disabled = false } = {}) {
  const na = row.naComment
    ? `<button type="button" class="btn pill${current.rag === "na" ? " on" : " ghost"}" data-rag="na"${disabled ? " disabled" : ""}>N/A</button>`
    : "";
  return `
    <div class="tutor-rag"${disabled ? "" : ` data-progress-id="${escapeHtml(row.id)}"`}>
      <button type="button" class="btn pill${current.rag === "red" ? " on" : " ghost"}" data-rag="red"${disabled ? " disabled" : ""}>Red</button>
      <button type="button" class="btn pill${current.rag === "amber" ? " on" : " ghost"}" data-rag="amber"${disabled ? " disabled" : ""}>Amber</button>
      <button type="button" class="btn pill${current.rag === "green" ? " on" : " ghost"}" data-rag="green"${disabled ? " disabled" : ""}>Green</button>
      ${na}
    </div>
  `;
}

export function applyTutorNaComment(row, progressId) {
  const comment = TUTOR_PROGRESS_ROWS.find((item) => item.id === progressId)?.naComment || "";
  const field = row?.querySelector("textarea[data-progress-evidence]");
  if (!field || field.readOnly || !comment) return;
  field.value = comment;
  updateTutorFieldLimit(field);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function tutorProgressFieldHtml(row, current, { readonly = false } = {}) {
  const evidence = current.evidence || "";
  const actionRef = current.actionRef || "";
  const evidenceLimit = TUTOR_FIELD_LIMITS.progressEvidence;
  const actionLimit = TUTOR_FIELD_LIMITS.progressActionRef;
  const isOtj = row.id === "off_the_job";
  return `
    <article class="tutor-progress-row"${readonly ? "" : ' data-tutor-card="progress"'}${isOtj ? " data-otj-row" : ""}>
      ${readonly ? "" : tutorHelpButton(row.id, `How to fill ${row.label}`)}
      <div class="tutor-progress-head">
        <div class="tutor-progress-title">
          <strong>${escapeHtml(row.label)}</strong>
        </div>
        ${isOtj ? "" : tutorRagButtons(row, current, { disabled: readonly })}
      </div>
      ${isOtj ? tutorOtjTrackHtml(current, { readonly }) : ""}
      <label>Evidence
        ${tutorBoxedField(
          `<textarea ${tutorLimitAttrs(evidenceLimit, readonly ? "readonly" : `data-progress-evidence="${escapeHtml(row.id)}"`)} rows="2">${escapeHtml(evidence)}</textarea>`,
          readonly ? "" : "evidence",
        )}
        ${tutorLimitLabel(evidence, evidenceLimit)}
      </label>
      <label>Action ref
        <input ${tutorLimitAttrs(actionLimit, readonly ? "readonly" : `data-progress-action="${escapeHtml(row.id)}"`)} value="${escapeHtml(actionRef)}" />
        ${tutorLimitLabel(actionRef, actionLimit)}
      </label>
    </article>
  `;
}

function tutorCompareRow(leftHtml, rightHtml) {
  return `
    <div class="tutor-compare-row">
      <section class="tutor-compare-cell tutor-pane-previous">${leftHtml}</section>
      <section class="tutor-compare-cell tutor-pane-current">${rightHtml}</section>
    </div>
  `;
}

function tutorSectionHead(number, title, rightTitle = title) {
  return tutorCompareRow(
    `<h3>Section ${number} — ${escapeHtml(title)}</h3>`,
    `<h3>Section ${number} — ${escapeHtml(rightTitle)}</h3>`,
  );
}

function tutorSection1Html(learner) {
  const values = section1Values(learner);
  const rows = [
    ["Apprentice name", values.apprenticeName],
    ["Review date", "Filled in once the review is verified from the Plan page"],
    ["Apprenticeship standard / route / level", values.apprenticeship],
    ["Release day", values.releaseDay],
    ["GTA tutor", values.gtaTutor],
    ["GTA reviewer", values.gtaReviewer],
    ["Apprenticeship start date", values.startDate],
    ["Apprenticeship planned end date", values.endDate],
    ["Employer / workplace", values.employer],
    ["Postcode", values.postcode],
    ["Employer contact name", values.employerContact],
    ["Employer contact phone", values.phone],
    ["Employer contact email", values.email],
    ["Planned review date", values.plannedReviewDate],
    ["Previous review date", values.previousReviewDate],
  ];
  return `
    <section class="tutor-section1">
      <h3>Section 1 — Review details</h3>
      <p class="meta">Already filled from the learner record. Tutors do not change this.</p>
      <dl class="tutor-s1-grid">
        ${rows
          .map(
            ([label, value]) =>
              `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "Not set")}</dd></div>`,
          )
          .join("")}
      </dl>
    </section>
  `;
}

function tutorStatusButtons(target, { disabled = false } = {}) {
  const current = target.status || "open";
  const options = [
    { id: "met", label: "Met" },
    { id: "partly", label: "Partly met" },
    { id: "not-met", label: "Not met" },
    { id: "carry-forward", label: "Carry forward" },
  ];
  return options
    .map(
      (item) =>
        `<button type="button" class="btn pill${current === item.id ? " on" : " ghost"}" data-target-status="${item.id}"${disabled ? " disabled" : ""}>${item.label}</button>`,
    )
    .join("");
}

const TARGET_OWNERS = ["Apprentice", "Employer", "Tutor"];

function tutorOwnerOptions(current = "") {
  const value = String(current || "").trim();
  return TARGET_OWNERS.includes(value) || !value ? TARGET_OWNERS : [value, ...TARGET_OWNERS];
}

function tutorOwnerSelectHtml(current = "", { disabled = false } = {}) {
  const value = String(current || "").trim();
  const label = value || "Apprentice, employer or tutor";
  return `
    <div class="tutor-owner-picker${value ? "" : " is-empty"}${disabled ? " is-locked" : ""}" data-owner-picker>
      <input type="hidden" data-target-field="owner" value="${escapeHtml(value)}" />
      <button type="button" class="tutor-select tutor-owner-trigger" aria-haspopup="listbox" aria-expanded="false"${disabled ? " disabled" : ""}>
        <span data-owner-label>${escapeHtml(label)}</span>
      </button>
      <ul class="tutor-owner-menu" role="listbox">
        ${tutorOwnerOptions(value)
          .map((item) => {
            const on = item === value;
            return `<li><button type="button" class="tutor-owner-option${on ? " is-selected" : ""}" role="option" aria-selected="${on ? "true" : "false"}" data-owner-option="${escapeHtml(item)}">${escapeHtml(item)}</button></li>`;
          })
          .join("")}
      </ul>
    </div>
  `;
}

function tutorNewTargetFieldHtml(target, index) {
  return `
    <article class="tutor-target-edit" data-tutor-card="target" data-target-row="new" data-target-id="${escapeHtml(target.id)}" data-carried-from="${escapeHtml(target.carriedFrom || "")}">
      ${tutorHelpButton("target", "How to fill in this target")}
      <div class="tutor-target-head">
        <p class="meta">Target ${index + 1}</p>
      </div>
      ${tutorTargetFieldsHtml(target)}
      <input type="hidden" data-target-field="status" value="open" />
    </article>
  `;
}

function tutorTargetKey(value) {
  return String(value || "").trim().toLowerCase();
}

function readTutorTargetRow(row) {
  return {
    id: row.dataset.targetId || "",
    action: row.querySelector('[data-target-field="action"]')?.value || "",
    owner: row.querySelector('[data-target-field="owner"]')?.value || "",
    measure: row.querySelector('[data-target-field="measure"]')?.value || "",
    targetDate: row.querySelector('[data-target-field="target-date"]')?.value || "",
    status: row.querySelector('[data-target-field="status"]')?.value || "open",
  };
}

function fillTutorNewTargetSlot(slot, target, fromId) {
  const set = (field, value) => {
    const el = slot.querySelector(`[data-target-field="${field}"]`);
    if (el) el.value = value || "";
  };
  set("action", target.action);
  setTutorOwnerSelect(slot.querySelector('[data-target-field="owner"]'), target.owner);
  set("measure", target.measure);
  setTutorTargetDate(
    slot.querySelector("[data-date-picker]") || slot.querySelector('[data-target-field="target-date"]'),
    tutorTargetDateError(target.targetDate) ? "" : target.targetDate,
  );
  slot.dataset.carriedFrom = fromId || "";
  slot.querySelectorAll("[data-word-limit], [data-char-limit]").forEach((el) => updateTutorFieldLimit(el));
}

export function syncCarriedTargetsToSection7(formEl) {
  if (!formEl) return;
  const previous = [...formEl.querySelectorAll('[data-target-row="previous"]')].map(readTutorTargetRow);
  const slots = [...formEl.querySelectorAll('[data-target-row="new"]')];
  const carried = previous.filter((item) => item.action && item.status === "carry-forward");
  const carriedIds = new Set(carried.map((item) => item.id));
  for (const row of formEl.querySelectorAll('[data-target-row="previous"]')) {
    const note = row.querySelector("[data-target-carry-note]");
    const status = row.querySelector('[data-target-field="status"]')?.value;
    if (note) note.hidden = status !== "carry-forward";
  }
  for (const slot of slots) {
    const from = slot.dataset.carriedFrom || "";
    if (from && !carriedIds.has(from)) fillTutorNewTargetSlot(slot, emptyTarget(), "");
  }
  for (const item of carried) {
    const key = tutorTargetKey(item.action);
    const existing = slots.find(
      (slot) =>
        slot.dataset.carriedFrom === item.id ||
        tutorTargetKey(slot.querySelector('[data-target-field="action"]')?.value) === key,
    );
    if (existing) {
      fillTutorNewTargetSlot(existing, item, item.id);
      continue;
    }
    const empty = slots.find(
      (slot) => !tutorTargetKey(slot.querySelector('[data-target-field="action"]')?.value),
    );
    if (empty) fillTutorNewTargetSlot(empty, item, item.id);
  }
}

function previousTargetsForTutorForm(pack, lastNew) {
  const current = (pack?.previousTargets || []).filter((item) => item.action);
  if (current.length) return padTargets(current, REVIEW_TARGET_SLOTS);
  const fromLast = (lastNew || [])
    .filter((item) => item.action)
    .map((item) => ({
      ...item,
      status: item.status === "met" ? "open" : item.status || "open",
    }));
  return padTargets(fromLast, REVIEW_TARGET_SLOTS);
}

function newTargetsWithCarries(previousTargets, newTargets) {
  const slots = padTargets(newTargets || [], REVIEW_TARGET_SLOTS);
  const seen = new Set(slots.map((item) => tutorTargetKey(item.action)).filter(Boolean));
  for (const item of previousTargets || []) {
    if (!item.action || item.status !== "carry-forward") continue;
    const key = tutorTargetKey(item.action);
    if (seen.has(key)) {
      const match = slots.find((slot) => tutorTargetKey(slot.action) === key);
      if (match) match.carriedFrom = item.id;
      continue;
    }
    const empty = slots.find((slot) => !slot.action);
    if (!empty) break;
    empty.action = item.action;
    empty.owner = item.owner;
    empty.measure = item.measure;
    empty.targetDate = item.targetDate;
    empty.carriedFrom = item.id;
    seen.add(key);
  }
  return slots;
}

function clearSampleTutorDraft(pack) {
  const summary = String(pack?.tutorForm?.previousSummary || "");
  if (!summary.includes("Last review confirmed the apprentice is settling in well")) return pack;
  return (
    updateSavedReview(state, pack.id, {
      tutorForm: emptyTutorForm(),
      newTargets: padTargets([], REVIEW_TARGET_SLOTS),
    }) || pack
  );
}

function tutorReviewFormHtml(learner) {
  const pack = clearSampleTutorDraft(ensureTutorReviewPack(learner));
  const previous = previousTutorReview(learner, pack);
  const form = pack.tutorForm || emptyTutorForm();
  const lastForm = previous?.tutorForm || emptyTutorForm();
  const lastNew = padTargets(previous?.newTargets || [], REVIEW_TARGET_SLOTS);
  const previousTargets = previousTargetsForTutorForm(pack, lastNew);
  const newTargets = newTargetsWithCarries(previousTargets, pack.newTargets);
  const reviewerNote = pack.reviewerNotes || pack.notes || "";
  return `
    <form class="tutor-review" data-tutor-review="${escapeHtml(pack.id)}" data-learner-id="${escapeHtml(learner.id)}">
      <div class="tutor-review-bar">
        <button type="button" class="btn ghost" data-close-tutor-review>Back to your learners</button>
        <div>
          <strong>${escapeHtml(tutorReviewLabel(learner, pack))}</strong>
          <p class="meta">${escapeHtml(learner.company || "")} · ${escapeHtml(learner.postcode || "")}</p>
        </div>
      </div>
      ${tutorSection1Html(learner)}
      ${
        reviewerNote
          ? `<p class="tutor-reviewer-note"><strong>Reviewer note:</strong> ${escapeHtml(reviewerNote)}</p>`
          : ""
      }
      <div class="tutor-compare">
        ${tutorCompareRow(
          `<p class="meta">${
            previous
              ? `Last review ${formatUkDateKey(previous.visitDateKey || previous.dateKey) || "date not set"}`
              : "No previous review saved yet."
          }</p>`,
          `<p class="meta">Current review. Look left for last time.</p>`,
        )}
        ${tutorSectionHead(2, "Previous review", "Current review")}
        ${tutorCompareRow(
          tutorWriteField("Tutor summary of the previous review", "previousSummary", lastForm.previousSummary, 3, {
            readonly: true,
            limit: TUTOR_FIELD_LIMITS.previousSummary,
          }),
          tutorWriteField("Tutor summary of the previous review", "previousSummary", form.previousSummary, 3, {
            limit: TUTOR_FIELD_LIMITS.previousSummary,
            ai: "summary",
            help: "summary",
          }),
        )}
        ${previousTargets
          .map((target, index) =>
            tutorCompareRow(
              previousTargetReadHtml(target, index),
              tutorNewTargetFieldHtml(newTargets[index] || emptyTarget(), index),
            ),
          )
          .join("")}
        ${tutorSectionHead(3, "Progress update")}
        ${TUTOR_PROGRESS_ROWS.map((row) =>
          tutorCompareRow(
            tutorProgressFieldHtml(row, lastForm.progress.find((item) => item.id === row.id) || {}, {
              readonly: true,
            }),
            tutorProgressFieldHtml(row, form.progress.find((item) => item.id === row.id) || {}),
          ),
        ).join("")}
        ${tutorSectionHead(4, "GTA tutor comments")}
        ${tutorCompareRow(
          tutorWriteField("GTA tutor contribution", "tutorComment", lastForm.tutorComment, 4, {
            readonly: true,
            limit: TUTOR_FIELD_LIMITS.tutorComment,
          }),
          tutorWriteField("GTA tutor contribution", "tutorComment", form.tutorComment, 4, {
            limit: TUTOR_FIELD_LIMITS.tutorComment,
            ai: "comment",
            help: "comment",
          }),
        )}
      </div>
      <div class="tutor-review-actions">
        <button type="button" class="btn ghost" data-close-tutor-review>Back to your learners</button>
        <button type="button" class="btn ghost" data-tutor-preview>Preview PDF</button>
        <button type="submit" class="btn primary" data-tutor-save="return">Send back to reviewer</button>
      </div>
      ${tutorHelpPopupHtml()}
    </form>
  `;
}

export function renderTutorReviews() {
  const tutor = signedInTutor();
  const assigned = learnersAssignedToSignedInTutor();
  if (ensureReviewCycles(state, assigned) || repairCycleReleaseDates(state, assigned)) scheduleStateSave();
  document.body.classList.toggle("tutor-review-open", Boolean(uiState.openTutorLearnerId));
  if (uiState.openTutorLearnerId) {
    const learner = assigned.find((item) => item.id === uiState.openTutorLearnerId);
    if (learner && (tutorWindowOpen(learner) || ["returned", "print", "completed"].includes(tutorReviewPack(learner)?.status))) {
      reviewsList.innerHTML = tutorReviewFormHtml(learner);
      const formEl = reviewsList.querySelector("[data-tutor-review]");
      syncCarriedTargetsToSection7(formEl);
      refreshTutorFieldLimits(formEl);
      refreshTutorCardStates(formEl);
      if (reviewsCount) reviewsCount.textContent = "1";
      if (reviewsTitle) reviewsTitle.textContent = tutorReviewLabel(learner, ensureTutorReviewPack(learner));
      return;
    }
    uiState.openTutorLearnerId = "";
    document.body.classList.remove("tutor-review-open");
  }
  const query = String(reviewsSearch?.value || "").trim().toLowerCase();
  const rows = assigned.filter((learner) => {
    if (!query) return true;
    return [learner?.name, learner?.company, learner?.postcode, learner?.collegeDay]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const grouped = TUTOR_DUE_BANDS.map((band) => ({
    ...band,
    rows: rows.filter((learner) => tutorDueBand(state, learner) === band.id),
  })).filter((band) => band.rows.length);
  reviewsList.innerHTML = grouped.length
    ? grouped
        .map(
          (band) => `
      <section class="review-cycle-group">
        <h3 class="reviews-day-heading">${escapeHtml(band.label)} · ${band.rows.length}</h3>
        ${band.rows.map(tutorLearnerCardHtml).join("")}
      </section>`,
        )
        .join("")
    : `<p class="empty">${
        tutor
          ? "No learners are assigned to you yet. They appear here once your name is set on their GTA tutor dropdown."
          : "This login is not linked to a tutor name."
      }</p>`;
  if (reviewsCount) reviewsCount.textContent = String(rows.length);
  if (reviewsTitle) reviewsTitle.textContent = tutor ? `${tutor.name}’s learners` : "Your learners";
}
