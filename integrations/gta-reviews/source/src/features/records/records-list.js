import {
  LEARNER_INFO_FIELDS,
  commitLearnerDetails,
  findEditableLearner,
  flushDirtyDetails,
  highlightDirtySave,
  learnerInfoFieldsHtml,
  placeLearnerOnToBook,
  plannedReviewInputValue,
  readFormDetails,
  toBookStatusNote,
} from "./details-editor.js";
import {
  CONCERN_INTERVAL_WEEKS,
  WEEKDAYS,
  applyConcernSchedule,
  companyLookupKey,
  compareReviewUrgency,
  lastReviewDateKey,
  learnerProfileFrom,
  nextScheduledReviewDateKey,
  normaliseCompany,
  postcodeLookupKey,
  REVIEW_INTERVAL_WEEKS,
  reviewIntervalWeeks,
  workplaceCounts,
} from "../../planner.js";
import {
  cycleTimingLabel,
} from "../tutor-review/form-html.js";
import {
  escapeHtml,
} from "../../lib/html.js";
import {
  formatDateKeyLabel,
} from "../../lib/format.js";
import {
  isTestLearner,
} from "../../lib/learners.js";
import {
  recordsCount,
  recordsList,
  recordsSearch,
  recordsTitle,
} from "../../app/dom.js";
import {
  reviewFlowState,
} from "../../reviews.js";
import {
  scheduleStateSave,
} from "../../app/persist.js";
import { cssEscape } from "../../lib/html.js";
import {
  state,
} from "../planner/status.js";
import { archiveReasonLabel, syncLearnerArchiveCount } from "./archive.js";
import { learnerSearchText } from "../../lib/search.js";
import {
  uiState,
} from "../../app/ui-state.js";
import {
  validateLearner,
} from "./validate-learner.js";

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

export function concernButton(...args) {
  return callHook("concernButton", args, "");
}

export function learnerPlaceMeta(...args) {
  return callHook("learnerPlaceMeta", args, "");
}

export function logAction(...args) {
  return callHook("logAction", args, undefined);
}

export function refreshLearnerCatalogues(...args) {
  return callHook("refreshLearnerCatalogues", args, undefined);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}

export function renderReviews(...args) {
  return callHook("renderReviews", args, undefined);
}

export function safeguardingPill(...args) {
  return callHook("safeguardingPill", args, "");
}

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function bindRecordsList(next) {
  hooks = next || null;
}

export function managedLearnerRows() {
  const seen = new Set();
  const rows = [];
  const push = (item, list) => {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    rows.push({ item, list });
  };
  for (const item of state.learners) push(item, "roster");
  for (const item of state.followUps || []) push(item, "booking");
  for (const item of state.archive || []) push(item, "archive");
  return rows.sort(
    (a, b) =>
      compareReviewUrgency(a.item, b.item) ||
      String(a.item.name || "").localeCompare(String(b.item.name || "")),
  );
}

function recordsSearchQuery() {
  return (recordsSearch?.value || "").trim().toLowerCase();
}

export function missingLearnerFields(learner) {
  const missing = [];
  if (!String(learner?.name || "").trim()) missing.push("name");
  if (!normaliseCompany(learner?.company)) missing.push("company");
  if (!String(learner?.postcode || "").trim()) missing.push("postcode");
  if (!WEEKDAYS.includes(learner?.collegeDay)) missing.push("college day");
  const profile = learnerProfileFrom(learner);
  for (const field of LEARNER_INFO_FIELDS) {
    if (!profile[field.key]) missing.push(field.missing);
  }
  if (!plannedReviewInputValue(learner)) missing.push("planned review date");
  return missing;
}

function hasMissingLearnerDetails(learner) {
  return Boolean(learner?.needsRecordCheck) || missingLearnerFields(learner).length > 0;
}

function activeWorkplaceLearners() {
  return managedLearnerRows()
    .filter(({ list }) => list !== "archive")
    .map(({ item }) => item);
}

function workplaceChips(learner, counts) {
  const chips = [];
  const company = counts.company.get(companyLookupKey(learner.company));
  if (company?.count > 1) {
    chips.push(
      `<button type="button" class="pill status-chip round" data-records-workplace="${escapeHtml(company.label)}">${company.count} at ${escapeHtml(company.label)}</button>`,
    );
  }
  const postcode = counts.postcode.get(postcodeLookupKey(learner.postcode));
  if (postcode?.count > 1) {
    chips.push(
      `<button type="button" class="pill status-chip round" data-records-workplace="${escapeHtml(postcode.label)}">${postcode.count} at ${escapeHtml(postcode.label)}</button>`,
    );
  }
  return chips.join("");
}

export function renderRecords() {
  if (uiState.dirtyDetails?.source === "records" && !uiState.flushingDetails) {
    flushDirtyDetails();
    return;
  }
  refreshLearnerCatalogues();
  if (!recordsList || !recordsCount) return;
  const all = managedLearnerRows().filter(({ list }) => list !== "archive");
  syncLearnerArchiveCount();
  const missingCount = all.filter(
    ({ item }) => hasMissingLearnerDetails(item) && !isTestLearner(item),
  ).length;
  document.querySelectorAll("[data-records-filter]").forEach((item) => {
    if (item.dataset.recordsFilter !== "missing") return;
    const badge = item.querySelector("[data-missing-count]");
    item.classList.toggle("has-missing", missingCount > 0);
    if (badge) {
      badge.textContent = String(missingCount);
      badge.hidden = missingCount === 0;
    }
  });
  if (!all.length) {
    recordsList.innerHTML =
      '<p class="empty" data-records-empty>No learners yet. Use Add learners to add someone, then put in their details and previous reviews.</p>';
    if (recordsCount) recordsCount.textContent = "0";
    applyRecordsViewFilter();
    return;
  }
  const counts = workplaceCounts(activeWorkplaceLearners());
  recordsList.innerHTML =
    `<p class="empty" data-records-empty hidden></p>` +
    all.map(({ item, list }) => recordsCard(item, list, counts)).join("");
  applyRecordsViewFilter();
}

function recordsCard(learner, list, counts = workplaceCounts(activeWorkplaceLearners())) {
  const last = lastReviewDateKey(learner);
  const missing = missingLearnerFields(learner);
  const open = uiState.openRecordsLearnerIds.has(learner.id);
  const timing = cycleTimingLabel(learner);
  const flow = reviewFlowState(state, learner);
  const current = flow.current;
  const pillKind =
    current?.tone === "late" ? "late" : current?.tone === "current" ? "overdue" : "next";
  const collegeOptions = WEEKDAYS.map(
    (day) =>
      `<option value="${day}" ${day === learner.collegeDay ? "selected" : ""}>${day}</option>`,
  ).join("");
  const pills = [
    list === "archive"
      ? `<span class="archive-history-meta">${escapeHtml(archiveReasonLabel(learner.archiveReason))}</span>`
      : "",
    timing
      ? `<span class="archive-timing is-${escapeHtml(timing.kind)}">${escapeHtml(timing.label)}</span>`
      : "",
    list === "archive" || !current
      ? ""
      : `<span class="archive-timing is-${escapeHtml(pillKind)}">${escapeHtml(current.currentLabel || current.label)}</span>`,
    missing.length
      ? `<span class="archive-timing is-overdue">Missing ${missing.length}</span>`
      : "",
    learner.needsRecordCheck
      ? `<span class="archive-timing is-overdue">Needs verifying</span>`
      : "",
    learner.concern
      ? `<span class="archive-timing is-late">Concern · ${CONCERN_INTERVAL_WEEKS} weeks</span>`
      : "",
    safeguardingPill(learner),
  ]
    .filter(Boolean)
    .join("");
  const missingNote = missing.length
    ? `<p class="meta records-missing">Missing ${escapeHtml(missing.join(" · "))}</p>`
    : "";
  const work = workplaceChips(learner, counts);
  return `
    <article class="tutor-learner${open ? " is-open" : " is-min"}${missing.length || learner.needsRecordCheck ? " is-missing" : ""}${learner.needsRecordCheck ? " is-check" : ""}" data-records-row="${learner.id}" data-search-text="${escapeHtml(learnerSearchText(learner))}" data-missing="${missing.length || learner.needsRecordCheck ? "1" : "0"}">
      <div class="tutor-learner-row">
        <button type="button" class="tutor-learner-toggle" data-toggle-records-learner aria-expanded="${open ? "true" : "false"}" aria-label="${open ? "Hide learner details" : "Show learner details"}">
          <span aria-hidden="true"></span>
        </button>
        <strong>${escapeHtml(learner.name || "Unnamed learner")}</strong>
        <div class="tutor-learner-pills">${pills}</div>
      </div>
      <div class="tutor-learner-details"${open ? "" : " inert"}>
        <div>
          <form class="records-details" data-records-details="${learner.id}">
            ${missingNote}
            <p class="meta">${escapeHtml(learnerPlaceMeta(learner))}${last ? ` · last actual ${escapeHtml(formatDateKeyLabel(last))}` : ""}</p>
            ${work ? `<div class="learner-chips">${work}</div>` : ""}
            <div class="records-fields">
              <label class="${missing.includes("name") ? "is-missing" : ""}">Apprentice name<input data-records-name value="${escapeHtml(learner.name || "")}" required /></label>
              <label class="${missing.includes("company") ? "is-missing" : ""}">Employer / workplace<input data-records-company value="${escapeHtml(learner.company || "")}" /></label>
              <label class="${missing.includes("postcode") ? "is-missing" : ""}">Postcode<input data-records-postcode value="${escapeHtml(learner.postcode || "")}" required /></label>
              <label class="${missing.includes("college day") ? "is-missing" : ""}">Release day<select data-records-college required>${collegeOptions}</select></label>
              ${learnerInfoFieldsHtml(learner, missing, "records")}
            </div>
            <div class="appointment-form-actions">
              <button type="button" class="btn pill ghost" data-preview-review-form="${learner.id}">Preview</button>
              ${concernButton(learner)}
              ${safeguardingPill(learner)}
              <button type="button" class="btn pill ${learner.needsRecordCheck ? "primary" : "ghost"}" data-records-check="${learner.id}" aria-pressed="${learner.needsRecordCheck ? "true" : "false"}">${learner.needsRecordCheck ? "Verified" : "Needs verifying"}</button>
              <button type="submit" class="btn pill primary">Save details</button>
              <button type="button" class="btn pill ghost" data-records-archive="${escapeHtml(learner.id)}">Archive learner</button>
            </div>
          </form>
        </div>
      </div>
    </article>
  `;
}

export function toggleLearnerConcern(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  if (uiState.dirtyDetails && uiState.dirtyDetails.learnerId === learnerId && !flushDirtyDetails()) return;
  const next = !learner.concern;
  const { plannedChanged, bookedKept } = applyConcernSchedule(learner, next);
  const weeks = reviewIntervalWeeks(learner);
  logAction({
    type: "edited",
    learner,
    label: next
      ? `Concern on · reviews every ${weeks} weeks`
      : "Concern off · reviews every 10 weeks",
  });
  scheduleStateSave();
  renderLearners();
  if (state.learners.some((item) => item.id === learner.id)) {
    refreshPlannedWeek({ rebuild: true, fillGaps: true });
  }
  if (uiState.currentPage === "reviews") renderReviews();
  const nextDate = nextScheduledReviewDateKey(learner);
  let extra = "";
  if (bookedKept) extra = " Booked visit left as it is.";
  else if (plannedChanged && nextDate) extra = ` Next review ${formatDateKeyLabel(nextDate)}.`;
  setStatus(
    next
      ? `${learner.name} is on a ${CONCERN_INTERVAL_WEEKS}-week concern schedule.${extra}`
      : `${learner.name} is back on the ${REVIEW_INTERVAL_WEEKS}-week schedule.${extra}`,
  );
}

export function toggleRecordsCheck(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  if (uiState.dirtyDetails && uiState.dirtyDetails.learnerId === learnerId && !flushDirtyDetails()) return;
  const verifying = Boolean(learner.needsRecordCheck);
  learner.needsRecordCheck = !learner.needsRecordCheck;
  const queued = verifying ? placeLearnerOnToBook(learner) : false;
  logAction({
    type: "edited",
    learner,
    label: learner.needsRecordCheck ? "Needs verifying" : "Verified",
  });
  scheduleStateSave();
  renderLearners();
  const onRoster = state.learners.some((item) => item.id === learner.id);
  if (queued && onRoster) refreshPlannedWeek({ rebuild: true, fillGaps: true });
  if (learner.needsRecordCheck) {
    setStatus(`${learner.name} marked as needs verifying.`);
    return;
  }
  setStatus(
    `${learner.name} details marked as verified.${toBookStatusNote(learner, { wasAwaitingCheck: true, queued })}`,
  );
}

export function saveManagedDetails(learnerId, { keepCheck = false } = {}) {
  const learner = findEditableLearner(learnerId);
  const formEl = recordsList?.querySelector(`[data-records-details="${cssEscape(learnerId)}"]`);
  if (!learner || !formEl) return false;
  const details = readFormDetails(formEl, "records");
  const error = validateLearner({
    name: details.name,
    postcode: details.postcode,
    collegeDay: details.collegeDay,
  });
  if (error) {
    setStatus(error);
    highlightDirtySave();
    return false;
  }
  const { collegeChanged, clearedAppointment, previousName, wasAwaitingCheck, queuedForBooking } =
    commitLearnerDetails(learner, details, { keepCheck });
  const who = previousName === details.name ? details.name : `${previousName} to ${details.name}`;
  const pastEnd =
    details.plannedReviewDate &&
    details.apprenticeshipEndDate &&
    details.plannedReviewDate > details.apprenticeshipEndDate;
  setStatus(
    `Updated ${who}.${collegeChanged ? ` College day is now ${details.collegeDay}.` : ""}${clearedAppointment ? " A booked time on that college day was cleared." : ""}${pastEnd ? " That planned review is after the official end date, but it is still open because learners often stay on programme." : ""}${toBookStatusNote(learner, { wasAwaitingCheck, queued: queuedForBooking })}`,
  );
  return true;
}

export function applyRecordsViewFilter() {
  if (!recordsList) return false;
  const cards = recordsList.querySelectorAll("[data-records-row]");
  if (!cards.length) return false;
  const query = recordsSearchQuery();
  const missingOnly = !query && uiState.recordsFilter === "missing";
  let visible = 0;
  cards.forEach((card) => {
    const matchSearch = !query || (card.dataset.searchText || "").includes(query);
    const matchMissing = !missingOnly || card.dataset.missing === "1";
    const show = matchSearch && matchMissing;
    card.hidden = !show;
    card.classList.toggle("is-search-hidden", !show);
    if (show) visible += 1;
  });
  const empty = recordsList.querySelector("[data-records-empty]");
  if (empty) {
    empty.hidden = visible > 0;
    empty.textContent = query
      ? `No learners match “${query}”.`
      : missingOnly
        ? "Missing information is empty. Open All learners if you need to look someone up."
        : "No learners yet. Use Add learners to add someone, then put in their details and previous reviews.";
  }
  const lookup = recordsList.querySelector("[data-records-lookup]");
  if (lookup) lookup.hidden = !query || !visible;
  if (recordsCount) recordsCount.textContent = String(visible);
  if (recordsTitle) {
    recordsTitle.textContent = query
      ? "Search results"
      : missingOnly
        ? "Missing information"
        : "All learners";
  }
  document.querySelectorAll("[data-records-filter]").forEach((item) => {
    const selected =
      !query && item.dataset.recordsFilter === (uiState.recordsFilter === "missing" ? "missing" : "all");
    if (item.dataset.recordsFilter === "missing") {
      item.classList.toggle("is-active", selected);
      item.classList.toggle("ghost", !selected);
      item.classList.remove("on");
      return;
    }
    item.classList.toggle("on", selected);
    item.classList.toggle("ghost", !selected);
  });
  return true;
}
