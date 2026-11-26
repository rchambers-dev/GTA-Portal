"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { LearnerReviews } from "../domain/cycle-view";
import { openReviewAction, setReviewerAction } from "./cycle-actions";
import styles from "./learner-reviews.module.css";

function DueStanding({ reviews, canSet }: { reviews: LearnerReviews; canSet: boolean }) {
  if (reviews.dueTone === "none") {
    if (canSet) return null;
    return <strong>{reviews.inBreak ? "Paused in break" : "Not set"}</strong>;
  }
  const tone = reviews.dueTone === "on-track" ? styles.onTrack : reviews.dueTone === "soon" ? styles.soon : styles.overdue;
  return (
    <span className={styles.standingRow}>
      <strong>{reviews.nextDue}</strong>
      <em className={`${styles.standing} ${tone}`}>{reviews.dueLabel}</em>
      {reviews.inBreak ? <em className={styles.aside}>Paused in break</em> : null}
    </span>
  );
}

function SetNextReview({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (date: string) => void;
}) {
  const [dueDate, setDueDate] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    onSubmit(dueDate);
  }
  return (
    <form className={styles.dueForm} onSubmit={save} data-review-due="set">
      <input
        type="date"
        required
        aria-label="Set next review"
        value={dueDate}
        disabled={pending}
        title="Closed days are struck through on the Plan calendar and cannot be saved."
        onChange={(event) => setDueDate(event.target.value)}
      />
      <button type="submit" disabled={pending || !dueDate}>
        Set next review
      </button>
    </form>
  );
}

export function LearnerReviewsPanel({
  reviews,
  canChangeReviewer,
}: {
  reviews: LearnerReviews;
  canChangeReviewer: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function changeReviewer(reviewerId: string) {
    if (!reviews.openReviewId) return;
    setError("");
    const result = await setReviewerAction({ reviewId: reviews.openReviewId, reviewerId });
    if (!result.ok) {
      setError(result.formError);
      return;
    }
    router.refresh();
  }

  const canSetNext = canChangeReviewer && !reviews.hasReview;

  async function saveNextReview(date: string) {
    setError("");
    setNotice("");
    setPending(true);
    const result = await openReviewAction({ gtaId: reviews.gtaId, plannedOn: date });
    setPending(false);
    if (!result.ok) {
      setError(result.formError);
      return;
    }
    setNotice(result.message);
    router.refresh();
  }

  return (
    <div className={styles.stack}>
      {reviews.loadError ? <p className={styles.error} role="alert">{reviews.loadError}</p> : null}
      <section className={styles.card}>
        <h2>This review</h2>
        <div className={styles.steps}>
          {reviews.steps.map((step) => (
            <div
              key={step.id}
              className={`${styles.step} ${
                step.tone === "done" ? styles.done : step.tone === "late" ? styles.late : step.tone === "current" ? styles.current : ""
              }`}
            >
              <strong>{step.label}</strong>
              <em>{step.detail}</em>
            </div>
          ))}
        </div>
        <div className={styles.facts}>
          <div className={canSetNext ? styles.dueWide : undefined}>
            <span>Next review due</span>
            <DueStanding reviews={reviews} canSet={canSetNext} />
            {canSetNext ? (
              <SetNextReview pending={pending} onSubmit={saveNextReview} />
            ) : null}
          </div>
          <div>
            <span>Last actual date</span>
            <strong>{reviews.lastActual}</strong>
          </div>
          <label>
            Reviewer
            {canChangeReviewer && reviews.openReviewId ? (
              <select
                value={reviews.reviewerId || ""}
                aria-label="Reviewer"
                onChange={(event) => changeReviewer(event.target.value)}
              >
                {reviews.reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>{reviewer.name}</option>
                ))}
              </select>
            ) : (
              <strong>{reviews.reviewerName}</strong>
            )}
          </label>
          <div>
            <span>Method</span>
            <strong>{reviews.booked && reviews.method ? reviews.method : "Once booked"}</strong>
          </div>
        </div>
        {notice ? <p className={styles.saved} role="status">{notice}</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </section>
      <section className={styles.tableWrap}>
        <h2>Completed reviews</h2>
        {reviews.history.length === 0 ? (
          <p className={styles.note}>No completed review yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Reviewer</th>
                <th>Planned</th>
                <th>Actual</th>
                <th>Method</th>
                <th>Status</th>
                <th>Attachment</th>
              </tr>
            </thead>
            <tbody>
              {reviews.history.map((row) => (
                <tr key={row.id}>
                  <td>{row.number}</td>
                  <td>{row.reviewer}</td>
                  <td>{row.plannedOn}</td>
                  <td>{row.actualOn}</td>
                  <td>{row.method}</td>
                  <td>{row.status}</td>
                  <td>
                    {row.packId ? (
                      <Link className={styles.link} href={`/reviews?pack=${row.packId}`}>
                        Digital review
                      </Link>
                    ) : (
                      "Not saved yet"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
