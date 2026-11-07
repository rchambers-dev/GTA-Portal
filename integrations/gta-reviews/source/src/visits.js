import {
  dateFromKey,
  formatShortDate,
  formatTime,
  formatUkDateKey,
  isConfirmedStop,
  lastReviewDateKey,
  parseTimeToMinutes,
  toDateKey,
  verifiedIds,
  weekdayName,
} from "./planner.js";
import { formatCycleStamp, previousSavedReview } from "./reviews.js";
import { escapeHtml } from "./lib/html.js";

function minutesFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

export function minutesFromIso(iso) {
  const date = iso ? new Date(iso) : null;
  return minutesFromDate(date);
}

function isDataUrl(value) {
  return String(value || "").startsWith("data:image/");
}

function normaliseSignature(value) {
  return isDataUrl(value) ? String(value) : "";
}

export function emptyVisitSignatures() {
  return { apprentice: "", employer: "", reviewer: "" };
}

export function normaliseVisitSignatures(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    apprentice: normaliseSignature(source.apprentice),
    employer: normaliseSignature(source.employer),
    reviewer: normaliseSignature(source.reviewer),
  };
}

export function emptyVisitStop() {
  return {
    arrivedAt: "",
    reviewedAt: "",
    leftAt: "",
    pdfOpenedAt: "",
    apprenticeComment: "",
    employerComment: "",
    apprenticeName: "",
    employerName: "",
    apprenticeSignedDate: "",
    employerSignedDate: "",
    signatures: emptyVisitSignatures(),
  };
}

export function emptyVisitDay(dateKey) {
  return {
    dateKey: String(dateKey || ""),
    finishedAt: "",
    plannedReturnMinutes: 0,
    actualReturnMinutes: null,
    stops: {},
  };
}

function normaliseVisitStop(value) {
  const base = emptyVisitStop();
  if (!value || typeof value !== "object") return base;
  return {
    arrivedAt: String(value.arrivedAt || ""),
    reviewedAt: String(value.reviewedAt || ""),
    leftAt: String(value.leftAt || ""),
    pdfOpenedAt: String(value.pdfOpenedAt || ""),
    apprenticeComment: String(value.apprenticeComment || "").trim(),
    employerComment: String(value.employerComment || "").trim(),
    apprenticeName: String(value.apprenticeName || "").trim(),
    employerName: String(value.employerName || "").trim(),
    apprenticeSignedDate: String(value.apprenticeSignedDate || "").slice(0, 10),
    employerSignedDate: String(value.employerSignedDate || "").slice(0, 10),
    signatures: normaliseVisitSignatures(value.signatures),
  };
}

export function normaliseVisitDays(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [dateKey, day] of Object.entries(value)) {
    if (!dateKey || !day || typeof day !== "object") continue;
    const stops = {};
    for (const [learnerId, stop] of Object.entries(day.stops || {})) {
      if (!learnerId) continue;
      stops[learnerId] = normaliseVisitStop(stop);
    }
    next[dateKey] = {
      dateKey,
      finishedAt: String(day.finishedAt || ""),
      plannedReturnMinutes: Number(day.plannedReturnMinutes) || 0,
      actualReturnMinutes:
        day.actualReturnMinutes == null ? null : Number(day.actualReturnMinutes) || 0,
      stops,
    };
  }
  return next;
}

export function ensureVisitDay(state, dateKey) {
  if (!state.visitDays || typeof state.visitDays !== "object") state.visitDays = {};
  if (!dateKey) return emptyVisitDay("");
  if (!state.visitDays[dateKey]) state.visitDays[dateKey] = emptyVisitDay(dateKey);
  return state.visitDays[dateKey];
}

export function visitStopFor(state, dateKey, learnerId) {
  const day = ensureVisitDay(state, dateKey);
  if (!learnerId) return emptyVisitStop();
  if (!day.stops[learnerId]) day.stops[learnerId] = emptyVisitStop();
  return day.stops[learnerId];
}

export function visitStopsFromDay(day) {
  const phone = (day?.phoneStops || []).map((stop, index) => ({
    ...stop,
    kind: "phone",
    order: stop.arrive ?? index,
  }));
  const visits = (day?.stops || []).map((stop, index) => ({
    ...stop,
    kind: stop.kind || "visit",
    order: stop.arrive ?? index,
  }));
  return [...phone, ...visits].sort(
    (a, b) => (a.arrive ?? a.order) - (b.arrive ?? b.order) || a.order - b.order,
  );
}

export function stampVisitArrive(state, dateKey, learnerId, at = new Date().toISOString()) {
  const stop = visitStopFor(state, dateKey, learnerId);
  if (!stop.arrivedAt) stop.arrivedAt = at;
  return stop;
}

export function patchVisitReview(state, dateKey, learnerId, patch = {}) {
  const stop = visitStopFor(state, dateKey, learnerId);
  if (patch.pdfOpenedAt != null) stop.pdfOpenedAt = String(patch.pdfOpenedAt || "");
  if (patch.apprenticeComment != null) stop.apprenticeComment = String(patch.apprenticeComment).trim();
  if (patch.employerComment != null) stop.employerComment = String(patch.employerComment).trim();
  if (patch.apprenticeName != null) stop.apprenticeName = String(patch.apprenticeName).trim();
  if (patch.employerName != null) stop.employerName = String(patch.employerName).trim();
  if (patch.apprenticeSignedDate != null) {
    stop.apprenticeSignedDate = String(patch.apprenticeSignedDate || "").slice(0, 10);
  }
  if (patch.employerSignedDate != null) {
    stop.employerSignedDate = String(patch.employerSignedDate || "").slice(0, 10);
  }
  if (patch.signatures) {
    stop.signatures = {
      ...stop.signatures,
      ...normaliseVisitSignatures({ ...stop.signatures, ...patch.signatures }),
    };
  }
  return stop;
}

export function stampVisitReview(state, dateKey, learnerId, patch = {}, at = new Date().toISOString()) {
  const stop = patchVisitReview(state, dateKey, learnerId, patch);
  if (!stop.reviewedAt) stop.reviewedAt = at;
  return stop;
}

export function visitSignaturesReady(signatures) {
  const next = normaliseVisitSignatures(signatures);
  return Boolean(next.apprentice && next.employer);
}

export function visitPartyReady(visit, role) {
  const key = role === "employer" ? "employer" : "apprentice";
  const name = key === "employer" ? visit?.employerName : visit?.apprenticeName;
  return Boolean(visit?.signatures?.[key] && String(name || "").trim());
}

export function visitReviewPartiesReady(visit) {
  return visitPartyReady(visit, "apprentice") && visitPartyReady(visit, "employer");
}

export function previousVisitPartyNote(state, learner, dateKey, role) {
  const previous = previousSavedReview(state, learner?.id, dateKey);
  const form = previous?.tutorForm || {};
  const comment =
    role === "employer"
      ? String(form.employerComment || "").trim()
      : String(form.apprenticeComment || "").trim();
  return {
    comment,
    dateKey: previous?.visitDateKey || previous?.dateKey || "",
  };
}

export function stampVisitLeave(state, dateKey, learnerId, at = new Date().toISOString()) {
  const stop = visitStopFor(state, dateKey, learnerId);
  if (!stop.leftAt) stop.leftAt = at;
  return stop;
}

export function plannedReturnMinutesFor(day, settings = {}) {
  if (Number.isFinite(day?.returnArrive) && day.returnArrive > 0) return day.returnArrive;
  return parseTimeToMinutes(settings.returnBy || "16:45");
}

export function maybeStampRoundEnd(state, dateKey, plannedReturnMinutes, now = new Date()) {
  const day = ensureVisitDay(state, dateKey);
  day.plannedReturnMinutes = plannedReturnMinutes || day.plannedReturnMinutes || 0;
  if (day.finishedAt) return day;
  const arrived = Object.values(day.stops || {}).filter((stop) => stop.arrivedAt);
  if (!arrived.length) return day;
  if (arrived.some((stop) => !stop.leftAt)) return day;
  const lastLeave = arrived
    .map((stop) => stop.leftAt)
    .sort()
    .at(-1);
  day.finishedAt = lastLeave || now.toISOString();
  day.actualReturnMinutes = minutesFromIso(day.finishedAt);
  return day;
}

export function roundTimingLabel(day) {
  const planned = Number(day?.plannedReturnMinutes) || 0;
  const actual =
    day?.actualReturnMinutes == null ? minutesFromIso(day?.finishedAt) : Number(day.actualReturnMinutes);
  if (!planned || actual == null || Number.isNaN(actual)) return "";
  const diff = Math.round(actual - planned);
  if (Math.abs(diff) <= 5) return `Finished on time · ${formatTime(actual)}`;
  if (diff < 0) return `Finished ${formatTime(actual)} · ${Math.abs(diff)} min early`;
  return `Finished ${formatTime(actual)} · ${diff} min late`;
}

export function visitTimingKind(day) {
  const planned = Number(day?.plannedReturnMinutes) || 0;
  const actual =
    day?.actualReturnMinutes == null ? minutesFromIso(day?.finishedAt) : Number(day.actualReturnMinutes);
  if (!planned || actual == null || Number.isNaN(actual)) return "idle";
  const diff = Math.round(actual - planned);
  if (Math.abs(diff) <= 5) return "on-time";
  return diff < 0 ? "early" : "late";
}

export function hasVisitWork(day) {
  return Boolean((day?.stops || []).length || (day?.phoneStops || []).length);
}

function clockLabel(iso) {
  return formatCycleStamp(iso);
}

function signaturePadHtml(role, label, image, dateLabel) {
  return `
    <div class="out-sign" data-sign-wrap="${escapeHtml(role)}">
      <div class="out-sign-head">
        <strong>${escapeHtml(label)}</strong>
        <span class="meta">Date ${escapeHtml(dateLabel)}</span>
      </div>
      <canvas class="out-sign-pad" data-sign-pad="${escapeHtml(role)}" width="640" height="180" aria-label="${escapeHtml(label)} signature"></canvas>
      <input type="hidden" data-sign-value="${escapeHtml(role)}" value="${escapeHtml(image)}" />
      <div class="out-sign-actions">
        <button type="button" class="btn ghost" data-sign-clear="${escapeHtml(role)}">Clear</button>
      </div>
    </div>
  `;
}

function stopStampLine(visit) {
  const bits = [];
  if (visit.arrivedAt) bits.push(`Arrived ${clockLabel(visit.arrivedAt)}`);
  if (visit.reviewedAt) bits.push(`Review ${clockLabel(visit.reviewedAt)}`);
  if (visit.leftAt) bits.push(`Left ${clockLabel(visit.leftAt)}`);
  return bits.join(" · ");
}

export function visitPartyInnerHtml({
  role,
  previousComment,
  previousDateKey,
  comment,
  signerName,
  signedDate,
  signature,
}) {
  const employer = role === "employer";
  const title = employer ? "Employer / Mentor" : "Apprentice";
  const lastLabel = previousDateKey
    ? `Last time · ${formatUkDateKey(previousDateKey)}`
    : "Last time";
  const dateLabel = formatUkDateKey(signedDate);
  return `
    <div class="tutor-help-card-head">
      <h3>${escapeHtml(title)}</h3>
      <button type="button" class="btn ghost" data-out-party-dismiss>Close</button>
    </div>
    <div class="tutor-help-body">
      <div class="tutor-pane tutor-pane-previous out-party-previous">
        <p class="meta">${escapeHtml(lastLabel)}</p>
        <p>${previousComment ? escapeHtml(previousComment) : "No comments from last time."}</p>
      </div>
      <label class="out-field">
        This visit
        <textarea name="comment" rows="5" placeholder="${employer ? "Employer / mentor comments" : "Apprentice comments"}">${escapeHtml(comment || "")}</textarea>
      </label>
      <label class="out-field">
        Name
        <input name="signerName" type="text" autocomplete="name" value="${escapeHtml(signerName || "")}" />
      </label>
      ${signaturePadHtml(employer ? "employer" : "apprentice", "Signature", signature || "", dateLabel)}
      <label class="out-field">
        Date
        <input name="signedDate" type="date" value="${escapeHtml(signedDate || "")}" />
      </label>
      <div class="out-review-actions">
        <button type="submit" class="btn primary">Save</button>
      </div>
    </div>
  `;
}

function visitMapsQuery(stop, learner) {
  const postcode = String(learner?.postcode || stop?.postcode || "").trim();
  if (!postcode) return "";
  const company = String(learner?.company || stop?.company || "").trim();
  return company ? `${company}, ${postcode}` : postcode;
}

function visitMapsLinksHtml(query) {
  if (!query) return "";
  return `<button type="button" class="btn ghost" data-out-maps="${escapeHtml(query)}">Maps</button>`;
}

function visitReviewButtonHtml(stopId, canReview, label) {
  return `<button type="button" class="btn ghost" data-out-open-review="${escapeHtml(stopId)}" ${canReview ? "" : "disabled"}>${escapeHtml(label)}</button>`;
}

export function visitStopCardHtml({
  stop,
  index,
  dateKey,
  visit,
  open,
  learner,
  pack,
  placeMeta,
  routeAccepted = true,
  showOpenReview = true,
  showMaps = false,
}) {
  const visitData = visit || emptyVisitStop();
  const arriveLabel = stop.kind === "phone" ? "Start call" : "Arrive";
  const leaveLabel = stop.kind === "phone" ? "End call" : "Leave";
  const stamps = stopStampLine(visitData);
  const doneClass = visitData.leftAt ? " is-left" : visitData.reviewedAt ? " is-reviewed" : visitData.arrivedAt ? " is-arrived" : "";
  const canRun = Boolean(routeAccepted) || Boolean(learner?.isTest) || Boolean(stop?.isTest);
  const canReview = canRun && Boolean(visitData.arrivedAt);
  const canLeave = canRun && Boolean(visitData.arrivedAt && !visitData.leftAt);
  const arriveDisabled = !canRun || Boolean(visitData.arrivedAt);
  const pdfOpened = Boolean(visitData.pdfOpenedAt);
  const employerDone = visitPartyReady(visitData, "employer");
  const apprenticeDone = visitPartyReady(visitData, "apprentice");
  return `
    <article class="stop out-stop${doneClass}${open ? " is-open" : ""}" data-out-stop="${escapeHtml(stop.id)}">
      <div class="when">
        <span class="arrive">${escapeHtml(formatTime(stop.arrive))}</span><span class="until">–${escapeHtml(formatTime(stop.leave))}</span>
      </div>
      <div>
        <strong class="stop-name">
          <span class="stop-num" aria-hidden="true">${index + 1}</span>
          ${escapeHtml(stop.name || learner?.name || "Learner")}
          ${stop.kind === "phone" ? '<span class="pill status-chip round">Phone</span>' : ""}
          ${learner?.isTest || stop?.isTest ? '<span class="pill status-chip round">Test</span>' : ""}
        </strong>
        <div class="meta">${escapeHtml(placeMeta || "")}</div>
        ${stamps ? `<div class="out-stamps">${escapeHtml(stamps)}</div>` : ""}
        <div class="out-stop-actions">
          <button type="button" class="btn ${visitData.arrivedAt ? "ghost" : "primary"}" data-out-arrive="${escapeHtml(stop.id)}" ${arriveDisabled ? "disabled" : ""}>${visitData.arrivedAt ? (stop.kind === "phone" ? "Started" : "Arrived") : arriveLabel}</button>
          <button type="button" class="btn ${canLeave ? "primary" : "ghost"}" data-out-leave="${escapeHtml(stop.id)}" ${canLeave ? "" : "disabled"}>${visitData.leftAt ? (stop.kind === "phone" ? "Ended" : "Left") : leaveLabel}</button>
          ${
            showOpenReview && !showMaps
              ? visitReviewButtonHtml(stop.id, canReview, "Open review")
              : ""
          }
        </div>
        ${
          showMaps
            ? `<div class="out-map-actions">
          ${visitMapsLinksHtml(visitMapsQuery(stop, learner))}
          ${showOpenReview ? visitReviewButtonHtml(stop.id, canReview, "Review") : ""}
        </div>`
            : ""
        }
        ${
          showOpenReview && canReview && pdfOpened
            ? `<div class="out-party-actions">
          <button type="button" class="btn ${employerDone ? "ghost" : "primary"}" data-out-party="employer" data-out-stop="${escapeHtml(stop.id)}">${employerDone ? "Employer / Mentor saved" : "Employer / Mentor"}</button>
          <button type="button" class="btn ${apprenticeDone ? "ghost" : "primary"}" data-out-party="apprentice" data-out-stop="${escapeHtml(stop.id)}">${apprenticeDone ? "Apprentice saved" : "Apprentice"}</button>
        </div>`
            : ""
        }
      </div>
    </article>
  `;
}

export function visitDayChipHtml(day, selectedKey) {
  const date = day.date || dateFromKey(day.dateKey);
  const when = date
    ? `${weekdayName(date) || day.day || ""} ${formatShortDate(date)}`.trim()
    : day.dateKey;
  const count = visitStopsFromDay(day).length;
  const label = count
    ? `${when} · ${count} review${count === 1 ? "" : "s"}`
    : when;
  const on = day.dateKey === selectedKey ? " on" : "";
  return `<button type="button" class="btn pill ghost${on}" data-out-day="${escapeHtml(day.dateKey)}">${escapeHtml(label)}</button>`;
}

export function visitPageHtml({
  day,
  visitDay,
  days,
  openLearnerId,
  learnerFor,
  packFor,
  placeMetaFor,
  routeAccepted = false,
  showOpenReview = true,
  showMaps = false,
}) {
  const rawDate = day?.date instanceof Date ? day.date : day?.dateKey ? dateFromKey(day.dateKey) : null;
  const date = rawDate instanceof Date && !Number.isNaN(rawDate.getTime()) ? rawDate : null;
  const heading = date
    ? `${weekdayName(date) || day?.day || "Out"} ${formatShortDate(date)}`
    : "Out";
  const stops = visitStopsFromDay(day);
  const plannedBack = plannedReturnMinutesFor(day);
  const timing = roundTimingLabel(visitDay);
  const timingKind = visitTimingKind(visitDay);
  const visited = Object.values(visitDay?.stops || {}).filter((item) => item.arrivedAt).length;
  const left = Object.values(visitDay?.stops || {}).filter((item) => item.leftAt).length;
  const reviewed = Object.values(visitDay?.stops || {}).filter((item) => item.reviewedAt).length;
  const canFinish = Boolean(routeAccepted) && visited && left >= visited;
  const emptyCopy = days.length
    ? "This day’s visits are already done."
    : "No upcoming review days yet. Plan the week to see what’s coming, then accept a route before you start.";
  return `
    <div class="panel-head">
      <h2 id="out-title">${escapeHtml(heading)}</h2>
      <span class="count" id="out-count">${stops.length}</span>
    </div>
    ${
      days.length
        ? `<div class="out-days">${days.map((item) => visitDayChipHtml(item, day?.dateKey)).join("")}</div>`
        : ""
    }
    ${
      day
        ? `<div class="out-round ${timingKind ? `is-${timingKind}` : ""}${routeAccepted ? "" : " is-locked"}">
      <p class="out-round-line">Back ${escapeHtml(formatTime(plannedBack))} · ${visited} in · ${reviewed} reviews · ${left} left${
        timing ? ` · ${escapeHtml(timing)}` : ""
      }</p>
      ${
        routeAccepted
          ? `<button type="button" class="btn ${canFinish ? "primary" : "ghost"}" data-out-finish ${canFinish ? "" : "disabled"}>Finish round</button>`
          : `<p class="accept-note">Locked until you accept this route on Plan.</p>`
      }
    </div>`
        : ""
    }
    ${
      stops.length
        ? `<div class="timeline">${stops
            .map((stop, index) =>
              visitStopCardHtml({
                stop,
                index,
                dateKey: day.dateKey,
                visit: visitDay?.stops?.[stop.id],
                open: openLearnerId === stop.id,
                learner: learnerFor?.(stop.id),
                pack: packFor?.(stop.id),
                placeMeta: placeMetaFor?.(stop),
                routeAccepted,
                showOpenReview,
                showMaps,
              }),
            )
            .join("")}</div>`
        : `<p class="empty">${emptyCopy}</p>`
    }
  `;
}

function padScale(canvas) {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function sizeSignaturePad(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = padScale(canvas);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

function signaturePadContext(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = padScale(canvas);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1a2332";
  return ctx;
}

function drawSignatureImage(canvas, dataUrl) {
  if (!canvas || !dataUrl) return;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    signaturePadContext(canvas);
  };
  img.src = dataUrl;
}

function storeSignaturePad(canvas) {
  const wrap = canvas.closest("[data-sign-wrap]");
  const role = canvas.dataset.signPad;
  const stored = wrap?.querySelector(`[data-sign-value="${role}"]`);
  if (!stored) return;
  stored.value = canvas.dataset.signed === "true" ? canvas.toDataURL("image/png") : "";
}

export function readVisitSignatures(formEl) {
  const next = emptyVisitSignatures();
  if (!formEl) return next;
  for (const role of Object.keys(next)) {
    const canvas = formEl.querySelector(`[data-sign-pad="${role}"]`);
    const stored = formEl.querySelector(`[data-sign-value="${role}"]`)?.value || "";
    if (canvas && canvas.dataset.signed === "true") {
      next[role] = canvas.toDataURL("image/png");
    } else {
      next[role] = stored;
    }
  }
  return next;
}

export function bindVisitSignaturePads(root) {
  if (!root) return;
  root.querySelectorAll("[data-sign-pad]").forEach((canvas) => {
    const wrap = canvas.closest("[data-sign-wrap]");
    const role = canvas.dataset.signPad;
    const stored = wrap?.querySelector(`[data-sign-value="${role}"]`)?.value || "";
    sizeSignaturePad(canvas);
    const ctx = signaturePadContext(canvas);
    if (stored) {
      canvas.dataset.signed = "true";
      drawSignatureImage(canvas, stored);
    }
    let drawing = false;
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };
    const start = (event) => {
      event.preventDefault();
      drawing = true;
      canvas.dataset.signed = "true";
      wrap?.classList.remove("is-missing");
      canvas.setPointerCapture?.(event.pointerId);
      const { x, y } = point(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (event) => {
      if (!drawing) return;
      event.preventDefault();
      const { x, y } = point(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = (event) => {
      if (!drawing) return;
      drawing = false;
      if (event?.pointerId != null) {
        try {
          canvas.releasePointerCapture?.(event.pointerId);
        } catch {
          // Already released.
        }
      }
      storeSignaturePad(canvas);
    };
    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
  });
}

export function clearVisitSignature(root, role) {
  const canvas = root?.querySelector(`[data-sign-pad="${role}"]`);
  const stored = root?.querySelector(`[data-sign-value="${role}"]`);
  if (canvas) {
    sizeSignaturePad(canvas);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signaturePadContext(canvas);
    canvas.dataset.signed = "";
  }
  if (stored) stored.value = "";
  root?.classList.remove("is-missing");
}

export function outStopStillOpen(stop, { dateKey, visit, learner, pack } = {}) {
  if (!dateKey) return false;
  if (visit?.leftAt || visit?.reviewedAt) return false;
  const last = lastReviewDateKey(learner || stop);
  if (last && last >= dateKey) return false;
  const packVisit = String(pack?.visitDateKey || "").slice(0, 10);
  if (packVisit && packVisit >= dateKey) return false;
  return true;
}

export function outDayStillOpen(day, visitDay, lookup = {}) {
  const stops = visitStopsFromDay(day);
  if (!stops.length) return false;
  return stops.some((stop) =>
    outStopStillOpen(stop, {
      dateKey: day.dateKey,
      visit: visitDay?.stops?.[stop.id],
      learner: lookup.learnerFor?.(stop.id) || stop,
      pack: lookup.packFor?.(stop.id),
    }),
  );
}

export function dayHasVerifiedReviews(day, verifiedByDate = {}) {
  const dateKey = day?.dateKey;
  const visits = day?.stops || [];
  if (!dateKey || !visits.length) return false;
  const verified = verifiedIds(verifiedByDate, dateKey);
  return visits.every((stop) => isConfirmedStop(stop, verified));
}

export function outDayOptions(planDays = [], acceptedRoutes = {}, lookup = {}) {
  const todayKey = lookup.todayKey || toDateKey(new Date());
  const byKey = new Map();
  for (const day of planDays || []) {
    if (!hasVisitWork(day) || !day.dateKey) continue;
    byKey.set(day.dateKey, day);
  }
  for (const [dateKey, snap] of Object.entries(acceptedRoutes || {})) {
    if (!hasVisitWork(snap)) continue;
    const existing = byKey.get(dateKey);
    if (existing) {
      existing.accepted = true;
      continue;
    }
    const date = dateFromKey(dateKey);
    byKey.set(dateKey, {
      ...snap,
      dateKey,
      date,
      day: snap.day || (date ? weekdayName(date) : ""),
      accepted: true,
    });
  }
  return [...byKey.values()]
    .filter((day) => {
      if (day.dateKey >= todayKey) return true;
      if (!day.accepted) return false;
      return outDayStillOpen(day, lookup.visitDayFor?.(day.dateKey), lookup);
    })
    .sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
}

export function pickOutDayKey(days, selectedDateKey, now = new Date()) {
  if (!days.length) return "";
  if (selectedDateKey && days.some((day) => day.dateKey === selectedDateKey)) return selectedDateKey;
  const today = toDateKey(now);
  return (
    days.find((day) => day.dateKey === today)?.dateKey ||
    days.find((day) => day.accepted)?.dateKey ||
    days[0].dateKey
  );
}
