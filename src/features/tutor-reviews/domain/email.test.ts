import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EMAIL_BATCH_SIZE,
  canResend,
  emailPlan,
  resolveEmailMode,
  selectInviteRecipients,
  roundCanSend,
  settleSend,
  tutorReviewEmail,
} from "./email";
import { createGraphSender, parseNdr, retryAfterMs } from "./email-graph";
import { currentEmailMode, dryRunSender } from "./email-provider";
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

  it("sends learner invites to real apprentices and the test email only to the test apprentice", () => {
    const people = [
      { apprenticeId: "GTA-1", email: "learner@example.com", tutorId: "tutor", submitted: false, isTest: false, statuses: [] },
      { apprenticeId: "GTA-TEST", email: "reiss.kc@gmail.com", tutorId: "tutor", submitted: false, isTest: true, statuses: ["dry_run" as const] },
    ];
    expect(selectInviteRecipients(people, { audience: "apprentices", resend: false }).map((person) => person.apprenticeId)).toEqual(["GTA-1"]);
    expect(selectInviteRecipients(people, { audience: "test", resend: false }).map((person) => person.apprenticeId)).toEqual(["GTA-TEST"]);
    expect(selectInviteRecipients(people, { audience: "apprentices", resend: false }).some((person) => person.isTest)).toBe(false);
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
    expect(currentEmailMode({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      TUTOR_REVIEW_EMAIL_MODE: "live",
    } as NodeJS.ProcessEnv)).toBe("dry_run");
    expect(currentEmailMode({
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
      TUTOR_REVIEW_EMAIL_MODE: "live",
      MS_GRAPH_TENANT_ID: "tenant",
      MS_GRAPH_CLIENT_ID: "client",
      MS_GRAPH_CLIENT_SECRET: "secret",
      MS_GRAPH_SENDER: "reiss@example.com",
    } as NodeJS.ProcessEnv)).toBe("dry_run");
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
    const throttled = settleSend({
      mode: "live",
      attemptNo: 1,
      now,
      result: { ok: false, transient: true, error: "Microsoft Graph is throttling mail.", retryAfterMs: 120_000 },
    });
    expect(throttled.nextAttemptAt).toBe("2026-12-01T09:02:00.000Z");
    expect(retryAfterMs("30", now)).toBe(30_000);
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
    const ndr = parseNdr({
      subject: "Undeliverable: Your tutor review – December 2026",
      sender: "reiss@example.com",
      body: "Your message to apprentice@example.com couldn't be delivered.\n550 5.1.1 User unknown\nReference tutor-review-11111111-1111-1111-1111-111111111111\nreiss@example.com",
    });
    expect(ndr?.reference).toBe("tutor-review-11111111-1111-1111-1111-111111111111");
    expect(ndr?.recipient).toBe("apprentice@example.com");
    expect(ndr?.reason).toContain("550");
  });

  it("sends through Microsoft Graph and honours Retry-After", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: typeof init?.body === "string" ? init.body : undefined });
      if (url.includes("/token")) {
        return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
      }
      return new Response("", { status: 429, headers: { "retry-after": "45" } });
    };
    const sender = createGraphSender({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      sender: "reiss@example.com",
    }, fetchImpl);
    const result = await sender.send({
      to: "apprentice@example.com",
      subject: "Your tutor review – December 2026",
      text: "Hello",
      html: "<p>Hello</p>",
      idempotencyKey: "tutor-review-11111111-1111-1111-1111-111111111111",
    });
    expect(result).toMatchObject({ ok: false, transient: true, retryAfterMs: 45_000 });
    expect(calls.some((call) => call.url.includes("/users/reiss%40example.com/sendMail"))).toBe(true);
    expect(calls.some((call) => call.body?.includes("client_secret=secret"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("creates one test apprentice and keeps a dry-run copy of the email", () => {
    const sql = readFileSync(new URL("../../../../supabase/migrations/20261113191000_test_apprentice.sql", import.meta.url), "utf8");
    expect(sql).toContain("reiss.kc@gmail.com");
    expect(sql).toContain("is_test");
    expect(sql).toContain("rendered_subject");
    expect(sql).toContain("rendered_body");
    expect(sql).toContain("rendered_link");
    expect(sql).not.toContain("sendMail");
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
