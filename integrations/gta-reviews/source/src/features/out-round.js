import { outBody, outPageEnabledInput } from "../app/dom.js";
import { scheduleStateSave } from "../app/persist.js";
import { uiState } from "../app/ui-state.js";
import { isTestLearner } from "../lib/learners.js";
import {
  dateFromKey,
  formatUkDateKey,
  learnerProfileFrom,
  nextReviewDateKey,
  normaliseAppointment,
  parseTimeToMinutes,
  startOfLocalDay,
  toDateKey,
  weekdayName,
} from "../planner.js";
import {
  createSavedReview,
  currentCyclePack,
  emptyTutorForm,
  formatCycleStamp,
  updateSavedReview,
} from "../reviews.js";
import {
  bindVisitSignaturePads,
  ensureVisitDay,
  maybeStampRoundEnd,
  outDayOptions,
  patchVisitReview,
  pickOutDayKey,
  plannedReturnMinutesFor,
  previousVisitPartyNote,
  readVisitSignatures,
  stampVisitArrive,
  stampVisitLeave,
  stampVisitReview,
  visitPageHtml,
  visitPartyInnerHtml,
  visitReviewPartiesReady,
  visitSignaturesReady,
  visitStopFor,
  visitStopsFromDay,
} from "../visits.js";
import { previewLayer, previewReviewForm } from "./review-workflow/preview.js";

let hooks = null;

function reportUnbound() {
  console.error("Failed to run the out round:", "out round callbacks are not bound.");
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

// Placeholder until bindOutRound. It must not be spread or serialised.
// After bind, this binding is the real app state object.
export let state = unboundState();

export function setStatus(...args) {
  return callHook("setStatus", args, undefined);
}

export function setPage(...args) {
  return callHook("setPage", args, undefined);
}

export function findEditableLearner(...args) {
  return callHook("findEditableLearner", args, null);
}

export function logAction(...args) {
  return callHook("logAction", args, undefined);
}

export function rememberSelectedDay(...args) {
  return callHook("rememberSelectedDay", args, undefined);
}

export function alreadyPlanned(...args) {
  return callHook("alreadyPlanned", args, false);
}

export function refreshPlannedWeek(...args) {
  return callHook("refreshPlannedWeek", args, Promise.resolve());
}

export function completeRoute(...args) {
  return callHook("completeRoute", args, undefined);
}

export function applyPhoneSettingsClass(...args) {
  return callHook("applyPhoneSettingsClass", args, undefined);
}

export function pageFromHash(...args) {
  return callHook("pageFromHash", args, "");
}

export function isTutorMode(...args) {
  return callHook("isTutorMode", args, true);
}

export function isOfficeMode(...args) {
  return callHook("isOfficeMode", args, false);
}

export function learnerPlaceMeta(...args) {
  return callHook("learnerPlaceMeta", args, "");
}

export function bindOutRound(next) {
  hooks = next || null;
  state = next?.state || unboundState();
}

let phoneOutMq = null;
let outPhoneMq = null;

export function phonePreviewForced() {
  return new URLSearchParams(location.search).has("phone");
}

// Call only after mountOutRound. Before that, matchMedia has not been created.
export function isPhoneView() {
  return Boolean(phoneOutMq?.matches) || phonePreviewForced();
}

// Call only after mountOutRound. Before that, matchMedia has not been created.
export function isPhoneHandset() {
  return Boolean(outPhoneMq?.matches) || phonePreviewForced();
}

function canOpenOutReview() {
  return true;
}

export function phoneOutMode() {
  return isPhoneView() && !isTutorMode() && !isOfficeMode();
}

export function applyPhoneOutMode({ route = true } = {}) {
  const on = phoneOutMode();
  document.documentElement.toggleAttribute("data-phone-preview", phonePreviewForced());
  document.body.classList.toggle("phone-out", on);
  document.body.classList.toggle("out-phone", isPhoneHandset());
  applyPhoneSettingsClass();
  if (route && on && uiState.currentPage !== "out") setPage("out");
}

export function mountOutRound() {
  if (!phoneOutMq) {
    phoneOutMq = window.matchMedia(
      "(max-width: 720px), (max-width: 900px) and (pointer: coarse)",
    );
  }
  if (!outPhoneMq) {
    outPhoneMq = window.matchMedia(
      "(max-width: 767px), (max-height: 540px) and (pointer: coarse)",
    );
  }
  phoneOutMq.addEventListener("change", () => {
    applyPhoneOutMode();
    applyOutPageMode();
    if (!phoneOutMode() && uiState.currentPage === "out") {
      setPage(pageFromHash() || "records");
    } else if (uiState.currentPage === "out") {
      renderOut();
    }
  });

  outPhoneMq.addEventListener("change", () => {
    applyPhoneOutMode({ route: false });
    if (uiState.currentPage === "out") renderOut();
  });
}

export function outPageEnabled() {
  return state.settings?.outPageEnabled === true || phoneOutMode();
}

export function applyOutPageMode() {
  document.body.classList.toggle("out-off", !outPageEnabled());
  if (outPageEnabledInput) outPageEnabledInput.checked = state.settings?.outPageEnabled === true;
  if (!outPageEnabled() && uiState.currentPage === "out") setPage("plan");
}

function testLearnerOutStop(learner, dateKey, fallbackArrive) {
  const stay = Number(state.settings?.stayMinutes) || 30;
  const frozen = state.frozenTimes?.[dateKey]?.[learner.id] || {};
  const arrive = Number.isFinite(frozen.arrive) ? frozen.arrive : fallbackArrive;
  const leave = Number.isFinite(frozen.leave) ? frozen.leave : arrive + stay;
  return {
    id: learner.id,
    name: learner.name || "Test Learner",
    arrive,
    leave,
    company: learner.company || "",
    postcode: learner.postcode || "",
    tutor: learner.tutor || "",
    isTest: true,
    booked: false,
  };
}

function attachTestLearnerStops(days) {
  const test = (state.learners || []).find((item) => isTestLearner(item));
  if (!test) return days;
  const dateKeys = new Set();
  for (const [dateKey, ids] of Object.entries(state.pinnedRoutes || {})) {
    if ((ids || []).includes(test.id)) dateKeys.add(dateKey);
  }
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    if ((ids || []).includes(test.id)) dateKeys.add(dateKey);
  }
  if (!dateKeys.size) return days;
  return (days || []).map((day) => {
    if (!dateKeys.has(day.dateKey) || (day.stops || []).some((stop) => stop.id === test.id)) {
      return day;
    }
    const last = (day.stops || []).at(-1);
    const dayStart = parseTimeToMinutes(state.settings?.startTime || "10:00");
    const fallbackArrive = Number.isFinite(last?.leave) ? last.leave : dayStart;
    return {
      ...day,
      stops: [...(day.stops || []), testLearnerOutStop(test, day.dateKey, fallbackArrive || dayStart)],
    };
  });
}

function extraOutDays() {
  const keys = new Set([
    ...Object.keys(state.pinnedRoutes || {}),
    ...Object.keys(state.verifiedByDate || {}),
  ]);
  const stay = Number(state.settings?.stayMinutes) || 30;
  const start = parseTimeToMinutes(state.settings?.startTime || "10:00");
  const days = [];
  for (const dateKey of keys) {
    if (state.acceptedRoutes?.[dateKey]) continue;
    const ids = [
      ...new Set([
        ...(state.pinnedRoutes?.[dateKey] || []),
        ...(state.verifiedByDate?.[dateKey] || []),
      ]),
    ].filter(Boolean);
    if (!ids.length) continue;
    const frozen = state.frozenTimes?.[dateKey] || {};
    const date = dateFromKey(dateKey);
    days.push({
      dateKey,
      date,
      day: weekdayName(date),
      accepted: false,
      stops: ids.map((id, index) => {
        const learner = findEditableLearner(id) || {};
        const times = frozen[id] || {};
        const arrive = Number.isFinite(times.arrive) ? times.arrive : start + index * stay;
        const leave = Number.isFinite(times.leave) ? times.leave : arrive + stay;
        return {
          id,
          name: learner.name || "Learner",
          arrive,
          leave,
          company: learner.company || "",
          postcode: learner.postcode || "",
          tutor: learner.tutor || "",
          isTest: isTestLearner(learner, id),
          booked: normaliseAppointment(learner.appointment)?.dateKey === dateKey,
        };
      }),
      phoneStops: [],
    });
  }
  return days;
}

function outPlanDays() {
  return attachTestLearnerStops(
    outDayOptions([...extraOutDays(), ...(uiState.planResult?.days || [])], state.acceptedRoutes, {
      visitDayFor: (dateKey) => state.visitDays?.[dateKey],
      learnerFor: (id) => findEditableLearner(id),
      packFor: (id) => currentCyclePack(state, findEditableLearner(id)),
      verifiedByDate: state.verifiedByDate,
      todayKey: toDateKey(startOfLocalDay(new Date())),
    }),
  );
}

export function ensureOutPlan() {
  if (uiState.planResult?.days?.length) return Promise.resolve();
  if (!alreadyPlanned()) return Promise.resolve();
  return refreshPlannedWeek({
    rebuild: !uiState.planCache,
    fillGaps: false,
    resetSelection: false,
  });
}

function outRouteAccepted(dateKey) {
  return Boolean(dateKey && state.acceptedRoutes?.[dateKey]);
}

function outDayForKey(dateKey) {
  return outPlanDays().find((item) => item.dateKey === dateKey) || null;
}

export function renderOut() {
  if (!outBody) return;
  try {
    const days = outPlanDays();
    const dateKey = pickOutDayKey(days, uiState.selectedDateKey);
    if (dateKey && dateKey !== uiState.selectedDateKey) {
      const chosen = days.find((item) => item.dateKey === dateKey);
      if (chosen) rememberSelectedDay(chosen);
      else uiState.selectedDateKey = dateKey;
    }
    const day = outDayForKey(dateKey);
    const visitDay = ensureVisitDay(state, dateKey);
    if (day) {
      visitDay.plannedReturnMinutes = plannedReturnMinutesFor(day, state.settings);
      maybeStampRoundEnd(state, dateKey, visitDay.plannedReturnMinutes);
    }
    if (
      uiState.openOutLearnerId &&
      (!visitStopsFromDay(day).some((stop) => stop.id === uiState.openOutLearnerId) ||
        !visitDay.stops?.[uiState.openOutLearnerId]?.arrivedAt)
    ) {
      uiState.openOutLearnerId = "";
    }
    outBody.innerHTML = visitPageHtml({
      day,
      visitDay,
      days,
      openLearnerId: uiState.openOutLearnerId,
      learnerFor: (id) => findEditableLearner(id),
      packFor: (id) => currentCyclePack(state, findEditableLearner(id)),
      placeMetaFor: (stop) => learnerPlaceMeta(stop),
      routeAccepted: outRouteAccepted(dateKey) || Boolean(day?.accepted),
      showOpenReview: canOpenOutReview(),
      showMaps: phoneOutMode() || isPhoneHandset(),
    });
    bindVisitSignaturePads(outBody);
  } catch {
    outBody.innerHTML =
      '<div class="panel-head"><h2 id="out-title">Out</h2><span class="count" id="out-count">0</span></div><p class="empty">No upcoming review days yet. Plan the week to see what’s coming, then accept a route before you start.</p>';
  }
}

export function openOutForDay(dateKey) {
  if (!outPageEnabled()) {
    setStatus("Turn on the Out page in Settings first.");
    return;
  }
  const key = dateKey || uiState.selectedDateKey;
  const days = outPlanDays();
  if (key && !days.some((item) => item.dateKey === key)) {
    setStatus("That day has no upcoming reviews on Out yet.");
    return;
  }
  if (key) {
    const day = outDayForKey(key);
    if (day) rememberSelectedDay(day);
    else uiState.selectedDateKey = key;
  }
  setPage("out");
}

export function requireAcceptedOutRoute(dateKey = uiState.selectedDateKey, learnerId = "") {
  if (outRouteAccepted(dateKey) || outDayForKey(dateKey)?.accepted) return true;
  if (isTestLearner(findEditableLearner(learnerId), learnerId)) return true;
  setStatus("Accept this route on the Plan page before you start the round.");
  return false;
}

function ensureOutReviewPack(learner, dateKey) {
  let pack = currentCyclePack(state, learner);
  if (pack) return pack;
  return createSavedReview(state, {
    learnerId: learner.id,
    dateKey: dateKey || nextReviewDateKey(learner) || toDateKey(startOfLocalDay(new Date())),
    source: "visit",
  }).review;
}

function outReviewPatchFromForm(formEl) {
  return {
    apprenticeComment: String(formEl?.querySelector('[name="apprenticeComment"]')?.value || "").trim(),
    employerComment: String(formEl?.querySelector('[name="employerComment"]')?.value || "").trim(),
    signatures: readVisitSignatures(formEl),
  };
}

function saveOutReviewDraft(formEl) {
  const learnerId = formEl?.dataset.outReview;
  const dateKey = uiState.selectedDateKey;
  if (!formEl || !dateKey || !learnerId) return false;
  const patch = outReviewPatchFromForm(formEl);
  const current = visitStopFor(state, dateKey, learnerId);
  const same =
    current.apprenticeComment === patch.apprenticeComment &&
    current.employerComment === patch.employerComment &&
    current.signatures.apprentice === patch.signatures.apprentice &&
    current.signatures.employer === patch.signatures.employer &&
    current.signatures.reviewer === patch.signatures.reviewer;
  if (same) return false;
  patchVisitReview(state, dateKey, learnerId, patch);
  scheduleStateSave(true);
  return true;
}

export function flushOutDraft() {
  const formEl = outBody?.querySelector("[data-out-review]");
  if (!formEl) return false;
  return saveOutReviewDraft(formEl);
}

export async function openOutReviewPdf(learnerId) {
  const dateKey = uiState.selectedDateKey;
  const learner = findEditableLearner(learnerId);
  if (!dateKey || !learner) return;
  if (!requireAcceptedOutRoute(dateKey, learnerId)) return;
  const arrived = Boolean(state.visitDays?.[dateKey]?.stops?.[learnerId]?.arrivedAt);
  if (!arrived) {
    setStatus("Arrive first, then open the review.");
    return;
  }
  const pack = ensureOutReviewPack(learner, dateKey);
  closeOutPartyPopup();
  uiState.outPreviewLearnerId = learnerId;
  uiState.openOutLearnerId = learnerId;
  previewLayer()?.classList.add("is-out-preview");
  try {
    await previewReviewForm(learnerId, pack);
  } catch {
    uiState.outPreviewLearnerId = "";
    previewLayer()?.classList.remove("is-out-preview");
  }
}

export function stampOutPdfOpened(learnerId) {
  const dateKey = uiState.selectedDateKey;
  if (!dateKey || !learnerId) return;
  const stop = visitStopFor(state, dateKey, learnerId);
  if (!stop.arrivedAt) return;
  if (!stop.pdfOpenedAt) stop.pdfOpenedAt = new Date().toISOString();
  scheduleStateSave(true);
  renderOut();
  setStatus("Review closed. Capture employer / mentor and apprentice comments next.");
}

function outPartyPopupEls() {
  return {
    popup: document.getElementById("out-party-popup"),
    form: document.getElementById("out-party-form"),
  };
}

export function outMapsPopupEl() {
  return document.getElementById("out-maps-popup");
}

export function closeOutMapsPopup() {
  const popup = outMapsPopupEl();
  popup?.classList.remove("open");
  setTimeout(() => {
    if (popup && !popup.classList.contains("open")) popup.hidden = true;
  }, 420);
}

function nativeMapsPreferred() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function mapsLinksFor(place) {
  const encoded = encodeURIComponent(place);
  return {
    appleNative: `maps://maps.apple.com/?q=${encoded}`,
    appleWeb: `https://maps.apple.com/?q=${encoded}`,
    googleNative: `comgooglemaps://?q=${encoded}`,
    googleGeo: `geo:0,0?q=${encoded}`,
    googleWeb: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}

export function openMapsApp(kind, query) {
  const place = String(query || "").trim();
  if (!place) {
    setStatus("No postcode set for this stop.");
    return;
  }
  const links = mapsLinksFor(place);
  const native = nativeMapsPreferred();
  if (kind === "apple") {
    window.location.href = native ? links.appleNative : links.appleWeb;
    return;
  }
  if (/Android/i.test(navigator.userAgent)) {
    window.location.href = links.googleGeo;
    return;
  }
  window.location.href = native ? links.googleNative : links.googleWeb;
}

export function openOutMapsPopup(query) {
  const popup = outMapsPopupEl();
  const place = String(query || "").trim();
  if (!popup || !place) {
    setStatus("No postcode set for this stop.");
    return;
  }
  closeOutPartyPopup();
  const links = mapsLinksFor(place);
  const native = nativeMapsPreferred();
  const label = popup.querySelector("[data-out-maps-place]");
  const apple = popup.querySelector("[data-out-maps-apple]");
  const google = popup.querySelector("[data-out-maps-google]");
  popup.dataset.mapsQuery = place;
  if (label) label.textContent = place;
  if (apple) apple.href = native ? links.appleNative : links.appleWeb;
  if (google) {
    google.href = /Android/i.test(navigator.userAgent)
      ? links.googleGeo
      : native
        ? links.googleNative
        : links.googleWeb;
  }
  popup.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => popup.classList.add("open"));
  });
}

export function closeOutPartyPopup() {
  const { popup, form } = outPartyPopupEls();
  popup?.classList.remove("open");
  if (form) {
    form.dataset.learnerId = "";
    form.dataset.role = "";
  }
  setTimeout(() => {
    if (popup && !popup.classList.contains("open")) popup.hidden = true;
  }, 420);
}

export function openOutPartyPopup(learnerId, role) {
  const dateKey = uiState.selectedDateKey;
  const learner = findEditableLearner(learnerId);
  const { popup, form } = outPartyPopupEls();
  if (!dateKey || !learner || !popup || !form) return;
  if (!requireAcceptedOutRoute(dateKey, learnerId)) return;
  const visit = visitStopFor(state, dateKey, learnerId);
  if (!visit.arrivedAt) {
    setStatus("Arrive first, then open the review.");
    return;
  }
  if (!visit.pdfOpenedAt) {
    setStatus("Open the review first, then close the preview.");
    return;
  }
  const party = role === "employer" ? "employer" : "apprentice";
  const profile = learnerProfileFrom(learner);
  const previous = previousVisitPartyNote(state, learner, dateKey, party);
  const signedDate =
    (party === "employer" ? visit.employerSignedDate : visit.apprenticeSignedDate) || dateKey;
  const signerName =
    (party === "employer" ? visit.employerName : visit.apprenticeName) ||
    (party === "employer" ? profile.employerContact : learner.name) ||
    "";
  form.dataset.learnerId = learnerId;
  form.dataset.role = party;
  form.innerHTML = visitPartyInnerHtml({
    role: party,
    previousComment: previous.comment,
    previousDateKey: previous.dateKey,
    comment: party === "employer" ? visit.employerComment : visit.apprenticeComment,
    signerName,
    signedDate,
    signature: visit.signatures?.[party] || "",
  });
  popup.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.classList.add("open");
      bindVisitSignaturePads(form);
    });
  });
}

export function saveOutPartyForm(formEl) {
  const learnerId = formEl?.dataset.learnerId;
  const role = formEl?.dataset.role === "employer" ? "employer" : "apprentice";
  const dateKey = uiState.selectedDateKey;
  const learner = findEditableLearner(learnerId);
  if (!formEl || !dateKey || !learner) return;
  const signatures = readVisitSignatures(formEl);
  const signature = signatures[role];
  const signerName = String(formEl.querySelector('[name="signerName"]')?.value || "").trim();
  const signedDate = String(formEl.querySelector('[name="signedDate"]')?.value || dateKey).slice(0, 10);
  const comment = String(formEl.querySelector('[name="comment"]')?.value || "").trim();
  if (!signerName) {
    setStatus("Add a name, then sign.");
    return;
  }
  if (!signature) {
    formEl.querySelector("[data-sign-wrap]")?.classList.add("is-missing");
    setStatus("Draw a signature, then save.");
    return;
  }
  const patch = {
    signatures: { [role]: signature },
    [role === "employer" ? "employerComment" : "apprenticeComment"]: comment,
    [role === "employer" ? "employerName" : "apprenticeName"]: signerName,
    [role === "employer" ? "employerSignedDate" : "apprenticeSignedDate"]: signedDate || dateKey,
  };
  const stop = patchVisitReview(state, dateKey, learnerId, patch);
  scheduleStateSave(true);
  closeOutPartyPopup();
  if (visitReviewPartiesReady(stop)) {
    completeOutVisitReview(learner, dateKey, {});
    return;
  }
  renderOut();
  setStatus(
    role === "employer"
      ? `Employer / mentor comments saved for ${learner.name}.`
      : `Apprentice comments saved for ${learner.name}.`,
  );
}

export function arriveOutStop(learnerId) {
  const dateKey = uiState.selectedDateKey;
  const learner = findEditableLearner(learnerId);
  if (!dateKey || !learner) return;
  if (!requireAcceptedOutRoute(dateKey, learnerId)) return;
  flushOutDraft();
  const already = Boolean(state.visitDays?.[dateKey]?.stops?.[learnerId]?.arrivedAt);
  const stop = stampVisitArrive(state, dateKey, learnerId);
  const pack = ensureOutReviewPack(learner, dateKey);
  if (!already) logAction({ type: "arrived", learner, reviewId: pack?.id || "" });
  scheduleStateSave(true);
  uiState.openOutLearnerId = learnerId;
  renderOut();
  setStatus(`Arrived with ${learner.name} at ${formatCycleStamp(stop.arrivedAt)}.`);
}

export function leaveOutStop(learnerId) {
  const dateKey = uiState.selectedDateKey;
  const learner = findEditableLearner(learnerId);
  if (!dateKey || !learner) return;
  if (!requireAcceptedOutRoute(dateKey, learnerId)) return;
  flushOutDraft();
  const visit = state.visitDays?.[dateKey]?.stops?.[learnerId];
  if (!visit?.arrivedAt) {
    setStatus("Arrive first, then leave.");
    return;
  }
  const alreadyLeft = Boolean(visit.leftAt);
  const stop = stampVisitLeave(state, dateKey, learnerId);
  const day = outDayForKey(dateKey);
  maybeStampRoundEnd(state, dateKey, plannedReturnMinutesFor(day, state.settings));
  const pack = currentCyclePack(state, learner);
  if (!alreadyLeft) logAction({ type: "left", learner, reviewId: pack?.id || "" });
  scheduleStateSave(true);
  renderOut();
  const round = state.visitDays?.[dateKey];
  const timing = round?.finishedAt ? ` ${roundTimingStatus(round)}` : "";
  setStatus(`Left ${learner.name} at ${formatCycleStamp(stop.leftAt)}.${timing}`);
}

function roundTimingStatus(round) {
  const planned = Number(round?.plannedReturnMinutes) || 0;
  const actual = Number(round?.actualReturnMinutes);
  if (!planned || !Number.isFinite(actual)) return "";
  const diff = Math.round(actual - planned);
  if (Math.abs(diff) <= 5) return "Round finished on time.";
  if (diff < 0) return `Round finished ${Math.abs(diff)} min early.`;
  return `Round finished ${diff} min late.`;
}

export function saveOutReview(formEl) {
  const learnerId = formEl?.dataset.outReview;
  const dateKey = uiState.selectedDateKey;
  const learner = findEditableLearner(learnerId);
  if (!formEl || !dateKey || !learner) return;
  if (!requireAcceptedOutRoute(dateKey, learnerId)) return;
  const { apprenticeComment, employerComment, signatures } = outReviewPatchFromForm(formEl);
  if (!visitSignaturesReady(signatures)) {
    formEl.querySelectorAll("[data-sign-wrap]").forEach((wrap) => {
      const role = wrap.dataset.signWrap;
      wrap.classList.toggle("is-missing", !["apprentice", "employer"].includes(role) ? false : !signatures[role]);
    });
    setStatus("Apprentice and employer / mentor both need to sign.");
    return;
  }
  completeOutVisitReview(learner, dateKey, {
    apprenticeComment,
    employerComment,
    signatures,
  });
}

function completeOutVisitReview(learner, dateKey, patch) {
  if (!learner || !dateKey) return;
  const alreadyReviewed = Boolean(state.visitDays?.[dateKey]?.stops?.[learner.id]?.reviewedAt);
  const stop = stampVisitReview(state, dateKey, learner.id, patch);
  const pack = ensureOutReviewPack(learner, dateKey);
  updateSavedReview(state, pack.id, {
    visitDateKey: dateKey,
    tutorForm: {
      ...emptyTutorForm(),
      ...(pack.tutorForm || {}),
      apprenticeComment: stop.apprenticeComment,
      employerComment: stop.employerComment,
    },
    signatures: stop.signatures,
  });
  if (!alreadyReviewed) logAction({ type: "visit-review", learner, reviewId: pack.id });
  scheduleStateSave(true);
  uiState.openOutLearnerId = "";
  renderOut();
  setStatus(`Review signed for ${learner.name}. Date ${formatUkDateKey(dateKey)}.`);
}

export function finishOutRound() {
  const dateKey = uiState.selectedDateKey;
  if (!requireAcceptedOutRoute(dateKey)) return;
  flushOutDraft();
  const day = outDayForKey(dateKey);
  if (!day) {
    setStatus("Plan a round first.");
    return;
  }
  const visitDay = ensureVisitDay(state, dateKey);
  const reviewedIds = visitStopsFromDay(day)
    .map((stop) => stop.id)
    .filter((id) => visitDay.stops?.[id]?.reviewedAt);
  maybeStampRoundEnd(state, dateKey, plannedReturnMinutesFor(day, state.settings));
  if (reviewedIds.length) completeRoute(day, { onlyIds: reviewedIds });
  else scheduleStateSave(true);
  renderOut();
  const timing = roundTimingStatus(state.visitDays?.[dateKey]);
  setStatus(
    reviewedIds.length
      ? `${reviewedIds.length} review${reviewedIds.length === 1 ? "" : "s"} filed.${timing ? ` ${timing}` : ""}`
      : timing || "Round times saved.",
  );
}
