import { resolveEmailMode, type EmailMode, type ProviderSendResult } from "./email";

export type OutboundTutorReviewEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

export interface TutorReviewEmailSender {
  readonly mode: EmailMode;
  send(message: OutboundTutorReviewEmail): Promise<ProviderSendResult>;
}

export const dryRunSender: TutorReviewEmailSender = {
  mode: "dry_run",
  async send(message) {
    return { ok: true, providerMessageId: `dry_run:${message.idempotencyKey}` };
  },
};

export function resendSender(input: { apiKey: string; from: string; replyTo?: string | null }): TutorReviewEmailSender {
  return {
    mode: "live",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: input.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: input.replyTo || undefined,
        }),
      });
      if (response.status === 429 || response.status >= 500) {
        return { ok: false, transient: true, error: `The email provider returned ${response.status}.` };
      }
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 400);
        return { ok: false, transient: false, error: detail || `The email provider returned ${response.status}.` };
      }
      const payload = await response.json() as { id?: string };
      if (!payload.id) return { ok: false, transient: true, error: "The email provider did not return a message id." };
      return { ok: true, providerMessageId: payload.id };
    },
  };
}

export function tutorReviewEmailSender(env: NodeJS.ProcessEnv = process.env): TutorReviewEmailSender {
  const mode = resolveEmailMode({
    vercelEnv: env.VERCEL_ENV,
    nodeEnv: env.NODE_ENV,
    mode: env.TUTOR_REVIEW_EMAIL_MODE,
  });
  if (mode === "dry_run") return dryRunSender;
  const provider = (env.TUTOR_REVIEW_EMAIL_PROVIDER || "resend").trim().toLowerCase();
  if (provider !== "resend") {
    return {
      mode: "live",
      async send() {
        return { ok: false, transient: false, error: `The email provider "${provider}" is not configured.` };
      },
    };
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.TUTOR_REVIEW_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return {
      mode: "live",
      async send() {
        return { ok: false, transient: false, error: "Set RESEND_API_KEY and TUTOR_REVIEW_EMAIL_FROM before live sending." };
      },
    };
  }
  return resendSender({ apiKey, from, replyTo: env.TUTOR_REVIEW_EMAIL_REPLY_TO });
}
