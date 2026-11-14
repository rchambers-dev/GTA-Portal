import { PDFDocument, StandardFonts, type PDFFont, type PDFForm, type PDFPage } from "pdf-lib";
import { clipWords, otjTrack, type TutorFormDraft } from "./tutor-form-rules";

export type ReviewPdfLearner = {
  name: string;
  apprenticeship: string;
  releaseDay: string;
  tutor: string;
  reviewer: string;
  startDate: string;
  endDate: string;
  employer: string;
  postcode: string;
  employerContact: string;
  phone: string;
  email: string;
  plannedReviewDate: string;
  previousReviewDate: string;
};

function ukDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return "";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function appearanceStyle(da: string, fieldName: string) {
  const decoded = String(da || "").replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(Number.parseInt(oct, 8)));
  const sizeMatch = decoded.match(/(\d+(?:\.\d+)?)\s+Tf/);
  const size = sizeMatch ? Number(sizeMatch[1]) : String(fieldName || "").startsWith("s7_") ? 8 : 9;
  const colorMatch = decoded.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/i);
  const color = colorMatch ? `${colorMatch[1]} ${colorMatch[2]} ${colorMatch[3]} rg` : "0 0 0 rg";
  return `/Helv ${size} Tf ${color}`;
}

function setText(form: PDFForm, fieldName: string, value: string) {
  try {
    const field = form.getTextField(fieldName);
    try {
      field.removeMaxLength();
    } catch {
      // Some fields have no max length to remove.
    }
    field.acroField.setDefaultAppearance(appearanceStyle(field.acroField.getDefaultAppearance() || "", fieldName));
    field.setText(String(value || ""));
  } catch {
    // Field names can vary slightly between PDF versions.
  }
}

function setCheck(form: PDFForm, fieldName: string, on: boolean) {
  try {
    const field = form.getCheckBox(fieldName);
    if (on) field.check();
    else field.uncheck();
  } catch {
    // Field names can vary slightly between PDF versions.
  }
}

function redrawFilledFields(form: PDFForm, font: PDFFont) {
  for (const field of form.getFields()) {
    const drawable = field as unknown as { isDirty?: () => boolean; updateAppearances?: (font: PDFFont) => void };
    try {
      if (drawable.isDirty?.() && drawable.updateAppearances) drawable.updateAppearances(font);
    } catch {
      // Some widgets on this form cannot be redrawn.
    }
  }
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  if (!base64 || typeof atob !== "function") return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function widgetPage(pdf: PDFDocument, widget: { P: () => unknown; dict: unknown; ref?: unknown }): PDFPage | null {
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

async function drawSignatureField(pdf: PDFDocument, form: PDFForm, fieldName: string, dataUrl: string | undefined) {
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
    const page = widgetPage(pdf, widget as unknown as { P: () => unknown; dict: unknown; ref?: unknown });
    const rect = widget.getRectangle();
    if (!page || !rect) continue;
    const scale = Math.min(rect.width / image.width, rect.height / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: rect.x + (rect.width - width) / 2,
      y: rect.y + (rect.height - height) / 2,
      width,
      height,
    });
  }
  try {
    field.setText("");
  } catch {
    // Signature image is already on the page.
  }
}

function hoursNote(row: TutorFormDraft["progress"][number]) {
  if (!row.targetHours || !row.currentHours) return "";
  const track = otjTrack(row.targetHours, row.currentHours);
  return `OTJ hours: ${row.currentHours} / ${row.targetHours} — ${track.label} (${track.detail.match(/(\d+)%/)?.[1] || 0}%).`;
}

/** Fill the official tripartite form the same way the Review Assistant does. Preview does not send the review. */
export async function fillReviewFormPdf(
  templateBytes: Uint8Array,
  learner: ReviewPdfLearner,
  form: TutorFormDraft,
  options: { forVisit: boolean; visitDate?: string; signatures?: { apprentice?: string; employer?: string; reviewer?: string } },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes);
  const pdfForm = pdf.getForm();
  setText(pdfForm, "s1_apprentice_name", learner.name);
  setText(pdfForm, "s1_review_date", ukDate(options.visitDate || ""));
  setText(pdfForm, "s1_apprenticeship_standard_route_level", learner.apprenticeship);
  setText(pdfForm, "s1_release_day", learner.releaseDay);
  setText(pdfForm, "s1_gta_tutor", learner.tutor);
  setText(pdfForm, "s1_gta_reviewer", learner.reviewer);
  setText(pdfForm, "s1_apprenticeship_start_date", ukDate(learner.startDate));
  setText(pdfForm, "s1_apprenticeship_planned_end_date", ukDate(learner.endDate));
  setText(pdfForm, "s1_employer_workplace", learner.employer);
  setText(pdfForm, "s1_postcode", learner.postcode);
  setText(pdfForm, "s1_employer_contact_name", learner.employerContact);
  setText(pdfForm, "s1_employer_contact_phone", learner.phone);
  setText(pdfForm, "s1_employer_contact_email", learner.email === "Not set" ? "" : learner.email);
  setText(pdfForm, "s1_planned_review_date", ukDate(learner.plannedReviewDate));
  const previous = form.previousTargets.filter((item) => item.action.trim());
  const next = options.forVisit
    ? [...previous.filter((item) => item.status !== "met"), ...form.newTargets.filter((item) => item.action.trim())].slice(0, 3)
    : form.newTargets.filter((item) => item.action.trim());
  const summary =
    form.previousSummary ||
    (options.forVisit
      ? "Section 2 is last time's targets and the tutor's progress. Still-open targets are copied into section 7 for this visit."
      : previous.length
        ? "Previous targets have been carried forward. Update progress only - do not retype them."
        : "No open targets were carried forward from the last saved review.");
  setText(pdfForm, "s2_tutor_summary_previous_review", clipWords(summary, 65));
  const tick = Boolean(options.forVisit || form.previousSummary.trim() || previous.some((item) => item.status !== "open"));
  previous.slice(0, 3).forEach((item, index) => {
    const n = index + 1;
    setText(pdfForm, `s2_action_${n}`, clipWords(item.action, 38));
    setText(pdfForm, `s2_owner_${n}`, item.owner);
    setText(pdfForm, `s2_progress_outcome_evidence_${n}`, clipWords(item.measure, 47));
    setCheck(pdfForm, `s2_status_${n}_met`, tick && item.status === "met");
    setCheck(pdfForm, `s2_status_${n}_partly_met`, tick && item.status === "partly");
    setCheck(pdfForm, `s2_status_${n}_not_met`, tick && item.status === "not-met");
    setCheck(pdfForm, `s2_status_${n}_carry_forward`, tick && item.status === "carry-forward");
  });
  next.slice(0, 3).forEach((item, index) => {
    const n = index + 1;
    setText(pdfForm, `s7_action_target_${n}`, clipWords(item.action, 38));
    setText(pdfForm, `s7_owner_${n}`, item.owner);
    setText(pdfForm, `s7_success_measure_support_${n}`, clipWords(item.measure, 47));
    setText(pdfForm, `s7_target_date_${n}`, ukDate(item.targetDate));
  });
  form.progress.forEach((row) => {
    const note = row.area === "off_the_job" ? hoursNote(row) : "";
    const evidence = [note, clipWords(row.evidence, 90)].filter(Boolean).join("\n");
    setText(pdfForm, `s3_${row.area}_evidence`, evidence);
    setText(pdfForm, `s3_${row.area}_action_ref`, clipWords(row.actionRef, 15));
    setCheck(pdfForm, `s3_${row.area}_rag_red`, row.rag === "red");
    setCheck(pdfForm, `s3_${row.area}_rag_amber`, row.rag === "amber");
    setCheck(pdfForm, `s3_${row.area}_rag_green`, row.rag === "green" || row.rag === "blue");
  });
  setText(pdfForm, "s4_gta_tutor_contribution", clipWords(form.tutorComment, 400));
  const visit = ukDate(options.visitDate || "");
  if (visit) {
    setText(pdfForm, "s8_apprentice_name", learner.name);
    setText(pdfForm, "s8_apprentice_date", visit);
    setText(pdfForm, "s8_employer_mentor_name", learner.employerContact);
    setText(pdfForm, "s8_employer_mentor_date", visit);
    setText(pdfForm, "s8_gta_reviewer_name", learner.reviewer);
    setText(pdfForm, "s8_gta_reviewer_date", visit);
  }
  await drawSignatureField(pdf, pdfForm, "s8_apprentice_signature", options.signatures?.apprentice);
  await drawSignatureField(pdf, pdfForm, "s8_employer_mentor_signature", options.signatures?.employer);
  await drawSignatureField(pdf, pdfForm, "s8_gta_reviewer_signature", options.signatures?.reviewer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  redrawFilledFields(pdfForm, font);
  try {
    pdfForm.flatten();
  } catch {
    // Some widgets cannot flatten; the filled fields still remain.
  }
  return pdf.save({ updateFieldAppearances: false, useObjectStreams: false });
}

export function reviewPdfFilename(name: string, planned: string) {
  const safe = (name || "learner").replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, "_").slice(0, 60);
  const stamp = ukDate(planned).replaceAll("/", "-") || "draft";
  return `${safe}_${stamp}.pdf`;
}
