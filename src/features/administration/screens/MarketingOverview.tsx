"use client";

import Link from "next/link";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";

/** Landing for Marketing & Recruitment. Employer rows are the shared directory. */
export function MarketingOverview({
  workspace,
}: {
  workspace: "administration" | "management";
}) {
  const base = `/${workspace}/marketing`;
  return (
    <ApprenticePageShell
      eyebrow="Marketing & Recruitment"
      title="Overview"
      description="Employers use the same example records as Onboarding. Vacancies, the activity calendar, recruitment actions, and settings are not built."
    >
      <div className={styles.stack} data-marketing-overview={workspace}>
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. No live counts are loaded.
        </p>
        <div className={styles.toolbarActions}>
          <Link className={styles.primaryBtn} href={`${base}/employers`}>
            Employers & vacancies
          </Link>
        </div>
        <article className={styles.learnerCard}>
          <h2 className={styles.formGroupTitle}>Not built</h2>
          <ul className={styles.gapList}>
            <li>Vacancy places, allocation, and withdrawal reopening.</li>
            <li>The activity calendar. Participant attendance is not part of it.</li>
            <li>Recruitment actions. This is not the progress-mentor Action Centre, and nothing sends a message.</li>
            <li>Reports open the existing reports stub. No Word template is attached.</li>
            <li>Settings for invites and deletion.</li>
          </ul>
        </article>
      </div>
    </ApprenticePageShell>
  );
}
