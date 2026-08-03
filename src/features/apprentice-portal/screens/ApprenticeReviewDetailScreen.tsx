"use client";

import Link from "next/link";
import {
  ApprenticePageShell,
  ApprenticeStatusChip,
} from "../components/ApprenticePageShell";
import { StepBackButton } from "../components/StepBackButton";
import {
  getReviewDetail,
  type ApprenticeReviewAction,
  type ApprenticeReviewDetail,
} from "../domain/apprentice-profile";
import { useApprenticePortalProfile } from "../hooks/useApprenticePortalProfile";
import styles from "./apprentice-pages.module.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusTone(status: ApprenticeReviewDetail["status"]) {
  switch (status) {
    case "upcoming":
      return "blue" as const;
    case "completed":
      return "green" as const;
    case "awaiting_sign_off":
      return "amber" as const;
  }
}

function statusLabel(status: ApprenticeReviewDetail["status"]) {
  switch (status) {
    case "upcoming":
      return "Upcoming";
    case "completed":
      return "Completed";
    case "awaiting_sign_off":
      return "Awaiting sign-off";
  }
}

function actionTone(status: ApprenticeReviewAction["status"]) {
  switch (status) {
    case "done":
      return "green" as const;
    case "due_soon":
      return "amber" as const;
    default:
      return "blue" as const;
  }
}

function actionLabel(status: ApprenticeReviewAction["status"]) {
  switch (status) {
    case "done":
      return "Done";
    case "due_soon":
      return "Due soon";
    default:
      return "Open";
  }
}

function NoteBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.purposeBox}>
      <h3 className={styles.reviewNoteTitle}>{title}</h3>
      <p className={styles.purposeBody}>{body}</p>
    </div>
  );
}

export function ApprenticeReviewDetailScreen({ reviewId }: { reviewId: string }) {
  const { profile } = useApprenticePortalProfile();
  const review = getReviewDetail(reviewId);

  if (!review) {
    return (
      <ApprenticePageShell
        title="Review not found"
        description="That review is not on your list."
        actions={<StepBackButton parentHref="/apprentice/reviews" />}
      >
        <p className={styles.empty}>
          Check Reviews and open a meeting from the list.
        </p>
      </ApprenticePageShell>
    );
  }

  return (
    <ApprenticePageShell
      title={`${review.type} · ${formatDate(review.reviewDate)}`}
      description={review.summary}
      actions={
        <>
          <ApprenticeStatusChip tone={statusTone(review.status)}>
            {statusLabel(review.status)}
          </ApprenticeStatusChip>
          <StepBackButton parentHref="/apprentice/reviews" label="Back" />
        </>
      }
    >
      <div className={styles.stack}>
        {review.judgement ? (
          <p className={styles.note}>
            <strong>Outcome:</strong> {review.judgement}
          </p>
        ) : null}

        <p className={styles.metaBlock}>
          With {review.mentorName} · {review.programmeName} ·{" "}
          {review.employerName}
        </p>

        {review.status === "upcoming" && review.prepareHref ? (
          <p className={styles.note}>
            This meeting has not happened yet. You can still see the planned
            focus and the live statistics that will be used.{" "}
            <Link href={review.prepareHref} className={styles.inlineLink}>
              Prepare on My Learning →
            </Link>
          </p>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Statistics used</h2>
          <p className={styles.meta}>{review.statsNote}</p>
          <div className={styles.grid}>
            {review.statsUsed.map((stat) => {
              const inner = (
                <>
                  <p className={styles.glanceLabel}>{stat.label}</p>
                  <p className={styles.glanceValueSmall}>{stat.value}</p>
                  {stat.hint ? (
                    <p className={styles.glanceHint}>{stat.hint}</p>
                  ) : null}
                </>
              );
              return stat.href ? (
                <Link
                  key={stat.id}
                  href={stat.href}
                  className={styles.glanceLink}
                  data-tone={stat.tone ?? "navy"}
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={stat.id}
                  className={styles.glance}
                  data-tone={stat.tone ?? "navy"}
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What was said</h2>
          <div className={styles.reviewNotes}>
            <NoteBlock title="Discussion" body={review.discussionSummary} />
            <NoteBlock title="Learning focus" body={review.learningFocus} />
            {review.workplaceNotes ? (
              <NoteBlock
                title="Workplace / employer"
                body={review.workplaceNotes}
              />
            ) : null}
            {review.barriersNotes ? (
              <NoteBlock title="Barriers & support" body={review.barriersNotes} />
            ) : null}
            {review.wellbeingNotes ? (
              <NoteBlock title="Wellbeing" body={review.wellbeingNotes} />
            ) : null}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contributions</h2>
          <ul className={styles.list}>
            {review.contributions.map((item) => (
              <li key={item.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong>
                    {item.fromLabel}
                    <span className={styles.meta}> · {item.roleLabel}</span>
                  </strong>
                  <span>{item.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {review.status === "upcoming" ? "Prepare these actions" : "Actions from this review"}
          </h2>
          <ul className={styles.list}>
            {review.actionsFromReview.map((action) => (
              <li key={action.id}>
                <Link href="/apprentice/learning" className={styles.rowLink}>
                  <div className={styles.rowMain}>
                    <strong>{action.title}</strong>
                    <span>Owner: {action.owner}</span>
                  </div>
                  <div className={styles.rowEnd}>
                    <ApprenticeStatusChip tone={actionTone(action.status)}>
                      {actionLabel(action.status)}
                    </ApprenticeStatusChip>
                    <span className={styles.linkish}>My Learning →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Next steps</h2>
          <ul className={styles.bulletList}>
            {review.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>

        <p className={styles.meta}>
          Signed-in as {profile.displayName}. Review records are visible to
          you so you can see what was agreed — not only staff.
        </p>
      </div>
    </ApprenticePageShell>
  );
}
