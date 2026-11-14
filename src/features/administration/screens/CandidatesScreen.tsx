import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./candidates.module.css";

export function CandidatesScreen() {
  return (
    <ApprenticePageShell eyebrow="Onboarding" title="Candidates">
      <section className={styles.card}>
        <h2>Candidates</h2>
        <p>No candidates yet.</p>
      </section>
    </ApprenticePageShell>
  );
}
