import "./style.css";
import "leaflet/dist/leaflet.css";
import {
  gatedPage,
  staffFromEmail,
} from "./staff.js";
import {
  tutorFromEmail,
  tutorRecord,
} from "./tutors.js";
import {
  adoptNewerRemotePlan,
  catchUpBeforeEdit,
  emptyState,
  waitForSaveQueue,
  loadRemoteState,
  loadState,
  saveState,
  setStaleSaveHandler,
} from "./storage.js";
import {
  mergeLearnerRecords,
  mergePreservedPlanLocks,
  writeLearnerAppointment,
} from "./plan-locks.js";
import {
  DEFAULT_SETTINGS,
  WEEKDAYS,
  formatShortNumericDate,
  formatTime,
  parseTimeToMinutes,
  toDateKey,
  planningSignature,
  verifiedIds,
  startOfLocalDay,
  dateFromKey,
  isWeekdayDate,
  defaultWorkingDateKeys,
  normalisePriority,
  priorityLabel,
  reviewPriorityLabel,
  normaliseAppointment,
  normaliseCompany,
  postcodeLookupKey,
  applyLearnerProfile,
  learnerProfileFrom,
  normalisePhone,
  clearLearnerPlannedDates,
  DEFAULT_GTA_REVIEWER,
  lastReviewDateKey,
  normaliseReviewHistory,
  nextReviewDateKey,
  isConcernLearner,
  CONCERN_INTERVAL_WEEKS,
  normaliseDateKey,
  formatUkDateKey,
  reviewDueStatus,
  formatWeeksAndDays,
  recordReview,
  planningPriority,
  isConfirmedStop,
  normaliseEmployer,
  employerAllowsDay,
  isPhoneReview,
  phoneReviewDay,
  weekdayName,
  tutorLookupKey,
  normaliseTutor,
  reviewAttendedFor,
  ensureHistoryAttended,
} from "./planner.js";
import {
  escapeHtml,
} from "./lib/html.js";

import {
  extraRouteEmails,
  formatClock,
  formatDateKeyLabel,
  formatDueSpan,
  formatNextNeededSpan,
  formatPlanTitleDate,
} from "./lib/format.js";
import {
  isTestLearner,
} from "./lib/learners.js";
import {
  filterSearchRows,
  learnerSearchQuery,
  learnerSearchText,
} from "./lib/search.js";
import {
  closeRebookFromEscape,
  focusRebookToggle,
  isRebookBusy,
  queueMissedReview,
  rebookDayClickBlocked,
  rebookFormSelector,
  saveRebookedReview,
} from "./plan/rebook-panel.js";
import {
  formatPostcode,
  isLikelyUkPostcode,
} from "./geo.js";
import {
  padTargets,
  REVIEW_TARGET_SLOTS,
  refreshCarriedTargets,
  reviewLearner,
  repairMistakenVisitDates,
  repairFalseTodayCompletions,
  repairForwardDueDates,
  repairOrphanReviewerPacks,
  saveReviewsFromPlan,
  setReviewHolder,
  updateSavedReview,
  REVIEW_FLOW_STEPS,
  tutorWindowOpen,
  ensureReviewCycles,
  repairCycleReleaseDates,
  archiveSettledCycles,
  stampCycleBooked,
  reviewFlowState,
} from "./reviews.js";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import {
  prefetchReviewTemplate,
} from "./review-pdf.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
import {
  clearVisitSignature,
} from "./visits.js";
import {
  ANALYTICS_EVENT_BY_STATUS,
  analyticsPageHtml,
  buildReviewAnalytics,
  ensureAnalyticsReports,
  ensureAnalyticsState,
  recordAnalyticsEvent,
} from "./analytics.js";
import {
  form,
  learnerList,
  learnerCount,
  learnerSearch,
  planButton,
  statusEl,
  planDrop,
  dayDetail,
  routeActions,
  learnerSheet,
  officeInput,
  startInput,
  lunchInput,
  returnInput,
  stayInput,
  callInput,
  skipTodayInput,
  outPageEnabledInput,
  emailInput,
  followUpList,
  emailFollowUp,
  archiveList,
  recordsList,
  recordsSearch,
  recordsAdd,
  recordsAddToggle,
  pageRecords,
  pagePlan,
  pageOut,
  outStatus,
  pageReviews,
  pageArchive,
  pageAnalytics,
  ledeReviews,
  ledeAnalytics,
  archiveHistoryList,
  archiveHistorySearch,
  learnerArchiveModal,
  learnerArchiveSearch,
  archiveReasonModal,
  recordsArchiveOpen,
  analyticsBody,
  analyticsCount,
  reviewsList,
  reviewsCount,
  reviewsTitle,
  reviewsSearch,
  reviewsTutorFilter,
  reviewsSync,
  planTitle,
  planNotesRoot,
  liveClock,
  outPartyPopup,
} from "./app/dom.js";
import {
  bindPersist,
  queueTutorAutosave,
  reconcileVisibleState,
  scheduleStateSave,
} from "./app/persist.js";
import {
  adminMode,
  applyPhoneSettingsClass,
  closeAccountSettings,
  forcePasswordChange,
  officeMode,
  openAccountSettings,
  passwordChangeNeeded,
  showSettingsTab,
  signedInSession,
  tutorMode,
} from "./app/auth-ui.js";
import { loadFeedbackInbox } from "./app/feedback.js";
import { bootstrap, startAuthBoot } from "./app/boot.js";
import { installLoadedState } from "./app/account-state.js";
import {
  resetUiState,
  uiState,
} from "./app/ui-state.js";
import {
  bindReportsModal,
  closeReportsModal,
  closeStoredReportView,
  maybeEmailNewReports,
  mountReportsModal,
} from "./features/reports-modal.js";
import {
  handleReviewAction,
} from "./features/review-workflow/actions.js";
import {
  applyDateFromAttachedFile,
  attachReviewFile,
  openReviewAttachment,
  refreshReviewFilePicker,
  updateCompletedTimingChip,
} from "./features/review-workflow/attachments.js";

import {
  closePdfPreview,
  loadReviewFormPdf,
  mountPreview,
  openReviewPreviewChooser,
  previewLayer,
  previewReviewForm,
  reviewFormEmailBody,
  sendReviewForm,
} from "./features/review-workflow/preview.js";
import {
  bindReviewWorkflow,
} from "./features/review-workflow/runtime.js";
import {
  markWorkflowReturned,
  saveCompletedPreviousReview,
  savePreviousReviewUpload,
  saveReadyToPrint,
  saveReturnedReviewUpload,
  sendWorkflowReview,
} from "./features/review-workflow/workflow-saves.js";
import {
  applyTutorNaComment,
  cycleTimingLabel,
  renderTutorReviews,
  syncCarriedTargetsToSection7,
  tutorReviewPack,
  updateOtjTrackStatus,
  updateTutorFieldLimit,
} from "./features/tutor-review/form-html.js";
import {
  improveTutorField,
} from "./features/tutor-review/improve.js";
import {
  closeTutorHelp,
  openTutorHelp,
} from "./features/tutor-review/help.js";
import {
  closeTutorDatePickers,
  closeTutorOwnerPickers,
  refreshTutorDateMenu,
  setTutorOwnerSelect,
  setTutorTargetDate,
  shiftTutorDateMonth,
} from "./features/tutor-review/date-picker.js";
import {
  bindTutorReview,
  markTutorCardTouched,
  mountTutorPressEffects,
  popTutorButton,
  previewTutorReview,
  revealTutorFormGap,
  saveTutorReview,
  shakeTutorSendButton,
  validateTutorForm,
} from "./features/tutor-review/validation.js";
import {
  applyOutPageMode,
  arriveOutStop,
  bindOutRound,
  closeOutMapsPopup,
  closeOutPartyPopup,
  ensureOutPlan,
  finishOutRound,
  flushOutDraft,
  isPhoneHandset,
  leaveOutStop,
  mountOutRound,
  openMapsApp,
  openOutForDay,
  openOutMapsPopup,
  openOutPartyPopup,
  openOutReviewPdf,
  outMapsPopupEl,
  outPageEnabled,
  phoneOutMode,
  renderOut,
  requireAcceptedOutRoute,
  saveOutPartyForm,
  saveOutReview,
  stampOutPdfOpened,
} from "./features/out-round.js";
import {
  bindPlannerCalendar,
  mountCalendar,
  renderCalendar,
} from "./features/planner/calendar.js";
import {
  backfillCompletedRouteMarks,
  bindPlannerStatus,
  completedRouteIds,
  dropBlockedTutorsFromLoosePlan,
  includeLearnerInPlanner,
  reviewWaitingLearners,
} from "./features/planner/status.js";
import {
  appointmentEditor,
  bindPlannerAppointments,
  clearLearnerAppointment,
  onRequestedTimeInput,
  rollAppointmentToNextWeek,
  saveLearnerAppointment,
  updateRequestedFit,
} from "./features/planner/appointments.js";
import {
  bindPlannerNotes,
  clearFollowUpNote,
  learnerNoteText,
  notePreview,
  noteUntilKey,
  saveFollowUpNote,
  saveLearnerNote,
  setPlanNotesOpen,
} from "./features/planner/notes.js";
import {
  addLearnerToFollowUp,
  applyRosterDrop,
  beginPointerRosterDrag,
  beginRosterFitPreview,
  bindRosterDrag,
  blankDragCanvas,
  clearRosterDropUi,
  dropLearnerFromRoster,
  ensureLearnerLocated,
  findRosterLearner,
  finishPointerRosterDrag,
  moveLearnerToFollowUp,
  onRosterDragMove,
  placeRosterDragGhost,
  pointerOverPlan,
  refreshRosterAfterDrop,
  reorderRouteStop,
  startRosterDragGhost,
  takeOffRound,
  undoRecentRosterDrop,
  updateRosterDropVisual,
} from "./features/planner/roster-drag.js";
import {
  acceptDay,
  applyCurrentPlan,
  bindPlannerRoutes,
  clearAwaitingForLearner,
  completeRoute,
  dayIsPermanentlyComplete,
  emailDayRoute,
  expiredAwaitingCount,
  hydrateLocatedLearners,
  mountFillDayButton,
  planTheWeek,
  printDayRoute,
  pruneBookedAwaiting,
  removeFrozenTimesForLearner,
  removeLearnerFromRoutes,
  setAwaitingHoldPart,
  signatureExtras,
  syncFillDayControl,
  toggleAwaitingReply,
  toggleVerify,
} from "./features/planner/routes.js";
import {
  bindDayView,
  completedLearnerActions,
  rebookDeps,
  renderPlan,
  shiftRebookMonth,
  stopIsValidated,
  syncRebookChrome,
} from "./features/planner/day-view.js";
import {
  cancelMapDraw,
  drawMap,
  initMap,
  setMapPanelOpen,
} from "./features/planner/map.js";
import {
  cssEscape,
} from "./lib/html.js";
import {
  bindRecordsDetails,
  catalogueLearners,
  dirtyDetailsForm,
  findEditableLearner,
  flushDirtyDetails,
  highlightDirtySave,
  knownTutors,
  learnerFormEl,
  onComboSelectChange,
  onDetailsFieldChange,
  onPlannedCycleFieldInput,
  readLearnerInfo,
  saveLearnerDetails,
  toggleDetailsEditor,
  touchLearner,
} from "./features/records/details-editor.js";
import {
  addNewLearner,
  bindAddLearner,
  calculatedAddLearnerDates,
  refreshAddLearnerCombos,
  resetAddLearnerForm,
  setRecordsAddMinimised,
  setRecordsAddOpen,
  showFormError,
} from "./features/records/add-learner.js";
import {
  applyRecordsViewFilter,
  bindRecordsList,
  managedLearnerRows,
  missingLearnerFields,
  renderRecords,
  saveManagedDetails,
  toggleLearnerConcern,
  toggleRecordsCheck,
} from "./features/records/records-list.js";
import {
  applyArchiveSearch,
  archiveFollowUp,
  archiveLearnerWithReason,
  bindArchive,
  closeArchiveReason,
  closeLearnerArchive,
  emailFollowUpList,
  openArchiveReason,
  openLearnerArchive,
  previewArchiveReview,
  renderArchiveHistory,
  renderLearnerArchive,
  restoreArchive,
  restoreFollowUp,
  saveArchiveActual,
  saveArchiveAttended,
} from "./features/records/archive.js";
import {
  bindLearnerSheet,
  closeLearnerSheet,
  handleLearnerToolClick,
  isLearnerSheetOpen,
  openLearnerSheet,
  refreshLearnerSurfaces,
  renderFollowUps,
  renderLearners,
  saveCallCheck,
  snapshotLearner,
  toggleLearnerToolsPanel,
} from "./features/records/learner-sheet.js";

const state = emptyState();
if (!state.acceptedRoutes) state.acceptedRoutes = {};
if (!state.verifiedByDate) state.verifiedByDate = {};
if (!state.callAnchors) state.callAnchors = {};
if (!state.pinnedRoutes) state.pinnedRoutes = {};
if (!state.frozenTimes) state.frozenTimes = {};
if (!state.excludedFromDate) state.excludedFromDate = {};
if (!state.completedRoutes) state.completedRoutes = {};
if (!state.awaitingReply) state.awaitingReply = {};
if (!state.awaitingClearedAt) state.awaitingClearedAt = {};
if (!state.followUps) state.followUps = [];
if (!state.archive) state.archive = [];
if (!state.savedReviews) state.savedReviews = [];
if (!state.visitDays) state.visitDays = {};
bindRecordsList({
  concernButton,
  learnerPlaceMeta,
  logAction,
  refreshLearnerCatalogues,
  refreshPlannedWeek,
  renderLearners,
  renderReviews,
  safeguardingPill,
  setStatus,
});
bindArchive({
  dropLearnerFromRoster,
  learnerPlaceMeta,
  logAction,
  managedLearnerRows,
  previewReviewForm,
  readSettingsIntoState,
  refreshPlannedWeek,
  refreshRosterAfterDrop,
  renderLearners,
  rosterLearnerFromRecord,
  setStatus,
  snapshotLearner,
});
bindLearnerSheet({
  applyRosterSearch,
  clearLastReview,
  clearLearnerAppointment,
  clearPhoneReview,
  concernChip,
  learnerPlaceMeta,
  moveLearnerToFollowUp,
  noticeChip,
  previewReviewForm,
  prioritySelect,
  reviewMeta,
  rollAppointmentToNextWeek,
  safeguardingPill,
  saveLastReview,
  sendReviewForm,
  setPhoneReviewDay,
  setStatus,
  toggleSafeguarding,
  updateRequestedFit,
});
bindRecordsDetails({
  setStatus,
  refreshLearnerSurfaces,
  closeLearnerSheet,
  renderLearners,
  refreshPlannedWeek,
  logAction,
  saveManagedDetails,
  missingLearnerFields,
  concernButton,
  safeguardingPill,
});
bindAddLearner({
  managedLearnerRows,
  setPage,
  renderLearners,
  renderRecords,
  refreshPlannedWeek,
  logAction,
});
bindPersist({
  getState: () => state,
  pruneBookedAwaiting,
  saveState,
  flushDirtyDetails,
  loadRemoteState,
  adoptNewerRemotePlan,
  renderLearners,
  waitForSaveQueue,
  applyCurrentPlan,
  mergePreservedPlanLocks,
  mergeLearnerRecords,
  saveTutorReview,
  setStatus,
});
bindReportsModal({
  getState: () => state,
  setStatus,
});
bindReviewWorkflow({
  state,
  setStatus,
  renderReviews,
  renderLearners,
  saveReviewTargets,
  previewReviewForm,
  holdReview,
  readSettingsIntoState,
  reviewFormEmailBody,
  loadReviewFormPdf,
  reviewDateLabel,
  reviewsTodayKey,
  findEditableLearner,
  saveManagedDetails,
  stampOutPdfOpened,
  logAction,
});
bindTutorReview({
  state,
  setStatus,
  signedInTutor,
  learnersAssignedToSignedInTutor,
  reviewsTodayKey,
  holdReview,
});
bindOutRound({
  state,
  setStatus,
  setPage,
  findEditableLearner,
  logAction,
  rememberSelectedDay,
  alreadyPlanned,
  refreshPlannedWeek,
  completeRoute,
  applyPhoneSettingsClass,
  pageFromHash,
  isTutorMode: () => tutorMode,
  isOfficeMode: () => officeMode,
  learnerPlaceMeta,
});
bindPlannerStatus({
  state,
  catalogueLearners,
  reviewDoneDateKeysForLearner,
  rosterLearnerFromRecord,
  clearAwaitingForLearner,
  touchLearner,
});
bindPlannerCalendar({
  selectedWorkingDateKeys,
  reviewsDoneOnDate,
  confirmedReviewCount,
  updatePlanLabels,
  renderPlan,
  refreshPlannedWeek,
  displayPlanDay,
  drawMap,
});
bindPlannerAppointments({
  learnerFormEl,
  setStatus,
  placeAppointmentOnPlan,
  renderLearners,
  refreshPlannedWeek,
  findEditableLearner,
  removeFrozenTimesForLearner,
  logCycleBooked,
  currentPlannerSettings,
  planTheWeek,
  hydrateLocatedLearners,
  ensureLearnerLocated,
  findRosterLearner,
  syncRebookChrome,
});
bindPlannerNotes({
  findEditableLearner,
  learnerFormEl,
  setStatus,
  closeLearnerSheet,
  refreshLearnerSurfaces,
});
bindPlannerRoutes({
  state,
  addLearnerToFollowUp,
  dedupePlacedLearners,
  dropLearnerFromRoster,
  findSelectedPlanDay,
  learnerPlaceMeta,
  learnerTutorName,
  logAction,
  planDayLogLabel,
  readSettingsIntoState,
  refreshRosterAfterDrop,
  rememberSelectedDay,
  snapHoldMinutes,
  stopIsValidated,
  syncAppointmentPins,
  findEditableLearner,
  setStatus,
  currentPlannerSettings,
  refreshPlannedWeek,
  renderLearners,
  renderPlan,
  reviewsDoneOnDate,
});
bindRosterDrag({
  state,
  alreadyPlanned,
  findSelectedPlanDay,
  learnerCouldJoinDay,
  refreshLivePlan,
  snapshotLearner,
  findEditableLearner,
  setStatus,
  currentPlannerSettings,
  refreshPlannedWeek,
  renderLearners,
  renderPlan,
  selectedWorkingDateKeys,
});
bindDayView({
  state,
  findSelectedPlanDay,
  isLearnerSheetOpen,
  learnerPlaceMeta,
  lockIconMarkup,
  planCardOpeningClass,
  planStopActions,
  plannerStopLearner,
  plannerStopLearnerPanel,
  playPlanCardOpening,
  revealOpenTimePicker,
  safeguardingPill,
  stopContactLine,
  stopFoundClass,
  stopPriorityLabel,
  findEditableLearner,
  setStatus,
  currentPlannerSettings,
  placeAppointmentOnPlan,
  refreshPlannedWeek,
  renderLearners,
  displayPlanDay,
  reviewsDoneOnDate,
});
uiState.currentPage = pageFromHash();

initMap();

document.getElementById("map-toggle")?.addEventListener("click", () => {
  const toggle = document.getElementById("map-toggle");
  setMapPanelOpen(toggle?.getAttribute("aria-expanded") !== "true");
});

if (learnerCount) {
  learnerCount.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-roster-tab]");
    if (!tab) return;
    const next = tab.dataset.rosterTab || "unbooked";
    if (next === uiState.rosterTab) return;
    uiState.rosterTab = next;
    renderLearners();
  });
}

learnerList.addEventListener("click", (event) => {
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    event.stopPropagation();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return;
  }
  const rosterNote = event.target.closest("[data-roster-note]");
  if (rosterNote) {
    event.preventDefault();
    event.stopPropagation();
    openLearnerSheet("note", rosterNote.dataset.rosterNote);
    return;
  }
  if (event.target.closest("[data-roster-drag]")) {
    event.preventDefault();
    return;
  }
  if (uiState.rosterDragMoved) {
    uiState.rosterDragMoved = false;
    event.preventDefault();
    return;
  }
  const rosterHead = event.target.closest("[data-toggle-roster]");
  if (rosterHead) {
    if (event.target.closest("select, input, a, .btn, .priority-picker, [data-roster-drag]")) return;
    const id = rosterHead.dataset.toggleRoster;
    if (!id) return;
    if (uiState.rosterOpenIds.has(id)) uiState.rosterOpenIds.delete(id);
    else uiState.rosterOpenIds.add(id);
    renderLearners();
    return;
  }
  const toolsToggle = event.target.closest("[data-toggle-tools]");
  if (toolsToggle) {
    toggleLearnerToolsPanel(toolsToggle);
    return;
  }
  handleLearnerToolClick(event);
});

function syncSearchClear(input) {
  const button = input?.closest(".search-field")?.querySelector("[data-clear-search]");
  if (button) button.hidden = !String(input.value || "");
}

function bindSearchInput(input, render) {
  if (!input) return;
  let frame = 0;
  const apply = () => {
    frame = 0;
    syncSearchClear(input);
    render();
  };
  const schedule = (immediate = false) => {
    if (immediate) {
      if (frame) cancelAnimationFrame(frame);
      apply();
      return;
    }
    if (frame) return;
    frame = requestAnimationFrame(apply);
  };
  input.addEventListener("input", () => schedule(!input.value));
  input.addEventListener("search", () => schedule(true));
  syncSearchClear(input);
}

function isSearchChrome(target) {
  return Boolean(
    target?.closest?.(
      "input[type='search'], .search-field, .search-clear, .records-search, .learner-search",
    ),
  );
}

function isDetailsSaveControl(target) {
  return Boolean(
    target?.closest?.(
      "#details-save-bar, [data-flush-details], [data-details-form] button[type='submit'], [data-records-details] button[type='submit']",
    ),
  );
}

document.addEventListener("click", (event) => {
  if (passwordChangeNeeded()) return;
  if (event.target.closest("[data-flush-details]")) {
    flushDirtyDetails();
    return;
  }
  if (!event.target.closest("[data-plan-notes]")) setPlanNotesOpen(false);
  if (!event.target.closest("[data-time-picker]")) closeTimePickers();
  if (!event.target.closest("[data-owner-picker]")) closeTutorOwnerPickers();
  if (!event.target.closest("[data-date-picker]")) closeTutorDatePickers();
  if (
    !event.target.closest("#account-settings") &&
    !event.target.closest("[data-settings-card]")
  ) {
    closeAccountSettings();
  }
});

document.addEventListener(
  "pointerdown",
  (event) => {
    const clearSearch = event.target.closest("[data-clear-search]");
    if (clearSearch) {
      event.preventDefault();
      event.stopPropagation();
      const input = clearSearch.closest(".search-field")?.querySelector("input[type='search']");
      if (input) {
        input.value = "";
        syncSearchClear(input);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    if (isDetailsSaveControl(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      const form = event.target.closest("[data-records-details], [data-details-form]");
      if (event.target.closest("[data-flush-details], #details-save-bar")) {
        flushDirtyDetails();
        return;
      }
      if (form?.hasAttribute("data-records-details")) {
        saveManagedDetails(form.dataset.recordsDetails);
        return;
      }
      if (form?.hasAttribute("data-details-form")) {
        saveLearnerDetails(form.dataset.detailsForm);
      }
      return;
    }
    if (!uiState.dirtyDetails || uiState.flushingDetails) return;
    if (isSearchChrome(event.target)) return;
    const form = dirtyDetailsForm();
    if (form?.contains(event.target)) return;
    if (!flushDirtyDetails()) {
      event.preventDefault();
      event.stopPropagation();
      highlightDirtySave();
    }
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (passwordChangeNeeded()) {
    event.preventDefault();
    forcePasswordChange();
    return;
  }
  closeTimePickers();
  closeTutorOwnerPickers();
  closeTutorDatePickers();
  closeTutorHelp();
  if (closeArchiveReason()) return;
  if (closeLearnerArchive()) return;
  closeAccountSettings();
  if (closeStoredReportView()) return;
  closeReportsModal();
  if (uiState.planNotesOpen) {
    setPlanNotesOpen(false);
    return;
  }
  if (
    uiState.appointmentEditorId ||
    uiState.noteEditorId ||
    uiState.phoneEditorId ||
    uiState.reviewEditorId ||
    uiState.detailsEditorId
  ) {
    if (isLearnerSheetOpen()) {
      closeLearnerSheet();
      return;
    }
    if (uiState.dirtyDetails && !flushDirtyDetails()) return;
    uiState.appointmentEditorId = "";
    uiState.noteEditorId = "";
    uiState.phoneEditorId = "";
    uiState.reviewEditorId = "";
    uiState.detailsEditorId = "";
    refreshLearnerSurfaces();
  }
});

learnerList.addEventListener("submit", (event) => {
  const detailsForm = event.target.closest("[data-details-form]");
  if (detailsForm) {
    event.preventDefault();
    saveLearnerDetails(detailsForm.dataset.detailsForm);
    return;
  }
  const reviewForm = event.target.closest("[data-review-form]");
  if (reviewForm) {
    event.preventDefault();
    saveLastReview(reviewForm.dataset.reviewForm);
    return;
  }
  const callCheck = event.target.closest("[data-call-check]");
  if (callCheck) {
    event.preventDefault();
    saveCallCheck(callCheck.dataset.callCheck);
    return;
  }
  const appointmentForm = event.target.closest("[data-appointment-form]");
  if (!appointmentForm) return;
  event.preventDefault();
  saveLearnerAppointment(appointmentForm.dataset.appointmentForm);
});

learnerList.addEventListener("submit", (event) => {
  const noteForm = event.target.closest("[data-note-form]");
  if (!noteForm) return;
  event.preventDefault();
  saveLearnerNote(noteForm.dataset.noteForm);
});

followUpList?.addEventListener("submit", (event) => {
  const detailsForm = event.target.closest("[data-details-form]");
  if (detailsForm) {
    event.preventDefault();
    saveLearnerDetails(detailsForm.dataset.detailsForm);
    return;
  }
  const callCheck = event.target.closest("[data-call-check]");
  if (callCheck) {
    event.preventDefault();
    saveCallCheck(callCheck.dataset.callCheck);
    return;
  }
  const noteForm = event.target.closest("[data-note-form]");
  if (!noteForm) return;
  event.preventDefault();
  saveFollowUpNote(noteForm.dataset.noteForm);
});

bindSearchInput(learnerSearch, () => {
  if (!applyRosterSearch()) renderLearners({ records: false });
});

followUpList?.addEventListener("click", (event) => {
  const toolsToggle = event.target.closest("[data-toggle-tools]");
  if (toolsToggle) {
    toggleLearnerToolsPanel(toolsToggle);
    return;
  }
  const previewForm = event.target.closest("[data-preview-review-form]");
  if (previewForm) {
    previewReviewForm(previewForm.dataset.previewReviewForm);
    return;
  }
  const sendForm = event.target.closest("[data-send-review-form]");
  if (sendForm) {
    sendReviewForm(sendForm.dataset.sendReviewForm);
    return;
  }
  const concernBtn = event.target.closest("[data-learner-concern]");
  if (concernBtn) {
    event.preventDefault();
    toggleLearnerConcern(concernBtn.dataset.learnerConcern);
    return;
  }
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return;
  }
  const restore = event.target.closest("[data-restore-follow-up]");
  if (restore) {
    restoreFollowUp(restore.dataset.restoreFollowUp);
    return;
  }
  const editDetails = event.target.closest("[data-edit-details]");
  if (editDetails) {
    toggleDetailsEditor(editDetails.dataset.editDetails);
    return;
  }
  const noteButton = event.target.closest("[data-note]");
  if (noteButton) {
    uiState.noteEditorId =
      uiState.noteEditorId === noteButton.dataset.note ? "" : noteButton.dataset.note;
    uiState.detailsEditorId = "";
    renderFollowUps();
    return;
  }
  const saveNote = event.target.closest("[data-note-save]");
  if (saveNote) {
    saveFollowUpNote(saveNote.dataset.noteSave);
    return;
  }
  const clearNote = event.target.closest("[data-note-clear]");
  if (clearNote) {
    clearFollowUpNote(clearNote.dataset.noteClear);
    return;
  }
  const archive = event.target.closest("[data-archive-follow-up]");
  if (archive) {
    archiveFollowUp(archive.dataset.archiveFollowUp);
  }
});

emailFollowUp?.addEventListener("click", () => {
  emailFollowUpList();
});

archiveList?.addEventListener("click", (event) => {
  if (passwordChangeNeeded()) {
    event.preventDefault();
    forcePasswordChange();
    return;
  }
  const restore = event.target.closest("[data-restore-archive]");
  if (restore) {
    restoreArchive(restore.dataset.restoreArchive);
    return;
  }
  const concernBtn = event.target.closest("[data-learner-concern]");
  if (concernBtn) {
    event.preventDefault();
    toggleLearnerConcern(concernBtn.dataset.learnerConcern);
    return;
  }
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return;
  }
  const editDetails = event.target.closest("[data-edit-details]");
  if (editDetails) {
    toggleDetailsEditor(editDetails.dataset.editDetails);
  }
});

archiveList?.addEventListener("submit", (event) => {
  const detailsForm = event.target.closest("[data-details-form]");
  if (!detailsForm) return;
  event.preventDefault();
  saveLearnerDetails(detailsForm.dataset.detailsForm);
});

document.querySelectorAll("[data-nav-page]").forEach((button) => {
  button.addEventListener("click", () => setPage(button.dataset.navPage));
});

window.addEventListener("hashchange", () => {
  if (uiState.dirtyDetails && !flushDirtyDetails()) {
    const hash = pageHash(uiState.currentPage);
    if (location.hash !== hash) history.replaceState(null, "", hash);
    return;
  }
  setPage(pageFromHash(), { skipHash: true });
});

bindSearchInput(recordsSearch, () => {
  if (!applyRecordsViewFilter()) renderRecords();
});

pageOut?.addEventListener("click", (event) => {
  const dayChip = event.target.closest("[data-out-day]");
  if (dayChip) {
    flushOutDraft();
    closeOutPartyPopup();
    closeOutMapsPopup();
    uiState.openOutLearnerId = "";
    openOutForDay(dayChip.dataset.outDay);
    return;
  }
  const arrive = event.target.closest("[data-out-arrive]");
  if (arrive) {
    arriveOutStop(arrive.dataset.outArrive);
    return;
  }
  const leave = event.target.closest("[data-out-leave]");
  if (leave) {
    leaveOutStop(leave.dataset.outLeave);
    return;
  }
  const openReview = event.target.closest("[data-out-open-review]");
  if (openReview) {
    const id = openReview.dataset.outOpenReview;
    if (!requireAcceptedOutRoute(uiState.selectedDateKey, id)) return;
    const arrived = Boolean(state.visitDays?.[uiState.selectedDateKey]?.stops?.[id]?.arrivedAt);
    if (!arrived) {
      setStatus("Arrive first, then open the review.");
      return;
    }
    openOutReviewPdf(id);
    return;
  }
  const partyBtn = event.target.closest("[data-out-party]");
  if (partyBtn) {
    if (!requireAcceptedOutRoute(uiState.selectedDateKey, partyBtn.dataset.outStop)) return;
    openOutPartyPopup(partyBtn.dataset.outStop, partyBtn.dataset.outParty);
    return;
  }
  const mapsBtn = event.target.closest("[data-out-maps]");
  if (mapsBtn) {
    openOutMapsPopup(mapsBtn.dataset.outMaps);
    return;
  }
  const closeReview = event.target.closest("[data-out-close-review]");
  if (closeReview) {
    flushOutDraft();
    uiState.openOutLearnerId = "";
    renderOut();
    return;
  }
  const clearSign = event.target.closest("[data-sign-clear]");
  if (clearSign) {
    clearVisitSignature(clearSign.closest("[data-sign-wrap]"), clearSign.dataset.signClear);
    return;
  }
  if (event.target.closest("[data-out-finish]")) {
    finishOutRound();
  }
});

pageOut?.addEventListener("submit", (event) => {
  const formEl = event.target.closest("[data-out-review]");
  if (!formEl) return;
  event.preventDefault();
  saveOutReview(formEl);
});

outPartyPopup?.addEventListener("click", (event) => {
  if (event.target.closest("[data-out-party-dismiss]")) {
    closeOutPartyPopup();
    return;
  }
  const clearSign = event.target.closest("[data-sign-clear]");
  if (clearSign) {
    clearVisitSignature(clearSign.closest("[data-sign-wrap]"), clearSign.dataset.signClear);
  }
});
outPartyPopup?.addEventListener("submit", (event) => {
  const formEl = event.target.closest("[data-out-party-form]");
  if (!formEl) return;
  event.preventDefault();
  saveOutPartyForm(formEl);
});

document.getElementById("out-maps-popup")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-out-maps-dismiss]")) {
    closeOutMapsPopup();
    return;
  }
  const apple = event.target.closest("[data-out-maps-apple]");
  const google = event.target.closest("[data-out-maps-google]");
  if (apple || google) {
    event.preventDefault();
    openMapsApp(apple ? "apple" : "google", outMapsPopupEl()?.dataset.mapsQuery || "");
    closeOutMapsPopup();
  }
});

bindSearchInput(reviewsSearch, () => {
  if (!applyReviewsSearch()) renderReviews();
});

reviewsTutorFilter?.addEventListener("change", () => {
  renderReviews();
});

bindSearchInput(archiveHistorySearch, () => {
  if (!applyArchiveSearch()) renderArchiveHistory();
});

archiveHistoryList?.addEventListener("click", (event) => {
  if (passwordChangeNeeded()) {
    event.preventDefault();
    forcePasswordChange();
    return;
  }
  const preview = event.target.closest("[data-archive-preview]");
  if (preview) {
    previewArchiveReview(
      preview.dataset.archivePreview,
      preview.dataset.proposed,
      preview.dataset.actual,
    );
    return;
  }
  if (event.target.closest("select, input, label, a, .btn, [data-archive-preview]")) return;
  const toggle = event.target.closest("[data-toggle-archive-learner], .tutor-learner-row");
  const id = toggle?.closest("[data-archive-learner]")?.dataset.archiveLearner || "";
  if (!id) return;
  if (uiState.expandedArchiveLearnerIds.has(id)) uiState.expandedArchiveLearnerIds.delete(id);
  else uiState.expandedArchiveLearnerIds.add(id);
  renderArchiveHistory();
});

archiveHistoryList?.addEventListener("change", (event) => {
  const attended = event.target.closest("[data-archive-attended]");
  if (attended) {
    saveArchiveAttended(
      attended.dataset.archiveAttended,
      attended.dataset.proposed,
      attended.value,
    );
    return;
  }
  const actual = event.target.closest("[data-archive-actual]");
  if (actual) {
    saveArchiveActual(actual.dataset.archiveActual, actual.dataset.proposed, actual.value);
  }
});

document.querySelector("#reviews-filters")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-reviews-filter]");
  if (!button) return;
  uiState.reviewsFilter = button.dataset.reviewsFilter || "all";
  if (uiState.reviewsFilter !== "print") uiState.reviewsDateFilter = "";
  renderReviews();
});

document.querySelector("#analytics-range")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-analytics-range]");
  if (!button) return;
  uiState.analyticsRange = button.dataset.analyticsRange || "all";
  renderAnalytics();
});

document.querySelector("#analytics-side")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-analytics-side]");
  if (!button) return;
  uiState.analyticsSide = button.dataset.analyticsSide === "tutors" ? "tutors" : "reviews";
  if (uiState.analyticsSide === "tutors") uiState.analyticsView = "summary";
  renderAnalytics();
});

document.querySelector("#analytics-movement-btn")?.addEventListener("click", () => {
  uiState.analyticsView = uiState.analyticsView === "movement" ? "summary" : "movement";
  renderAnalytics();
});

mountReportsModal();

reviewsSync?.addEventListener("click", () => {
  syncPlannedReviews();
});

document.addEventListener("click", (event) => {
  const openAttachment = event.target.closest("[data-open-attachment]");
  if (!openAttachment) return;
  event.preventDefault();
  openReviewAttachment(
    { id: openAttachment.dataset.openAttachment },
    openAttachment.dataset.openAttachmentName || "",
  );
});

reviewsList?.addEventListener("submit", (event) => {
  const formEl = event.target.closest("[data-tutor-review]");
  if (!formEl) return;
  event.preventDefault();
  const check = validateTutorForm(formEl);
  if (!check.ok) {
    const send = formEl.querySelector('[data-tutor-save="return"]');
    setStatus(check.message);
    shakeTutorSendButton(send).then(() => revealTutorFormGap(check));
    return;
  }
  const saved = saveTutorReview(formEl, { sendBack: true });
  if (!saved) return;
  uiState.openTutorLearnerId = "";
  const learner = reviewLearner(state, saved.learnerId);
  setStatus(`Sent ${learner?.name || "the review"} back to the reviewer.`);
  renderReviews();
});

reviewsList?.addEventListener("click", (event) => {
  if (passwordChangeNeeded()) {
    event.preventDefault();
    forcePasswordChange();
    return;
  }
  if (event.target.closest("[data-tutor-help-dismiss]")) {
    event.preventDefault();
    closeTutorHelp();
    return;
  }
  const helpButton = event.target.closest("[data-tutor-help]");
  if (helpButton) {
    event.preventDefault();
    openTutorHelp(helpButton.dataset.tutorHelp || "");
    return;
  }
  if (event.target.closest("[data-date-dismiss]")) {
    event.preventDefault();
    closeTutorDatePickers();
    return;
  }
  const dateDay = event.target.closest("[data-date-day]");
  if (dateDay) {
    event.preventDefault();
    const picker = dateDay.closest("[data-date-picker]");
    if (dateDay.disabled || picker?.classList.contains("is-locked")) return;
    setTutorTargetDate(picker, dateDay.dataset.dateDay || "");
    popTutorButton(dateDay);
    closeTutorDatePickers();
    queueTutorAutosave(picker?.closest("[data-tutor-review]"));
    return;
  }
  const dateNav = event.target.closest("[data-date-month-shift]");
  if (dateNav) {
    event.preventDefault();
    const picker = dateNav.closest("[data-date-picker]");
    if (!picker) return;
    picker.dataset.dateMonth = shiftTutorDateMonth(
      picker.dataset.dateMonth,
      Number(dateNav.dataset.dateMonthShift || 0),
    );
    refreshTutorDateMenu(picker);
    return;
  }
  const dateTrigger = event.target.closest(".tutor-date-trigger");
  if (dateTrigger) {
    event.preventDefault();
    if (dateTrigger.disabled || dateTrigger.closest(".tutor-pane-previous")) return;
    const picker = dateTrigger.closest("[data-date-picker]");
    const open = picker?.classList.contains("open");
    closeTutorDatePickers();
    closeTutorOwnerPickers();
    if (picker && !open) {
      picker.classList.add("open");
      document.body.classList.add("tutor-date-open");
      dateTrigger.setAttribute("aria-expanded", "true");
    }
    return;
  }
  if (!event.target.closest("[data-date-picker]")) closeTutorDatePickers();
  const ownerOption = event.target.closest("[data-owner-option]");
  if (ownerOption) {
    event.preventDefault();
    const picker = ownerOption.closest("[data-owner-picker]");
    setTutorOwnerSelect(picker, ownerOption.dataset.ownerOption || "");
    popTutorButton(ownerOption);
    closeTutorOwnerPickers();
    queueTutorAutosave(picker?.closest("[data-tutor-review]"));
    return;
  }
  const ownerTrigger = event.target.closest(".tutor-owner-trigger");
  if (ownerTrigger) {
    event.preventDefault();
    if (ownerTrigger.disabled || ownerTrigger.closest(".tutor-pane-previous")) return;
    const picker = ownerTrigger.closest("[data-owner-picker]");
    const open = picker?.classList.contains("open");
    closeTutorOwnerPickers();
    closeTutorDatePickers();
    if (picker && !open) {
      picker.classList.add("open");
      ownerTrigger.setAttribute("aria-expanded", "true");
    }
    return;
  }
  closeTutorOwnerPickers();
  const previewTutor = event.target.closest("[data-tutor-preview]");
  if (previewTutor) {
    event.preventDefault();
    const formEl = previewTutor.closest("[data-tutor-review]");
    if (formEl) previewTutorReview(formEl);
    return;
  }
  const openTutor = event.target.closest("[data-open-tutor-review]");
  if (openTutor) {
    const learnerId = openTutor.dataset.openTutorReview || "";
    const learner = learnersAssignedToSignedInTutor().find((item) => item.id === learnerId);
    if (learner && !tutorWindowOpen(learner) && !["returned", "print", "completed"].includes(tutorReviewPack(learner)?.status)) {
      const due = reviewDueStatus(learner);
      setStatus(
        due.daysUntilNotice > 0
          ? `That review opens in ${formatWeeksAndDays(due.daysUntilNotice)}.`
          : "That review is not ready to fill yet.",
      );
      return;
    }
    uiState.openTutorLearnerId = learnerId;
    renderReviews();
    return;
  }
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return;
  }
  const toggleReview = event.target.closest("[data-toggle-review-learner]");
  if (toggleReview) {
    const id = toggleReview.closest("[data-review-learner]")?.dataset.reviewLearner || "";
    if (id) {
      if (uiState.openReviewLearnerIds.has(id)) uiState.openReviewLearnerIds.delete(id);
      else uiState.openReviewLearnerIds.add(id);
      renderReviews();
    }
    return;
  }
  const toggleLearner = event.target.closest("[data-toggle-tutor-learner], .tutor-learner-row");
  if (toggleLearner && !event.target.closest("[data-open-tutor-review]")) {
    const id = toggleLearner.closest("[data-learner-id]")?.dataset.learnerId || "";
    if (id) {
      if (uiState.expandedTutorLearnerIds.has(id)) uiState.expandedTutorLearnerIds.delete(id);
      else uiState.expandedTutorLearnerIds.add(id);
      renderTutorReviews();
    }
    return;
  }
  if (event.target.closest("[data-close-tutor-review]")) {
    uiState.openTutorLearnerId = "";
    renderReviews();
    return;
  }
  const aiButton = event.target.closest("[data-tutor-ai]");
  if (aiButton) {
    event.preventDefault();
    improveTutorField(aiButton);
    return;
  }
  const statusButton = event.target.closest("[data-target-status]");
  if (statusButton) {
    const row = statusButton.closest("[data-target-row]");
    if (row) {
      row.querySelector('[data-target-field="status"]').value = statusButton.dataset.targetStatus;
      row.querySelectorAll("[data-target-status]").forEach((button) => {
        const on = button === statusButton;
        button.classList.toggle("on", on);
        button.classList.toggle("ghost", !on);
      });
      row.querySelector(".tutor-target-actions")?.classList.remove("is-missing");
      popTutorButton(statusButton);
      const formEl = row.closest("[data-tutor-review]");
      markTutorCardTouched(row);
      syncCarriedTargetsToSection7(formEl);
      queueTutorAutosave(formEl);
    }
    return;
  }
  const ragButton = event.target.closest("[data-rag]");
  if (ragButton) {
    const group = ragButton.closest(".tutor-rag");
    group?.querySelectorAll("[data-rag]").forEach((button) => {
      const on = button === ragButton;
      button.classList.toggle("on", on);
      button.classList.toggle("ghost", !on);
    });
    group?.classList.remove("is-missing");
    popTutorButton(ragButton);
    if (ragButton.dataset.rag === "na") {
      applyTutorNaComment(ragButton.closest(".tutor-progress-row"), group?.dataset.progressId);
    }
    markTutorCardTouched(ragButton);
    queueTutorAutosave(ragButton.closest("[data-tutor-review]"));
    return;
  }
  if (event.target.closest("[data-reviews-clear-date]")) {
    uiState.reviewsDateFilter = "";
    renderReviews();
    return;
  }
  const button = event.target.closest("[data-review-action]");
  if (button) {
    if (button.dataset.reviewAction === "attach") {
      button.closest(".reviews-attachment")?.querySelector("[data-attach-file]")?.click();
      return;
    }
    const reviewId = button.closest("[data-review-id]")?.dataset.reviewId || "";
    const learnerId = button.closest("[data-learner-id]")?.dataset.learnerId || "";
    handleReviewAction(reviewId, button.dataset.reviewAction, learnerId);
    return;
  }
  const dateHint = event.target.closest("[data-review-date-hint]");
  if (dateHint) {
    const formEl = dateHint.closest("[data-review-workflow], [data-completed-review]");
    const field =
      dateHint.dataset.reviewDateHint === "planned"
        ? formEl?.querySelector("[data-completed-planned]")
        : formEl?.querySelector("[data-completed-actual]");
    if (field && dateHint.dataset.date) {
      field.value = dateHint.dataset.date;
      updateCompletedTimingChip(formEl);
    }
    return;
  }
  const pickFile = event.target.closest("[data-review-file-pick]");
  if (pickFile) {
    pickFile.closest("[data-review-file]")?.querySelector("input[type=file]")?.click();
    return;
  }
  const toggle = event.target.closest("[data-learner-toggle]");
  if (!toggle) return;
  const learnerId = toggle.closest("[data-learner-id]")?.dataset.learnerId;
  if (!learnerId) return;
  if (uiState.openReviewLearnerIds.has(learnerId)) uiState.openReviewLearnerIds.delete(learnerId);
  else uiState.openReviewLearnerIds.add(learnerId);
  renderReviews();
});

reviewsList?.addEventListener("focusin", (event) => {
  if (event.target.closest("[data-tutor-card]")) markTutorCardTouched(event.target);
});

reviewsList?.addEventListener("input", (event) => {
  event.target.closest("label.is-missing, .tutor-rag.is-missing, .tutor-target-actions.is-missing, .tutor-otj-hours.is-missing, .tutor-otj-track.is-missing")
    ?.classList.remove("is-missing");
  if (event.target.matches("[data-otj-hours]")) {
    updateOtjTrackStatus(event.target.closest("[data-otj-row]"));
  }
  const tutorForm = event.target.closest("[data-tutor-review]");
  if (tutorForm && !event.target.closest(".tutor-pane-previous")) {
    markTutorCardTouched(event.target);
    queueTutorAutosave(tutorForm);
  }
  const formEl = event.target.closest("[data-review-workflow], [data-completed-review]");
  if (formEl) updateCompletedTimingChip(formEl);
  const previousRow = event.target.closest('[data-target-row="previous"]');
  if (previousRow && event.target.matches('[data-target-field="action"]')) {
    const hasTarget = Boolean(event.target.value.trim());
    previousRow.querySelectorAll("[data-target-status]").forEach((button) => {
      button.disabled = !hasTarget;
    });
  }
  if (event.target.matches("[data-word-limit], [data-char-limit]")) {
    updateTutorFieldLimit(event.target);
  }
});

reviewsList?.addEventListener("change", (event) => {
  const formEl = event.target.closest("[data-review-workflow], [data-completed-review]");
  if (formEl) updateCompletedTimingChip(formEl);
  const fileBox = event.target.closest("[data-review-file]");
  if (fileBox) {
    refreshReviewFilePicker(fileBox);
    applyDateFromAttachedFile(fileBox);
  }
  const attach = event.target.closest("[data-attach-file]");
  if (attach?.files?.[0]) {
    attachReviewFile({
      reviewId: attach.dataset.attachFile,
      learnerId: attach.dataset.attachLearner,
      dateKey: attach.dataset.attachDate,
      file: attach.files[0],
    });
    attach.value = "";
    return;
  }
});

reviewsList?.addEventListener("submit", (event) => {
  const workflow = event.target.closest("[data-review-workflow]");
  if (workflow) {
    event.preventDefault();
    const id = workflow.dataset.reviewWorkflow;
    const intent = event.submitter?.dataset.reviewSave || "send";
    if (intent === "previous") savePreviousReviewUpload(id);
    else if (intent === "returned-upload") saveReturnedReviewUpload(id);
    else if (intent === "already-done") saveCompletedPreviousReview(id, { alreadyDone: true });
    else if (intent === "send") sendWorkflowReview(id);
    else if (intent === "returned") markWorkflowReturned(id);
    else if (intent === "print") saveReadyToPrint(id);
    else if (intent === "complete") saveCompletedPreviousReview(id);
    return;
  }
  const completed = event.target.closest("[data-completed-review]");
  if (completed) {
    event.preventDefault();
    saveCompletedPreviousReview(completed.dataset.completedReview);
    return;
  }
  const formEl = event.target.closest("[data-review-targets]");
  if (!formEl) return;
  event.preventDefault();
  saveReviewTargets(formEl.dataset.reviewTargets);
});

document.querySelector(".records-filters")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-records-filter]");
  if (!button) return;
  if (!flushDirtyDetails()) return;
  uiState.recordsFilter = button.dataset.recordsFilter || "all";
  if (recordsSearch) {
    recordsSearch.value = "";
    syncSearchClear(recordsSearch);
  }
  if (!applyRecordsViewFilter()) renderRecords();
});

recordsAddToggle?.addEventListener("click", () => {
  if (recordsAdd?.hidden) {
    setRecordsAddOpen(true);
    document.querySelector("#learner-name")?.focus();
    return;
  }
  if (recordsAdd?.classList.contains("is-minimised")) {
    setRecordsAddMinimised(false);
    document.querySelector("#learner-name")?.focus();
    return;
  }
  setRecordsAddMinimised(true);
});

document.querySelector("#records-add-minimise")?.addEventListener("click", () => {
  const minimised = !recordsAdd?.classList.contains("is-minimised");
  setRecordsAddMinimised(minimised);
  if (!minimised) document.querySelector("#learner-name")?.focus();
});

function onPhoneFieldBlur(event) {
  const field = event.target.closest(
    "[data-records-contact-number], [data-details-contact-number], [data-add-contact-number], [data-call-contact-number], [data-stop-contact-field='contactNumber']",
  );
  if (!field || field !== event.target) return;
  field.value = normalisePhone(field.value);
}

function expandShortYearDateValue(value) {
  const match = String(value || "").trim().match(/^(\d{1,4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  let year = Number(match[1]);
  if (Number.isNaN(year)) return value;
  if (year < 100) year += 2000;
  else if (year >= 1900 && year < 2000) year = 2000 + (year % 100);
  if (year >= 2000 && year <= 2009) year += 20;
  const next = `${String(year).padStart(4, "0")}-${match[2]}-${match[3]}`;
  return next === value ? value : next;
}

function onDateFieldAdjust(event) {
  const field = event.target.closest('input[type="date"]');
  if (!field || field !== event.target) return;
  const next = expandShortYearDateValue(field.value);
  if (!next || next === field.value) return;
  field.value = next;
  if (event.type === "input" || event.type === "change") return;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

recordsList?.addEventListener("focusout", onPhoneFieldBlur);
learnerList.addEventListener("focusout", onPhoneFieldBlur);
followUpList?.addEventListener("focusout", onPhoneFieldBlur);
archiveList?.addEventListener("focusout", onPhoneFieldBlur);
document.addEventListener("focusout", onDateFieldAdjust);
document.addEventListener("change", onDateFieldAdjust);
document.addEventListener("input", onDateFieldAdjust);
recordsList?.addEventListener("input", onPlannedCycleFieldInput);
recordsList?.addEventListener("change", onPlannedCycleFieldInput);
learnerList.addEventListener("input", onPlannedCycleFieldInput);
learnerList.addEventListener("change", onPlannedCycleFieldInput);
followUpList?.addEventListener("input", onPlannedCycleFieldInput);
followUpList?.addEventListener("change", onPlannedCycleFieldInput);
archiveList?.addEventListener("input", onPlannedCycleFieldInput);
archiveList?.addEventListener("change", onPlannedCycleFieldInput);
recordsList?.addEventListener("input", onDetailsFieldChange);
recordsList?.addEventListener("change", onDetailsFieldChange);
learnerList.addEventListener("input", onDetailsFieldChange);
learnerList.addEventListener("change", onDetailsFieldChange);
followUpList?.addEventListener("input", onDetailsFieldChange);
followUpList?.addEventListener("change", onDetailsFieldChange);
archiveList?.addEventListener("input", onDetailsFieldChange);
archiveList?.addEventListener("change", onDetailsFieldChange);

recordsList?.addEventListener("submit", (event) => {
  const detailsForm = event.target.closest("[data-records-details]");
  if (!detailsForm) return;
  event.preventDefault();
  saveManagedDetails(detailsForm.dataset.recordsDetails);
});

recordsList?.addEventListener("click", (event) => {
  if (passwordChangeNeeded()) {
    event.preventDefault();
    forcePasswordChange();
    return;
  }
  const previewForm = event.target.closest("[data-preview-review-form]");
  if (previewForm) {
    event.preventDefault();
    openReviewPreviewChooser(previewForm.dataset.previewReviewForm);
    return;
  }
  const concernBtn = event.target.closest("[data-learner-concern]");
  if (concernBtn) {
    event.preventDefault();
    toggleLearnerConcern(concernBtn.dataset.learnerConcern);
    return;
  }
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return;
  }
  const checkBtn = event.target.closest("[data-records-check]");
  if (checkBtn) {
    event.preventDefault();
    toggleRecordsCheck(checkBtn.dataset.recordsCheck || checkBtn.closest("[data-records-row]")?.dataset.recordsRow);
    return;
  }
  const archiveLearnerBtn = event.target.closest("[data-records-archive]");
  if (archiveLearnerBtn) {
    event.preventDefault();
    openArchiveReason(archiveLearnerBtn.dataset.recordsArchive);
    return;
  }
  const workplaceSearch = event.target.closest("[data-records-workplace]");
  if (workplaceSearch) {
    event.preventDefault();
    if (!flushDirtyDetails()) return;
    if (recordsSearch) recordsSearch.value = workplaceSearch.dataset.recordsWorkplace || "";
    uiState.recordsFilter = "all";
    renderRecords();
    return;
  }
  if (event.target.closest("select, input, label, a, .btn, .records-fields, .records-details")) return;
  const toggle = event.target.closest("[data-toggle-records-learner], .tutor-learner-row");
  const id = toggle?.closest("[data-records-row]")?.dataset.recordsRow || "";
  if (!id) return;
  if (uiState.dirtyDetails && !flushDirtyDetails()) return;
  if (uiState.openRecordsLearnerIds.has(id)) uiState.openRecordsLearnerIds.delete(id);
  else uiState.openRecordsLearnerIds.add(id);
  renderRecords();
});

recordsArchiveOpen?.addEventListener("click", () => {
  if (passwordChangeNeeded()) {
    forcePasswordChange();
    return;
  }
  openLearnerArchive();
});

archiveReasonModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-archive-reason-close]")) {
    closeArchiveReason();
    return;
  }
  const choice = event.target.closest("[data-archive-reason]");
  if (!choice) return;
  const learnerId = uiState.archiveReasonLearnerId;
  const reason = choice.dataset.archiveReason;
  closeArchiveReason();
  archiveLearnerWithReason(learnerId, reason);
});

learnerArchiveModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-learner-archive-close]")) {
    closeLearnerArchive();
    return;
  }
  const filter = event.target.closest("[data-learner-archive-filter]");
  if (filter) {
    uiState.learnerArchiveFilter = filter.dataset.learnerArchiveFilter || "all";
    renderLearnerArchive();
    return;
  }
  const restore = event.target.closest("[data-learner-archive-restore]");
  if (restore) {
    restoreArchive(restore.dataset.learnerArchiveRestore);
    renderLearnerArchive();
  }
});

learnerArchiveSearch?.addEventListener("input", () => {
  renderLearnerArchive();
});

function planCardOpeningClass(id) {
  if (!id || uiState.planCardOpeningId !== id) return "";
  uiState.planCardOpeningId = "";
  return " is-opening";
}

function planCardEditorsOpen(id) {
  return (
    uiState.appointmentEditorId === id ||
    uiState.phoneEditorId === id ||
    uiState.noteEditorId === id ||
    uiState.rebookStopId === id
  );
}

function playPlanCardOpening() {
  const card = dayDetail.querySelector(".stop.plan-card.is-opening");
  if (!card) return;
  const extra = card.querySelector(".stop-extra");
  if (!extra || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.classList.remove("is-opening");
    return;
  }
  const clear = () => {
    card.classList.remove("is-opening", "play-open");
    card.style.removeProperty("--stop-extra-height");
  };
  card.style.setProperty("--stop-extra-height", `${extra.scrollHeight}px`);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!card.isConnected) return;
      card.classList.add("play-open");
      extra.addEventListener("transitionend", (event) => {
        if (event.target === extra && event.propertyName === "height") clear();
      });
      window.setTimeout(clear, 520);
    });
  });
}

function togglePlanCard(contactStop) {
  const id = contactStop.dataset.stopContact;
  if (!id || contactStop.classList.contains("is-closing")) return;
  if (uiState.openStopContactId === id) {
    const extra = contactStop.querySelector(".stop-extra");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (extra && contactStop.classList.contains("is-open") && !planCardEditorsOpen(id) && !reduceMotion) {
      contactStop.style.setProperty("--stop-extra-height", `${extra.offsetHeight}px`);
      contactStop.classList.add("is-closing");
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (uiState.openStopContactId !== id) return;
        uiState.openStopContactId = "";
        renderPlan({ refreshMap: false });
      };
      extra.addEventListener("transitionend", (event) => {
        if (event.target === extra && event.propertyName === "height") finish();
      });
      window.setTimeout(finish, 420);
      requestAnimationFrame(() => contactStop.classList.add("play-close"));
      return;
    }
    uiState.openStopContactId = "";
    renderPlan({ refreshMap: false });
    return;
  }
  uiState.openStopContactId = id;
  if (!contactStop.classList.contains("is-open")) uiState.planCardOpeningId = id;
  renderPlan({ refreshMap: false });
}

dayDetail.addEventListener("click", onPlanDayClick);
dayDetail.addEventListener("keydown", (event) => {
  if (isRebookBusy()) return;
  closeRebookFromEscape(event, {
    openId: uiState.rebookStopId,
    root: dayDetail,
    closePanel() {
      uiState.rebookStopId = "";
      uiState.rebookErrorText = "";
      renderPlan({ refreshMap: false });
    },
  });
});
routeActions?.addEventListener("click", onPlanDayClick);

function onPlanDayClick(event) {
  const rebookMonth = event.target.closest("[data-rebook-month]");
  if (rebookMonth && !rebookMonth.disabled) {
    event.preventDefault();
    event.stopPropagation();
    if (isRebookBusy()) return;
    const form = rebookMonth.closest("[data-rebook-form]");
    if (form) shiftRebookMonth(form, Number(rebookMonth.dataset.rebookMonth));
    return;
  }
  const workingDay = event.target.closest("[data-rebook-day]");
  if (workingDay) {
    event.preventDefault();
    event.stopPropagation();
    if (isRebookBusy() || rebookDayClickBlocked(workingDay)) return;
    const form = workingDay.closest("[data-rebook-form]");
    const input = form?.querySelector("[data-rebook-date]");
    const time = form?.querySelector("[data-rebook-time]");
    if (input && workingDay.dataset.rebookDay) {
      input.value = workingDay.dataset.rebookDay;
      if (time) time.value = "";
      updateRequestedFit(form);
    }
    return;
  }
  const slotChoice = event.target.closest("[data-slot-choice]");
  if (slotChoice) {
    event.preventDefault();
    event.stopPropagation();
    const form = slotChoice.closest("[data-rebook-form], [data-appointment-form]");
    if (form?.dataset.rebookForm && isRebookBusy()) return;
    const input = form?.querySelector("[data-rebook-time], [data-appointment-time]");
    if (input) input.value = formatTime(Number(slotChoice.dataset.slotChoice));
    if (form) updateRequestedFit(form);
    return;
  }
  if (uiState.routeDragMoved) {
    uiState.routeDragMoved = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (handleLearnerToolClick(event)) return;
  if (event.target.closest("[data-upload-day-reviews]")) {
    openReviewsForCompletedDay(uiState.selectedDateKey);
    return;
  }
  const day = findSelectedPlanDay(uiState.planResult?.days);
  if (!day) return;
  const rosterUndoBtn = event.target.closest("[data-roster-undo]");
  if (rosterUndoBtn) {
    event.preventDefault();
    event.stopPropagation();
    undoRecentRosterDrop(day, rosterUndoBtn.dataset.rosterUndo);
    return;
  }
  const off = event.target.closest("[data-off-round]");
  if (off) {
    takeOffRound(day, off.dataset.offRound);
    return;
  }
  const rebookQueue = event.target.closest("[data-rebook-queue]");
  if (rebookQueue) {
    event.preventDefault();
    event.stopPropagation();
    void queueMissedReview(day, rebookQueue.dataset.rebookQueue, rebookDeps());
    return;
  }
  const rebook = event.target.closest("[data-rebook]");
  if (rebook) {
    if (isRebookBusy()) return;
    const id = rebook.dataset.rebook;
    const opening = uiState.rebookStopId !== id;
    uiState.rebookStopId = opening ? id : "";
    if (opening) {
      uiState.rebookErrorText = "";
      uiState.rebookDraft = null;
    }
    renderPlan({ refreshMap: false });
    const rebookForm = dayDetail.querySelector(rebookFormSelector(id));
    if (rebookForm) {
      updateRequestedFit(rebookForm);
      rebookForm.querySelector("[data-rebook-title]")?.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      rebookForm.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      focusRebookToggle(dayDetail, id);
    }
    return;
  }
  const rollNextWeek = event.target.closest("[data-roll-next-week]");
  if (rollNextWeek) {
    rollAppointmentToNextWeek(rollNextWeek.dataset.rollNextWeek);
    return;
  }
  const verify = event.target.closest("[data-verify]");
  if (verify) {
    toggleVerify(day, verify.dataset.verify);
    return;
  }
  if (event.target.closest("[data-accept-day]")) {
    acceptDay(day);
    return;
  }
  if (event.target.closest("[data-open-out]")) {
    if (!outPageEnabled()) {
      setStatus("Turn on the Out page in Settings first.");
      return;
    }
    openOutForDay(day.dateKey);
    return;
  }
  if (event.target.closest("[data-email-route]")) {
    emailDayRoute(day);
    return;
  }
  if (event.target.closest("[data-print-route]")) {
    printDayRoute(day);
    return;
  }
  if (event.target.closest("[data-complete-route]")) {
    const current = displayPlanDay(uiState.selectedDateKey) || day;
    if (!dayIsPermanentlyComplete(current)) completeRoute(current);
    return;
  }
  const timeTrigger = event.target.closest("[data-time-trigger]");
  if (timeTrigger) {
    event.stopPropagation();
    toggleTimePicker(timeTrigger.closest("[data-time-picker]"));
    return;
  }
  const timeHour = event.target.closest("[data-time-hour]");
  if (timeHour) {
    event.stopPropagation();
    setAwaitingHoldPart(day, timeHour.closest("[data-time-picker]")?.dataset.timePicker, {
      hour: Number(timeHour.dataset.timeHour),
      keepOpen: true,
    });
    return;
  }
  const timeMinute = event.target.closest("[data-time-minute]");
  if (timeMinute) {
    event.stopPropagation();
    setAwaitingHoldPart(day, timeMinute.closest("[data-time-picker]")?.dataset.timePicker, {
      minute: Number(timeMinute.dataset.timeMinute),
    });
    return;
  }
  const lockContact = event.target.closest("[data-lock-contact]");
  if (lockContact) {
    event.stopPropagation();
    toggleStopContactLock(lockContact.dataset.lockContact);
    return;
  }
  const awaiting = event.target.closest("[data-awaiting]");
  if (awaiting) {
    toggleAwaitingReply(day, awaiting.dataset.awaiting);
    return;
  }
  const safeguardingBtn = event.target.closest("[data-safeguarding]");
  if (safeguardingBtn) {
    event.preventDefault();
    toggleSafeguarding(safeguardingBtn.dataset.safeguarding);
    return;
  }
  if (event.target.closest("a, button, input, textarea, select, .stop-actions, .time-picker, .stop-contact, .stop-learner-tools, .book-time-form, .slot-preview")) return;
  const contactStop = event.target.closest("[data-stop-contact]");
  if (contactStop) togglePlanCard(contactStop);
}

dayDetail.addEventListener("dragstart", (event) => {
  const handle = event.target.closest("[data-stop-drag]");
  const stopEl = handle?.closest("[data-route-stop]");
  if (!handle || !stopEl || stopEl.dataset.routeBooked === "true") {
    event.preventDefault();
    return;
  }
  uiState.routeDragId = stopEl.dataset.routeStop;
  uiState.routeDragMoved = false;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", uiState.routeDragId);
  event.dataTransfer.setDragImage(stopEl, 24, 24);
  stopEl.classList.add("is-dragging");
});
dayDetail.addEventListener("dragover", (event) => {
  if (uiState.rosterDragId) {
    event.preventDefault();
    uiState.rosterDragMoved = true;
    uiState.rosterDropOver = true;
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    updateRosterDropVisual();
    return;
  }
  const stopEl = event.target.closest("[data-route-stop]");
  if (!uiState.routeDragId || !stopEl || stopEl.dataset.routeStop === uiState.routeDragId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  for (const item of dayDetail.querySelectorAll("[data-route-stop].drag-over")) {
    if (item !== stopEl) item.classList.remove("drag-over");
  }
  stopEl.classList.add("drag-over");
});
dayDetail.addEventListener("dragleave", (event) => {
  if (uiState.rosterDragId && planDrop && !planDrop.contains(event.relatedTarget)) {
    uiState.rosterDropOver = false;
    updateRosterDropVisual();
  }
  const stopEl = event.target.closest("[data-route-stop]");
  if (stopEl && !stopEl.contains(event.relatedTarget)) {
    stopEl.classList.remove("drag-over");
  }
});
dayDetail.addEventListener("drop", (event) => {
  if (uiState.rosterDragId) {
    event.preventDefault();
    event.stopPropagation();
    void applyRosterDrop(uiState.rosterDragId);
    return;
  }
  const stopEl = event.target.closest("[data-route-stop]");
  const targetId = stopEl?.dataset.routeStop;
  event.preventDefault();
  if (!uiState.routeDragId || !targetId || uiState.routeDragId === targetId) return;
  const day = findSelectedPlanDay(uiState.planResult?.days);
  if (day) reorderRouteStop(day, uiState.routeDragId, targetId);
});
dayDetail.addEventListener("dragend", () => {
  for (const item of dayDetail.querySelectorAll("[data-route-stop]")) {
    item.classList.remove("is-dragging", "drag-over");
  }
  uiState.routeDragId = "";
});
learnerList.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest("button, a, input, textarea, select")) return;
  const row = event.target.closest(".can-roster-drag[data-roster-drag]");
  if (!row || uiState.rosterTab !== "unbooked" || uiState.rosterDragId) return;
  uiState.rosterPointer = {
    id: row.dataset.rosterDrag,
    row,
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId,
    started: false,
  };
  try {
    row.setPointerCapture(event.pointerId);
  } catch {
    /* Pointer capture is optional; the window listeners still follow the drag. */
  }
  event.preventDefault();
});

window.addEventListener("pointermove", (event) => {
  if (!uiState.rosterPointer || event.pointerId !== uiState.rosterPointer.pointerId) return;
  if (!uiState.rosterPointer.started) {
    const dx = event.clientX - uiState.rosterPointer.x;
    const dy = event.clientY - uiState.rosterPointer.y;
    if (dx * dx + dy * dy < 16) return;
    beginPointerRosterDrag(uiState.rosterPointer, event);
  }
  if (!uiState.rosterPointer?.started) return;
  placeRosterDragGhost(event.clientX, event.clientY);
  uiState.rosterDropOver = pointerOverPlan(event.clientX, event.clientY);
  updateRosterDropVisual();
});

window.addEventListener("pointerup", (event) => {
  finishPointerRosterDrag(event);
});
window.addEventListener("pointercancel", (event) => {
  finishPointerRosterDrag(event);
});

learnerList.addEventListener("dragstart", (event) => {
  if (event.target.closest("[data-roster-note]")) {
    event.preventDefault();
    return;
  }
  const handle = event.target.closest("[data-roster-drag]");
  const id = handle?.dataset.rosterDrag;
  if (!handle || !id || uiState.rosterTab !== "unbooked") {
    if (event.target.closest("[data-roster-drag]")) event.preventDefault();
    return;
  }
  uiState.rosterDragId = id;
  uiState.rosterDragMoved = false;
  uiState.rosterFitPreview = null;
  setStatus("");
  const row = handle.closest("[data-roster-row]");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.setDragImage(blankDragCanvas(), 0, 0);
  }
  if (row) startRosterDragGhost(row, event);
  row?.classList.add("is-drag-source");
  document.addEventListener("dragover", onRosterDragMove);
  updateRosterDropVisual();
  beginRosterFitPreview(id);
});
learnerList.addEventListener("dragend", () => {
  for (const item of learnerList.querySelectorAll("[data-roster-row]")) {
    item.classList.remove("is-dragging", "is-drag-source");
  }
  if (uiState.rosterDropBusy || uiState.rosterSnapping) return;
  uiState.rosterDragId = "";
  uiState.rosterFitToken += 1;
  uiState.rosterFitPreview = null;
  clearRosterDropUi();
});
planDrop?.addEventListener("dragover", (event) => {
  if (!uiState.rosterDragId) return;
  event.preventDefault();
  uiState.rosterDragMoved = true;
  uiState.rosterDropOver = true;
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  updateRosterDropVisual();
});
planDrop?.addEventListener("dragleave", (event) => {
  if (!uiState.rosterDragId || planDrop.contains(event.relatedTarget)) return;
  uiState.rosterDropOver = false;
  updateRosterDropVisual();
});
planDrop?.addEventListener("drop", (event) => {
  if (!uiState.rosterDragId) return;
  event.preventDefault();
  const id = uiState.rosterDragId;
  void applyRosterDrop(id);
});
dayDetail.addEventListener("input", onRequestedTimeInput);
dayDetail.addEventListener("change", onRequestedTimeInput);
dayDetail.addEventListener("change", (event) => {
  const field = event.target.closest("[data-stop-contact-field]");
  if (field) saveStopContactDetails(field.closest("[data-stop-contact]")?.dataset.stopContact);
});
dayDetail.addEventListener("input", onPlannedCycleFieldInput);
dayDetail.addEventListener("change", onPlannedCycleFieldInput);
dayDetail.addEventListener("input", onDetailsFieldChange);
dayDetail.addEventListener("change", onDetailsFieldChange);
dayDetail.addEventListener("focusout", onPhoneFieldBlur);
dayDetail.addEventListener("submit", (event) => {
  const detailsForm = event.target.closest("[data-details-form]");
  if (detailsForm) {
    event.preventDefault();
    saveLearnerDetails(detailsForm.dataset.detailsForm);
    return;
  }
  const reviewForm = event.target.closest("[data-review-form]");
  if (reviewForm) {
    event.preventDefault();
    saveLastReview(reviewForm.dataset.reviewForm);
    return;
  }
  const appointmentForm = event.target.closest("[data-appointment-form]");
  if (appointmentForm) {
    event.preventDefault();
    saveLearnerAppointment(appointmentForm.dataset.appointmentForm);
    return;
  }
  const noteForm = event.target.closest("[data-note-form]");
  if (noteForm) {
    event.preventDefault();
    saveLearnerNote(noteForm.dataset.noteForm);
    return;
  }
  const rebookForm = event.target.closest("[data-rebook-form]");
  if (!rebookForm) return;
  event.preventDefault();
  if (isRebookBusy()) return;
  const day = findSelectedPlanDay(uiState.planResult?.days);
  if (day) void saveRebookedReview(day, rebookForm.dataset.rebookForm, rebookDeps());
});

planNotesRoot?.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-plan-notes-toggle]");
  if (toggle) {
    setPlanNotesOpen(!uiState.planNotesOpen);
    return;
  }
  const item = event.target.closest("[data-plan-note]");
  if (!item) return;
  setPlanNotesOpen(false);
  openLearnerSheet("note", item.dataset.planNote);
});

learnerSheet?.addEventListener("click", (event) => {
  if (event.target.closest("[data-learner-sheet-close]")) {
    closeLearnerSheet();
    return;
  }
  handleLearnerToolClick(event);
});
learnerSheet?.addEventListener("input", onPlannedCycleFieldInput);
learnerSheet?.addEventListener("change", onPlannedCycleFieldInput);
learnerSheet?.addEventListener("input", onDetailsFieldChange);
learnerSheet?.addEventListener("change", onDetailsFieldChange);
learnerSheet?.addEventListener("focusout", onPhoneFieldBlur);
learnerSheet?.addEventListener("submit", (event) => {
  const detailsForm = event.target.closest("[data-details-form]");
  if (detailsForm) {
    event.preventDefault();
    saveLearnerDetails(detailsForm.dataset.detailsForm);
    return;
  }
  const noteForm = event.target.closest("[data-note-form]");
  if (!noteForm) return;
  event.preventDefault();
  saveLearnerNote(noteForm.dataset.noteForm);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const info = readLearnerInfo(form, "add");
  const result = addNewLearner({
    name: document.querySelector("#learner-name").value.trim(),
    company: document.querySelector("#learner-company")?.value,
    postcode: document.querySelector("#learner-postcode").value,
    collegeDay: document.querySelector("#learner-college").value,
    lastReviewDate: calculatedAddLearnerDates(info).lastReviewDate,
    ...info,
  });
  if (result.error) {
    showFormError(result.error);
    return;
  }
  resetAddLearnerForm();
  showFormError("");
  setStatus(`Added ${result.learner.name}.`);
});

form.addEventListener("input", onPlannedCycleFieldInput);
form.addEventListener("change", onPlannedCycleFieldInput);
form.addEventListener("change", onComboSelectChange);
document.addEventListener("change", onComboSelectChange);
form.addEventListener("focusout", onPhoneFieldBlur);

mountFillDayButton({
  selectedWorkingDateKeys,
  updatePlanLabels,
  catchUpBeforeEdit,
});

outPageEnabledInput?.addEventListener("change", () => {
  state.settings.outPageEnabled = outPageEnabledInput.checked;
  scheduleStateSave();
  applyOutPageMode();
});

function applyTutorHideFromForm() {
  state.settings.blockedTutors = [...document.querySelectorAll("[data-block-tutor]:checked")].map(
    (input) => input.dataset.blockTutor,
  );
  dropBlockedTutorsFromLoosePlan();
}

function refreshAfterSettingsChange({
  rebuild = false,
  resetSelection = false,
} = {}) {
  scheduleStateSave();
  renderLearners();
  updatePlanLabels();
  renderCalendar();
  refreshPlannedWeek({
    rebuild,
    fillGaps: false,
    resetSelection,
  });
}

document.querySelector("#settings-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
});

document.querySelector("#settings-form")?.addEventListener("change", (event) => {
  if (event.target?.closest("[data-block-tutor]")) {
    applyTutorHideFromForm();
    refreshAfterSettingsChange({ rebuild: true });
    setStatus("Updated which tutors’ reviews stay off the list.");
    return;
  }
  const previousOffice = state.settings.officePostcode;
  readSettingsIntoState();
  if (event.target?.id === "route-email") {
    scheduleStateSave();
    return;
  }
  const officeChanged = previousOffice !== state.settings.officePostcode;
  refreshAfterSettingsChange({
    rebuild: officeChanged,
    resetSelection: event.target?.id === "skip-today",
  });
});

mountCalendar();

function updatePlanLabels() {
  const viewing = uiState.selectedDateKey || selectedWorkingDateKeys()[0];
  const titled = viewing ? formatPlanTitleDate(viewing) : null;
  if (titled) {
    planTitle.innerHTML = `<span class="plan-title-kicker">Plan For</span><span class="plan-title-date"><span class="plan-date-day">${titled.day}<sup class="plan-date-ordinal">${titled.suffix}</sup></span> ${titled.month}</span>`;
  } else {
    planTitle.textContent = "Pick a day";
  }
  planButton.textContent = "Fill Day";
  syncFillDayControl(viewing);
}

function hydrateSettings() {
  officeInput.value = state.settings.officePostcode;
  startInput.value = state.settings.startTime;
  lunchInput.value = state.settings.lunchStart;
  returnInput.value = state.settings.returnBy;
  stayInput.value = String(state.settings.stayMinutes);
  callInput.value = String(state.settings.callMinutes ?? 60);
  skipTodayInput.checked = state.settings.skipToday !== false;
  if (outPageEnabledInput) outPageEnabledInput.checked = outPageEnabled();
  applyOutPageMode();
  if (emailInput) emailInput.value = extraRouteEmails(state.settings.email).join(", ");
  renderBlockedTutors();
  renderCalendar();
  updatePlanLabels();
}

function readSettingsTime(input, fallback) {
  const value = String(input?.value || "").trim();
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function readSettingsIntoState() {
  const office = formatPostcode(officeInput?.value || "");
  if (office) state.settings.officePostcode = office;
  state.settings.startTime = readSettingsTime(
    startInput,
    state.settings.startTime || "10:00",
  );
  state.settings.lunchStart = readSettingsTime(
    lunchInput,
    state.settings.lunchStart || "12:30",
  );
  state.settings.returnBy = readSettingsTime(
    returnInput,
    state.settings.returnBy || "16:45",
  );
  const stay = Number(stayInput?.value);
  if (Number.isFinite(stay) && stay > 0) state.settings.stayMinutes = stay;
  const call = Number(callInput?.value);
  if (Number.isFinite(call) && call >= 0) state.settings.callMinutes = call;
  if (skipTodayInput) state.settings.skipToday = skipTodayInput.checked;
  if (emailInput) state.settings.email = extraRouteEmails(emailInput.value).join(", ");
}

function currentPlannerSettings() {
  readSettingsIntoState();
  const lunchStart = parseTimeToMinutes(state.settings.lunchStart);
  return {
    ...DEFAULT_SETTINGS,
    officePostcode: state.settings.officePostcode,
    startMinutes: parseTimeToMinutes(state.settings.startTime),
    lunchStart,
    lunchEnd: lunchStart + 30,
    returnBy: parseTimeToMinutes(state.settings.returnBy),
    stayMinutes: state.settings.stayMinutes,
    callMinutes: state.settings.callMinutes ?? 60,
    phoneReviewMinutes: 20,
    skipToday: Boolean(state.settings.skipToday),
    workingDates: Array.isArray(state.settings.workingDates)
      ? state.settings.workingDates
      : [],
    blockedTutors: Array.isArray(state.settings.blockedTutors)
      ? state.settings.blockedTutors
      : [],
    awaitingReply: state.awaitingReply || {},
    holdOffIds: reviewWaitingLearners().map((learner) => learner.id),
  };
}

function selectedWorkingDateKeys(now = new Date()) {
  if (state.settings.workingDates?.length) {
    return [...new Set(state.settings.workingDates)].sort();
  }
  return defaultWorkingDateKeys(now, currentPlannerSettings());
}

function reviewDoneDateKeysForLearner(learner) {
  const keys = new Set();
  for (const entry of learner?.reviewHistory || []) {
    const key = normaliseDateKey(entry.actualDateKey || entry.dateKey);
    if (key) keys.add(key);
  }
  const last = lastReviewDateKey(learner);
  if (last) keys.add(last);
  const completed = normaliseDateKey(learner?.completedOn);
  if (completed) keys.add(completed);
  return keys;
}

function reviewsDoneOnDate(dateKey) {
  const key = normaliseDateKey(dateKey);
  if (!key) return [];
  const seen = new Set();
  const rows = [];
  const add = (learner) => {
    if (!learner?.id || seen.has(learner.id) || isTestLearner(learner)) return;
    seen.add(learner.id);
    rows.push(learner);
  };
  for (const learner of catalogueLearners()) {
    if (reviewDoneDateKeysForLearner(learner).has(key)) add(learner);
  }
  for (const review of state.savedReviews || []) {
    if (normaliseDateKey(review.visitDateKey) !== key) continue;
    add(reviewLearner(state, review.learnerId));
  }
  for (const id of completedRouteIds(key)) {
    add(
      catalogueLearners().find((item) => item.id === id) ||
        (state.acceptedRoutes?.[key]?.stops || []).find((item) => item.id === id),
    );
  }
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  if (key >= todayKey) {
    const verified = new Set(state.verifiedByDate?.[key] || []);
    const doneIds = new Set(completedRouteIds(key));
    return rows
      .filter((learner) => {
        if (verified.has(learner.id) || doneIds.has(learner.id)) return true;
        return (state.savedReviews || []).some(
          (item) =>
            item.learnerId === learner.id &&
            normaliseDateKey(item.visitDateKey) === key,
        );
      })
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }
  return rows.sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || "")),
  );
}

function lookbackPlanDay(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return null;
  const done = reviewsDoneOnDate(dateKey);
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  return {
    dateKey,
    date,
    day: weekdayName(date) || date.toLocaleDateString("en-GB", { weekday: "long" }),
    available: false,
    accepted: false,
    lookback: Boolean(done.length && dateKey < todayKey),
    skipReason: "",
    stops: [],
    phoneStops: [],
    completedReviews: done,
    extraCompleted: done,
    completedIds: new Set(done.map((item) => item.id)),
    reviewCount: done.length,
    returnTravel: 0,
    returnArrive: 0,
    driveTotal: 0,
    leaveMinutes: 0,
    startMinutes: 0,
  };
}

function attachCompletedReviews(day) {
  if (!day?.dateKey) return day;
  const done = reviewsDoneOnDate(day.dateKey);
  const onRoute = new Set(
    [...(day.stops || []), ...(day.phoneStops || [])].map((stop) => stop.id),
  );
  const liveRound = Boolean(
    (day.available || day.accepted) &&
      (day.stops?.length || day.phoneStops?.length),
  );
  return {
    ...day,
    completedReviews: done,
    completedIds: new Set(done.map((item) => item.id)),
    extraCompleted: done.filter((item) => !onRoute.has(item.id)),
    lookback:
      Boolean(day.lookback) ||
      (day.dateKey < toDateKey(startOfLocalDay(new Date())) &&
        !liveRound &&
        !day.available &&
        !day.accepted &&
        done.length),
  };
}

function displayPlanDay(dateKey = uiState.selectedDateKey) {
  const live = uiState.planResult?.days?.find((item) => item.dateKey === dateKey) || null;
  const route = state.acceptedRoutes?.[dateKey];
  const routeHasStops = Boolean(route?.stops?.length || route?.phoneStops?.length);
  const liveHasStops = Boolean(live?.stops?.length || live?.phoneStops?.length);
  let day = live;
  if (routeHasStops && !liveHasStops) {
    const fallback = lookbackPlanDay(dateKey) || {};
    day = {
      ...fallback,
      ...(live || {}),
      ...route,
      dateKey,
      date: live?.date || fallback.date,
      day: live?.day || route.day || fallback.day,
      accepted: true,
      available: live?.available ?? Boolean(live),
      skipReason: "",
      stops: route.stops || [],
      phoneStops: route.phoneStops || [],
    };
  }
  if (day) return attachCompletedReviews(day);
  if (dateKey) return attachCompletedReviews(lookbackPlanDay(dateKey));
  return null;
}

function confirmedReviewIds(dateKey) {
  const ids = new Set(state.verifiedByDate?.[dateKey] || []);
  for (const learner of state.learners || []) {
    if (normaliseAppointment(learner.appointment)?.dateKey === dateKey) {
      ids.add(learner.id);
    }
  }
  const day = uiState.planResult?.days?.find((item) => item.dateKey === dateKey);
  if (day) {
    const verified = verifiedIds(state.verifiedByDate, dateKey);
    for (const stop of day.stops || []) {
      if (isConfirmedStop(stop, verified)) ids.add(stop.id);
    }
  }
  for (const learner of reviewsDoneOnDate(dateKey)) ids.add(learner.id);
  return ids;
}

function confirmedReviewCount(dateKey) {
  return confirmedReviewIds(dateKey).size;
}

function findSelectedPlanDay(days = uiState.planResult?.days) {
  if (!days?.length) return null;
  if (uiState.selectedDateKey) {
    return days.find((day) => day.dateKey === uiState.selectedDateKey) || null;
  }
  return days.find((day) => day.day === uiState.selectedDay) || null;
}

function rememberSelectedDay(day) {
  if (!day) return;
  uiState.selectedDay = day.day;
  uiState.selectedDateKey = day.dateKey || toDateKey(day.date);
  const date = dateFromKey(uiState.selectedDateKey);
  if (
    date &&
    (date.getMonth() !== uiState.calendarMonth.getMonth() ||
      date.getFullYear() !== uiState.calendarMonth.getFullYear())
  ) {
    uiState.calendarMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  renderCalendar();
}

function showBookedDayOnPlan(date, dateKey) {
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  if (dateKey && dateKey >= todayKey) {
    state.settings.workingDates = [dateKey];
  }
  rememberSelectedDay({
    day: weekdayName(date || dateFromKey(dateKey)),
    dateKey,
    date: date || dateFromKey(dateKey),
  });
  scheduleStateSave();
  updatePlanLabels();
}

async function placeAppointmentOnPlan(
  learner,
  dateKey,
  date,
  message,
  { fillGaps = true, announce = true, render = true } = {},
) {
  removeLearnerFromRoutes(learner.id);
  if (!state.pinnedRoutes) state.pinnedRoutes = {};
  if (!state.pinnedRoutes[dateKey]) state.pinnedRoutes[dateKey] = [];
  if (!state.pinnedRoutes[dateKey].includes(learner.id)) {
    state.pinnedRoutes[dateKey].push(learner.id);
  }
  showBookedDayOnPlan(date, dateKey);
  uiState.highlightedStopId = learner.id;
  hydrateLocatedLearners();
  try {
    const planned = await planTheWeek({ resetSelection: false, fillGaps, render });
    if (planned === false) return false;
  } catch (error) {
    if (announce) {
      setStatus(
        error.message ||
          "Booked the time, but could not refresh that day’s route.",
      );
    }
    planButton.disabled = false;
    return false;
  }
  if (announce) setStatus(message);
  if (render) {
    requestAnimationFrame(() => {
      dayDetail
        ?.querySelector(".stop.found")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }
  return true;
}

function stopFoundClass(stopId) {
  return stopId && stopId === uiState.highlightedStopId ? " found" : "";
}

function saveStopContactDetails(learnerId) {
  const learner = findEditableLearner(learnerId);
  const box = dayDetail?.querySelector(
    `[data-stop-contact="${learnerId}"] .stop-contact:not(.is-locked)`,
  );
  if (!learner || !box) return;
  applyLearnerProfile(learner, {
    ...learner,
    employerContact: box.querySelector('[data-stop-contact-field="employerContact"]')?.value || "",
    contactNumber: box.querySelector('[data-stop-contact-field="contactNumber"]')?.value || "",
    employerEmail: box.querySelector('[data-stop-contact-field="employerEmail"]')?.value || "",
  });
  const nextPostcode = formatPostcode(
    box.querySelector('[data-stop-contact-field="postcode"]')?.value || "",
  );
  let postcodeChanged = false;
  if (!isLikelyUkPostcode(nextPostcode)) {
    setStatus("Enter a valid UK postcode.");
  } else if (postcodeLookupKey(nextPostcode) !== postcodeLookupKey(learner.postcode)) {
    learner.postcode = nextPostcode;
    postcodeChanged = true;
  } else {
    learner.postcode = nextPostcode;
  }
  scheduleStateSave();
  if (
    postcodeChanged &&
    state.learners.some((item) => item.id === learnerId)
  ) {
    refreshPlannedWeek({ rebuild: true, fillGaps: false });
  }
}

function toggleStopContactLock(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  if (!learner.contactLocked) saveStopContactDetails(learnerId);
  learner.contactLocked = !learner.contactLocked;
  scheduleStateSave();
  renderPlan({ refreshMap: false });
  setStatus(
    learner.contactLocked
      ? `Locked the employer contact for ${learner.name}.`
      : `Unlocked the employer contact for ${learner.name}.`,
  );
}

function alreadyPlanned() {
  return Boolean(
    uiState.planCache ||
    uiState.planResult ||
    Object.keys(state.pinnedRoutes || {}).length ||
    Object.keys(state.acceptedRoutes || {}).length,
  );
}

function refreshPlannedWeek({
  rebuild = false,
  resetSelection = false,
  freshPack = false,
  fillGaps = false,
  render = true,
} = {}) {
  if (!state.learners.length || !alreadyPlanned()) return Promise.resolve();
  if (!rebuild && !freshPack && !fillGaps && uiState.planCache) {
    applyCurrentPlan({
      resetSelection,
      updateStatus: true,
      refreshMap: true,
      fillGaps,
      render,
    });
    return Promise.resolve();
  }
  return planTheWeek({ resetSelection, freshPack, fillGaps, render }).catch((error) => {
    setStatus(error.message || "Could not refresh the week.");
    planButton.disabled = false;
  });
}

function refreshLivePlan({ updateStatus = true } = {}) {
  uiState.lastSignature = "";
  renderLearners();
  if (uiState.planCache) {
    applyCurrentPlan({
      updateStatus,
      refreshMap: true,
    });
    return;
  }
  if (alreadyPlanned()) {
    refreshPlannedWeek({ rebuild: true });
    return;
  }
  if (uiState.planResult) {
    renderPlan({ refreshMap: true });
  }
}

function setStatus(message) {
  if (statusEl) {
    statusEl.hidden = !message;
    statusEl.textContent = message;
  }
  if (outStatus) {
    outStatus.hidden = !message;
    outStatus.textContent = message;
  }
}

function prioritySelect(learner, { stacked = false } = {}) {
  const current = planningPriority(learner);
  const label = escapeHtml(reviewPriorityLabel(learner));
  const dateLabel = stacked ? formatShortNumericDate(reviewDueStatus(learner).next) : "";
  if (!dateLabel) {
    return `<span class="pill priority-trigger static ${current}">${label}</span>`;
  }
  return `<span class="pill priority-trigger static is-stacked ${current}"><span class="pill-main">${label}</span><span class="pill-sub"><span class="visually-hidden">Review due </span>${escapeHtml(dateLabel)}</span></span>`;
}

function stopPriorityLabel(stop) {
  const id = normalisePriority(stop.priority);
  if (id === "overdue" && Number(stop.daysUntil) < 0) {
    return `Overdue · ${formatWeeksAndDays(stop.daysUntil)}`;
  }
  return priorityLabel(id);
}

function snapHoldMinutes(totalMinutes) {
  const snapped = Math.round(Number(totalMinutes) / 15) * 15;
  return Math.max(0, Math.min(23 * 60 + 45, snapped));
}

function lockIconMarkup(locked) {
  if (locked) {
    return `<svg class="lock-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M17 8h-1V6a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6-2a2 2 0 1 1 4 0v2h-4V6zm6 14H7V10h10v10z"/></svg>`;
  }
  return `<svg class="lock-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M17 8h-1V6a4 4 0 0 0-8 0h2a2 2 0 1 1 4 0v2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM7 20V10h10v10H7z"/></svg>`;
}

function revealOpenTimePicker() {
  if (!uiState.openTimePickerId) return;
  const picker = dayDetail.querySelector(
    `[data-time-picker="${uiState.openTimePickerId}"]`,
  );
  if (!picker) return;
  placeTimeMenu(picker);
  scrollTimeListToSelected(picker);
}

function scrollTimeListToSelected(picker) {
  const selected = picker?.querySelector(
    "[data-time-hour][aria-selected='true']",
  );
  const list = selected?.closest(".time-list");
  if (!selected || !list) return;
  list.scrollTop = Math.max(
    0,
    selected.offsetTop - (list.clientHeight - selected.offsetHeight) / 2,
  );
}

function placeTimeMenu(picker) {
  if (!picker) return;
  picker.classList.remove("drop-up");
  const trigger = picker.querySelector("[data-time-trigger]");
  const menu = picker.querySelector(".time-menu");
  if (!trigger || !menu) return;
  const triggerBox = trigger.getBoundingClientRect();
  const mapBox = document.querySelector("#map")?.getBoundingClientRect();
  const menuHeight = menu.offsetHeight || 220;
  const gap = 12;
  const floor = mapBox?.top ?? window.innerHeight;
  const spaceBelow = floor - triggerBox.bottom - gap;
  const spaceAbove = triggerBox.top - gap;
  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
    picker.classList.add("drop-up");
  }
}

function closeTimePickers(except) {
  uiState.openTimePickerId = except?.dataset.timePicker || "";
  dayDetail.querySelectorAll("[data-time-picker]").forEach((picker) => {
    if (picker === except) return;
    picker.classList.remove("open", "drop-up");
    picker.querySelector("[data-time-trigger]")?.setAttribute("aria-expanded", "false");
    const menu = picker.querySelector(".time-menu");
    if (menu) menu.hidden = true;
  });
  if (!except) uiState.openTimePickerId = "";
}

function toggleTimePicker(picker) {
  if (!picker) return;
  const willOpen = !picker.classList.contains("open");
  closeTimePickers();
  if (!willOpen) return;
  uiState.openTimePickerId = picker.dataset.timePicker || "";
  picker.classList.add("open");
  picker.querySelector("[data-time-trigger]")?.setAttribute("aria-expanded", "true");
  const menu = picker.querySelector(".time-menu");
  if (menu) menu.hidden = false;
  placeTimeMenu(picker);
  scrollTimeListToSelected(picker);
}

function setPhoneReviewDay(learnerId, dayName) {
  const learner = state.learners.find((item) => item.id === learnerId);
  if (!learner || !WEEKDAYS.includes(dayName)) return;
  learner.phoneReview = true;
  learner.phoneReviewDay = dayName;
  writeLearnerAppointment(learner, null);
  touchLearner(learner);
  removeFrozenTimesForLearner(learnerId);
  uiState.phoneEditorId = "";
  scheduleStateSave();
  renderLearners();
  refreshPlannedWeek({ rebuild: true, freshPack: true });
  setStatus(
    `${learner.name}: ${dayName} is now a 20-minute phone review at the start of the day.`,
  );
}

function clearPhoneReview(learnerId) {
  const learner = state.learners.find((item) => item.id === learnerId);
  if (!learner) return;
  learner.phoneReview = false;
  learner.phoneReviewDay = "";
  uiState.phoneEditorId = "";
  scheduleStateSave();
  renderLearners();
  refreshPlannedWeek({ rebuild: true, freshPack: true });
  setStatus(
    `${learner.name}: college ${learner.collegeDay} is a college day again, so they will not be visited then.`,
  );
}

function phoneReviewEditor(learner) {
  if (uiState.phoneEditorId !== learner.id) return "";
  const selected = phoneReviewDay(learner);
  const days = WEEKDAYS.map((day) => {
    const college = day === learner.collegeDay;
    const on = day === selected;
    return `<button type="button" class="btn pill ${on ? "on" : "ghost"}" data-phone-day="${day}" aria-pressed="${on ? "true" : "false"}">${day.slice(0, 3)}${college ? " college" : ""}</button>`;
  }).join("");
  return `
    <div class="phone-form" data-phone-form="${learner.id}">
      <p class="meta">Pick the weekday for the 20-minute phone review. It goes first that morning, then the site visits. College is labelled so you can still choose it if that is when they want the call.</p>
      <div class="employer-days">${days}</div>
      ${
        isPhoneReview(learner)
          ? `<div class="appointment-form-actions">
        <button type="button" class="btn pill danger" data-phone-clear="${learner.id}">Cancel phone review</button>
      </div>`
          : ""
      }
    </div>
  `;
}

function concernChip(learner) {
  if (!isConcernLearner(learner)) return "";
  return `<span class="pill status-chip high">Concern · ${CONCERN_INTERVAL_WEEKS} weeks</span>`;
}

function concernButton(learner) {
  const on = isConcernLearner(learner);
  return `<button type="button" class="btn pill ${on ? "primary" : "ghost"}" data-learner-concern="${escapeHtml(learner.id)}" aria-pressed="${on ? "true" : "false"}">${on ? `Concern · ${CONCERN_INTERVAL_WEEKS} weeks` : "Concern"}</button>`;
}

function safeguardingPill(learner) {
  if (!learner?.id) return "";
  const signed = Boolean(learner.safeguardingSigned);
  return `<button type="button" class="btn pill safeguarding-pill ${signed ? "is-signed" : "is-missing"}" data-safeguarding="${escapeHtml(learner.id)}" aria-pressed="${signed ? "true" : "false"}">Safeguarding</button>`;
}

function toggleSafeguarding(learnerId) {
  const learner = findEditableLearner(learnerId);
  if (!learner) return;
  if (uiState.dirtyDetails && uiState.dirtyDetails.learnerId === learnerId && !flushDirtyDetails()) return;
  learner.safeguardingSigned = !learner.safeguardingSigned;
  touchLearner(learner);
  logAction({
    type: "edited",
    learner,
    label: learner.safeguardingSigned ? "Safeguarding signed" : "Safeguarding missing",
  });
  scheduleStateSave();
  refreshLearnerSurfaces();
  if (uiState.currentPage === "reviews") renderReviews();
  setStatus(
    learner.safeguardingSigned
      ? `${learner.name}: safeguarding paperwork signed.`
      : `${learner.name}: safeguarding paperwork marked missing.`,
  );
}

function noticeChip(learner) {
  const due = reviewDueStatus(learner);
  if (!due.notice || due.state === "overdue") return "";
  if (due.noticeState === "ok") return "";
  const cls = due.noticeState === "due" || due.noticeState === "today" ? "high" : "round";
  const label =
    due.noticeState === "today"
      ? `Tell tutors today · ${formatDateKeyLabel(due.notice)}`
      : due.noticeState === "due"
        ? `Tell tutors · ${formatDateKeyLabel(due.notice)}`
        : `Tell tutors ${formatDateKeyLabel(due.notice)}`;
  return `<span class="pill status-chip ${cls}">${escapeHtml(label)}</span>`;
}

function reviewMeta(learner) {
  const due = reviewDueStatus(learner);
  if (!due.next) {
    return `<div class="meta">Add a planned review date so booking and overdue time can be tracked.</div>`;
  }
  const span = formatDueSpan(due);
  if (due.window === "behind") {
    return `<div class="meta">${escapeHtml(span)}. Next needed ${escapeHtml(formatNextNeededSpan(due))}.</div>`;
  }
  return `<div class="meta">${escapeHtml(span)}.</div>`;
}

function saveLastReview(learnerId) {
  const learner = findEditableLearner(learnerId);
  const formEl = learnerFormEl(`[data-review-form="${cssEscape(learnerId)}"]`);
  if (!learner || !formEl) return;
  const dateKey = formEl.querySelector("[data-review-date]")?.value;
  const plannedDateKey = formEl.querySelector("[data-review-planned]")?.value;
  const attended = reviewAttendedFor(
    learner,
    formEl.querySelector("[data-review-attended]")?.value,
  );
  if (!dateKey) {
    setStatus("Pick the actual review date first.");
    return;
  }
  recordReview(
    learner,
    { plannedDateKey, actualDateKey: dateKey, attended },
    "entered",
  );
  uiState.reviewEditorId = "";
  scheduleStateSave();
  renderLearners();
  refreshPlannedWeek({ rebuild: true, fillGaps: true });
  const next = nextReviewDateKey(learner);
  const nextDate = next ? dateFromKey(next) : null;
  const weekendNote =
    nextDate && !isWeekdayDate(nextDate)
      ? ` That falls on a ${nextDate.toLocaleDateString("en-GB", { weekday: "long" })}, so book a nearby weekday.`
      : "";
  setStatus(
    `${learner.name}: actual ${formatDateKeyLabel(dateKey)}${plannedDateKey ? `, planned ${formatDateKeyLabel(plannedDateKey)}` : ""}. Next planned date ${formatDateKeyLabel(next)}.${weekendNote}`,
  );
}

function clearLastReview(learnerId) {
  const learner = state.learners.find((item) => item.id === learnerId);
  if (!learner) return;
  learner.lastReviewDate = "";
  learner.reviewHistory = [];
  uiState.reviewEditorId = "";
  scheduleStateSave();
  renderLearners();
  refreshPlannedWeek({ rebuild: true, fillGaps: true });
  setStatus(`Cleared the review dates for ${learner.name}.`);
}

function fillReviewsTutorFilter(people) {
  if (!reviewsTutorFilter || tutorMode) return;
  const current = normaliseTutor(reviewsTutorFilter.value);
  const unset = (people || []).some((item) => !learnerTutorName(item));
  const options = [
    `<option value="">All tutors</option>`,
    ...knownTutors().map(
      (name) => `<option value="${escapeHtml(name)}">${escapeHtml(tutorLabel(name))}</option>`,
    ),
  ];
  if (unset) options.push(`<option value="__none__">No tutor set</option>`);
  reviewsTutorFilter.innerHTML = options.join("");
  const valid = [...reviewsTutorFilter.options].some((option) => option.value === current);
  reviewsTutorFilter.value = valid ? current : "";
}

function syncAppointmentPins(now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  let changed = false;
  if (!state.pinnedRoutes) state.pinnedRoutes = {};
  for (const learner of [...(state.learners || []), ...(state.followUps || [])]) {
    const appointment = normaliseAppointment(learner.appointment);
    if (!appointment || appointment.dateKey < todayKey) continue;
    const dateKey = appointment.dateKey;
    if ((state.excludedFromDate?.[dateKey] || []).includes(learner.id)) continue;
    if (!state.pinnedRoutes[dateKey]) state.pinnedRoutes[dateKey] = [];
    if (!state.pinnedRoutes[dateKey].includes(learner.id)) {
      state.pinnedRoutes[dateKey].push(learner.id);
      changed = true;
    }
    for (const [otherKey, ids] of Object.entries(state.pinnedRoutes)) {
      if (otherKey === dateKey || otherKey < todayKey) continue;
      if ((state.verifiedByDate?.[otherKey] || []).includes(learner.id)) continue;
      if (state.acceptedRoutes?.[otherKey]) continue;
      if (!(ids || []).includes(learner.id)) continue;
      const next = ids.filter((id) => id !== learner.id);
      if (next.length) state.pinnedRoutes[otherKey] = next;
      else delete state.pinnedRoutes[otherKey];
      changed = true;
    }
  }
  return changed;
}

function dedupePlacedLearners(now = new Date()) {
  const todayKey = toDateKey(startOfLocalDay(now));
  const keep = new Map();
  const consider = (dateKey, id) => {
    if (!id || !dateKey || dateKey < todayKey) return;
    const learner =
      state.learners.find((item) => item.id === id) ||
      (state.followUps || []).find((item) => item.id === id);
    const booked = normaliseAppointment(learner?.appointment)?.dateKey;
    if (booked && booked >= todayKey) {
      keep.set(id, booked);
      return;
    }
    const current = keep.get(id);
    if (!current || dateKey < current) keep.set(id, dateKey);
  };
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    for (const id of ids || []) consider(dateKey, id);
  }
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    for (const id of ids || []) consider(dateKey, id);
  }
  for (const [dateKey, route] of Object.entries(state.acceptedRoutes || {})) {
    for (const stop of [...(route?.stops || []), ...(route?.phoneStops || [])]) {
      consider(dateKey, stop.id);
    }
  }
  let changed = false;
  const keepOnDate = (dateKey, id) =>
    dateKey < todayKey || keep.get(id) === dateKey;
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    const next = (ids || []).filter((id) => keepOnDate(dateKey, id));
    if (next.length !== (ids || []).length) {
      if (next.length) state.pinnedRoutes[dateKey] = next;
      else delete state.pinnedRoutes[dateKey];
      changed = true;
    }
  }
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    const next = (ids || []).filter((id) => keepOnDate(dateKey, id));
    if (next.length !== (ids || []).length) {
      state.verifiedByDate[dateKey] = next;
      changed = true;
    }
  }
  for (const [dateKey, route] of Object.entries(state.acceptedRoutes || {})) {
    if (!route || dateKey < todayKey) continue;
    const stops = (route.stops || []).filter((stop) => keepOnDate(dateKey, stop.id));
    const phoneStops = (route.phoneStops || []).filter((stop) =>
      keepOnDate(dateKey, stop.id),
    );
    if (
      stops.length !== (route.stops || []).length ||
      phoneStops.length !== (route.phoneStops || []).length
    ) {
      route.stops = stops;
      route.phoneStops = phoneStops;
      if (!stops.length && !phoneStops.length) delete state.acceptedRoutes[dateKey];
      changed = true;
    }
  }
  for (const [dateKey, times] of Object.entries(state.frozenTimes || {})) {
    if (dateKey < todayKey || !times) continue;
    for (const id of Object.keys(times)) {
      if (keepOnDate(dateKey, id)) continue;
      delete times[id];
      changed = true;
    }
    if (!Object.keys(times).length) delete state.frozenTimes[dateKey];
  }
  return changed;
}

function refreshLearnerCatalogues() {
  refreshAddLearnerCombos();
  renderBlockedTutors();
}

function renderBlockedTutors() {
  const box = document.querySelector("#blocked-tutors");
  if (!box) return;
  const blocked = new Set((state.settings.blockedTutors || []).map(tutorLookupKey));
  const tutors = knownTutors();
  if (!tutors.length) {
    box.innerHTML = `<p class="meta">Tutors appear here once they are on a learner.</p>`;
    return;
  }
  box.innerHTML = tutors
    .map((name) => {
      const key = tutorLookupKey(name);
      const on = blocked.has(key);
      const trade = tutorRecord(name)?.trade || "";
      return `<label class="app-check settings-tutor-row"><input type="checkbox" data-block-tutor="${escapeHtml(key)}" ${on ? "checked" : ""} /><span class="app-check-box" aria-hidden="true"></span><span class="settings-tutor-copy"><strong>${escapeHtml(tutorLabel(name))}</strong>${trade ? `<span class="meta">${escapeHtml(trade)}</span>` : ""}</span></label>`;
    })
    .join("");
}

function pageFromHash() {
  if (location.hash === "#plan") return "plan";
  if (location.hash === "#out") return "out";
  if (location.hash === "#reviews") return "reviews";
  if (location.hash === "#archive") return "archive";
  if (location.hash === "#analytics") return "analytics";
  return "records";
}

function pageHash(page) {
  if (page === "plan") return "#plan";
  if (page === "out") return "#out";
  if (page === "reviews") return "#reviews";
  if (page === "archive") return "#archive";
  if (page === "analytics") return "#analytics";
  return "#learners";
}

function knownPage(page) {
  return page === "plan" ||
    page === "out" ||
    page === "reviews" ||
    page === "archive" ||
    page === "analytics"
    ? page
    : "records";
}

function currentLogActor() {
  const email = String(signedInSession?.user?.email || "").trim();
  const tutor = tutorFromEmail(email);
  const meta = signedInSession?.user?.user_metadata || {};
  const metaName = String(meta.full_name || meta.name || "").trim();
  if (tutorMode || tutor) {
    return {
      name: tutor?.name || metaName || "Tutor",
      email,
      role: "tutor",
    };
  }
  const staff = staffFromEmail(email);
  if (officeMode || staff) {
    return {
      name: staff?.name || metaName || "Administration",
      email,
      role: "office",
    };
  }
  return {
    name: metaName || DEFAULT_GTA_REVIEWER,
    email,
    role: "reviewer",
  };
}

function holdReview(reviewId, status) {
  const review = setReviewHolder(state, reviewId, status);
  const type = ANALYTICS_EVENT_BY_STATUS[status];
  if (type && review?.learnerId) {
    recordAnalyticsEvent(state, {
      type,
      learnerId: review.learnerId,
      reviewId: review.id,
      at: type === "sent" ? review.sentAt : undefined,
      actor: currentLogActor(),
    });
  }
  return review;
}

function logCycleBooked(learner) {
  const pack = stampCycleBooked(state, learner);
  if (learner?.id) {
    recordAnalyticsEvent(state, {
      type: "booked",
      learnerId: learner.id,
      reviewId: pack?.id || "",
      actor: currentLogActor(),
    });
  }
  return pack;
}

function planDayLogLabel(dateKey = uiState.selectedDateKey) {
  const key = dateKey || selectedWorkingDateKeys()[0] || "";
  const date = dateFromKey(key);
  if (date) return `${weekdayName(date)} ${formatDateKeyLabel(key)}`;
  return "Selected day";
}

function logAction({ type, learner, reviewId, label } = {}) {
  return recordAnalyticsEvent(state, {
    type,
    learnerId: learner?.id || "",
    reviewId: reviewId || "",
    label: label || learner?.name || "",
    actor: currentLogActor(),
  });
}

mountOutRound();

function setPage(page, { skipHash = false } = {}) {
  if (uiState.dirtyDetails && !flushDirtyDetails()) return;
  const nextPage = gatedPage(knownPage(page), {
    tutorMode,
    officeMode,
    adminMode,
    phoneOut: phoneOutMode(),
    outEnabled: outPageEnabled(),
  });
  if (uiState.currentPage === "out" && nextPage !== "out") flushOutDraft();
  uiState.currentPage = nextPage;
  if (pageRecords) pageRecords.hidden = uiState.currentPage !== "records";
  if (pagePlan) pagePlan.hidden = uiState.currentPage !== "plan";
  if (pageOut) pageOut.hidden = uiState.currentPage !== "out";
  if (pageReviews) pageReviews.hidden = uiState.currentPage !== "reviews";
  if (pageArchive) pageArchive.hidden = uiState.currentPage !== "archive";
  if (pageAnalytics) pageAnalytics.hidden = uiState.currentPage !== "analytics";
  if (ledeReviews) ledeReviews.hidden = true;
  if (ledeAnalytics) ledeAnalytics.hidden = true;
  document.querySelectorAll("[data-nav-page]").forEach((button) => {
    button.classList.toggle("on", button.dataset.navPage === uiState.currentPage);
  });
  if (!skipHash) {
    const hash = pageHash(uiState.currentPage);
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }
  document.querySelector(".app-shell")?.classList.toggle("records-wide", uiState.currentPage !== "plan");
  document.querySelector(".app-shell")?.classList.toggle("plan-wide", uiState.currentPage === "plan");
  if (uiState.currentPage === "records") renderRecords();
  if (uiState.currentPage === "archive") renderArchiveHistory();
  if (uiState.currentPage === "reviews") {
    prefetchReviewTemplate();
    renderReviews({ sync: true });
  }
  if (uiState.currentPage === "analytics") renderAnalytics();
  else {
    uiState.analyticsView = "summary";
    uiState.analyticsSide = "reviews";
  }
  if (uiState.currentPage === "plan") {
    renderCalendar();
    setTimeout(() => uiState.map?.invalidateSize(), 80);
  }
  if (uiState.currentPage === "out") {
    renderOut();
    ensureOutPlan().then(() => {
      if (uiState.currentPage === "out") renderOut();
    });
  }
}

function reviewDateLabel(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return dateKey;
  return `${weekdayName(date)} ${formatUkDateKey(dateKey)}`;
}

function syncPlannedReviews({ quiet = false } = {}) {
  const created = saveReviewsFromPlan(state);
  if (created) scheduleStateSave();
  if (!quiet) {
    setStatus(
      created
        ? `Saved ${created} planned review${created === 1 ? "" : "s"} for sending.`
        : "Every planned date already has a saved review.",
    );
  }
  renderReviews();
  return created;
}

function collectReviewTargets(formEl, kind) {
  return [...formEl.querySelectorAll(`[data-target-row="${cssEscape(kind)}"]`)].map((row) => ({
    id: row.dataset.targetId,
    action: row.querySelector('[data-target-field="action"]')?.value || "",
    owner: row.querySelector('[data-target-field="owner"]')?.value || "",
    measure: row.querySelector('[data-target-field="measure"]')?.value || "",
    targetDate: row.querySelector('[data-target-field="target-date"]')?.value || "",
    status: row.querySelector('[data-target-field="status"]')?.value || "open",
  }));
}

function saveReviewTargets(reviewId, extraTargets) {
  const formEl = reviewsList?.querySelector(`[data-review-targets="${cssEscape(reviewId)}"]`);
  if (!formEl) return;
  const previousTargets = collectReviewTargets(formEl, "previous").slice(
    0,
    REVIEW_TARGET_SLOTS,
  );
  const collectedNew = collectReviewTargets(formEl, "new");
  const merged = extraTargets ? [...collectedNew, ...extraTargets] : collectedNew;
  if (extraTargets && collectedNew.length >= REVIEW_TARGET_SLOTS) {
    setStatus(`The form only has ${REVIEW_TARGET_SLOTS} new target rows.`);
    return;
  }
  const newTargets = padTargets(merged, REVIEW_TARGET_SLOTS);
  const saved = updateSavedReview(state, reviewId, { previousTargets, newTargets });
  if (saved) {
    uiState.openReviewLearnerIds.add(saved.learnerId);
    refreshCarriedTargets(state, saved.learnerId);
  }
  scheduleStateSave();
  renderReviews();
  setStatus("Saved targets for this review. They will carry forward next time.");
}

function reviewsTodayKey() {
  return toDateKey(startOfLocalDay(new Date()));
}

function managedLiveLearners() {
  return managedLearnerRows()
    .map(({ item }) => item)
    .filter((item) => !isTestLearner(item));
}

function backfillReviewMethods() {
  let changed = false;
  for (const list of [state.learners, state.followUps, state.archive]) {
    for (const item of list || []) {
      if (ensureHistoryAttended(item)) changed = true;
    }
  }
  return changed;
}

function renderAnalytics() {
  if (!analyticsBody) return;
  let changed = archiveSettledCycles(state, managedLiveLearners());
  if (backfillReviewMethods()) changed = true;
  const reportSync = ensureAnalyticsReports(state);
  const createdReports = reportSync.created || [];
  if (reportSync.changed) changed = true;
  if (changed) scheduleStateSave();
  const stats = buildReviewAnalytics(state, { rangeId: uiState.analyticsRange });
  analyticsBody.innerHTML = analyticsPageHtml(stats, { view: uiState.analyticsView, side: uiState.analyticsSide });
  const title = pageAnalytics?.querySelector(".panel-head h2");
  if (title) {
    title.textContent =
      uiState.analyticsView === "movement"
        ? "Review Log"
        : uiState.analyticsSide === "tutors"
          ? "Tutor analytics"
          : "Review analytics";
  }
  if (analyticsCount) {
    analyticsCount.textContent =
      uiState.analyticsView === "movement"
        ? String(stats.recent.length)
        : uiState.analyticsSide === "tutors"
          ? String(stats.tutors?.length || 0)
          : String(stats.learners);
  }
  const movementBtn = document.querySelector("#analytics-movement-btn");
  if (movementBtn) {
    movementBtn.hidden = uiState.analyticsSide === "tutors";
    movementBtn.textContent = uiState.analyticsView === "movement" ? "Back" : "Review Log";
  }
  document.querySelectorAll("[data-analytics-side]").forEach((button) => {
    const on = button.dataset.analyticsSide === uiState.analyticsSide && uiState.analyticsView !== "movement";
    button.classList.toggle("on", on);
    button.classList.toggle("ghost", !on);
  });
  document.querySelectorAll("[data-analytics-range]").forEach((button) => {
    button.classList.toggle("on", button.dataset.analyticsRange === uiState.analyticsRange);
    button.classList.toggle("ghost", button.dataset.analyticsRange !== uiState.analyticsRange);
  });
  if (!tutorMode && createdReports.length) {
    requestAnimationFrame(() => maybeEmailNewReports(createdReports));
  }
}

function openReviewsForCompletedDay(dateKey) {
  const key = normaliseDateKey(dateKey);
  if (!key) return;
  uiState.reviewsFilter = "print";
  uiState.reviewsDateFilter = key;
  setPage("reviews");
  renderReviews();
}

function signedInTutor() {
  return tutorFromEmail(signedInSession?.user?.email || "");
}

function learnersAssignedToSignedInTutor() {
  const tutor = signedInTutor();
  if (!tutor) return [];
  const key = tutorLookupKey(tutor.name);
  return managedLearnerRows()
    .filter(({ item, list }) => {
      if (list === "archive") return false;
      if (isTestLearner(item)) return false;
      return tutorLookupKey(learnerTutorName(item)) === key;
    })
    .map(({ item }) => item)
    .sort((a, b) => {
      const aDue = reviewDueStatus(a);
      const bDue = reviewDueStatus(b);
      const aDays = aDue.daysUntilNeeded ?? aDue.daysUntil ?? Number.POSITIVE_INFINITY;
      const bDays = bDue.daysUntilNeeded ?? bDue.daysUntil ?? Number.POSITIVE_INFINITY;
      return aDays - bDays || String(a.name || "").localeCompare(String(b.name || ""));
    });
}

mountTutorPressEffects();

function cycleStepDetailHtml(step) {
  const date = step.stamp || "";
  const extra =
    step.tone === "current" || step.tone === "late" ? step.slaLabel || "" : "";
  const dateHtml = date
    ? `<span class="review-flow-date">${escapeHtml(date)}</span>`
    : "";
  const extraHtml = extra
    ? `<span class="review-flow-note">${escapeHtml(extra)}</span>`
    : "";
  if (dateHtml || extraHtml) {
    return `<span class="review-flow-meta">${dateHtml}${extraHtml}</span>`;
  }
  if (step.tone === "idle") {
    return `<span class="review-flow-meta"><span class="review-flow-empty">Not yet</span></span>`;
  }
  if (step.tone === "done") {
    return `<span class="review-flow-meta"><span class="review-flow-date">Done</span></span>`;
  }
  return `<span class="review-flow-meta"><span class="review-flow-note">In progress</span></span>`;
}

function completedReviewCount(learner) {
  return normaliseReviewHistory(learner?.reviewHistory).length;
}

function reviewCountLabel(count) {
  if (!count) return "No review yet";
  return count === 1 ? "1 review" : `${count} reviews`;
}

function reviewerCycleCardHtml(learner) {
  const flow = reviewFlowState(state, learner);
  const open = uiState.openReviewLearnerIds.has(learner.id);
  const timing = cycleTimingLabel(learner);
  const current = flow.current;
  const reviewCount = completedReviewCount(learner);
  const reviewCountText = reviewCountLabel(reviewCount);
  const pillKind =
    current.tone === "late" ? "late" : current.tone === "current" ? "overdue" : "next";
  const steps = flow.steps
    .map(
      (step) => `
        <li class="review-flow-step is-${escapeHtml(step.tone)}">
          <strong>${escapeHtml(step.label)}</strong>
          ${cycleStepDetailHtml(step)}
        </li>`,
    )
    .join("");
  return `
    <article class="tutor-learner${open ? " is-open" : " is-min"}" data-review-learner="${escapeHtml(learner.id)}" data-search-text="${escapeHtml(`${learnerSearchText(learner)} ${reviewCountText.toLowerCase()}`)}">
      <div class="tutor-learner-row">
        <button type="button" class="tutor-learner-toggle" data-toggle-review-learner aria-expanded="${open ? "true" : "false"}" aria-label="${open ? "Hide review steps" : "Show review steps"}">
          <span aria-hidden="true"></span>
        </button>
        <strong>${escapeHtml(learner.name || "Unnamed learner")}</strong>
        <div class="tutor-learner-pills">
          <span class="archive-timing review-count-pill is-${reviewCount ? "had" : "none"}">${escapeHtml(reviewCountText)}</span>
          <span class="archive-timing is-${escapeHtml(timing.kind)}">${escapeHtml(timing.label)}</span>
          <span class="archive-timing is-${escapeHtml(pillKind)}">${escapeHtml(current.currentLabel || current.label)}</span>
          ${safeguardingPill(learner)}
        </div>
      </div>
      <div class="tutor-learner-details"${open ? "" : " inert"}>
        <div>
          <ol class="review-flow">${steps}</ol>
        </div>
      </div>
    </article>
  `;
}

function renderReviews({ sync = false } = {}) {
  if (!reviewsList) return;
  if (tutorMode) {
    renderTutorReviews();
    return;
  }
  document.body.classList.remove("tutor-review-open");
  const people = managedLearnerRows().map(({ item }) => item);
  let cycleChanged = ensureReviewCycles(state, people);
  cycleChanged = repairCycleReleaseDates(state, people) || cycleChanged;
  cycleChanged = archiveSettledCycles(state, people) || cycleChanged;
  if (cycleChanged) scheduleStateSave();
  if (sync) {
    const created = saveReviewsFromPlan(state);
    if (created) scheduleStateSave();
  }
  fillReviewsTutorFilter(people);
  const tutorKey = reviewsTutorFilter?.value || "";
  const rows = people
    .filter((learner) => {
      const tutor = learnerTutorName(learner);
      if (tutorKey === "__none__" && tutor) return false;
      if (tutorKey && tutorKey !== "__none__" && tutorLookupKey(tutor) !== tutorLookupKey(tutorKey)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aDue = reviewDueStatus(a);
      const bDue = reviewDueStatus(b);
      const aDays = aDue.daysUntilNeeded ?? aDue.daysUntil ?? Number.POSITIVE_INFINITY;
      const bDays = bDue.daysUntilNeeded ?? bDue.daysUntil ?? Number.POSITIVE_INFINITY;
      return aDays - bDays || String(a.name || "").localeCompare(String(b.name || ""));
    });
  const grouped = REVIEW_FLOW_STEPS.map((step) => ({
    ...step,
    rows: rows.filter((learner) => reviewFlowState(state, learner).current.id === step.id),
  })).filter((group) => group.rows.length);
  reviewsList.innerHTML = grouped.length
    ? grouped
        .map(
          (group) => `
      <section class="review-cycle-group">
        <h3 class="reviews-day-heading">${escapeHtml(group.currentLabel || group.label)} · ${group.rows.length}</h3>
        ${group.rows.map(reviewerCycleCardHtml).join("")}
      </section>`,
        )
        .join("")
    : `<p class="empty">${
        tutorKey === "__none__"
          ? "No learners are missing a tutor."
          : tutorKey
            ? `No learners for ${escapeHtml(tutorKey)}.`
            : "No learners yet. Add someone on Learners first."
      }</p>`;
  if (reviewsCount) reviewsCount.textContent = String(rows.length);
  if (reviewsTitle) {
    reviewsTitle.textContent = "Reviews";
  }
  applyReviewsSearch();
}

mountPreview();
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const maps = document.getElementById("out-maps-popup");
  if (maps && !maps.hidden && maps.classList.contains("open")) {
    event.preventDefault();
    closeOutMapsPopup();
    return;
  }
  const party = document.getElementById("out-party-popup");
  if (party && !party.hidden && party.classList.contains("open")) {
    event.preventDefault();
    closeOutPartyPopup();
    return;
  }
  const layer = previewLayer();
  if (!layer || layer.hidden) return;
  event.preventDefault();
  closePdfPreview();
});

function applyRosterSearch() {
  const query = learnerSearchQuery(learnerSearch);
  const lists = [
    [learnerList, "[data-roster-row]"],
    [followUpList, "[data-roster-row]"],
    [archiveList, "[data-roster-row]"],
  ];
  let filtered = false;
  for (const [list, selector] of lists) {
    const visible = filterSearchRows(list, selector, query);
    if (visible == null) continue;
    filtered = true;
    let empty = list.querySelector("[data-search-empty]");
    if (!empty) {
      empty = document.createElement("li");
      empty.className = "empty";
      empty.dataset.searchEmpty = "";
      list.append(empty);
    }
    empty.hidden = visible > 0;
    empty.textContent = visible ? "" : `No booking names match “${query}”.`;
  }
  return filtered;
}

function applyReviewsSearch() {
  if (!reviewsList) return false;
  const cards = reviewsList.querySelectorAll("[data-review-learner]");
  if (!cards.length) return false;
  const query = String(reviewsSearch?.value || "").trim().toLowerCase();
  let visible = 0;
  cards.forEach((card) => {
    const show = !query || (card.dataset.searchText || "").includes(query);
    card.hidden = !show;
    card.classList.toggle("is-search-hidden", !show);
    if (show) visible += 1;
  });
  reviewsList.querySelectorAll(".review-cycle-group").forEach((group) => {
    group.hidden = ![...group.querySelectorAll("[data-review-learner]")].some((card) => !card.hidden);
  });
  if (reviewsCount) reviewsCount.textContent = String(visible);
  return true;
}

function learnerTutorName(item) {
  const learner = item?.id
    ? state.learners.find((row) => row.id === item.id) ||
      (state.followUps || []).find((row) => row.id === item.id) ||
      item
    : item;
  return normaliseTutor(learner?.tutor || item?.tutor);
}

function learnerPlaceMeta(item) {
  const company = normaliseCompany(item.company);
  const tutor = learnerTutorName(item);
  return [
    company,
    item.postcode,
    tutor ? `tutor ${tutor}` : "tutor not set",
    item.collegeDay ? `college ${item.collegeDay}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function stopContactLine(learner) {
  const profile = learnerProfileFrom(learner || {});
  const name = String(profile.employerContact || "").trim();
  const phone = normalisePhone(profile.contactNumber);
  const digits = String(profile.contactNumber || "").replace(/\D/g, "");
  const phoneHtml = phone
    ? digits
      ? `<a href="tel:${digits}">${escapeHtml(phone)}</a>`
      : escapeHtml(phone)
    : "";
  if (!name && !phoneHtml) {
    return `<span class="stop-contact-line">No contact saved</span>`;
  }
  return `<span class="stop-contact-line">${name ? escapeHtml(name) : ""}${name && phoneHtml ? " · " : ""}${phoneHtml}</span>`;
}

function plannerStopLearner(stop) {
  if (!stop?.id) return null;
  return findEditableLearner(stop.id) || (stop.name ? stop : null);
}

function planStopActions(stop, { isBooked, verifiedOnDay, waitingActive, dayAccepted, routeCompleted }) {
  const learner = plannerStopLearner(stop);
  if (routeCompleted) return completedLearnerActions(learner);
  const buttons = [];
  const stopId = escapeHtml(stop.id);
  if (verifiedOnDay && !isBooked) {
    buttons.push(
      `<button type="button" class="btn ghost" data-verify="${stopId}">Undo verify</button>`,
    );
  } else if (!isBooked) {
    buttons.push(
      `<button type="button" class="btn primary" data-verify="${stopId}">Verify</button>`,
    );
  }
  buttons.push(
    `<button type="button" class="btn blue${uiState.rebookStopId === stop.id ? " on" : ""}" data-rebook="${stopId}" aria-expanded="${uiState.rebookStopId === stop.id ? "true" : "false"}" aria-controls="rebook-panel-${stopId}" aria-label="${uiState.rebookStopId === stop.id ? "Close rebook" : "Rebook this visit"}">Rebook</button>`,
  );
  if (!dayAccepted && !verifiedOnDay && !isBooked) {
    buttons.push(
      `<button type="button" class="btn ghost lock-btn${waitingActive ? " locked" : ""}" data-awaiting="${stopId}" aria-pressed="${waitingActive ? "true" : "false"}">${waitingActive ? "Unlock" : "Lock"}</button>`,
    );
  }
  if (learner) {
    const learnerId = escapeHtml(learner.id);
    buttons.push(
      `<button type="button" class="btn blue ${uiState.phoneEditorId === learner.id || isPhoneReview(learner) ? "on" : ""}" data-phone-review="${learnerId}">${uiState.phoneEditorId === learner.id ? "Close call" : "Phone review"}</button>`,
      `<button type="button" class="btn grey ${learnerNoteText(learner) || isLearnerSheetOpen("note", learner.id) ? "on" : ""}" data-note="${learnerId}">${learnerNoteText(learner) ? "Edit note" : "Add note"}</button>`,
      `<button type="button" class="btn blue ${isLearnerSheetOpen("details", learner.id) ? "on" : ""}" data-edit-details="${learnerId}">Edit details</button>`,
    );
  }
  if (!dayAccepted) {
    buttons.push(
      `<button type="button" class="btn danger" data-off-round="${stopId}">Take off this round</button>`,
    );
  }
  return `<div class="stop-action-grid">${buttons.join("")}</div>`;
}

function plannerStopLearnerPanel(stop, { routeCompleted = false } = {}) {
  const learner = plannerStopLearner(stop);
  if (!learner) return "";
  if (routeCompleted) {
    return `<div class="stop-learner-tools">${notePreview(learner)}</div>`;
  }
  return `
    <div class="stop-learner-tools">
      ${notePreview(learner)}
      ${appointmentEditor(learner)}
      ${phoneReviewEditor(learner)}
    </div>
  `;
}

function tickClock() {
  const now = new Date();
  if (liveClock) liveClock.textContent = formatClock(now, phoneOutMode() || isPhoneHandset());
  if (!uiState.planCache) return;
  const expiredHolds = expiredAwaitingCount(now) > 0;
  if (!expiredHolds) return;
  const settings = currentPlannerSettings();
  const signature = planningSignature(now, settings, signatureExtras(now));
  if (signature === uiState.lastSignature) return;
  applyCurrentPlan({
    refreshMap: false,
    updateStatus: true,
    fillGaps: true,
  });
}

function rosterLearnerFromRecord(item) {
  return {
    id: item.id,
    name: item.name,
    company: normaliseCompany(item.company),
    postcode: item.postcode,
    collegeDay: item.collegeDay,
    priority: normalisePriority(item.priority),
    phoneReview: Boolean(item.phoneReview),
    phoneReviewDay: phoneReviewDay(item),
    appointment: item.appointment || null,
    appointmentAt: item.appointmentAt || "",
    appointmentClearedAt: item.appointmentClearedAt || "",
    employer: item.employer || null,
    ...learnerProfileFrom(item),
    lastReviewDate: lastReviewDateKey(item),
    reviewHistory: item.reviewHistory || [],
    note: learnerNoteText(item),
    safeguardingSigned: Boolean(item.safeguardingSigned),
  };
}

function learnerCouldJoinDay(learner, day) {
  if (!learner?.id || !day || !includeLearnerInPlanner(learner)) return false;
  if (isPhoneReview(learner)) {
    const phoneDay = phoneReviewDay(learner);
    return !phoneDay || phoneDay === day.day;
  }
  if (learner.collegeDay === day.day) return false;
  if (!employerAllowsDay(learner, day.day)) return false;
  const booked = normaliseAppointment(learner.appointment)?.dateKey;
  if (booked && booked !== day.dateKey) return false;
  return true;
}

tickClock();
setInterval(tickClock, 1000);
setStaleSaveHandler(() => {
  renderLearners();
  if (uiState.currentPage === "plan" && (uiState.planCache || uiState.planResult)) {
    applyCurrentPlan({
      refreshMap: false,
      updateStatus: false,
      fillGaps: false,
    });
  }
});
setInterval(() => {
  if (document.visibilityState === "visible") reconcileVisibleState();
}, 12000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  tickClock();
  reconcileVisibleState();
});
window.addEventListener("focus", () => {
  if (document.visibilityState === "visible") reconcileVisibleState();
});


function redrawAfterStateReload() {
  uiState.dirtyDetails = null;
  renderLearners();
  if (uiState.currentPage === "records") renderRecords();
  if (uiState.currentPage === "archive") renderArchiveHistory();
  if (uiState.currentPage === "reviews") renderReviews({ sync: true });
  if (uiState.currentPage === "analytics") renderAnalytics();
  if (uiState.currentPage === "plan") {
    renderCalendar();
    renderPlan();
  }
  if (uiState.currentPage === "out") renderOut();
}

window.onStateReloaded = redrawAfterStateReload;

async function prepareLoadedWorkspace() {
  const loaded = await loadState();
  installLoadedState(state, loaded || {});
  if (!state.pinnedRoutes) state.pinnedRoutes = {};
  if (!state.frozenTimes) state.frozenTimes = {};
  if (!state.excludedFromDate) state.excludedFromDate = {};
  if (!state.completedRoutes) state.completedRoutes = {};
  if (!state.awaitingReply) state.awaitingReply = {};
  if (!state.awaitingClearedAt) state.awaitingClearedAt = {};
  if (!state.followUps) state.followUps = [];
  if (!state.archive) state.archive = [];
  if (!state.savedReviews) state.savedReviews = [];
  if (!state.visitDays) state.visitDays = {};
  ensureAnalyticsState(state);
  repairMistakenVisitDates(state, toDateKey(startOfLocalDay(new Date())));
  repairFalseTodayCompletions(state, toDateKey(startOfLocalDay(new Date())));
  repairForwardDueDates(state);
  repairOrphanReviewerPacks(state);
  const shouldClearPlanned = !state.settings?.plannedDatesCleared;
  if (shouldClearPlanned) {
    for (const item of [
      ...state.learners,
      ...(state.followUps || []),
      ...(state.archive || []),
    ]) {
      clearLearnerPlannedDates(item);
    }
    if (!state.settings) state.settings = {};
    state.settings.plannedDatesCleared = true;
    uiState.currentPage = tutorMode ? "reviews" : "records";
  }
  for (const learner of state.learners) {
    learner.priority = normalisePriority(learner.priority);
    learner.company = normaliseCompany(learner.company);
    learner.phoneReview = Boolean(learner.phoneReview);
    learner.phoneReviewDay = phoneReviewDay(learner);
    learner.appointment = normaliseAppointment(learner.appointment);
    learner.employer = normaliseEmployer(learner.employer);
    learner.note = String(learner.note || "");
    learner.noteUntil = noteUntilKey(learner);
    applyLearnerProfile(learner, learner);
    learner.gtaReviewer = DEFAULT_GTA_REVIEWER;
    if (shouldClearPlanned) learner.plannedReviewDate = "";
    const last = lastReviewDateKey(learner);
    if (last) recordReview(learner, last, "entered");
    else {
      learner.lastReviewDate = "";
      learner.reviewHistory = learner.reviewHistory || [];
    }
  }
  for (const item of [...(state.followUps || []), ...(state.archive || [])]) {
    item.company = normaliseCompany(item.company);
    item.note = String(item.note || "");
    item.noteUntil = noteUntilKey(item);
    applyLearnerProfile(item, item);
    item.gtaReviewer = DEFAULT_GTA_REVIEWER;
    if (shouldClearPlanned) item.plannedReviewDate = "";
    const last = lastReviewDateKey(item);
    if (last) recordReview(item, last, "entered");
  }
  repairCycleReleaseDates(state, managedLiveLearners());
  backfillCompletedRouteMarks(toDateKey(startOfLocalDay(new Date())));
  scheduleStateSave(true);
  await loadFeedbackInbox();
  const todayKey = toDateKey(startOfLocalDay(new Date()));
  state.settings.workingDates = Array.isArray(state.settings.workingDates)
    ? state.settings.workingDates.filter((key) => key >= todayKey)
    : [];
  hydrateSettings();
  const viewKey = state.settings.workingDates[0];
  if (viewKey) {
    const date = dateFromKey(viewKey);
    rememberSelectedDay({ day: weekdayName(date), dateKey: viewKey, date });
  }
  if (tutorMode) uiState.currentPage = "reviews";
  else if (officeMode) uiState.currentPage = "records";
  else if (phoneOutMode()) uiState.currentPage = "out";
  setPage(uiState.currentPage);
  if (location.hash === "#settings") {
    showSettingsTab("plan");
    openAccountSettings();
    history.replaceState(null, "", pageHash(uiState.currentPage));
  }
  renderLearners();
  renderPlan();
  tickClock();
  prefetchReviewTemplate();
  if (!tutorMode && state.learners.length && alreadyPlanned()) {
    planTheWeek({ resetSelection: false, fillGaps: false }).catch((error) => {
      setStatus(error.message || "Could not refresh the week.");
      planButton.disabled = false;
    });
  }
}


bootstrap({
  prepareLoadedWorkspace,
  setStatus,
  cancelMapDraw,
  resetUiState,
  getState: () => state,
});
startAuthBoot();

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  const message = event.reason?.message || String(event.reason || "An unexpected error occurred");
  showGlobalError(`⚠️ ${message}`);
  event.preventDefault();
});

window.addEventListener("error", (event) => {
  console.error("Unhandled error:", event.error || event.message);
  const message = event.error?.message || event.message || "An unexpected error occurred";
  showGlobalError(`⚠️ ${message}`);
});

function showGlobalError(message) {
  let banner = document.getElementById("global-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "global-error-banner";
    banner.className = "error-banner";
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  banner.style.display = "block";
  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.display = "none";
    }
  }, 5000);
}
