import type { RoundStatus } from "./rules";

export type EmailAttemptStatus = "queued" | "sending" | "sent" | "failed" | "bounced" | "dry_run";

export type EmailMode = "dry_run" | "live";

export type EmailPlan = { toSend: number; noEmail: number; submitted: number };

export type EmailRunSummary = {
  queued: number;
  sent: number;
  dryRun: number;
  failed: number;
  leftQueued: number;
};

export const EMAIL_BATCH_SIZE = 20;
export const EMAIL_MAX_ATTEMPTS = 4;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}

/** Open rounds can be sent now. A draft still inside its dates is scheduled to open. */
export function roundCanSend(input: { status: RoundStatus; closesOn: string; closedEarly: boolean; today: string }): { ok: true } | { ok: false; reason: string } {
  if (input.status === "closed" || input.closedEarly || input.today > input.closesOn) {
    return { ok: false, reason: "Invites can be sent when a round is open or scheduled to open." };
  }
  return { ok: true };
}

export function emailPlan(rows: { email: string | null; submitted: boolean; latestStatus: EmailAttemptStatus | null }[]): EmailPlan {
  const plan = { toSend: 0, noEmail: 0, submitted: 0 };
  for (const row of rows) {
    if (row.submitted) {
      plan.submitted += 1;
      continue;
    }
    if (!row.email?.trim()) {
      plan.noEmail += 1;
      continue;
    }
    if (row.latestStatus) continue;
    plan.toSend += 1;
  }
  return plan;
}

export function canResend(status: EmailAttemptStatus): boolean {
  return status === "failed" || status === "bounced";
}

export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[(month || 1) - 1]} ${year}`;
}

export function tutorReviewEmail(input: { roundLabel: string; closesOn: string; link: string }): { subject: string; text: string; html: string } {
  const closes = formatLongDate(input.closesOn);
  const subject = `Your tutor review – ${input.roundLabel}`;
  const text = [
    "Hello,",
    "",
    "Please tell us about your sessions with your tutor. It only takes a few minutes.",
    "",
    input.link,
    "",
    `Please send it by ${closes}.`,
    "",
    "Your answers are confidential. They are stored without your name.",
    "",
    "Thank you.",
  ].join("\n");
  const html = [
    "<p>Hello,</p>",
    "<p>Please tell us about your sessions with your tutor. It only takes a few minutes.</p>",
    `<p><a href="${escapeHtml(input.link)}">${escapeHtml(input.link)}</a></p>`,
    `<p>Please send it by ${escapeHtml(closes)}.</p>`,
    "<p>Your answers are confidential. They are stored without your name.</p>",
    "<p>Thank you.</p>",
  ].join("");
  return { subject, text, html };
}

export function resolveEmailMode(env: { vercelEnv?: string | null; nodeEnv?: string | null; mode?: string | null }): EmailMode {
  if (env.vercelEnv === "preview" || env.vercelEnv === "development") return "dry_run";
  if (env.nodeEnv !== "production") return "dry_run";
  if (env.mode === "live" && env.vercelEnv === "production") return "live";
  return "dry_run";
}

export function backoffMs(attemptNo: number): number {
  const steps = [60_000, 5 * 60_000, 15 * 60_000];
  return steps[Math.min(Math.max(attemptNo - 1, 0), steps.length - 1)];
}

export type ProviderSendResult = { ok: true; providerMessageId: string } | { ok: false; transient: boolean; error: string };

export function settleSend(input: { mode: EmailMode; attemptNo: number; result: ProviderSendResult; now: Date }): {
  status: EmailAttemptStatus;
  providerMessageId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
} {
  if (input.result.ok) {
    return {
      status: input.mode === "dry_run" ? "dry_run" : "sent",
      providerMessageId: input.result.providerMessageId,
      error: null,
      nextAttemptAt: null,
    };
  }
  if (input.result.transient && input.attemptNo < EMAIL_MAX_ATTEMPTS) {
    return {
      status: "queued",
      providerMessageId: null,
      error: input.result.error,
      nextAttemptAt: new Date(input.now.getTime() + backoffMs(input.attemptNo)).toISOString(),
    };
  }
  return { status: "failed", providerMessageId: null, error: input.result.error, nextAttemptAt: null };
}

export function emptyEmailSummary(): EmailRunSummary {
  return { queued: 0, sent: 0, dryRun: 0, failed: 0, leftQueued: 0 };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}
