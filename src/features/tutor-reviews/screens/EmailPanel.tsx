"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmailAttemptRow } from "../domain/repository";
import type { EmailMode, EmailPlan, EmailRunSummary } from "../domain/email";
import { CollapsibleSection } from "./CollapsibleSection";
import { resendFailedTutorReviewEmailsAction, resendTutorReviewEmailAction, sendTestTutorReviewEmailAction, sendTutorReviewInvitesAction } from "./actions";
import styles from "./tutor-reviews.module.css";

const FILTERS = ["all", "queued", "sending", "sent", "dry_run", "failed", "bounced"] as const;

export function SendInvitesButton({
  roundId,
  label,
  plan,
  canSend,
  reason,
  mode,
}: {
  roundId: string;
  label: string;
  plan: EmailPlan;
  canSend: boolean;
  reason: string | null;
  mode: EmailMode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<EmailRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button type="button" className={styles.secondary} disabled={!canSend || pending} onClick={() => { setOpen(true); setError(null); }}>
        Send invites
      </button>
      {reason && !canSend ? <p className={styles.muted}>{reason}</p> : null}
      {open ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => setOpen(false)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`send-${roundId}`} onClick={(event) => event.stopPropagation()}>
            <h3 id={`send-${roundId}`}>Send invites for {label}?</h3>
            <ul className={styles.counts}>
              <li>To send: {plan.toSend}</li>
              <li>No email: {plan.noEmail}</li>
              <li>Already submitted: {plan.submitted}</li>
            </ul>
            <p className={styles.muted}>
              {mode === "dry_run"
                ? "This environment records a dry run. No email is sent."
                : "Each person who has not submitted, and who has an email address, receives one link."}
            </p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>Cancel</button>
              <button
                type="button"
                className={styles.primary}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await sendTutorReviewInvitesAction(roundId);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setSummary(result.summary);
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Sending" : "Send invites"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {summary ? <p className={styles.muted}>{summaryText(summary, mode)}</p> : null}
    </div>
  );
}

export function SendTestEmailButton({
  roundId,
  canSend,
  reason,
}: {
  roundId: string;
  canSend: boolean;
  reason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button type="button" className={styles.secondary} disabled={!canSend || pending} onClick={() => { setOpen(true); setError(null); }}>
        Send test email
      </button>
      {reason && !canSend ? <p className={styles.muted}>{reason}</p> : null}
      {open ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => setOpen(false)}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`test-${roundId}`} onClick={(event) => event.stopPropagation()}>
            <h3 id={`test-${roundId}`}>Send the test email?</h3>
            <p className={styles.muted}>This prepares the invite for the test apprentice only. No email is sent. The subject, message, and link are saved in Email attempts.</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>Cancel</button>
              <button
                type="button"
                className={styles.primary}
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await sendTestTutorReviewEmailAction(roundId);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setSummary(`${result.summary.dryRun} recorded as a dry run. No email was sent.`);
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                {pending ? "Preparing" : "Send test email"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {summary ? <p className={styles.muted}>{summary}</p> : null}
    </div>
  );
}

export function EmailAttempts({
  roundId,
  attempts,
  workspace,
  mode,
  queueReady,
}: {
  roundId: string;
  attempts: EmailAttemptRow[];
  workspace: "administration" | "management";
  mode: EmailMode;
  queueReady: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rows = attempts.filter((attempt) => attempt.roundId === roundId && (filter === "all" || attempt.status === filter));
  const failed = attempts.filter((attempt) => attempt.roundId === roundId && (attempt.status === "failed" || attempt.status === "bounced"));

  return (
    <section className={styles.card}>
      <CollapsibleSection id="email" title="Email attempts">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.muted}>
            {queueReady
              ? "Each send is queued. A failed or bounced row can be sent again to the apprentice’s current email, and the old link stops working."
              : "Email sending is not available until the database migration is applied."}
          </p>
        </div>
        <div className={styles.actions}>
          <label className={styles.fieldInline}>
            Status
            <select value={filter} onChange={(event) => setFilter(event.target.value as (typeof FILTERS)[number])}>
              {FILTERS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </label>
          <button
            type="button"
            className={styles.secondary}
            disabled={pending || !failed.length}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await resendFailedTutorReviewEmailsAction(roundId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSummary(summaryText(result.summary, mode));
                router.refresh();
              });
            }}
          >
            Resend all failed
          </button>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>When</th>
              <th>Error</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((attempt) => (
              <tr key={attempt.id}>
                <td>{attempt.email}</td>
                <td>{statusLabel(attempt.status)}</td>
                <td>{formatWhen(attempt.sentAt || attempt.createdAt)}</td>
                <td>
                  {attempt.error || ""}
                  {attempt.renderedSubject ? (
                    <div className={styles.emailPreview}>
                      <strong>{attempt.renderedSubject}</strong>
                      <pre>{attempt.renderedBody}</pre>
                      {attempt.renderedLink ? <p>Link: {attempt.renderedLink}</p> : null}
                    </div>
                  ) : null}
                </td>
                <td>
                  {attempt.status === "failed" || attempt.status === "bounced" ? (
                    <div className={styles.actions}>
                      <a className={styles.secondary} href={`/${workspace}/onboarding/apprentice/${encodeURIComponent(attempt.apprenticeId)}`}>Fix email</a>
                      <button
                        type="button"
                        className={styles.secondary}
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await resendTutorReviewEmailAction(attempt.id);
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            setSummary(summaryText(result.summary, mode));
                            router.refresh();
                          });
                        }}
                      >
                        Resend
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5}>No email attempts for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {summary ? <p className={styles.muted}>{summary}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      </CollapsibleSection>
    </section>
  );
}

function summaryText(summary: EmailRunSummary, mode: EmailMode): string {
  const recorded = mode === "dry_run" ? `${summary.dryRun} recorded as a dry run. No email was sent.` : `${summary.sent} sent.`;
  return `${recorded} ${summary.failed} failed. ${summary.leftQueued} left queued.`;
}

function statusLabel(status: string): string {
  if (status === "all") return "All";
  if (status === "dry_run") return "Dry run";
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
