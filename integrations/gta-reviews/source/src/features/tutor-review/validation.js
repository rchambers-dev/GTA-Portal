import { scheduleStateSave } from "../../app/persist.js";
import { cssEscape } from "../../lib/html.js";
import {
  REVIEW_INTERVAL_WEEKS,
  addDays,
  normaliseDateKey,
  startOfLocalDay,
  toDateKey,
} from "../../planner.js";
import {
  REVIEW_TARGET_SLOTS,
  TUTOR_FIELD_LIMITS,
  TUTOR_PROGRESS_ROWS,
  clipToTutorLimit,
  emptyTarget,
  emptyTutorForm,
  formatOtjHours,
  normaliseTutorForm,
  otjTrackFromHours,
  padTargets,
  parseOtjHours,
  rememberOpenTargets,
  reviewLearner,
  updateSavedReview,
} from "../../reviews.js";
import { saveState } from "../../storage.js";
import { previewReviewForm } from "../review-workflow/preview.js";

let hooks = null;

function reportUnbound() {
  console.error("Failed to run the tutor review:", "tutor review callbacks are not bound.");
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

// Placeholder until bindTutorReview. It must not be spread or serialised.
// After bind, this binding is the real app state object.
export let state = unboundState();

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function signedInTutor(...args) {
  return callHook("signedInTutor", args, null);
}

export function learnersAssignedToSignedInTutor(...args) {
  return callHook("learnersAssignedToSignedInTutor", args, []);
}

export function reviewsTodayKey(...args) {
  return callHook("reviewsTodayKey", args, "");
}

export function holdReview(...args) {
  return callHook("holdReview", args, undefined);
}

export function bindTutorReview(next) {
  hooks = next || null;
  state = next?.state || unboundState();
}

function tutorTargetSlotStarted(target) {
  return ["action", "owner", "measure", "targetDate"].some((field) =>
    String(target?.[field] || "").trim(),
  );
}

function tutorTargetSlotComplete(target) {
  return Boolean(
    String(target?.action || "").trim() &&
      String(target?.owner || "").trim() &&
      String(target?.measure || "").trim() &&
      !tutorTargetDateError(target?.targetDate),
  );
}

function tutorProgressRowComplete(row, current) {
  const evidence = String(current?.evidence || "").trim();
  if (row.id === "off_the_job") {
    return Boolean(evidence && otjTrackFromHours(current?.targetHours, current?.currentHours).rag);
  }
  return Boolean(evidence && ["red", "amber", "green"].includes(current?.rag));
}

export function tutorReviewFillProgress(pack) {
  const returned = ["returned", "print", "completed"].includes(pack?.status);
  if (returned) {
    return { started: true, remaining: 0, sent: true };
  }
  const form = normaliseTutorForm(pack?.tutorForm);
  const newTargets = padTargets(pack?.newTargets || [], REVIEW_TARGET_SLOTS);
  const previous = (pack?.previousTargets || []).filter((item) => String(item?.action || "").trim());
  const startedTargets = newTargets.filter(tutorTargetSlotStarted);
  const checks = [
    Boolean(String(form.previousSummary || "").trim()),
    Boolean(String(form.tutorComment || "").trim()),
  ];
  if (!startedTargets.length) checks.push(false);
  else startedTargets.forEach((target) => checks.push(tutorTargetSlotComplete(target)));
  TUTOR_PROGRESS_ROWS.forEach((row) => {
    checks.push(tutorProgressRowComplete(row, form.progress.find((item) => item.id === row.id) || {}));
  });
  previous.forEach((item) => checks.push(Boolean(item.status) && item.status !== "open"));
  const done = checks.filter(Boolean).length;
  const remaining = checks.length ? Math.round(((checks.length - done) / checks.length) * 100) : 100;
  return {
    started: done > 0 || startedTargets.length > 0,
    remaining,
    sent: false,
  };
}

function collectTutorForm(formEl) {
  const current = formEl.querySelector(".tutor-compare") || formEl;
  const progress = TUTOR_PROGRESS_ROWS.map((row) => {
    const rowId = cssEscape(row.id);
    const targetHours = row.id === "off_the_job"
      ? formatOtjHours(current.querySelector('.tutor-pane-current [data-otj-hours="target"]')?.value)
      : "";
    const currentHours = row.id === "off_the_job"
      ? formatOtjHours(current.querySelector('.tutor-pane-current [data-otj-hours="current"]')?.value)
      : "";
    const rag = row.id === "off_the_job"
      ? otjTrackFromHours(targetHours, currentHours).rag
      : current.querySelector(`.tutor-pane-current [data-progress-id="${rowId}"] .on`)?.dataset.rag || "";
    return {
      id: row.id,
      evidence: clipToTutorLimit(
        current.querySelector(`.tutor-pane-current [data-progress-evidence="${rowId}"]`)?.value || "",
        TUTOR_FIELD_LIMITS.progressEvidence,
      ),
      actionRef: clipToTutorLimit(
        current.querySelector(`.tutor-pane-current [data-progress-action="${rowId}"]`)?.value || "",
        TUTOR_FIELD_LIMITS.progressActionRef,
      ),
      rag,
      targetHours,
      currentHours,
    };
  });
  const previousTargets = [...formEl.querySelectorAll('[data-target-row="previous"]')].map((row) => {
    const status = row.querySelector('[data-target-field="status"]')?.value || "open";
    return {
      id: row.dataset.targetId,
      action: clipToTutorLimit(row.querySelector('[data-target-field="action"]')?.value || "", TUTOR_FIELD_LIMITS.previousAction),
      owner: row.querySelector('[data-target-field="owner"]')?.value || "",
      measure: clipToTutorLimit(row.querySelector('[data-target-field="measure"]')?.value || "", TUTOR_FIELD_LIMITS.previousMeasure),
      targetDate: row.querySelector('[data-target-field="target-date"]')?.value || "",
      status,
    };
  });
  const newTargets = [...formEl.querySelectorAll('[data-target-row="new"]')].map((row) => ({
    id: row.dataset.targetId,
    action: clipToTutorLimit(row.querySelector('[data-target-field="action"]')?.value || "", TUTOR_FIELD_LIMITS.newAction),
    owner: row.querySelector('[data-target-field="owner"]')?.value || "",
    measure: clipToTutorLimit(row.querySelector('[data-target-field="measure"]')?.value || "", TUTOR_FIELD_LIMITS.newMeasure),
    targetDate: row.querySelector('[data-target-field="target-date"]')?.value || "",
    status: "open",
  }));
  const carried = previousTargets
    .filter((item) => item.action && item.status === "carry-forward")
    .map((item) => ({
      ...emptyTarget(),
      action: item.action,
      owner: item.owner,
      measure: item.measure,
      targetDate: item.targetDate,
      status: "open",
    }));
  const merged = [];
  const seen = new Set();
  for (const item of [...newTargets.filter((row) => row.action), ...carried]) {
    const key = item.action.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return {
    tutorForm: {
      ...emptyTutorForm(),
      previousSummary: clipToTutorLimit(
        current.querySelector('.tutor-pane-current [name="previousSummary"]')?.value || "",
        TUTOR_FIELD_LIMITS.previousSummary,
      ),
      apprenticeComment: "",
      employerComment: "",
      tutorComment: clipToTutorLimit(
        current.querySelector('.tutor-pane-current [name="tutorComment"]')?.value || "",
        TUTOR_FIELD_LIMITS.tutorComment,
      ),
      agreedSummary: "",
      differingViews: "",
      progress,
    },
    previousTargets,
    newTargets: padTargets(merged, REVIEW_TARGET_SLOTS),
  };
}

export function tutorTargetDateWindow() {
  const min = reviewsTodayKey();
  const max = toDateKey(addDays(startOfLocalDay(new Date()), REVIEW_INTERVAL_WEEKS * 7));
  return { min, max };
}

export function tutorTargetDateError(value) {
  const date = normaliseDateKey(value);
  const { min, max } = tutorTargetDateWindow();
  if (!date) return "Choose a target date.";
  if (date < min) return "Target dates cannot be in the past.";
  if (date > max) return `Target dates must be within the next ${REVIEW_INTERVAL_WEEKS} weeks.`;
  return "";
}

function tutorRowStarted(row) {
  return ["action", "owner", "measure", "target-date"].some((field) =>
    String(row.querySelector(`[data-target-field="${field}"]`)?.value || "").trim(),
  );
}

function tutorCardComplete(card) {
  const kind = card?.dataset.tutorCard;
  if (kind === "summary") {
    return Boolean(card.querySelector('[name="previousSummary"]')?.value.trim());
  }
  if (kind === "comment") {
    return Boolean(card.querySelector('[name="tutorComment"]')?.value.trim());
  }
  if (kind === "target") {
    if (!tutorRowStarted(card)) return null;
    const date = card.querySelector('[data-target-field="target-date"]')?.value;
    return Boolean(
      card.querySelector('[data-target-field="action"]')?.value.trim() &&
        card.querySelector('[data-target-field="owner"]')?.value.trim() &&
        card.querySelector('[data-target-field="measure"]')?.value.trim() &&
        !tutorTargetDateError(date),
    );
  }
  if (kind === "previous-target") {
    const hasTarget = Boolean(card.querySelector('[data-target-field="action"]')?.value.trim());
    if (!hasTarget) return null;
    return (card.querySelector('[data-target-field="status"]')?.value || "open") !== "open";
  }
  if (kind === "progress") {
    const evidence = card.querySelector("[data-progress-evidence]");
    const id = evidence?.dataset.progressEvidence;
    if (id === "off_the_job") {
      const target = parseOtjHours(card.querySelector('[data-otj-hours="target"]')?.value);
      const current = parseOtjHours(card.querySelector('[data-otj-hours="current"]')?.value);
      return Boolean(String(evidence?.value || "").trim() && target != null && target > 0 && current != null);
    }
    const rag = card.querySelector(".tutor-rag .on")?.dataset.rag;
    return Boolean(String(evidence?.value || "").trim() && ["red", "amber", "green"].includes(rag));
  }
  return null;
}

function applyTutorCardTone(card) {
  if (!card) return;
  const complete = tutorCardComplete(card);
  const unfinished = card.classList.contains("is-touched") && complete === false;
  card.classList.toggle("is-complete", complete === true);
  card.classList.toggle("is-unfinished", unfinished);
  const cell = card.closest(".tutor-compare-cell");
  if (cell) {
    cell.classList.toggle("is-complete", complete === true);
    cell.classList.toggle("is-unfinished", unfinished);
  }
}

function refreshTutorSendButton(formEl) {
  const button = formEl?.querySelector('[data-tutor-save="return"]');
  if (!button) return;
  const ready = !firstTutorFormGap(formEl);
  button.classList.toggle("is-ready", ready);
  button.classList.toggle("is-blocked", !ready);
}

export function refreshTutorCardStates(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll("[data-tutor-card]").forEach((card) => {
    if (card.closest(".tutor-pane-previous") && card.dataset.tutorCard !== "previous-target") return;
    applyTutorCardTone(card);
  });
  refreshTutorSendButton(formEl);
}

export function markTutorCardTouched(el) {
  const card = el?.closest?.("[data-tutor-card]");
  if (!card) return;
  if (card.closest(".tutor-pane-previous") && card.dataset.tutorCard !== "previous-target") return;
  card.classList.add("is-touched");
  refreshTutorCardStates(card.closest("[data-tutor-review]"));
}

function firstTutorFormGap(formEl) {
  const pane = formEl.querySelector(".tutor-compare") || formEl;
  const summary = pane.querySelector('.tutor-pane-current [name="previousSummary"]');
  if (!String(summary?.value || "").trim()) {
    return {
      card: summary?.closest("[data-tutor-card]"),
      focus: summary,
      message: "Write the tutor summary of the previous review.",
    };
  }

  const targetRows = [...formEl.querySelectorAll('.tutor-pane-current [data-target-row="new"]')];
  const started = targetRows.filter(tutorRowStarted);
  if (!started.length) {
    return {
      card: targetRows[0],
      focus: targetRows[0]?.querySelector('[data-target-field="action"]'),
      message: "Add at least one current target.",
    };
  }
  for (let index = 0; index < started.length; index += 1) {
    const row = started[index];
    const label = started.length > 1 ? ` for target ${index + 1}` : "";
    const action = row.querySelector('[data-target-field="action"]');
    const owner = row.querySelector('[data-target-field="owner"]');
    const ownerTrigger = row.querySelector(".tutor-owner-trigger");
    const measure = row.querySelector('[data-target-field="measure"]');
    const date = row.querySelector('[data-target-field="target-date"]');
    if (!String(action?.value || "").trim()) {
      return { card: row, focus: action, message: `Write the action / target${label}.` };
    }
    if (!String(owner?.value || "").trim()) {
      return { card: row, focus: ownerTrigger || owner, message: `Choose who owns the target${label}.` };
    }
    if (!String(measure?.value || "").trim()) {
      return { card: row, focus: measure, message: `Write the success measure${label}.` };
    }
    const dateError = tutorTargetDateError(date?.value);
    if (dateError) {
      return {
        card: row,
        focus: row.querySelector(".tutor-date-trigger") || date,
        message: started.length > 1 ? dateError.replace("Target dates", `Target ${index + 1} date`) : dateError,
      };
    }
  }

  for (const row of formEl.querySelectorAll('[data-target-row="previous"]')) {
    const hasTarget = Boolean(row.querySelector('[data-target-field="action"]')?.value.trim());
    const status = row.querySelector('[data-target-field="status"]')?.value || "open";
    if (hasTarget && status === "open") {
      return {
        card: row,
        focus: row.querySelector("[data-target-status]"),
        message: "Mark each previous target as met, partly met, not met or carry forward.",
      };
    }
  }

  for (const row of TUTOR_PROGRESS_ROWS) {
    const rowId = cssEscape(row.id);
    const evidence = pane.querySelector(`.tutor-pane-current [data-progress-evidence="${rowId}"]`);
    const card = evidence?.closest("[data-tutor-card]");
    if (!String(evidence?.value || "").trim()) {
      return { card, focus: evidence, message: `Write evidence for ${row.label}.` };
    }
    if (row.id === "off_the_job") {
      const hours = pane.querySelector(".tutor-pane-current .tutor-otj-hours");
      const targetField = hours?.querySelector('[data-otj-hours="target"]');
      const currentField = hours?.querySelector('[data-otj-hours="current"]');
      const target = parseOtjHours(targetField?.value);
      const currentHours = parseOtjHours(currentField?.value);
      if (target == null) return { card, focus: targetField, message: "Enter the target off-the-job hours." };
      if (target === 0) return { card, focus: targetField, message: "Target off-the-job hours must be more than 0." };
      if (currentHours == null) return { card, focus: currentField, message: "Enter the current off-the-job hours." };
      continue;
    }
    const rag = pane.querySelector(`.tutor-pane-current [data-progress-id="${rowId}"]`);
    const ragValue = rag?.querySelector(".on")?.dataset.rag;
    if (!["red", "amber", "green"].includes(ragValue)) {
      return { card, focus: rag?.querySelector("[data-rag]"), message: `Mark ${row.label} as red, amber or green.` };
    }
  }

  const comment = pane.querySelector('.tutor-pane-current [name="tutorComment"]');
  if (!String(comment?.value || "").trim()) {
    return {
      card: comment?.closest("[data-tutor-card]"),
      focus: comment,
      message: "Write the GTA tutor contribution.",
    };
  }
  return null;
}

function clearTutorValidation(formEl) {
  formEl.querySelectorAll(".is-missing, .is-unfinished").forEach((item) => {
    item.classList.remove("is-missing", "is-unfinished");
  });
}

function tutorScrollParent(el) {
  let node = el?.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(`${style.overflow}${style.overflowY}`) && node.scrollHeight > node.clientHeight + 8) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

function shakeTutorEl(el) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      el.classList.remove("is-shake");
      resolve();
    };
    el.classList.remove("is-shake");
    void el.offsetWidth;
    el.classList.add("is-shake");
    el.addEventListener("animationend", done, { once: true });
    setTimeout(done, 700);
  });
}

export function shakeTutorSendButton(button) {
  return shakeTutorEl(button);
}

const PRESSABLE_BUTTON =
  ".btn, .settings-tab, .priority-option, .time-option, .cal-cell, .tutor-learner-toggle, .tutor-help-btn, .tutor-ai-btn, .tutor-select, .tutor-owner-option, .tutor-date-shortcut, .tutor-date-cell, .records-review-chip button, button.archive-person, button.pill.status-chip";

export function popTutorButton(button) {
  if (!button || button.disabled) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  button.classList.remove("is-pop");
  void button.offsetWidth;
  button.classList.add("is-pop");
  button.addEventListener("animationend", () => button.classList.remove("is-pop"), { once: true });
}

export function mountTutorPressEffects() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(PRESSABLE_BUTTON);
    if (!button || button.disabled || button.classList.contains("link")) return;
    if (button.classList.contains("cal-cell") && (button.classList.contains("empty") || button.classList.contains("muted"))) return;
    if (button.classList.contains("tutor-date-cell") && button.classList.contains("is-empty")) return;
    popTutorButton(button);
  });
}

function scrollTutorToEl(el) {
  return new Promise((resolve) => {
    if (!el) {
      resolve();
      return;
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) {
      el.scrollIntoView({ behavior: "auto", block: "center" });
      resolve();
      return;
    }
    const scroller = tutorScrollParent(el);
    const isWindow = scroller === window;
    const viewH = isWindow ? window.innerHeight : scroller.clientHeight;
    const start = isWindow ? window.scrollY : scroller.scrollTop;
    const rect = el.getBoundingClientRect();
    const scrollerTop = isWindow ? 0 : scroller.getBoundingClientRect().top;
    const end = start + rect.top - scrollerTop - Math.max(88, (viewH - Math.min(rect.height, viewH * 0.72)) / 2);
    const distance = end - start;
    if (Math.abs(distance) < 8) {
      resolve();
      return;
    }
    const duration = Math.min(2200, Math.max(1100, Math.abs(distance) * 1.15));
    const begun = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const step = (now) => {
      const t = Math.min(1, (now - begun) / duration);
      const next = start + distance * ease(t);
      if (isWindow) window.scrollTo(0, next);
      else scroller.scrollTop = next;
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function revealTutorFormGap(check) {
  const target = check?.card || check?.focus;
  const section =
    target?.closest?.(".tutor-compare-cell") ||
    target?.closest?.("[data-tutor-card]") ||
    target;
  const controls =
    target?.closest?.(".tutor-rag, .tutor-target-actions") ||
    section?.querySelector?.(".tutor-rag, .tutor-target-actions");
  return scrollTutorToEl(target).then(() => {
    check?.focus?.focus?.({ preventScroll: true });
    return Promise.all([shakeTutorEl(section), shakeTutorEl(controls)]);
  });
}

export function validateTutorForm(formEl) {
  clearTutorValidation(formEl);
  refreshTutorCardStates(formEl);
  const gap = firstTutorFormGap(formEl);
  if (!gap) return { ok: true, message: "", focus: null };
  gap.card?.classList.add("is-touched", "is-unfinished");
  applyTutorCardTone(gap.card);
  const focus =
    gap.focus ||
    gap.card?.querySelector("input, textarea, button, select, .tutor-owner-trigger, .tutor-date-trigger");
  return { ok: false, message: gap.message, focus };
}

export async function previewTutorReview(formEl) {
  const saved = saveTutorReview(formEl, { sendBack: false });
  if (!saved) {
    setStatus("Could not prepare this review for preview.");
    return;
  }
  if (!hooks?.state) {
    reportUnbound();
    return;
  }
  await saveState(state);
  await previewReviewForm(saved.learnerId, saved);
}

export function saveTutorReview(formEl, { sendBack = false } = {}) {
  const reviewId = formEl.dataset.tutorReview;
  const learnerId = formEl.dataset.learnerId;
  const patch = collectTutorForm(formEl);
  if (sendBack) holdReview(reviewId, "returned");
  const saved = updateSavedReview(state, reviewId, patch);
  const learner = reviewLearner(state, learnerId);
  if (saved && learner) rememberOpenTargets(learner, saved);
  scheduleStateSave();
  return saved;
}
