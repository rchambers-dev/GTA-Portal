import { form, formError, recordsAdd, recordsAddToggle } from "../../app/dom.js";
import { scheduleStateSave } from "../../app/persist.js";
import { formatPostcode } from "../../geo.js";
import { isTestLearner } from "../../lib/learners.js";
import {
  DEFAULT_GTA_REVIEWER,
  REVIEW_INTERVAL_WEEKS,
  WEEKDAYS,
  addDays,
  applyLearnerProfile,
  dateFromKey,
  normaliseCompany,
  postcodeLookupKey,
  recordReview,
  reviewCycleDateKeys,
  startOfLocalDay,
  toDateKey,
} from "../../planner.js";
import { state } from "../planner/status.js";
import {
  currentComboValue,
  fillComboSelect,
  refreshPlannedCycleSelect,
  rememberTutorName,
} from "./details-editor.js";
import { validateLearner } from "./validate-learner.js";
export { validateLearner };

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

export function managedLearnerRows(...args) {
  return callHook("managedLearnerRows", args, []);
}

export function setPage(...args) {
  return callHook("setPage", args, undefined);
}

export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}

export function renderRecords(...args) {
  return callHook("renderRecords", args, undefined);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function logAction(...args) {
  return callHook("logAction", args, undefined);
}

export function bindAddLearner(next) {
  hooks = next || null;
}

export function setRecordsAddMinimised(minimised) {
  recordsAdd?.classList.toggle("is-minimised", minimised);
  const button = document.querySelector("#records-add-minimise");
  if (button) button.textContent = minimised ? "Expand" : "Minimise";
}

export function setRecordsAddOpen(open) {
  if (!recordsAdd) return;
  recordsAdd.hidden = !open;
  if (open) setRecordsAddMinimised(false);
  recordsAddToggle?.classList.toggle("on", open);
  recordsAddToggle?.setAttribute("aria-expanded", open ? "true" : "false");
}

export function showFormError(message) {
  formError.hidden = !message;
  formError.textContent = message;
}

function matchWeekday(value) {
  const compact = String(value || "").trim().toLowerCase();
  if (compact.length < 3) return "";
  return WEEKDAYS.find((day) => day.toLowerCase().startsWith(compact)) || "";
}

function releaseDayFromText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return WEEKDAYS.find((day) => new RegExp(`\\b${day}\\b`, "i").test(text)) || matchWeekday(text);
}

function existingLearnerForAdd(name, postcode) {
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return null;
  const post = postcodeLookupKey(postcode);
  return (
    managedLearnerRows().find(({ item }) => {
      if (String(item?.name || "").trim().toLowerCase() !== needle) return false;
      return !post || postcodeLookupKey(item.postcode) === post;
    })?.item || null
  );
}

export function resetAddLearnerForm() {
  form.reset();
  const reviewer = form.querySelector("[data-add-gta-reviewer]");
  if (reviewer) reviewer.value = DEFAULT_GTA_REVIEWER;
  refreshPlannedCycleSelect(form, "add");
  refreshAddLearnerCombos({ tutor: "", apprenticeship: "" }, { force: true });
}

export function addNewLearner(draft) {
  if (!hooks) {
    reportUnbound();
    return { error: "Records are not ready." };
  }
  const name = String(draft?.name || "").trim();
  const company = normaliseCompany(draft?.company);
  const postcode = formatPostcode(draft?.postcode);
  const collegeDay = WEEKDAYS.includes(draft?.collegeDay)
    ? draft.collegeDay
    : releaseDayFromText(draft?.collegeDay);
  const error = validateLearner({ name, postcode, collegeDay });
  if (error) return { error };

  if (existingLearnerForAdd(name, postcode)) {
    return { error: `${name} is already added.` };
  }

  const learner = {
    id: crypto.randomUUID(),
    name,
    company,
    postcode,
    collegeDay,
    safeguardingSigned: false,
  };
  applyLearnerProfile(learner, {
    tutor: draft.tutor || "",
    apprenticeship: draft.apprenticeship || "",
    apprenticeshipStartDate: draft.apprenticeshipStartDate || "",
    apprenticeshipEndDate: draft.apprenticeshipEndDate || "",
    gtaReviewer: draft.gtaReviewer || DEFAULT_GTA_REVIEWER,
    employerContact: draft.employerContact || "",
    employerEmail: draft.employerEmail || "",
    contactNumber: draft.contactNumber || "",
    plannedReviewDate: draft.plannedReviewDate || "",
  });
  rememberTutorName(learner.tutor);
  if (draft.lastReviewDate) {
    recordReview(
      learner,
      {
        plannedDateKey: draft.plannedReviewDate || "",
        actualDateKey: draft.lastReviewDate,
      },
      "entered",
    );
  }
  state.learners.push(learner);
  if (!isTestLearner(learner)) logAction({ type: "added", learner });
  scheduleStateSave();
  renderLearners();
  renderRecords();
  refreshPlannedWeek({ rebuild: true, fillGaps: true });
  return { learner };
}

export function calculatedAddLearnerDates(profile) {
  const start = profile.apprenticeshipStartDate || "";
  const end = profile.apprenticeshipEndDate || "";
  const planned = profile.plannedReviewDate || start;
  let last = profile.lastReviewDate || "";
  if (!last && planned) {
    const horizon =
      end ||
      (dateFromKey(planned)
        ? toDateKey(addDays(dateFromKey(planned), REVIEW_INTERVAL_WEEKS * 7 * 16))
        : "");
    const today = toDateKey(startOfLocalDay(new Date()));
    const past = reviewCycleDateKeys(planned, horizon, { includeStart: true }).filter(
      (key) => key <= today && (!end || key <= end),
    );
    last = past.at(-1) || "";
  }
  return {
    ...profile,
    plannedReviewDate: planned,
    lastReviewDate: last,
  };
}

export function refreshAddLearnerCombos(profile = {}, { force = false } = {}) {
  const tutorSelect = form?.querySelector("[data-add-tutor]");
  const apprenticeshipSelect = form?.querySelector("[data-add-apprenticeship]");
  if (
    !force &&
    (tutorSelect?.value === "__new__" || apprenticeshipSelect?.value === "__new__")
  ) {
    return;
  }
  fillComboSelect(
    tutorSelect,
    "tutor",
    profile.tutor !== undefined ? profile.tutor : currentComboValue(tutorSelect, "tutor"),
  );
  fillComboSelect(
    apprenticeshipSelect,
    "apprenticeship",
    profile.apprenticeship !== undefined
      ? profile.apprenticeship
      : currentComboValue(apprenticeshipSelect, "apprenticeship"),
  );
}
