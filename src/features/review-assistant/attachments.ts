import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function directory() {
  const override = process.env.REVIEW_ASSISTANT_ATTACHMENTS_DIR;
  if (override) return override;
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ".review-assistant",
    "attachments",
  );
}

function safeName(name: string) {
  return String(name || "review")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function extensionFor(filename: string, type: string) {
  const fromName = path.extname(filename).toLowerCase();
  if (fromName && /^\.[a-z0-9]+$/.test(fromName)) return fromName;
  if (type === "application/pdf") return ".pdf";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/jpeg") return ".jpg";
  return "";
}

function attachmentFile(id: string) {
  const file = path.basename(id);
  if (!file || file !== id || file.includes("..")) return "";
  return path.join(directory(), file);
}

export function saveReviewAttachment({
  filename,
  type,
  bytes,
}: {
  filename: string;
  type: string;
  bytes: Buffer;
}) {
  const trimmed = filename.trim();
  if (trimmed.length > 255) {
    const error = new Error("Filename too long (max 255 characters).");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  if (!/^[a-zA-Z0-9._\-\s]+$/.test(trimmed)) {
    const error = new Error("Filename contains invalid characters.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  const contentType = String(type || "application/pdf").split(";")[0].trim();
  if (!ALLOWED.has(contentType)) {
    const error = new Error("Attach a PDF or image of the review.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  if (!bytes?.length) {
    const error = new Error("That file was empty.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  if (bytes.length > 20 * 1024 * 1024) {
    const error = new Error("That file is too large to attach.");
    (error as Error & { status: number }).status = 400;
    throw error;
  }
  const id = `${randomUUID()}${extensionFor(trimmed, contentType)}`;
  const target = attachmentFile(id);
  mkdirSync(directory(), { recursive: true });
  writeFileSync(/*turbopackIgnore: true*/ target, bytes);
  return { id, filename: safeName(trimmed) || id, type: contentType };
}

export function readReviewAttachment(id: string) {
  const file = attachmentFile(id);
  if (!file) {
    const error = new Error("Attached review not found.");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
  try {
    const bytes = readFileSync(/*turbopackIgnore: true*/ file);
    const type = id.endsWith(".pdf")
      ? "application/pdf"
      : id.endsWith(".png")
        ? "image/png"
        : id.endsWith(".webp")
          ? "image/webp"
          : id.endsWith(".jpg") || id.endsWith(".jpeg")
            ? "image/jpeg"
            : "application/octet-stream";
    return { bytes, type };
  } catch {
    const error = new Error("Attached review not found.");
    (error as Error & { status: number }).status = 404;
    throw error;
  }
}
