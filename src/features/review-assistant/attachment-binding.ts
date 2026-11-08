import { randomUUID } from "node:crypto";
import { REVIEW_ATTACHMENT_BUCKET } from "./repository-constants";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type PreparedAttachment = {
  id: string;
  filename: string;
  type: string;
  reviewLearnerId: string;
  actorId: string;
  portalApprenticeId: null;
  bytes: Buffer;
};

export type ObjectTransport = {
  upload(path: string, bytes: Buffer, contentType: string): Promise<void>;
  remove(path: string): Promise<void>;
};

function reject(message: string, status = 400) {
  throw Object.assign(new Error(message), { status });
}

/** Stores the review-form learner id unchanged. It is not rewritten into a portal apprentice id. */
export function exactReviewLearnerId(value: string) {
  const learnerId = String(value ?? "");
  if (!learnerId.trim() || learnerId.length > 200 || /[\u0000-\u001f]/.test(learnerId)) {
    reject("Attachment must be bound to a learner.");
  }
  return learnerId;
}

export function prepareReviewAttachment(input: {
  filename: string;
  type: string;
  bytes: Buffer;
  actorId: string;
  learnerId: string;
}): PreparedAttachment {
  const trimmed = String(input.filename || "").trim();
  if (!trimmed || trimmed.length > 255) reject("Filename too long (max 255 characters).");
  if (!/^[a-zA-Z0-9._\-\s]+$/.test(trimmed)) reject("Filename contains invalid characters.");
  const type = String(input.type || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(type)) reject("Attach a PDF or image of the review.");
  if (!input.actorId?.trim()) reject("Attachment must be bound to a learner.");
  const reviewLearnerId = exactReviewLearnerId(input.learnerId);
  if (!input.bytes?.length) reject("That file was empty.");
  if (input.bytes.length > 20 * 1024 * 1024) reject("That file is too large to attach.");
  const extension = type === "application/pdf" ? ".pdf" : type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
  const safeName = trimmed.replace(/[<>:"/\\|?*]+/g, "").replace(/\s+/g, "_").slice(0, 80);
  return {
    id: `${randomUUID()}${extension}`,
    filename: safeName || "review",
    type,
    reviewLearnerId,
    actorId: input.actorId,
    portalApprenticeId: null,
    bytes: input.bytes,
  };
}

/**
 * Uploads only after prepareReviewAttachment has accepted the file.
 * If the catalogue insert fails, the object is removed. A failed removal is reported
 * for a later reconciliation and is not treated as a successful save.
 */
export async function commitReviewAttachment(
  prepared: PreparedAttachment,
  transport: ObjectTransport,
  insertRow: (prepared: PreparedAttachment) => Promise<void>,
) {
  await transport.upload(prepared.id, prepared.bytes, prepared.type);
  try {
    await insertRow(prepared);
  } catch (error) {
    try {
      await transport.remove(prepared.id);
    } catch {
      throw Object.assign(
        new Error("Attachment metadata failed and the stored object needs reconciliation."),
        { status: 500, orphan: { bucket: REVIEW_ATTACHMENT_BUCKET, path: prepared.id }, cause: error },
      );
    }
    throw error;
  }
  return prepared;
}
