/**
 * Capture the on-screen CV sheet and save a real PDF file — no print dialog,
 * so browser headers/footers (date, title, URL) never appear.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MAX_PAGES = 2;

function slugifyFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "CV";
}

export async function downloadCvPdf(
  sheet: HTMLElement,
  fullName: string,
): Promise<void> {
  const hidden: Array<{ el: HTMLElement; prev: string }> = [];
  sheet.querySelectorAll<HTMLElement>("[data-print-hide]").forEach((el) => {
    hidden.push({ el, prev: el.style.visibility });
    el.style.visibility = "hidden";
  });

  const prevBorderRadius = sheet.style.borderRadius;
  const prevBoxShadow = sheet.style.boxShadow;
  sheet.style.borderRadius = "0";
  sheet.style.boxShadow = "none";

  try {
    const canvas = await html2canvas(sheet, {
      scale: Math.min(2.5, window.devicePixelRatio || 2),
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      // Ignore UI-only overlays that should not appear in the PDF.
      ignoreElements: (el) =>
        el instanceof HTMLElement && el.hasAttribute("data-print-hide"),
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidthPx = canvas.width;
    const pageHeightPx = Math.round(pageWidthPx * (A4_HEIGHT_MM / A4_WIDTH_MM));
    const totalPages = Math.min(
      MAX_PAGES,
      Math.max(1, Math.ceil(canvas.height / pageHeightPx - 0.02)),
    );

    for (let page = 0; page < totalPages; page += 1) {
      if (page > 0) pdf.addPage();

      const sourceY = page * pageHeightPx;
      const sliceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
      if (sliceHeight <= 0) break;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = pageWidthPx;
      pageCanvas.height = pageHeightPx;
      const ctx = pageCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the PDF page.");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        pageWidthPx,
        sliceHeight,
        0,
        0,
        pageWidthPx,
        sliceHeight,
      );

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
      const drawHeightMm = (sliceHeight / pageWidthPx) * A4_WIDTH_MM;
      pdf.addImage(
        imgData,
        "JPEG",
        0,
        0,
        A4_WIDTH_MM,
        Math.min(A4_HEIGHT_MM, drawHeightMm),
        undefined,
        "FAST",
      );
    }

    pdf.save(`${slugifyFilename(fullName)}-CV.pdf`);
  } finally {
    sheet.style.borderRadius = prevBorderRadius;
    sheet.style.boxShadow = prevBoxShadow;
    for (const { el, prev } of hidden) {
      el.style.visibility = prev;
    }
  }
}
