import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPayload } from "./db.js";
import { findSavedReview, normaliseSavedReviews } from "../src/reviews.js";
import {
  fillReviewFormPdf,
  reviewPdfFilename,
  section1Values,
} from "../src/review-pdf.js";
import { fillReviewFormDocx, reviewDocxFilename } from "./review-word.js";

const formsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "forms");
const formPath = path.join(formsDir, "GTA_Tripartite_Progress_Review_Form_V1.2.pdf");
const wordFormPath = path.join(formsDir, "GTA_Review_Form.docx");

let templateBytes = null;
let wordTemplateBytes = null;

export function reviewFormTemplateBytes() {
  if (!templateBytes) templateBytes = fs.readFileSync(formPath);
  return templateBytes;
}

export function reviewFormWordTemplateBytes() {
  if (!wordTemplateBytes) wordTemplateBytes = fs.readFileSync(wordFormPath);
  return wordTemplateBytes;
}

function loadState() {
  return loadPayload() || {};
}

function findLearner(id) {
  const state = loadState();
  return (
    (state.learners || []).find((item) => item.id === id) ||
    (state.followUps || []).find((item) => item.id === id) ||
    (state.archive || []).find((item) => item.id === id) ||
    null
  );
}

function findReviewPack(learnerId, { reviewId, dateKey } = {}) {
  const state = loadState();
  const packs = normaliseSavedReviews(state.savedReviews);
  if (reviewId) return packs.find((item) => item.id === reviewId) || null;
  if (dateKey) return findSavedReview({ savedReviews: packs }, learnerId, dateKey);
  return null;
}

export { section1Values };

export async function buildReviewFormPdf(learnerId, options = {}) {
  const learner = findLearner(learnerId);
  if (!learner) {
    const error = new Error("Learner not found.");
    error.status = 404;
    throw error;
  }
  const pack = findReviewPack(learnerId, options);
  const bytes = await fillReviewFormPdf(reviewFormTemplateBytes(), learner, pack);
  return {
    bytes: Buffer.from(bytes),
    filename: reviewPdfFilename(learner, pack),
    values: section1Values(learner),
    pack,
  };
}

export async function buildReviewFormDocx(learnerId) {
  const learner = findLearner(learnerId);
  if (!learner) {
    const error = new Error("Learner not found.");
    error.status = 404;
    throw error;
  }
  const bytes = await fillReviewFormDocx(reviewFormWordTemplateBytes(), learner);
  return {
    bytes: Buffer.from(bytes),
    filename: reviewDocxFilename(learner),
    values: section1Values(learner),
  };
}
