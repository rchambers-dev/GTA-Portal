import {
  applyLearnerProfile,
  compareReviewUrgency,
  isPhoneReview,
  lastReviewDateKey,
  learnerProfileFrom,
  normaliseCompany,
  normalisePhone,
  normalisePriority,
  phoneReviewDay,
} from "../../planner.js";
import {
  applyNoteUntilPreset,
  clearLearnerNote,
  learnerNoteText,
  noteEditor,
  notePreview,
  noteUntilKey,
  renderPlanNotes,
  saveLearnerNote,
} from "../planner/notes.js";
import {
  archiveCount,
  archiveList,
  dayDetail,
  emailFollowUp,
  followUpCount,
  followUpList,
  learnerCount,
  learnerList,
  learnerSheet,
  learnerSheetBody,
  learnerSheetTitle,
  paperAwaitingCount,
  paperBookedCount,
  paperUnbookedCount,
  paperWaitingCount,
} from "../../app/dom.js";
import {
  detailsEditor,
  findEditableLearner,
  flushDirtyDetails,
  learnerFormEl,
  toggleDetailsEditor,
} from "./details-editor.js";
import {
  archiveLearner,
  archiveReasonLabel,
} from "./archive.js";
import {
  renderRecords,
  toggleLearnerConcern,
} from "./records-list.js";
import {
  escapeHtml,
} from "../../lib/html.js";
import {
  cssEscape,
} from "../../lib/html.js";
import {
  learnerSearchText,
} from "../../lib/search.js";
import {
  planPaperSplit,
} from "../planner/status.js";
import {
  pruneBookedAwaiting,
} from "../planner/routes.js";
import {
  renderPlan,
} from "../planner/day-view.js";
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

export function concernChip(...args) {
  return callHook("concernChip", args, "");
}

export function learnerPlaceMeta(...args) {
  return callHook("learnerPlaceMeta", args, "");
}

export function noticeChip(...args) {
  return callHook("noticeChip", args, "");
}

export function prioritySelect(...args) {
  return callHook("prioritySelect", args, "");
}

export function reviewMeta(...args) {
  return callHook("reviewMeta", args, "");
}

export function safeguardingPill(...args) {
  return callHook("safeguardingPill", args, "");
}

export function applyRosterSearch(...args) {
  return callHook("applyRosterSearch", args, undefined);
}

export function clearLastReview(...args) {
  return callHook("clearLastReview", args, undefined);
}

export function clearLearnerAppointment(...args) {
  return callHook("clearLearnerAppointment", args, undefined);
}

export function clearPhoneReview(...args) {
  return callHook("clearPhoneReview", args, undefined);
}

export function moveLearnerToFollowUp(...args) {
  return callHook("moveLearnerToFollowUp", args, undefined);
}

export function previewReviewForm(...args) {
  return callHook("previewReviewForm", args, undefined);
}

export function rollAppointmentToNextWeek(...args) {
  return callHook("rollAppointmentToNextWeek", args, undefined);
}

export function saveLastReview(...args) {
  return callHook("saveLastReview", args, undefined);
}

export function sendReviewForm(...args) {
  return callHook("sendReviewForm", args, undefined);
}

export function setPhoneReviewDay(...args) {
  return callHook("setPhoneReviewDay", args, undefined);
}

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function toggleSafeguarding(...args) {
  return callHook("toggleSafeguarding", args, undefined);
}

export function updateRequestedFit(...args) {
  return callHook("updateRequestedFit", args, undefined);
}

export function bindLearnerSheet(next) {
  hooks = next || null;
}

function learnerToolsMarkup(learnerId, bodyHtml) {
  const open = uiState.learnerToolsOpenIds.has(learnerId);
  return `
    <div class="learner-card-tools${open ? "" : " is-minimised"}">
      <button type="button" class="btn pill ghost learner-tools-toggle" data-toggle-tools="${learnerId}" aria-expanded="${open ? "true" : "false"}">
        ${open ? "Hide actions" : "Actions"}
      </button>
      <div class="learner-card-tools-body">
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function toggleLearnerToolsPanel(toggle) {
  const learnerId = toggle.dataset.toggleTools;
  const panel = toggle.closest(".learner-card-tools");
  if (!panel || !learnerId) return;
  const minimised = panel.classList.toggle("is-minimised");
  toggle.setAttribute("aria-expanded", String(!minimised));
  toggle.textContent = minimised ? "Actions" : "Hide actions";
  if (minimised) uiState.learnerToolsOpenIds.delete(learnerId);
  else uiState.learnerToolsOpenIds.add(learnerId);
}

function callCheckForm(learner) {
  const profile = learnerProfileFrom(learner);
  const phone = normalisePhone(profile.contactNumber);
  const digits = String(profile.contactNumber || "").replace(/\D/g, "");
  return `
    <form class="learner-call-check" data-call-check="${learner.id}">
      <p class="meta">Check these are right when you phone.</p>
      <label>
        Employer name
        <input data-call-employer-contact value="${escapeHtml(profile.employerContact || "")}" placeholder="e.g. Jo Smith" />
      </label>
      <label>
        Phone
        <input data-call-contact-number type="tel" value="${escapeHtml(phone)}" placeholder="e.g. 01302 123456" />
      </label>
      <div class="learner-call-check-actions">
        ${digits ? `<a class="btn pill ghost" href="tel:${digits}">Call</a>` : ""}
        <button type="submit" class="btn pill primary">Save contact</button>
      </div>
    </form>
  `;
}

export function saveCallCheck(learnerId) {
  const learner = findEditableLearner(learnerId);
  const formEl = learnerFormEl(`[data-call-check="${cssEscape(learnerId)}"]`);
  if (!learner || !formEl) return;
  applyLearnerProfile(learner, {
    ...learner,
    employerContact: formEl.querySelector("[data-call-employer-contact]")?.value || "",
    contactNumber: formEl.querySelector("[data-call-contact-number]")?.value || "",
  });
  scheduleStateSave();
  renderLearners();
  setStatus(`Saved the phone contact for ${learner.name}.`);
}

function actionGroup(label, buttons) {
  const items = buttons.filter(Boolean);
  if (!items.length) return "";
  return `<div class="learner-action-group"><p class="meta">${label}</p><div class="learner-action-row">${items.join("")}</div></div>`;
}

export function refreshLearnerSurfaces() {
  if (uiState.dirtyDetails && !uiState.flushingDetails && !flushDirtyDetails()) return;
  renderLearners();
  if (uiState.currentPage === "plan") renderPlan({ refreshMap: false });
}

export function handleLearnerToolClick(event) {
  const previewForm = event.target.closest("[data-preview-review-form]");
  if (previewForm) {
    previewReviewForm(previewForm.dataset.previewReviewForm);
    return true;
  }
  const sendForm = event.target.closest("[data-send-review-form]");
  if (sendForm) {
    sendReviewForm(sendForm.dataset.sendReviewForm);
    return true;
  }
  const concernBtn = event.target.closest("[data-learner-concern]");
  if (concernBtn) {
    event.preventDefault();
    toggleLearnerConcern(concernBtn.dataset.learnerConcern);
    return true;
  }
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return true;
  }
  const needsBooking = event.target.closest("[data-needs-booking]");
  if (needsBooking) {
    moveLearnerToFollowUp(needsBooking.dataset.needsBooking);
    return true;
  }
  const editDetails = event.target.closest("[data-edit-details]");
  if (editDetails) {
    if (event.target.closest("#day-detail, #learner-sheet")) {
      openLearnerSheet("details", editDetails.dataset.editDetails);
      return true;
    }
    toggleDetailsEditor(editDetails.dataset.editDetails);
    return true;
  }
  const phoneReview = event.target.closest("[data-phone-review]");
  if (phoneReview) {
    closeLearnerSheet({ silent: true });
    uiState.phoneEditorId =
      uiState.phoneEditorId === phoneReview.dataset.phoneReview
        ? ""
        : phoneReview.dataset.phoneReview;
    uiState.appointmentEditorId = "";
    uiState.noteEditorId = "";
    uiState.reviewEditorId = "";
    uiState.detailsEditorId = "";
    refreshLearnerSurfaces();
    return true;
  }
  const phoneDay = event.target.closest("[data-phone-day]");
  if (phoneDay) {
    event.stopPropagation();
    setPhoneReviewDay(
      phoneDay.closest("[data-phone-form]")?.dataset.phoneForm,
      phoneDay.dataset.phoneDay,
    );
    return true;
  }
  const clearPhone = event.target.closest("[data-phone-clear]");
  if (clearPhone) {
    clearPhoneReview(clearPhone.dataset.phoneClear);
    return true;
  }
  const bookTime = event.target.closest("[data-book-time]");
  if (bookTime) {
    closeLearnerSheet({ silent: true });
    uiState.appointmentEditorId =
      uiState.appointmentEditorId === bookTime.dataset.bookTime
        ? ""
        : bookTime.dataset.bookTime;
    uiState.noteEditorId = "";
    uiState.phoneEditorId = "";
    uiState.reviewEditorId = "";
    uiState.detailsEditorId = "";
    refreshLearnerSurfaces();
    const bookForm = dayDetail?.querySelector(
      `[data-appointment-form="${bookTime.dataset.bookTime}"]`,
    );
    if (bookForm) updateRequestedFit(bookForm);
    return true;
  }
  const employerDay = event.target.closest("[data-employer-day]");
  if (employerDay) {
    event.stopPropagation();
    if (employerDay.disabled) return true;
    const on = employerDay.getAttribute("aria-pressed") !== "true";
    employerDay.setAttribute("aria-pressed", on ? "true" : "false");
    employerDay.classList.toggle("on", on);
    employerDay.classList.toggle("ghost", !on);
    return true;
  }
  const employerWindow = event.target.closest("[data-employer-window]");
  if (employerWindow) {
    event.stopPropagation();
    employerWindow
      .closest("[data-appointment-form]")
      ?.querySelectorAll("[data-employer-window]")
      .forEach((button) => {
        const selected = button === employerWindow;
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        button.classList.toggle("on", selected);
        button.classList.toggle("ghost", !selected);
      });
    return true;
  }
  const noteUntilPreset = event.target.closest("[data-note-until-preset]");
  if (noteUntilPreset) {
    event.stopPropagation();
    applyNoteUntilPreset(noteUntilPreset);
    return true;
  }
  const saveNote = event.target.closest("[data-note-save]");
  if (saveNote) {
    event.preventDefault();
    event.stopPropagation();
    saveLearnerNote(saveNote.dataset.noteSave);
    return true;
  }
  const clearNote = event.target.closest("[data-note-clear]");
  if (clearNote) {
    event.preventDefault();
    event.stopPropagation();
    clearLearnerNote(clearNote.dataset.noteClear);
    return true;
  }
  const noteButton = event.target.closest("[data-note]");
  if (noteButton) {
    if (event.target.closest("#day-detail, #learner-sheet, .stop-note-box")) {
      openLearnerSheet("note", noteButton.dataset.note);
      return true;
    }
    uiState.noteEditorId =
      uiState.noteEditorId === noteButton.dataset.note ? "" : noteButton.dataset.note;
    uiState.appointmentEditorId = "";
    uiState.phoneEditorId = "";
    uiState.reviewEditorId = "";
    uiState.detailsEditorId = "";
    refreshLearnerSurfaces();
    return true;
  }
  const clearAppointment = event.target.closest("[data-appointment-clear]");
  if (clearAppointment) {
    clearLearnerAppointment(clearAppointment.dataset.appointmentClear);
    return true;
  }
  const rollNextWeek = event.target.closest("[data-roll-next-week]");
  if (rollNextWeek) {
    rollAppointmentToNextWeek(rollNextWeek.dataset.rollNextWeek);
    return true;
  }
  const lastReview = event.target.closest("[data-last-review]");
  if (lastReview) {
    uiState.reviewEditorId =
      uiState.reviewEditorId === lastReview.dataset.lastReview
        ? ""
        : lastReview.dataset.lastReview;
    uiState.appointmentEditorId = "";
    uiState.noteEditorId = "";
    uiState.phoneEditorId = "";
    uiState.detailsEditorId = "";
    refreshLearnerSurfaces();
    return true;
  }
  const saveReview = event.target.closest("[data-review-save]");
  if (saveReview) {
    saveLastReview(saveReview.dataset.reviewSave);
    return true;
  }
  const clearReview = event.target.closest("[data-review-clear]");
  if (clearReview) {
    clearLastReview(clearReview.dataset.reviewClear);
    return true;
  }
  const archive = event.target.closest("[data-archive]");
  if (archive) {
    uiState.reviewEditorId = "";
    archiveLearner(archive.dataset.archive);
    return true;
  }
  return false;
}

export function isLearnerSheetOpen(kind = "", learnerId = "") {
  if (!learnerSheet || learnerSheet.hidden) return false;
  if (!kind) return true;
  if (kind === "details") return uiState.detailsEditorId === learnerId;
  if (kind === "note") return uiState.noteEditorId === learnerId;
  return true;
}

function fillLearnerSheet(learner, kind) {
  if (!learnerSheetBody || !learnerSheetTitle) return;
  learnerSheetTitle.textContent =
    kind === "note" ? `Note · ${learner.name}` : `Details · ${learner.name}`;
  learnerSheetBody.innerHTML = kind === "note" ? noteEditor(learner) : detailsEditor(learner);
}

export function openLearnerSheet(kind, learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner || !learnerSheet) return;
  if (uiState.dirtyDetails && !flushDirtyDetails()) return;
  const same =
    isLearnerSheetOpen(kind, learnerId) &&
    ((kind === "details" && uiState.detailsEditorId === learnerId) ||
      (kind === "note" && uiState.noteEditorId === learnerId));
  if (same) {
    closeLearnerSheet();
    return;
  }
  uiState.appointmentEditorId = "";
  uiState.phoneEditorId = "";
  uiState.reviewEditorId = "";
  if (kind === "details") {
    uiState.detailsEditorId = learnerId;
    uiState.noteEditorId = "";
  } else {
    uiState.noteEditorId = learnerId;
    uiState.detailsEditorId = "";
  }
  fillLearnerSheet(learner, kind);
  learnerSheet.hidden = false;
  document.body.classList.add("learner-sheet-open");
  refreshLearnerSurfaces();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => learnerSheet.classList.add("open"));
  });
}

export function closeLearnerSheet({ silent = false } = {}) {
  if (!learnerSheet) return;
  if (!silent && uiState.dirtyDetails && !flushDirtyDetails()) return;
  learnerSheet.classList.remove("open");
  document.body.classList.remove("learner-sheet-open");
  const wasOpen = uiState.detailsEditorId || uiState.noteEditorId;
  if (uiState.detailsEditorId || uiState.noteEditorId) {
    uiState.detailsEditorId = "";
    uiState.noteEditorId = "";
    if (!silent) refreshLearnerSurfaces();
  }
  setTimeout(() => {
    if (learnerSheet && !learnerSheet.classList.contains("open")) {
      learnerSheet.hidden = true;
      if (learnerSheetBody) learnerSheetBody.innerHTML = "";
    }
  }, 420);
  return Boolean(wasOpen);
}

export function snapshotLearner(learner, extras = {}) {
  if (!learner) return null;
  return {
    id: learner.id,
    name: learner.name,
    company: normaliseCompany(learner.company),
    postcode: learner.postcode,
    collegeDay: learner.collegeDay,
    priority: normalisePriority(learner.priority),
    phoneReview: Boolean(learner.phoneReview),
    phoneReviewDay: phoneReviewDay(learner),
    appointment: learner.appointment || null,
    appointmentAt: learner.appointmentAt || "",
    appointmentClearedAt: learner.appointmentClearedAt || "",
    updatedAt: learner.updatedAt || "",
    employer: learner.employer || null,
    ...learnerProfileFrom(learner),
    lastReviewDate: lastReviewDateKey(learner),
    reviewHistory: learner.reviewHistory || [],
    note: learnerNoteText(learner),
    noteUntil: noteUntilKey(learner),
    safeguardingSigned: Boolean(learner.safeguardingSigned),
    ...extras,
  };
}

export function renderLearners({ records = uiState.currentPage === "records" } = {}) {
  if (uiState.dirtyDetails && !uiState.flushingDetails) {
    flushDirtyDetails();
    return;
  }
  if (pruneBookedAwaiting()) scheduleStateSave();
  const paperSplit = planPaperSplit();
  if (!["unbooked", "waiting", "booked", "awaiting"].includes(uiState.rosterTab)) uiState.rosterTab = "unbooked";
  if (paperUnbookedCount) paperUnbookedCount.textContent = String(paperSplit.unbooked.length);
  if (paperWaitingCount) paperWaitingCount.textContent = String(paperSplit.waiting.length);
  if (paperBookedCount) paperBookedCount.textContent = String(paperSplit.booked.length);
  if (paperAwaitingCount) paperAwaitingCount.textContent = String(paperSplit.awaiting.length);
  if (learnerCount) {
    for (const tab of learnerCount.querySelectorAll("[data-roster-tab]")) {
      const on = tab.dataset.rosterTab === uiState.rosterTab;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    }
    learnerCount.setAttribute(
      "aria-label",
      `${paperSplit.waiting.length} waiting, ${paperSplit.unbooked.length} to book, ${paperSplit.awaiting.length} locked, and ${paperSplit.booked.length} booked.`,
    );
  }
  const tabLearners = paperSplit[uiState.rosterTab] || paperSplit.unbooked;
  const draggingRow =
    uiState.rosterDragId && learnerList.querySelector(`[data-roster-row="${cssEscape(uiState.rosterDragId)}"]`);
  if (!draggingRow) {
  const emptyByTab = {
    unbooked:
      "No reviews are back that still need a visit booked. Names stay here until they have Booked or Verified next to them.",
    waiting:
      "Everyone is either ready to book, locked, or already on a booked day.",
    booked: "No booked reviews from today onwards.",
    awaiting:
      "No one is locked waiting for a reply. Use the lock on a stop when you are waiting to hear back.",
  };
  if (!state.learners.length && !paperSplit.awaiting.length && !paperSplit.booked.length) {
    learnerList.innerHTML =
      '<li class="empty">No learners yet. Add names, companies, postcodes and college days, then plan the week.</li>';
  } else if (!tabLearners.length) {
    learnerList.innerHTML = `<li class="empty">${emptyByTab[uiState.rosterTab] || emptyByTab.unbooked}</li>`;
  } else {
    const visible = [...tabLearners].sort(
      (a, b) =>
        compareReviewUrgency(a, b) ||
        normaliseCompany(a.company).localeCompare(normaliseCompany(b.company)) ||
        a.name.localeCompare(b.name),
    );
    learnerList.innerHTML =
      `<li class="empty" data-search-empty hidden></li>` +
      visible
        .map(
          (learner) => {
            const canDrag = uiState.rosterTab === "unbooked" && !isPhoneReview(learner);
            const hasNote = Boolean(learnerNoteText(learner));
            return `
        <li class="roster-learner roster-drag-row${canDrag ? " can-roster-drag" : ""}" data-roster-row="${learner.id}"${canDrag ? ` data-roster-drag="${learner.id}"` : ""} data-search-text="${escapeHtml(learnerSearchText(learner))}">
          <span class="roster-learner-id">
            <strong>${escapeHtml(learner.name)}</strong>
            ${learner.collegeDay ? `<span class="roster-college-day">College ${escapeHtml(learner.collegeDay)}</span>` : ""}
          </span>
          ${prioritySelect(learner, { stacked: true })}
          <button type="button" class="btn pill ghost roster-note-btn${hasNote || isLearnerSheetOpen("note", learner.id) ? " on" : ""}" data-roster-note="${learner.id}" draggable="false">${hasNote ? "Edit note" : "Add note"}</button>
        </li>
      `;
          },
        )
        .join("");
  }
  }
  renderFollowUps();
  renderArchive();
  applyRosterSearch();
  if (records) renderRecords();
  renderPlanNotes();
}

export function renderFollowUps() {
  if (!followUpList || !followUpCount) return;
  const followUps = state.followUps || [];
  followUpCount.textContent = String(followUps.length);
  if (emailFollowUp) emailFollowUp.disabled = !followUps.length;
  if (!followUps.length) {
    followUpList.innerHTML =
      '<li class="empty">No one needs a next review booked yet. Use Needs booking, or mark a route completed.</li>';
    return;
  }
  const visible = [...followUps].sort(
    (a, b) => compareReviewUrgency(a, b) || a.name.localeCompare(b.name),
  );
  followUpList.innerHTML =
    `<li class="empty" data-search-empty hidden></li>` +
    visible
    .map(
      (item) => `
        <li data-roster-row="${item.id}" data-search-text="${escapeHtml(learnerSearchText(item))}">
          <div class="learner-card-main">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="meta">${escapeHtml(learnerPlaceMeta(item))}</div>
            ${reviewMeta(item)}
            <div class="learner-chips">
              ${prioritySelect(item)}
              ${safeguardingPill(item)}
              ${concernChip(item)}
              ${noticeChip(item)}
            </div>
            ${notePreview(item)}
          </div>
          ${detailsEditor(item)}
          ${noteEditor(item)}
          ${learnerToolsMarkup(
            item.id,
            `${callCheckForm(item)}
          <div class="learner-card-actions">
            ${actionGroup("Forms", [
              `<button type="button" class="btn pill ghost" data-preview-review-form="${item.id}">Preview</button>`,
              `<button type="button" class="btn pill ghost" data-send-review-form="${item.id}">Send review form</button>`,
            ])}
            ${actionGroup("Record", [
              `<button type="button" class="btn pill ghost ${uiState.detailsEditorId === item.id ? "on" : ""}" data-edit-details="${item.id}">${uiState.detailsEditorId === item.id ? "Close" : "Edit details"}</button>`,
              `<button type="button" class="btn pill ghost ${learnerNoteText(item) ? "on" : ""}" data-note="${item.id}">${learnerNoteText(item) ? "Edit note" : "Add note"}</button>`,
            ])}
            ${actionGroup("Move", [
              `<button type="button" class="btn pill ghost" data-restore-follow-up="${escapeHtml(item.id)}">Back on roster</button>`,
              `<button type="button" class="btn pill ghost" data-archive-follow-up="${escapeHtml(item.id)}">Archive</button>`,
            ])}
          </div>`,
          )}
        </li>
      `,
    )
    .join("");
  applyRosterSearch();
}

function renderArchive() {
  if (!archiveList || !archiveCount) return;
  const archive = state.archive || [];
  archiveCount.textContent = String(archive.length);
  if (!archive.length) {
    archiveList.innerHTML =
      '<li class="empty">No archived learners. Archive someone when they no longer need a review.</li>';
    return;
  }
  archiveList.innerHTML =
    `<li class="empty" data-search-empty hidden></li>` +
    archive
    .map(
      (item) => `
        <li data-roster-row="${item.id}" data-search-text="${escapeHtml(learnerSearchText(item))}">
          <div class="learner-card-main">
            <strong>${escapeHtml(item.name)}</strong>
            <div class="meta">${escapeHtml(learnerPlaceMeta(item))}</div>
            ${reviewMeta(item)}
            <div class="learner-chips">
              ${prioritySelect(item)}
              ${safeguardingPill(item)}
            </div>
            <div class="meta">${escapeHtml(archiveReasonLabel(item.archiveReason))}${item.archivedLabel ? ` · ${escapeHtml(item.archivedLabel)}` : ""}</div>
            ${notePreview(item)}
          </div>
          ${detailsEditor(item)}
          <div class="learner-card-actions">
            <button type="button" class="btn pill ghost ${uiState.detailsEditorId === item.id ? "on" : ""}" data-edit-details="${item.id}">${uiState.detailsEditorId === item.id ? "Close" : "Edit details"}</button>
            <button type="button" class="btn pill ghost" data-restore-archive="${escapeHtml(item.id)}">Back on roster</button>
          </div>
        </li>
      `,
    )
    .join("");
  applyRosterSearch();
}
