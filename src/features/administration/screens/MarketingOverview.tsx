"use client";

import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import styles from "./admin-pages.module.css";

/**
 * Navigation scaffold only. No marketing features, counts, or records.
 */
export function MarketingOverview() {
  return (
    <ApprenticePageShell
      eyebrow="Marketing & Recruitment"
      title="Overview"
      description="Preview only. Marketing & Recruitment is not configured."
    >
      <div className={styles.stack} data-marketing-overview="true">
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. Marketing & Recruitment is not configured. No features, counts, or records are loaded.
        </p>
        <article className={styles.learnerCard}>
          <h2 className={styles.formGroupTitle}>Not configured</h2>
          <p className={styles.empty}>
            This overview is a placeholder. Further Marketing & Recruitment pages have not been chosen.
          </p>
        </article>
      </div>
    </ApprenticePageShell>
  );
}
