import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { createSupabaseServerClient } from "@/adapters/supabase/client";
import { recordGraphBounces } from "../domain/email-dispatch";
import { currentEmailMode } from "../domain/email-provider";
import { loadTutorReviewsPage } from "../domain/repository";
import { TutorReviewsBoard } from "./TutorReviewsBoard";
import styles from "./tutor-reviews.module.css";

export async function TutorReviewsScreen({ workspace }: { workspace: "administration" | "management" }) {
  const emailMode = currentEmailMode();
  if (emailMode === "live") {
    try {
      await recordGraphBounces(await createSupabaseServerClient());
    } catch {
      // The page still opens when the mailbox check fails.
    }
  }
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
