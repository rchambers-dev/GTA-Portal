import { renderAsync as renderDocxPreview } from "docx-preview";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import { recordsList } from "../../app/dom.js";
import { apiFetch, scheduleStateSave } from "../../app/persist.js";
import { uiState } from "../../app/ui-state.js";
import { routeMailtoHref } from "../../lib/format.js";
import {
  DEFAULT_GTA_REVIEWER,
  formatUkDateKey,
  learnerProfileFrom,
  nextReviewDateKey,
} from "../../planner.js";
import { buildReviewPdfBlob } from "../../review-pdf.js";
import { fillReviewFormDocx, loadWordTemplate, reviewDocxFilename } from "../../review-word.js";
import { refreshCarriedTargets, reviewLearner } from "../../reviews.js";
import { tutorReviewLabel, uploadReviewFile } from "./attachments.js";
import { cssEscape } from "../../lib/html.js";
import {
  findEditableLearner,
  logAction,
  readSettingsIntoState,
  reviewDateLabel,
  saveManagedDetails,
  setStatus,
  stampOutPdfOpened,
  state,
} from "./runtime.js";

export function reviewFormEmailBody(learner, review) {
  const profile = learnerProfileFrom(learner);
  const nextDate = formatUkDateKey(nextReviewDateKey(learner));
  const previousCount = (review?.previousTargets || []).filter((item) => item.action).length;
  return [
    "Please find the prepopulated tripartite progress review form attached.",
    review
      ? `Planned review date: ${reviewDateLabel(review.dateKey)}. Previous targets are already on the form — please add new ones only.`
      : "",
    previousCount
      ? `${previousCount} previous target${previousCount === 1 ? "" : "s"} have been carried forward.`
      : review?.isInitial
        ? "This is the first saved review. Starting targets are already filled in."
        : "",
    "",
    "Section 1 — Review details",
    `Apprentice name: ${learner.name || "not set"}`,
    `Review date: leave blank — write in the appointment once it is booked`,
    `Apprenticeship standard / route / level: ${profile.apprenticeship || "not set"}`,
    `Release day: ${learner.collegeDay || "not set"}`,
    `GTA tutor: ${profile.tutor || "not set"}`,
    `GTA reviewer: ${profile.gtaReviewer || DEFAULT_GTA_REVIEWER}`,
    `Apprenticeship start date: ${formatUkDateKey(profile.apprenticeshipStartDate) || "not set"}`,
    `Apprenticeship planned end date: ${formatUkDateKey(profile.apprenticeshipEndDate) || "not set"}`,
    `Employer / workplace: ${learner.company || "not set"}`,
    `Postcode: ${learner.postcode || "not set"}`,
    `Employer contact name: ${profile.employerContact || "not set"}`,
    `Employer contact phone: ${profile.contactNumber || "not set"}`,
    `Employer contact email: ${profile.employerEmail || "not set"}`,
    `Next review date: ${nextDate || "not set"}`,
  ].join("\r\n");
}

function findReviewPack(learnerId, { reviewId = "", dateKey = "" } = {}) {
  const packs = state.savedReviews || [];
  if (reviewId) return packs.find((item) => item.id === reviewId) || null;
  if (dateKey) {
    return packs.find((item) => item.learnerId === learnerId && item.dateKey === dateKey) || null;
  }
  return null;
}

function saveOpenRecordsForPreview(learnerId) {
  if (!recordsList?.querySelector(`[data-records-details="${cssEscape(learnerId)}"]`)) return true;
  if (uiState.dirtyDetails?.learnerId !== learnerId) return true;
  return saveManagedDetails(learnerId, { keepCheck: true });
}

export async function loadReviewFormPdf(learnerId, { reviewId = "", dateKey = "" } = {}) {
  const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
  if (!learner) return null;
  saveOpenRecordsForPreview(learnerId);
  scheduleStateSave();
  refreshCarriedTargets(state, learnerId);
  const pack = findReviewPack(learnerId, { reviewId, dateKey });
  const result = await buildReviewPdfBlob(learner, pack);
  return { learner, filename: result.filename, fileUrl: result.fileUrl, blob: result.blob };
}

export function previewLayer() {
  return document.getElementById("pdf-preview-layer");
}

function previewStageEls() {
  return {
    layer: previewLayer(),
    pdf: document.getElementById("pdf-preview-pdf"),
    word: document.getElementById("pdf-preview-word"),
    empty: document.getElementById("pdf-preview-empty"),
    heading: document.getElementById("pdf-preview-title"),
    download: document.getElementById("pdf-preview-download"),
  };
}

function openPreviewShell() {
  const layer = previewLayer();
  if (layer) layer.hidden = false;
}

function resetPreviewStage() {
  const { pdf, word, empty, download } = previewStageEls();
  if (pdf) {
    pdf.innerHTML = "";
    pdf.hidden = true;
  }
  if (word) {
    word.innerHTML = "";
    word.hidden = true;
  }
  if (empty) empty.hidden = false;
  if (download) {
    download.removeAttribute("href");
    download.removeAttribute("download");
  }
}

function setPreviewDownload(fileUrl, filename) {
  const download = document.getElementById("pdf-preview-download");
  if (!download) return;
  download.href = fileUrl;
  download.download = filename || "review";
}

export function closePdfPreview() {
  const visitLearnerId = uiState.outPreviewLearnerId;
  uiState.outPreviewLearnerId = "";
  resetPreviewStage();
  const layer = previewLayer();
  if (layer) {
    layer.hidden = true;
    layer.classList.remove("is-out-preview");
  }
  if (visitLearnerId) stampOutPdfOpened(visitLearnerId);
}

async function renderPdfPages(blob, container) {
  const data = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data, wasmUrl: "/pdfjs-wasm/" }).promise;
  container.innerHTML = "";
  const width = Math.max(container.clientWidth - 24, 320);
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / unscaled.width });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    container.appendChild(canvas);
  }
}

async function showPdfPreview({ blob, fileUrl, filename, title }) {
  const { pdf, word, empty, heading } = previewStageEls();
  const source = blob || (fileUrl ? await fetch(fileUrl).then((res) => res.blob()) : null);
  if (!pdf || !source) {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename || "review.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (heading) heading.textContent = title || "Review preview";
  setPreviewDownload(fileUrl, filename || "review.pdf");
  if (word) {
    word.innerHTML = "";
    word.hidden = true;
  }
  if (empty) empty.hidden = true;
  pdf.hidden = false;
  pdf.innerHTML = "<p class=\"pdf-preview-empty\">Loading preview…</p>";
  openPreviewShell();
  await renderPdfPages(source, pdf);
}

async function showWordPreview({ blob, fileUrl, filename, title }) {
  const { word, empty, heading } = previewStageEls();
  if (!word) {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = filename || "review.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (heading) heading.textContent = title || "Review preview";
  setPreviewDownload(fileUrl, filename || "review.docx");
  const pdf = document.getElementById("pdf-preview-pdf");
  if (pdf) {
    pdf.innerHTML = "";
    pdf.hidden = true;
  }
  if (empty) empty.hidden = true;
  word.hidden = false;
  word.innerHTML = "";
  await renderDocxPreview(blob, word, word, {
    inWrapper: true,
    breakPages: true,
    ignoreHeight: true,
    useBase64URL: true,
  });
  openPreviewShell();
}

export function mountPreview() {
  document.getElementById("pdf-preview-download")?.addEventListener("click", (event) => {
    const download = event.currentTarget;
    if (!download.getAttribute("href")) {
      event.preventDefault();
      setStatus("Preview PDF or Word first, then download.");
      return;
    }
    if (!uiState.previewLogContext?.learner) return;
    logAction({
      type: "downloaded",
      learner: uiState.previewLogContext.learner,
      reviewId: uiState.previewLogContext.reviewId,
    });
    scheduleStateSave();
  });
  document.getElementById("pdf-preview-populate-pdf")?.addEventListener("click", () => {
    populatePreviewPdf();
  });
  document.getElementById("pdf-preview-populate-word")?.addEventListener("click", () => {
    populatePreviewWord();
  });
  document.getElementById("pdf-preview-close")?.addEventListener("click", () => {
    closePdfPreview();
  });
  document.getElementById("pdf-preview-scrim")?.addEventListener("click", () => {
    closePdfPreview();
  });
}

async function storePreviewPdf(result, learner) {
  const file = new File([result.blob || (await fetch(result.fileUrl).then((res) => res.blob()))], result.filename, {
    type: "application/pdf",
  });
  const local = await apiFetch(`/api/review-attachment?${new URLSearchParams({ name: result.filename })}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  });
  if (local.ok) {
    const payload = await local.json().catch(() => ({}));
    const id = payload.attachment?.id;
    if (id) {
      const url = `/api/review-attachment?id=${encodeURIComponent(id)}&name=${encodeURIComponent(result.filename)}`;
      return url;
    }
  }
  const attachment = await uploadReviewFile(file, { learner });
  return `/api/review-attachment?id=${encodeURIComponent(attachment.id)}&name=${encodeURIComponent(result.filename)}`;
}

export function openReviewPreviewChooser(learnerId, review) {
  const learner = findEditableLearner(learnerId) || reviewLearner(state, learnerId);
  if (!learner) return;
  saveOpenRecordsForPreview(learnerId);
  uiState.previewTarget = { learnerId, review: review || null };
  uiState.previewLogContext = {
    learner,
    reviewId: review?.id || "",
  };
  const heading = document.getElementById("pdf-preview-title");
  if (heading) heading.textContent = tutorReviewLabel(learner, review);
  resetPreviewStage();
  openPreviewShell();
}

function showPreviewError(message) {
  const empty = document.getElementById("pdf-preview-empty");
  if (empty) {
    empty.hidden = false;
    empty.textContent = message;
  }
  setStatus(message);
}

async function populatePreviewPdf() {
  const learnerId = uiState.previewTarget.learnerId || uiState.previewLogContext?.learner?.id;
  if (!learnerId) {
    showPreviewError("Open a learner preview first.");
    return;
  }
  await previewReviewForm(learnerId, uiState.previewTarget.review);
}

async function populatePreviewWord() {
  const learnerId = uiState.previewTarget.learnerId || uiState.previewLogContext?.learner?.id;
  if (!learnerId) {
    showPreviewError("Open a learner preview first.");
    return;
  }
  try {
    setStatus("Populating the Word review form...");
    saveOpenRecordsForPreview(learnerId);
    scheduleStateSave();
    const learner = uiState.previewLogContext?.learner || findEditableLearner(learnerId) || reviewLearner(state, learnerId);
    if (!learner) throw new Error("Learner not found.");
    const bytes = await fillReviewFormDocx(await loadWordTemplate(), learner);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const filename = reviewDocxFilename(learner, uiState.previewTarget.review);
    const fileUrl = URL.createObjectURL(blob);
    await showWordPreview({
      blob,
      fileUrl,
      filename,
      title: tutorReviewLabel(learner, uiState.previewTarget.review),
    });
    setStatus(`Opened a Word preview for ${learner.name || "this learner"}.`);
  } catch (error) {
    showPreviewError(error.message || "Could not preview the Word form.");
  }
}

export async function previewReviewForm(learnerId, review) {
  try {
    uiState.previewTarget = { learnerId, review: review || null };
    setStatus("Opening the review preview...");
    const result = await loadReviewFormPdf(learnerId, {
      reviewId: review?.id || "",
      dateKey: review?.dateKey || "",
    });
    if (!result) return;
    uiState.previewLogContext = {
      learner: result.learner,
      reviewId: review?.id || "",
    };
    await showPdfPreview({
      blob: result.blob,
      fileUrl: result.fileUrl,
      filename: result.filename,
      title: tutorReviewLabel(result.learner, review),
    });
    storePreviewPdf(result, result.learner).catch((error) => {
      console.error("Failed to store preview PDF:", error.message || error);
    });
    setStatus(`Opened a preview of ${result.learner.name}’s review form.`);
  } catch (error) {
    showPreviewError(error.message || "Could not preview the review form.");
  }
}

export async function sendReviewForm(learnerId) {
  try {
    const result = await loadReviewFormPdf(learnerId);
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.fileUrl;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    readSettingsIntoState();
    const href = routeMailtoHref(
      `Tripartite progress review — ${result.learner.name}`,
      reviewFormEmailBody(result.learner),
      state.settings.email,
    );
    window.location.href = href;
    setStatus(
      `Downloaded a filled review form for ${result.learner.name}. Attach that PDF to the email for your colleague.`,
    );
  } catch (error) {
    setStatus(error.message || "Could not build the review form.");
  }
}
