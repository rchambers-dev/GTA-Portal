import {
  archiveHistoryCount,
  archiveHistoryList,
  archiveHistorySearch,
  archiveReasonCopy,
  archiveReasonModal,
  learnerArchiveCount,
  learnerArchiveList,
  learnerArchiveModal,
  learnerArchiveSearch,
  recordsArchiveOpen,
} from "../../app/dom.js";
import {
  archiveReviewRows,
  formatShortDate,
  formatUkDateKey,
  learnerProfileFrom,
  normaliseAttended,
  normaliseDateKey,
  formatWeeksAndDays,
  lastReviewDateKey,
  nextReviewDateKey,
  recordReview,
  removeReview,
  reviewDueStatus,
  reviewPriorityLabel,
  startOfLocalDay,
  toDateKey,
} from "../../planner.js";
import {
  daysBetweenDateKeys,
} from "../../lib/dates.js";
import {
  escapeHtml,
} from "../../lib/html.js";
import {
  filterSearchRows,
  learnerSearchText,
} from "../../lib/search.js";
import {
  findEditableLearner,
  flushDirtyDetails,
} from "./details-editor.js";
import {
  formatDateKeyLabel,
  routeEmailStatus,
  routeMailtoHref,
} from "../../lib/format.js";
import {
  readOpenNote,
} from "../planner/notes.js";
import {
  scheduleStateSave,
} from "../../app/persist.js";
import {
  state,
} from "../planner/status.js";
import {
  uiState,
} from "../../app/ui-state.js";

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

export function dropLearnerFromRoster(...args) {
  return callHook("dropLearnerFromRoster", args, undefined);
}

export function logAction(...args) {
  return callHook("logAction", args, undefined);
}

export function managedLearnerRows(...args) {
  return callHook("managedLearnerRows", args, []);
}

export function previewReviewForm(...args) {
  return callHook("previewReviewForm", args, undefined);
}

export function readSettingsIntoState(...args) {
  return callHook("readSettingsIntoState", args, undefined);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function refreshRosterAfterDrop(...args) {
  return callHook("refreshRosterAfterDrop", args, undefined);
}

export function renderLearners(...args) {
  return callHook("renderLearners", args, undefined);
}

export function rosterLearnerFromRecord(...args) {
  return callHook("rosterLearnerFromRecord", args, null);
}

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function snapshotLearner(...args) {
  return callHook("snapshotLearner", args, null);
}

export function learnerPlaceMeta(...args) {
  return callHook("learnerPlaceMeta", args, "");
}

export function bindArchive(next) {
  hooks = next || null;
}

function archiveAttendedDisplay(value) {
  if (value === "upcoming") return "Upcoming";
  if (value === "not-ready") return "Not ready yet";
  if (value === "overdue") return "Overdue";
  const id = normaliseAttended(value);
  if (id === "in-person") return "In person";
  if (id === "phone") return "By phone";
  if (id === "teams") return "Teams";
  return "Not ready yet";
}

function archiveAttendedOptions(selected) {
  const current = selected === "upcoming" || selected === "not-ready" || selected === "overdue"
    ? ""
    : normaliseAttended(selected);
  return [
    `<option value="in-person" ${current === "in-person" ? "selected" : ""}>In person</option>`,
    `<option value="phone" ${current === "phone" ? "selected" : ""}>By phone</option>`,
    `<option value="teams" ${current === "teams" ? "selected" : ""}>Teams</option>`,
  ].join("");
}

function archiveAttendedClass(value) {
  if (value === "in-person" || value === "phone" || value === "teams") return "";
  if (value === "overdue") return " is-overdue";
  if (value === "upcoming") return " is-upcoming";
  return " is-empty";
}

function archiveLearnerTiming(learner, now = new Date()) {
  const rows = archiveReviewRows(learner, now);
  const today = toDateKey(startOfLocalDay(now));
  const open = rows.find((row) => !row.actualKey);
  if (!open) return null;
  const booked = Boolean(open.bookedDateKey);
  const booking = booked ? "Booked" : "Not booked";
  const targetKey = open.bookedDateKey || open.proposedKey;
  const days = daysBetweenDateKeys(today, targetKey);
  if (days == null) return null;
  const withBooking = (label) => `${label} · ${booking}`;
  if (days < 0) {
    return { kind: "overdue", booked, label: withBooking(`Overdue · ${formatWeeksAndDays(-days)}`) };
  }
  if (days === 0) return { kind: "soon", booked, label: withBooking("Today") };
  return {
    kind: days < 7 ? "soon" : "next",
    booked,
    label: withBooking(`in ${formatWeeksAndDays(days)}`),
  };
}

function archiveLearnerCardHtml(learner, list) {
  const rows = archiveReviewRows(learner);
  const open = uiState.expandedArchiveLearnerIds.has(learner.id);
  const timing = list === "archive" ? null : archiveLearnerTiming(learner);
  const table = rows.length
    ? `
        <table class="archive-review-table">
          <thead>
            <tr>
              <th>Proposed</th>
              <th>Attended</th>
              <th>Actual</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const shownActual =
                  row.actualKey ||
                  (row.attended === "in-person" ? row.bookedDateKey : "");
                const actualLabel = shownActual ? formatUkDateKey(shownActual) : "";
                return `
              <tr data-archive-row="${escapeHtml(row.proposedKey)}">
                <td>${escapeHtml(formatUkDateKey(row.proposedKey))}</td>
                <td>
                  <label class="archive-attended-wrap">
                    <span class="archive-attended${archiveAttendedClass(row.attended)}">${escapeHtml(archiveAttendedDisplay(row.attended))}</span>
                    <select data-archive-attended="${escapeHtml(learner.id)}" data-proposed="${escapeHtml(row.proposedKey)}" aria-label="How this review was done">
                      ${archiveAttendedOptions(row.attended)}
                    </select>
                  </label>
                </td>
                <td>
                  ${
                    actualLabel
                      ? `<span class="archive-actual-date">${escapeHtml(actualLabel)}</span>`
                      : `<span class="archive-actual-date is-empty"></span>`
                  }
                </td>
                <td>
                  <button type="button" class="archive-person" data-archive-preview="${escapeHtml(learner.id)}" data-proposed="${escapeHtml(row.proposedKey)}" data-actual="${escapeHtml(row.actualKey)}">
                    Preview PDF
                  </button>
                </td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `
    : `<p class="meta">Add a planned or last actual review date on Learners to start this list.</p>`;
  return `
    <article class="tutor-learner${open ? " is-open" : " is-min"}" data-archive-learner="${escapeHtml(learner.id)}" data-search-text="${escapeHtml(learnerSearchText(learner))}">
      <div class="tutor-learner-row">
        <button type="button" class="tutor-learner-toggle" data-toggle-archive-learner aria-expanded="${open ? "true" : "false"}" aria-label="${open ? "Hide reviews" : "Show reviews"}">
          <span aria-hidden="true"></span>
        </button>
        <strong>${escapeHtml(learner.name || "Unnamed learner")}</strong>
        ${
          list === "archive"
            ? `<span class="archive-history-meta">${escapeHtml(archiveReasonLabel(learner.archiveReason))}</span>`
            : timing
              ? `<span class="archive-timing is-${escapeHtml(timing.kind)}${timing.booked ? " is-booked" : " is-unbooked"}">${escapeHtml(timing.label)}</span>`
              : ""
        }
      </div>
      <div class="tutor-learner-details"${open ? "" : " inert"}>
        <div>${table}</div>
      </div>
    </article>
  `;
}

export function renderArchiveHistory() {
  if (!archiveHistoryList || !archiveHistoryCount) return;
  const rows = managedLearnerRows();
  if (!rows.length) {
    archiveHistoryList.innerHTML =
      '<p class="empty" data-archive-empty>No learners yet. Add someone on Learners first.</p>';
    applyArchiveSearch();
    return;
  }
  archiveHistoryList.innerHTML =
    `<p class="empty" data-archive-empty hidden></p>` +
    rows.map(({ item, list }) => archiveLearnerCardHtml(item, list)).join("");
  applyArchiveSearch();
}

export async function previewArchiveReview(learnerId, proposedKey, actualKey) {
  const dateKey = normaliseDateKey(actualKey) || normaliseDateKey(proposedKey);
  await previewReviewForm(learnerId, { dateKey });
}

export function saveArchiveAttended(learnerId, proposedKey, attended) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  const method = normaliseAttended(attended);
  const rows = archiveReviewRows(learner);
  const row = rows.find((item) => item.proposedKey === proposedKey);
  const entry = (learner.reviewHistory || []).find(
    (item) => item.actualDateKey && item.actualDateKey === row?.actualKey,
  );
  if (entry) {
    entry.attended = method;
  } else {
    if (!learner.reviewAttendance || typeof learner.reviewAttendance !== "object") {
      learner.reviewAttendance = {};
    }
    if (method) learner.reviewAttendance[proposedKey] = method;
    else delete learner.reviewAttendance[proposedKey];
  }
  scheduleStateSave();
  renderArchiveHistory();
}

export function saveArchiveActual(learnerId, proposedKey, actualKey) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  const next = normaliseDateKey(actualKey);
  const rows = archiveReviewRows(learner);
  const row = rows.find((item) => item.proposedKey === proposedKey);
  if (row?.actualKey && row.actualKey !== next) {
    removeReview(learner, row.actualKey);
  }
  if (next) {
    recordReview(
      learner,
      {
        plannedDateKey: proposedKey,
        actualDateKey: next,
        attended: row?.attended || learner.reviewAttendance?.[proposedKey],
      },
      "entered",
    );
    if (learner.reviewAttendance) delete learner.reviewAttendance[proposedKey];
  }
  scheduleStateSave();
  renderLearners();
  renderArchiveHistory();
}

export function applyArchiveSearch() {
  if (!archiveHistoryList) return false;
  const cards = archiveHistoryList.querySelectorAll("[data-archive-learner]");
  if (!cards.length) return false;
  const query = String(archiveHistorySearch?.value || "").trim().toLowerCase();
  const visible = filterSearchRows(archiveHistoryList, "[data-archive-learner]", query);
  if (visible == null) return false;
  const empty = archiveHistoryList.querySelector("[data-archive-empty]");
  if (empty) {
    empty.hidden = visible > 0;
    empty.textContent = query
      ? `No learners match “${query}”.`
      : "No learners yet. Add someone on Learners first.";
  }
  if (archiveHistoryCount) archiveHistoryCount.textContent = String(visible);
  return true;
}

export function archiveLearner(learnerId) {
  const learner = state.learners.find((item) => item.id === learnerId);
  if (!learner) return;
  const typed = readOpenNote(learnerId);
  if (typed != null) learner.note = typed;
  addLearnerToArchive(learner);
  logAction({ type: "archived-off", learner });
  dropLearnerFromRoster(learnerId);
  uiState.noteEditorId = "";
  uiState.appointmentEditorId = "";
  uiState.phoneEditorId = "";
  uiState.reviewEditorId = "";
  uiState.detailsEditorId = "";
  refreshRosterAfterDrop();
  syncLearnerArchiveCount();
  setStatus(`${learner.name} was archived and can be brought back later.`);
}

const ARCHIVE_REASONS = {
  completed: "Completed their course",
  left: "Left and quit their apprenticeship",
};

export function archiveReasonLabel(reason) {
  return ARCHIVE_REASONS[reason] || "Archived";
}

export function addLearnerToArchive(learner, extras = {}) {
  const record = {
    ...learner,
    ...snapshotLearner(learner, {
      archivedOn: toDateKey(new Date()),
      archivedLabel: formatShortDate(new Date()),
      archiveReason: extras.archiveReason || learner.archiveReason || "",
      ...extras,
    }),
  };
  if (!record?.id) return;
  if (!state.archive) state.archive = [];
  state.followUps = (state.followUps || []).filter((item) => item.id !== record.id);
  if (state.archive.some((item) => item.id === record.id)) return;
  state.archive.unshift(record);
}

export function syncLearnerArchiveCount() {
  const count = (state.archive || []).length;
  const badge = document.querySelector("[data-learner-archive-count]");
  if (!badge) return;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

function openModal(modal, { bodyClass = "" } = {}) {
  if (!modal) return;
  modal.hidden = false;
  if (bodyClass) document.body.classList.add(bodyClass);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("open"));
  });
}

function closeModal(modal, { bodyClass = "" } = {}) {
  if (!modal?.classList.contains("open")) return false;
  modal.classList.remove("open");
  if (bodyClass && !document.querySelector(".settings-modal.open")) {
    document.body.classList.remove(bodyClass);
  }
  setTimeout(() => {
    if (modal && !modal.classList.contains("open")) modal.hidden = true;
  }, 420);
  return true;
}

export function openArchiveReason(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner || (state.archive || []).some((item) => item.id === learner.id)) return;
  if (uiState.dirtyDetails && uiState.dirtyDetails.learnerId === learnerId && !flushDirtyDetails()) return;
  uiState.archiveReasonLearnerId = learner.id;
  if (archiveReasonCopy) {
    archiveReasonCopy.textContent = `Choose why ${learner.name} is leaving the active learner list.`;
  }
  openModal(archiveReasonModal, { bodyClass: "learner-archive-open" });
}

export function closeArchiveReason() {
  uiState.archiveReasonLearnerId = "";
  return closeModal(archiveReasonModal, { bodyClass: "learner-archive-open" });
}

export function openLearnerArchive() {
  if (learnerArchiveSearch) learnerArchiveSearch.value = "";
  uiState.learnerArchiveFilter = "all";
  renderLearnerArchive();
  recordsArchiveOpen?.setAttribute("aria-expanded", "true");
  openModal(learnerArchiveModal, { bodyClass: "learner-archive-open" });
}

export function closeLearnerArchive() {
  recordsArchiveOpen?.setAttribute("aria-expanded", "false");
  return closeModal(learnerArchiveModal, { bodyClass: "learner-archive-open" });
}

export function renderLearnerArchive() {
  if (!learnerArchiveList) return;
  const people = [...(state.archive || [])].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || "")),
  );
  if (learnerArchiveCount) learnerArchiveCount.textContent = String(people.length);
  syncLearnerArchiveCount();
  document.querySelectorAll("[data-learner-archive-filter]").forEach((button) => {
    const on = button.dataset.learnerArchiveFilter === uiState.learnerArchiveFilter;
    button.classList.toggle("on", on);
    button.classList.toggle("ghost", !on);
  });
  const query = String(learnerArchiveSearch?.value || "").trim().toLowerCase();
  const visible = people.filter((item) => {
    if (uiState.learnerArchiveFilter !== "all" && item.archiveReason !== uiState.learnerArchiveFilter) return false;
    if (!query) return true;
    return learnerSearchText(item).includes(query);
  });
  if (!people.length) {
    learnerArchiveList.innerHTML =
      '<p class="empty">No archived learners yet. Use Archive learner on someone’s details when they have completed their course or left their apprenticeship.</p>';
    return;
  }
  if (!visible.length) {
    learnerArchiveList.innerHTML = '<p class="empty">No archived learners match this search.</p>';
    return;
  }
  learnerArchiveList.innerHTML = visible
    .map((item) => {
      const profile = learnerProfileFrom(item);
      const when = item.archivedLabel || formatDateKeyLabel(item.archivedOn) || "";
      return `
        <article class="learner-archive-card-item" data-search-text="${escapeHtml(learnerSearchText(item))}">
          <div class="tutor-learner-row">
            <strong>${escapeHtml(item.name || "Unnamed learner")}</strong>
            <span class="archive-timing is-next">${escapeHtml(archiveReasonLabel(item.archiveReason))}</span>
          </div>
          <p class="meta">${escapeHtml(learnerPlaceMeta(item))}${profile.tutor ? ` · ${escapeHtml(profile.tutor)}` : ""}${when ? ` · archived ${escapeHtml(when)}` : ""}</p>
          <p class="meta">${escapeHtml(
            [
              profile.apprenticeship,
              item.collegeDay ? `Release day ${item.collegeDay}` : "",
              profile.apprenticeshipStartDate ? `Started ${formatUkDateKey(profile.apprenticeshipStartDate)}` : "",
              profile.apprenticeshipEndDate ? `Planned end ${formatUkDateKey(profile.apprenticeshipEndDate)}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          )}</p>
          <div class="appointment-form-actions">
            <button type="button" class="btn pill ghost" data-learner-archive-restore="${escapeHtml(item.id)}">Back on roster</button>
          </div>
        </article>
      `;
    })
    .join("");
}

export function archiveLearnerWithReason(learnerId, reason) {
  if (!ARCHIVE_REASONS[reason]) return;
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  if ((state.archive || []).some((item) => item.id === learnerId)) return;
  addLearnerToArchive(learner, { archiveReason: reason });
  logAction({
    type: "archived-off",
    learner,
    label: `${learner.name} · ${ARCHIVE_REASONS[reason]}`,
  });
  dropLearnerFromRoster(learnerId);
  state.followUps = (state.followUps || []).filter((item) => item.id !== learnerId);
  uiState.noteEditorId = "";
  uiState.appointmentEditorId = "";
  uiState.phoneEditorId = "";
  uiState.reviewEditorId = "";
  uiState.detailsEditorId = "";
  refreshRosterAfterDrop();
  setStatus(`${learner.name} was archived · ${ARCHIVE_REASONS[reason]}.`);
  openLearnerArchive();
}

export function archiveFollowUp(learnerId) {
  const item = (state.followUps || []).find((followUp) => followUp.id === learnerId);
  if (!item) return;
  uiState.detailsEditorId = "";
  addLearnerToArchive(item);
  logAction({ type: "archived-off", learner: item });
  scheduleStateSave(true);
  renderLearners();
  syncLearnerArchiveCount();
  setStatus(`${item.name} was archived and can be brought back later.`);
}

export function restoreArchive(learnerId) {
  const item = (state.archive || []).find((archived) => archived.id === learnerId);
  if (!item) return;
  uiState.detailsEditorId = "";
  state.archive = state.archive.filter((archived) => archived.id !== learnerId);
  if (!state.learners.some((learner) => learner.id === item.id)) {
    state.learners.push(rosterLearnerFromRecord(item));
  }
  logAction({ type: "restored", learner: item });
  scheduleStateSave(true);
  renderLearners();
  refreshPlannedWeek({ rebuild: true });
  syncLearnerArchiveCount();
  setStatus(`${item.name} is back on the roster to plan again.`);
}

export function restoreFollowUp(learnerId) {
  const item = (state.followUps || []).find((followUp) => followUp.id === learnerId);
  if (!item) return;
  uiState.detailsEditorId = "";
  state.followUps = state.followUps.filter((followUp) => followUp.id !== learnerId);
  if (!state.learners.some((learner) => learner.id === item.id)) {
    state.learners.push(rosterLearnerFromRecord(item));
  }
  logAction({ type: "restored", learner: item });
  scheduleStateSave(true);
  renderLearners();
  refreshPlannedWeek({ rebuild: true });
  syncLearnerArchiveCount();
  setStatus(`${item.name} is back on the roster to plan again.`);
}

export function emailFollowUpList() {
  const followUps = state.followUps || [];
  if (!followUps.length) {
    setStatus("Complete a route first so there is someone to book.");
    return;
  }
  readSettingsIntoState();
  logAction({ type: "emailed", label: "Book next review" });
  scheduleStateSave();
  const lines = [
    "Please book the next workplace review for:",
    "",
    ...followUps.map(
      (item, index) =>
        `${index + 1}. ${item.name}\r\n   ${learnerPlaceMeta(item)} · ${reviewPriorityLabel(item)}\r\n   Tutor: ${item.tutor || "not set"}\r\n   GTA reviewer: ${item.gtaReviewer || "not set"}\r\n   Apprenticeship: ${item.apprenticeship || "not set"}${item.apprenticeshipStartDate || item.apprenticeshipEndDate ? ` (${formatDateKeyLabel(item.apprenticeshipStartDate) || "start not set"} – ${formatDateKeyLabel(item.apprenticeshipEndDate) || "end not set"})` : ""}\r\n   Employer contact: ${item.employerContact || "not set"}\r\n   Employer email: ${item.employerEmail || "not set"}\r\n   Contact number: ${item.contactNumber || "not set"}\r\n   Actual date: ${formatDateKeyLabel(lastReviewDateKey(item)) || item.completedLabel || "not set"}\r\n   Planned review date: ${formatDateKeyLabel(nextReviewDateKey(item) || item.plannedReviewDate) || "set actual date first"}\r\n   Tell tutors by: ${formatDateKeyLabel(reviewDueStatus(item).notice) || "set actual date first"}${item.note ? `\r\n   Note: ${item.note}` : ""}`,
    ),
  ];
  const subject = `Book next review (${followUps.length} learner${followUps.length === 1 ? "" : "s"})`;
  window.location.href = routeMailtoHref(subject, lines.join("\r\n"), state.settings.email);
  setStatus(routeEmailStatus("booking", state.settings.email));
}
