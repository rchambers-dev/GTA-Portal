import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMAIL_BATCH_SIZE,
  canResend,
  emptyEmailSummary,
  londonToday,
  roundCanSend,
  settleSend,
  tutorReviewEmail,
  type EmailAttemptStatus,
  type EmailRunSummary,
} from "./email";
import { tutorReviewEmailSender } from "./email-provider";
import { hashReviewToken, newReviewToken, type RoundStatus } from "./rules";

const QUEUE_MISSING = "Invite email is not available until the database migration is applied.";
const MAX_BATCHES = 15;

type AttemptRow = {
  id: string;
  invite_id: string;
  email: string;
  dispatch_token: string | null;
  attempt_no: number;
  status: EmailAttemptStatus;
};

export async function sendRoundInvites(supabase: SupabaseClient, roundId: string, resend: boolean): Promise<{ ok: true; summary: EmailRunSummary } | { ok: false; error: string }> {
  const round = await loadRound(supabase, roundId);
  if (!round.ok) return round;
  const gate = roundCanSend({ status: round.status, closesOn: round.closesOn, closedEarly: round.closedEarly, today: londonToday() });
  if (!gate.ok) return { ok: false, error: gate.reason };

  const recipients = await loadRecipients(supabase, roundId, resend);
  if (!recipients.ok) return recipients;
  const queued = await enqueue(supabase, roundId, resend, recipients.rows);
  if (!queued.ok) return queued;
  try {
    const summary = await drain(supabase, roundId, round.label, round.closesOn);
    summary.queued = queued.queued;
    return { ok: true, summary };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : QUEUE_MISSING };
  }
}

export async function resendOneInvite(supabase: SupabaseClient, attemptId: string): Promise<{ ok: true; summary: EmailRunSummary } | { ok: false; error: string }> {
  const attempt = await supabase.from("tutor_review_email_attempts").select("id, round_id, apprentice_id, status").eq("id", attemptId).maybeSingle();
  if (attempt.error) return { ok: false, error: friendly(attempt.error.message) };
  const row = attempt.data as { id: string; round_id: string; apprentice_id: string; status: EmailAttemptStatus } | null;
  if (!row || !canResend(row.status)) return { ok: false, error: "Only a failed or bounced email can be sent again." };
  const sent = await sendRoundInvitesFor(supabase, row.round_id, [row.apprentice_id]);
  return sent;
}

async function sendRoundInvitesFor(supabase: SupabaseClient, roundId: string, apprenticeIds: string[]): Promise<{ ok: true; summary: EmailRunSummary } | { ok: false; error: string }> {
  const round = await loadRound(supabase, roundId);
  if (!round.ok) return { ok: false, error: round.error };
  const gate = roundCanSend({ status: round.status, closesOn: round.closesOn, closedEarly: round.closedEarly, today: londonToday() });
  if (!gate.ok) return { ok: false, error: gate.reason };
  const recipients = await loadRecipients(supabase, roundId, true, apprenticeIds);
  if (!recipients.ok) return recipients;
  if (!recipients.rows.length) return { ok: false, error: "That apprentice has no email, or the review was already submitted." };
  const queued = await enqueue(supabase, roundId, true, recipients.rows);
  if (!queued.ok) return queued;
  try {
    const summary = await drain(supabase, roundId, round.label, round.closesOn);
    summary.queued = queued.queued;
    return { ok: true, summary };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The email queue could not be processed." };
  }
}

async function loadRound(supabase: SupabaseClient, roundId: string) {
  const result = await supabase.from("tutor_review_rounds").select("id, label, closes_on, status, closed_early_at").eq("id", roundId).maybeSingle();
  if (result.error) return { ok: false as const, error: friendly(result.error.message) };
  const row = result.data as { label: string; closes_on: string; status: RoundStatus; closed_early_at: string | null } | null;
  if (!row) return { ok: false as const, error: "That round could not be found." };
  return { ok: true as const, label: row.label, closesOn: row.closes_on, status: row.status, closedEarly: Boolean(row.closed_early_at) };
}

async function loadRecipients(supabase: SupabaseClient, roundId: string, resend: boolean, onlyApprenticeIds?: string[]) {
  const [peopleResult, tutorsResult, invitesResult, attemptsResult] = await Promise.all([
    supabase.from("apprentices").select("gta_id, email"),
    supabase.from("apprentice_tutors").select("apprentice_id, tutor_id, start_date").is("end_date", null),
    supabase.from("tutor_review_invites").select("id, apprentice_id, used_at").eq("round_id", roundId),
    supabase.from("tutor_review_email_attempts").select("invite_id, apprentice_id, status").eq("round_id", roundId),
  ]);
  const failure = peopleResult.error || tutorsResult.error || invitesResult.error || attemptsResult.error;
  if (failure) return { ok: false as const, error: friendly(failure.message) };
  const tutors = new Map<string, { tutorId: string; start: string }>();
  for (const row of (tutorsResult.data ?? []) as { apprentice_id: string; tutor_id: string; start_date: string }[]) {
    const current = tutors.get(row.apprentice_id);
    if (!current || row.start_date > current.start) tutors.set(row.apprentice_id, { tutorId: row.tutor_id, start: row.start_date });
  }
  const invites = new Map(((invitesResult.data ?? []) as { id: string; apprentice_id: string; used_at: string | null }[]).map((row) => [row.apprentice_id, row]));
  const statuses = new Map<string, EmailAttemptStatus[]>();
  for (const row of (attemptsResult.data ?? []) as { apprentice_id: string; status: EmailAttemptStatus }[]) {
    const list = statuses.get(row.apprentice_id) ?? [];
    list.push(row.status);
    statuses.set(row.apprentice_id, list);
  }
  const wanted = onlyApprenticeIds ? new Set(onlyApprenticeIds) : null;
  const rows: { apprenticeId: string; tutorId: string; email: string; tokenHash: string; dispatchToken: string }[] = [];
  for (const person of (peopleResult.data ?? []) as { gta_id: string; email: string | null }[]) {
    if (wanted && !wanted.has(person.gta_id)) continue;
    const tutor = tutors.get(person.gta_id);
    const email = person.email?.trim() || "";
    if (!tutor || !email) continue;
    if (invites.get(person.gta_id)?.used_at) continue;
    const history = statuses.get(person.gta_id) ?? [];
    const blocking = history.some((status) => status === "queued" || status === "sending" || status === "sent" || status === "dry_run" || (!resend && (status === "failed" || status === "bounced")));
    if (blocking) continue;
    if (resend && !history.some((status) => canResend(status))) continue;
    const dispatchToken = newReviewToken();
    rows.push({ apprenticeId: person.gta_id, tutorId: tutor.tutorId, email, tokenHash: hashReviewToken(dispatchToken), dispatchToken });
  }
  return { ok: true as const, rows };
}

async function enqueue(supabase: SupabaseClient, roundId: string, resend: boolean, rows: { apprenticeId: string; tutorId: string; email: string; tokenHash: string; dispatchToken: string }[]) {
  if (!rows.length) return { ok: true as const, queued: 0 };
  const result = await supabase.rpc("enqueue_tutor_review_emails", { p_round_id: roundId, p_resend: resend, p_rows: rows });
  if (result.error) return { ok: false as const, error: friendly(result.error.message) };
  const queued = Number((result.data as { queued?: number } | null)?.queued ?? 0);
  return { ok: true as const, queued };
}

async function drain(supabase: SupabaseClient, roundId: string, label: string, closesOn: string): Promise<EmailRunSummary> {
  const summary = emptyEmailSummary();
  const sender = tutorReviewEmailSender();
  const origin = await publicOrigin();
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const claimed = await supabase.rpc("claim_tutor_review_email_batch", { p_round_id: roundId, p_limit: EMAIL_BATCH_SIZE });
    if (claimed.error) throw new Error(friendly(claimed.error.message));
    const rows = (claimed.data ?? []) as AttemptRow[];
    if (!rows.length) break;
    const inviteIds = rows.map((row) => row.invite_id);
    const usedResult = await supabase.from("tutor_review_invites").select("id, used_at").in("id", inviteIds);
    const used = new Set(((usedResult.data ?? []) as { id: string; used_at: string | null }[]).filter((row) => row.used_at).map((row) => row.id));
    for (const row of rows) {
      const outcome = used.has(row.invite_id) || !row.dispatch_token
        ? { status: "failed" as const, providerMessageId: null, error: used.has(row.invite_id) ? "Already submitted. Nothing was sent." : "The link for this email was missing.", nextAttemptAt: null }
        : settleSend({
          mode: sender.mode,
          attemptNo: row.attempt_no,
          now: new Date(),
          result: await sender.send({
            to: row.email,
            idempotencyKey: `tutor-review-${row.id}`,
            ...tutorReviewEmail({ roundLabel: label, closesOn, link: `${origin}/tutor-review/${row.dispatch_token}` }),
          }),
        });
      const saved = await supabase.rpc("complete_tutor_review_email_attempt", {
        p_id: row.id,
        p_status: outcome.status,
        p_provider_message_id: outcome.providerMessageId,
        p_error: outcome.error,
        p_next_attempt_at: outcome.nextAttemptAt,
      });
      if (saved.error) throw new Error(friendly(saved.error.message));
      if (outcome.status === "sent") summary.sent += 1;
      else if (outcome.status === "dry_run") summary.dryRun += 1;
      else if (outcome.status === "failed" || outcome.status === "bounced") summary.failed += 1;
    }
  }
  const left = await supabase.from("tutor_review_email_attempts").select("id", { count: "exact", head: true }).eq("round_id", roundId).eq("status", "queued");
  summary.leftQueued = left.count ?? 0;
  return summary;
}

async function publicOrigin(): Promise<string> {
  const configured = process.env.TUTOR_REVIEW_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "https://gta-portal.vercel.app";
}

function friendly(message: string): string {
  return /tutor_review_email|does not exist|schema cache/i.test(message) ? QUEUE_MISSING : message;
}
