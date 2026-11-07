import { startOfLocalDay } from "../lib/dates.js";

const calendarMonth = startOfLocalDay(new Date());
calendarMonth.setDate(1);

export const uiState = {
  appointmentEditorId: "",
  rebookStopId: "",
  rebookErrorText: "",
  rebookDraft: null,
  holdRebookPersist: false,
  phoneEditorId: "",
  noteEditorId: "",
  reviewEditorId: "",
  detailsEditorId: "",
  dirtyDetails: null,
  flushingDetails: false,
  learnerToolsOpenIds: new Set(),
  rosterOpenIds: new Set(),
  currentPage: "records",
  recordsFilter: "all",
  reviewsFilter: "all",
  openTutorLearnerId: "",
  expandedTutorLearnerIds: new Set(),
  expandedArchiveLearnerIds: new Set(),
  openRecordsLearnerIds: new Set(),
  reviewsDateFilter: "",
  analyticsRange: "all",
  analyticsView: "summary",
  analyticsSide: "reviews",
  openReviewIds: new Set(),
  openReviewLearnerIds: new Set(),
  openTimePickerId: "",
  highlightedStopId: "",
  openStopContactId: "",
  planCardOpeningId: "",
  openOutLearnerId: "",
  outPreviewLearnerId: "",
  routeDragId: "",
  routeDragMoved: false,
  rosterDragId: "",
  rosterDragMoved: false,
  rosterFitPreview: null,
  rosterFitToken: 0,
  rosterPointer: null,
  rosterUndo: null,
  rosterUndoTimer: null,
  rosterDragGhost: null,
  rosterDragSize: { width: 0, height: 0 },
  rosterDragMeta: null,
  rosterSnapping: false,
  blankDragImage: null,
  rosterDropBusy: false,
  rosterDropOver: false,
  planCacheReady: null,
  planResult: null,
  selectedDay: "Monday",
  selectedDateKey: "",
  rosterTab: "unbooked",
  archiveReasonLearnerId: "",
  learnerArchiveFilter: "all",
  planNotesOpen: false,
  previewLogContext: null,
  previewTarget: { learnerId: "", review: null },
  calendarMonth,
  map: undefined,
  mapLayer: undefined,
  planCache: null,
  lastSignature: "",
  selectedDayPlanTimer: 0,
  calendarPointerDay: "",
  tutorSaveTimer: undefined,
};

export function resetUiState() {
  const month = startOfLocalDay(new Date());
  month.setDate(1);
  uiState.appointmentEditorId = "";
  uiState.rebookStopId = "";
  uiState.rebookErrorText = "";
  uiState.rebookDraft = null;
  uiState.holdRebookPersist = false;
  uiState.phoneEditorId = "";
  uiState.noteEditorId = "";
  uiState.reviewEditorId = "";
  uiState.detailsEditorId = "";
  uiState.dirtyDetails = null;
  uiState.flushingDetails = false;
  uiState.learnerToolsOpenIds.clear();
  uiState.rosterOpenIds.clear();
  uiState.currentPage = "records";
  uiState.recordsFilter = "all";
  uiState.reviewsFilter = "all";
  uiState.openTutorLearnerId = "";
  uiState.expandedTutorLearnerIds.clear();
  uiState.expandedArchiveLearnerIds.clear();
  uiState.openRecordsLearnerIds.clear();
  uiState.reviewsDateFilter = "";
  uiState.analyticsRange = "all";
  uiState.analyticsView = "summary";
  uiState.analyticsSide = "reviews";
  uiState.openReviewIds.clear();
  uiState.openReviewLearnerIds.clear();
  uiState.openTimePickerId = "";
  uiState.highlightedStopId = "";
  uiState.openStopContactId = "";
  uiState.planCardOpeningId = "";
  uiState.openOutLearnerId = "";
  uiState.outPreviewLearnerId = "";
  uiState.routeDragId = "";
  uiState.routeDragMoved = false;
  uiState.rosterDragId = "";
  uiState.rosterDragMoved = false;
  uiState.rosterFitPreview = null;
  uiState.rosterFitToken = 0;
  uiState.rosterPointer = null;
  uiState.rosterUndo = null;
  clearInterval(uiState.rosterUndoTimer);
  uiState.rosterUndoTimer = null;
  uiState.rosterDragGhost = null;
  uiState.rosterDragSize = { width: 0, height: 0 };
  uiState.rosterDragMeta = null;
  uiState.rosterSnapping = false;
  uiState.blankDragImage = null;
  uiState.rosterDropBusy = false;
  uiState.rosterDropOver = false;
  uiState.planCacheReady = null;
  uiState.planResult = null;
  uiState.selectedDay = "Monday";
  uiState.selectedDateKey = "";
  uiState.rosterTab = "unbooked";
  uiState.archiveReasonLearnerId = "";
  uiState.learnerArchiveFilter = "all";
  uiState.planNotesOpen = false;
  uiState.previewLogContext = null;
  uiState.previewTarget = { learnerId: "", review: null };
  uiState.calendarMonth = month;
  uiState.planCache = null;
  uiState.lastSignature = "";
  clearTimeout(uiState.selectedDayPlanTimer);
  uiState.selectedDayPlanTimer = 0;
  uiState.calendarPointerDay = "";
  uiState.tutorSaveTimer = undefined;
}
