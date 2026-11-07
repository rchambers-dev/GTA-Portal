"use client";

import Link from "next/link";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";

/**
 * Marketing & Recruitment landing. Employer rows are the Onboarding directory.
 * Calendar, actions, vacancies, reports, and settings are not built.
 */
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
      description="The employer list is shared with Onboarding. Vacancy, calendar, action, report, and settings behaviour is not built."
    >
      <div className={styles.stack} data-marketing-overview={workspace}>
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. No live counts are loaded.
        </p>
        <div className={styles.toolbarActions}>
          <Link className={styles.primaryBtn} href={`${base}/employers`}>
            Employers & vacancies
          </Link>
          <Link className={styles.secondaryBtn} href={`${base}/calendar`}>
            Activity calendar
          </Link>
        </div>
        <article className={styles.learnerCard}>
          <h2 className={styles.formGroupTitle}>What is not built</h2>
          <ul className={styles.gapList}>
            <li>Vacancy places, allocation, and withdrawal reopening.</li>
            <li>The shared activity calendar. Participant attendance is not part of that calendar.</li>
            <li>Recruitment actions. This is not the progress-mentor actions queue, and nothing sends a message.</li>
            <li>Reports stay on the existing reports stub. The Word template and Forms mapping are absent.</li>
            <li>Settings for invites, roles, and permanent deletion.</li>
          </ul>
        </article>
      </div>
    </ApprenticePageShell>
  );
}
