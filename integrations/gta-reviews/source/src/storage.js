import { supabaseClient, currentSession } from "./auth.js";
import { apiFetch, scheduleStateSave, waitForReconcile } from "./app/persist.js";
import { uiState } from "./app/ui-state.js";
import { APP_BUILD } from "../shared/app-build.js";
import {
  mergeLearnerRecords,
  mergePreservedPlanLocks,
  reapplyPendingOnServer,
} from "./plan-locks.js";
import {
  ensureHistoryAttended,
  lastReviewDateKey,
  learnerProfileFrom,
  normaliseDateKey,
  normaliseReviewHistory,
  normaliseTutor,
} from "./planner.js";
import { normaliseSavedReviews, normaliseTarget } from "./reviews.js";
import { normaliseVisitDays } from "./visits.js";

const KEY = "review-assistant-v1";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

let saveQueue = Promise.resolve();
// eslint-disable-next-line no-unused-vars
let pendingSaveNotification = null;

function showSaveError(message) {
  const banner = document.getElementById("save-error-banner");
  if (!banner) {
    const div = document.createElement("div");
    div.id = "save-error-banner";
    div.className = "error-banner";
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  } else {
    banner.textContent = message;
  }
}

let pendingConflictState = null;
let conflictSource = null;
let conflictLocalSnapshot = null;
let conflictUserId = "";
let conflictSessionId = "";

function readSessionId(session) {
  if (session?.session_id) return String(session.session_id);
  const part = String(session?.access_token || "").split(".")[1];
  if (!part) return "";
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded));
    return String(json.session_id || "");
  } catch {
    return "";
  }
}

function sessionIdentity(session) {
  return {
    userId: session?.user?.id || "",
    sessionId: readSessionId(session),
  };
}

const PEOPLE_LISTS = ["learners", "followUps", "archive"];
const STAMP_KEYS = new Set(["savedAt", "baseSavedAt", "version", "appBuild"]);
const FIELD_LABELS = {
  note: "notes",
  notes: "notes",
  phone: "phone",
  postcode: "postcode",
  name: "name",
  collegeDay: "college day",
  list: "list",
  settings: "settings",
  pinnedRoutes: "pinned routes",
  savedReviews: "saved reviews",
  tutorFeedback: "tutor feedback",
  visitDays: "visit days",
  awaitingReply: "awaiting reply",
  awaitingClearedAt: "awaiting reply",
  analytics: "analytics",
  analyticsEvents: "analytics",
  acceptedRoutes: "accepted routes",
  frozenTimes: "times",
  completedRoutes: "completed routes",
};

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return String(key || "").replace(/([A-Z])/g, " $1").replaceAll("_", " ").trim().toLowerCase();
}

function personRecord(state, id) {
  for (const list of PEOPLE_LISTS) {
    const found = (state?.[list] || []).find((item) => item?.id === id);
    if (found) return { list, item: found };
  }
  return null;
}

function learnerLabel(state, id) {
  const name = String(personRecord(state, id)?.item?.name || "").trim();
  return name || "A learner";
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function describeContentChanges(base, next) {
  const lines = [];
  if (!base || !next) return lines;
  const ids = new Set();
  for (const list of PEOPLE_LISTS) {
    for (const item of [...(base[list] || []), ...(next[list] || [])]) {
      if (item?.id) ids.add(item.id);
    }
  }
  for (const id of ids) {
    const before = personRecord(base, id);
    const after = personRecord(next, id);
    const label = learnerLabel(after ? next : base, id);
    if (!before && after) {
      lines.push(`${label} added`);
      continue;
    }
    if (before && !after) {
      lines.push(`${label} removed`);
      continue;
    }
    if (before.list !== after.list) lines.push(`${label} moved`);
    const keys = new Set([...Object.keys(before.item || {}), ...Object.keys(after.item || {})]);
    for (const key of keys) {
      if (key === "id") continue;
      if (!sameJson(before.item?.[key], after.item?.[key])) {
        lines.push(`${label} ${fieldLabel(key)}`);
      }
    }
  }
  const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
  for (const key of keys) {
    if (STAMP_KEYS.has(key) || PEOPLE_LISTS.includes(key)) continue;
    if (!sameJson(base[key], next[key])) lines.push(fieldLabel(key));
  }
  return lines;
}

function limitedChangeText(lines) {
  const clean = lines.map((line) => String(line || "").trim()).filter(Boolean);
  const shown = clean.slice(0, 5);
  const extra = clean.length - shown.length;
  const summary = shown.join("; ");
  return extra > 0 ? `${summary}; +${extra} more` : summary;
}

export function conflictChangeSummary(base, local, server) {
  const yours = describeContentChanges(base, local).map((line) => `You changed ${line}`);
  const theirs = describeContentChanges(base, server).map((line) => `Elsewhere changed ${line}`);
  return limitedChangeText([...yours, ...theirs]);
}

export function labelConflict(token, lookupState) {
  const text = String(token || "");
  const dot = text.indexOf(".");
  if (dot === -1) {
    if (personRecord(lookupState, text)) return learnerLabel(lookupState, text);
    return fieldLabel(text);
  }
  const id = text.slice(0, dot);
  const key = text.slice(dot + 1);
  if (personRecord(lookupState, id)) return `${learnerLabel(lookupState, id)} ${fieldLabel(key)}`;
  return fieldLabel(key);
}

async function showConflictPrompt(localState, serverState, localSnapshot) {
  let session = null;
  try {
    session = await currentSession();
  } catch (error) {
    console.error("Failed to read the session for a conflict:", error?.message || error);
    session = null;
  }
  pendingConflictState = serverState || null;
  conflictSource = localState || null;
  conflictLocalSnapshot = localSnapshot || null;
  const identity = sessionIdentity(session);
  conflictUserId = identity.userId;
  conflictSessionId = identity.sessionId;
  let banner = document.getElementById("save-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "save-error-banner";
    banner.className = "error-banner";
    document.body.appendChild(banner);
  }
  banner.replaceChildren();
  const message = document.createElement("p");
  message.dataset.conflictMessage = "true";
  const changes = lastAckState ? conflictChangeSummary(lastAckState, localSnapshot || localState, serverState) : "";
  message.textContent = !serverState
    ? "Data was changed elsewhere, and the latest copy could not be read. Reload the page before trying again."
    : changes
      ? `Data was changed elsewhere. ${changes}. Re-apply your change on top of the latest copy, or reload to replace your unsaved copy.`
      : "Data was changed elsewhere. Re-apply your change on top of the latest copy, or reload to replace your unsaved copy.";
  const reload = document.createElement("button");
  reload.type = "button";
  reload.dataset.conflictReload = "true";
  reload.textContent = "Reload latest copy";
  reload.addEventListener("click", () => applyConflictReload());
  banner.append(message);
  if (serverState && lastAckState) {
    const reapply = document.createElement("button");
    reapply.type = "button";
    reapply.dataset.conflictReapply = "true";
    reapply.textContent = "Re-apply my change";
    reapply.addEventListener("click", () => {
      applyConflictReapply().catch((error) => {
        console.error("Failed to re-apply the change:", error?.message || error);
      });
    });
    banner.append(reapply);
  }
  banner.append(reload);
}

export function clearConflictPrompt() {
  pendingConflictState = null;
  conflictSource = null;
  conflictLocalSnapshot = null;
  conflictUserId = "";
  conflictSessionId = "";
  document.getElementById("save-error-banner")?.remove();
}

function showKeptServerFields(conflicts, lookupState) {
  let banner = document.getElementById("save-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "save-error-banner";
    banner.className = "error-banner";
    document.body.appendChild(banner);
  }
  banner.replaceChildren();
  const message = document.createElement("p");
  message.dataset.conflictMessage = "true";
  const labels = conflicts.map((token) => labelConflict(token, lookupState));
  message.textContent = `Some of your edits were also changed elsewhere and were left as they are on the server: ${limitedChangeText(labels)}.`;
  banner.append(message);
}

// Sign-out and a new session drop the banner. The recorded user id and
// session id are compared again before a re-apply is allowed. The access
// token itself is not kept.
export function syncConflictSession(session) {
  if (!pendingConflictState && !conflictSource) return;
  const identity = sessionIdentity(session);
  if (identity.userId !== conflictUserId || identity.sessionId !== conflictSessionId) {
    clearConflictPrompt();
  }
}

// The follow-up save goes through the normal save queue, so a rebook hold
// and the per-user session checks still apply.
async function applyConflictReapply() {
  if (!pendingConflictState || !conflictSource || !lastAckState) return;
  let session = null;
  try {
    session = await currentSession();
  } catch (error) {
    console.error("Failed to read the session for a re-apply:", error?.message || error);
    session = null;
  }
  const identity = sessionIdentity(session);
  if (identity.userId !== conflictUserId || identity.sessionId !== conflictSessionId) {
    clearConflictPrompt();
    return;
  }
  const target = conflictSource;
  const local = JSON.parse(JSON.stringify(conflictLocalSnapshot || target));
  const server = pendingConflictState;
  const base = lastAckState;
  const { state: merged, conflicts } = reapplyPendingOnServer(server, local, base);
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, merged);
  if (Number(server.version) > 0) target.version = Number(server.version);
  sessionSavedAt = server.savedAt || sessionSavedAt;
  writeLocal(target);
  const keptLabels = conflicts.slice();
  clearConflictPrompt();
  if (window.onStateReloaded) window.onStateReloaded(target);
  if (keptLabels.length) showKeptServerFields(keptLabels, target);
  if (contentFingerprint(target) === contentFingerprint(server)) {
    acknowledgeSnapshot(target);
    return;
  }
  await scheduleStateSave(true);
}

function applyConflictReload() {
  if (!pendingConflictState || !conflictSource) return;
  const next = pendingConflictState;
  for (const key of Object.keys(conflictSource)) delete conflictSource[key];
  Object.assign(conflictSource, next);
  if (Number(next.version) > 0) conflictSource.version = Number(next.version);
  sessionSavedAt = next.savedAt || sessionSavedAt;
  acknowledgeSnapshot(conflictSource);
  writeLocal(conflictSource);
  pendingConflictState = null;
  conflictUserId = "";
  conflictSessionId = "";
  conflictLocalSnapshot = null;
  if (window.onStateReloaded) window.onStateReloaded(conflictSource);
  document.getElementById("save-error-banner")?.remove();
}

function normaliseCompletedRoutes(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next = {};
  for (const [dateKey, entry] of Object.entries(value)) {
    if (!dateKey) continue;
    const ids = Array.isArray(entry)
      ? entry
      : Array.isArray(entry?.ids)
        ? entry.ids
        : [];
    const clean = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!clean.length) continue;
    next[dateKey] = {
      at: String(entry?.at || ""),
      ids: clean,
    };
  }
  return next;
}

export const emptyState = () => ({
  version: 1,
  settings: {
    officePostcode: "DN3 3DY",
    startTime: "10:00",
    lunchStart: "13:00",
    lunchMinutes: 30,
    returnBy: "16:45",
    stayMinutes: 30,
    callMinutes: 60,
    skipToday: true,
    outPageEnabled: false,
    reportAutoEmail: true,
    email: "",
    workingDates: [],
    plannedDatesCleared: false,
    blockedTutors: [],
    customTutors: [],
  },
  learners: [],
  acceptedRoutes: {},
  verifiedByDate: {},
  callAnchors: {},
  pinnedRoutes: {},
  frozenTimes: {},
  excludedFromDate: {},
  completedRoutes: {},
  followUps: [],
  archive: [],
  awaitingReply: {},
  awaitingClearedAt: {},
  savedReviews: [],
  visitDays: {},
  analyticsSince: "",
  analyticsEvents: [],
  analyticsReports: [],
  analyticsReportSkip: [],
  tutorFeedback: [],
});

function normaliseState(parsed) {
  const base = emptyState();
  const settings = { ...base.settings, ...(parsed.settings || {}) };
  if (settings.startTime === "08:30") settings.startTime = "09:00";
  settings.blockedTutors = Array.isArray(settings.blockedTutors)
    ? [...new Set(settings.blockedTutors.map((item) => normaliseTutor(item)).filter(Boolean))]
    : [];
  settings.customTutors = Array.isArray(settings.customTutors)
    ? [...new Set(settings.customTutors.map((item) => normaliseTutor(item)).filter(Boolean))]
    : [];
  settings.reportAutoEmail = settings.reportAutoEmail !== false;
  settings.outPageEnabled = settings.outPageEnabled === true;
  const next = {
    settings,
    learners: Array.isArray(parsed.learners)
      ? parsed.learners.map((learner) => ({
          ...learner,
          priority: learner.priority || "normal",
          company: String(learner.company || "").trim(),
          phoneReview: Boolean(learner.phoneReview),
          phoneReviewDay: WEEKDAYS.includes(learner.phoneReviewDay)
            ? learner.phoneReviewDay
            : learner.phoneReview && WEEKDAYS.includes(learner.collegeDay)
              ? learner.collegeDay
              : "",
          appointment: learner.appointment || null,
          appointmentAt: String(
            learner.appointmentAt || (learner.appointment ? learner.updatedAt || "" : ""),
          ),
          appointmentClearedAt: String(learner.appointmentClearedAt || ""),
          employer: learner.employer || null,
          ...learnerProfileFrom(learner),
          lastReviewDate: lastReviewDateKey(learner),
          lastReviewTargets: Array.isArray(learner.lastReviewTargets)
            ? learner.lastReviewTargets.map(normaliseTarget).filter((item) => item.action)
            : [],
          reviewHistory: normaliseReviewHistory(learner.reviewHistory),
          isTest: Boolean(learner.isTest),
          testSkipWait: Boolean(learner.testSkipWait),
          testFlowReset: Boolean(learner.testFlowReset),
          needsRecordCheck: Boolean(learner.needsRecordCheck),
          safeguardingSigned: Boolean(learner.safeguardingSigned),
          heldFromPlan: Boolean(learner.heldFromPlan),
          concern: Boolean(learner.concern),
          reviewAttendance:
            learner.reviewAttendance && typeof learner.reviewAttendance === "object"
              ? learner.reviewAttendance
              : {},
          note: String(learner.note || ""),
          noteUntil: normaliseDateKey(learner.noteUntil),
        }))
      : [],
    acceptedRoutes:
      parsed.acceptedRoutes && typeof parsed.acceptedRoutes === "object"
        ? parsed.acceptedRoutes
        : {},
    verifiedByDate:
      parsed.verifiedByDate && typeof parsed.verifiedByDate === "object"
        ? parsed.verifiedByDate
        : {},
    callAnchors:
      parsed.callAnchors && typeof parsed.callAnchors === "object"
        ? parsed.callAnchors
        : {},
    pinnedRoutes:
      parsed.pinnedRoutes && typeof parsed.pinnedRoutes === "object"
        ? parsed.pinnedRoutes
        : {},
    frozenTimes:
      parsed.frozenTimes && typeof parsed.frozenTimes === "object"
        ? parsed.frozenTimes
        : {},
    excludedFromDate:
      parsed.excludedFromDate && typeof parsed.excludedFromDate === "object"
        ? parsed.excludedFromDate
        : {},
    completedRoutes: normaliseCompletedRoutes(parsed.completedRoutes),
    awaitingReply:
      parsed.awaitingReply && typeof parsed.awaitingReply === "object"
        ? parsed.awaitingReply
        : {},
    awaitingClearedAt:
      parsed.awaitingClearedAt && typeof parsed.awaitingClearedAt === "object"
        ? parsed.awaitingClearedAt
        : {},
    followUps: Array.isArray(parsed.followUps)
      ? parsed.followUps.map((item) => ({
          ...item,
          company: String(item.company || "").trim(),
          appointment: item.appointment || null,
          appointmentAt: String(
            item.appointmentAt || (item.appointment ? item.updatedAt || "" : ""),
          ),
          appointmentClearedAt: String(item.appointmentClearedAt || ""),
          ...learnerProfileFrom(item),
          lastReviewDate: lastReviewDateKey(item),
          lastReviewTargets: Array.isArray(item.lastReviewTargets)
            ? item.lastReviewTargets.map(normaliseTarget).filter((row) => row.action)
            : [],
          reviewHistory: normaliseReviewHistory(item.reviewHistory),
          isTest: Boolean(item.isTest),
          testSkipWait: Boolean(item.testSkipWait),
          testFlowReset: Boolean(item.testFlowReset),
          needsRecordCheck: Boolean(item.needsRecordCheck),
          safeguardingSigned: Boolean(item.safeguardingSigned),
          heldFromPlan: Boolean(item.heldFromPlan),
          concern: Boolean(item.concern),
          reviewAttendance:
            item.reviewAttendance && typeof item.reviewAttendance === "object"
              ? item.reviewAttendance
              : {},
          note: String(item.note || ""),
          noteUntil: normaliseDateKey(item.noteUntil),
        }))
      : [],
    archive: Array.isArray(parsed.archive)
      ? parsed.archive.map((item) => ({
          ...item,
          company: String(item.company || "").trim(),
          appointment: item.appointment || null,
          appointmentAt: String(
            item.appointmentAt || (item.appointment ? item.updatedAt || "" : ""),
          ),
          appointmentClearedAt: String(item.appointmentClearedAt || ""),
          ...learnerProfileFrom(item),
          lastReviewDate: lastReviewDateKey(item),
          lastReviewTargets: Array.isArray(item.lastReviewTargets)
            ? item.lastReviewTargets.map(normaliseTarget).filter((row) => row.action)
            : [],
          reviewHistory: normaliseReviewHistory(item.reviewHistory),
          isTest: Boolean(item.isTest),
          testSkipWait: Boolean(item.testSkipWait),
          testFlowReset: Boolean(item.testFlowReset),
          needsRecordCheck: Boolean(item.needsRecordCheck),
          safeguardingSigned: Boolean(item.safeguardingSigned),
          heldFromPlan: Boolean(item.heldFromPlan),
          concern: Boolean(item.concern),
          reviewAttendance:
            item.reviewAttendance && typeof item.reviewAttendance === "object"
              ? item.reviewAttendance
              : {},
          note: String(item.note || ""),
          noteUntil: normaliseDateKey(item.noteUntil),
          archiveReason: item.archiveReason === "completed" || item.archiveReason === "left" ? item.archiveReason : "",
          archivedOn: normaliseDateKey(item.archivedOn),
          archivedLabel: String(item.archivedLabel || ""),
        }))
      : [],
    savedReviews: normaliseSavedReviews(parsed.savedReviews),
    visitDays: normaliseVisitDays(parsed.visitDays),
    analyticsSince: String(parsed.analyticsSince || "").trim(),
    analyticsEvents: Array.isArray(parsed.analyticsEvents)
      ? parsed.analyticsEvents
          .filter((item) => item && item.type && (item.learnerId || item.label))
          .map((item) => ({
            id: String(item.id || ""),
            type: String(item.type || ""),
            at: String(item.at || ""),
            dateKey: String(item.dateKey || ""),
            learnerId: String(item.learnerId || ""),
            reviewId: String(item.reviewId || ""),
            label: String(item.label || "").trim(),
            actorName: String(item.actorName || "").trim(),
            actorEmail: String(item.actorEmail || "").trim(),
            actorRole: String(item.actorRole || "").trim(),
          }))
      : [],
    analyticsReports: Array.isArray(parsed.analyticsReports)
      ? parsed.analyticsReports
          .filter((item) => item && item.periodId && item.html)
          .map((item) => ({
            id: String(item.id || `rep-${item.periodId}`),
            periodId: String(item.periodId || ""),
            kind: String(item.kind || ""),
            label: String(item.label || ""),
            startKey: String(item.startKey || ""),
            endKey: String(item.endKey || ""),
            createdAt: String(item.createdAt || ""),
            emailedAt: String(item.emailedAt || ""),
            html: String(item.html || ""),
            summary: {
              learners: Number(item.summary?.learners) || 0,
              completed: Number(item.summary?.completed) || 0,
              visits: Number(item.summary?.visits) || 0,
              calls: Number(item.summary?.calls) || 0,
              teams: Number(item.summary?.teams) || 0,
            },
          }))
      : [],
    analyticsReportSkip: Array.isArray(parsed.analyticsReportSkip)
      ? [...new Set(parsed.analyticsReportSkip.map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    tutorFeedback: Array.isArray(parsed.tutorFeedback)
      ? parsed.tutorFeedback
          .filter((item) => item && item.message)
          .map((item) => ({
            id: String(item.id || ""),
            email: String(item.email || ""),
            message: String(item.message || ""),
            at: String(item.at || ""),
          }))
      : [],
  };
  for (const list of [next.learners, next.followUps, next.archive]) {
    for (const item of list || []) ensureHistoryAttended(item);
  }
  next.version = Number(parsed.version) || 1;
  return next;
}

const REMOVED_LEARNER_IDS = new Set([
  "8b487656-6c2c-451a-ad72-8c3cdb4f3b95",
]);

function withoutRemovedLearners(state) {
  const drop = (id) => REMOVED_LEARNER_IDS.has(id);
  const filterIds = (ids) => (ids || []).filter((id) => !drop(id));
  const next = { ...state };
  next.learners = (state.learners || []).filter((item) => !drop(item.id));
  next.followUps = (state.followUps || []).filter((item) => !drop(item.id));
  next.archive = (state.archive || []).filter((item) => !drop(item.id));
  next.savedReviews = (state.savedReviews || []).filter((item) => !drop(item.learnerId));
  next.analyticsEvents = (state.analyticsEvents || []).filter((item) => !drop(item.learnerId));
  for (const key of ["pinnedRoutes", "verifiedByDate", "excludedFromDate"]) {
    next[key] = { ...(state[key] || {}) };
    for (const [dateKey, ids] of Object.entries(next[key])) {
      const kept = filterIds(ids);
      if (kept.length) next[key][dateKey] = kept;
      else delete next[key][dateKey];
    }
  }
  next.completedRoutes = { ...(state.completedRoutes || {}) };
  for (const [dateKey, entry] of Object.entries(next.completedRoutes)) {
    const ids = Array.isArray(entry) ? entry : entry?.ids || [];
    const kept = filterIds(ids);
    if (kept.length) {
      next.completedRoutes[dateKey] = {
        at: String(entry?.at || ""),
        ids: kept,
      };
    } else {
      delete next.completedRoutes[dateKey];
    }
  }
  return next;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return withoutRemovedLearners(normaliseState(JSON.parse(raw)));
  } catch (error) {
    console.error("Failed to read local state:", error.message || error);
    return null;
  }
}

function writeLocal(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function peopleCount(state) {
  return (
    (state?.learners?.length || 0) +
    (state?.followUps?.length || 0) +
    (state?.archive?.length || 0)
  );
}

let sessionSavedAt = "";
let lastAckFingerprint = null;
let lastAckState = null;
let stateReady = false;

function acknowledgeSnapshot(state, fingerprint = contentFingerprint(state)) {
  lastAckFingerprint = fingerprint;
  lastAckState = state ? JSON.parse(JSON.stringify(state)) : null;
}

// Tests call this. Production sets the flag in loadState.
export function allowSavesAfterLoad() {
  stateReady = true;
}

function contentFingerprint(state) {
  if (!state) return "";
  const copy = { ...state };
  delete copy.savedAt;
  delete copy.baseSavedAt;
  delete copy.version;
  return JSON.stringify(copy);
}

function savedAtTime(state) {
  return Date.parse(state?.savedAt || "") || 0;
}

let onStaleSave = null;

export function setStaleSaveHandler(handler) {
  onStaleSave = typeof handler === "function" ? handler : null;
}

export function claimSessionStamp(state) {
  const stamp = new Date().toISOString();
  if (state) state.savedAt = stamp;
  sessionSavedAt = stamp;
  return stamp;
}

export function peekSessionSavedAt() {
  return sessionSavedAt;
}

export function restoreLocalCopy(state, savedAt) {
  writeLocal(state);
  if (typeof savedAt === "string") sessionSavedAt = savedAt;
}

function pendingLocalEdits(state) {
  if (lastAckFingerprint == null) return true;
  return contentFingerprint(state) !== lastAckFingerprint;
}

// A clean tab takes the server copy whole, including its version and hash.
// A tab with unsaved edits keeps its old version so the 409 path can re-apply
// those edits. Adopting the version onto a partial merge would let the next
// save overwrite another person's changes.
export function replaceWithRemoteCopy(state, remote) {
  if (!state || !remote) return false;
  if (pendingLocalEdits(state)) return false;
  const remoteVersion = Number(remote.version) || 0;
  const localVersion = Number(state.version) || 0;
  const newerVersion = remoteVersion > localVersion;
  const newerStamp = savedAtTime(remote) > savedAtTime({ savedAt: sessionSavedAt });
  if (!newerVersion && !newerStamp) return false;
  if (remoteVersion && localVersion && remoteVersion < localVersion) return false;
  const next = JSON.parse(JSON.stringify(remote));
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
  if (remoteVersion > 0) state.version = remoteVersion;
  sessionSavedAt = state.savedAt || remote.savedAt || sessionSavedAt;
  acknowledgeSnapshot(state);
  writeLocal(state);
  return true;
}

export function adoptNewerRemotePlan(state, remote) {
  return replaceWithRemoteCopy(state, remote);
}

export function waitForSaveQueue() {
  return saveQueue.catch(() => {});
}

export async function catchUpBeforeEdit(state) {
  if (!state) return false;
  try {
    await waitForReconcile();
    await waitForSaveQueue();
    if (pendingLocalEdits(state)) return false;
    const remote = await loadRemoteState();
    return replaceWithRemoteCopy(state, remote);
  } catch (error) {
    console.error("Failed to catch up before an edit:", error?.message || error);
    return false;
  }
}

function isDesktopHost() {
  const hostname = globalThis.location?.hostname || "";
  return /^(localhost|127\.0\.0\.1)$/.test(hostname);
}

function realPeopleCount(state) {
  return peopleCount({
    learners: (state?.learners || []).filter((item) => !item.isTest),
    followUps: state?.followUps,
    archive: state?.archive,
  });
}

async function parseRemoteState(raw) {
  if (!raw) return null;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return withoutRemovedLearners(normaliseState(parsed));
}

async function isTutorRole() {
  try {
    const session = await currentSession();
    const role = session?.user?.app_metadata?.role;
    return role === "tutor";
  } catch {
    return false;
  }
}

async function loadFromTutorApi() {
  const supabase = supabaseClient();
  if (!supabase) return null;
  
  let response;
  try {
    response = await apiFetch("/api/tutor-state", {
      method: "GET",
      auth: "required",
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error.code === "NO_TOKEN") return null;
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Tutor API returned ${response.status}`);
  }

  const { state } = await response.json();
  return state ? parseRemoteState(state) : null;
}

async function loadFromSupabase() {
  const supabase = supabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from("app_state").select("payload").eq("id", "default").maybeSingle();
  if (data?.payload) return parseRemoteState(data.payload);
  // The review-app bucket is private, so a public URL always fails. The
  // authenticated download is the only storage fallback.
  const file = await supabase.storage.from("review-app").download("state.json");
  if (!file.error && file.data) return parseRemoteState(await file.data.text());
  return null;
}

async function saveToTutorApi(state) {
  const supabase = supabaseClient();
  if (!supabase) return;
  
  const response = await apiFetch("/api/tutor-state", {
    method: "POST",
    auth: "required",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("Tutor save response was not JSON:", error);
    const failure = new Error(`HTTP ${response.status}`);
    failure.status = response.status;
    throw failure;
  }

  if (response.status === 426 || payload?.code === "outdated-build") {
    const error = new Error(payload?.error || "This tab is out of date.");
    error.status = 426;
    error.outdated = true;
    throw error;
  }

  if (response.status === 409) {
    const error = new Error("Version conflict");
    error.status = 409;
    error.serverState = payload?.state || null;
    throw error;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return payload;
}

async function readSaveBody(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("Save response was not JSON:", error);
    if (response.status === 426) return { outdated: true, status: 426 };
    if (response.status === 409) return { conflict: true, serverState: null };
    const failure = new Error(`HTTP ${response.status}`);
    failure.status = response.status;
    throw failure;
  }
  if (response.status === 426 || payload?.code === "outdated-build") {
    return { outdated: true, status: 426 };
  }
  if (response.status === 409) {
    return { conflict: true, serverState: payload?.state || null };
  }
  if (!response.ok) {
    const failure = new Error(payload?.error || `HTTP ${response.status}`);
    failure.status = response.status;
    throw failure;
  }
  return payload;
}

function adoptServerVersion(state, body) {
  if (!body || typeof body !== "object") return;
  const version = Number(body.version);
  if (version > 0) state.version = version;
  if (body.savedAt) {
    state.savedAt = body.savedAt;
    sessionSavedAt = body.savedAt;
  }
  writeLocal(state);
  if (body.warning) {
    showSaveError("Saved on the server. A backup copy could not be updated.");
  }
}

export async function loadRemoteState({ includeApi = true } = {}) {
  let remote = null;
  let useTutorApi = false;
  try {
    useTutorApi = await isTutorRole();
    if (useTutorApi) {
      remote = await loadFromTutorApi();
    } else {
      remote = await loadFromSupabase();
    }
  } catch (error) {
    console.error(`Failed to load from ${useTutorApi ? "tutor API" : "Supabase"}:`, error.message || error);
    remote = null;
  }
  
  if (includeApi && isDesktopHost() && !useTutorApi) {
    try {
      // This branch runs only on the desktop host, which does not check a bearer token.
      const response = await apiFetch("/api/state", { auth: "none" });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.state != null) {
          remote = withoutRemovedLearners(normaliseState(payload.state));
        }
      }
    } catch (error) {
      console.error("Failed to load from API:", error.message || error);
    }
  }
  return remote;
}

export async function loadState() {
  const local = readLocal() || emptyState();
  let chosen = local;
  try {
    const remote = await loadRemoteState();
    if (remote != null) chosen = remote;
  } catch (error) {
    console.error("Failed to load state:", error?.message || error);
    chosen = local;
  }
  sessionSavedAt = chosen?.savedAt || "";
  acknowledgeSnapshot(chosen);
  stateReady = true;
  try {
    writeLocal(chosen);
  } catch (error) {
    console.error("Failed to store the loaded copy:", error?.message || error);
  }
  return chosen;
}

export async function saveState(state, { quiet = false, conflictPrompt = false } = {}) {
  saveQueue = saveQueue.catch(() => {}).then(() => saveStateImpl(state, {
    quiet: Boolean(quiet),
    conflictPrompt: Boolean(conflictPrompt),
  }, 0));
  return saveQueue;
}

function showReloadPrompt() {
  let banner = document.getElementById("save-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "save-error-banner";
    banner.className = "error-banner";
    document.body.appendChild(banner);
  }
  banner.replaceChildren();
  const message = document.createElement("p");
  message.textContent = "This tab is out of date. Reload the page before saving.";
  const reload = document.createElement("button");
  reload.type = "button";
  reload.dataset.reloadApp = "true";
  reload.textContent = "Reload";
  reload.addEventListener("click", () => {
    globalThis.location?.reload?.();
  });
  banner.append(message, reload);
}

function adoptRebasedCopy(state, merged, server) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, merged);
  if (Number(server?.version) > 0) state.version = Number(server.version);
  sessionSavedAt = server?.savedAt || sessionSavedAt;
  writeLocal(state);
}

function refreshAfterRebase(state) {
  if (typeof window !== "undefined" && window.onStateReloaded) window.onStateReloaded(state);
}

// The next quiet merge uses the server copy as its base. The fingerprint stays
// where it was, so this tab's unsaved edits are still unsaved.
function advanceRebaseBase(serverState) {
  lastAckState = JSON.parse(JSON.stringify(serverState));
}

const PEOPLE_LISTS_FOR_REBASE = ["learners", "followUps", "archive"];
const REBASE_SKIP = new Set(["savedAt", "baseSavedAt", "version", "appBuild", ...PEOPLE_LISTS_FOR_REBASE]);

function listedPerson(source, id) {
  for (const list of PEOPLE_LISTS_FOR_REBASE) {
    const found = (source?.[list] || []).find((item) => item?.id === id);
    if (found) return { list, item: found };
  }
  return null;
}

function sameListedPerson(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.list === right.list && JSON.stringify(left.item) === JSON.stringify(right.item);
}

function removeListedPerson(target, id) {
  for (const list of PEOPLE_LISTS_FOR_REBASE) {
    if (!Array.isArray(target[list])) continue;
    target[list] = target[list].filter((item) => item?.id !== id);
  }
}

function putListedPerson(target, id, list, item) {
  removeListedPerson(target, id);
  if (!Array.isArray(target[list])) target[list] = [];
  target[list].push(JSON.parse(JSON.stringify(item)));
}

// The pre-save merge normalises every learner still in memory. That tidy-up
// is not an edit. The quiet merge compares the copy from before that tidy-up,
// plus anything the user changed after the save was sent.
function rebaseLocal(preMerge, sent, current) {
  const local = JSON.parse(JSON.stringify(preMerge || {}));
  const ids = new Set();
  for (const source of [preMerge, sent, current]) {
    for (const list of PEOPLE_LISTS_FOR_REBASE) {
      for (const item of source?.[list] || []) if (item?.id) ids.add(item.id);
    }
  }
  for (const id of ids) {
    const before = listedPerson(sent, id);
    const now = listedPerson(current, id);
    if (sameListedPerson(before, now)) {
      if (!listedPerson(preMerge, id) && before) putListedPerson(local, id, before.list, before.item);
      continue;
    }
    if (!now) removeListedPerson(local, id);
    else putListedPerson(local, id, now.list, now.item);
  }
  const keys = new Set([
    ...Object.keys(preMerge || {}),
    ...Object.keys(sent || {}),
    ...Object.keys(current || {}),
  ]);
  for (const key of keys) {
    if (REBASE_SKIP.has(key)) continue;
    if (JSON.stringify(sent?.[key] ?? null) === JSON.stringify(current?.[key] ?? null)) continue;
    if (current?.[key] === undefined) delete local[key];
    else local[key] = JSON.parse(JSON.stringify(current[key]));
  }
  return local;
}

function quietRebase(state, serverState, preMerge, sentBaseline, attempt) {
  if (attempt >= 2 || !serverState || !lastAckState) return null;
  const local = rebaseLocal(preMerge, sentBaseline, state);
  const { state: merged, conflicts } = reapplyPendingOnServer(serverState, local, lastAckState);
  if (conflicts.length) return null;
  adoptRebasedCopy(state, merged, serverState);
  advanceRebaseBase(serverState);
  refreshAfterRebase(state);
  if (contentFingerprint(state) === contentFingerprint(serverState)) {
    acknowledgeSnapshot(state);
    return { ok: true, unchanged: true, rebased: true };
  }
  return { rebase: true };
}

async function readSaveIdentity() {
  try {
    return sessionIdentity(await currentSession());
  } catch (error) {
    console.error("Failed to read the session for a save:", error?.message || error);
    return { userId: "", sessionId: "" };
  }
}

function sameIdentity(left, right) {
  return left.userId === right.userId && left.sessionId === right.sessionId;
}

async function saveStateImpl(state, { quiet = false, conflictPrompt = false } = {}, attempt = 0) {
  if (!realPeopleCount(state)) {
    writeLocal(state);
    return { ok: true };
  }
  // Sign-in runs loadState first. That records the loaded fingerprint and
  // marks the session ready. Until that load finishes, the copy stays on
  // this device and the save is reported as not ready. Nothing is sent.
  // After the load, an unchanged copy is not sent. Changes made inside
  // normaliseState are already in that fingerprint, so they reach the server
  // only with the next real edit. A null fingerprint after the load has
  // finished means no copy has been acknowledged yet, so that first save
  // still goes out.
  if (!stateReady) {
    writeLocal(state);
    if (!quiet) showSaveError("Could not save yet. The latest copy is still loading.");
    return { ok: false, ready: false, conflict: false, status: 0, error: "not-ready" };
  }
  const dirty = lastAckFingerprint != null && contentFingerprint(state) !== lastAckFingerprint;
  if (!dirty && lastAckFingerprint != null) {
    try {
      const remote = await loadRemoteState({ includeApi: false });
      if (adoptNewerRemotePlan(state, remote)) {
        onStaleSave?.();
        return { ok: true, refreshed: true };
      }
    } catch (error) {
      console.error("Failed to check for remote updates:", error.message || error);
    }
    return { ok: true, unchanged: true };
  }

  const userSnapshot = JSON.parse(JSON.stringify(state));
  mergePreservedPlanLocks(state, readLocal());
  mergeLearnerRecords(state, readLocal(), lastAckState);

  state.baseSavedAt = sessionSavedAt;
  state.savedAt = new Date().toISOString();
  sessionSavedAt = state.savedAt;
  writeLocal(state);

  const sent = JSON.parse(JSON.stringify(state));
  const sentFingerprint = contentFingerprint(sent);
  sent.appBuild = APP_BUILD;
  const sentIdentity = await readSaveIdentity();

  const finishConflict = async (serverState) => {
    const nowIdentity = await readSaveIdentity();
    const sameSession = sameIdentity(nowIdentity, sentIdentity);
    const rebookHeld = Boolean(uiState.holdRebookPersist);
    if (sameSession && !rebookHeld) {
      const rebased = quietRebase(state, serverState, userSnapshot, sent, attempt);
      if (rebased?.unchanged) return rebased;
      if (rebased?.rebase) {
        return saveStateImpl(state, { quiet, conflictPrompt }, attempt + 1);
      }
    }
    console.warn("Save conflict detected (409). Keeping the unsaved local copy.");
    if (!quiet || conflictPrompt || !sameSession || rebookHeld) {
      await showConflictPrompt(state, serverState, userSnapshot);
      if (!sameSession) {
        conflictUserId = sentIdentity.userId;
        conflictSessionId = sentIdentity.sessionId;
      }
    }
    return { ok: false, conflict: true, status: 409 };
  };

  try {
    const useTutorApi = await isTutorRole();
    if (useTutorApi) {
      const body = await saveToTutorApi(sent);
      if (body?.outdated) {
        showReloadPrompt();
        return { ok: false, outdated: true, status: 426 };
      }
      if (body?.conflict) return finishConflict(body.serverState || null);
      adoptServerVersion(state, body);
    } else {
      const response = await apiFetch("/api/state", {
        method: "PUT",
        auth: isDesktopHost() ? "none" : "if-present",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      const body = await readSaveBody(response);
      if (body?.outdated) {
        showReloadPrompt();
        return { ok: false, outdated: true, status: 426 };
      }
      if (body?.conflict) return finishConflict(body.serverState);
      adoptServerVersion(state, body);
    }
    acknowledgeSnapshot(sent, sentFingerprint);
    return { ok: true };
  } catch (error) {
    if (error.outdated || error.status === 426) {
      showReloadPrompt();
      return { ok: false, outdated: true, status: 426 };
    }
    if (error.status === 409) return finishConflict(error.serverState || null);
    console.error("Failed to save:", error.message || error);
    if (!quiet) showSaveError("Could not save changes. Your unsaved changes are still on this device.");
    return { ok: false, conflict: false, status: Number(error?.status) || 0 };
  }
}
