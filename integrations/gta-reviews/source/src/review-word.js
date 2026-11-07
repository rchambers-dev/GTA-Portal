import JSZip from "jszip";
import { fetchFormBytes } from "./lib/form-bytes.js";
import { reviewPdfFilename, section1Values } from "./review-pdf.js";

const WORD_TEMPLATE_URLS = [
  "/forms/GTA_Review_Form.docx",
  "/api/review-form/word-template",
];

const SECTION1_FIELDS = [
  ["Apprentice name", "apprenticeName"],
  ["Apprenticeship standard / route / level", "apprenticeship"],
  ["Release Day", "releaseDay"],
  ["GTA tutor", "gtaTutor"],
  ["GTA reviewer", "gtaReviewer"],
  ["Apprenticeship start date", "startDate"],
  ["Apprenticeship planned end date", "endDate"],
  ["Employer / workplace", "employer"],
  ["Postcode", "postcode"],
  ["Employer contact name", "employerContact"],
  ["Employer contact phone number", "phone"],
  ["Employer contact email address", "email"],
  ["Planned review date", "plannedReviewDate"],
];

let wordTemplatePromise = null;

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fillNextCell(xml, label, value) {
  const text = String(value || "").trim();
  if (!text) return xml;
  const marker = `>${label}</w:t>`;
  const labelAt = xml.indexOf(marker);
  if (labelAt < 0) return xml;
  const cellStart = xml.indexOf("<w:tc>", labelAt);
  if (cellStart < 0) return xml;
  const cellEnd = xml.indexOf("</w:tc>", cellStart);
  if (cellEnd < 0) return xml;
  let cell = xml.slice(cellStart, cellEnd);
  const node = `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`;
  if (/<w:t[\s>]/.test(cell)) {
    cell = cell.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/, node);
  } else {
    const runClose = cell.lastIndexOf("</w:r>");
    if (runClose < 0) return xml;
    cell = `${cell.slice(0, runClose)}${node}${cell.slice(runClose)}`;
  }
  return `${xml.slice(0, cellStart)}${cell}${xml.slice(cellEnd)}`;
}

function forceWhitePage(xml) {
  if (!xml || /<w:background[\s/>]/.test(xml)) return xml;
  return xml.replace(/<w:document\b[^>]*>/, (tag) => `${tag}<w:background w:color="FFFFFF"/>`);
}

function forceLightSettings(xml) {
  if (!xml || /<w:displayBackgroundShape\b/.test(xml)) return xml;
  return xml.replace(/<w:settings\b[^>]*>/, (tag) => `${tag}<w:displayBackgroundShape/>`);
}

function forceFixedThemeColors(xml) {
  if (!xml) return xml;
  return xml
    .replace(
      /<a:dk1>\s*<a:sysClr val="windowText"[^/]*\/>\s*<\/a:dk1>/,
      '<a:dk1><a:srgbClr val="183A4C"/></a:dk1>',
    )
    .replace(
      /<a:lt1>\s*<a:sysClr val="window"[^/]*\/>\s*<\/a:lt1>/,
      '<a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>',
    );
}

async function applyLightPage(zip) {
  const documentFile = zip.file("word/document.xml");
  if (documentFile) {
    zip.file("word/document.xml", forceWhitePage(await documentFile.async("string")));
  }
  const settingsFile = zip.file("word/settings.xml");
  if (settingsFile) {
    zip.file("word/settings.xml", forceLightSettings(await settingsFile.async("string")));
  }
  const themeFile = zip.file("word/theme/theme1.xml");
  if (themeFile) {
    zip.file("word/theme/theme1.xml", forceFixedThemeColors(await themeFile.async("string")));
  }
}

export function reviewDocxFilename(learner, pack) {
  return reviewPdfFilename(learner, pack).replace(/\.pdf$/i, ".docx");
}

export async function loadWordTemplate() {
  if (!wordTemplatePromise) {
    wordTemplatePromise = fetchFormBytes(
      WORD_TEMPLATE_URLS,
      "Could not load the Word review form.",
    );
  }
  return wordTemplatePromise;
}

export async function fillReviewFormDocx(templateBytes, learner) {
  const zip = await JSZip.loadAsync(templateBytes);
  const documentPath = "word/document.xml";
  const file = zip.file(documentPath);
  if (!file) {
    throw new Error("The Word review form is missing document.xml.");
  }
  const values = section1Values(learner);
  let xml = forceWhitePage(await file.async("string"));
  for (const [label, key] of SECTION1_FIELDS) {
    xml = fillNextCell(xml, label, values[key]);
  }
  zip.file(documentPath, xml);
  await applyLightPage(zip);
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
