"use client";

import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";

/** Names a missing recruitment page. It does not save or enforce the rules it lists. */
export function RecruitmentGapScreen({
  eyebrow,
  title,
  description,
  gaps,
}: {
  eyebrow: string;
  title: string;
  description: string;
  gaps: string[];
}) {
  return (
    <ApprenticePageShell eyebrow={eyebrow} title={title} description={description}>
      <div className={styles.stack} data-recruitment-gap={title}>
        <p className={styles.previewBanner} role="status">
          NOT BUILT. Saving is disabled. No records are loaded, and none of these rules are enforced.
        </p>
        <article className={styles.learnerCard}>
          <h2 className={styles.formGroupTitle}>Not built</h2>
          <ul className={styles.gapList}>
            {gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </article>
      </div>
    </ApprenticePageShell>
  );
}
