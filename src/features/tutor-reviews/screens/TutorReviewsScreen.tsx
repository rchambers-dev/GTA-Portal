import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { loadTutorReviewsPage } from "../domain/repository";
import { TutorReviewsBoard } from "./TutorReviewsBoard";
import styles from "./tutor-reviews.module.css";

export async function TutorReviewsScreen() {
  const page = await loadTutorReviewsPage();
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
        <TutorReviewsBoard rounds={page.rounds} tracker={page.tracker} reports={page.reports} concerns={page.concerns} />
      )}
    </ApprenticePageShell>
  );
}
