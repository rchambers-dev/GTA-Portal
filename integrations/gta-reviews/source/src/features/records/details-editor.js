import {
  archiveList,
  dayDetail,
  followUpList,
  learnerList,
  learnerSheetBody,
  recordsList,
} from "../../app/dom.js";
import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { formatPostcode } from "../../geo.js";
import { formatDateKeyLabel } from "../../lib/format.js";
import { escapeHtml } from "../../lib/html.js";
import { isTestLearner } from "../../lib/learners.js";
import {
  REVIEW_INTERVAL_WEEKS,
  WEEKDAYS,
  applyLearnerProfile,
  followingReviewDateKey,
  isFinalReviewDate,
  learnerProfileFrom,
  nextScheduledReviewDateKey,
  normaliseApprenticeship,
  normaliseCompany,
  normaliseDateKey,
  normaliseEmployer,
  normalisePhone,
  normaliseTutor,
  reviewCycleDateKeys,
  reviewIntervalWeeks,
  scheduleEndFromDates,
  startOfLocalDay,
  toDateKey,
  tutorLookupKey,
} from "../../planner.js";
import { createSavedReview, findSavedReview, setReviewHolder } from "../../reviews.js";
import { mergedTutorNames, officialTutorNames } from "../../tutors.js";
import { cssEscape } from "../../lib/html.js";
import {
  activeAwaitingDateKey,
  hasOpenUnbookedReview,
  isPaperVisitDoneOnCompletedRoute,
  isReleasedToTutor,
  isVisitConfirmed,
  needsPlanBooking,
  state,
} from "../planner/status.js";
import { validateLearner } from "./validate-learner.js";

let hooks = null;

function reportUnbound() {
  console.error("Failed to run the records:", "records callbacks are not bound.");
}

function callHook(name, args, fallback) {
  const fn = hooks?.[name];
  if (typeof fn !== "function") {
    reportUnbound();
    return fallback;
  }
  return fn(...args);
}

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function refreshLearnerSurfaces(...args) {
  return callHook("refreshLearnerSurfaces", args, undefined);
}

export function closeLearnerSheet(...args) {
  return callHook("closeLearnerSheet", args, undefined);
}

export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function logAction(...args) {
  return callHook("logAction", args, undefined);
}

export function saveManagedDetails(...args) {
  return callHook("saveManagedDetails", args, false);
}

export function missingLearnerFields(...args) {
  return callHook("missingLearnerFields", args, []);
}

export function concernButton(...args) {
  return callHook("concernButton", args, "");
}

export function safeguardingPill(...args) {
  return callHook("safeguardingPill", args, "");
}

export function bindRecordsDetails(next) {
  hooks = next || null;
}

export function findEditableLearner(learnerId) {
  return (
    state.learners.find((item) => item.id === learnerId) ||
    (state.followUps || []).find((item) => item.id === learnerId) ||
    (state.archive || []).find((item) => item.id === learnerId) ||
    null
  );
}

export function learnerFormEl(selector) {
  return (
    learnerSheetBody?.querySelector(selector) ||
    dayDetail?.querySelector(selector) ||
    learnerList?.querySelector(selector) ||
    followUpList?.querySelector(selector) ||
    archiveList?.querySelector(selector) ||
    null
  );
}

export function detailsFormEl(learnerId) {
  return learnerFormEl(`[data-details-form="${cssEscape(learnerId)}"]`);
}

export function toggleDetailsEditor(learnerId) {
  if (uiState.dirtyDetails) {
    const closing = uiState.dirtyDetails.learnerId === learnerId && uiState.detailsEditorId === learnerId;
    if (!flushDirtyDetails()) return;
    if (closing) return;
  }
  uiState.detailsEditorId = uiState.detailsEditorId === learnerId ? "" : learnerId;
  uiState.appointmentEditorId = "";
  uiState.noteEditorId = "";
  uiState.phoneEditorId = "";
  uiState.reviewEditorId = "";
  refreshLearnerSurfaces();
}

export const LEARNER_INFO_FIELDS = [
  {
    key: "tutor",
    attr: "tutor",
    label: "GTA tutor",
    type: "text",
    placeholder: "e.g. Sam Khan",
    missing: "tutor",
  },
  {
    key: "apprenticeship",
    attr: "apprenticeship",
    label: "Apprenticeship standard / route / level",
    type: "text",
    placeholder: "e.g. Engineering technician",
    missing: "apprenticeship",
  },
  {
    key: "apprenticeshipStartDate",
    attr: "apprenticeship-start",
    label: "Apprenticeship start date",
    type: "date",
    missing: "start date",
  },
  {
    key: "apprenticeshipEndDate",
    attr: "apprenticeship-end",
    label: "Apprenticeship planned end date",
    type: "date",
    missing: "end date",
  },
  {
    key: "gtaReviewer",
    attr: "gta-reviewer",
    label: "GTA reviewer",
    type: "text",
    placeholder: "e.g. Reiss Chambers",
    missing: "GTA reviewer",
  },
  {
    key: "employerContact",
    attr: "employer-contact",
    label: "Employer contact name",
    type: "text",
    placeholder: "e.g. Jo Smith",
    missing: "employer contact",
  },
  {
    key: "employerEmail",
    attr: "employer-email",
    label: "Employer contact email",
    type: "email",
    placeholder: "e.g. jo@company.com",
    missing: "employer email",
  },
  {
    key: "contactNumber",
    attr: "contact-number",
    label: "Employer contact phone",
    type: "tel",
    placeholder: "e.g. 01302 123456",
    missing: "contact number",
  },
];

const DATE_DETAIL_KEYS = new Set([
  "apprenticeshipStartDate",
  "apprenticeshipEndDate",
  "plannedReviewDate",
]);

const DETAIL_LOG_FIELDS = [
  { key: "name", label: "Name" },
  { key: "company", label: "Employer / workplace" },
  { key: "postcode", label: "Postcode" },
  { key: "collegeDay", label: "Release day" },
  ...LEARNER_INFO_FIELDS.map((field) => ({ key: field.key, label: field.label })),
  { key: "plannedReviewDate", label: "Planned review date" },
];

function snapshotLearnerDetails(learner) {
  return {
    name: String(learner?.name || "").trim(),
    company: normaliseCompany(learner?.company),
    postcode: formatPostcode(learner?.postcode || ""),
    collegeDay: learner?.collegeDay || "",
    ...learnerProfileFrom(learner),
  };
}

export function readFormDetails(formEl, prefix) {
  return {
    name: formEl.querySelector(`[data-${prefix}-name]`)?.value.trim() || "",
    company: normaliseCompany(formEl.querySelector(`[data-${prefix}-company]`)?.value),
    postcode: formatPostcode(formEl.querySelector(`[data-${prefix}-postcode]`)?.value || ""),
    collegeDay: formEl.querySelector(`[data-${prefix}-college]`)?.value || "",
    ...readLearnerInfo(formEl, prefix),
  };
}

function detailCompareValue(key, value) {
  if (key === "contactNumber") return normalisePhone(value);
  if (key === "postcode") return formatPostcode(value || "");
  if (key === "company") return normaliseCompany(value);
  if (DATE_DETAIL_KEYS.has(key)) return normaliseDateKey(value) || "";
  return String(value || "").trim();
}

function detailDisplayValue(key, value) {
  const raw = detailCompareValue(key, value);
  if (!raw) return "blank";
  if (DATE_DETAIL_KEYS.has(key)) return formatDateKeyLabel(raw) || raw;
  return raw;
}

function detailsDiff(before, after) {
  return DETAIL_LOG_FIELDS.filter(
    (field) => detailCompareValue(field.key, before?.[field.key]) !== detailCompareValue(field.key, after?.[field.key]),
  ).map((field) => ({
    field: field.label,
    from: detailDisplayValue(field.key, before?.[field.key]),
    to: detailDisplayValue(field.key, after?.[field.key]),
  }));
}

function logDetailsEdits(learner, before, after) {
  for (const change of detailsDiff(before, after)) {
    logAction({
      type: "edited",
      learner,
      label: `${change.field}: ${change.from} → ${change.to}`,
    });
  }
}

export function dirtyDetailsForm() {
  if (!uiState.dirtyDetails) return null;
  if (uiState.dirtyDetails.source === "records") {
    return recordsList?.querySelector(`[data-records-details="${cssEscape(uiState.dirtyDetails.learnerId)}"]`) || null;
  }
  return detailsFormEl(uiState.dirtyDetails.learnerId);
}

function clearDirtyDetails() {
  document.querySelectorAll(".records-details.is-dirty, .details-form.is-dirty").forEach((form) => {
    form.classList.remove("is-dirty");
  });
  document.getElementById("details-save-bar")?.remove();
  uiState.dirtyDetails = null;
}

function syncDirtySaveBar() {
  if (!uiState.dirtyDetails) {
    document.getElementById("details-save-bar")?.remove();
    return;
  }
  const learner = findEditableLearner(uiState.dirtyDetails.learnerId);
  let bar = document.getElementById("details-save-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "details-save-bar";
    bar.className = "details-save-bar";
    document.body.appendChild(bar);
  }
  bar.innerHTML = `
    <strong>${escapeHtml(learner?.name || "Learner")}</strong>
    <button type="button" class="btn pill primary" data-flush-details>Save details</button>
  `;
}

export function highlightDirtySave() {
  const bar = document.getElementById("details-save-bar");
  if (bar) {
    bar.classList.remove("is-pulse");
    void bar.offsetWidth;
    bar.classList.add("is-pulse");
  }
  const form = dirtyDetailsForm();
  form?.querySelector('button[type="submit"]')?.focus();
  form?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function markDetailsDirty(formEl) {
  if (!formEl || uiState.flushingDetails) return;
  const source = formEl.hasAttribute("data-records-details") ? "records" : "details";
  const learnerId =
    source === "records" ? formEl.dataset.recordsDetails : formEl.dataset.detailsForm;
  if (!learnerId) return;
  if (uiState.dirtyDetails && uiState.dirtyDetails.learnerId !== learnerId) {
    if (!flushDirtyDetails()) return;
  }
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  const prefix = source === "records" ? "records" : "details";
  const before =
    uiState.dirtyDetails?.learnerId === learnerId ? uiState.dirtyDetails.before : snapshotLearnerDetails(learner);
  const after = readFormDetails(formEl, prefix);
  if (!detailsDiff(before, after).length) {
    clearDirtyDetails();
    return;
  }
  uiState.dirtyDetails = { learnerId, source, before };
  formEl.classList.add("is-dirty");
  syncDirtySaveBar();
}

export function onDetailsFieldChange(event) {
  const form = event.target.closest("[data-records-details], [data-details-form]");
  if (!form) return;
  markDetailsDirty(form);
}

export function flushDirtyDetails() {
  if (!uiState.dirtyDetails) return true;
  if (uiState.flushingDetails) return false;
  uiState.flushingDetails = true;
  try {
    const ok =
      uiState.dirtyDetails.source === "records"
        ? saveManagedDetails(uiState.dirtyDetails.learnerId)
        : saveLearnerDetails(uiState.dirtyDetails.learnerId, { closeEditor: false });
    if (!ok) highlightDirtySave();
    return Boolean(ok);
  } finally {
    uiState.flushingDetails = false;
  }
}

function bookingReviewDateKey(learner) {
  return (
    normaliseDateKey(learner?.plannedReviewDate) ||
    nextScheduledReviewDateKey(learner) ||
    toDateKey(startOfLocalDay(new Date()))
  );
}

export function placeLearnerOnToBook(learner) {
  if (!learner?.id || isTestLearner(learner)) return false;
  if (learner.needsRecordCheck || missingLearnerFields(learner).length) return false;
  if (isVisitConfirmed(learner) || isPaperVisitDoneOnCompletedRoute(learner)) return false;
  if (isReleasedToTutor(learner) || activeAwaitingDateKey(learner)) return false;
  const wasBookable = !learner.heldFromPlan && needsPlanBooking(learner);
  if (learner.heldFromPlan) learner.heldFromPlan = false;
  if (!hasOpenUnbookedReview(learner)) {
    let dateKey = bookingReviewDateKey(learner);
    let review = findSavedReview(state, learner.id, dateKey);
    if (review?.status === "completed") {
      const today = toDateKey(startOfLocalDay(new Date()));
      const nextKey = dateKey === today ? followingReviewDateKey(learner) : today;
      if (nextKey && nextKey !== dateKey) {
        dateKey = nextKey;
        review = findSavedReview(state, learner.id, dateKey);
      }
    }
    if (!review || review.status === "completed") {
      review = createSavedReview(state, {
        learnerId: learner.id,
        dateKey,
        source: "records",
      }).review;
    }
    if (review && !["returned", "print"].includes(review.status)) {
      setReviewHolder(state, review.id, "returned");
    }
  }
  const queued = needsPlanBooking(learner);
  if (queued && !wasBookable) {
    logAction({ type: "edited", learner, label: "Added to To book" });
  }
  return queued && !wasBookable;
}

export function toBookStatusNote(learner, { wasAwaitingCheck = false, queued = false } = {}) {
  if (!wasAwaitingCheck) return "";
  if (queued || needsPlanBooking(learner)) return " Added to To book.";
  const missing = missingLearnerFields(learner);
  if (learner.needsRecordCheck || missing.length) {
    const still = missing.length ? missing.join(", ") : "a details check";
    return ` Still missing ${still}, so they are not on To book yet.`;
  }
  return "";
}

export function commitLearnerDetails(learner, details, { closeEditor = false, keepCheck = false } = {}) {
  const before =
    uiState.dirtyDetails?.learnerId === learner.id
      ? uiState.dirtyDetails.before
      : snapshotLearnerDetails(learner);
  const onRoster = state.learners.some((item) => item.id === learner.id);
  const previousName = learner.name;
  const wasAwaitingCheck =
    Boolean(learner.needsRecordCheck) || missingLearnerFields(learner).length > 0;
  const result = applyLearnerIdentity(learner, details);
  touchLearner(learner);
  rememberTutorName(learner.tutor);
  logDetailsEdits(learner, before, details);
  if (closeEditor) uiState.detailsEditorId = "";
  if (!keepCheck) learner.needsRecordCheck = false;
  const queuedForBooking =
    wasAwaitingCheck && !keepCheck ? placeLearnerOnToBook(learner) : false;
  clearDirtyDetails();
  scheduleStateSave();
  renderLearners();
  if (closeEditor) closeLearnerSheet({ silent: true });
  if (onRoster) refreshPlannedWeek({ rebuild: true, fillGaps: true });
  return { ...result, previousName, wasAwaitingCheck, queuedForBooking };
}

export function plannedReviewInputValue(learner) {
  return learner?.plannedReviewDate || "";
}

export function plannedCycleOptions(startKey, officialEndKey, weeks = REVIEW_INTERVAL_WEEKS) {
  const official = officialEndKey || "";
  if (!startKey) {
    if (official) {
      return `<option value="">Final review · ${escapeHtml(formatDateKeyLabel(official))}</option>`;
    }
    return `<option value="" disabled hidden selected>Enter the planned review date first</option>`;
  }
  const overrun = Boolean(official && startKey > official);
  const endKey = official || scheduleEndFromDates(startKey, official, weeks);
  const future = reviewCycleDateKeys(startKey, endKey, { includeStart: false, weeks });
  if (!future.length) {
    if (official && official === startKey) {
      return `<option value="">Final review · ${escapeHtml(formatDateKeyLabel(official))}</option>`;
    }
    return `<option value="">${overrun ? "No further dates set yet" : "No further reviews before the apprenticeship ends"}</option>`;
  }
  const finalOnEnd = Boolean(official && future.some((key) => isFinalReviewDate(key, official)));
  return [
    `<option value="">${future.length} future review${future.length === 1 ? "" : "s"}${finalOnEnd ? " · includes final review" : ""}</option>`,
    ...future.map((key) => {
      const label = isFinalReviewDate(key, official)
        ? `Final review · ${formatDateKeyLabel(key)}`
        : formatDateKeyLabel(key);
      return `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`;
    }),
  ].join("");
}

export function refreshPlannedCycleSelect(formEl, prefix) {
  if (!formEl) return;
  const start = formEl.querySelector(`[data-${prefix}-planned-review]`)?.value || "";
  const end = formEl.querySelector(`[data-${prefix}-apprenticeship-end]`)?.value || "";
  const select = formEl.querySelector(`[data-${prefix}-planned-cycle]`);
  const learnerId = formEl.dataset.recordsDetails || formEl.dataset.detailsForm || "";
  const weeks = reviewIntervalWeeks(learnerId ? findEditableLearner(learnerId) : null);
  if (select) select.innerHTML = plannedCycleOptions(start, end, weeks);
}

export function onPlannedCycleFieldInput(event) {
  const field = event.target.closest(
    "[data-records-planned-review], [data-records-apprenticeship-end], [data-details-planned-review], [data-details-apprenticeship-end], [data-add-planned-review], [data-add-apprenticeship-end]",
  );
  if (!field) return;
  const recordsForm = field.closest("[data-records-details]");
  if (recordsForm) {
    refreshPlannedCycleSelect(recordsForm, "records");
    return;
  }
  const detailsForm = field.closest("[data-details-form]");
  if (detailsForm) {
    refreshPlannedCycleSelect(detailsForm, "details");
    return;
  }
  const addForm = field.closest("#learner-form");
  if (addForm) refreshPlannedCycleSelect(addForm, "add");
}

export function catalogueLearners() {
  return [
    ...(state.learners || []),
    ...(state.followUps || []),
    ...(state.archive || []),
  ];
}

export function knownTutors() {
  return mergedTutorNames(
    state.settings?.customTutors,
    catalogueLearners().map((item) => item?.tutor),
  );
}

export function rememberTutorName(name) {
  const tutor = normaliseTutor(name);
  if (!tutor) return false;
  const key = tutorLookupKey(tutor);
  if (officialTutorNames().some((item) => tutorLookupKey(item) === key)) return false;
  const current = Array.isArray(state.settings.customTutors) ? state.settings.customTutors : [];
  if (current.some((item) => tutorLookupKey(item) === key)) return false;
  state.settings.customTutors = [...current, tutor];
  return true;
}

function knownApprenticeships() {
  const names = new Map();
  for (const label of [
    "Autocare Standard Level 2",
    "Auto Technician",
    "Light Vehicle Maintenance",
    "LVM Standard",
    "HVM Standard",
    "Engineering technician",
    "Paint Standard",
    "Panel Standard",
  ]) {
    names.set(label.toLowerCase(), label);
  }
  for (const item of catalogueLearners()) {
    const name = normaliseApprenticeship(item?.apprenticeship);
    if (name) names.set(name.toLowerCase(), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function comboSelectOptions(kind, current) {
  const value = kind === "tutor" ? normaliseTutor(current) : normaliseApprenticeship(current);
  const names = kind === "tutor" ? knownTutors() : knownApprenticeships();
  const options = new Set(names);
  if (value) options.add(value);
  return [
    `<option value="" disabled hidden${value ? "" : " selected"}>Choose ${kind === "tutor" ? "tutor" : "apprenticeship"}</option>`,
    ...[...options]
      .sort((a, b) => a.localeCompare(b))
      .map(
        (name) =>
          `<option value="${escapeHtml(name)}"${name === value ? " selected" : ""}>${escapeHtml(name)}</option>`,
      ),
    `<option value="__new__">Add a new ${kind === "tutor" ? "tutor" : "apprenticeship"}</option>`,
  ].join("");
}

function comboFieldHtml(kind, prefix, attr, label, current, missing) {
  return `<label class="${missing ? "is-missing" : ""}">${label}<select data-${prefix}-${attr} data-combo="${kind}">${comboSelectOptions(kind, current)}</select><input data-${prefix}-${attr}-new class="combo-new" hidden placeholder="Type the ${kind === "tutor" ? "tutor’s name" : "apprenticeship"}" /></label>`;
}

function comboFieldValue(formEl, prefix, attr, normalise) {
  const select = formEl.querySelector(`[data-${prefix}-${attr}]`);
  const typed = formEl.querySelector(`[data-${prefix}-${attr}-new]`)?.value || "";
  const raw = select?.value === "__new__" ? typed : select?.value || typed;
  return normalise(raw);
}

export function fillComboSelect(select, kind, current) {
  if (!select) return;
  select.innerHTML = comboSelectOptions(kind, current);
  const typed = select.parentElement?.querySelector(".combo-new");
  if (typed) typed.hidden = select.value !== "__new__";
}

export function currentComboValue(select, kind) {
  if (!select) return "";
  const typed = select.parentElement?.querySelector(".combo-new")?.value || "";
  const raw = select.value === "__new__" ? typed : select.value || typed;
  return kind === "tutor" ? normaliseTutor(raw) : normaliseApprenticeship(raw);
}

export function onComboSelectChange(event) {
  const select = event.target.closest("[data-combo]");
  if (!select) return;
  const typed = select.parentElement?.querySelector(".combo-new");
  if (typed) {
    typed.hidden = select.value !== "__new__";
    if (select.value === "__new__") typed.focus();
  }
}

export function readLearnerInfo(formEl, prefix) {
  const info = {};
  for (const field of LEARNER_INFO_FIELDS) {
    if (field.key === "tutor") {
      info.tutor = comboFieldValue(formEl, prefix, field.attr, normaliseTutor);
      continue;
    }
    if (field.key === "apprenticeship") {
      info.apprenticeship = comboFieldValue(formEl, prefix, field.attr, normaliseApprenticeship);
      continue;
    }
    info[field.key] = formEl.querySelector(`[data-${prefix}-${field.attr}]`)?.value || "";
  }
  info.plannedReviewDate =
    formEl.querySelector(`[data-${prefix}-planned-review]`)?.value || "";
  return info;
}

export function learnerInfoFieldsHtml(learner, missing, prefix) {
  const plannedValue = plannedReviewInputValue(learner);
  const plannedMissing = missing.includes("planned review date");
  const fields = LEARNER_INFO_FIELDS.map((field) => {
    if (field.key === "tutor") {
      return comboFieldHtml(
        "tutor",
        prefix,
        field.attr,
        field.label,
        learner?.tutor || "",
        missing.includes(field.missing),
      );
    }
    if (field.key === "apprenticeship") {
      return comboFieldHtml(
        "apprenticeship",
        prefix,
        field.attr,
        field.label,
        learner?.apprenticeship || "",
        missing.includes(field.missing),
      );
    }
    const value =
      field.key === "contactNumber"
        ? normalisePhone(learner?.[field.key])
        : learner?.[field.key] || "";
    const extra = field.placeholder
      ? ` placeholder="${escapeHtml(field.placeholder)}"`
      : "";
    return `<label class="${missing.includes(field.missing) ? "is-missing" : ""}">${field.label}<input type="${field.type}" data-${prefix}-${field.attr} value="${escapeHtml(value)}"${extra} /></label>`;
  });
  fields.push(`
    <div class="records-planned-cycle">
      <label class="${plannedMissing ? "is-missing" : ""}">Planned review date<input type="date" data-${prefix}-planned-review value="${escapeHtml(plannedValue)}" /></label>
      <label>Future reviews<select data-${prefix}-planned-cycle>${plannedCycleOptions(plannedValue, learner?.apprenticeshipEndDate || "", reviewIntervalWeeks(learner))}</select></label>
    </div>
  `);
  return fields.join("");
}

export function detailsEditor(item) {
  if (uiState.detailsEditorId !== item.id) return "";
  const collegeOptions = WEEKDAYS.map(
    (day) =>
      `<option value="${day}" ${day === item.collegeDay ? "selected" : ""}>${day}</option>`,
  ).join("");
  return `
    <form class="appointment-form details-form" data-details-form="${escapeHtml(item.id)}">
      <p class="meta">Change any of their details here. Save when you are done.</p>
      <p class="form-error" data-details-error hidden></p>
      <label>
        Name
        <input data-details-name value="${escapeHtml(item.name || "")}" required />
      </label>
      <label>
        Employer / workplace
        <input data-details-company value="${escapeHtml(item.company || "")}" />
      </label>
      <label>
        Workplace postcode
        <input data-details-postcode value="${escapeHtml(item.postcode || "")}" required />
      </label>
      <label>
        Release day
        <select data-details-college required>
          ${collegeOptions}
        </select>
      </label>
      ${learnerInfoFieldsHtml(item, missingLearnerFields(item), "details")}
      <div class="appointment-form-actions">
        ${concernButton(item)}
        ${safeguardingPill(item)}
        <button type="submit" class="btn pill primary">Save details</button>
      </div>
    </form>
  `;
}

export function saveLearnerDetails(learnerId, { closeEditor = true } = {}) {
  const learner = findEditableLearner(learnerId);
  const formEl = detailsFormEl(learnerId);
  if (!learner || !formEl) return false;
  const details = readFormDetails(formEl, "details");
  const errorEl = formEl.querySelector("[data-details-error]");
  const error = validateLearner({
    name: details.name,
    postcode: details.postcode,
    collegeDay: details.collegeDay,
  });
  if (errorEl) {
    errorEl.hidden = !error;
    errorEl.textContent = error;
  }
  if (error) {
    setStatus(error);
    highlightDirtySave();
    return false;
  }

  const { collegeChanged, clearedAppointment, previousName, wasAwaitingCheck, queuedForBooking } =
    commitLearnerDetails(learner, details, { closeEditor });
  const who = previousName === details.name ? details.name : `${previousName} to ${details.name}`;
  setStatus(
    `Updated ${who}.${collegeChanged ? ` College day is now ${details.collegeDay}, so they will not get a site visit that day.` : ""}${clearedAppointment ? " A booked time on that college day was cleared." : ""}${toBookStatusNote(learner, { wasAwaitingCheck, queued: queuedForBooking })}`,
  );
  return true;
}

export function touchLearner(learner) {
  if (!learner) return learner;
  learner.updatedAt = new Date().toISOString();
  return learner;
}

function applyLearnerIdentity(learner, details) {
  const { name, company, postcode, collegeDay } = details;
  const collegeChanged = learner.collegeDay !== collegeDay;
  learner.name = name;
  learner.company = company;
  learner.postcode = postcode;
  learner.collegeDay = collegeDay;
  applyLearnerProfile(learner, details);
  if (collegeChanged && normaliseEmployer(learner.employer)) {
    learner.employer = normaliseEmployer({
      ...learner.employer,
      blockedDays: (learner.employer.blockedDays || []).filter((day) => day !== collegeDay),
    });
  }
  return { collegeChanged, clearedAppointment: false };
}
