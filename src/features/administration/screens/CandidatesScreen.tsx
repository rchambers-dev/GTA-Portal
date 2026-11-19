import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./candidates.module.css";

export function CandidatesScreen() {
  return (
    <ApprenticePageShell eyebrow="Onboarding" title="Applicants">
      <section className={styles.card}>
        <h2>Applicants</h2>
        <p>No applicants yet.</p>
      </section>
    </ApprenticePageShell>
  );
}
