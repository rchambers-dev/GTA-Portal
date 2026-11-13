import { redirect } from "next/navigation";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { canAddApprentice } from "@/features/administration/domain/apprentice-record";
import { TUTOR_REVIEW_TITLE } from "@/features/tutor-reviews/domain/catalogue";
import { readStaffPreview } from "@/features/tutor-reviews/domain/repository";
import { TutorReviewForm } from "@/features/tutor-reviews/screens/TutorReviewForm";
import styles from "@/features/tutor-reviews/screens/tutor-reviews.module.css";

export const metadata = { title: `Preview · ${TUTOR_REVIEW_TITLE}`, robots: { index: false, follow: false } };

function Notice({ message }: { message: string }) {
  return (
    <main className={styles.form}>
      <div className={`${styles.formInner} ${styles.card}`}>
        <p className={styles.previewBanner}>Preview</p>
        <h1>{TUTOR_REVIEW_TITLE}</h1>
        <p className={styles.lead}>{message}</p>
      </div>
    </main>
  );
}

export default async function TutorReviewPreviewPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params;
  const session = await getSupabaseEffectiveSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/tutor-review/preview/${roundId}`)}`);
  if (!canAddApprentice(session)) {
    return <Notice message="Administrator and Management can preview a tutor review." />;
  }
  const form = await readStaffPreview(roundId);
  if (!form) return <Notice message="This review is not available." />;
  if (form.state !== "ready") return <Notice message="This form is not available." />;
  return <TutorReviewForm preview form={form} />;
}
