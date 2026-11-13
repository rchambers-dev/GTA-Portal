import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { resolveEmailMode } from "../domain/email";
import { loadTutorReviewsPage } from "../domain/repository";
import { TutorReviewsBoard } from "./TutorReviewsBoard";
import styles from "./tutor-reviews.module.css";

export async function TutorReviewsScreen({ workspace }: { workspace: "administration" | "management" }) {
  const page = await loadTutorReviewsPage();
  const emailMode = resolveEmailMode({
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    mode: process.env.TUTOR_REVIEW_EMAIL_MODE,
  });
  return (
    <ApprenticePageShell
      eyebrow="Reviews"
      title="Tutor reviews"
      description="Confidential feedback from apprentices about their tutor. Answers are stored without a name."
    >
      {page.loadError ? (
        <section className={styles.card}>
          <h2>Not available yet</h2>
          <p className={styles.lead}>{page.loadError}</p>
        </section>
      ) : (
        <TutorReviewsBoard
          rounds={page.rounds}
          tracker={page.tracker}
          reports={page.reports}
          concerns={page.concerns}
          attempts={page.attempts}
          emailQueueReady={page.emailQueueReady}
          emailMode={emailMode}
          workspace={workspace}
        />
      )}
    </ApprenticePageShell>
  );
}
