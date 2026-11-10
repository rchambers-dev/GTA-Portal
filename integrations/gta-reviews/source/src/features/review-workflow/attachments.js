import { apiFetch, scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { supabaseClient } from "../../auth.js";
import { dateKeyFromFilename, daysBetweenDateKeys } from "../../lib/dates.js";
import { escapeHtml } from "../../lib/html.js";
import {
  addDays,
  dateFromKey,
  followingReviewDateKey,
  formatUkDateKey,
  formatWeeksAndDays,
  lastReviewDateKey,
  nextReviewDateKey,
  nextScheduledReviewDateKey,
  normaliseAppointment,
  normaliseDateKey,
  planningPriority,
  recordReview,
  reviewCycleDateKeys,
  reviewDueStatus,
  reviewIntervalWeeks,
  reviewScheduleEndKey,
  reviewTiming,
  toDateKey,
} from "../../planner.js";
import {
  findSavedReview,
  reviewLearner,
  updateSavedReview,
} from "../../reviews.js";
import { clientMessage, logClientError, readResponseJson } from "../../safe-error.js";
import {
  findEditableLearner,
  renderReviews,
  reviewDateLabel,
  reviewsTodayKey,
  setStatus,
  state,
} from "./runtime.js";

export function learnerDueDateOptions(learner) {
  const due = reviewDueStatus(learner);
  const next = nextReviewDateKey(learner) || due.next || "";
  const following = followingReviewDateKey(learner);
  const start = next || learner?.plannedReviewDate || "";
  const keys = new Set();
  const add = (key) => {
    const dateKey = String(key || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) keys.add(dateKey);
  };
  add(learner?.plannedReviewDate);
  add(next);
  add(following);
  for (const entry of learner?.reviewHistory || []) add(entry.plannedDateKey);
  if (start) {
    for (const key of reviewCycleDateKeys(start, reviewScheduleEndKey(learner), {
      includeStart: true,
      weeks: reviewIntervalWeeks(learner),
    })) {
      add(key);
    }
  }
  return [...keys].sort();
}

function dueDateOptionLabel(learner, dateKey) {
  const due = reviewDueStatus(learner);
  const label = reviewDateLabel(dateKey);
  if (dateKey === due.next) {
    const band = planningPriority(learner);
    if (band === "overdue") return `This review · overdue · ${formatUkDateKey(dateKey)}`;
    if (band === "due-this-week") return `This review · due this week · ${formatUkDateKey(dateKey)}`;
    return `This review · ${formatUkDateKey(dateKey)}`;
  }
  if (dateKey === followingReviewDateKey(learner)) return `Next cycle · ${formatUkDateKey(dateKey)}`;
  if (dateKey === learner?.plannedReviewDate) return `Cycle start · ${formatUkDateKey(dateKey)}`;
  return label;
}

export function previousReviewDefaultDate(learner) {
  const last = lastReviewDateKey(learner);
  if (last) return last;
  const planned = learner?.plannedReviewDate || "";
  const plannedDate = dateFromKey(planned);
  const today = reviewsTodayKey();
  if (plannedDate && planned > today) {
    return toDateKey(addDays(plannedDate, -reviewIntervalWeeks(learner) * 7));
  }
  return planned || today;
}

function reviewDoneDateOptions(learner, extraKey = "") {
  const keys = new Set(learnerDueDateOptions(learner));
  const add = (key) => {
    const dateKey = String(key || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) keys.add(dateKey);
  };
  add(extraKey);
  add(lastReviewDateKey(learner));
  add(reviewsTodayKey());
  add(previousReviewDefaultDate(learner));
  const start =
    dateFromKey(learner?.plannedReviewDate) ||
    dateFromKey(reviewsTodayKey());
  let cursor = start;
  for (let i = 0; i < 16 && cursor; i += 1) {
    add(toDateKey(cursor));
    cursor = addDays(cursor, -reviewIntervalWeeks(learner) * 7);
  }
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export function reviewDateSelectHtml(
  learner,
  selected,
  {
    label = "Date this review should have been done",
    attr = "data-completed-actual",
  } = {},
) {
  const selectedKey = selected || "";
  const options = reviewDoneDateOptions(learner, selectedKey)
    .map((key) => {
      const chosen = key === selectedKey ? "selected" : "";
      return `<option value="${escapeHtml(key)}" ${chosen}>${escapeHtml(dueDateOptionLabel(learner, key))}</option>`;
    })
    .join("");
  const empty = selectedKey
    ? ""
    : `<option value="" disabled hidden selected>Choose the date</option>`;
  return `
    <label class="reviews-date-field">${escapeHtml(label)}
      <select ${attr}>
        ${empty}
        ${options}
      </select>
    </label>
  `;
}

function reviewCompletedTimingLabel(actualDateKey, plannedDateKey) {
  const timing = reviewTiming(actualDateKey, plannedDateKey);
  const days = daysBetweenDateKeys(plannedDateKey, actualDateKey);
  if (days == null) return timing.label;
  if (timing.id === "on-time" || days === 0) return "On time";
  if (days < 0) return `${formatWeeksAndDays(-days)} early`;
  return `${formatWeeksAndDays(days)} overdue`;
}

export function reviewAsideDatesHtml({
  dueOn = "",
  completedOn = "",
  nextReviewOn = "",
  waiting = false,
  nextSend = "",
  plannedDefault = "",
} = {}) {
  if (completedOn || dueOn) {
    const late =
      completedOn && dueOn ? reviewCompletedTimingLabel(completedOn, dueOn) : "";
    return [
      dueOn ? `Should have been done ${formatUkDateKey(dueOn)}` : "",
      completedOn
        ? `Review completed on ${formatUkDateKey(completedOn)}`
        : "Set the date you completed it",
      late,
      nextReviewOn ? `Next review ${formatUkDateKey(nextReviewOn)}` : "",
    ]
      .filter(Boolean)
      .join("<br />");
  }
  if (waiting && nextSend) return `Send from ${formatUkDateKey(nextSend)}`;
  if (plannedDefault && nextReviewOn && nextReviewOn !== plannedDefault) {
    return `On ${formatUkDateKey(plannedDefault)}<br />Next review ${formatUkDateKey(nextReviewOn)}`;
  }
  if (plannedDefault) return `On ${formatUkDateKey(plannedDefault)}`;
  return "No due date yet";
}

export function reviewFilePickerHtml(dataAttr, buttonLabel) {
  return `
    <div class="reviews-file" data-review-file>
      <input type="file" class="reviews-file-input" accept="application/pdf,image/jpeg,image/png,image/webp" ${dataAttr} />
      <div class="reviews-file-empty" data-review-file-empty>
        <button type="button" class="btn" data-review-file-pick>${escapeHtml(buttonLabel)}</button>
        <span class="meta">PDF or photo</span>
      </div>
      <div class="reviews-file-chosen" data-review-file-chosen hidden>
        <p class="reviews-file-flag">File attached</p>
        <strong class="reviews-file-name" data-review-file-name></strong>
        <button type="button" class="btn ghost" data-review-file-pick>Change file</button>
      </div>
    </div>
  `;
}

export function refreshReviewFilePicker(box) {
  if (!box) return;
  const file = box.querySelector("input[type=file]")?.files?.[0];
  const empty = box.querySelector("[data-review-file-empty]");
  const chosen = box.querySelector("[data-review-file-chosen]");
  const name = box.querySelector("[data-review-file-name]");
  if (empty) empty.hidden = Boolean(file);
  if (chosen) chosen.hidden = !file;
  if (name) name.textContent = file?.name || "";
}

export function applyDateFromAttachedFile(box) {
  const input = box?.querySelector("input[type=file]");
  const key = dateKeyFromFilename(input?.files?.[0]?.name);
  if (!key) return;
  const formEl = box.closest("[data-review-workflow], [data-completed-review]");
  const select = formEl?.querySelector("select[data-completed-actual]");
  if (!select) return;
  if (![...select.options].some((option) => option.value === key)) {
    const learner = reviewLearner(
      state,
      formEl.dataset.reviewWorkflow || formEl.dataset.completedReview,
    );
    const option = document.createElement("option");
    option.value = key;
    option.textContent = dueDateOptionLabel(learner, key);
    select.insertBefore(option, select.firstChild);
  }
  select.value = key;
  updateCompletedTimingChip(formEl);
}

export function reviewDateHintButton(target, dateKey, label) {
  if (!dateKey) return "";
  return `<button type="button" class="btn pill ghost" data-review-date-hint="${escapeHtml(target)}" data-date="${escapeHtml(dateKey)}">${escapeHtml(label)}</button>`;
}

export function learnerPlannerVisitOptions(learner) {
  const byKey = new Map();
  const booked = normaliseAppointment(learner?.appointment)?.dateKey;
  if (booked) {
    byKey.set(booked, {
      dateKey: booked,
      source: "booked",
      label: `Booked visit · ${formatUkDateKey(booked)}`,
    });
  }
  for (const [dateKey, ids] of Object.entries(state.verifiedByDate || {})) {
    if (!Array.isArray(ids) || !ids.includes(learner?.id)) continue;
    byKey.set(dateKey, {
      dateKey,
      source: "verified",
      label: `Verified visit · ${formatUkDateKey(dateKey)}`,
    });
  }
  return [...byKey.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function reviewNameDateLabel(learner, dateKey) {
  const name = String(learner?.name || "Unknown learner").trim();
  const date = formatUkDateKey(dateKey);
  return date ? `${name} · ${date}` : name;
}

function tutorReviewDueKey(learner, pack) {
  return (
    normaliseDateKey(pack?.dateKey) ||
    nextReviewDateKey(learner) ||
    nextScheduledReviewDateKey(learner) ||
    normaliseDateKey(learner?.plannedReviewDate) ||
    ""
  );
}

export function tutorReviewLabel(learner, pack) {
  return reviewNameDateLabel(learner, tutorReviewDueKey(learner, pack));
}

export function reviewAttachmentName(learner, dateKey, originalName = "") {
  const name = String(learner?.name || "review")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  const date = formatUkDateKey(dateKey).replaceAll("/", "-") || "review";
  const ext = (String(originalName).match(/\.[a-z0-9]+$/i) || [".pdf"])[0];
  return `${name}_${date}${ext}`;
}

function isAllowedAttachmentUrl(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    return parsed.protocol === "https:" || parsed.protocol === "blob:";
  } catch {
    return false;
  }
}

export function attachmentHref(attachment, filename) {
  if (!attachment?.id) return "";
  const query = new URLSearchParams({ id: String(attachment.id) });
  const name = String(filename || attachment.filename || "").trim();
  if (name) query.set("name", name);
  return `/api/review-attachment?${query}`;
}

export async function openReviewAttachment(attachment, filename) {
  if (!attachment?.id) return;
  const supabase = supabaseClient();
  if (supabase) {
    const { data } = await supabase.storage.from("review-attachments").createSignedUrl(attachment.id, 3600);
    if (data?.signedUrl && isAllowedAttachmentUrl(data.signedUrl)) {
      window.open(data.signedUrl, "_blank", "noopener");
      return;
    }
  }
  const href = attachmentHref(attachment, filename);
  if (!href) return;
  if (href.startsWith("/api/review-attachment?") || isAllowedAttachmentUrl(href)) {
    window.open(href, "_blank", "noopener");
  }
}

export function completedTimingChip(actualDateKey, plannedDateKey) {
  const timing = reviewTiming(actualDateKey, plannedDateKey);
  return `<span class="reviews-timing" data-completed-timing data-timing="${escapeHtml(timing.id)}">${escapeHtml(reviewCompletedTimingLabel(actualDateKey, plannedDateKey))}</span>`;
}

export function printReviewSummary(learner, plannedDateKey, visitDateKey) {
  const title = reviewNameDateLabel(learner, plannedDateKey || visitDateKey);
  const visit = visitDateKey ? formatUkDateKey(visitDateKey) : "";
  if (!plannedDateKey) {
    return {
      text: "Choose which review this is.",
      button: "Print this review",
    };
  }
  return {
    text: visit
      ? `Print ${title} and take it to the visit on ${visit}.`
      : `Print ${title} and take it to the visit.`,
    button: `Print ${title}`,
  };
}

export function completedReviewSummary(learner, plannedDateKey, actualDateKey) {
  const title = reviewNameDateLabel(learner, actualDateKey || plannedDateKey);
  const done = actualDateKey ? formatUkDateKey(actualDateKey) : "";
  if (!plannedDateKey && !actualDateKey) {
    return {
      text: "After the visit, attach the scanned form.",
      button: "Save scanned review",
    };
  }
  const late = reviewCompletedTimingLabel(actualDateKey, plannedDateKey) || "";
  const when = done
    ? late === "On time"
      ? `The visit was on time, on ${done}.`
      : late
        ? `The visit was ${late.toLowerCase()}, on ${done}.`
        : `The visit was on ${done}.`
    : "";
  return {
    text: `This marks ${title} as done and keeps the scanned form. ${when}`.trim(),
    button: `Save scanned review · ${title}`,
  };
}

export function updateCompletedTimingChip(formEl) {
  const planned = formEl.querySelector("[data-completed-planned]")?.value || "";
  const actual = formEl.querySelector("[data-completed-actual]")?.value || "";
  const learnerId =
    formEl.dataset.reviewWorkflow ||
    formEl.dataset.completedReview ||
    formEl.closest("[data-learner-id]")?.dataset.learnerId;
  const learner = reviewLearner(state, learnerId);
  const timing = reviewTiming(actual, planned);
  const late = reviewCompletedTimingLabel(actual, planned);
  const chip = formEl.querySelector("[data-completed-timing]");
  if (chip) {
    chip.dataset.timing = timing.id;
    chip.textContent = late;
  }
  const aside = formEl.closest("[data-learner-id]")?.querySelector(".reviews-learner-aside .meta");
  if (aside && (planned || actual)) {
    aside.innerHTML = reviewAsideDatesHtml({
      dueOn: planned,
      completedOn: actual,
      nextReviewOn: actual ? nextReviewDateKey(actual) : "",
    });
  }
  const title = reviewNameDateLabel(learner, planned || actual);
  const reviewTitle = reviewNameDateLabel(learner, actual || planned);
  const previousButton = formEl.querySelector("[data-review-save='previous']");
  if (previousButton) {
    previousButton.textContent = actual || planned
      ? `Save previous review · ${reviewTitle}`
      : "Save previous review";
  }
  const readyButton = formEl.querySelector("[data-review-save='returned-upload']");
  if (readyButton) {
    readyButton.textContent = actual || planned
      ? `Save ready to print · ${reviewTitle}`
      : "Save ready to print";
  }
  const alreadyButton = formEl.querySelector("[data-review-save='already-done']");
  if (alreadyButton) {
    alreadyButton.textContent = actual || planned
      ? `Save ${reviewTitle} as already done`
      : "Save as already done";
  }
  const sendButton = formEl.querySelector("[data-review-save='send']");
  if (sendButton) sendButton.textContent = planned ? `Send ${title} to the tutor` : "Send to the tutor";
  const backButton = formEl.querySelector("[data-review-save='returned']");
  if (backButton) backButton.textContent = planned ? `Mark ${title} as back` : "Mark as back from tutor";
  const print = printReviewSummary(learner, planned, actual);
  const printNote = formEl.querySelector("[data-print-summary]");
  if (printNote) printNote.textContent = print.text;
  const printButton = formEl.querySelector("[data-review-save='print']");
  if (printButton) printButton.textContent = print.button;
  const done = completedReviewSummary(learner, planned, actual);
  const doneNote = formEl.querySelector("[data-completed-summary]");
  if (doneNote) doneNote.textContent = done.text;
  const doneButton = formEl.querySelector("[data-review-save='complete']");
  if (doneButton) doneButton.textContent = done.button;
}

export async function uploadReviewFile(file, { learner, dateKey } = {}) {
  const filename = reviewAttachmentName(learner, dateKey, file?.name);
  const supabase = supabaseClient();
  if (supabase) {
    const ext = (file?.name || filename).match(/\.[a-z0-9]+$/i)?.[0] || ".pdf";
    const id = `${crypto.randomUUID()}${ext}`;
    const { error } = await supabase.storage.from("review-attachments").upload(id, file, {
      upsert: true,
      contentType: file.type || "application/pdf",
    });
    if (error) {
      logClientError("Failed to upload review attachment to storage.");
    } else {
      return {
        id,
        filename,
        type: String(file.type || "application/pdf").split(";")[0].trim(),
      };
    }
  }
  const query = new URLSearchParams({ name: filename });
  const response = await apiFetch(`/api/review-attachment?${query}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/pdf" },
    body: file,
  });
  const payload = await readResponseJson(response, "Review attachment response was not JSON");
  if (!response.ok || !payload) {
    logClientError("Review attachment upload failed", response.status);
    throw new Error(clientMessage(payload?.error, "Could not upload that review."));
  }
  return {
    ...payload.attachment,
    filename,
  };
}

export function attachmentControls(attachment, { reviewId = "", learnerId = "", dateKey = "", learner } = {}) {
  const person = learner || reviewLearner(state, learnerId);
  const title = reviewNameDateLabel(person, dateKey);
  const filename = reviewAttachmentName(person, dateKey, attachment?.filename);
  const input = `<input class="visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-attach-file="${escapeHtml(reviewId || dateKey || learnerId)}" data-attach-learner="${escapeHtml(learnerId)}" data-attach-date="${escapeHtml(dateKey)}" />`;
  if (attachment?.id) {
    return `
      <div class="reviews-attachment">
        <a class="btn ghost" href="${escapeHtml(attachmentHref(attachment, filename))}" target="_blank" rel="noopener" data-open-attachment="${escapeHtml(attachment.id)}" data-open-attachment-name="${escapeHtml(filename)}">Open ${escapeHtml(title)}</a>
        <button type="button" class="btn ghost" data-review-action="attach">Replace</button>
        ${input}
      </div>
    `;
  }
  return `
    <div class="reviews-attachment">
      <button type="button" class="btn ghost" data-review-action="attach">Attach ${escapeHtml(title)}</button>
      ${input}
    </div>
  `;
}

export async function attachReviewFile({ reviewId, learnerId, dateKey, file }) {
  try {
    setStatus("Attaching the review...");
    const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
    const pack =
      (state.savedReviews || []).find((item) => item.id === reviewId) ||
      findSavedReview(state, learnerId, dateKey);
    const attachment = await uploadReviewFile(file, {
      learner,
      dateKey: dateKey || pack?.dateKey,
    });
    if (pack) updateSavedReview(state, pack.id, { attachment });
    if (learner) {
      const key = dateKey || pack?.dateKey;
      const entry = (learner.reviewHistory || []).find(
        (item) => item.actualDateKey === key || item.plannedDateKey === key,
      );
      if (entry) entry.attachment = attachment;
      else if (key && !pack) {
        recordReview(
          learner,
          { plannedDateKey: key, actualDateKey: key, attachment },
          "completed",
        );
      }
    }
    uiState.openReviewLearnerIds.add(learnerId);
    scheduleStateSave();
    renderReviews();
    setStatus(`Attached ${attachment.filename}.`);
  } catch (error) {
    setStatus(error.message || "Could not attach that review.");
  }
}
