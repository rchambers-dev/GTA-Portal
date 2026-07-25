import Link from "next/link";
import {
  LearnerPageShell,
  LearnerStatusChip,
} from "../components/LearnerPageShell";
import {
  ALEX_PROFILE,
  ALEX_REVIEW_DETAILS,
  type LearnerReviewDetail,
} from "../domain/mock-learner";
import styles from "./learner-pages.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tone(status: LearnerReviewDetail["status"]) {
  switch (status) {
    case "upcoming":
      return "blue" as const;
    case "completed":
      return "green" as const;
    case "awaiting_sign_off":
      return "amber" as const;
  }
}

function label(status: LearnerReviewDetail["status"]) {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "awaiting_sign_off":
      return "Awaiting sign-off";
  }
}

function ctaLabel(review: LearnerReviewDetail): string {
  if (review.status === "upcoming") return "Open prep →";
  if (review.status === "awaiting_sign_off") return "View draft →";
  return "Read review →";
}

export function LearnerReviewsScreen() {
  const upcoming = ALEX_REVIEW_DETAILS.filter((r) => r.status === "upcoming");
  const past = ALEX_REVIEW_DETAILS.filter((r) => r.status !== "upcoming");

  return (
    <LearnerPageShell
      title="Reviews"
      description={`Progress reviews with ${ALEX_PROFILE.mentorName}. Open a review to read what was said, the outcome, and which statistics were used.`}
    >
      <div className={styles.stack}>
        <p className={styles.note}>
          Learners can open completed reviews — not only staff. Figures link
          through to Progress, Attendance, OTJ, and My Learning as those areas
          grow.
        </p>

        {upcoming.length > 0 ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Coming up</h2>
            <ul className={styles.list}>
              {upcoming.map((review) => (
                <li key={review.id}>
                  <Link href={review.href!} className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <strong>
                        {review.type} · {formatDate(review.reviewDate)}
                      </strong>
                      <span>With {review.mentorName}</span>
                      <span className={styles.meta}>
                        See the planned focus and the live stats that will be
                        discussed.
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <LearnerStatusChip tone={tone(review.status)}>
                        {label(review.status)}
                      </LearnerStatusChip>
                      <span className={styles.linkish}>{ctaLabel(review)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your review history</h2>
          {past.length === 0 ? (
            <p className={styles.empty}>No completed reviews yet.</p>
          ) : (
            <ul className={styles.list}>
              {past.map((review) => (
                <li key={review.id}>
                  <Link href={review.href!} className={styles.rowLink}>
                    <div className={styles.rowMain}>
                      <strong>
                        {review.type} · {formatDate(review.reviewDate)}
                      </strong>
                      {review.judgement ? (
                        <span>Outcome: {review.judgement}</span>
                      ) : (
                        <span>With {review.mentorName}</span>
                      )}
                      <span className={styles.meta}>
                        Read discussion notes, contributions, and the statistics
                        used on the day.
                      </span>
                    </div>
                    <div className={styles.rowEnd}>
                      <LearnerStatusChip tone={tone(review.status)}>
                        {label(review.status)}
                      </LearnerStatusChip>
                      <span className={styles.linkish}>{ctaLabel(review)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </LearnerPageShell>
  );
}
