import { createHmac, timingSafeEqual } from "node:crypto";

export type EmailProviderEvent = {
  providerMessageId: string;
  status: "bounced" | "failed" | "delivered";
  reason: string | null;
};

export function parseTutorReviewEmailEvent(body: unknown): EmailProviderEvent | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (typeof row.type === "string" && row.data && typeof row.data === "object") {
    const data = row.data as Record<string, unknown>;
    const providerMessageId = typeof data.email_id === "string" ? data.email_id : "";
    if (!providerMessageId) return null;
    const bounce = data.bounce && typeof data.bounce === "object" ? (data.bounce as Record<string, unknown>) : null;
    const reason = typeof bounce?.message === "string" ? bounce.message : null;
    if (row.type === "email.bounced") return { providerMessageId, status: "bounced", reason };
    if (row.type === "email.complained" || row.type === "email.failed") return { providerMessageId, status: "failed", reason };
    if (row.type === "email.delivered") return { providerMessageId, status: "delivered", reason: null };
    return null;
  }
  const providerMessageId = typeof row.providerMessageId === "string" ? row.providerMessageId : "";
  const event = typeof row.event === "string" ? row.event : "";
  if (!providerMessageId) return null;
  const reason = typeof row.reason === "string" ? row.reason : null;
  if (event === "bounced" || event === "failed" || event === "delivered") {
    return { providerMessageId, status: event, reason };
  }
  return null;
}

export function verifyEmailWebhook(input: {
  secret: string | undefined;
  rawBody: string;
  headers: Headers;
  now?: number;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) return false;
  const supplied = input.headers.get("x-tutor-review-webhook-secret");
  if (supplied && safeEqual(supplied, secret)) return true;
  const id = input.headers.get("svix-id");
  const timestamp = input.headers.get("svix-timestamp");
  const signature = input.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;
  const stamped = Number(timestamp);
  if (!Number.isFinite(stamped)) return false;
  const now = input.now ?? Date.now();
  if (Math.abs(now - stamped * 1000) > 5 * 60 * 1000) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${input.rawBody}`).digest("base64");
  return signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    return safeEqual(value, expected);
  });
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
