import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import {
  lastReviewDateKey,
  nextScheduledReviewDateKey,
  recordReview,
  reviewDueStatus,
} from "../../planner.js";
import {
  applyExtractedTargets,
  applyTutorReturnedTargets,
  createSavedReview,
  extractTargetsFromPdf,
  findSavedReview,
  refreshCarriedTargets,
  rememberOpenTargets,
  reviewLearner,
  updateSavedReview,
} from "../../reviews.js";
import { clientMessage, logClientError } from "../../safe-error.js";
import { printSavedReview, sendSavedReview } from "./actions.js";
import { learnerDueDateOptions, reviewNameDateLabel, uploadReviewFile } from "./attachments.js";
import {
  findEditableLearner,
  holdReview,
  renderLearners,
  renderReviews,
  setStatus,
  state,
} from "./runtime.js";
import { workflowForm } from "./workflow-form.js";

export function sendReviewDateKey(learner) {
  const due = reviewDueStatus(learner);
  const dueDates = learnerDueDateOptions(learner);
  let planned =
    (due.next && dueDates.includes(due.next) && due.next) || dueDates[0] || "";
  const pack = findSavedReview(state, learner.id, planned);
  const last = lastReviewDateKey(learner);
  const next = nextScheduledReviewDateKey(learner);
  if (pack?.status === "completed" && next && next > last) planned = next;
  if (last && planned && planned <= last && next && next > last) planned = next;
  return planned;
}

function workflowDates(formEl) {
  return {
    plannedDateKey: formEl?.querySelector("[data-completed-planned]")?.value || "",
    visitDateKey: formEl?.querySelector("[data-completed-actual]")?.value || "",
  };
}

function ensureWorkflowPack(learnerId, plannedDateKey, visitDateKey, source = "plan") {
  const pack =
    findSavedReview(state, learnerId, plannedDateKey) ||
    createSavedReview(state, {
      learnerId,
      dateKey: plannedDateKey,
      source,
    }).review;
  refreshCarriedTargets(state, learnerId);
  const latest = findSavedReview(state, learnerId, plannedDateKey) || pack;
  return updateSavedReview(state, latest.id, {
    visitDateKey: visitDateKey || latest.visitDateKey,
    dateKey: plannedDateKey,
    previousTargets: latest.previousTargets,
    isInitial: latest.isInitial,
  });
}

export async function savePreviousReviewUpload(learnerId) {
  const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
  const formEl = workflowForm(learnerId);
  if (!learner || !formEl) return;
  const { plannedDateKey, visitDateKey } = workflowDates(formEl);
  if (!plannedDateKey) {
    setStatus("Pick which review this previous form belongs in front of.");
    return;
  }
  if (!visitDateKey) {
    setStatus("Pick the date of that previous review.");
    return;
  }
  const file = formEl.querySelector("[data-previous-attachment]")?.files?.[0];
  if (!file) {
    setStatus("Choose the previous review file first.");
    return;
  }
  try {
    setStatus("Saving the previous review...");
    const reviewDateKey = visitDateKey || plannedDateKey;
    const attachment = await uploadReviewFile(file, { learner, dateKey: reviewDateKey });
    const pack = ensureWorkflowPack(learnerId, plannedDateKey, visitDateKey, "previous");
    if (file && /\.pdf$/i.test(file.name || "")) {
      const extracted = await extractTargetsFromPdf(await file.arrayBuffer());
      const patch = applyExtractedTargets(pack, extracted, "last");
      updateSavedReview(state, pack.id, {
        ...patch,
        previousAttachment: attachment,
        previousDateKey: reviewDateKey,
        visitDateKey,
      });
    } else {
      updateSavedReview(state, pack.id, {
        previousAttachment: attachment,
        previousDateKey: reviewDateKey,
        visitDateKey,
      });
    }
    rememberOpenTargets(learner, findSavedReview(state, learnerId, plannedDateKey));
    uiState.openReviewLearnerIds.add(learnerId);
    scheduleStateSave();
    renderReviews();
    setStatus(
      `Previous review saved for ${reviewNameDateLabel(learner, reviewDateKey)}. Targets will carry into the form you send.`,
    );
  } catch (error) {
    setStatus(error.message || "Could not save that previous review.");
  }
}

export async function saveReturnedReviewUpload(learnerId) {
  const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
  const formEl = workflowForm(learnerId);
  if (!learner || !formEl) return;
  const { plannedDateKey, visitDateKey } = workflowDates(formEl);
  if (!plannedDateKey) {
    setStatus("Pick which review this is.");
    return;
  }
  if (!visitDateKey) {
    setStatus("Pick the date of the review.");
    return;
  }
  const file =
    formEl.querySelector("[data-previous-attachment]")?.files?.[0] ||
    formEl.querySelector("[data-returned-attachment]")?.files?.[0];
  if (!file) {
    setStatus("Choose the review they sent back first.");
    return;
  }
  try {
    setStatus("Saving the review they sent back...");
    const reviewDateKey = visitDateKey || plannedDateKey;
    const attachment = await uploadReviewFile(file, { learner, dateKey: reviewDateKey });
    const pack = ensureWorkflowPack(learnerId, plannedDateKey, visitDateKey, "returned");
    const patch = {};
    if (file && /\.pdf$/i.test(file.name || "")) {
      const extracted = await extractTargetsFromPdf(await file.arrayBuffer());
      Object.assign(patch, applyTutorReturnedTargets(extracted));
    }
    const saved = updateSavedReview(state, pack.id, {
      ...patch,
      previousAttachment: attachment,
      returnedAttachment: attachment,
      previousDateKey: reviewDateKey,
      visitDateKey,
    });
    rememberOpenTargets(learner, saved);
    holdReview(pack.id, "returned");
    uiState.openReviewLearnerIds.add(learnerId);
    scheduleStateSave();
    renderReviews();
    setStatus(
      `${reviewNameDateLabel(learner, reviewDateKey)} is back. You can print it now.`,
    );
  } catch (error) {
    setStatus(error.message || "Could not save that review ready to print.");
  }
}

export async function sendWorkflowReview(learnerId) {
  try {
    const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
    const formEl = workflowForm(learnerId);
    if (!learner || !formEl) return;
    const { plannedDateKey: pickedDate, visitDateKey } = workflowDates(formEl);
    const plannedDateKey = sendReviewDateKey(learner) || pickedDate;
    if (!plannedDateKey) {
      setStatus("Pick which review to send.");
      return;
    }
    const pack = ensureWorkflowPack(learnerId, plannedDateKey, visitDateKey, "send");
    uiState.openReviewLearnerIds.add(learnerId);
    scheduleStateSave();
    await sendSavedReview(findSavedReview(state, learnerId, pack.dateKey) || pack);
  } catch (error) {
    logClientError("Failed to send review.");
    setStatus(clientMessage(error, "Could not send the review form."));
  }
}

export async function markWorkflowReturned(learnerId) {
  const formEl = workflowForm(learnerId);
  const { plannedDateKey, visitDateKey } = workflowDates(formEl);
  if (!plannedDateKey) {
    setStatus("Pick which review came back.");
    return;
  }
  const pack = ensureWorkflowPack(learnerId, plannedDateKey, visitDateKey, "returned");
  if (pack.status === "completed" || pack.status === "print") {
    setStatus("This review has already moved past this step.");
    return;
  }
  const file = formEl.querySelector("[data-returned-attachment]")?.files?.[0];
  if (file) {
    try {
      setStatus("Saving the form they sent back...");
      const learner = reviewLearner(state, learnerId);
      const attachment = await uploadReviewFile(file, {
        learner,
        dateKey: plannedDateKey,
      });
      const patch = { returnedAttachment: attachment, visitDateKey };
      if (/\.pdf$/i.test(file.name || "")) {
        const extracted = await extractTargetsFromPdf(await file.arrayBuffer());
        Object.assign(patch, applyTutorReturnedTargets(extracted));
      }
      const saved = updateSavedReview(state, pack.id, patch);
      rememberOpenTargets(learner, saved);
    } catch (error) {
      setStatus(error.message || "Could not attach the form they sent back.");
      return;
    }
  }
  holdReview(pack.id, "returned");
  uiState.openReviewLearnerIds.add(learnerId);
  scheduleStateSave();
  renderReviews();
  setStatus(
    `${reviewNameDateLabel(reviewLearner(state, learnerId), plannedDateKey)} is back. You can print it now.`,
  );
}

export async function saveReadyToPrint(learnerId) {
  const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
  const formEl = workflowForm(learnerId);
  if (!learner || !formEl) return;
  const { plannedDateKey, visitDateKey } = workflowDates(formEl);
  if (!plannedDateKey) {
    setStatus("Pick which review to print.");
    return;
  }
  const pack = ensureWorkflowPack(learnerId, plannedDateKey, visitDateKey, "print");
  if (pack.status !== "returned" && pack.status !== "print") {
    setStatus("Wait until the tutor has sent this review back, then print it.");
    return;
  }
  uiState.openReviewLearnerIds.add(learnerId);
  try {
    await printSavedReview(pack);
  } catch (error) {
    setStatus(error.message || "Marked as printed, but the form could not download.");
  }
}

export async function saveCompletedPreviousReview(learnerId, { alreadyDone = false } = {}) {
  const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
  const formEl = workflowForm(learnerId);
  if (!learner || !formEl) return;
  const { plannedDateKey, visitDateKey } = workflowDates(formEl);
  const actualDateKey = visitDateKey;
  if (!plannedDateKey || !actualDateKey) {
    setStatus("Pick the review and the visit date first.");
    return;
  }
  const file = alreadyDone
    ? formEl.querySelector("[data-already-done-attachment]")?.files?.[0]
    : formEl.querySelector("[data-completed-attachment]")?.files?.[0];
  if (!file) {
    setStatus(
      alreadyDone
        ? "Attach the completed review for this apprentice first."
        : "Attach the scanned form from the visit first.",
    );
    return;
  }
  let attachment = null;
  try {
    setStatus(alreadyDone ? "Saving the completed review..." : "Saving the scanned review...");
    attachment = await uploadReviewFile(file, { learner, dateKey: actualDateKey || plannedDateKey });
  } catch (error) {
    setStatus(error.message || "Could not attach that review.");
    return;
  }
  recordReview(learner, { plannedDateKey, actualDateKey, attachment }, "completed");
  const pack =
    findSavedReview(state, learnerId, plannedDateKey) ||
    findSavedReview(state, learnerId, actualDateKey) ||
    createSavedReview(state, {
      learnerId,
      dateKey: plannedDateKey,
      source: "completed",
    }).review;
  updateSavedReview(state, pack.id, {
    visitDateKey: actualDateKey,
    attachment,
  });
  holdReview(pack.id, "completed");
  if (file && /\.pdf$/i.test(file.name || "")) {
    try {
      const extracted = await extractTargetsFromPdf(await file.arrayBuffer());
      const latest = findSavedReview(state, learnerId, pack.dateKey) || pack;
      const patch = applyExtractedTargets(
        latest,
        extracted,
        latest.isInitial ? "initial" : "last",
      );
      updateSavedReview(state, pack.id, {
        ...patch,
        attachment,
        visitDateKey: actualDateKey,
      });
    } catch {
      // The scanned file is still attached even if targets cannot be read.
    }
  }
  refreshCarriedTargets(state, learnerId);
  rememberOpenTargets(learner, findSavedReview(state, learnerId, pack.dateKey));
  uiState.openReviewLearnerIds.add(learnerId);
  scheduleStateSave();
  renderReviews();
  renderLearners();
  setStatus(
    alreadyDone
      ? `${reviewNameDateLabel(learner, plannedDateKey)} is saved as already done. The next cycle can start from this.`
      : `${reviewNameDateLabel(learner, plannedDateKey)} is now done. The scanned form is saved.`,
  );
}
