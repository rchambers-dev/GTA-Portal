"use client";

import Link from "next/link";
import { useState } from "react";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import { TRAINING_SITES } from "./learner-entry-options";
import styles from "./admin-pages.module.css";

const STATS = ["Stage 1", "Awaiting interview", "Stage 2", "Employer needed"] as const;

/**
 * Portal-styled preview of the marketing app's /overview page.
 * Panels are explicitly empty. No live counts or events are loaded.
 */
export function OnboardingOverview({
  workspace,
}: {
  workspace: "administration" | "management";
}) {
  const [site, setSite] = useState<string>("all");
  const base = `/${workspace}/onboarding`;
  const siteLabel =
    TRAINING_SITES.find((item) => item.value === site)?.label ?? "All sites";

  return (
    <ApprenticePageShell
      eyebrow="Onboarding"
      title="Overview"
      description="Example preview of the recruitment overview. Saving is disabled."
      actions={
        <div className={styles.toolbarActions}>
          <Link className={styles.primaryBtn} href={`${base}/apprentice`}>
            Add apprentice
          </Link>
          <Link className={styles.secondaryBtn} href={`${base}/employer`}>
            Add employer
          </Link>
        </div>
      }
    >
      <div className={styles.stack} data-onboarding-overview={workspace}>
        <p className={styles.previewBanner} role="status">
          EXAMPLE DATA. Saving is disabled. These panels are empty on purpose. No live counts or events are loaded.
        </p>
        <p className={styles.learnerKicker}>Your recruitment overview</p>
        <div className={styles.overviewFilters} role="group" aria-label="Site">
          <button
            type="button"
            className={site === "all" ? styles.overviewChipActive : styles.overviewChip}
            onClick={() => setSite("all")}
          >
            All sites
          </button>
          {TRAINING_SITES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={site === item.value ? styles.overviewChipActive : styles.overviewChip}
              onClick={() => setSite(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className={styles.learnerMuted}>Example preview for {siteLabel}.</p>
        <div className={styles.overviewStats}>
          {STATS.map((label) => (
            <article key={label} className={styles.learnerCard}>
              <p className={styles.learnerMuted}>{label}</p>
              <p className={styles.overviewStat}>—</p>
            </article>
          ))}
        </div>
        <div className={styles.overviewMain}>
          <div className={styles.stack}>
            <EmptyPanel title="Needs your attention" />
            <EmptyPanel title="Recent updates" />
          </div>
          <div className={styles.stack}>
            <EmptyPanel title="Next interview group" />
            <EmptyPanel title="Upcoming activity" />
          </div>
        </div>
      </div>
    </ApprenticePageShell>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <article className={styles.learnerCard}>
      <h2 className={styles.formGroupTitle}>{title}</h2>
      <p className={styles.empty}>Example preview. Nothing is loaded.</p>
    </article>
  );
}
