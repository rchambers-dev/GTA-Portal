import { currentSession, refreshAccessToken } from "../auth.js";
import { uiState } from "./ui-state.js";

let saveTimer;
let pendingSaveChain = Promise.resolve();
let reconcileInFlight = null;
let accountClosed = false;
let sessionHoldsSaves = false;
let deferredSave = false;
let deferredImmediate = false;
let saveEpoch = 0;
let rebookHoldActive = false;
let rebookBaselineDeferred = false;
let rebookBaselineImmediate = false;
let refreshInFlight = null;

let hooks = null;

export function bindPersist(next) {
  hooks = next;
}

function isAppApiUrl(url) {
  const text = String(url || "").trim();
  return text === "/api" || text.startsWith("/api/");
}

const REFRESH_TIMEOUT_MS = 8000;

function isNetworkFailure(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (name === "TypeError" || name === "TimeoutError" || name === "AuthRetryableFetchError") return true;
  if (error?.status === 0) return true;
  return /network|failed to fetch|fetch failed|load failed|timed out/i.test(message);
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("The network timed out.");
      error.name = "TimeoutError";
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// DEV-047-1: refreshShared is this app's slot. It de-duplicates our callers.
// After a timeout or sign-out, the guarantee that no second token request
// goes out relies on auth-js 2.117.x's single in-flight refresh, with no
// custom auth lock configured. Revisit both before upgrading auth-js.
// DEV-047-5: toggling "remember me" creates a new Supabase client, which
// will not share an in-flight refresh with the old one.
function refreshShared() {
  if (!refreshInFlight) {
    const pending = refreshAccessToken().finally(() => {
      if (refreshInFlight === pending) refreshInFlight = null;
    });
    pending.catch(() => {});
    refreshInFlight = pending;
  }
  const current = refreshInFlight;
  return withTimeout(current, REFRESH_TIMEOUT_MS).catch((error) => {
    if (error?.name === "TimeoutError" && refreshInFlight === current) refreshInFlight = null;
    throw error;
  });
}

function sessionUserId(session) {
  return session?.user?.id || "";
}

// Every bearer token goes through here, and only to a relative /api/ path.
// auth "none" is the desktop /api/state path, which must not send a session
// token. auth "required" refuses to send the request when there is no token.
// The user id is taken with the token before the request is sent. A 401
// refreshes once and retries only when that same user is still signed in.
// The session reads use the same timeout as the refresh. The error never
// includes the token.
export async function apiFetch(url, options = {}) {
  if (!isAppApiUrl(url)) {
    throw new Error("API requests must use a relative /api/ path.");
  }
  const {
    auth = "if-present",
    headers,
    retried = false,
    expectedUserId,
    ...rest
  } = options;
  let sessionHeaders = {};
  let sentUserId = "";
  if (auth !== "none") {
    const session = await withTimeout(currentSession(), REFRESH_TIMEOUT_MS);
    sentUserId = sessionUserId(session);
    if (expectedUserId !== undefined && sentUserId !== expectedUserId) {
      const error = new Error("Sign in again.");
      error.status = 401;
      throw error;
    }
    const token = session?.access_token;
    sessionHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  }
  if (auth === "required" && !sessionHeaders.Authorization) {
    const error = new Error("No authentication token");
    error.code = "NO_TOKEN";
    throw error;
  }
  const response = await fetch(url, {
    ...rest,
    headers: { ...(headers || {}), ...sessionHeaders },
  });
  if (response.status !== 401 || retried || auth === "none") return response;
  let refreshed = false;
  try {
    refreshed = await refreshShared();
  } catch (error) {
    if (isNetworkFailure(error)) throw error;
    const signIn = new Error("Sign in again.");
    signIn.status = 401;
    throw signIn;
  }
  if (!refreshed) {
    const error = new Error("Sign in again.");
    error.status = 401;
    throw error;
  }
  const userAfter = sessionUserId(await withTimeout(currentSession(), REFRESH_TIMEOUT_MS));
  if (userAfter !== sentUserId) {
    const error = new Error("Sign in again.");
    error.status = 401;
    throw error;
  }
  return apiFetch(url, { ...options, retried: true, expectedUserId: sentUserId });
}

export function clearScheduledSave() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
}

function holdsSaves() {
  return sessionHoldsSaves || uiState.holdRebookPersist;
}

export function deferScheduledSave() {
  if (!saveTimer) return;
  deferredSave = true;
  clearScheduledSave();
}

export function releaseHeldSaves() {
  if (!deferredSave || accountClosed || holdsSaves()) return undefined;
  const immediate = deferredImmediate;
  deferredSave = false;
  deferredImmediate = false;
  return scheduleStateSave(immediate);
}

export function discardHeldSaves() {
  deferredSave = false;
  deferredImmediate = false;
  clearScheduledSave();
}

export function beginRebookHold() {
  uiState.holdRebookPersist = true;
  deferScheduledSave();
  rebookBaselineDeferred = deferredSave;
  rebookBaselineImmediate = deferredImmediate;
  rebookHoldActive = true;
}

// Success drops the deferred copy because the rebook save already wrote it.
// A 409 drops only the save the rebook itself added, then lets the earlier
// save go out. Every other exit keeps that earlier save, and a session-conflict
// hold keeps it until the session hold ends.
export function settleRebookHold(outcome) {
  uiState.holdRebookPersist = false;
  if (!rebookHoldActive) return undefined;
  rebookHoldActive = false;
  if (outcome === "success") {
    discardHeldSaves();
    return undefined;
  }
  if (outcome === "conflict") {
    deferredSave = rebookBaselineDeferred;
    deferredImmediate = rebookBaselineImmediate;
  }
  return releaseHeldSaves();
}

export function abandonSession() {
  saveEpoch += 1;
  accountClosed = false;
  sessionHoldsSaves = false;
  rebookHoldActive = false;
  refreshInFlight = null;
  discardHeldSaves();
  clearTimeout(uiState.tutorSaveTimer);
  uiState.tutorSaveTimer = undefined;
  uiState.holdRebookPersist = false;
}

export function setSessionHoldsSaves(hold) {
  sessionHoldsSaves = hold;
  if (!hold) releaseHeldSaves();
}

export function closeAccount() {
  accountClosed = true;
  sessionHoldsSaves = true;
  deferredSave = false;
  deferredImmediate = false;
  clearScheduledSave();
}

export function accountIsClosed() {
  return accountClosed;
}

function reportUnboundSave() {
  console.error("Failed to persist state:", "save callbacks are not bound.");
}

export function scheduleStateSave(immediate = false) {
  if (!hooks) {
    reportUnboundSave();
    return undefined;
  }
  if (accountClosed) return undefined;
  if (holdsSaves()) {
    deferredSave = true;
    deferredImmediate = deferredImmediate || immediate;
    return undefined;
  }
  const runQueuedSave = () => {
    if (!hooks) {
      reportUnboundSave();
      return undefined;
    }
    const epoch = saveEpoch;
    hooks.pruneBookedAwaiting();
    pendingSaveChain = pendingSaveChain.then(() => {
      if (epoch !== saveEpoch || accountClosed || !hooks) return undefined;
      return hooks.saveState(hooks.getState());
    }).catch((error) => {
      console.error("Failed to persist state:", error.message || error);
    });
    return pendingSaveChain;
  };
  if (immediate) {
    clearTimeout(saveTimer);
    return runQueuedSave();
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(runQueuedSave, 200);
}

export function waitForReconcile() {
  return reconcileInFlight || Promise.resolve();
}

export async function reconcileVisibleState() {
  if (!hooks) {
    reportUnboundSave();
    return;
  }
  if (accountClosed || sessionHoldsSaves) return;
  if (document.visibilityState !== "visible") return;
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = (async () => {
    try {
      if (typeof hooks.waitForSaveQueue === "function") await hooks.waitForSaveQueue();
      if (document.visibilityState !== "visible") return;
      if (accountClosed || sessionHoldsSaves) return;
      if (uiState.dirtyDetails && typeof hooks.flushDirtyDetails === "function") {
        hooks.flushDirtyDetails();
      }
      const remote = await hooks.loadRemoteState();
      if (!remote) return;
      const state = hooks.getState();
      if (!hooks.adoptNewerRemotePlan(state, remote)) return;
      hooks.renderLearners();
      if (uiState.currentPage === "plan" && (uiState.planCache || uiState.planResult)) {
        hooks.applyCurrentPlan({
          refreshMap: false,
          updateStatus: false,
          fillGaps: false,
        });
      }
    } catch {
      // Keep the open tab usable if the live copy cannot be reached.
    } finally {
      reconcileInFlight = null;
    }
  })();
  pendingSaveChain = pendingSaveChain.then(() => reconcileInFlight);
  return reconcileInFlight;
}

export function queueTutorAutosave(formEl) {
  if (!formEl) return;
  clearTimeout(uiState.tutorSaveTimer);
  uiState.tutorSaveTimer = setTimeout(() => {
    if (typeof hooks?.saveTutorReview !== "function") {
      reportUnboundSave();
      return;
    }
    const saved = hooks.saveTutorReview(formEl, { sendBack: false });
    if (saved && typeof hooks.setStatus === "function") hooks.setStatus("Saved.");
  }, 800);
}
