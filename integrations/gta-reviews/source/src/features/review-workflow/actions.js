import { reviewsList } from "../../app/dom.js";
import { cssEscape } from "../../lib/html.js";
import { scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { routeMailtoHref } from "../../lib/format.js";
import { REVIEW_TARGET_SLOTS, emptyTarget, reviewLearner, setReviewHolder } from "../../reviews.js";
import { clientMessage, logClientError } from "../../safe-error.js";
import { reviewNameDateLabel, updateCompletedTimingChip } from "./attachments.js";
import {
  holdReview,
  loadReviewFormPdf,
  previewReviewForm,
  readSettingsIntoState,
  renderReviews,
  reviewDateLabel,
  reviewFormEmailBody,
  reviewsTodayKey,
  saveReviewTargets,
  setStatus,
  state,
} from "./runtime.js";
import { workflowForm } from "./workflow-form.js";

export function handleReviewAction(reviewId, action, learnerId = "") {
  const review =
    (state.savedReviews || []).find((item) => item.id === reviewId) || null;
  if (learnerId) uiState.openReviewLearnerIds.add(learnerId);
  if (action === "toggle") {
    if (!review) return;
    if (uiState.openReviewIds.has(reviewId)) uiState.openReviewIds.delete(reviewId);
    else uiState.openReviewIds.add(reviewId);
    renderReviews();
    return;
  }
  if (action === "add-target") {
    if (!review) return;
    const used = (review.newTargets || []).filter((item) => item.action).length;
    const rows = (review.newTargets || []).length;
    if (used >= REVIEW_TARGET_SLOTS || rows >= REVIEW_TARGET_SLOTS) {
      setStatus(`The form only has ${REVIEW_TARGET_SLOTS} new target rows.`);
      return;
    }
    uiState.openReviewIds.add(reviewId);
    if (!reviewsList?.querySelector(`[data-review-targets="${cssEscape(reviewId)}"]`)) {
      renderReviews();
    }
    saveReviewTargets(reviewId, [emptyTarget()]);
    return;
  }
  if (action === "preview") {
    if (!review) return;
    previewReviewForm(review.learnerId, review);
    return;
  }
  if (action === "send") {
    if (!review) return;
    sendSavedReview(review);
    return;
  }
  if (action === "print") {
    if (!review) return;
    printSavedReview(review);
    return;
  }
  if (action === "return") {
    if (!review) return;
    holdReview(reviewId, "returned");
    scheduleStateSave();
    renderReviews();
    setStatus("The tutor has sent it back. You can print it now.");
    return;
  }
  if (action === "hold") {
    if (!review) return;
    setReviewHolder(state, reviewId, "reviewer");
    scheduleStateSave();
    renderReviews();
    setStatus("Moved back to the reviewer, ready to send again.");
    return;
  }
  if (action === "complete") {
    const form = workflowForm(learnerId || review?.learnerId);
    if (form && review) {
      const planned = form.querySelector("[data-completed-planned]");
      const actual = form.querySelector("[data-completed-actual]");
      if (planned) {
        if (![...planned.options].some((option) => option.value === review.dateKey)) {
          planned.add(new Option(reviewDateLabel(review.dateKey), review.dateKey));
        }
        planned.value = review.dateKey;
      }
      if (actual) {
        const visit = [...(actual.options || [])].some((option) => option.value === review.dateKey);
        if (visit) actual.value = review.dateKey;
        else if (actual.tagName !== "SELECT" && !actual.value) actual.value = reviewsTodayKey();
      }
      updateCompletedTimingChip(form);
      form.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}

export async function sendSavedReview(review) {
  try {
    const result = await loadReviewFormPdf(review.learnerId, {
      reviewId: review.id,
      dateKey: review.dateKey,
    });
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.fileUrl;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    holdReview(review.id, "tutor");
    scheduleStateSave();
    renderReviews();
    readSettingsIntoState();
    const href = routeMailtoHref(
      `Tripartite progress review — ${result.learner.name} — ${reviewDateLabel(review.dateKey)}`,
      reviewFormEmailBody(result.learner, review),
      state.settings.email,
    );
    window.location.href = href;
    setStatus(
      `Downloaded ${result.learner.name}’s review and marked it as with the tutor.`,
    );
  } catch (error) {
    logClientError("Failed to send the review form.");
    setStatus(clientMessage(error, "Could not send the review form."));
  }
}

function downloadReviewLink(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "review.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function printSavedReview(review) {
  const learner = reviewLearner(state, review.learnerId);
  const result = await loadReviewFormPdf(review.learnerId, {
    reviewId: review.id,
    dateKey: review.dateKey,
  });
  if (result) downloadReviewLink(result.fileUrl, result.filename);
  holdReview(review.id, "print");
  scheduleStateSave();
  renderReviews();
  setStatus(
    `${reviewNameDateLabel(learner, review.dateKey)} is printed. After the visit, upload the scanned form.`,
  );
}
