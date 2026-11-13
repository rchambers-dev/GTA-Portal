import { resolveEmailMode, type EmailMode, type ProviderSendResult } from "./email";
import { createGraphSender, readGraphCredentials } from "./email-graph";

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

export function graphCredentialsFrom(env: NodeJS.ProcessEnv) {
  return readGraphCredentials({
    tenantId: env.MS_GRAPH_TENANT_ID,
    clientId: env.MS_GRAPH_CLIENT_ID,
    clientSecret: env.MS_GRAPH_CLIENT_SECRET,
    sender: env.MS_GRAPH_SENDER,
  });
}

export function currentEmailMode(env: NodeJS.ProcessEnv = process.env): EmailMode {
  const requested = resolveEmailMode({
    vercelEnv: env.VERCEL_ENV,
    nodeEnv: env.NODE_ENV,
    mode: env.TUTOR_REVIEW_EMAIL_MODE,
  });
  if (requested !== "live" || !graphCredentialsFrom(env)) return "dry_run";
  return "live";
}

export function tutorReviewEmailSender(env: NodeJS.ProcessEnv = process.env): TutorReviewEmailSender {
  const credentials = graphCredentialsFrom(env);
  if (currentEmailMode(env) !== "live" || !credentials) return dryRunSender;
  return createGraphSender(credentials);
}
