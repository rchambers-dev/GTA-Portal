import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import { ALEX_PROFILE, ALEX_REVIEWS } from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tone(status: (typeof ALEX_REVIEWS)[number]["status"]) {
  switch (status) {
    case "upcoming":
      return "blue" as const;
    case "completed":
      return "green" as const;
    case "awaiting_sign_off":
      return "amber" as const;
  }
}

function label(status: (typeof ALEX_REVIEWS)[number]["status"]) {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "awaiting_sign_off":
      return "Awaiting sign-off";
  }
}

export function LearnerReviewsScreen() {
  return (
    <LearnerPageShell
      title="Reviews"
      description={`Progress reviews with ${ALEX_PROFILE.mentorName}. Prepare evidence and actions ahead of each meeting.`}
    >
      <ul className={styles.list}>
        {ALEX_REVIEWS.map((review) => {
          const body = (
            <>
              <div className={styles.rowMain}>
                <strong>
                  {review.type} · {formatDate(review.reviewDate)}
                </strong>
                {review.judgement ? (
                  <span>Outcome: {review.judgement}</span>
                ) : (
                  <span>With {ALEX_PROFILE.mentorName}</span>
                )}
                {review.status === "completed" ? (
                  <span className={styles.meta}>
                    Full review record opens for staff after the meeting. Ask your mentor if you
                    need a copy of the summary.
                  </span>
                ) : review.href ? (
                  <span className={styles.meta}>
                    Use My Learning to prepare actions and evidence for this review.
                  </span>
                ) : null}
              </div>
              <div className={styles.rowEnd}>
                <LearnerStatusChip tone={tone(review.status)}>
                  {label(review.status)}
                </LearnerStatusChip>
                {review.href ? (
                  <span className={styles.linkish}>
                    {review.status === "upcoming" ? "Prepare →" : "Open review →"}
                  </span>
                ) : null}
              </div>
            </>
          );

          return (
            <li key={review.id}>
              {review.href ? (
                <Link href={review.href} className={styles.rowLink}>
                  {body}
                </Link>
              ) : (
                <div className={styles.row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </LearnerPageShell>
  );
}
