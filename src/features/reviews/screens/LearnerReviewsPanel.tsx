"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LearnerReviews } from "../domain/cycle-view";
import { setReviewerAction } from "./cycle-actions";
import styles from "./learner-reviews.module.css";

export function LearnerReviewsPanel({
  reviews,
  canChangeReviewer,
}: {
  reviews: LearnerReviews;
  canChangeReviewer: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

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
          <div>
            <span>Next review due</span>
            <strong>{reviews.inBreak ? "Paused in break" : reviews.nextDue}</strong>
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
