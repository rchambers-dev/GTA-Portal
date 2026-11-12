import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { logClientError } from "../shared/log-error.js";

let attachmentsDir;
// Kept so a read-only filesystem does not crash startup. Not read yet.
let attachmentsDirError = null;

try {
  attachmentsDir = path.join(
    process.env.REVIEW_DATA_DIR
      ? path.resolve(process.env.REVIEW_DATA_DIR)
      : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data"),
    "attachments",
  );
  fs.mkdirSync(attachmentsDir, { recursive: true });
} catch (error) {
  // eslint-disable-next-line no-unused-vars
  attachmentsDirError = error;
  // In serverless environments (Vercel), filesystem may be read-only
  logClientError("Attachments directory initialization failed.", { code: error?.code });
  attachmentsDir = null;
}

const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeName(name) {
  return String(name || "review")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function extensionFor(filename, type) {
  const fromName = path.extname(String(filename || "")).toLowerCase();
  if (fromName) return fromName;
  if (type === "application/pdf") return ".pdf";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/jpeg") return ".jpg";
  return "";
}

export function attachmentPath(id) {
  if (!attachmentsDir) return "";
  const file = path.basename(String(id || ""));
  if (!file || file !== id) return "";
  return path.join(attachmentsDir, file);
}

export function saveReviewAttachment({ filename, type, bytes }) {
  const contentType = String(type || "application/pdf").split(";")[0].trim();
  if (!ALLOWED.has(contentType)) {
    const error = new Error("Attach a PDF or image of the review.");
    error.status = 400;
    throw error;
  }
  if (!bytes?.length) {
    const error = new Error("That file was empty.");
    error.status = 400;
    throw error;
  }
  if (bytes.length > 20 * 1024 * 1024) {
    const error = new Error("That file is too large to attach.");
    error.status = 400;
    throw error;
  }
  const id = `${randomUUID()}${extensionFor(filename, contentType)}`;
  const localPath = attachmentPath(id);
  if (localPath) {
    try {
      fs.writeFileSync(localPath, bytes);
    } catch (error) {
      logClientError("Failed to save attachment locally.", { code: error?.code });
      // Continue anyway - Supabase storage will handle it
    }
  }
  return {
    id,
    filename: safeName(filename) || id,
    type: contentType,
  };
}

export function readReviewAttachment(id) {
  const file = attachmentPath(id);
  if (!file) {
    // Local storage not available - caller should try Supabase
    const error = new Error("Attached review not found.");
    error.status = 404;
    throw error;
  }
  if (!fs.existsSync(file)) {
    const error = new Error("Attached review not found.");
    error.status = 404;
    throw error;
  }
  return {
    bytes: fs.readFileSync(file),
    type: id.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
  };
}
