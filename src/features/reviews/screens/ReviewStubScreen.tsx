import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./plan.module.css";

export function ReviewStubScreen({ title }: { title: string }) {
  return (
    <ApprenticePageShell
      eyebrow="Reviews"
      title={title}
      description="This page comes later. Plan is the screen that is ready."
    >
      <section className={styles.stubCard}>
        <h2>{title}</h2>
        <p>Nothing to do here yet.</p>
      </section>
    </ApprenticePageShell>
  );
}
