import { PDFDocument, StandardFonts } from "pdf-lib";
import { fetchFormBytes } from "./lib/form-bytes.js";
import {
  DEFAULT_GTA_REVIEWER,
  formatUkDateKey,
  lastReviewDateKey,
  learnerProfileFrom,
  nextScheduledReviewDateKey,
} from "./planner.js";
import {
  clipToTutorLimit,
  forwardTargetsForPrint,
  otjHoursPdfNote,
  TUTOR_FIELD_LIMITS,
  TUTOR_PROGRESS_ROWS,
} from "./reviews.js";

function unescapePdfDa(da) {
  return String(da || "").replace(/\\([0-7]{3})/g, (_, oct) =>
    String.fromCharCode(Number.parseInt(oct, 8)),
  );
}

function appearanceStyle(da, fieldName) {
  const decoded = unescapePdfDa(da);
  const sizeMatch = decoded.match(/(\d+(?:\.\d+)?)\s+Tf/);
  const size = sizeMatch
    ? Number(sizeMatch[1])
    : String(fieldName || "").startsWith("s7_")
      ? 8
      : 9;
  const colorMatch = decoded.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/i);
  const color = colorMatch
    ? `${colorMatch[1]} ${colorMatch[2]} ${colorMatch[3]} rg`
    : "0 0 0 rg";
  return { size, da: `/Helv ${size} Tf ${color}` };
}

function setText(form, fieldName, value) {
  try {
    const field = form.getTextField(fieldName);
    if (typeof field.removeMaxLength === "function") {
      try {
        field.removeMaxLength();
      } catch {
        // Some fields have no max length to remove.
      }
    }
    const style = appearanceStyle(
      field.acroField.getDefaultAppearance(),
      fieldName,
    );
    field.acroField.setDefaultAppearance(style.da);
    field.setText(String(value || ""));
  } catch {
    // Field names can vary slightly between PDF versions.
  }
}

function redrawFilledFields(form, font) {
  for (const field of form.getFields()) {
    try {
      if (field.isDirty() && typeof field.updateAppearances === "function") {
        field.updateAppearances(font);
      }
    } catch {
      // Some widgets on this form cannot be redrawn.
    }
  }
}

function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function widgetPage(pdf, widget) {
  try {
    const pageRef = widget.P();
    if (pageRef) {
      const found = pdf.getPages().find((page) => page.ref === pageRef || page.node === pageRef);
      if (found) return found;
    }
  } catch {
    // Widget page refs vary between PDF versions.
  }
  for (const page of pdf.getPages()) {
    try {
      const annots = page.node.Annots();
      if (!annots) continue;
      if (annots.asArray().some((ref) => ref === widget.dict || ref === widget.ref)) return page;
    } catch {
      // Skip pages that cannot list annotations.
    }
  }
  return pdf.getPages().at(-1) || null;
}

function fitImageInRect(image, rect) {
  const scale = Math.min(rect.width / image.width, rect.height / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

async function drawSignatureField(pdf, form, fieldName, dataUrl) {
  if (!dataUrl) return;
  const bytes = dataUrlToBytes(dataUrl);
  if (!bytes?.length) return;
  let field;
  try {
    field = form.getTextField(fieldName);
  } catch {
    return;
  }
  const image = await pdf.embedPng(bytes);
  for (const widget of field.acroField.getWidgets()) {
    const page = widgetPage(pdf, widget);
    const rect = widget.getRectangle();
    if (!page || !rect) continue;
    page.drawImage(image, fitImageInRect(image, rect));
  }
  try {
    field.setText("");
  } catch {
    // Signature image is already on the page.
  }
}

function setCheck(form, fieldName, on) {
  try {
    const field = form.getCheckBox(fieldName);
    if (on) field.check();
    else field.uncheck();
  } catch {
    // Field names can vary slightly between PDF versions.
  }
}

function fillPreviousTargets(form, targets = [], tickStatus = false) {
  for (let index = 0; index < 3; index += 1) {
    const item = targets[index];
    const n = index + 1;
    setText(form, `s2_action_${n}`, clipToTutorLimit(item?.action || "", TUTOR_FIELD_LIMITS.previousAction));
    setText(form, `s2_owner_${n}`, item?.owner || "");
    setText(form, `s2_progress_outcome_evidence_${n}`, clipToTutorLimit(item?.measure || "", TUTOR_FIELD_LIMITS.previousMeasure));
    setCheck(form, `s2_status_${n}_met`, tickStatus && item?.status === "met");
    setCheck(form, `s2_status_${n}_partly_met`, tickStatus && item?.status === "partly");
    setCheck(form, `s2_status_${n}_not_met`, tickStatus && item?.status === "not-met");
    setCheck(
      form,
      `s2_status_${n}_carry_forward`,
      tickStatus && item?.status === "carry-forward",
    );
  }
}

function fillTutorProgress(form, tutorForm) {
  const rows = tutorForm?.progress || [];
  for (const row of TUTOR_PROGRESS_ROWS) {
    const current = rows.find((item) => item.id === row.id) || {};
    const hoursNote = row.id === "off_the_job" ? otjHoursPdfNote(current) : "";
    const evidence = [hoursNote, clipToTutorLimit(current.evidence, TUTOR_FIELD_LIMITS.progressEvidence)]
      .filter(Boolean)
      .join("\n");
    setText(form, `s3_${row.id}_evidence`, evidence);
    setText(form, `s3_${row.id}_action_ref`, clipToTutorLimit(current.actionRef, TUTOR_FIELD_LIMITS.progressActionRef));
    setCheck(form, `s3_${row.id}_rag_red`, current.rag === "red");
    setCheck(form, `s3_${row.id}_rag_amber`, current.rag === "amber");
    setCheck(form, `s3_${row.id}_rag_green`, current.rag === "green" || current.rag === "blue");
  }
}

function fillNewTargets(form, targets = []) {
  for (let index = 0; index < 3; index += 1) {
    const item = targets[index];
    const n = index + 1;
    setText(form, `s7_action_target_${n}`, clipToTutorLimit(item?.action || "", TUTOR_FIELD_LIMITS.newAction));
    setText(form, `s7_owner_${n}`, item?.owner || "");
    setText(form, `s7_success_measure_support_${n}`, clipToTutorLimit(item?.measure || "", TUTOR_FIELD_LIMITS.newMeasure));
    setText(form, `s7_target_date_${n}`, formatUkDateKey(item?.targetDate) || "");
  }
}

export function section1Values(learner) {
  const profile = learnerProfileFrom(learner || {});
  return {
    apprenticeName: String(learner?.name || "").trim(),
    reviewDate: "",
    apprenticeship: profile.apprenticeship,
    releaseDay: learner?.collegeDay || "",
    gtaTutor: profile.tutor,
    gtaReviewer: profile.gtaReviewer || DEFAULT_GTA_REVIEWER,
    startDate: formatUkDateKey(profile.apprenticeshipStartDate),
    endDate: formatUkDateKey(profile.apprenticeshipEndDate),
    employer: String(learner?.company || "").trim(),
    postcode: String(learner?.postcode || "").trim(),
    employerContact: profile.employerContact,
    phone: profile.contactNumber,
    email: profile.employerEmail,
    plannedReviewDate: formatUkDateKey(nextScheduledReviewDateKey(learner)),
    previousReviewDate: formatUkDateKey(lastReviewDateKey(learner)),
  };
}

export function reviewPdfFilename(learner, pack) {
  const name = String(learner?.name || "learner")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  const stamp =
    formatUkDateKey(pack?.dateKey || nextScheduledReviewDateKey(learner)).replaceAll(
      "/",
      "-",
    ) || "draft";
  return `${name}_${stamp}.pdf`;
}

export async function fillReviewFormPdf(templateBytes, learner, pack) {
  const values = section1Values(learner);
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();
  setText(form, "s1_apprentice_name", values.apprenticeName);
  setText(form, "s1_review_date", formatUkDateKey(pack?.visitDateKey) || values.reviewDate);
  setText(form, "s1_apprenticeship_standard_route_level", values.apprenticeship);
  setText(form, "s1_release_day", values.releaseDay);
  setText(form, "s1_gta_tutor", values.gtaTutor);
  setText(form, "s1_gta_reviewer", values.gtaReviewer);
  setText(form, "s1_apprenticeship_start_date", values.startDate);
  setText(form, "s1_apprenticeship_planned_end_date", values.endDate);
  setText(form, "s1_employer_workplace", values.employer);
  setText(form, "s1_postcode", values.postcode);
  setText(form, "s1_employer_contact_name", values.employerContact);
  setText(form, "s1_employer_contact_phone", values.phone);
  setText(form, "s1_employer_contact_email", values.email);
  setText(form, "s1_planned_review_date", values.plannedReviewDate);
  if (pack) {
    const forVisit = ["returned", "print", "completed"].includes(pack.status);
    const previous = (pack.previousTargets || []).filter((item) => item.action);
    const next = forVisit
      ? forwardTargetsForPrint(pack)
      : (pack.newTargets || []).filter((item) => item.action);
    const tutorForm = pack.tutorForm || {};
    setText(
      form,
      "s2_tutor_summary_previous_review",
      clipToTutorLimit(
        tutorForm.previousSummary ||
          (pack.isInitial
            ? "First saved review. Starting targets are in section 7 and will carry forward next time."
            : forVisit
              ? "Section 2 is last time's targets and the tutor's progress. Still-open targets are copied into section 7 for this visit."
              : previous.length
                ? "Previous targets have been carried forward. Update progress only - do not retype them."
                : "No open targets were carried forward from the last saved review."),
        TUTOR_FIELD_LIMITS.previousSummary,
      ),
    );
    fillPreviousTargets(form, previous, Boolean(forVisit || tutorForm.previousSummary || previous.some((item) => item.status !== "open")));
    fillNewTargets(form, next);
    fillTutorProgress(form, tutorForm);
    setText(form, "s4_apprentice_contribution", tutorForm.apprenticeComment);
    setText(form, "s4_employer_mentor_contribution", tutorForm.employerComment);
    setText(form, "s4_gta_tutor_contribution", clipToTutorLimit(tutorForm.tutorComment, TUTOR_FIELD_LIMITS.tutorComment));
    setText(form, "s5_agreed_overall_summary", tutorForm.agreedSummary);
    setText(form, "s5_differing_views", tutorForm.differingViews);
    const visitDate = formatUkDateKey(pack.visitDateKey);
    if (visitDate) {
      const profile = learnerProfileFrom(learner || {});
      setText(form, "s8_apprentice_name", values.apprenticeName);
      setText(form, "s8_apprentice_date", visitDate);
      setText(form, "s8_employer_mentor_name", profile.employerContact);
      setText(form, "s8_employer_mentor_date", visitDate);
      setText(
        form,
        "s8_gta_reviewer_name",
        profile.gtaReviewer || DEFAULT_GTA_REVIEWER,
      );
      setText(form, "s8_gta_reviewer_date", visitDate);
    }
    await drawSignatureField(pdf, form, "s8_apprentice_signature", pack.signatures?.apprentice);
    await drawSignatureField(pdf, form, "s8_employer_mentor_signature", pack.signatures?.employer);
    await drawSignatureField(pdf, form, "s8_gta_reviewer_signature", pack.signatures?.reviewer);
  }
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  redrawFilledFields(form, font);
  let flattenOk = true;
  try {
    form.flatten();
  } catch (error) {
    // eslint-disable-next-line no-unused-vars
    flattenOk = false;
    // Some widgets cannot flatten; the filled fields still remain.
  }
  const bytes = await pdf.save({ updateFieldAppearances: false, useObjectStreams: false });
  return bytes;
}

const PDF_TEMPLATE_URLS = [
  "/forms/GTA_Tripartite_Progress_Review_Form_V1.2.pdf",
  "/api/review-form/template",
];

let templatePromise = null;
const previewCache = new Map();

export function prefetchReviewTemplate() {
  loadReviewTemplate().catch(() => {});
}

export async function loadReviewTemplate() {
  if (!templatePromise) {
    templatePromise = fetchFormBytes(
      PDF_TEMPLATE_URLS,
      "Could not load the review form template.",
    );
  }
  return templatePromise;
}

function previewCacheKey(learner, pack) {
  return JSON.stringify({
    id: learner?.id,
    packId: pack?.id || "",
    dateKey: pack?.dateKey || "",
    values: section1Values(learner),
    previous: pack?.previousTargets || [],
    next: pack?.newTargets || [],
    tutorForm: pack?.tutorForm || {},
    status: pack?.status || "",
    initial: Boolean(pack?.isInitial),
  });
}

export async function buildReviewPdfBlob(learner, pack) {
  const key = previewCacheKey(learner, pack);
  const cached = previewCache.get(key);
  if (cached) return cached;
  const bytes = await fillReviewFormPdf(await loadReviewTemplate(), learner, pack);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const result = {
    filename: reviewPdfFilename(learner, pack),
    fileUrl: URL.createObjectURL(blob),
    blob,
  };
  if (previewCache.size >= 16) {
    const oldest = previewCache.keys().next().value;
    URL.revokeObjectURL(previewCache.get(oldest).fileUrl);
    previewCache.delete(oldest);
  }
  previewCache.set(key, result);
  return result;
}
