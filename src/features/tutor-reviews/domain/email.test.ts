import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMAIL_BATCH_SIZE,
  canResend,
  emailPlan,
  resolveEmailMode,
  roundCanSend,
  settleSend,
  tutorReviewEmail,
} from "./email";
import { dryRunSender } from "./email-provider";
import { parseTutorReviewEmailEvent, verifyEmailWebhook } from "./email-webhook";

describe("tutor review invite emails", () => {
  it("counts who can be sent, who has no email, and who already submitted", () => {
    expect(emailPlan([
      { email: "a@example.com", submitted: false, latestStatus: null },
      { email: null, submitted: false, latestStatus: null },
      { email: "b@example.com", submitted: true, latestStatus: null },
      { email: "c@example.com", submitted: false, latestStatus: "sent" },
      { email: "d@example.com", submitted: false, latestStatus: "dry_run" },
      { email: "e@example.com", submitted: false, latestStatus: "failed" },
    ])).toEqual({ toSend: 1, noEmail: 1, submitted: 1 });
  });

  it("sends only while a round is open or scheduled to open", () => {
    const open = { status: "open" as const, closesOn: "2026-12-19", closedEarly: false, today: "2026-12-08" };
    expect(roundCanSend(open).ok).toBe(true);
    expect(roundCanSend({ ...open, status: "draft", today: "2026-11-01" }).ok).toBe(true);
    expect(roundCanSend({ ...open, status: "closed" }).ok).toBe(false);
    expect(roundCanSend({ ...open, closedEarly: true }).ok).toBe(false);
    expect(roundCanSend({ ...open, today: "2026-12-20" }).ok).toBe(false);
  });

  it("writes a confidential email with the link and the closing date", () => {
    const message = tutorReviewEmail({
      roundLabel: "December 2026",
      closesOn: "2026-12-19",
      link: "https://example.test/tutor-review/token",
    });
    expect(message.subject).toBe("Your tutor review – December 2026");
    expect(message.text).toContain("https://example.test/tutor-review/token");
    expect(message.text).toContain("19 December 2026");
    expect(message.text).toContain("Your answers are confidential.");
    expect(message.html).toContain("https://example.test/tutor-review/token");
  });

  it("keeps preview and every non-production run on the dry-run sender", async () => {
    expect(resolveEmailMode({ vercelEnv: "preview", nodeEnv: "production", mode: "live" })).toBe("dry_run");
    expect(resolveEmailMode({ vercelEnv: "production", nodeEnv: "production", mode: "live" })).toBe("live");
    expect(resolveEmailMode({ vercelEnv: "production", nodeEnv: "production", mode: "dry_run" })).toBe("dry_run");
    expect(resolveEmailMode({ vercelEnv: "production", nodeEnv: "development", mode: "live" })).toBe("dry_run");
    const result = await dryRunSender.send({
      to: "a@example.com",
      subject: "Your tutor review – December 2026",
      text: "Hello",
      html: "<p>Hello</p>",
      idempotencyKey: "attempt-1",
    });
    expect(result).toEqual({ ok: true, providerMessageId: "dry_run:attempt-1" });
  });

  it("retries a transient failure and does not send again after the provider accepts", () => {
    const now = new Date("2026-12-01T09:00:00.000Z");
    const retry = settleSend({
      mode: "live",
      attemptNo: 1,
      now,
      result: { ok: false, transient: true, error: "The email provider returned 429." },
    });
    expect(retry.status).toBe("queued");
    expect(retry.nextAttemptAt).toBe("2026-12-01T09:01:00.000Z");
    const accepted = settleSend({
      mode: "dry_run",
      attemptNo: 2,
      now,
      result: { ok: true, providerMessageId: "dry_run:attempt-1" },
    });
    expect(accepted.status).toBe("dry_run");
    const exhausted = settleSend({
      mode: "live",
      attemptNo: 4,
      now,
      result: { ok: false, transient: true, error: "still busy" },
    });
    expect(exhausted.status).toBe("failed");
    expect(canResend("failed")).toBe(true);
    expect(canResend("bounced")).toBe(true);
    expect(canResend("sent")).toBe(false);
    expect(EMAIL_BATCH_SIZE).toBe(20);
  });

  it("reads a bounce from the provider webhook and checks its signature", () => {
    expect(parseTutorReviewEmailEvent({
      providerMessageId: "msg_1",
      event: "bounced",
      reason: "Mailbox does not exist",
    })).toEqual({ providerMessageId: "msg_1", status: "bounced", reason: "Mailbox does not exist" });
    expect(parseTutorReviewEmailEvent({
      type: "email.bounced",
      data: { email_id: "msg_2", bounce: { message: "User unknown" } },
    })?.status).toBe("bounced");
    const secret = Buffer.from("webhook-secret").toString("base64");
    const raw = "{\"ok\":true}";
    const timestamp = "1700000000";
    const signature = createHmac("sha256", Buffer.from(secret, "base64")).update(`msg.1700000000.${raw}`).digest("base64");
    const headers = new Headers({
      "svix-id": "msg",
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    });
    expect(verifyEmailWebhook({ secret: `whsec_${secret}`, rawBody: raw, headers, now: 1700000000 * 1000 })).toBe(true);
    expect(verifyEmailWebhook({ secret: "plain-secret", rawBody: raw, headers: new Headers({ "x-tutor-review-webhook-secret": "plain-secret" }) })).toBe(true);
    expect(verifyEmailWebhook({ secret: undefined, rawBody: raw, headers })).toBe(false);
  });

  it("stores the queue so a crash cannot send the same invite twice", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/20261113170000_tutor_review_email.sql", import.meta.url), "utf8");
    expect(sql).toContain("status in ('queued', 'sending')");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("'dry_run'");
    expect(sql).toContain("dispatch_token = null");
    expect(sql).not.toMatch(/tutor_review_invites[\s\S]{0,200}dispatch_token/);
  });
});
